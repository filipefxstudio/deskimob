"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

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
import { TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import type { Corretor, FinalidadeImovel, TipoImovel } from "@/types";

import { useSite } from "./SiteProvider";

interface HeroLarImoveisProps {
  corretor: Corretor;
  bairros: string[];
}

export function HeroLarImoveis({ corretor, bairros }: HeroLarImoveisProps) {
  const router = useRouter();
  const { link, hasImoveisLocacao } = useSite();
  const [finalidade, setFinalidade] = useState<FinalidadeImovel>("venda");
  const [tipo, setTipo] = useState<TipoImovel | undefined>();
  const [bairro, setBairro] = useState<string | undefined>();
  const [codigo, setCodigo] = useState("");

  const heroImage = corretor.hero_image_url;
  const titulo =
    corretor.hero_titulo ?? `Encontre o imóvel ideal com ${corretor.nome}`;
  const subtitulo =
    corretor.hero_subtitulo ??
    "Apartamentos, casas e oportunidades para compra ou locação com atendimento personalizado.";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set("finalidade", finalidade);

    if (tipo) {
      params.set("tipos", tipo);
    }
    if (bairro) {
      params.set("bairros", bairro);
    }
    if (codigo.trim()) {
      params.set("codigo", codigo.trim());
    }

    router.push(`${link("/imoveis")}?${params.toString()}`);
  }

  return (
    <section className="relative flex min-h-[70vh] items-center lg:min-h-[80vh]">
      <div
        className="absolute inset-0 bg-primary"
        style={
          heroImage
            ? {
                backgroundImage: `url(${heroImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: `linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 70%, black) 100%)`,
              }
        }
      />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl text-white">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{titulo}</h1>
          <p className="mt-4 text-base leading-relaxed text-white/85 sm:text-lg">
            {subtitulo}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 max-w-4xl rounded-2xl bg-white p-5 shadow-xl sm:p-6"
        >
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setFinalidade("venda")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                finalidade === "venda"
                  ? "text-white"
                  : "bg-muted text-[#2D3748] hover:bg-muted/80"
              }`}
              style={
                finalidade === "venda" ? { backgroundColor: "var(--color-primary)" } : undefined
              }
            >
              Comprar
            </button>
            {hasImoveisLocacao ? (
              <button
                type="button"
                onClick={() => setFinalidade("locacao")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  finalidade === "locacao"
                    ? "text-white"
                    : "bg-muted text-[#2D3748] hover:bg-muted/80"
                }`}
                style={
                  finalidade === "locacao"
                    ? { backgroundColor: "var(--color-primary)" }
                    : undefined
                }
              >
                Alugar
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="hero-tipo">Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(value) => setTipo(value as TipoImovel)}
              >
                <SelectTrigger id="hero-tipo">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_IMOVEL.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-bairro">Localidade</Label>
              {bairros.length > 0 ? (
                <Select value={bairro} onValueChange={setBairro}>
                  <SelectTrigger id="hero-bairro">
                    <SelectValue placeholder="Qualquer bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    {bairros.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="hero-bairro"
                  value={bairro ?? ""}
                  onChange={(event) => setBairro(event.target.value || undefined)}
                  placeholder="Digite o bairro"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-codigo">Código</Label>
              <Input
                id="hero-codigo"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                placeholder="Ex: AP101"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: "var(--color-secondary)" }}
              >
                <Search className="size-4" />
                Buscar
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
