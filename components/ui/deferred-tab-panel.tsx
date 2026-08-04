"use client";

import type { ReactNode } from "react";

interface DeferredTabPanelProps {
  tabId: string;
  selectedTab: string;
  displayTab: string;
  isContentPending: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function DeferredTabPanel({
  tabId,
  selectedTab,
  displayTab,
  isContentPending,
  skeleton,
  children,
}: DeferredTabPanelProps) {
  if (selectedTab !== tabId) {
    return null;
  }

  if (isContentPending || displayTab !== tabId) {
    return skeleton;
  }

  return children;
}
