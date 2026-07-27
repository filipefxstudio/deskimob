"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnalyzeResponse, ImportSummary } from "@/lib/imoview/types";

function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ImoviewImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [limit, setLimit] = useState("10");
  const [importPhotos, setImportPhotos] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setAnalysis(null);
    setImportResult(null);
    setError(null);
  }, []);

  const buildFormData = useCallback(() => {
    if (!file) throw new Error("Selecione um arquivo XLS.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("exportYear", exportYear);
    return fd;
  }, [file, exportYear]);

  const handleAnalyze = useCallback(async () => {
    setError(null);
    setAnalyzing(true);
    setImportResult(null);

    try {
      const fd = buildFormData();
      const response = await fetch("/api/admin/imoview/analyze", {
        method: "POST",
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Falha na análise.");
      }
      setAnalysis(data as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na análise.");
    } finally {
      setAnalyzing(false);
    }
  }, [buildFormData]);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setError(null);
    setImporting(true);

    try {
      const fd = buildFormData();
      fd.append("limit", limit);
      fd.append("skipPhotos", importPhotos ? "false" : "true");

      const response = await fetch("/api/admin/imoview/import", {
        method: "POST",
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Falha na importação.");
      }
      setImportResult(data.summary as ImportSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na importação.");
    } finally {
      setImporting(false);
    }
  }, [buildFormData, file, importPhotos, limit]);

  const migratableMax = analysis?.spreadsheet.migratableRows ?? 676;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Upload da planilha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="xls-file">Arquivo XLS (Indicadores Imoview)</Label>
            <Input
              id="xls-file"
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="export-year">Ano da exportação</Label>
              <Input
                id="export-year"
                type="number"
                min={1990}
                max={2100}
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-limit">Limitar importação (teste)</Label>
              <Input
                id="import-limit"
                type="number"
                min={1}
                max={migratableMax}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Máx. {migratableMax} (exclui Desativado)
              </p>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={importPhotos}
                  onCheckedChange={(v) => setImportPhotos(v === true)}
                />
                Importar fotos (Cloudinary)
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleAnalyze} disabled={!file || analyzing}>
              {analyzing ? "Analisando…" : "Analisar planilha"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing
                ? "Importando…"
                : importPhotos
                  ? "Iniciar importação (com fotos)"
                  : "Iniciar importação (sem fotos)"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {analysis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Resumo da planilha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatGrid
                items={[
                  { label: "Total na planilha", value: analysis.spreadsheet.totalRows },
                  { label: "A migrar", value: analysis.spreadsheet.migratableRows },
                  {
                    label: "Excluídos (Desativado)",
                    value: analysis.spreadsheet.excludedDesativado,
                  },
                  { label: "Elegíveis para fotos", value: analysis.photos.eligibleCount },
                  {
                    label: "Sem telefone proprietário",
                    value: analysis.spreadsheet.proprietariosSemTelefone,
                  },
                  { label: "Ano exportação", value: analysis.spreadsheet.exportYear },
                ]}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Por situação</p>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(analysis.spreadsheet.bySituacao).map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{k}</span>
                        <span className="font-medium">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Por tipo (a migrar)</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {Object.entries(analysis.spreadsheet.byTipo).map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{k}</span>
                        <span className="font-medium">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Fotos (Cloudinary)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatGrid
                items={[
                  { label: "Imóveis com foto", value: analysis.photos.eligibleCount },
                  { label: "Fotos estimadas", value: analysis.photos.totalPhotoCount },
                  { label: "Tamanho origem (est.)", value: analysis.photos.estimatedLabel },
                  {
                    label: "Destino",
                    value: "Cloudinary",
                  },
                ]}
              />
              <p className="text-sm text-muted-foreground">{analysis.storage.recommendation}</p>
              <p className="text-sm text-muted-foreground">
                Preset <code className="text-xs">deskimob_fotos_imovel</code> aplica redimensionamento
                e compressão automaticamente.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Resultado da importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatGrid
              items={[
                { label: "Importados", value: importResult.imported },
                { label: "Pulados (existentes)", value: importResult.skipped },
                { label: "Erros", value: importResult.errors },
                { label: "Excluídos (Desativado)", value: importResult.excludedDesativado },
                { label: "Clientes criados", value: importResult.clientesCreated },
                { label: "Clientes reutilizados", value: importResult.clientesReused },
                { label: "Fotos baixadas", value: importResult.photosDownloaded },
                { label: "Fotos com falha", value: importResult.photosFailed },
                { label: "Sem telefone", value: importResult.semTelefone.length },
              ]}
            />

            {importResult.semTelefone.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">Códigos sem telefone do proprietário</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.semTelefone.join(", ")}
                </p>
              </div>
            )}

            {importResult.results.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Detalhes</p>
                <div className="max-h-64 overflow-y-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Mensagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.results.map((r) => (
                        <tr key={r.codigo} className="border-t">
                          <td className="px-3 py-2 font-mono">{r.codigo}</td>
                          <td className="px-3 py-2">{r.status}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.message ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
