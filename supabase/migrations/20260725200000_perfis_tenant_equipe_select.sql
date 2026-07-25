-- Membros da equipe podem ler perfis do mesmo tenant (captadores, responsáveis etc.)
-- Usa subconsulta apenas no próprio user_id para evitar recursão com rls_corretor_ids().
DROP POLICY IF EXISTS "perfis_tenant_equipe_select" ON public.perfis;

CREATE POLICY "perfis_tenant_equipe_select"
ON public.perfis FOR SELECT TO authenticated
USING (
  corretor_id IN (
    SELECT p.corretor_id
    FROM public.perfis AS p
    WHERE p.user_id = auth.uid()
      AND p.ativo = true
      AND p.corretor_id IS NOT NULL
  )
);
