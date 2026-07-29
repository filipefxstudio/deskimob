-- Membros da equipe precisam ler/inserir auditoria de imóveis do tenant (aprovação, republicação).

DROP POLICY IF EXISTS "auditoria_imovel_proprio_corretor_select" ON public.auditoria_imovel;
DROP POLICY IF EXISTS "auditoria_imovel_proprio_corretor_insert" ON public.auditoria_imovel;

CREATE POLICY "auditoria_imovel_proprio_corretor_select"
ON public.auditoria_imovel FOR SELECT TO authenticated
USING (public.rls_mesmo_corretor(corretor_id));

CREATE POLICY "auditoria_imovel_proprio_corretor_insert"
ON public.auditoria_imovel FOR INSERT TO authenticated
WITH CHECK (public.rls_mesmo_corretor(corretor_id));
