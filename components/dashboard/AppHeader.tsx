"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  HousePlus,
  Menu,
  Search,
  UserRound,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { NovoAtendimentoTrigger } from "@/components/atendimentos/NovoAtendimentoTrigger";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useSidebarContext } from "@/components/dashboard/Sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  nome: string;
  slug: string;
  logoUrl?: string | null;
}

type SearchTarget = "imovel" | "atendimento";

export function AppHeader({ nome, slug, logoUrl }: AppHeaderProps) {
  const router = useRouter();
  const { collapsed, toggleCollapsed, setOpen } = useSidebarContext();
  const primeiroNome = nome.split(" ")[0] ?? nome;
  const siteUrl = slug ? `/${slug}` : null;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>("imovel");
  const [searchTerm, setSearchTerm] = useState("");

  function handleMenuClick() {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setOpen(true);
      return;
    }
    toggleCollapsed();
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const termo = searchTerm.trim();
    if (!termo) return;

    const base =
      searchTarget === "imovel"
        ? "/dashboard/imoveis"
        : "/dashboard/atendimentos";
    router.push(`${base}?busca=${encodeURIComponent(termo)}`);
    setSearchOpen(false);
    setSearchTerm("");
  }

  return (
    <header className="fixed top-0 right-0 left-0 z-50 flex h-10 items-center justify-between border-b border-border bg-white px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={handleMenuClick}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-muted"
          aria-label={
            collapsed ? "Expandir menu lateral" : "Recolher menu lateral"
          }
        >
          {collapsed ? (
            <Menu className="size-4" />
          ) : (
            <>
              <ArrowLeft className="hidden size-4 md:block" />
              <Menu className="size-4 md:hidden" />
            </>
          )}
        </button>

        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="max-h-7 w-auto max-w-[120px] object-contain"
          />
        ) : (
          <span className="truncate text-sm font-semibold text-primary">Deskimob</span>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden items-center gap-1 sm:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild className="relative">
                <Link href="/dashboard/imoveis/novo" aria-label="Novo imóvel">
                  <HousePlus className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Novo imóvel</TooltipContent>
          </Tooltip>

          <NovoAtendimentoTrigger variant="icon" />
        </div>

        <DropdownMenu open={searchOpen} onOpenChange={setSearchOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Buscar"
              className="shrink-0"
            >
              <Search className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3" onCloseAutoFocus={(e) => e.preventDefault()}>
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div>
                <Label htmlFor="header-search-target">Buscar em</Label>
                <Select
                  value={searchTarget}
                  onValueChange={(value) => setSearchTarget(value as SearchTarget)}
                >
                  <SelectTrigger id="header-search-target" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imovel">Imóvel</SelectItem>
                    <SelectItem value="atendimento">Atendimento / Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="header-search-term">Palavra-chave</Label>
                <Input
                  id="header-search-term"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Código, nome, bairro…"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" size="sm">
                Buscar
              </Button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md px-2 text-sm text-primary transition-colors hover:bg-muted",
              )}
            >
              <UserRound className="size-4 shrink-0" />
              <span className="truncate">{primeiroNome}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/dashboard/configuracoes?aba=perfil">Meu perfil</Link>
            </DropdownMenuItem>
            {siteUrl ? (
              <DropdownMenuItem asChild>
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  Ver meu site
                  <ExternalLink className="ml-auto size-3.5 opacity-60" />
                </a>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="p-0">
              <LogoutButton className="h-auto w-full justify-start rounded-none px-2 py-1.5 font-normal hover:bg-muted" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
