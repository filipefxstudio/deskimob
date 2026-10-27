interface DashboardSectionHeadingProps {
  title: string;
  description?: string;
}

export function DashboardSectionHeading({ title, description }: DashboardSectionHeadingProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
