/**
 * Ativa imóvel migrado (disponível + site + fotos Imobee) em Imobee e/ou Kenia.
 * Uso: npx tsx scripts/imoview-activate-codigo.ts 1997 imobee kenia
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  const codigo = args.find((arg) => /^\d+$/.test(arg));
  const targetIds = args.filter((arg) => arg !== codigo) as ("imobee" | "kenia")[];

  if (!codigo) {
    console.error("Informe o código. Ex.: npx tsx scripts/imoview-activate-codigo.ts 1997 imobee kenia");
    process.exit(1);
  }

  const targets = targetIds.length > 0 ? targetIds : (["imobee", "kenia"] as const);

  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { resolveImportTarget, resolveStatusFromSituacao, loadStatusImovelLookup } =
    await import("../lib/imoview/import-target");
  const { enrichImovelWithPhotos } = await import("../lib/imoview/enrich-from-imobee");

  const admin = createServiceRoleClient();

  for (const targetId of targets) {
    console.log(`\n=== Ativando ${codigo} em ${targetId} ===`);
    const target = await resolveImportTarget(admin, targetId);
    const lookup = await loadStatusImovelLookup(admin, target.corretorId);
    const status = resolveStatusFromSituacao("Vago/Disponível", lookup);

    const { data: imovel, error } = await admin
      .from("imoveis")
      .select("id, codigo, titulo, cidade, status, publicado_site")
      .eq("corretor_id", target.corretorId)
      .eq("codigo", codigo)
      .maybeSingle();

    if (error || !imovel) {
      console.error("Imóvel não encontrado:", error?.message ?? codigo);
      process.exitCode = 1;
      continue;
    }

    console.log("Antes:", { status: imovel.status, publicado_site: imovel.publicado_site, titulo: imovel.titulo });

    const updatePayload: Record<string, unknown> = {
      status: status.status,
      status_imovel_id: status.statusImovelId,
      status_aprovacao: status.statusAprovacao,
      publicado_site: true,
      motivo_desativacao: null,
    };

    if (targetId === "kenia") {
      updatePayload.exibir_endereco_site = "oculto";
    }

    const { error: updateError } = await admin
      .from("imoveis")
      .update(updatePayload)
      .eq("id", imovel.id);

    if (updateError) {
      console.error("Falha ao atualizar status:", updateError.message);
      process.exitCode = 1;
      continue;
    }

    const enrichment = await enrichImovelWithPhotos(
      admin,
      imovel.id,
      codigo,
      imovel.cidade ?? "",
      target.corretorId,
    );

    const { data: updated } = await admin
      .from("imoveis")
      .select("titulo, slug, status, publicado_site")
      .eq("id", imovel.id)
      .single();

    console.log("Depois:", updated);
    console.log("Fotos:", enrichment.photosDownloaded, "ok,", enrichment.photosFailed, "falha");
    if (enrichment.warning) console.log("Aviso:", enrichment.warning);
    if (enrichment.tituloAtualizado) console.log("Título atualizado via Imobee.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
