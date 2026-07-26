-- Documento M: store Cloudinary public_id for imovel photo deletion/replacement
ALTER TABLE public.imovel_fotos
  ADD COLUMN IF NOT EXISTS cloudinary_public_id text;
