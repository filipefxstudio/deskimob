-- Token único para link de compartilhamento standalone do imóvel (preview sem navegação do site).
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS token_compartilhamento UUID;

UPDATE public.imoveis
SET token_compartilhamento = gen_random_uuid()
WHERE token_compartilhamento IS NULL;

ALTER TABLE public.imoveis
  ALTER COLUMN token_compartilhamento SET DEFAULT gen_random_uuid();

ALTER TABLE public.imoveis
  ALTER COLUMN token_compartilhamento SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS imoveis_token_compartilhamento_unique
  ON public.imoveis (token_compartilhamento);
