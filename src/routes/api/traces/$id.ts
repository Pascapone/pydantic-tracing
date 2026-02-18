import { createFileRoute } from "@tanstack/react-router";
import {
  getTrace,
  getSpans,
  getSpanTree,
  tracesDbExists,
} from "@/lib/tracing/db";

export const Route = createFileRoute("/api/traces/$id")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
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
        const includeTree = url.searchParams.get("tree") === "true";

        // Get trace
        const trace = getTrace(params.id);
        if (!trace) {
          return Response.json(
            { error: "Trace not found", traceId: params.id },
            { status: 404 }
          );
        }

        // Get spans (flat or tree)
        let spans: unknown[];
        if (includeTree) {
          spans = getSpanTree(params.id);
        } else {
          const rawSpans = getSpans(params.id);
          spans = rawSpans.map((span) => ({
            ...span,
            attributes: safeJsonParse(span.attributes, {}),
            events: safeJsonParse(span.events, []),
          }));
        }

        // Parse metadata
        const metadata = safeJsonParse(trace.metadata, {});

        return Response.json({
          trace: {
            ...trace,
            metadata,
            spans,
          },
        });
      },
    },
  },
});

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) {
    return fallback;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
