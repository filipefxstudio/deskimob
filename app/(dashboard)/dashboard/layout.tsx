import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/Sidebar";
import { getEquipeAccessContext, getUsuarioLogadoDisplay } from "@/lib/auth/equipe-access";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    redirect("/login");
  }

  const { corretor } = ctx;
  const usuario = getUsuarioLogadoDisplay(ctx, user.email);
  const nome = usuario.nome || user.email?.split("@")[0] || "Corretor";
  const slug = corretor.slug ?? "";
  const logoUrl = corretor.logo_crm_url ?? corretor.logo_url ?? null;

  return (
    <DashboardShell nome={nome} slug={slug} logoUrl={logoUrl}>
      {children}
    </DashboardShell>
  );
}
