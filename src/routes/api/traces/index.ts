import { createFileRoute } from "@tanstack/react-router";
import {
  listTraces,
  getTraceStats,
  tracesDbExists,
} from "@/lib/tracing/db";

export const Route = createFileRoute("/api/traces/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Check if database exists
        if (!tracesDbExists()) {
          return Response.json(
            {
              error: "Traces database not found",
              message:
                "No traces.db file exists. Run a Python agent to create traces.",
            },
            { status: 404 }
          );
        }

        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const sessionId = url.searchParams.get("sessionId");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        // Return statistics if requested
        if (url.searchParams.get("stats") === "true") {
          const stats = getTraceStats();
          return Response.json({ stats });
        }

        // List traces with filters
        const traces = listTraces({
          userId,
          sessionId,
          limit,
          offset,
        });

        return Response.json({ traces });
      },
    },
  },
});
