-- leads: timestamps sem fuso → TIMESTAMPTZ (valores legados interpretados como UTC)

ALTER TABLE public.leads
  ALTER COLUMN criado_em TYPE TIMESTAMPTZ
  USING criado_em AT TIME ZONE 'UTC';

ALTER TABLE public.leads
  ALTER COLUMN criado_em SET DEFAULT NOW();

ALTER TABLE public.leads
  ALTER COLUMN atualizado_em TYPE TIMESTAMPTZ
  USING atualizado_em AT TIME ZONE 'UTC';

ALTER TABLE public.leads
  ALTER COLUMN atualizado_em SET DEFAULT NOW();

ALTER TABLE public.leads
  ALTER COLUMN data_entrada TYPE TIMESTAMPTZ
  USING data_entrada AT TIME ZONE 'UTC';
