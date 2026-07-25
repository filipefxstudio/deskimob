"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PasswordInput } from "@/components/auth/password-input";
import {
  updatePasswordFromRecoveryAction,
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
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function RedefinirSenhaForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordFromRecoveryAction,
    initialState,
  );

  return (
    <Card className="w-full max-w-md border-border/80 shadow-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-primary">Nova senha</CardTitle>
        <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.success ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {state.success}
            </p>
            <Button asChild className="h-10 w-full">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repita a senha"
                minLength={6}
                required
              />
            </div>
            {state.error ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" className="h-10 w-full" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </CardContent>
      {!state.success ? (
        <CardFooter className="justify-center">
          <Link href="/login/esqueci-senha" className="text-sm font-medium text-secondary hover:underline">
            Solicitar novo link
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}
