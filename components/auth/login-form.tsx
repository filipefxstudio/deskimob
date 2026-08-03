"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { PasswordInput } from "@/components/auth/password-input";
import { loginAction, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REMEMBER_EMAIL_KEY = "deskimob_remember_email";
const REMEMBER_ME_KEY = "deskimob_remember_me";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    try {
      const savedRemember = localStorage.getItem(REMEMBER_ME_KEY);
      const shouldRemember = savedRemember !== "false";
      setRemember(shouldRemember);

      if (shouldRemember) {
        const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
        }
      }
    } catch {
      // localStorage indisponível
    }
  }, []);

  function handleSubmit(formData: FormData) {
    const submittedEmail = String(formData.get("email") ?? "").trim();
    const submittedRemember = formData.get("remember") === "on";

    try {
      localStorage.setItem(REMEMBER_ME_KEY, submittedRemember ? "true" : "false");
      if (submittedRemember && submittedEmail) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, submittedEmail);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      // ignore
    }

    formAction(formData);
  }

  return (
    <Card className="w-full max-w-md border-border/80 shadow-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-primary">Entrar</CardTitle>
        <CardDescription>Acesse seu painel Deskimob</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <span>Lembrar-me</span>
            </label>
            {remember ? <input type="hidden" name="remember" value="on" /> : null}
            <Link
              href="/login/esqueci-senha"
              className="text-sm font-medium text-secondary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full" loading={isPending} loadingText="Entrando...">
            Entrar
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-secondary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
