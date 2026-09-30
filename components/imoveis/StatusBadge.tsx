import { STATUS_IMOVEL } from "@/lib/constants/imoveis";
import { cn } from "@/lib/utils";
import type { StatusImovel, StatusImovelSlug } from "@/types";

const STATUS_COLORS: Record<StatusImovelSlug, string> = {
  em_cadastro: "#B8B8B8",
  aguardando_aprovacao: "#E07A52",
  disponivel: "#7D8750",
  reservado: "#C85D32",
  vendido: "#252522",
  locado: "#5F6840",
  desativado: "#9A9595",
  desativado_temporariamente: "#C4C0C0",
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
