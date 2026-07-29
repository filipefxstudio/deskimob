"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { CepInput, type CepAddressData } from "@/components/imoveis/CepInput";
import { Button } from "@/components/ui/button";
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
import { TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { toast } from "@/hooks/use-toast";
import type { TipoImovel } from "@/types";

import { useSite } from "./SiteProvider";

export function FormularioAvaliarImovel() {
  const { corretor } = useSite();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState<TipoImovel | undefined>();
  const [area, setArea] = useState("");
  const [areaTerreno, setAreaTerreno] = useState("");
  const [quartos, setQuartos] = useState("");
  const [banheiros, setBanheiros] = useState("");
  const [vagas, setVagas] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddressFound = useCallback((address: CepAddressData) => {
    setLogradouro(address.logradouro);
    setBairro(address.bairro);
    setCidade(address.cidade);
    setEstado(address.estado);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);

    const imovelInfo = [
      "Solicitação de avaliação de imóvel",
      cep ? `CEP: ${cep}` : null,
      logradouro ? `Endereço: ${logradouro}${numero ? `, ${numero}` : ""}${complemento ? ` - ${complemento}` : ""}` : null,
      bairro ? `Bairro: ${bairro}` : null,
      cidade || estado ? `Cidade/UF: ${[cidade, estado].filter(Boolean).join(" - ")}` : null,
      tipo ? `Tipo: ${TIPOS_IMOVEL.find((item) => item.value === tipo)?.label ?? tipo}` : null,
      area ? `Área útil: ${area} m²` : null,
      areaTerreno ? `Área do terreno: ${areaTerreno} m²` : null,
      quartos ? `Quartos: ${quartos}` : null,
      banheiros ? `Banheiros: ${banheiros}` : null,
      vagas ? `Vagas: ${vagas}` : null,
      observacoes.trim() ? `Detalhes: ${observacoes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch("/api/site/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": corretor.slug,
        },
        body: JSON.stringify({
          corretor_id: corretor.id,
          tenant_slug: corretor.slug,
          nome,
          telefone,
          email,
          observacoes: imovelInfo,
          origem: "site",
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.error ?? "Não foi possível enviar sua solicitação.",
        });
        return;
      }

      const message =
        data.message ?? "Solicitação enviada! Entraremos em contato em breve.";
      setSuccessMessage(message);
      toast({ title: "Enviado!", description: message });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha na conexão. Tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center text-green-800">
        <p className="text-lg font-semibold">Solicitação enviada!</p>
        <p className="mt-2 text-sm">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="avaliar-nome">Nome *</Label>
          <Input
            id="avaliar-nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="avaliar-telefone">Telefone *</Label>
          <TelefoneInput
            id="avaliar-telefone"
            value={telefone}
            onChange={setTelefone}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avaliar-email">E-mail</Label>
        <Input
          id="avaliar-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Dados do imóvel</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="avaliar-cep">CEP</Label>
            <CepInput
              id="avaliar-cep"
              value={cep}
              onChange={setCep}
              onAddressFound={handleAddressFound}
              showLabel={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(value) => setTipo(value as TipoImovel)}>
              <SelectTrigger id="avaliar-tipo">
                <SelectValue placeholder="Selecione" />
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="avaliar-logradouro">Logradouro</Label>
            <Input
              id="avaliar-logradouro"
              value={logradouro}
              onChange={(event) => setLogradouro(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-numero">Número</Label>
            <Input
              id="avaliar-numero"
              value={numero}
              onChange={(event) => setNumero(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-complemento">Complemento</Label>
            <Input
              id="avaliar-complemento"
              value={complemento}
              onChange={(event) => setComplemento(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-bairro">Bairro</Label>
            <Input
              id="avaliar-bairro"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-cidade">Cidade</Label>
            <Input
              id="avaliar-cidade"
              value={cidade}
              onChange={(event) => setCidade(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-estado">Estado</Label>
            <Input
              id="avaliar-estado"
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              maxLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-area">Área útil (m²)</Label>
            <Input
              id="avaliar-area"
              inputMode="numeric"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-area-terreno">Área do terreno (m²)</Label>
            <Input
              id="avaliar-area-terreno"
              inputMode="numeric"
              value={areaTerreno}
              onChange={(event) => setAreaTerreno(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-quartos">Quartos</Label>
            <Input
              id="avaliar-quartos"
              inputMode="numeric"
              value={quartos}
              onChange={(event) => setQuartos(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-banheiros">Banheiros</Label>
            <Input
              id="avaliar-banheiros"
              inputMode="numeric"
              value={banheiros}
              onChange={(event) => setBanheiros(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avaliar-vagas">Vagas</Label>
            <Input
              id="avaliar-vagas"
              inputMode="numeric"
              value={vagas}
              onChange={(event) => setVagas(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avaliar-observacoes">Informações adicionais</Label>
        <Textarea
          id="avaliar-observacoes"
          value={observacoes}
          onChange={(event) => setObservacoes(event.target.value)}
          rows={4}
          placeholder="Conte mais sobre o imóvel, estado de conservação, etc."
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-secondary)" }}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Solicitar avaliação
      </Button>
    </form>
  );
}
