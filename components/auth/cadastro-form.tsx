"use client";

import Link from "next/link";
import { useActionState } from "react";

import { cadastroAction, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatTelefoneInputElement, TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import { TELEFONE_PLACEHOLDER } from "@/lib/constants/input-placeholders";

const initialState: AuthActionState = {};

export function CadastroForm() {
  const [state, formAction, isPending] = useActionState(cadastroAction, initialState);

  return (
    <Card className="w-full max-w-md border-border/80 shadow-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-primary">Criar conta</CardTitle>
        <CardDescription>Comece a usar o Deskimob gratuitamente</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              autoComplete="name"
              placeholder="João Silva"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar senha</Label>
            <Input
              id="confirmarSenha"
              name="confirmarSenha"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a senha"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">
              Telefone <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="telefone"
              name="telefone"
              type="tel"
              autoComplete="tel"
              placeholder={TELEFONE_PLACEHOLDER}
              onInput={formatTelefoneInputElement}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="creci">
              CRECI <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="creci" name="creci" type="text" placeholder="123456-F" />
          </div>
          {state.success ? (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {state.success}
            </p>
          ) : null}
          {state.error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.errorDetails ? (
            <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {JSON.stringify(state.errorDetails, null, 2)}
            </pre>
          ) : null}
          <Button type="submit" className="h-10 w-full" loading={isPending} loadingText="Criando conta...">
            Criar conta
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-secondary hover:underline">
            Entrar
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
