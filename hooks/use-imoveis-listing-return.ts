"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import {
  queueListingScrollRestore,
  readListingReturnState,
} from "@/lib/site/listing-return";
import { queueListingStateRestore } from "@/lib/imoveis/listing-return-state";

export function useImoveisListingReturn(fallbackHref = "/dashboard/imoveis") {
  const router = useRouter();

  return useCallback(() => {
    const stored = readListingReturnState();

    if (stored?.url) {
      if (stored.listing) {
        queueListingStateRestore(stored.listing);
      }
      queueListingScrollRestore(stored.scrollY);
      router.push(stored.url);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }, [router, fallbackHref]);
}
