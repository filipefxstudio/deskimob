-- Documento N — métricas de tentativas de contato (dashboard)

ALTER TABLE public.lead_interacoes
  ADD COLUMN IF NOT EXISTS perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_interacoes_corretor_criado_em
  ON public.lead_interacoes(corretor_id, criado_em);

CREATE INDEX IF NOT EXISTS idx_lead_interacoes_lead_criado_em
  ON public.lead_interacoes(lead_id, criado_em);

CREATE INDEX IF NOT EXISTS idx_lead_interacoes_perfil_criado_em
  ON public.lead_interacoes(perfil_id, criado_em)
  WHERE perfil_id IS NOT NULL;

-- Atribui tentativas antigas ao corretor responsável do lead (melhor proxy disponível).
UPDATE public.lead_interacoes li
SET perfil_id = l.perfil_id
FROM public.leads l
WHERE li.lead_id = l.id
  AND li.perfil_id IS NULL
  AND l.perfil_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dashboard_lead_finalidade_busca(p_finalidade text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(p_finalidade, ''))) IN ('locacao', 'locação') THEN 'locacao'
    ELSE 'compra'
  END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_is_tentativa_contato(p_tipo text, p_de text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    (p_tipo IN ('ligacao', 'email', 'visita') AND p_de = 'corretor')
    OR (p_tipo = 'mensagem_whatsapp' AND p_de = 'corretor')
  );
$$;

CREATE OR REPLACE FUNCTION public.dashboard_contato_metricas(
  p_corretor_id uuid,
  p_periodo_inicio timestamptz,
  p_periodo_fim timestamptz,
  p_periodo_anterior_inicio timestamptz,
  p_periodo_anterior_fim timestamptz,
  p_finalidade text,
  p_perfil_filtro uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gestor boolean;
  v_meu_perfil uuid;
  v_finalidade text;
  v_result jsonb;
BEGIN
  IF NOT public.rls_mesmo_corretor(p_corretor_id) THEN
    RAISE EXCEPTION 'Acesso negado ao corretor informado';
  END IF;

  v_gestor := public.rls_is_gestor() OR public.rls_is_conta_dono();
  v_meu_perfil := public.rls_perfil_id();
  IF p_perfil_filtro IS NOT NULL AND NOT v_gestor THEN
    RAISE EXCEPTION 'Filtro por corretor permitido apenas para gestores';
  END IF;

  v_finalidade := CASE
    WHEN p_finalidade IN ('compra', 'locacao') THEN p_finalidade
    ELSE public.dashboard_lead_finalidade_busca(p_finalidade)
  END;

  WITH base AS (
    SELECT
      li.id,
      li.lead_id,
      li.criado_em,
      coalesce(li.perfil_id, l.perfil_id) AS perfil_efetivo,
      l.finalidade_busca
    FROM public.lead_interacoes li
    INNER JOIN public.leads l ON l.id = li.lead_id AND l.corretor_id = p_corretor_id
    WHERE li.corretor_id = p_corretor_id
      AND public.dashboard_is_tentativa_contato(li.tipo, li.de)
      AND public.dashboard_lead_finalidade_busca(l.finalidade_busca) = v_finalidade
      AND (
        v_gestor
        OR li.perfil_id = v_meu_perfil
        OR (li.perfil_id IS NULL AND l.perfil_id = v_meu_perfil)
        OR (li.perfil_id IS NULL AND l.perfil_id IS NULL AND v_meu_perfil IS NULL)
      )
      AND (
        p_perfil_filtro IS NULL
        OR coalesce(li.perfil_id, l.perfil_id) = p_perfil_filtro
      )
  ),
  periodo AS (
    SELECT lead_id, criado_em, perfil_efetivo
    FROM base
    WHERE criado_em >= p_periodo_inicio AND criado_em <= p_periodo_fim
  ),
  anterior AS (
    SELECT lead_id
    FROM base
    WHERE criado_em >= p_periodo_anterior_inicio AND criado_em <= p_periodo_anterior_fim
  ),
  leads_cont AS (
    SELECT COUNT(DISTINCT lead_id)::int AS total FROM periodo
  ),
  leads_ant AS (
    SELECT COUNT(DISTINCT lead_id)::int AS total FROM anterior
  ),
  dias AS (
    SELECT gs::date AS dia
    FROM generate_series(
      (p_periodo_inicio AT TIME ZONE 'America/Sao_Paulo')::date,
      (p_periodo_fim AT TIME ZONE 'America/Sao_Paulo')::date,
      interval '1 day'
    ) gs
  ),
  por_dia AS (
    SELECT
      (criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
      COUNT(DISTINCT lead_id)::int AS total
    FROM periodo
    GROUP BY 1
  ),
  serie AS (
    SELECT
      d.dia,
      coalesce(p.total, 0)::int AS total
    FROM dias d
    LEFT JOIN por_dia p ON p.dia = d.dia
    ORDER BY d.dia
  ),
  ordenadas AS (
    SELECT
      b.lead_id,
      b.criado_em,
      b.perfil_efetivo,
      lag(b.criado_em) OVER (PARTITION BY b.lead_id ORDER BY b.criado_em) AS prev_em
    FROM base b
  ),
  intervalos AS (
    SELECT
      o.perfil_efetivo,
      EXTRACT(EPOCH FROM (o.criado_em - o.prev_em)) * 1000 AS diff_ms
    FROM ordenadas o
    WHERE o.prev_em IS NOT NULL
      AND o.criado_em >= p_periodo_inicio
      AND o.criado_em <= p_periodo_fim
  ),
  stats AS (
    SELECT
      avg(diff_ms) AS media_ms,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY diff_ms) AS mediana_ms,
      COUNT(*)::int AS qtd_intervalos
    FROM intervalos
  ),
  faixas AS (
    SELECT
      COUNT(*) FILTER (WHERE diff_ms <= 86400000)::int AS ate_24h,
      COUNT(*) FILTER (WHERE diff_ms > 86400000 AND diff_ms <= 259200000)::int AS de_1_a_3,
      COUNT(*) FILTER (WHERE diff_ms > 259200000 AND diff_ms <= 604800000)::int AS de_3_a_7,
      COUNT(*) FILTER (WHERE diff_ms > 604800000)::int AS mais_7
    FROM intervalos
  ),
  leads_por_perfil AS (
    SELECT
      p.perfil_efetivo AS perfil_id,
      max(pf.nome) AS nome,
      COUNT(DISTINCT p.lead_id)::int AS leads_contatados
    FROM periodo p
    LEFT JOIN public.perfis pf ON pf.id = p.perfil_efetivo
    GROUP BY p.perfil_efetivo
  ),
  intervalo_por_perfil AS (
    SELECT perfil_efetivo AS perfil_id, avg(diff_ms) AS tempo_medio_ms
    FROM intervalos
    GROUP BY perfil_efetivo
  ),
  por_corretor AS (
    SELECT
      l.perfil_id,
      l.nome,
      l.leads_contatados,
      i.tempo_medio_ms
    FROM leads_por_perfil l
    LEFT JOIN intervalo_por_perfil i ON i.perfil_id = l.perfil_id
    WHERE v_gestor
  )
  SELECT jsonb_build_object(
    'leads_contatados', (SELECT total FROM leads_cont),
    'leads_contatados_anterior', (SELECT total FROM leads_ant),
    'serie_diaria', coalesce(
      (SELECT jsonb_agg(jsonb_build_object('dia', dia, 'total', total) ORDER BY dia) FROM serie),
      '[]'::jsonb
    ),
    'tempo_medio_ms', (SELECT media_ms FROM stats),
    'tempo_mediano_ms', (SELECT mediana_ms FROM stats),
    'intervalos_total', (SELECT qtd_intervalos FROM stats),
    'faixas', jsonb_build_object(
      'ate_24h', (SELECT ate_24h FROM faixas),
      'de_1_a_3_dias', (SELECT de_1_a_3 FROM faixas),
      'de_3_a_7_dias', (SELECT de_3_a_7 FROM faixas),
      'mais_7_dias', (SELECT mais_7 FROM faixas)
    ),
    'por_corretor', CASE
      WHEN v_gestor THEN coalesce(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'perfil_id', perfil_id,
            'nome', coalesce(nome, 'Sem nome'),
            'leads_contatados', leads_contatados,
            'tempo_medio_ms', tempo_medio_ms
          )
          ORDER BY leads_contatados DESC
        ) FROM por_corretor),
        '[]'::jsonb
      )
      ELSE '[]'::jsonb
    END,
    'ver_tabela_corretores', v_gestor
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_contato_metricas(
  uuid, timestamptz, timestamptz, timestamptz, timestamptz, text, uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dashboard_contato_metricas(
  uuid, timestamptz, timestamptz, timestamptz, timestamptz, text, uuid
) TO authenticated;
