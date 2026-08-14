"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import {
  Check,
  MapPin,
  Phone,
} from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import { ImovelStats } from "@/components/imoveis/ImovelStats";

import { ImovelAuditoriaTab } from "@/components/imoveis/ImovelAuditoriaTab";
import { ImovelAcoesDropdown } from "@/components/imoveis/ImovelAcoesDropdown";
import { ImovelDesempenhoTab } from "@/components/imoveis/ImovelDesempenhoTab";
import { ImovelDetalheToolbar } from "@/components/imoveis/ImovelDetalheToolbar";
import { ImovelGaleriaDetalhes } from "@/components/imoveis/ImovelGaleriaDetalhes";
import { ImovelRepublicacaoAlerta } from "@/components/imoveis/ImovelRepublicacaoAlerta";
import { StatusBadge } from "@/components/imoveis/StatusBadge";
import { ImovelMapa } from "@/components/site/ImovelMapa";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeferredTabPanel } from "@/components/ui/deferred-tab-panel";
import { TabPanelSkeleton } from "@/components/ui/page-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstantTabs } from "@/hooks/use-instant-tabs";
import { toast } from "@/hooks/use-toast";
import { aprovarImovel, reprovarImovel } from "@/lib/actions/imoveis";
import { getLocalChavesLabel } from "@/lib/constants/imoveis";
import { podeAprovarImovel } from "@/lib/imoveis/aprovacao";
import {
  getCaptadorNome,
  getCaptadorPrincipalNome,
  getCaptadoresLista,
} from "@/lib/imoveis/captador";
import { getImovelCodigo, formatEnderecoCompleto } from "@/lib/imoveis/format";
import { buildTelLinkLocal, buildWhatsAppLink, formatTelefoneBr } from "@/lib/imoveis/telefone";
import {
  formatCurrency,
  getFinalidadeLabel,
  getTipoLabel,
  getValorExibicao,
} from "@/lib/site/format";
import { cn } from "@/lib/utils";
import type { AlertaRepublicacaoImovel } from "@/lib/imoveis/republicacao-alerta";
import type { AuditoriaImovel, Imovel, ImovelDesempenho, Perfil, StatusImovel } from "@/types";

interface ImovelDetalhesProps {
  imovel: Imovel;
  corretorSlug: string;
  shareUrl?: string | null;
  statusList: StatusImovel[];
  auditoria: AuditoriaImovel[];
  desempenho: ImovelDesempenho | null;
  perfil?: Perfil | null;
  alertaRepublicacao?: AlertaRepublicacaoImovel | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

function formatValorSecundario(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "R$ —";
  }

  return formatCurrency(value);
}

const INFO_ADICIONAL_FIELDS: {
  key: keyof Imovel;
  label: string;
}[] = [
  { key: "aceita_financiamento", label: "Aceita financiamento" },
  { key: "aceita_permuta", label: "Aceita permuta" },
  { key: "exclusividade", label: "Exclusividade" },
  { key: "imovel_na_planta", label: "Imóvel na planta" },
  { key: "imovel_ocupado", label: "Imóvel ocupado" },
  { key: "contrato_aluguel_ativo", label: "Contrato de aluguel ativo" },
];

export function ImovelDetalhes({
  imovel: initialImovel,
  corretorSlug,
  shareUrl = null,
  statusList,
  auditoria,
  desempenho,
  perfil = null,
  alertaRepublicacao = null,
}: ImovelDetalhesProps) {
  const router = useRouter();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [imovel, setImovel] = useState(initialImovel);
  const { selectedTab, displayTab, selectTab, isContentPending } = useInstantTabs<
    "detalhes" | "desempenho" | "auditoria"
  >("detalhes");
  const imovelTabSkeleton = <TabPanelSkeleton rows={6} />;

  useLayoutEffect(() => {
    const element = toolbarRef.current;
    if (!element) {
      return;
    }

    function updateHeight() {
      if (toolbarRef.current) {
        setToolbarHeight(toolbarRef.current.offsetHeight);
      }
    }

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const canApprove =
    podeAprovarImovel(perfil) && imovel.status_aprovacao === "aguardando_aprovacao";

  const titulo = imovel.titulo ?? "Sem título";
  const codigo = getImovelCodigo(imovel);
  const endereco = formatEnderecoCompleto(imovel);
  const fotos = imovel.fotos ?? [];
  const diferenciais = imovel.diferenciais ?? [];
  const hasMap = imovel.latitude != null && imovel.longitude != null;
  const cliente = imovel.cliente;
  const captadores = getCaptadoresLista(imovel);
  const captadorNome = getCaptadorPrincipalNome(imovel);
  const cadastradoPor = imovel.cadastrado_por;
  const telLink = buildTelLinkLocal(cliente?.telefone);
  const waLink = buildWhatsAppLink(cliente?.telefone);
  const aguardandoAprovacao = imovel.status_aprovacao === "aguardando_aprovacao";

  const infoAdicional = INFO_ADICIONAL_FIELDS.filter(
    (field) => imovel[field.key] === true,
  );

  function handleAprovar() {
    startTransition(async () => {
      const result = await aprovarImovel(imovel.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      toast({ title: "Imóvel aprovado." });
      setImovel((prev) => ({
        ...prev,
        status_aprovacao: "aprovado",
        status: "disponivel",
        status_imovel: statusList.find((item) => item.nome === "Disponível") ?? prev.status_imovel,
      }));
      router.refresh();
    });
  }

  function handleReprovar() {
    startTransition(async () => {
      const result = await reprovarImovel(imovel.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      toast({ title: "Imóvel reprovado. Retornou para cadastro." });
      setImovel((prev) => ({
        ...prev,
        status_aprovacao: "em_cadastro",
        status: "em_cadastro",
        status_imovel: statusList.find((item) => item.nome === "Em cadastro") ?? prev.status_imovel,
      }));
      router.refresh();
    });
  }

  const acoesToolbar = (
    <>
      {canApprove ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleReprovar}
          >
            Reprovar
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={handleAprovar}>
            Aprovar
          </Button>
        </>
      ) : null}

      <ImovelAcoesDropdown
        imovel={imovel}
        corretorSlug={corretorSlug}
        statusList={statusList}
        perfil={perfil}
        variant="header"
        onValidarAtualizacao={(data) =>
          setImovel((prev) => ({ ...prev, data_ultima_atualizacao: data }))
        }
        onStatusChange={(statusId) => {
          const status = statusList.find((item) => item.id === statusId);
          setImovel((prev) => ({
            ...prev,
            status_imovel_id: statusId,
            status_imovel: status ?? prev.status_imovel,
          }));
        }}
        onAprovar={() =>
          setImovel((prev) => ({
            ...prev,
            status_aprovacao: "aprovado",
            status: "disponivel",
            status_imovel: statusList.find((item) => item.nome === "Disponível") ?? prev.status_imovel,
          }))
        }
        onReprovar={() =>
          setImovel((prev) => ({
            ...prev,
            status_aprovacao: "em_cadastro",
            status: "em_cadastro",
            status_imovel: statusList.find((item) => item.nome === "Em cadastro") ?? prev.status_imovel,
          }))
        }
      />
    </>
  );

  return (
    <div className="flex flex-col">
      <ImovelGaleriaDetalhes
        fotos={fotos}
        titulo={titulo}
        videoUrl={imovel.video_url}
        mapa={
          imovel.latitude && imovel.longitude
            ? {
                latitude: imovel.latitude,
                longitude: imovel.longitude,
                endereco,
              }
            : null
        }
      />

      <div
        className="space-y-6 p-4 md:p-6"
        style={
          toolbarHeight > 0
            ? ({ "--imovel-toolbar-height": `${toolbarHeight}px` } as CSSProperties)
            : undefined
        }
      >
        <ImovelDetalheToolbar
          codigo={codigo}
          actions={acoesToolbar}
          toolbarRef={toolbarRef}
        />

        {aguardandoAprovacao && alertaRepublicacao ? (
          <ImovelRepublicacaoAlerta alerta={alertaRepublicacao} />
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={imovel.status} statusImovel={imovel.status_imovel} />
                    <span className="text-sm text-muted-foreground">
                      {getTipoLabel(imovel.tipo)}
                    </span>
                  </div>
                  <p className="shrink-0 text-lg font-medium text-muted-foreground">{codigo}</p>
                </div>

                <h2 className="text-xl font-semibold text-primary md:text-2xl">{titulo}</h2>

                <ImovelStats
                  imovel={imovel}
                  variant="detail-prominent"
                  showAreaTotal
                  iconClassName="text-primary"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Valores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {getFinalidadeLabel(imovel.finalidade)}
                    </p>
                    <p className="text-3xl font-black tracking-tight text-primary md:text-4xl">
                      {getValorExibicao(imovel)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Condomínio</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatValorSecundario(imovel.valor_condominio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">IPTU</p>
                      <p className="text-lg font-semibold text-foreground">
                        {formatValorSecundario(imovel.valor_iptu)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="flex min-w-0 flex-1 flex-col">
            <CardHeader className="pb-3">
              <CardTitle>Localização</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex shrink-0 items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>{endereco || "Endereço não informado"}</p>
              </div>
              {hasMap ? (
                <div className="min-h-[200px] flex-1 lg:min-h-0">
                  <ImovelMapa
                    fill
                    latitude={imovel.latitude as number}
                    longitude={imovel.longitude as number}
                    endereco={endereco}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Mapa indisponível para este imóvel.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {shareUrl ? (
          <p className="text-xs text-muted-foreground break-all">
            Link de compartilhamento: {shareUrl}
          </p>
        ) : null}

        <Tabs
          value={selectedTab}
          onValueChange={(value) =>
            selectTab(value as "detalhes" | "desempenho" | "auditoria")
          }
        >
          <TabsList
            className={cn(
              "sticky top-[var(--imovel-toolbar-height,4.5rem)] z-20 -mx-4 h-auto w-auto justify-start overflow-x-auto rounded-none border-b border-border/80 bg-background/95 p-0 px-4 backdrop-blur md:-mx-6 md:px-6",
            )}
          >
            <TabsTrigger
              value="detalhes"
              className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Detalhes
            </TabsTrigger>
            <TabsTrigger
              value="desempenho"
              className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Desempenho
            </TabsTrigger>
            <TabsTrigger
              value="auditoria"
              className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-6 pt-4">
            <DeferredTabPanel
              tabId="detalhes"
              selectedTab={selectedTab}
              displayTab={displayTab}
              isContentPending={isContentPending}
              skeleton={imovelTabSkeleton}
            >
            {imovel.descricao ? (
              <Card>
                <CardHeader>
                  <CardTitle>Sobre o imóvel</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {imovel.descricao}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                    <dt className="text-muted-foreground">Código</dt>
                    <dd className="font-medium">{codigo}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                    <dt className="text-muted-foreground">Finalidade</dt>
                    <dd className="font-medium">{getFinalidadeLabel(imovel.finalidade)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                    <dt className="text-muted-foreground">Tipo</dt>
                    <dd className="font-medium">{getTipoLabel(imovel.tipo)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">
                      {imovel.status_imovel?.nome ?? imovel.status}
                    </dd>
                  </div>
                  {imovel.comissao_percent != null ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                      <dt className="text-muted-foreground">Comissão</dt>
                      <dd className="font-medium">{imovel.comissao_percent}%</dd>
                    </div>
                  ) : null}
                  {imovel.local_chaves ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                      <dt className="text-muted-foreground">Local das chaves</dt>
                      <dd className="font-medium">{getLocalChavesLabel(imovel.local_chaves)}</dd>
                    </div>
                  ) : null}
                  {imovel.local_chaves === "imobiliaria" && imovel.chaves_codigo ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2 sm:block">
                      <dt className="text-muted-foreground">Código/número da chave</dt>
                      <dd className="font-medium">{imovel.chaves_codigo}</dd>
                    </div>
                  ) : null}
                  {imovel.local_chaves === "outros" && imovel.chaves_descricao ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2 sm:col-span-2 sm:block">
                      <dt className="text-muted-foreground">Descrição do local</dt>
                      <dd className="font-medium whitespace-pre-wrap">{imovel.chaves_descricao}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            {diferenciais.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Características</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {diferenciais.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm">
                        <Check className="size-4 shrink-0 text-secondary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {infoAdicional.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Informações adicionais</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {infoAdicional.map((field) => (
                      <li key={field.key} className="flex items-center gap-2 text-sm">
                        <Check className="size-4 shrink-0 text-secondary" />
                        {field.label}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Proprietário</CardTitle>
                </CardHeader>
                <CardContent>
                  {cliente ? (
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium">{cliente.nome}</p>
                        {cliente.telefone ? (
                          <p className="text-sm text-muted-foreground">
                            {formatTelefoneBr(cliente.telefone)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {telLink ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={telLink}>
                              <Phone data-icon="inline-start" />
                              Ligar
                            </a>
                          </Button>
                        ) : null}
                        {waLink ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={waLink} target="_blank" rel="noopener noreferrer">
                              <WhatsAppIcon data-icon="inline-start" className="size-4" />
                              WhatsApp
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Proprietário não cadastrado.{" "}
                      <Link
                        href={`/dashboard/imoveis/${imovel.id}/editar`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Cadastrar na edição
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {captadores.length > 1 ? "Captadores" : "Captador"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {captadores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Captador não informado.</p>
                  ) : captadores.length === 1 ? (
                    <div>
                      <p className="font-medium">{getCaptadorNome(captadores[0])}</p>
                      {captadores[0].nome_externo ? null : captadores[0].perfil?.email ? (
                        <p className="text-sm text-muted-foreground">{captadores[0].perfil.email}</p>
                      ) : null}
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {captadores.map((captador) => (
                        <li key={captador.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{getCaptadorNome(captador)}</p>
                            {captador.principal ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Principal
                              </span>
                            ) : null}
                          </div>
                          {!captador.nome_externo && captador.perfil?.email ? (
                            <p className="text-sm text-muted-foreground">{captador.perfil.email}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Publicação</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Site: {imovel.publicado_site ? "Sim" : "Não"} | Portais:{" "}
                  {imovel.publicado_portais ? "Sim" : "Não"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cadastrado por</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Captador</dt>
                    <dd className="font-medium">{captadorNome ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cadastrado por</dt>
                    <dd className="font-medium">{cadastradoPor?.nome ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cadastrado em</dt>
                    <dd className="font-medium">{formatDate(imovel.criado_em)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ativado em</dt>
                    <dd className="font-medium">{formatDate(imovel.data_ativacao)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Última atualização</dt>
                    <dd className="font-medium">{formatDate(imovel.data_ultima_atualizacao)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Desativado em</dt>
                    <dd className="font-medium">{formatDate(imovel.data_desativacao)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            </DeferredTabPanel>
          </TabsContent>

          <TabsContent value="desempenho" className="pt-4">
            <DeferredTabPanel
              tabId="desempenho"
              selectedTab={selectedTab}
              displayTab={displayTab}
              isContentPending={isContentPending}
              skeleton={imovelTabSkeleton}
            >
            {desempenho ? (
              <ImovelDesempenhoTab desempenho={desempenho} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar o desempenho deste imóvel.
              </p>
            )}
            </DeferredTabPanel>
          </TabsContent>

          <TabsContent value="auditoria" className="pt-4">
            <DeferredTabPanel
              tabId="auditoria"
              selectedTab={selectedTab}
              displayTab={displayTab}
              isContentPending={isContentPending}
              skeleton={imovelTabSkeleton}
            >
              <ImovelAuditoriaTab registros={auditoria} />
            </DeferredTabPanel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
