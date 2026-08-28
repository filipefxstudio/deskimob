"use client";

import { useEffect } from "react";

import { consumeListingScrollRestore, restoreListingScrollPosition } from "@/lib/site/listing-return";

export function ListingScrollRestore() {
  useEffect(() => {
    const scrollY = consumeListingScrollRestore();
    if (scrollY === null) {
      return;
    }

    const restore = () => {
      restoreListingScrollPosition(scrollY);
    };

    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }, []);

  return null;
}
