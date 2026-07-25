import type { Metadata } from "next";

import { EsqueciSenhaForm } from "@/components/auth/esqueci-senha-form";

export const metadata: Metadata = {
  title: "Esqueci minha senha | Deskimob",
  description: "Recupere o acesso à sua conta Deskimob",
};

type EsqueciSenhaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EsqueciSenhaPage({ searchParams }: EsqueciSenhaPageProps) {
  const query = await searchParams;
  const errorParam = query.error;
  const initialError =
    errorParam === "link_expirado"
      ? "Link inválido ou expirado. Solicite um novo e-mail de redefinição."
      : undefined;

  return <EsqueciSenhaForm initialError={initialError} />;
}
