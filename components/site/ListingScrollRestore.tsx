"use client";

import { useEffect } from "react";

import { consumeListingScrollRestore, restoreListingScrollPosition } from "@/lib/site/listing-return";

const RETRY_DELAYS_MS = [0, 50, 150, 300, 600];

export function ListingScrollRestore() {
  useEffect(() => {
    const scrollY = consumeListingScrollRestore();
    if (scrollY === null) {
      return;
    }

    for (const delay of RETRY_DELAYS_MS) {
      window.setTimeout(() => {
        restoreListingScrollPosition(scrollY);
      }, delay);
    }
  }, []);

  return null;
}
