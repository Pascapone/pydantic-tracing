/**
 * Traces Page Route
 *
 * Main page for viewing and managing agent execution traces.
 * Uses the TraceTerminal component for the three-panel layout.
 */

import { createFileRoute } from "@tanstack/react-router";
import { TraceTerminal } from "@/components/tracing/TraceTerminal";
import { useSession } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/traces")({
  component: TracesPage,
});

function TracesPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  // TraceTerminal uses demo data for now
  // TODO: Integrate with useTraces hook when API endpoints are ready
  // Update: TraceTerminal now uses real hooks, we need to pass userId
  return <TraceTerminal userId={session?.user?.id} />;
}
