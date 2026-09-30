import type { TemperaturaLead } from "@/types";
import { TEMPERATURA_LEAD_COLORS, TEMPERATURA_LEAD_LABELS } from "@/lib/constants/leads";
import { cn } from "@/lib/utils";

interface TemperaturaBadgeProps {
  temperatura: TemperaturaLead;
  className?: string;
  showLabel?: boolean;
}

export function TemperaturaBadge({
  temperatura,
  className,
  showLabel = true,
}: TemperaturaBadgeProps) {
  const color = TEMPERATURA_LEAD_COLORS[temperatura];
  const lightBg = temperatura === "frio" || temperatura === "indefinido";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        lightBg ? "text-foreground" : "text-white",
        className,
      )}
      style={{ backgroundColor: color }}
      title={TEMPERATURA_LEAD_LABELS[temperatura]}
    >
      {showLabel ? TEMPERATURA_LEAD_LABELS[temperatura] : null}
    </span>
  );
}
