-- Permite que admins da equipe atualizem configurações do site (corretores).

CREATE OR REPLACE FUNCTION public.rls_pode_administrar_site(p_corretor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rls_mesmo_corretor(p_corretor_id)
    AND (
      public.rls_is_conta_dono()
      OR EXISTS (
        SELECT 1
        FROM public.perfis
        WHERE user_id = auth.uid()
          AND ativo = true
          AND papel = 'admin'
          AND corretor_id = p_corretor_id
      )
    )
$$;

REVOKE ALL ON FUNCTION public.rls_pode_administrar_site(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_pode_administrar_site(uuid) TO authenticated;

DROP POLICY IF EXISTS "corretores_site_admin_update" ON public.corretores;

CREATE POLICY "corretores_site_admin_update"
ON public.corretores FOR UPDATE TO authenticated
USING (public.rls_pode_administrar_site(id))
WITH CHECK (public.rls_pode_administrar_site(id));

NOTIFY pgrst, 'reload schema';
