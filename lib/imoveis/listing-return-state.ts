import type { ImoveisFilterState } from "@/lib/imoveis/filter-state";
import type { ImoveisSortOption, ImoveisViewMode } from "@/lib/imoveis/sort-options";

export type DashboardListingSnapshot = {
  search: string;
  filters: ImoveisFilterState;
  sort: ImoveisSortOption;
  viewMode: ImoveisViewMode;
  filtersOpen: boolean;
};

export const LISTING_SNAPSHOT_KEY = "deskimob:listing-snapshot";
export const LISTING_STATE_RESTORE_KEY = "deskimob:listing-state-restore";

export function persistListingSnapshot(snapshot: DashboardListingSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(LISTING_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function readListingSnapshot(): DashboardListingSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(LISTING_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DashboardListingSnapshot;
  } catch {
    return null;
  }
}

export function queueListingStateRestore(snapshot: DashboardListingSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(LISTING_STATE_RESTORE_KEY, JSON.stringify(snapshot));
}

export function consumeListingStateRestore(): DashboardListingSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(LISTING_STATE_RESTORE_KEY);
  sessionStorage.removeItem(LISTING_STATE_RESTORE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DashboardListingSnapshot;
  } catch {
    return null;
  }
}
