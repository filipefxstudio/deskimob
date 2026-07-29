"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

let headerVisible = true;
let lastScrollY = 0;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function isListingChromeHeaderPath(pathname: string): boolean {
  return /\/(imoveis|comprar|alugar)(\/|$)/.test(pathname);
}

export function subscribeListingHeaderVisible(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getListingHeaderVisibleSnapshot() {
  return headerVisible;
}

export function useListingChromeHeader() {
  const pathname = usePathname();
  const enabled = isListingChromeHeaderPath(pathname ?? "");

  useEffect(() => {
    if (!enabled) {
      headerVisible = true;
      lastScrollY = 0;
      emitChange();
      return;
    }

    function onScroll() {
      const currentY = window.scrollY;

      if (currentY <= 16) {
        if (!headerVisible) {
          headerVisible = true;
          emitChange();
        }
      } else if (currentY > lastScrollY + 6) {
        if (headerVisible) {
          headerVisible = false;
          emitChange();
        }
      } else if (currentY < lastScrollY - 6) {
        if (!headerVisible) {
          headerVisible = true;
          emitChange();
        }
      }

      lastScrollY = currentY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  const visible = useSyncExternalStore(
    subscribeListingHeaderVisible,
    getListingHeaderVisibleSnapshot,
    () => true,
  );

  return { enabled, headerVisible: visible };
}
