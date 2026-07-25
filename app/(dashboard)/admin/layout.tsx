import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/Sidebar";
import { requireImoviewImportAccessPage } from "@/lib/auth/imoview-import-access";
import { createClient } from "@/lib/supabase/server";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";

export default async function AdminLayout({
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

  await requireImoviewImportAccessPage();

  const corretor = await getCorretorForUser();
  const nome = corretor?.nome ?? user.email?.split("@")[0] ?? "Corretor";
  const slug = corretor?.slug ?? "";
  const logoUrl = corretor?.logo_crm_url ?? corretor?.logo_url ?? null;

  return (
    <DashboardShell nome={nome} slug={slug} logoUrl={logoUrl}>
      {children}
    </DashboardShell>
  );
}
