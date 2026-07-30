import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ImovelStatsVariant = "card" | "detail" | "site-detail" | "detail-prominent";

const rowClass: Record<ImovelStatsVariant, string> = {
  card: "gap-x-2 text-xs text-muted-foreground",
  detail: "gap-x-3 text-sm text-muted-foreground",
  "site-detail": "gap-x-4 gap-y-2 text-base text-muted-foreground",
  "detail-prominent": "gap-x-8 gap-y-4 text-sm text-muted-foreground",
};

const itemClass: Record<ImovelStatsVariant, string> = {
  card: "gap-1",
  detail: "gap-1",
  "site-detail": "gap-1.5",
  "detail-prominent": "flex-col gap-2 text-center",
};

interface ImovelStatsRowProps {
  children: ReactNode;
  variant?: ImovelStatsVariant;
  className?: string;
}

export function ImovelStatsRow({
  children,
  variant = "card",
  className,
}: ImovelStatsRowProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        variant === "site-detail" || variant === "detail-prominent"
          ? "flex-wrap"
          : "flex-nowrap overflow-hidden",
        rowClass[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ImovelStatItemProps {
  icon: ReactNode;
  children: ReactNode;
  variant?: ImovelStatsVariant;
  className?: string;
}

export function ImovelStatItem({
  icon,
  children,
  variant = "card",
  className,
}: ImovelStatItemProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 whitespace-nowrap",
        variant === "detail-prominent" ? "items-center" : "items-center",
        itemClass[variant],
        className,
      )}
    >
      {icon}
      <span className={cn("leading-none", variant === "detail-prominent" && "text-foreground")}>
        {children}
      </span>
    </span>
  );
}
