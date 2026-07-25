-- Notificações de formulários do site (e-mail configurável pelo admin da conta)

ALTER TABLE public.corretores
  ADD COLUMN IF NOT EXISTS site_leads_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS site_leads_email_ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS resend_from_email VARCHAR(255);

COMMENT ON COLUMN public.corretores.site_leads_email IS
  'Destino das notificações de leads do site; se vazio, usa site_email/contato_email/email.';

COMMENT ON COLUMN public.corretores.resend_api_key IS
  'Chave Resend da conta do corretor (opcional). Se preenchida, envia e-mails sem depender da chave da plataforma.';
