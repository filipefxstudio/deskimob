-- Membros da equipe precisam ler o próprio perfil (user_id) para resolver o tenant.
DROP POLICY IF EXISTS "perfis_proprio_user_select" ON public.perfis;

CREATE POLICY "perfis_proprio_user_select"
ON public.perfis FOR SELECT TO authenticated
USING (user_id = auth.uid());
