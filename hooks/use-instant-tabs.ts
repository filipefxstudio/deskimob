"use client";

import { useCallback, useState, useTransition } from "react";

export function useInstantTabs<T extends string>(initialTab: T) {
  const [selectedTab, setSelectedTab] = useState<T>(initialTab);
  const [displayTab, setDisplayTab] = useState<T>(initialTab);
  const [isPending, startTransition] = useTransition();

  const selectTab = useCallback(
    (tab: T) => {
      if (tab === selectedTab) {
        return;
      }

      setSelectedTab(tab);
      startTransition(() => {
        setDisplayTab(tab);
      });
    },
    [selectedTab],
  );

  const isContentPending = isPending || selectedTab !== displayTab;

  return {
    selectedTab,
    displayTab,
    selectTab,
    isContentPending,
  };
}
