import { STATUS_IMOVEL } from "@/lib/constants/imoveis";
import { cn } from "@/lib/utils";
import type { StatusImovel, StatusImovelSlug } from "@/types";

const STATUS_COLORS: Record<StatusImovelSlug, string> = {
  em_cadastro: "#94A3B8",
  aguardando_aprovacao: "#F59E0B",
  disponivel: "#2DC653",
  reservado: "#F18F01",
  vendido: "#1E3A5F",
  locado: "#7C3AED",
  desativado: "#6B7280",
  desativado_temporariamente: "#9CA3AF",
};

interface StatusBadgeProps {
  status: StatusImovelSlug;
  statusImovel?: StatusImovel | null;
  className?: string;
}

export function StatusBadge({ status, statusImovel, className }: StatusBadgeProps) {
  const label =
    statusImovel?.nome ??
    STATUS_IMOVEL.find((item) => item.value === status)?.label ??
    status;
  const color = statusImovel?.cor ?? STATUS_COLORS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
