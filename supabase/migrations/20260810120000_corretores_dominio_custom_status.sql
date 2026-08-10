-- Status do domínio personalizado (integração Vercel)

ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS dominio_custom VARCHAR(255);
ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS dominio_custom_status VARCHAR(30) DEFAULT 'none';
ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS dominio_custom_erro TEXT;
ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS dominio_custom_verificacao JSONB;

CREATE INDEX IF NOT EXISTS idx_corretores_dominio_custom
  ON public.corretores(dominio_custom)
  WHERE dominio_custom IS NOT NULL;
