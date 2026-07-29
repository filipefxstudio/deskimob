-- Slug desativado_temporariamente (26 chars) excedia VARCHAR(20) na importação Imoview.
-- Policies RLS referenciam imoveis.status — é preciso dropar antes do ALTER TYPE.

DROP POLICY IF EXISTS "imovel_fotos_publicas_leitura" ON public.imovel_fotos;
DROP POLICY IF EXISTS "imoveis_public_site_read" ON public.imoveis;

ALTER TABLE public.imoveis
  ALTER COLUMN status TYPE VARCHAR(40);

CREATE POLICY "imoveis_public_site_read"
ON public.imoveis
FOR SELECT
TO anon, authenticated
USING (publicado_site = true AND status = 'disponivel');

CREATE POLICY "imovel_fotos_publicas_leitura"
ON public.imovel_fotos
FOR SELECT
TO public
USING (
  imovel_id IN (
    SELECT id FROM public.imoveis
    WHERE publicado_site = true
      AND status = 'disponivel'
  )
);
