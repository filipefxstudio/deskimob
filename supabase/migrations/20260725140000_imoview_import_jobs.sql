-- Imoview import jobs — fila assíncrona para migração em massa

CREATE TABLE IF NOT EXISTS public.imoview_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id UUID NOT NULL REFERENCES public.corretores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  imported_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  photos_downloaded INT NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '{}',
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT imoview_import_jobs_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.imoview_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.imoview_import_jobs(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT imoview_import_logs_status_check
    CHECK (status IN ('ok', 'skipped', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_imoview_import_jobs_corretor
  ON public.imoview_import_jobs(corretor_id);

CREATE INDEX IF NOT EXISTS idx_imoview_import_logs_job
  ON public.imoview_import_logs(job_id);

ALTER TABLE public.imoview_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoview_import_logs ENABLE ROW LEVEL SECURITY;

-- Apenas service role escreve; leitura via API autenticada com requireImoviewImportAccess
DROP POLICY IF EXISTS "imoview_import_jobs_service_role_all" ON public.imoview_import_jobs;
CREATE POLICY "imoview_import_jobs_service_role_all"
  ON public.imoview_import_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "imoview_import_logs_service_role_all" ON public.imoview_import_logs;
CREATE POLICY "imoview_import_logs_service_role_all"
  ON public.imoview_import_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
