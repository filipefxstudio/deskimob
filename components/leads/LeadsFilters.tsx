"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import {
  ImovelInteresseAutocomplete,
  type ImovelSearchResult,
} from "@/components/atendimentos/ImovelInteresseAutocomplete";
import { BairrosInteresseInput } from "@/components/atendimentos/BairrosInteresseInput";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SITUACAO_LEAD_LABELS } from "@/lib/constants/atendimentos";
import {
  ETAPA_LEAD_LABELS,
  ETAPAS_LEAD,
  FINALIDADE_BUSCA_OPTIONS,
  TEMPERATURA_LEAD_LABELS,
} from "@/lib/constants/leads";
import {
  countActiveLeadsFilters,
  defaultLeadsFilters,
  hasActiveInteresseFilters,
  type LeadsFilterState,
  type LeadsInteresseFilterState,
} from "@/lib/leads/filters";
import { cn } from "@/lib/utils";
import type { SituacaoLead, TemperaturaLead, TipoImovelCustom } from "@/types";

export type { LeadsFilterState, LeadsInteresseFilterState };
export { countActiveLeadsFilters, defaultLeadsFilters };

interface LeadsFiltersProps {
  filters: LeadsFilterState;
  onChange: (filters: LeadsFilterState) => void;
  onClear?: () => void;
  midias: { id: string; nome: string; ativo: boolean }[];
  perfis: { id: string; nome: string }[];
  diasAlertaDefault: number;
  tiposImovel?: TipoImovelCustom[];
}

const SITUACOES: SituacaoLead[] = ["em_atendimento", "descartado", "negocio_fechado"];

export function LeadsFilters({
  filters,
  onChange,
  onClear,
  midias,
  perfis,
  diasAlertaDefault,
  tiposImovel = [],
}: LeadsFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(() => hasActiveInteresseFilters(filters.interesse));

  const tiposAtivos = useMemo(
    () => tiposImovel.filter((tipo) => tipo.ativo),
    [tiposImovel],
  );

  const [imovelInteresse, setImovelInteresse] = useState<ImovelSearchResult | null>(null);

  function patch(partial: Partial<LeadsFilterState>) {
    onChange({ ...filters, ...partial });
  }

  function patchInteresse(partial: Partial<LeadsInteresseFilterState>) {
    onChange({
      ...filters,
      interesse: { ...filters.interesse, ...partial },
    });
  }

  function handleImovelChange(imovel: ImovelSearchResult | null) {
    setImovelInteresse(imovel);
    patchInteresse({ imovelId: imovel?.id ?? null });
  }

  function handleClear() {
    setImovelInteresse(null);
    setAdvancedOpen(false);
    onChange({ ...defaultLeadsFilters });
    onClear?.();
  }

  const hasActiveFilters = countActiveLeadsFilters(filters) > 0;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {hasActiveFilters ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            <X className="size-4" data-icon="inline-start" />
            Limpar filtros
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Situação</Label>
          <Select
            value={filters.situacao}
            onValueChange={(value) =>
              patch({ situacao: value as LeadsFilterState["situacao"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Ativos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ativos (padrão)</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
              {SITUACOES.map((situacao) => (
                <SelectItem key={situacao} value={situacao}>
                  {SITUACAO_LEAD_LABELS[situacao]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Temperatura</Label>
          <Select
            value={filters.temperatura}
            onValueChange={(value) =>
              patch({ temperatura: value as LeadsFilterState["temperatura"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(Object.keys(TEMPERATURA_LEAD_LABELS) as TemperaturaLead[]).map((temp) => (
                <SelectItem key={temp} value={temp}>
                  {TEMPERATURA_LEAD_LABELS[temp]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Etapa</Label>
          <Select
            value={filters.etapa}
            onValueChange={(value) =>
              patch({ etapa: value as LeadsFilterState["etapa"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ETAPAS_LEAD.map((etapa) => (
                <SelectItem key={etapa} value={etapa}>
                  {ETAPA_LEAD_LABELS[etapa]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Mídia de origem</Label>
          <Select
            value={filters.origem}
            onValueChange={(value) => patch({ origem: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {midias
                .filter((m) => m.ativo)
                .map((midia) => (
                  <SelectItem key={midia.id} value={midia.nome}>
                    {midia.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Finalidade</Label>
          <Select
            value={filters.finalidade}
            onValueChange={(value) =>
              patch({ finalidade: value as LeadsFilterState["finalidade"] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {FINALIDADE_BUSCA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {perfis.length > 0 ? (
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={filters.perfilId}
              onValueChange={(value) => patch({ perfilId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {perfis.map((perfil) => (
                  <SelectItem key={perfil.id} value={perfil.id}>
                    {perfil.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Sem interação há</Label>
          <Select
            value={filters.semInteracaoDias?.toString() ?? "none"}
            onValueChange={(value) =>
              patch({
                semInteracaoDias: value === "none" ? null : Number(value),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Qualquer período</SelectItem>
              <SelectItem value={String(diasAlertaDefault)}>
                +{diasAlertaDefault} dias (alerta)
              </SelectItem>
              <SelectItem value="3">+3 dias</SelectItem>
              <SelectItem value="7">+7 dias</SelectItem>
              <SelectItem value="14">+14 dias</SelectItem>
              <SelectItem value="30">+30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end pb-2">
          <div className="flex items-center gap-2">
            <Switch
              id="apenas-qualificados"
              checked={filters.apenasQualificados}
              onCheckedChange={(checked) => patch({ apenasQualificados: checked })}
            />
            <Label htmlFor="apenas-qualificados">Apenas qualificados</Label>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium text-primary"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <span>Filtros avançados — Interesse</span>
          <ChevronDown
            className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
          />
        </button>

        {advancedOpen ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Imóvel de interesse</Label>
              <ImovelInteresseAutocomplete
                value={imovelInteresse}
                onChange={handleImovelChange}
                placeholder="Filtrar por imóvel vinculado"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de imóvel</Label>
              <Select
                value={filters.interesse.tipoImovel || "__none__"}
                onValueChange={(value) =>
                  patchInteresse({ tipoImovel: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Qualquer</SelectItem>
                  {tiposAtivos.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.nome.toLowerCase()}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Bairros</Label>
              <BairrosInteresseInput
                value={filters.interesse.bairros}
                onChange={(bairros) => patchInteresse({ bairros })}
              />
            </div>

            <div className="space-y-2">
              <Label>Quartos mín.</Label>
              <Input
                type="number"
                min={0}
                value={filters.interesse.quartosMin ?? ""}
                onChange={(e) =>
                  patchInteresse({
                    quartosMin: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Suítes mín.</Label>
              <Input
                type="number"
                min={0}
                value={filters.interesse.suitesMin ?? ""}
                onChange={(e) =>
                  patchInteresse({
                    suitesMin: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Banheiros mín.</Label>
              <Input
                type="number"
                min={0}
                value={filters.interesse.banheirosMin ?? ""}
                onChange={(e) =>
                  patchInteresse({
                    banheirosMin: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Vagas mín.</Label>
              <Input
                type="number"
                min={0}
                value={filters.interesse.vagasMin ?? ""}
                onChange={(e) =>
                  patchInteresse({
                    vagasMin: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Valor mín.</Label>
              <CurrencyInput
                value={filters.interesse.valorMin}
                onChange={(valorMin) => patchInteresse({ valorMin })}
                mode="filter"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor máx.</Label>
              <CurrencyInput
                value={filters.interesse.valorMax}
                onChange={(valorMax) => patchInteresse({ valorMax })}
                mode="filter"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Prazo decisão</Label>
              <Input
                value={filters.interesse.prazoDecisao}
                onChange={(e) => patchInteresse({ prazoDecisao: e.target.value })}
                placeholder="Ex.: imediato, 30 dias..."
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
