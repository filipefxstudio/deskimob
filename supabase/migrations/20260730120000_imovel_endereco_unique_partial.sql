-- Permite republicar imóvel vendido/desativado definitivo no mesmo endereço (novo cadastro).
-- Desativado temporariamente continua ocupando o endereço (mesmo proprietário, pausa na divulgação).

DROP INDEX IF EXISTS public.imoveis_endereco_unique;

CREATE UNIQUE INDEX imoveis_endereco_unique
  ON public.imoveis (
    corretor_id,
    LOWER(TRIM(logradouro)),
    LOWER(TRIM(numero)),
    LOWER(TRIM(COALESCE(complemento_valor, '')))
  )
  WHERE logradouro IS NOT NULL
    AND numero IS NOT NULL
    AND status NOT IN ('vendido', 'desativado');
