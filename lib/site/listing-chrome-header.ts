"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/** Altura do header mobile (h-24). */
export const LISTING_MOBILE_HEADER_HEIGHT_PX = 96;

let headerVisible = true;
let lastScrollY = 0;
let lastToggleAt = 0;
let ticking = false;

const listeners = new Set<() => void>();

const HIDE_DELTA_PX = 16;
const SHOW_DELTA_PX = 12;
const MIN_SCROLL_TO_HIDE_PX = 120;
const TOP_REVEAL_PX = 24;
const TOGGLE_COOLDOWN_MS = 320;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setHeaderVisible(next: boolean, scrollY: number) {
  if (headerVisible === next) {
    return;
  }

  headerVisible = next;
  lastToggleAt = Date.now();
  lastScrollY = scrollY;
  emitChange();
}

function evaluateScroll(currentY: number) {
  const now = Date.now();
  if (now - lastToggleAt < TOGGLE_COOLDOWN_MS) {
    lastScrollY = currentY;
    return;
  }

  const delta = currentY - lastScrollY;

  if (currentY <= TOP_REVEAL_PX) {
    setHeaderVisible(true, currentY);
    return;
  }

  if (delta > HIDE_DELTA_PX && currentY > MIN_SCROLL_TO_HIDE_PX) {
    setHeaderVisible(false, currentY);
    return;
  }

  if (delta < -SHOW_DELTA_PX) {
    setHeaderVisible(true, currentY);
    return;
  }

  lastScrollY = currentY;
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
      lastToggleAt = 0;
      emitChange();
      return;
    }

    lastScrollY = window.scrollY;
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
