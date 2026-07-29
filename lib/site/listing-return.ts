export const LISTING_RETURN_STORAGE_KEY = "deskimob:listing-return";
export const LISTING_SCROLL_RESTORE_KEY = "deskimob:listing-scroll-restore";

export type ListingReturnState = {
  url: string;
  scrollY: number;
};

export function saveListingReturnState(url: string, scrollY: number): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: ListingReturnState = { url, scrollY };
  sessionStorage.setItem(LISTING_RETURN_STORAGE_KEY, JSON.stringify(payload));
}

export function readListingReturnState(): ListingReturnState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(LISTING_RETURN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ListingReturnState;
    if (typeof parsed.url === "string" && typeof parsed.scrollY === "number") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function queueListingScrollRestore(scrollY: number): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(LISTING_SCROLL_RESTORE_KEY, String(Math.max(0, Math.round(scrollY))));
}

export function consumeListingScrollRestore(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(LISTING_SCROLL_RESTORE_KEY);
  sessionStorage.removeItem(LISTING_SCROLL_RESTORE_KEY);

  if (!raw) {
    return null;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}
