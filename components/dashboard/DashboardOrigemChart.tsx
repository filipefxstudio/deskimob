"use client";

import { DashboardHorizontalBarChart } from "@/components/dashboard/DashboardHorizontalBarChart";
import type { DashboardBarItem } from "@/lib/actions/dashboard";

interface DashboardOrigemChartProps {
  items: DashboardBarItem[];
}

export function DashboardOrigemChart({ items }: DashboardOrigemChartProps) {
  return (
    <DashboardHorizontalBarChart title="Origem dos leads" items={items} emptyMessage="Sem leads ativos." />
  );
}
