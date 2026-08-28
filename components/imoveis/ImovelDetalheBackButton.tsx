"use client";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useImoveisListingReturn } from "@/hooks/use-imoveis-listing-return";

interface ImovelDetalheBackButtonProps {
  fallbackHref?: string;
}

export function ImovelDetalheBackButton({
  fallbackHref = "/dashboard/imoveis",
}: ImovelDetalheBackButtonProps) {
  const handleBack = useImoveisListingReturn(fallbackHref);

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
