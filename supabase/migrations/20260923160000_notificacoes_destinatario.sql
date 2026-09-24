-- Notificações direcionadas ao usuário responsável (ex.: corretor do atendimento)

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS destinatario_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario_nao_lidas
  ON public.notificacoes(destinatario_user_id)
  WHERE lida_em IS NULL AND destinatario_user_id IS NOT NULL;

DROP POLICY IF EXISTS "notificacoes_select_corretor" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_update_corretor" ON public.notificacoes;

CREATE POLICY "notificacoes_select_corretor"
ON public.notificacoes FOR SELECT TO authenticated
USING (
  public.rls_mesmo_corretor(corretor_id)
  AND (
    destinatario_user_id IS NULL
    OR destinatario_user_id = auth.uid()
  )
);

CREATE POLICY "notificacoes_update_corretor"
ON public.notificacoes FOR UPDATE TO authenticated
USING (
  public.rls_mesmo_corretor(corretor_id)
  AND (
    destinatario_user_id IS NULL
    OR destinatario_user_id = auth.uid()
  )
)
WITH CHECK (
  public.rls_mesmo_corretor(corretor_id)
  AND (
    destinatario_user_id IS NULL
    OR destinatario_user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
