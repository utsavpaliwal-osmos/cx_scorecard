// React Query hook — wraps fetchDashboardData() with caching, loading flags,
// and error state. Components just call useDashboardData() and read .data /
// .isLoading / .isError without thinking about fetch plumbing.
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/lib/api";
import type { DashboardData } from "@/types/scorecard";

export const DASHBOARD_QUERY_KEY = ["dashboard-data"] as const;

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardData,
    // staleTime: 0 means React Query treats data as immediately stale, so a
    // re-mount or page refresh re-fetches from /api/sheets.
    staleTime: 0,
  });
}
