// Home route ("/") — the only page in this app after cleanup.
// Server component: emits initial HTML on the server; the dashboard inside
// is a client component that fetches data after hydration.

import { Header } from "@/components/layout/Header";
import { ScoringDashboardTabContainer } from "@/components/tabs/ScoringDashboardTabContainer";

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col bg-background">
      <Header />
      <div className="px-8 py-8">
        <ScoringDashboardTabContainer />
      </div>
    </main>
  );
}
