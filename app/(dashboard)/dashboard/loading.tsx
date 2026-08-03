import { DashboardPageSkeleton } from "@/components/ui/page-skeletons";

export default function Loading() {
  return (
    <div className="p-4 md:p-6">
      <DashboardPageSkeleton />
    </div>
  );
}
