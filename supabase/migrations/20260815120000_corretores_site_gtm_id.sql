-- Google Tag Manager ID for public site (per tenant)

ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS site_gtm_id VARCHAR(20);
