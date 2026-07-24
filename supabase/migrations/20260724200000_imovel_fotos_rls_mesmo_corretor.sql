-- Align imovel_fotos RLS with imoveis (rls_mesmo_corretor) so equipe + dono acessam fotos

DROP POLICY IF EXISTS "imovel_fotos_proprio_corretor_select" ON public.imovel_fotos;
DROP POLICY IF EXISTS "imovel_fotos_proprio_corretor_insert" ON public.imovel_fotos;
DROP POLICY IF EXISTS "imovel_fotos_proprio_corretor_update" ON public.imovel_fotos;
DROP POLICY IF EXISTS "imovel_fotos_proprio_corretor_delete" ON public.imovel_fotos;

CREATE POLICY "imovel_fotos_proprio_corretor_select"
ON public.imovel_fotos FOR SELECT TO authenticated
USING (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);

CREATE POLICY "imovel_fotos_proprio_corretor_insert"
ON public.imovel_fotos FOR INSERT TO authenticated
WITH CHECK (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);

CREATE POLICY "imovel_fotos_proprio_corretor_update"
ON public.imovel_fotos FOR UPDATE TO authenticated
USING (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
)
WITH CHECK (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);

CREATE POLICY "imovel_fotos_proprio_corretor_delete"
ON public.imovel_fotos FOR DELETE TO authenticated
USING (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);
