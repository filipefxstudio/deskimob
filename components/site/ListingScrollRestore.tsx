"use client";

import { useEffect } from "react";

import { consumeListingScrollRestore } from "@/lib/site/listing-return";

export function ListingScrollRestore() {
  useEffect(() => {
    const scrollY = consumeListingScrollRestore();
    if (scrollY === null) {
      return;
    }

    const restore = () => {
      window.scrollTo({ top: scrollY, left: 0 });
    };

    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  }, []);

  return null;
}
