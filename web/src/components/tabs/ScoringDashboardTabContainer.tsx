// Container component: handles data-fetching state (loading / error / success).
// Renders <ScoringDashboardTab /> only once data is available.
// This split keeps the visual component (ScoringDashboardTab) free of fetch logic.
"use client";

import { ScoringDashboardTab } from "@/components/tabs/ScoringDashboardTab";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { DashboardData } from "@/types/scorecard";

interface ScoringDashboardTabContainerProps {
  initialData?: DashboardData;
}

export function ScoringDashboardTabContainer({ initialData }: ScoringDashboardTabContainerProps) {
  const query = useDashboardData();

  const data = query.data ?? initialData;

  if (query.isError && !data) {
    return <DashboardError message={query.error instanceof Error ? query.error.message : "Failed to load dashboard data"} />;
  }

  if (query.isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) return <DashboardSkeleton />;

  return <ScoringDashboardTab data={data} />;
}

function DashboardSkeleton() {
  return (
    <section>
      <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-3 h-5 w-56" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="mb-2 text-base font-semibold text-destructive">
        Failed to load dashboard data
      </h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Verify your service-account credentials in <code>.env</code> and that the
        Google Sheet is shared with the service account email.
      </p>
    </section>
  );
}
