import {
  Building2,
  Calendar,
  LayoutDashboard,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Exibir na barra inferior do mobile (até 5 itens). */
  mobileTab?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Início",
    icon: LayoutDashboard,
    mobileTab: true,
  },
  {
    href: "/dashboard/imoveis",
    label: "Imóveis",
    shortLabel: "Imóveis",
    icon: Building2,
    mobileTab: true,
  },
  {
    href: "/dashboard/atendimentos",
    label: "Atendimentos",
    shortLabel: "Atend.",
    icon: Users,
    mobileTab: true,
  },
  {
    href: "/dashboard/agenda",
    label: "Agenda",
    shortLabel: "Agenda",
    icon: Calendar,
    mobileTab: true,
  },
  {
    href: "/dashboard/clientes",
    label: "Pessoas",
    shortLabel: "Pessoas",
    icon: User,
    mobileTab: true,
  },
  {
    href: "/dashboard/configuracoes",
    label: "Configurações",
    shortLabel: "Config.",
    icon: Settings,
    mobileTab: false,
  },
];

export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname.startsWith(href);
}
