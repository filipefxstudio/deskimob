"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { BairrosInteresseInput } from "@/components/atendimentos/BairrosInteresseInput";
import {
  ImovelInteresseAutocomplete,
  type ImovelSearchResult,
} from "@/components/atendimentos/ImovelInteresseAutocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calcularFaixaValorImovel,
  createAtendimento,
} from "@/lib/actions/atendimentos";
import { FINALIDADE_BUSCA_OPTIONS } from "@/lib/constants/leads";
import type { NovoAtendimentoPrefill } from "@/lib/atendimentos/novo-prefill";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import { toast } from "@/hooks/use-toast";
import type { MidiaOrigem, TipoImovelCustom } from "@/types";

interface NovoAtendimentoFormProps {
  midias: MidiaOrigem[];
  perfis: { id: string; nome: string }[];
  perfilAtualId?: string | null;
  tiposImovel: TipoImovelCustom[];
  faixaValorPercent: number;
  prefill?: NovoAtendimentoPrefill;
}

export function NovoAtendimentoForm({
  midias,
  perfis,
  perfilAtualId = null,
  tiposImovel,
  faixaValorPercent,
  prefill,
}: NovoAtendimentoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState(prefill?.nome ?? "");
  const [telefone, setTelefone] = useState(
    prefill?.telefone ? formatTelefoneBr(prefill.telefone) : "",
  );
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [clienteId, setClienteId] = useState<string | undefined>(prefill?.clienteId);
  const [midiaNome, setMidiaNome] = useState("");
  const [perfilId, setPerfilId] = useState(perfilAtualId ?? "");
  const [observacoes, setObservacoes] = useState("");

  const [imovelSelecionado, setImovelSelecionado] = useState<ImovelSearchResult | null>(null);

  const [finalidade, setFinalidade] = useState("");
  const [tipoImovel, setTipoImovel] = useState("");
  const [bairros, setBairros] = useState<string[]>([]);
  const [quartos, setQuartos] = useState("");
  const [suites, setSuites] = useState("");
  const [banheiros, setBanheiros] = useState("");
  const [vagas, setVagas] = useState("");
  const [valorMin, setValorMin] = useState<number | null>(null);
  const [valorMax, setValorMax] = useState<number | null>(null);

  const tiposAtivos = useMemo(
    () => tiposImovel.filter((t) => t.ativo),
    [tiposImovel],
  );

  const midiasAtivas = useMemo(
    () => midias.filter((m) => m.ativo),
    [midias],
  );

  useEffect(() => {
    if (perfilId || !perfilAtualId) {
      return;
    }
    setPerfilId(perfilAtualId);
  }, [perfilAtualId, perfilId]);

  useEffect(() => {
    if (!imovelSelecionado) return;
    startTransition(async () => {
      const faixa = await calcularFaixaValorImovel(imovelSelecionado.id);
      if (faixa) {
        setValorMin(faixa.min);
        setValorMax(faixa.max);
      }
      if (imovelSelecionado.finalidade === "venda") {
        setFinalidade("compra");
      } else if (imovelSelecionado.finalidade === "locacao") {
        setFinalidade("locacao");
      }
      if (imovelSelecionado.tipo) setTipoImovel(imovelSelecionado.tipo);
      if (imovelSelecionado.bairro && !bairros.includes(imovelSelecionado.bairro)) {
        setBairros((prev) => [...prev, imovelSelecionado.bairro!]);
      }
    });
  }, [imovelSelecionado]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAtendimento({
        nome,
        telefone,
        email: email || undefined,
        cliente_id: clienteId,
        midia_nome: midiaNome || undefined,
        perfil_id: perfilId || undefined,
        imovel_id: imovelSelecionado?.id,
        finalidade_busca: finalidade || undefined,
        tipo_imovel_busca: tipoImovel || undefined,
        bairros_interesse: bairros.length ? bairros : undefined,
        quartos_minimo: quartos ? Number(quartos) : undefined,
        suites_minimas: suites ? Number(suites) : undefined,
        banheiros_minimos: banheiros ? Number(banheiros) : undefined,
        vagas_minimas: vagas ? Number(vagas) : undefined,
        valor_minimo: valorMin ?? undefined,
        valor_maximo: valorMax ?? undefined,
        observacoes: observacoes || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      toast({ title: result.message });
      if (result.id) {
        router.push(`/dashboard/atendimentos/${result.id}`);
      } else {
        router.push("/dashboard/atendimentos");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo atendimento</CardTitle>
        <p className="text-sm text-muted-foreground">
          Faixa de valor automática: ±{faixaValorPercent}% do imóvel de interesse. Temperatura padrão: Indefinido.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="font-semibold text-primary">Contato</h3>
            <div className="space-y-2">
              <Label htmlFor="contato-nome">Nome *</Label>
              <Input
                id="contato-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contato-telefone">Telefone *</Label>
                <TelefoneInput
                  id="contato-telefone"
                  value={telefone}
                  onChange={setTelefone}
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contato-email">E-mail</Label>
                <Input
                  id="contato-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Mídia de origem</Label>
                <Select value={midiaNome} onValueChange={setMidiaNome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {midiasAtivas.map((m) => (
                      <SelectItem key={m.id} value={m.nome}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {perfis.length > 0 ? (
                <div className="space-y-2">
                  <Label>Corretor responsável</Label>
                  <Select value={perfilId} onValueChange={setPerfilId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfis.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold text-primary">Imóvel de interesse</h3>
            <ImovelInteresseAutocomplete
              value={imovelSelecionado}
              onChange={setImovelSelecionado}
              disabled={isPending}
            />
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold text-primary">Preferências de busca</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Finalidade</Label>
                <Select value={finalidade} onValueChange={setFinalidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {FINALIDADE_BUSCA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de imóvel</Label>
                <Select value={tipoImovel} onValueChange={setTipoImovel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAtivos.map((t) => (
                      <SelectItem key={t.id} value={t.nome.toLowerCase()}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Bairros</Label>
                <BairrosInteresseInput
                  value={bairros}
                  onChange={setBairros}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>Quartos mín.</Label>
                <Input type="number" min={0} value={quartos} onChange={(e) => setQuartos(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Suítes mín.</Label>
                <Input type="number" min={0} value={suites} onChange={(e) => setSuites(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Banheiros mín.</Label>
                <Input type="number" min={0} value={banheiros} onChange={(e) => setBanheiros(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vagas mín.</Label>
                <Input type="number" min={0} value={vagas} onChange={(e) => setVagas(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Valor mínimo</Label>
                <CurrencyInput value={valorMin} onChange={setValorMin} mode="filter" />
              </div>
              <div className="space-y-2">
                <Label>Valor máximo</Label>
                <CurrencyInput value={valorMax} onChange={setValorMax} mode="filter" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </section>

          {error ? <p className="text-sm text-[#E63946]">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Criar atendimento"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/atendimentos">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
