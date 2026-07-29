"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";

import {
  removeHero,
  saveContatoPage,
  saveHeroPage,
  saveIdentidadeVisual,
  saveSiteDominio,
  saveSobrePage,
  uploadFavicon,
  uploadHero,
  uploadLogo,
  uploadSobreFoto,
} from "@/lib/actions/site-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SITE_COR_PRIMARIA,
  DEFAULT_SITE_COR_SECUNDARIA,
} from "@/lib/constants/site";
import type { Corretor } from "@/types";

interface AbaSiteProps {
  corretor: Corretor;
}

function FeedbackMessage({ error, message }: { error: string | null; message: string | null }) {
  if (error) {
    return <p className="text-sm text-destructive" role="alert">{error}</p>;
  }
  if (message) {
    return <p className="text-sm text-secondary" role="status">{message}</p>;
  }
  return null;
}

function IdentidadeVisualTab({ corretor }: { corretor: Corretor }) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(corretor.logo_url ?? "");
  const [faviconUrl, setFaviconUrl] = useState(corretor.site_favicon_url ?? "");
  const [corPrimaria, setCorPrimaria] = useState(corretor.site_cor_primaria ?? DEFAULT_SITE_COR_PRIMARIA);
  const [corSecundaria, setCorSecundaria] = useState(corretor.site_cor_secundaria ?? DEFAULT_SITE_COR_SECUNDARIA);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setError(null);
    const formData = new FormData();
    formData.set("logo", file);
    startTransition(async () => {
      const result = await uploadLogo(formData);
      if (result.error) { setError(result.error); return; }
      if (result.url) setLogoUrl(result.url);
      setFeedback(result.message ?? "Logo enviada.");
    });
  }

  function handleFaviconUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setError(null);
    const formData = new FormData();
    formData.set("favicon", file);
    startTransition(async () => {
      const result = await uploadFavicon(formData);
      if (result.error) { setError(result.error); return; }
      if (result.url) setFaviconUrl(result.url);
      setFeedback(result.message ?? "Favicon enviado.");
    });
  }

  function handleSaveCores(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      const result = await saveIdentidadeVisual({
        site_cor_primaria: corPrimaria,
        site_cor_secundaria: corSecundaria,
      });
      if (result.error) { setError(result.error); return; }
      setFeedback(result.message ?? "Cores salvas.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Logo do site</Label>
        <p className="text-xs text-muted-foreground">
          A logo é salva automaticamente ao enviar a imagem.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo site" className="max-h-14 max-w-[160px] object-contain" />
          ) : (
            <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => logoInputRef.current?.click()}>
            Enviar logo
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Favicon</Label>
        <div className="flex flex-wrap items-center gap-4">
          {faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconUrl} alt="Favicon" className="size-8 object-contain" />
          ) : null}
          <input ref={faviconInputRef} type="file" accept="image/*" className="hidden" onChange={handleFaviconUpload} />
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => faviconInputRef.current?.click()}>
            Enviar favicon
          </Button>
        </div>
      </div>

      <form onSubmit={handleSaveCores} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { id: "cor-primaria", label: "Cor primária", value: corPrimaria, set: setCorPrimaria },
            { id: "cor-secundaria", label: "Cor secundária", value: corSecundaria, set: setCorSecundaria },
          ].map((item) => (
            <div key={item.id} className="space-y-2">
              <Label htmlFor={item.id}>{item.label}</Label>
              <div className="flex items-center gap-2">
                <input id={item.id} type="color" value={item.value} onChange={(e) => item.set(e.target.value)} className="size-10 cursor-pointer rounded border" />
                <Input value={item.value} onChange={(e) => item.set(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          ))}
        </div>
        <FeedbackMessage error={error} message={feedback} />
        <Button type="submit" disabled={isPending}>Salvar cores</Button>
      </form>
    </div>
  );
}

function PaginaInicialTab({ corretor }: { corretor: Corretor }) {
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [heroUrl, setHeroUrl] = useState(corretor.hero_image_url ?? "");
  const [titulo, setTitulo] = useState(corretor.hero_titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(corretor.hero_subtitulo ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("hero", file);
    startTransition(async () => {
      const result = await uploadHero(formData);
      if (result.error) { setError(result.error); return; }
      if (result.url) setHeroUrl(result.url);
      setFeedback(result.message ?? "Hero enviado.");
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeHero();
      if (result.error) { setError(result.error); return; }
      setHeroUrl("");
      setFeedback(result.message ?? "Hero removido.");
    });
  }

  function handleSaveTextos(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveHeroPage({ hero_titulo: titulo, hero_subtitulo: subtitulo });
      if (result.error) { setError(result.error); return; }
      setFeedback(result.message ?? "Página inicial salva.");
    });
  }

  return (
    <div className="space-y-6">
      {heroUrl ? (
        <div className="overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroUrl} alt="Hero" className="aspect-[21/9] w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[21/9] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma imagem de hero
        </div>
      )}
      <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => heroInputRef.current?.click()}>
          {heroUrl ? "Substituir imagem" : "Enviar imagem"}
        </Button>
        {heroUrl ? (
          <Button type="button" variant="destructive" disabled={isPending} onClick={handleRemove}>
            <Trash2 className="size-4" /> Remover
          </Button>
        ) : null}
      </div>

      <form onSubmit={handleSaveTextos} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hero-titulo">Título do hero</Label>
          <Input id="hero-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={`Encontre o imóvel ideal com ${corretor.nome}`} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hero-subtitulo">Subtítulo</Label>
          <Textarea id="hero-subtitulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} rows={3} />
        </div>
        <FeedbackMessage error={error} message={feedback} />
        <Button type="submit" disabled={isPending}>Salvar página inicial</Button>
      </form>
    </div>
  );
}

function SobreTab({ corretor }: { corretor: Corretor }) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState(corretor.site_sobre_titulo ?? corretor.sobre_titulo ?? "");
  const [texto, setTexto] = useState(corretor.site_sobre_texto ?? corretor.sobre_texto ?? corretor.sobre ?? "");
  const [fotoUrl, setFotoUrl] = useState(corretor.site_sobre_foto_url ?? corretor.sobre_foto_url ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("foto", file);
    startTransition(async () => {
      const result = await uploadSobreFoto(formData);
      if (result.error) { setError(result.error); return; }
      if (result.url) setFotoUrl(result.url);
      setFeedback(result.message ?? "Foto enviada.");
    });
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveSobrePage({ site_sobre_titulo: titulo, site_sobre_texto: texto });
      if (result.error) { setError(result.error); return; }
      setFeedback(result.message ?? "Página Sobre salva.");
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sobre-titulo">Título</Label>
        <Input id="sobre-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sobre-texto">Texto</Label>
        <Textarea id="sobre-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} />
      </div>
      <div className="space-y-2">
        <Label>Foto da página Sobre</Label>
        <div className="flex flex-wrap items-center gap-4">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="Sobre" className="size-24 rounded-lg object-cover" />
          ) : null}
          <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => fotoInputRef.current?.click()}>
            Enviar foto
          </Button>
        </div>
      </div>
      <FeedbackMessage error={error} message={feedback} />
      <Button type="submit" disabled={isPending}>Salvar página Sobre</Button>
    </form>
  );
}

function ContatoTab({ corretor }: { corretor: Corretor }) {
  const [nomeExibicao, setNomeExibicao] = useState(corretor.site_nome_exibicao ?? corretor.nome);
  const [creci, setCreci] = useState(corretor.site_creci ?? corretor.creci ?? "");
  const [telVendas, setTelVendas] = useState(corretor.site_telefone_vendas ?? corretor.contato_telefone ?? corretor.telefone ?? "");
  const [telLocacao, setTelLocacao] = useState(corretor.site_telefone_locacao ?? "");
  const [email, setEmail] = useState(corretor.site_email ?? corretor.contato_email ?? corretor.email ?? "");
  const [instagram, setInstagram] = useState(corretor.site_instagram ?? "");
  const [youtube, setYoutube] = useState(corretor.site_youtube ?? "");
  const [tiktok, setTiktok] = useState(corretor.site_tiktok ?? "");
  const [linkedin, setLinkedin] = useState(corretor.site_linkedin ?? "");
  const [facebook, setFacebook] = useState(corretor.site_facebook ?? "");
  const [horario, setHorario] = useState(corretor.site_horario ?? corretor.contato_horario ?? "");
  const [endereco, setEndereco] = useState(corretor.site_endereco ?? corretor.contato_endereco ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveContatoPage({
        site_nome_exibicao: nomeExibicao,
        site_creci: creci,
        site_telefone_vendas: telVendas,
        site_telefone_locacao: telLocacao,
        site_email: email,
        site_instagram: instagram,
        site_youtube: youtube,
        site_tiktok: tiktok,
        site_linkedin: linkedin,
        site_facebook: facebook,
        site_horario: horario,
        site_endereco: endereco,
      });
      if (result.error) { setError(result.error); return; }
      setFeedback(result.message ?? "Contato salvo.");
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="site-nome">Nome de exibição</Label>
          <Input id="site-nome" value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site-creci">CRECI</Label>
          <Input id="site-creci" value={creci} onChange={(e) => setCreci(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tel-vendas">Telefone vendas</Label>
          <Input id="tel-vendas" value={telVendas} onChange={(e) => setTelVendas(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tel-locacao">Telefone locação</Label>
          <Input id="tel-locacao" value={telLocacao} onChange={(e) => setTelLocacao(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="site-email">E-mail</Label>
          <Input id="site-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { id: "instagram", label: "Instagram", value: instagram, set: setInstagram },
          { id: "youtube", label: "YouTube", value: youtube, set: setYoutube },
          { id: "tiktok", label: "TikTok", value: tiktok, set: setTiktok },
          { id: "linkedin", label: "LinkedIn", value: linkedin, set: setLinkedin },
          { id: "facebook", label: "Facebook", value: facebook, set: setFacebook },
        ].map((item) => (
          <div key={item.id} className="space-y-2">
            <Label htmlFor={item.id}>{item.label}</Label>
            <Input id={item.id} value={item.value} onChange={(e) => item.set(e.target.value)} placeholder="@usuario ou URL" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="site-horario">Horário de atendimento</Label>
        <Input id="site-horario" value={horario} onChange={(e) => setHorario(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="site-endereco">Endereço</Label>
        <Textarea id="site-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={2} />
      </div>
      <FeedbackMessage error={error} message={feedback} />
      <Button type="submit" disabled={isPending}>Salvar página Contato</Button>
    </form>
  );
}

export function AbaSite({ corretor }: AbaSiteProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(corretor.slug);
  const [dominioCustom, setDominioCustom] = useState(corretor.dominio_custom ?? "");
  const [dominioFeedback, setDominioFeedback] = useState<string | null>(null);
  const [dominioError, setDominioError] = useState<string | null>(null);
  const [isDominioPending, startDominioTransition] = useTransition();
  const siteUrl = slug ? `/${slug}` : null;

  function handleDominioSubmit(event: React.FormEvent) {
    event.preventDefault();
    setDominioFeedback(null);
    setDominioError(null);
    startDominioTransition(async () => {
      const result = await saveSiteDominio({
        dominio_custom: dominioCustom,
        slug,
      });
      if (result.error) { setDominioError(result.error); return; }
      setDominioFeedback(result.message ?? "Domínio salvo.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meu site</CardTitle>
        <CardDescription>Personalize o site público de imóveis — separado da identidade do CRM.</CardDescription>
        {siteUrl ? (
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-secondary hover:underline">
            Ver site <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleDominioSubmit} className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="space-y-2">
            <Label htmlFor="slug">Slug do site</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="meu-nome"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Endereço do site: /{slug || "seu-slug"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dominio_custom">Domínio personalizado</Label>
            <Input id="dominio_custom" value={dominioCustom} onChange={(e) => setDominioCustom(e.target.value)} placeholder="www.seudominio.com.br (em breve)" />
          </div>
          <FeedbackMessage error={dominioError} message={dominioFeedback} />
          <Button type="submit" size="sm" variant="outline" disabled={isDominioPending}>Salvar domínio</Button>
        </form>

        <Tabs defaultValue="identidade" className="w-full">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="identidade">Identidade Visual</TabsTrigger>
            <TabsTrigger value="inicial">Página Inicial</TabsTrigger>
            <TabsTrigger value="sobre">Página Sobre</TabsTrigger>
            <TabsTrigger value="contato">Página Contato</TabsTrigger>
          </TabsList>
          <TabsContent value="identidade" className="mt-4"><IdentidadeVisualTab corretor={corretor} /></TabsContent>
          <TabsContent value="inicial" className="mt-4"><PaginaInicialTab corretor={corretor} /></TabsContent>
          <TabsContent value="sobre" className="mt-4"><SobreTab corretor={corretor} /></TabsContent>
          <TabsContent value="contato" className="mt-4"><ContatoTab corretor={corretor} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
