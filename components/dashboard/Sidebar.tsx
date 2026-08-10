"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Building2,
  Calendar,
  LayoutDashboard,
  Menu,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";

import { AppHeader } from "@/components/dashboard/AppHeader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "fx-sidebar-collapsed";

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("Sidebar components must be used within DashboardShell");
  }
  return context;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar },
  { href: "/dashboard/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/dashboard/atendimentos", label: "Atendimentos", icon: Users },
  { href: "/dashboard/clientes", label: "Pessoas", icon: User },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
] as const;

interface DashboardShellProps {
  nome: string;
  slug: string;
  logoUrl?: string | null;
  children: ReactNode;
}

export function DashboardShell({ nome, slug, logoUrl, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ open, setOpen, collapsed, toggleCollapsed }}>
      <TooltipProvider delayDuration={0}>
        <div className="flex h-dvh flex-col overflow-hidden bg-background">
          <AppHeader nome={nome} slug={slug} logoUrl={logoUrl} />
          <SidebarPanel />
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col pt-10 transition-[margin] duration-200 ease-in-out",
              collapsed ? "md:ml-[52px]" : "md:ml-60",
            )}
          >
            <main
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
              data-dashboard-scroll
            >
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

function SidebarNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-lg font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-white/15 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarContent({ collapsed, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={cn(
          "shrink-0 border-b border-white/10 py-4",
          collapsed ? "px-2 text-center" : "px-5",
        )}
      >
        {collapsed ? (
          <p className="text-lg font-bold">DK</p>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">
              CRM Imobiliário
            </p>
            <p className="mt-1 text-lg font-bold">Deskimob</p>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 text-sm">
        {navItems.map(({ href, label, icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <SidebarNavLink
              key={href}
              href={href}
              label={label}
              icon={icon}
              isActive={isActive}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>
    </>
  );
}

function SidebarPanel() {
  const pathname = usePathname();
  const { open, setOpen, collapsed } = useSidebarContext();

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      <aside
        className={cn(
          "fixed top-10 left-0 z-40 hidden h-[calc(100vh-2.5rem)] flex-col bg-primary text-primary-foreground transition-[width] duration-200 ease-in-out md:flex",
          collapsed ? "w-[52px]" : "w-60",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={close}
          />
          <aside className="relative flex h-full w-60 max-w-[85vw] flex-col bg-primary text-primary-foreground shadow-xl">
            <button
              type="button"
              onClick={close}
              className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent collapsed={false} onNavigate={close} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

/** @deprecated Use AppHeader hamburger on mobile */
export function SidebarTrigger() {
  const { setOpen } = useSidebarContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-primary transition-colors hover:bg-muted md:hidden"
      aria-label="Abrir menu"
    >
      <Menu className="size-5" />
    </button>
  );
}
