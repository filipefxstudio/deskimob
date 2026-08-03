"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestPasswordResetAction,
  type AuthActionState,
} from "@/lib/actions/auth";
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
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

type EsqueciSenhaFormProps = {
  initialError?: string;
};

export function EsqueciSenhaForm({ initialError }: EsqueciSenhaFormProps) {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);
  const errorMessage = state.error ?? initialError;

  return (
    <Card className="w-full max-w-md border-border/80 shadow-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-primary">Esqueci minha senha</CardTitle>
        <CardDescription>
          Informe seu e-mail e enviaremos um link para redefinir a senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.success ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {state.success}
            </p>
            <Button asChild className="h-10 w-full">
              <Link href="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
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
            {errorMessage ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" className="h-10 w-full" loading={isPending} loadingText="Enviando...">
              Enviar link
            </Button>
          </form>
        )}
      </CardContent>
      {!state.success ? (
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm font-medium text-secondary hover:underline">
            Voltar ao login
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}
