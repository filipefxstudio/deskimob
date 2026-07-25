import {
  IMOVIEW_IMPORT_CORRETOR_ID,
  STORAGE_ESTIMATE_CONFIG,
} from "@/lib/imoview/constants";
import {
  fetchImobeeMetadataBatch,
  fetchPhotoContentLength,
} from "@/lib/imoview/fetch-imobee-metadata";
import {
  computePhotoStats,
  formatBytesLabel,
  getStorageUsageBytes,
  stratifiedSample,
} from "@/lib/imoview/get-storage-usage";
import { countProprietariosSemTelefone } from "@/lib/imoview/parse-proprietario";
import {
  countByField,
  filterPhotoEligible,
  normalizeCodigo,
  parseXlsBuffer,
} from "@/lib/imoview/parse-xls";
import type { AnalyzeResponse, XlsRow } from "@/lib/imoview/types";

type AnalyzeOptions = {
  buffer: ArrayBuffer | Buffer;
  filename?: string;
  exportYear?: number;
  supabasePlan?: "free" | "pro";
  skipImobeeApi?: boolean;
};

function resolveSupabasePlan(): "free" | "pro" {
  const env = process.env.SUPABASE_PLAN?.toLowerCase();
  return env === "pro" ? "pro" : "free";
}

function computeStorageStatus(
  projectedBytes: number,
  limitBytes: number,
): { status: "green" | "yellow" | "red"; recommendation: string } {
  const ratio = projectedBytes / limitBytes;

  if (ratio >= STORAGE_ESTIMATE_CONFIG.blockThreshold) {
    return {
      status: "red",
      recommendation:
        "Projeção acima de 90% do limite. Importe apenas a planilha (sem fotos) ou faça upgrade do plano Supabase.",
    };
  }

  if (ratio >= STORAGE_ESTIMATE_CONFIG.warningThreshold) {
    return {
      status: "yellow",
      recommendation:
        "Projeção entre 70% e 90% do limite. Confirme antes de importar fotos.",
    };
  }

  return {
    status: "green",
    recommendation: "Espaço suficiente para importação de fotos.",
  };
}

export async function analyzeSpreadsheet(options: AnalyzeOptions): Promise<AnalyzeResponse> {
  const parsed = parseXlsBuffer(options.buffer, {
    filename: options.filename,
    exportYear: options.exportYear,
  });

  const { rows, exportYear } = parsed;
  const semTelefone = countProprietariosSemTelefone(rows);
  const eligible = filterPhotoEligible(rows);
  const plan = options.supabasePlan ?? resolveSupabasePlan();
  const limitBytes =
    plan === "pro"
      ? STORAGE_ESTIMATE_CONFIG.proLimitBytes
      : STORAGE_ESTIMATE_CONFIG.freeLimitBytes;

  let totalPhotoCount = 0;
  let sampleSize = 0;
  let avgBytesPerPhoto = 150_000;
  let p90BytesPerPhoto = 250_000;

  if (!options.skipImobeeApi && eligible.length > 0) {
    const codigos = eligible
      .map((r) => normalizeCodigo(r.Codigo))
      .filter(Boolean)
      .slice(0, 300);

    const metadataMap = await fetchImobeeMetadataBatch(codigos);

    const photoEntries: { codigo: string; url: string; count: number }[] = [];
    for (const [codigo, meta] of metadataMap) {
      totalPhotoCount += meta.fotos.length;
      for (const foto of meta.fotos) {
        photoEntries.push({ codigo, url: foto.url, count: meta.fotos.length });
      }
    }

    const sampleTargets = stratifiedSample(
      photoEntries,
      STORAGE_ESTIMATE_CONFIG.photoSampleSize,
      (e) => e.count,
    );

    const sampleSizes: number[] = [];
    for (const entry of sampleTargets) {
      const size = await fetchPhotoContentLength(entry.url);
      if (size && size > 0) sampleSizes.push(size);
    }

    sampleSize = sampleSizes.length;
    const stats = computePhotoStats(sampleSizes);
    avgBytesPerPhoto = stats.avgBytesPerPhoto;
    p90BytesPerPhoto = stats.p90BytesPerPhoto;

    if (totalPhotoCount === 0 && eligible.length > 0) {
      totalPhotoCount = eligible.length * 10;
    }
  } else if (eligible.length > 0) {
    totalPhotoCount = eligible.length * 10;
  }

  const estimatedBytes = Math.round(
    totalPhotoCount * p90BytesPerPhoto * STORAGE_ESTIMATE_CONFIG.safetyMargin,
  );

  const usedBytes = await getStorageUsageBytes();
  const projectedBytes = usedBytes + estimatedBytes + STORAGE_ESTIMATE_CONFIG.dbEstimateBytes;
  const { status, recommendation } = computeStorageStatus(projectedBytes, limitBytes);

  return {
    spreadsheet: {
      totalRows: rows.length,
      bySituacao: countByField(rows, "Situacao"),
      proprietariosSemTelefone: semTelefone.count,
      byTipo: countByField(rows, "Tipo"),
      exportYear,
    },
    photos: {
      eligibleCount: eligible.length,
      totalPhotoCount,
      sampleSize,
      avgBytesPerPhoto,
      p90BytesPerPhoto,
      estimatedBytes,
      estimatedLabel: formatBytesLabel(estimatedBytes),
    },
    storage: {
      plan,
      limitBytes,
      usedBytes,
      projectedBytes,
      percentUsed: Math.round((projectedBytes / limitBytes) * 1000) / 10,
      status,
      recommendation,
    },
    database: {
      estimatedNewBytes: STORAGE_ESTIMATE_CONFIG.dbEstimateBytes,
      limitBytes: 512 * 1024 * 1024,
      status: "green",
    },
  };
}

export function summarizeRowsForImport(rows: XlsRow[], limit?: number): XlsRow[] {
  if (limit && limit > 0) return rows.slice(0, limit);
  return rows;
}
