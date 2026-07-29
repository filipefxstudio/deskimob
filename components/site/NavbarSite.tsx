"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useListingChromeHeader } from "@/lib/site/listing-chrome-header";
import { cn } from "@/lib/utils";

import { useSite } from "./SiteProvider";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Início" },
  { href: "/comprar", label: "Comprar" },
  { href: "/alugar", label: "Alugar", requiresLocacao: true },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
] as const;

export function NavbarSite() {
  const { corretor, link, hasImoveisLocacao } = useSite();
  const [open, setOpen] = useState(false);
  const { enabled: chromeHeaderEnabled, headerVisible } = useListingChromeHeader();

  const navItems = BASE_NAV_ITEMS.filter(
    (item) => !("requiresLocacao" in item && item.requiresLocacao) || hasImoveisLocacao,
  );

  return (
    <header
      className={cn(
        "z-40 border-b border-white/10 bg-primary text-white transition-transform duration-300",
        chromeHeaderEnabled
          ? "fixed inset-x-0 top-0 lg:sticky lg:top-0"
          : "sticky top-0",
        chromeHeaderEnabled && !headerVisible && "-translate-y-full lg:translate-y-0",
      )}
      style={{ backgroundColor: "var(--color-primary)" }}
    >
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={link("/")} className="flex min-w-0 items-center gap-3">
          {corretor.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={corretor.logo_url}
              alt={corretor.nome}
              className="max-h-14 max-w-[180px] object-contain"
            />
          ) : corretor.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={corretor.foto_url}
              alt={corretor.nome}
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: "var(--color-secondary)" }}
            >
              {corretor.nome.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={link(item.href)}
              className="text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              {item.label}
            </Link>
          ))}
          <Button
            asChild
            size="sm"
            className="text-white hover:opacity-90"
            style={{ backgroundColor: "var(--color-secondary)" }}
          >
            <Link href={link("/avaliar")}>Avaliar Imóvel</Link>
          </Button>
        </nav>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/10 lg:hidden",
          open ? "block" : "hidden",
        )}
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <nav className="flex flex-col gap-1 px-4 py-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={link(item.href)}
              className="rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href={link("/avaliar")}
            className="mt-2 inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--color-secondary)" }}
            onClick={() => setOpen(false)}
          >
            Avaliar Imóvel
          </Link>
        </nav>
      </div>
    </header>
  );
}
