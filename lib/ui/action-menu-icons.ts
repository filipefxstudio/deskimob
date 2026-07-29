import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileSignature,
  Handshake,
  MessageSquare,
  Pencil,
  PhoneCall,
  Printer,
  RefreshCw,
  Share2,
  Star,
  Trash2,
  UserCog,
  XCircle,
} from "lucide-react";

export const ACTION_MENU_ICONS = {
  editar: Pencil,
  excluir: Trash2,
  cancelar: XCircle,
  alterarStatus: RefreshCw,
  gerarFicha: Printer,
  proposta: FileSignature,
  parecer: MessageSquare,
  fecharNegocio: Handshake,
  gerarContrato: FileSignature,
  editarNegociacao: Pencil,
  cancelarNegociacao: Ban,
  excluirNegociacao: Trash2,
  agendarVisita: Calendar,
  compartilharLink: Copy,
  compartilhar: Share2,
  republicar: RefreshCw,
  duplicar: Copy,
  remover: Trash2,
  transferir: UserCog,
  descartar: Trash2,
  verDetalhes: Eye,
  aprovar: Check,
  reprovar: XCircle,
  validarAtualizacao: Check,
  desativar: Ban,
  marcarRealizado: CheckCircle2,
  irParaAtendimento: ExternalLink,
  contatoFeito: PhoneCall,
  qualificar: Star,
  abrirAtendimento: ExternalLink,
} as const satisfies Record<string, LucideIcon>;

export type ActionMenuIconKey = keyof typeof ACTION_MENU_ICONS;

export const ACTION_MENU_DESTRUCTIVE_CLASS =
  "text-destructive focus:text-destructive";

export const ACTION_MENU_ICON_CLASS = "size-4 shrink-0";
