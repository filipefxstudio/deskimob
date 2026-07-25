import type { Metadata } from "next";

import { RedefinirSenhaForm } from "@/components/auth/redefinir-senha-form";

export const metadata: Metadata = {
  title: "Redefinir senha | Deskimob",
  description: "Defina uma nova senha para sua conta Deskimob",
};

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-secondary">
          CRM Imobiliário
        </p>
        <h1 className="mt-1 text-3xl font-bold text-primary">Deskimob</h1>
      </div>
      <RedefinirSenhaForm />
    </div>
  );
}
