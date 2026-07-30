-- Corrige recursão infinita: perfis_tenant_equipe_select consultava perfis dentro da política de perfis.
-- Usa rls_corretor_ids() (SECURITY DEFINER) para resolver o tenant sem reavaliar RLS em perfis.

DROP POLICY IF EXISTS "perfis_tenant_equipe_select" ON public.perfis;

CREATE POLICY "perfis_tenant_equipe_select"
ON public.perfis FOR SELECT TO authenticated
USING (
  corretor_id IN (SELECT public.rls_corretor_ids())
);

-- Mesmo padrão em corretores: evita subconsulta em perfis dentro da política de corretores.
DROP POLICY IF EXISTS "corretores_tenant_perfil_select" ON public.corretores;

CREATE POLICY "corretores_tenant_perfil_select"
ON public.corretores FOR SELECT TO authenticated
USING (
  id IN (SELECT public.rls_corretor_ids())
);

NOTIFY pgrst, 'reload schema';
