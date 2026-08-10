"use server";

import { revalidatePath } from "next/cache";

import { requireSiteAdmin } from "@/lib/auth/equipe-access";
import { domainLookupCandidates, normalizeCustomDomainInput } from "@/lib/site/domain-normalize";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getVercelConfig, VercelNotConfiguredError } from "@/lib/vercel/config";
import {
  addProjectDomain,
  buildDnsRecordsFromVercel,
  getDomainConfig,
  getProjectDomain,
  mapVercelErrorMessage,
  removeProjectDomain,
  verifyProjectDomain,
} from "@/lib/vercel/domains";
import type {
  Corretor,
  DominioCustomStatus,
  DominioDnsRecord,
  SiteDominioStatusPayload,
} from "@/types";

export type SiteDomainActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  status?: SiteDominioStatusPayload;
};

type CorretorDomainRow = Pick<
  Corretor,
  | "id"
  | "slug"
  | "dominio_custom"
  | "dominio_custom_status"
  | "dominio_custom_erro"
  | "dominio_custom_verificacao"
>;

async function requireSiteAdminCorretorDomain(): Promise<
  { error: string } | { corretor: CorretorDomainRow }
> {
  const ctx = await requireSiteAdmin();

  if ("error" in ctx) {
    return ctx;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("corretores")
    .select(
      "id, slug, dominio_custom, dominio_custom_status, dominio_custom_erro, dominio_custom_verificacao",
    )
    .eq("id", ctx.corretor.id)
    .maybeSingle();

  if (error || !data) {
    return { error: "Não foi possível carregar as configurações do domínio." };
  }

  return { corretor: data as CorretorDomainRow };
}

async function assertDomainNotUsedByOtherCorretor(domain: string, corretorId: string) {
  const admin = createServiceRoleClient();
  const candidates = domainLookupCandidates(domain);

  for (const candidate of candidates) {
    const { data } = await admin
      .from("corretores")
      .select("id")
      .eq("dominio_custom", candidate)
      .neq("id", corretorId)
      .maybeSingle();

    if (data) {
      return "Este domínio já está vinculado a outra conta Deskimob.";
    }
  }

  return null;
}

async function persistDomainState(
  corretorId: string,
  payload: {
    dominio_custom: string | null;
    dominio_custom_status: DominioCustomStatus;
    dominio_custom_erro: string | null;
    dominio_custom_verificacao: DominioDnsRecord[] | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update(payload)
    .eq("id", corretorId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Não foi possível salvar o status do domínio." };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");
  return {};
}

function resolveDomainStatus(
  verified: boolean,
  misconfigured: boolean,
): { status: DominioCustomStatus; error: string | null } {
  if (verified && !misconfigured) {
    return { status: "active", error: null };
  }

  if (verified && misconfigured) {
    return {
      status: "pending_dns",
      error: null,
    };
  }

  return { status: "pending_dns", error: null };
}

async function buildStatusPayload(
  corretor: CorretorDomainRow,
  options?: { refreshFromVercel?: boolean },
): Promise<SiteDominioStatusPayload> {
  const domain = corretor.dominio_custom?.trim() || null;

  if (!domain) {
    return {
      domain: null,
      status: "none",
      error: null,
      verified: false,
      misconfigured: true,
      dnsRecords: [],
    };
  }

  const storedRecords = (corretor.dominio_custom_verificacao as DominioDnsRecord[] | null) ?? [];
  let verified = corretor.dominio_custom_status === "active";
  let misconfigured = corretor.dominio_custom_status !== "active";
  let dnsRecords = storedRecords;
  let status = (corretor.dominio_custom_status ?? "none") as DominioCustomStatus;
  let error = corretor.dominio_custom_erro ?? null;

  if (options?.refreshFromVercel && getVercelConfig().configured) {
    try {
      const projectDomain = await getProjectDomain(domain);
      const config = await getDomainConfig(domain);
      const freshRecords = buildDnsRecordsFromVercel(domain, projectDomain, config);
      if (freshRecords.length > 0) {
        dnsRecords = freshRecords;
      }
      verified = projectDomain.verified;
      misconfigured = config.misconfigured;
      const resolved = resolveDomainStatus(verified, misconfigured);
      status = resolved.status;
      error = resolved.error;
    } catch {
      // Mantém dados persistidos se a API falhar temporariamente.
    }
  }

  return {
    domain,
    status,
    error,
    verified,
    misconfigured,
    dnsRecords,
  };
}

export async function getSiteDominioStatus(): Promise<SiteDomainActionResult> {
  const access = await requireSiteAdminCorretorDomain();
  if ("error" in access) {
    return access;
  }

  const status = await buildStatusPayload(access.corretor, { refreshFromVercel: true });
  return { success: true, status };
}

export async function connectSiteDominio(domainInput: string): Promise<SiteDomainActionResult> {
  const access = await requireSiteAdminCorretorDomain();
  if ("error" in access) {
    return access;
  }

  if (!getVercelConfig().configured) {
    return {
      error:
        "Domínio próprio temporariamente indisponível. Use o endereço por slug ou fale com o suporte.",
    };
  }

  const domain = normalizeCustomDomainInput(domainInput);
  if (!domain) {
    return { error: "Informe um domínio válido, ex.: imobiliaria.com.br ou www.imobiliaria.com.br" };
  }

  const duplicateError = await assertDomainNotUsedByOtherCorretor(domain, access.corretor.id);
  if (duplicateError) {
    return { error: duplicateError };
  }

  const previousDomain = access.corretor.dominio_custom?.trim() || null;

  try {
    if (previousDomain && previousDomain !== domain) {
      try {
        await removeProjectDomain(previousDomain);
      } catch {
        // Domínio anterior pode já ter sido removido manualmente.
      }
    }

    let projectDomain;
    try {
      projectDomain = await addProjectDomain(domain);
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("already")) {
        projectDomain = await getProjectDomain(domain);
      } else {
        throw error;
      }
    }

    const config = await getDomainConfig(domain);
    const dnsRecords = buildDnsRecordsFromVercel(domain, projectDomain, config);
    const { status, error: statusError } = resolveDomainStatus(
      projectDomain.verified,
      config.misconfigured,
    );

    const persist = await persistDomainState(access.corretor.id, {
      dominio_custom: domain,
      dominio_custom_status: status,
      dominio_custom_erro: statusError,
      dominio_custom_verificacao: dnsRecords,
    });

    if ("error" in persist && persist.error) {
      return persist;
    }

    const statusPayload = await buildStatusPayload({
      ...access.corretor,
      dominio_custom: domain,
      dominio_custom_status: status,
      dominio_custom_erro: statusError,
      dominio_custom_verificacao: dnsRecords,
    });

    return {
      success: true,
      message:
        status === "active"
          ? "Domínio conectado e ativo."
          : "Domínio registrado. Configure os DNS abaixo e clique em Verificar.",
      status: statusPayload,
    };
  } catch (error) {
    if (error instanceof VercelNotConfiguredError) {
      return { error: error.message };
    }

    const message = mapVercelErrorMessage(error);
    await persistDomainState(access.corretor.id, {
      dominio_custom: domain,
      dominio_custom_status: "error",
      dominio_custom_erro: message,
      dominio_custom_verificacao: null,
    });

    return { error: message };
  }
}

export async function verifySiteDominio(): Promise<SiteDomainActionResult> {
  const access = await requireSiteAdminCorretorDomain();
  if ("error" in access) {
    return access;
  }

  const domain = access.corretor.dominio_custom?.trim();
  if (!domain) {
    return { error: "Nenhum domínio configurado." };
  }

  if (!getVercelConfig().configured) {
    return { error: "Integração Vercel indisponível no momento." };
  }

  try {
    await verifyProjectDomain(domain);
    const projectDomain = await getProjectDomain(domain);
    const config = await getDomainConfig(domain);
    const dnsRecords = buildDnsRecordsFromVercel(domain, projectDomain, config);
    const { status, error: statusError } = resolveDomainStatus(
      projectDomain.verified,
      config.misconfigured,
    );

    const persist = await persistDomainState(access.corretor.id, {
      dominio_custom: domain,
      dominio_custom_status: status,
      dominio_custom_erro: statusError,
      dominio_custom_verificacao: dnsRecords,
    });

    if ("error" in persist && persist.error) {
      return persist;
    }

    const statusPayload: SiteDominioStatusPayload = {
      domain,
      status,
      error: statusError,
      verified: projectDomain.verified,
      misconfigured: config.misconfigured,
      dnsRecords,
    };

    const message =
      status === "active"
        ? "Domínio verificado e ativo."
        : "DNS ainda pendente. Confira os registros abaixo e tente novamente em alguns minutos.";

    return { success: true, message, status: statusPayload };
  } catch (error) {
    const message = mapVercelErrorMessage(error);
    await persistDomainState(access.corretor.id, {
      dominio_custom: domain,
      dominio_custom_status: "pending_dns",
      dominio_custom_erro: message,
      dominio_custom_verificacao: access.corretor.dominio_custom_verificacao ?? null,
    });
    return { error: message };
  }
}

export async function disconnectSiteDominio(): Promise<SiteDomainActionResult> {
  const access = await requireSiteAdminCorretorDomain();
  if ("error" in access) {
    return access;
  }

  const domain = access.corretor.dominio_custom?.trim();

  if (domain && getVercelConfig().configured) {
    try {
      await removeProjectDomain(domain);
    } catch {
      // Continua limpando no banco mesmo se já foi removido na Vercel.
    }
  }

  const persist = await persistDomainState(access.corretor.id, {
    dominio_custom: null,
    dominio_custom_status: "none",
    dominio_custom_erro: null,
    dominio_custom_verificacao: null,
  });

  if ("error" in persist && persist.error) {
    return persist;
  }

  return {
    success: true,
    message: "Domínio removido.",
    status: {
      domain: null,
      status: "none",
      error: null,
      verified: false,
      misconfigured: true,
      dnsRecords: [],
    },
  };
}

export async function isSiteDominioAutomationEnabled(): Promise<boolean> {
  return getVercelConfig().configured;
}
