import Link from "next/link";
import { Check, Circle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { OnboardingItem } from "@/lib/mock/dashboard";
import { cn } from "@/lib/utils";

interface OnboardingBannerProps {
  items: OnboardingItem[];
  siteHref?: string;
}

export function OnboardingBanner({ items, siteHref }: OnboardingBannerProps) {
  const concluidos = items.filter((item) => item.concluido).length;
  const total = items.length;
  const progresso = total > 0 ? (concluidos / total) * 100 : 0;

  if (concluidos === total) {
    return null;
  }

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand">Primeiros passos</p>
            <p className="mt-1 text-base font-semibold text-primary">
              Complete seu setup ({concluidos}/{total})
            </p>
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted sm:w-48">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {items.map((item) => {
            const href = item.id === "site" ? siteHref : item.href;
            const content = (
              <>
                {item.concluido ? (
                  <Check className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <span
                  className={cn(
                    "text-sm",
                    item.concluido ? "text-muted-foreground line-through" : "text-primary",
                  )}
                >
                  {item.label}
                </span>
              </>
            );

            if (href && !item.concluido) {
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    target={item.id === "site" ? "_blank" : undefined}
                    rel={item.id === "site" ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/60"
                  >
                    {content}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.id} className="inline-flex items-center gap-2 px-2 py-1">
                {content}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
