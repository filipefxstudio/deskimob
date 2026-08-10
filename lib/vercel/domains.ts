import { vercelFetch } from "@/lib/vercel/client";
import { getVercelConfig } from "@/lib/vercel/config";
import type { DominioDnsRecord } from "@/types";

export type VercelDomainVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type VercelProjectDomain = {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: VercelDomainVerification[];
};

type VercelDomainConfig = {
  misconfigured: boolean;
  configuredBy: string | null;
  recommendedCNAME?: { rank: number; value: string }[];
  recommendedIPv4?: { rank: number; value: string[] }[];
};

function projectIdEncoded(): string {
  return encodeURIComponent(getVercelConfig().projectId);
}

type AddProjectDomainOptions = {
  redirect?: string;
  redirectStatusCode?: 301 | 302 | 307 | 308;
};

export async function addProjectDomain(
  domain: string,
  options?: AddProjectDomainOptions,
): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(`/v10/projects/${projectIdEncoded()}/domains`, {
    method: "POST",
    body: JSON.stringify({
      name: domain,
      ...(options?.redirect ? { redirect: options.redirect } : {}),
      ...(options?.redirectStatusCode ? { redirectStatusCode: options.redirectStatusCode } : {}),
    }),
  });
}

function isDomainAlreadyOnProjectError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("already") || message.includes("exist");
}

/** Garante www.apex no projeto Vercel (certificado SSL + redirecionamento para o apex). */
export async function ensureWwwDomainRedirect(apexDomain: string): Promise<void> {
  const apex = apexDomain.replace(/^www\./i, "").toLowerCase();
  if (!apex || apex.startsWith("www.")) {
    return;
  }

  const wwwDomain = `www.${apex}`;
  const redirectTarget = apex;

  try {
    await addProjectDomain(wwwDomain, {
      redirect: redirectTarget,
      redirectStatusCode: 308,
    });
  } catch (error) {
    if (!isDomainAlreadyOnProjectError(error)) {
      throw error;
    }

    try {
      await vercelFetch<VercelProjectDomain>(
        `/v9/projects/${projectIdEncoded()}/domains/${encodeURIComponent(wwwDomain)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            redirect: redirectTarget,
            redirectStatusCode: 308,
          }),
        },
      );
    } catch {
      // www já existe no projeto — segue com a configuração atual.
    }
  }
}

export async function getProjectDomain(domain: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(
    `/v9/projects/${projectIdEncoded()}/domains/${encodeURIComponent(domain)}`,
  );
}

export async function verifyProjectDomain(domain: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(
    `/v9/projects/${projectIdEncoded()}/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" },
  );
}

export async function removeProjectDomain(domain: string): Promise<void> {
  await vercelFetch<void>(
    `/v9/projects/${projectIdEncoded()}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" },
  );
}

export async function getDomainConfig(domain: string): Promise<VercelDomainConfig> {
  const { projectId } = getVercelConfig();
  return vercelFetch<VercelDomainConfig>(`/v6/domains/${encodeURIComponent(domain)}/config`, {
    query: { projectIdOrName: projectId },
  });
}

export function buildDnsRecordsFromVercel(
  domain: string,
  projectDomain: VercelProjectDomain,
  config: VercelDomainConfig,
): DominioDnsRecord[] {
  const records: DominioDnsRecord[] = [];
  const isWww = domain.startsWith("www.");
  const apex = projectDomain.apexName || domain.replace(/^www\./, "");

  const cname =
    config.recommendedCNAME?.slice().sort((a, b) => a.rank - b.rank)[0]?.value ??
    "cname.vercel-dns.com";
  const ipv4 =
    config.recommendedIPv4?.slice().sort((a, b) => a.rank - b.rank)[0]?.value[0] ?? "76.76.21.21";

  if (isWww) {
    records.push({
      type: "CNAME",
      name: "www",
      value: cname,
      description: "Aponta www para o Deskimob",
    });
  } else {
    records.push({
      type: "A",
      name: "@",
      value: ipv4,
      description: "Aponta o domínio raiz para o Deskimob",
    });
    records.push({
      type: "CNAME",
      name: "www",
      value: cname,
      description: "Recomendado: redirecionar www para o mesmo site",
    });
  }

  for (const challenge of projectDomain.verification ?? []) {
    if (challenge.type !== "TXT") {
      continue;
    }

    const host =
      challenge.domain === domain || challenge.domain === apex
        ? "@"
        : challenge.domain.replace(`.${apex}`, "");

    records.push({
      type: "TXT",
      name: host,
      value: challenge.value,
      description: challenge.reason || "Verificação de propriedade do domínio",
    });
  }

  return records;
}

export function mapVercelErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Não foi possível configurar o domínio. Tente novamente.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("already assigned") || message.includes("already exists")) {
    return "Este domínio já está em uso em outro projeto Vercel. Remova-o lá ou entre em contato com o suporte.";
  }

  if (message.includes("not valid")) {
    return "Domínio inválido. Informe apenas o endereço, ex.: imobiliaria.com.br";
  }

  if (message.includes("payment")) {
    return "Limite de domínios do plano Vercel atingido. Entre em contato com o suporte.";
  }

  if (message.includes("not authorized") || message.includes("permission")) {
    return "Sem permissão na API Vercel. Avise o suporte.";
  }

  return error.message;
}
