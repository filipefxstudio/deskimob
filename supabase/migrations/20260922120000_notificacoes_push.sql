-- Deskimob — notificações in-app e assinaturas Web Push (PWA)

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL REFERENCES public.corretores(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  href text,
  entidade_tipo text,
  entidade_id uuid,
  dedupe_key text,
  lida_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_corretor_criado
  ON public.notificacoes(corretor_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_corretor_nao_lidas
  ON public.notificacoes(corretor_id)
  WHERE lida_em IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notificacoes_corretor_dedupe
  ON public.notificacoes(corretor_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL REFERENCES public.corretores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_corretor
  ON public.push_subscriptions(corretor_id);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes_select_corretor" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_update_corretor" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes_insert_corretor" ON public.notificacoes;

CREATE POLICY "notificacoes_select_corretor"
ON public.notificacoes FOR SELECT TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "notificacoes_update_corretor"
ON public.notificacoes FOR UPDATE TO authenticated
USING (public.rls_mesmo_corretor(corretor_id))
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "notificacoes_insert_corretor"
ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (public.rls_mesmo_corretor(corretor_id));

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select_own"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND public.rls_mesmo_corretor(corretor_id)
);

CREATE POLICY "push_subscriptions_insert_own"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.rls_mesmo_corretor(corretor_id)
);

CREATE POLICY "push_subscriptions_delete_own"
ON public.push_subscriptions FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND public.rls_mesmo_corretor(corretor_id)
);

NOTIFY pgrst, 'reload schema';
