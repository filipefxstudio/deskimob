-- Upsert em push_subscriptions exige política UPDATE (além de INSERT)

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_update_own"
ON public.push_subscriptions FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND public.rls_mesmo_corretor(corretor_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.rls_mesmo_corretor(corretor_id)
);

NOTIFY pgrst, 'reload schema';
