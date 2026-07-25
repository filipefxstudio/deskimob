"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnalyzeResponse, ImportSummary } from "@/lib/imoview/types";

function StorageBadge({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-300",
    yellow: "bg-amber-100 text-amber-800 border-amber-300",
    red: "bg-red-100 text-red-800 border-red-300",
  };
  const labels = { green: "Verde", yellow: "Amarelo", red: "Vermelho" };
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

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
  const [supabasePlan, setSupabasePlan] = useState<"free" | "pro">("free");
  const [limit, setLimit] = useState("10");
  const [storageConfirmed, setStorageConfirmed] = useState(false);
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
    fd.append("supabasePlan", supabasePlan);
    return fd;
  }, [file, exportYear, supabasePlan]);

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

    if (analysis?.storage.status === "yellow" && !storageConfirmed) {
      setError("Confirme o risco de Storage antes de importar.");
      return;
    }

    if (analysis?.storage.status === "red") {
      setError("Storage em vermelho — importação de planilha ainda permitida (sem fotos).");
    }

    setError(null);
    setImporting(true);

    try {
      const fd = buildFormData();
      fd.append("limit", limit);
      fd.append("skipPhotos", "true");

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
  }, [analysis, buildFormData, file, limit, storageConfirmed]);

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
              <Label htmlFor="supabase-plan">Plano Supabase</Label>
              <select
                id="supabase-plan"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={supabasePlan}
                onChange={(e) => setSupabasePlan(e.target.value as "free" | "pro")}
              >
                <option value="free">Free (1 GB)</option>
                <option value="pro">Pro (100 GB)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-limit">Limitar importação (teste)</Label>
              <Input
                id="import-limit"
                type="number"
                min={1}
                max={2190}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
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
              {importing ? "Importando…" : "Iniciar importação (sem fotos)"}
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
                  { label: "Total de imóveis", value: analysis.spreadsheet.totalRows },
                  { label: "Ano exportação", value: analysis.spreadsheet.exportYear },
                  {
                    label: "Sem telefone proprietário",
                    value: analysis.spreadsheet.proprietariosSemTelefone,
                  },
                  { label: "Elegíveis para fotos", value: analysis.photos.eligibleCount },
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
                  <p className="mb-2 text-sm font-medium">Por tipo</p>
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
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">3. Estimativa de Storage</CardTitle>
              <StorageBadge status={analysis.storage.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <StatGrid
                items={[
                  { label: "Fotos estimadas", value: analysis.photos.totalPhotoCount },
                  { label: "Tamanho estimado", value: analysis.photos.estimatedLabel },
                  {
                    label: "P90 por foto",
                    value: `${Math.round(analysis.photos.p90BytesPerPhoto / 1024)} KB`,
                  },
                  {
                    label: "Uso projetado",
                    value: `${analysis.storage.percentUsed}%`,
                  },
                ]}
              />
              <p className="text-sm text-muted-foreground">{analysis.storage.recommendation}</p>

              {analysis.storage.status === "yellow" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={storageConfirmed}
                    onCheckedChange={(v) => setStorageConfirmed(v === true)}
                  />
                  Entendo o risco de Storage e desejo continuar
                </label>
              )}

              {analysis.storage.status === "red" && (
                <p className="text-sm text-destructive">
                  Semáforo vermelho: fotos bloqueadas na Fase 3. Importação da planilha (sem fotos)
                  permanece disponível.
                </p>
              )}
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
                { label: "Clientes criados", value: importResult.clientesCreated },
                { label: "Clientes reutilizados", value: importResult.clientesReused },
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
