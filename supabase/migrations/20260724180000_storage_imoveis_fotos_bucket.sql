-- Deskimob — public Storage bucket for imóvel photos
--
-- Policies were added in 20260628120000_storage_imoveis_fotos_policies.sql
-- but the bucket itself was never created. Without a public bucket, uploaded
-- photo URLs return 404/403 even when rows exist in imovel_fotos.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('imoveis-fotos', 'imoveis-fotos', true, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;
