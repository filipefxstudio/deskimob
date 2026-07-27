import {
  IMOVIEW_CAPTADOR_PRINCIPAL_ID,
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
  stratifiedSample,
} from "@/lib/imoview/get-storage-usage";
import { countProprietariosSemTelefone } from "@/lib/imoview/parse-proprietario";
import {
  countByField,
  filterMigratableRows,
  filterPhotoEligible,
  normalizeCodigo,
  parseXlsBuffer,
} from "@/lib/imoview/parse-xls";
import type { AnalyzeResponse, XlsRow } from "@/lib/imoview/types";

type AnalyzeOptions = {
  buffer: ArrayBuffer | Buffer;
  filename?: string;
  exportYear?: number;
  skipImobeeApi?: boolean;
};

export async function analyzeSpreadsheet(options: AnalyzeOptions): Promise<AnalyzeResponse> {
  const parsed = parseXlsBuffer(options.buffer, {
    filename: options.filename,
    exportYear: options.exportYear,
  });

  const { rows, exportYear } = parsed;
  const migratable = filterMigratableRows(rows);
  const semTelefone = countProprietariosSemTelefone(migratable);
  const eligible = filterPhotoEligible(migratable);

  let totalPhotoCount = 0;
  let sampleSize = 0;
  let avgBytesPerPhoto = 150_000;
  let p90BytesPerPhoto = 250_000;

  if (!options.skipImobeeApi && eligible.length > 0) {
    const codigos = eligible
      .map((r) => normalizeCodigo(r.Codigo))
      .filter(Boolean);

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

  const dbEstimateBytes = Math.round(
    STORAGE_ESTIMATE_CONFIG.dbEstimateBytes * (migratable.length / 2190),
  );

  return {
    spreadsheet: {
      totalRows: rows.length,
      migratableRows: migratable.length,
      excludedDesativado: rows.length - migratable.length,
      bySituacao: countByField(rows, "Situacao"),
      proprietariosSemTelefone: semTelefone.count,
      byTipo: countByField(migratable, "Tipo"),
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
      destination: "cloudinary",
    },
    storage: {
      provider: "cloudinary",
      status: "green",
      recommendation:
        "Fotos serão enviadas ao Cloudinary (preset deskimob_fotos_imovel). Não consome Supabase Storage.",
    },
    database: {
      estimatedNewBytes: dbEstimateBytes,
      limitBytes: 512 * 1024 * 1024,
      status: "green",
    },
  };
}

export function summarizeRowsForImport(rows: XlsRow[], limit?: number): XlsRow[] {
  const migratable = filterMigratableRows(rows);
  if (limit && limit > 0) return migratable.slice(0, limit);
  return migratable;
}
