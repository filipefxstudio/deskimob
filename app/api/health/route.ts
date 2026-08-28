import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
    ),
  };

  const imports: Record<string, string> = {};

  async function checkImport(name: string, loader: () => Promise<unknown>) {
    try {
      await loader();
      imports[name] = "ok";
    } catch (error) {
      imports[name] = error instanceof Error ? error.message : String(error);
    }
  }

  await checkImport("equipe-access", () => import("@/lib/auth/equipe-access"));
  await checkImport("dashboard-actions", () => import("@/lib/actions/dashboard"));
  await checkImport("site-queries", () => import("@/lib/site/queries"));
  await checkImport("supabase-server", () => import("@/lib/supabase/server"));

  let authCheck = "skipped";
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    authCheck = error ? `error:${error.message}` : user ? "authenticated" : "anonymous";
  } catch (error) {
    authCheck = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({
    ok: Object.values(env).every(Boolean) && Object.values(imports).every((v) => v === "ok"),
    env,
    imports,
    authCheck,
    node: process.version,
  });
}
