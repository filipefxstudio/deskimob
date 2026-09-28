-- Permite excluir atendimento (lead) sem violar FK da agenda

ALTER TABLE public.agenda DROP CONSTRAINT IF EXISTS agenda_lead_id_fkey;

ALTER TABLE public.agenda
  ADD CONSTRAINT agenda_lead_id_fkey
  FOREIGN KEY (lead_id)
  REFERENCES public.leads(id)
  ON DELETE SET NULL;

ALTER TABLE public.agenda DROP CONSTRAINT IF EXISTS agenda_visita_id_fkey;

ALTER TABLE public.agenda
  ADD CONSTRAINT agenda_visita_id_fkey
  FOREIGN KEY (visita_id)
  REFERENCES public.visitas(id)
  ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
