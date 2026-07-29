import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ImovelStatsVariant = "card" | "detail" | "site-detail";

const rowClass: Record<ImovelStatsVariant, string> = {
  card: "gap-x-2 text-xs text-muted-foreground",
  detail: "gap-x-3 text-sm text-muted-foreground",
  "site-detail": "gap-x-4 text-base text-muted-foreground",
};

const itemClass: Record<ImovelStatsVariant, string> = {
  card: "gap-1",
  detail: "gap-1",
  "site-detail": "gap-1.5",
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
        "flex flex-nowrap items-center overflow-x-auto",
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
        "inline-flex shrink-0 items-center whitespace-nowrap",
        itemClass[variant],
        className,
      )}
    >
      {icon}
      <span className="leading-none">{children}</span>
    </span>
  );
}
