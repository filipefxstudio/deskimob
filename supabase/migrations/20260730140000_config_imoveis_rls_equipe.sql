-- Tipos custom, mídias de origem e motivos de desativação: equipe precisa ler/gravar config do tenant.

-- tipo_imovel_custom
DROP POLICY IF EXISTS "tipo_imovel_custom_proprio_corretor_select" ON public.tipo_imovel_custom;
DROP POLICY IF EXISTS "tipo_imovel_custom_proprio_corretor_insert" ON public.tipo_imovel_custom;
DROP POLICY IF EXISTS "tipo_imovel_custom_proprio_corretor_update" ON public.tipo_imovel_custom;
DROP POLICY IF EXISTS "tipo_imovel_custom_proprio_corretor_delete" ON public.tipo_imovel_custom;

CREATE POLICY "tipo_imovel_custom_proprio_corretor_select"
ON public.tipo_imovel_custom FOR SELECT TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "tipo_imovel_custom_proprio_corretor_insert"
ON public.tipo_imovel_custom FOR INSERT TO authenticated
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "tipo_imovel_custom_proprio_corretor_update"
ON public.tipo_imovel_custom FOR UPDATE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id))
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "tipo_imovel_custom_proprio_corretor_delete"
ON public.tipo_imovel_custom FOR DELETE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

-- midia_origem
DROP POLICY IF EXISTS "midia_origem_proprio_corretor_select" ON public.midia_origem;
DROP POLICY IF EXISTS "midia_origem_proprio_corretor_insert" ON public.midia_origem;
DROP POLICY IF EXISTS "midia_origem_proprio_corretor_update" ON public.midia_origem;
DROP POLICY IF EXISTS "midia_origem_proprio_corretor_delete" ON public.midia_origem;

CREATE POLICY "midia_origem_proprio_corretor_select"
ON public.midia_origem FOR SELECT TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "midia_origem_proprio_corretor_insert"
ON public.midia_origem FOR INSERT TO authenticated
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "midia_origem_proprio_corretor_update"
ON public.midia_origem FOR UPDATE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id))
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "midia_origem_proprio_corretor_delete"
ON public.midia_origem FOR DELETE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

-- motivos_desativacao
DROP POLICY IF EXISTS "motivos_desativacao_proprio_corretor_select" ON public.motivos_desativacao;
DROP POLICY IF EXISTS "motivos_desativacao_proprio_corretor_insert" ON public.motivos_desativacao;
DROP POLICY IF EXISTS "motivos_desativacao_proprio_corretor_update" ON public.motivos_desativacao;
DROP POLICY IF EXISTS "motivos_desativacao_proprio_corretor_delete" ON public.motivos_desativacao;

CREATE POLICY "motivos_desativacao_proprio_corretor_select"
ON public.motivos_desativacao FOR SELECT TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "motivos_desativacao_proprio_corretor_insert"
ON public.motivos_desativacao FOR INSERT TO authenticated
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "motivos_desativacao_proprio_corretor_update"
ON public.motivos_desativacao FOR UPDATE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id))
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "motivos_desativacao_proprio_corretor_delete"
ON public.motivos_desativacao FOR DELETE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

NOTIFY pgrst, 'reload schema';
