import type { TipoCliente } from "@/types";
import { cn } from "@/lib/utils";

const tipoConfig: Record<
  TipoCliente,
  { label: string; className: string }
> = {
  lead: {
    label: "Lead",
    className: "bg-brand/15 text-brand",
  },
  proprietario: {
    label: "Proprietário",
    className: "bg-muted text-foreground",
  },
  ambos: {
    label: "Ambos",
    className: "bg-success/15 text-[color-mix(in_oklch,var(--success),black_30%)]",
  },
};

interface TipoClienteBadgeProps {
  tipo: TipoCliente;
  className?: string;
}

export function TipoClienteBadge({ tipo, className }: TipoClienteBadgeProps) {
  const config = tipoConfig[tipo];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
