-- Garante sequência de código de imóvel por conta (corretor) e corrige RLS para membros da equipe.

-- Remove eventual UNIQUE global em codigo (conflito entre contas diferentes).
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_codigo_key;

DROP INDEX IF EXISTS public.imoveis_codigo_key;
DROP INDEX IF EXISTS public.imoveis_codigo_idx;

-- Reforça unicidade por tenant.
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_corretor_codigo_unique;

ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_corretor_codigo_unique UNIQUE (corretor_id, codigo);

-- Membros ativos da equipe enxergam o corretor_id do tenant (não só o dono da conta).
CREATE OR REPLACE FUNCTION public.rls_corretor_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.corretores
  WHERE user_id = auth.uid()
  UNION
  SELECT corretor_id
  FROM public.perfis
  WHERE user_id = auth.uid()
    AND ativo = true
    AND corretor_id IS NOT NULL
$$;

-- Permite que perfis ativos leiam dados básicos do corretor do tenant.
DROP POLICY IF EXISTS "corretores_tenant_perfil_select" ON public.corretores;

CREATE POLICY "corretores_tenant_perfil_select"
ON public.corretores FOR SELECT TO authenticated
USING (
  id IN (
    SELECT corretor_id
    FROM public.perfis
    WHERE user_id = auth.uid()
      AND ativo = true
  )
);
