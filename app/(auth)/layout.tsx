import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { deskimobFaviconMetadata } from "@/lib/site/deskimob-favicon";

export const metadata = {
  icons: deskimobFaviconMetadata,
};

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-secondary">
          CRM Imobiliário
        </p>
        <h1 className="mt-1 text-3xl font-bold text-primary">Deskimob</h1>
      </div>
      {children}
    </div>
  );
}
