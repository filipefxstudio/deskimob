/**
 * Tokens oficiais Deskimob — referência para TS (gráficos, badges) e alinhamento com CSS vars.
 */
export const DESKIMOB = {
  orange: "#C85D32",
  orangeHover: "#B0532C",
  orangeLight: "#E07A52",
  olive: "#7D8750",
  oliveDark: "#5F6840",
  charcoal: "#252522",
  grayLight: "#E8E6E6",
  grayMedium: "#B8B8B8",
  white: "#FFFFFF",
  /** Erro semântico — não faz parte da paleta de marca */
  error: "#C0392B",
  errorMuted: "#C0392B",
} as const;

/** 1ª série / destaque */
export const DESKIMOB_CHART_PRIMARY = DESKIMOB.orange;
/** 2ª série / positivo */
export const DESKIMOB_CHART_SECONDARY = DESKIMOB.olive;
/** 3ª série / estrutural */
export const DESKIMOB_CHART_TERTIARY = DESKIMOB.charcoal;

/** Séries adicionais — neutros da identidade */
export const DESKIMOB_CHART_NEUTRALS = [
  "#9A9595",
  "#C4C0C0",
  DESKIMOB.grayMedium,
  DESKIMOB.grayLight,
] as const;

export const DESKIMOB_CHART_BAR_PALETTE = [
  DESKIMOB.orange,
  DESKIMOB.olive,
  DESKIMOB.charcoal,
  ...DESKIMOB_CHART_NEUTRALS,
] as const;

/** Semáforos de tempo / atualização — positivo, atenção, crítico */
export const DESKIMOB_SIGNAL = {
  good: DESKIMOB.olive,
  warn: DESKIMOB.orange,
  bad: DESKIMOB.error,
} as const;
