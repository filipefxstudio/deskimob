"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/** Altura do header mobile (h-24). */
export const LISTING_MOBILE_HEADER_HEIGHT_PX = 96;

let headerOffset = 0;
let lastScrollY = 0;
let ticking = false;

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function clampOffset(value: number) {
  return Math.max(0, Math.min(LISTING_MOBILE_HEADER_HEIGHT_PX, value));
}

function evaluateScroll(currentY: number) {
  if (window.innerWidth >= 1024) {
    if (headerOffset !== 0) {
      headerOffset = 0;
      emitChange();
    }
    lastScrollY = currentY;
    return;
  }

  const delta = currentY - lastScrollY;

  if (currentY <= 0) {
    headerOffset = 0;
  } else {
    headerOffset = clampOffset(headerOffset + delta);
  }

  lastScrollY = currentY;
  emitChange();
}

function onScrollFrame() {
  ticking = false;
  evaluateScroll(window.scrollY);
}

function onScroll() {
  if (ticking) {
    return;
  }

  ticking = true;
  window.requestAnimationFrame(onScrollFrame);
}

export function isListingChromeHeaderPath(pathname: string): boolean {
  return /\/(imoveis|comprar|alugar)(\/|$)/.test(pathname);
}

export function subscribeListingHeaderOffset(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getListingHeaderOffsetSnapshot() {
  return headerOffset;
}

export function useListingChromeHeader() {
  const pathname = usePathname();
  const enabled = isListingChromeHeaderPath(pathname ?? "");

  useEffect(() => {
    if (!enabled) {
      headerOffset = 0;
      lastScrollY = 0;
      emitChange();
      return;
    }

    lastScrollY = window.scrollY;
    headerOffset = 0;
    emitChange();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled]);

  const offset = useSyncExternalStore(
    subscribeListingHeaderOffset,
    getListingHeaderOffsetSnapshot,
    () => 0,
  );

  return {
    enabled,
    headerOffset: offset,
    headerVisible: offset < LISTING_MOBILE_HEADER_HEIGHT_PX / 2,
  };
}
