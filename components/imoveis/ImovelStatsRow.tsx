import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ImovelStatsVariant = "card" | "detail" | "site-detail" | "detail-prominent" | "detail-card";

const rowClass: Record<ImovelStatsVariant, string> = {
  card: "gap-x-2 text-xs text-muted-foreground",
  detail: "gap-x-3 text-sm text-muted-foreground",
  "site-detail": "gap-x-4 gap-y-2 text-base text-muted-foreground",
  "detail-prominent":
    "flex-nowrap justify-between gap-x-1 text-sm text-muted-foreground sm:gap-x-3 md:gap-x-5 lg:gap-x-8",
  "detail-card": "gap-x-1.5 text-xs text-muted-foreground sm:gap-x-3 sm:text-sm md:gap-x-5 lg:gap-x-6",
};

const itemClass: Record<ImovelStatsVariant, string> = {
  card: "gap-1",
  detail: "gap-1",
  "site-detail": "gap-1.5",
  "detail-prominent": "min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:gap-2",
  "detail-card": "gap-1 sm:gap-1.5",
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
        variant === "site-detail" ? "flex-wrap" : "flex-nowrap",
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
        variant === "detail-prominent" ? "flex" : "inline-flex shrink-0",
        "whitespace-nowrap",
        variant === "detail-prominent" ? "items-center" : "items-center",
        itemClass[variant],
        className,
      )}
    >
      {icon}
      <span
        className={cn(
          "leading-tight",
          variant === "detail-prominent" && "whitespace-normal text-foreground",
        )}
      >
        {children}
      </span>
    </span>
  );
}
