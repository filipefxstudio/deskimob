export type PlanoAssinatura = "basico" | "profissional" | "premium";

export type StatusAssinatura = "ativo" | "cancelado" | "pendente" | "expirado";

export type TipoImovel =
  | "apartamento"
  | "casa"
  | "terreno"
  | "comercial"
  | "cobertura"
  | "studio";

export type PapelUsuario = "admin" | "gerente" | "corretor";

export type TipoCliente = "lead" | "proprietario" | "ambos";

export type LocalChaves = "imobiliaria" | "proprietario" | "portaria" | "outros";

export type FinalidadeImovel = "venda" | "locacao";

export type StatusImovelSlug =
  | "em_cadastro"
  | "aguardando_aprovacao"
  | "disponivel"
  | "reservado"
  | "vendido"
  | "locado"
  | "desativado"
  | "desativado_temporariamente";

export type StatusAprovacaoImovel = "em_cadastro" | "aguardando_aprovacao" | "aprovado";

export type DestinacaoImovel = "residencial" | "comercial" | "rural";

export type ExibirEnderecoModo = "completo" | "apenas_bairro" | "oculto";

export type DominioCustomStatus = "none" | "pending_dns" | "active" | "error";

export interface DominioDnsRecord {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
  description?: string;
}

export interface SiteDominioStatusPayload {
  domain: string | null;
  status: DominioCustomStatus;
  error: string | null;
  verified: boolean;
  misconfigured: boolean;
  dnsRecords: DominioDnsRecord[];
}

export interface StatusImovel {
  id: string;
  corretor_id: string;
  nome: string;
  cor: string;
  padrao: boolean;
  ativo: boolean;
  ordem: number;
  criado_em: string;
}

export interface MarcaDaguaConfig {
  id: string;
  corretor_id: string;
  logo_url: string | null;
  tamanho_percent: number;
  opacidade_percent: number;
  posicao: string;
  criado_em: string;
  atualizado_em: string;
}

export interface DashboardConfig {
  id: string;
  corretor_id: string;
  leads_verde_dias: number;
  leads_amarelo_dias: number;
  imoveis_verde_dias: number;
  imoveis_amarelo_dias: number;
  criado_em: string;
  atualizado_em: string;
}

export type EtapaLead =
  | "novo"
  | "contato_feito"
  | "qualificado"
  | "visita_agendada"
  | "proposta"
  | "negociacao"
  | "venda"
  | "fechado"
  | "perdido";

export type TemperaturaLead = "quente" | "morno" | "frio" | "indefinido";

export type SituacaoLead = "em_atendimento" | "descartado" | "negocio_fechado";

export type OrigemLead = "site" | "whatsapp" | "portal" | "indicacao" | "manual";

export type ProvedorIA = "openai" | "anthropic" | "gemini";

export type TomAgente = "profissional" | "descontraido" | "formal";

export type AtendidoPor = "chatbot" | "agente_ia" | "corretor";

export type EtapaChatbot =
  | "inicio"
  | "finalidade"
  | "bairro"
  | "quartos"
  | "valor"
  | "prazo"
  | "concluido";

export type TipoInteracao =
  | "mensagem_whatsapp"
  | "ligacao"
  | "visita"
  | "email"
  | "anotacao"
  | "proposta";

export type DeInteracao = "corretor" | "lead" | "bot" | "agente_ia";

export interface Corretor {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  creci: string | null;
  slug: string;
  dominio_custom?: string | null;
  dominio_custom_status?: DominioCustomStatus | null;
  dominio_custom_erro?: string | null;
  dominio_custom_verificacao?: DominioDnsRecord[] | null;
  foto_url?: string | null;
  logo_url?: string | null;
  logo_crm_url?: string | null;
  site_cor_primaria?: string | null;
  site_cor_secundaria?: string | null;
  site_favicon_url?: string | null;
  site_tarja_cor?: string | null;
  site_nome_exibicao?: string | null;
  hero_image_url?: string | null;
  hero_titulo?: string | null;
  hero_subtitulo?: string | null;
  sobre?: string | null;
  sobre_titulo?: string | null;
  sobre_texto?: string | null;
  sobre_foto_url?: string | null;
  site_sobre_titulo?: string | null;
  site_sobre_texto?: string | null;
  site_sobre_foto_url?: string | null;
  site_creci?: string | null;
  site_telefone_vendas?: string | null;
  site_telefone_locacao?: string | null;
  site_email?: string | null;
  site_instagram?: string | null;
  site_youtube?: string | null;
  site_tiktok?: string | null;
  site_linkedin?: string | null;
  site_facebook?: string | null;
  site_horario?: string | null;
  site_endereco?: string | null;
  contato_email?: string | null;
  contato_telefone?: string | null;
  contato_endereco?: string | null;
  contato_horario?: string | null;
  whatsapp?: string | null;
  zapi_instance_id?: string | null;
  zapi_token?: string | null;
  rodizio_ativo?: boolean;
  criado_em: string;
  atualizado_em?: string;
}

export interface MotivoDesativacao {
  id: string;
  corretor_id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface Assinatura {
  id: string;
  corretor_id: string;
  plano: PlanoAssinatura;
  status: StatusAssinatura;
  criado_em: string;
}

export interface AgenteConfig {
  id: string;
  corretor_id: string;
  ativo: boolean;
  nome_agente: string;
  tom: TomAgente;
  provedor: ProvedorIA;
  modelo: string;
  api_key?: string;
  instrucoes_customizadas?: string | null;
  horario_inicio: string;
  horario_fim: string;
  agendar_visitas: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ImovelFoto {
  id: string;
  imovel_id: string;
  url: string;
  ordem: number;
  legenda?: string | null;
  cloudinary_public_id?: string | null;
}

export interface Perfil {
  id: string;
  corretor_id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  foto_url?: string | null;
  papel: PapelUsuario;
  ativo: boolean;
  criado_em: string;
}

export interface Cliente {
  id: string;
  corretor_id: string;
  perfil_id?: string | null;
  nome: string;
  telefone: string;
  email?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  profissao?: string | null;
  estado_civil?: string | null;
  observacoes?: string | null;
  tipo: TipoCliente;
  eh_construtor_investidor: boolean;
  criado_em: string;
  atualizado_em: string;
  perfil?: Perfil | null;
  /** Quando preenchido, a linha veio da tabela leads (sem registro em clientes). */
  lead_id?: string | null;
}

export interface TipoImovelCustom {
  id: string;
  corretor_id: string;
  nome: string;
  ativo: boolean;
}

export interface MidiaOrigem {
  id: string;
  corretor_id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface AuditoriaImovel {
  id: string;
  imovel_id: string;
  corretor_id?: string | null;
  perfil_id?: string | null;
  acao: string;
  motivo?: string | null;
  detalhes?: Record<string, unknown> | null;
  criado_em: string;
  perfil?: Perfil | null;
}

export interface ImovelDesempenhoKpis {
  totalLeads: number;
  visitasAgendadas: number;
  visitasRealizadas: number;
  propostas: number;
  negociosFechados: number;
  visualizacoes: number;
}

export interface ImovelDesempenhoFunilItem {
  etapa: string;
  label: string;
  total: number;
}

export interface ImovelDesempenhoOrigemItem {
  origem: string;
  label: string;
  total: number;
}

export interface ImovelDesempenhoParecerItem {
  parecer: string;
  label: string;
  total: number;
}

export interface ImovelDesempenho {
  kpis: ImovelDesempenhoKpis;
  funil: ImovelDesempenhoFunilItem[];
  origem: ImovelDesempenhoOrigemItem[];
  visitasParecer: ImovelDesempenhoParecerItem[];
}

export interface Imovel {
  id: string;
  corretor_id: string;
  codigo?: string | null;
  codigo_personalizado?: string | null;
  titulo?: string | null;
  slug?: string | null;
  tipo: TipoImovel;
  finalidade: FinalidadeImovel;
  destinacao?: DestinacaoImovel | null;
  status: StatusImovelSlug;
  status_imovel_id?: string | null;
  status_imovel?: StatusImovel | null;
  status_aprovacao?: StatusAprovacaoImovel;
  captador_id?: string | null;
  captador?: Perfil | null;
  captadores?: ImovelCaptador[];
  proprietarios?: ImovelProprietario[];
  comissao_percent?: number | null;
  exibir_endereco_site?: ExibirEnderecoModo;
  exibir_endereco_portais?: ExibirEnderecoModo;
  motivo_desativacao?: string | null;
  cadastrado_por_perfil_id?: string | null;
  cadastrado_por?: Perfil | null;
  data_ativacao?: string | null;
  data_desativacao?: string | null;
  data_ultima_atualizacao?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  complemento_valor?: string | null;
  complemento_tipo?: string | null;
  complemento_numero?: string | null;
  complemento_torre?: string | null;
  condominio_nome?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  portal_endereco_diferente?: boolean;
  portal_logradouro?: string | null;
  portal_numero?: string | null;
  portal_bairro?: string | null;
  portal_cep?: string | null;
  portal_cidade?: string | null;
  portal_estado?: string | null;
  local_chaves?: LocalChaves | null;
  chaves_codigo?: string | null;
  chaves_descricao?: string | null;
  exclusividade?: boolean;
  imovel_ocupado?: boolean;
  contrato_aluguel_ativo?: boolean;
  aceita_financiamento?: boolean;
  aceita_permuta?: boolean;
  imovel_na_planta?: boolean;
  area_util?: number | null;
  area_total?: number | null;
  ano_construcao?: number | null;
  quartos: number;
  suites: number;
  salas?: number | null;
  banheiros: number;
  elevadores?: number | null;
  vagas: number;
  vagas_tipo?: string | null;
  vagas_cobertura?: string | null;
  valor_venda?: number | null;
  valor_locacao?: number | null;
  valor_condominio?: number | null;
  valor_iptu?: number | null;
  descricao?: string | null;
  diferenciais?: string[] | null;
  video_url?: string | null;
  publicado_site: boolean;
  destaque_site?: boolean;
  publicado_portais?: boolean;
  cliente_id?: string | null;
  cliente?: Cliente | null;
  fotos?: ImovelFoto[];
  visualizacoes: number;
  criado_em: string;
  atualizado_em: string;
}

export interface Lead {
  id: string;
  corretor_id: string;
  cliente_id?: string | null;
  imovel_id?: string | null;
  perfil_id?: string | null;
  codigo_atendimento?: string | null;
  situacao?: SituacaoLead;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  finalidade_busca?: string | null;
  tipo_imovel_busca?: string | null;
  bairros_interesse?: string[] | null;
  quartos_minimo?: number | null;
  suites_minimas?: number | null;
  banheiros_minimos?: number | null;
  vagas_minimas?: number | null;
  valor_minimo?: number | null;
  valor_maximo?: number | null;
  prazo_decisao?: string | null;
  entrada_fgts?: number | null;
  entrada_recursos_proprios?: number | null;
  financiamento_aprovado?: boolean;
  possui_imovel_venda?: boolean;
  interesse_permuta?: boolean;
  info_permuta?: string | null;
  obs_financeiras?: string | null;
  data_entrada?: string | null;
  tempo_primeira_resposta_min?: number | null;
  motivo_descarte_id?: string | null;
  motivo_descarte_texto?: string | null;
  etapa: EtapaLead;
  temperatura: TemperaturaLead;
  origem: OrigemLead;
  observacoes?: string | null;
  ultima_mensagem_em?: string | null;
  conversa_ativa?: boolean;
  etapa_chatbot?: EtapaChatbot | null;
  atendido_por: AtendidoPor;
  criado_em: string;
  atualizado_em: string;
  imovel?: Imovel;
  perfil?: Perfil | null;
  interacoes?: LeadInteracao[];
}

export interface LeadInteracao {
  id: string;
  lead_id: string;
  corretor_id: string;
  tipo: TipoInteracao;
  conteudo: string;
  de: DeInteracao;
  tokens_usados?: number | null;
  criado_em: string;
}

export interface RespostaAgente {
  texto: string;
  tokens_usados: number;
  provedor: ProvedorIA;
  modelo: string;
}

export interface CorretorInsert {
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  creci: string | null;
  slug: string;
}

export interface AssinaturaInsert {
  corretor_id: string;
  plano: PlanoAssinatura;
  status: StatusAssinatura;
}

export interface PerfilInsert {
  corretor_id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  papel: PapelUsuario;
  ativo: boolean;
}

export interface CorretorComRelacoes extends Corretor {
  assinaturas?: Assinatura[];
  agente_config?: AgenteConfig | AgenteConfig[] | null;
}

export interface ZApiWebhookBody {
  phone?: string;
  instanceId?: string;
  text?: {
    message?: string;
  };
}

export type StatusVisita =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "cancelada"
  | "nao_compareceu";

export type ParecerVisita = "positivo" | "neutro" | "negativo";

export type VaiGerarProposta = "sim" | "nao" | "talvez";

export type StatusProposta =
  | "em_analise"
  | "aceita"
  | "recusada"
  | "cancelada"
  | "contraproposta";

export type StatusNegocio = "fechado" | "cancelado";

export type FormaPagamentoNegocio = "avista" | "financiado";

export type PapelRateioNegocio = "vendedor" | "captador" | "outro";

export interface NegocioRateioItem {
  perfil_id: string;
  papel: PapelRateioNegocio;
  percentual: number;
  valor: number;
  nome?: string | null;
}

export type TipoAgenda =
  | "visita"
  | "ligacao"
  | "reuniao"
  | "whatsapp"
  | "captacao"
  | "email"
  | "tarefa"
  | "lembrete"
  | "outro";

export type StatusAgenda = "pendente" | "concluida" | "cancelada";

export interface Visita {
  id: string;
  corretor_id: string;
  lead_id: string;
  imovel_id?: string | null;
  perfil_id?: string | null;
  data_visita: string;
  status: StatusVisita;
  parecer?: ParecerVisita | null;
  vai_gerar_proposta?: VaiGerarProposta | null;
  observacoes?: string | null;
  criado_em: string;
  imovel?: Imovel | null;
  perfil?: Perfil | null;
}

export interface Proposta {
  id: string;
  corretor_id: string;
  lead_id: string;
  imovel_id?: string | null;
  perfil_id?: string | null;
  valor_proposto: number;
  data_proposta: string;
  status: StatusProposta;
  observacoes?: string | null;
  criado_em: string;
  imovel?: Imovel | null;
  perfil?: Perfil | null;
}

export interface Negocio {
  id: string;
  corretor_id: string;
  lead_id: string;
  imovel_id?: string | null;
  proposta_id?: string | null;
  perfil_id?: string | null;
  valor_fechamento: number;
  valor_comissao?: number | null;
  percentual_comissao?: number | null;
  data_fechamento: string;
  data_prevista_comissao?: string | null;
  data_recebimento_comissao?: string | null;
  forma_pagamento?: FormaPagamentoNegocio | null;
  valor_recursos_proprios?: number | null;
  valor_financiado?: number | null;
  valor_fgts?: number | null;
  rateio?: NegocioRateioItem[] | null;
  status: StatusNegocio;
  observacoes?: string | null;
  criado_em: string;
  imovel?: Imovel | null;
  proposta?: Proposta | null;
  perfil?: Perfil | null;
}

/** TODO: modelar contratos gerados a partir de negócios fechados (configurações). */
export type ContratoNegocioStub = {
  negocio_id: string;
  template_id?: string | null;
};

export interface LeadImovelSelecionado {
  id: string;
  lead_id: string;
  imovel_id: string;
  corretor_id: string;
  token_compartilhamento: string;
  interesse_inicial?: boolean;
  criado_em: string;
  imovel?: Imovel | null;
}

export interface ImovelCaptador {
  id: string;
  imovel_id: string;
  perfil_id?: string | null;
  nome_externo?: string | null;
  principal: boolean;
  criado_em: string;
  perfil?: Perfil | null;
}

export interface ImovelProprietario {
  id: string;
  imovel_id: string;
  cliente_id: string;
  ordem: number;
  criado_em: string;
  cliente?: Cliente | null;
}

export interface Agenda {
  id: string;
  corretor_id: string;
  perfil_id?: string | null;
  lead_id?: string | null;
  imovel_id?: string | null;
  visita_id?: string | null;
  tipo: TipoAgenda;
  titulo: string;
  descricao?: string | null;
  data_atividade: string;
  status: StatusAgenda;
  lembrete_email: boolean;
  lembrete_enviado: boolean;
  criado_em: string;
  lead?: Lead | null;
  imovel?: Imovel | null;
  perfil?: Perfil | null;
}

export interface AuditoriaAtendimento {
  id: string;
  lead_id: string;
  corretor_id?: string | null;
  perfil_id?: string | null;
  acao: string;
  detalhes?: Record<string, unknown> | null;
  criado_em: string;
  perfil?: Perfil | null;
}

export interface AtendimentoConfig {
  id: string;
  corretor_id: string;
  faixa_valor_percent: number;
  ficha_visita_texto?: string | null;
  criado_em: string;
}

export interface ConfigFichaVisita {
  id: string;
  corretor_id: string;
  texto_clausula?: string | null;
  percentual_comissao: number;
  usa_texto_padrao: boolean;
  criado_em: string;
  atualizado_em?: string;
}

export interface MotivoDescarte {
  id: string;
  corretor_id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export type GrupoExportacaoDados =
  | "imoveis"
  | "clientes"
  | "atendimentos"
  | "visitas"
  | "propostas"
  | "negocios"
  | "agenda";

export interface ExportacaoDados {
  id: string;
  corretor_id: string;
  usuario_id: string;
  grupos_exportados: GrupoExportacaoDados[];
  criado_em: string;
}
