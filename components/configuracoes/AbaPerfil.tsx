"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";

import {
  changePassword,
  savePerfilCorretor,
  uploadFotoPerfil,
  uploadLogoCrm,
} from "@/lib/actions/corretor-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import type { Corretor } from "@/types";

interface AbaPerfilProps {
  corretor: Corretor;
  isAccountOwner: boolean;
  nome: string;
  email: string;
  telefone: string | null;
  fotoUrl: string | null;
}

export function AbaPerfil({
  corretor,
  isAccountOwner,
  nome: initialNome,
  email,
  telefone: initialTelefone,
  fotoUrl: initialFotoUrl,
}: AbaPerfilProps) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const logoCrmInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(initialNome);
  const [telefone, setTelefone] = useState(
    initialTelefone ? formatTelefoneBr(initialTelefone) : "",
  );
  const [fotoUrl, setFotoUrl] = useState(initialFotoUrl ?? "");
  const [logoCrmUrl, setLogoCrmUrl] = useState(corretor.logo_crm_url ?? "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [senhaFeedback, setSenhaFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await savePerfilCorretor({ nome, telefone });
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback(result.message ?? "Perfil salvo.");
    });
  }

  function handleFotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("foto", file);

    startTransition(async () => {
      const result = await uploadFotoPerfil(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) setFotoUrl(result.url);
      setFeedback(result.message ?? "Foto atualizada.");
    });
  }

  function handleLogoCrmUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("logo", file);

    startTransition(async () => {
      const result = await uploadLogoCrm(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) setLogoCrmUrl(result.url);
      setFeedback(result.message ?? "Logo do CRM enviada.");
    });
  }

  function handleSenhaSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSenhaFeedback(null);
    setSenhaError(null);

    startTransition(async () => {
      const result = await changePassword({
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      });
      if (result.error) {
        setSenhaError(result.error);
        return;
      }
      setSenhaFeedback(result.message ?? "Senha alterada.");
      setNovaSenha("");
      setConfirmarSenha("");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meu perfil</CardTitle>
          <CardDescription>
            Dados pessoais exibidos no CRM. A logo do CRM aparece no painel — não confunda com a logo do site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap items-start gap-6">
              <div className="space-y-2">
                <Label>Foto de perfil</Label>
                <div className="flex items-center gap-3">
                  {fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoUrl} alt="Perfil" className="size-16 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-primary">
                      {nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFotoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => fotoInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    Enviar foto
                  </Button>
                </div>
              </div>

              {isAccountOwner ? (
                <div className="space-y-2">
                  <Label>Logo do CRM</Label>
                  <p className="text-xs text-muted-foreground">Exibida no cabeçalho do painel.</p>
                  <div className="flex items-center gap-3">
                    {logoCrmUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoCrmUrl} alt="Logo CRM" className="max-h-10 max-w-[120px] object-contain" />
                    ) : (
                      <div className="flex h-10 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                        Sem logo
                      </div>
                    )}
                    <input
                      ref={logoCrmInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoCrmUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => logoCrmInputRef.current?.click()}
                    >
                      Enviar logo CRM
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" value={email} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <TelefoneInput
                  id="telefone"
                  value={telefone}
                  onChange={setTelefone}
                />
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {feedback ? (
              <p className="text-sm text-secondary" role="status">
                {feedback}
              </p>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar perfil
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senha e segurança</CardTitle>
          <CardDescription>Altere sua senha de acesso ao CRM.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSenhaSubmit} className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {senhaError ? <p className="text-sm text-destructive">{senhaError}</p> : null}
            {senhaFeedback ? <p className="text-sm text-secondary">{senhaFeedback}</p> : null}
            <Button type="submit" variant="outline" disabled={isPending}>
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
