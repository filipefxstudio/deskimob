"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  queueListingScrollRestore,
  readListingReturnState,
} from "@/lib/site/listing-return";

interface ImovelDetalheBackButtonProps {
  fallbackHref?: string;
}

export function ImovelDetalheBackButton({
  fallbackHref = "/dashboard/imoveis",
}: ImovelDetalheBackButtonProps) {
  const router = useRouter();

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

    router.push(fallbackHref);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleBack}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Voltar para a listagem
    </Button>
  );
}
