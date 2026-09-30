"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { useSidebarContext } from "@/components/dashboard/Sidebar";
import { cn } from "@/lib/utils";
import { dashboardNavItems, isDashboardNavActive } from "@/lib/dashboard/nav-items";

const mobileTabItems = dashboardNavItems.filter((item) => item.mobileTab);

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpen } = useSidebarContext();

  const configActive = pathname.startsWith("/dashboard/configuracoes");

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden"
      aria-label="Menu principal"
    >
      <ul className="grid h-14 grid-cols-6">
        {mobileTabItems.map(({ href, shortLabel, icon: Icon }) => {
          const isActive = isDashboardNavActive(pathname, href);

          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("size-5 shrink-0", isActive && "stroke-[2.25]")} />
                <span className="max-w-full truncate leading-none">{shortLabel}</span>
              </Link>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
              configActive
                ? "text-primary"
                : "text-muted-foreground hover:text-primary",
            )}
            aria-label="Abrir menu completo"
          >
            <Menu className={cn("size-5 shrink-0", configActive && "stroke-[2.25]")} />
            <span className="leading-none">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
