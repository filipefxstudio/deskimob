"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  queueListingScrollRestore,
  readListingReturnState,
} from "@/lib/site/listing-return";
import { cn } from "@/lib/utils";

import { useSite } from "./SiteProvider";

interface SiteImovelDetalheBackButtonProps {
  fallbackHref?: string;
  className?: string;
}

export function SiteImovelDetalheBackButton({
  fallbackHref = "/imoveis",
  className,
}: SiteImovelDetalheBackButtonProps) {
  const router = useRouter();
  const { link } = useSite();

  function handleBack() {
    const stored = readListingReturnState();

    if (stored?.url) {
      queueListingScrollRestore(stored.scrollY);
      router.push(stored.url);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(link(fallbackHref));
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("mb-4 gap-2", className)}
      onClick={handleBack}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Voltar para a listagem
    </Button>
  );
}
