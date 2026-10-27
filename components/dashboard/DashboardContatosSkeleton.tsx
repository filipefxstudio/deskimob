import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardContatosSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {[0, 1].map((key) => (
        <Card key={key} className="border-border/80">
          <CardHeader className="pb-2">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-10 w-24 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted/70" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
