-- Garante coluna ordem (instalações antigas criaram a tabela sem ela)
ALTER TABLE public.imovel_proprietarios
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0;

-- Alinha imovel_proprietarios com imoveis (rls_mesmo_corretor) para equipe + dono

DROP POLICY IF EXISTS "imovel_proprietarios_corretor_select" ON public.imovel_proprietarios;
DROP POLICY IF EXISTS "imovel_proprietarios_corretor_insert" ON public.imovel_proprietarios;
DROP POLICY IF EXISTS "imovel_proprietarios_corretor_update" ON public.imovel_proprietarios;
DROP POLICY IF EXISTS "imovel_proprietarios_corretor_delete" ON public.imovel_proprietarios;

CREATE POLICY "imovel_proprietarios_corretor_select"
ON public.imovel_proprietarios FOR SELECT TO authenticated
USING (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);

CREATE POLICY "imovel_proprietarios_corretor_insert"
ON public.imovel_proprietarios FOR INSERT TO authenticated
WITH CHECK (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);

CREATE POLICY "imovel_proprietarios_corretor_update"
ON public.imovel_proprietarios FOR UPDATE TO authenticated
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

CREATE POLICY "imovel_proprietarios_corretor_delete"
ON public.imovel_proprietarios FOR DELETE TO authenticated
USING (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE public.rls_mesmo_corretor(corretor_id)
  )
);
