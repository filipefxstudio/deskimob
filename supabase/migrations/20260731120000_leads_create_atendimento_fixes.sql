-- Garantir colunas usadas no cadastro de atendimento e ajustar visibilidade RLS.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bairros_interesse TEXT[];
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS finalidade_busca TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tipo_imovel_busca TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS quartos_minimo INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_minimo DECIMAL(15, 2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_maximo DECIMAL(15, 2);

-- Membros da equipe podem ver atendimentos sem corretor responsável definido.
CREATE OR REPLACE FUNCTION public.rls_pode_ver_por_perfil(p_perfil_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.rls_is_conta_dono()
    OR public.rls_is_gestor()
    OR p_perfil_id IS NULL
    OR (
      public.rls_perfil_id() IS NOT NULL
      AND p_perfil_id IS NOT NULL
      AND p_perfil_id = public.rls_perfil_id()
    )
$$;
