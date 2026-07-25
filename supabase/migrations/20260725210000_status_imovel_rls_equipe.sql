-- Membros da equipe precisam ler status_imovel do tenant (filtros, formulários, badges).

DROP POLICY IF EXISTS "status_imovel_proprio_corretor_select" ON public.status_imovel;
DROP POLICY IF EXISTS "status_imovel_proprio_corretor_insert" ON public.status_imovel;
DROP POLICY IF EXISTS "status_imovel_proprio_corretor_update" ON public.status_imovel;
DROP POLICY IF EXISTS "status_imovel_proprio_corretor_delete" ON public.status_imovel;

CREATE POLICY "status_imovel_proprio_corretor_select"
ON public.status_imovel FOR SELECT TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "status_imovel_proprio_corretor_insert"
ON public.status_imovel FOR INSERT TO authenticated
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "status_imovel_proprio_corretor_update"
ON public.status_imovel FOR UPDATE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id))
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "status_imovel_proprio_corretor_delete"
ON public.status_imovel FOR DELETE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));
