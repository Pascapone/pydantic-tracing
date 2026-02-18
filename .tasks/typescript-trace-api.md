# Task: TypeScript Trace API Routes

**Task ID:** typescript-trace-api
**Status:** Pending
**Created:** 2026-02-17
**Priority:** High

## Objective

Create TypeScript API routes to query trace data from the Python tracing SQLite database.

## Context

The Python tracing system stores traces in `traces.db` (SQLite). We need TypeScript endpoints to read this data for the frontend.

Reference the specification at `.specs/trace-integration.md` for data structures.

## Deliverables

1. Create `src/routes/api/traces/index.ts` - List traces endpoint
2. Create `src/routes/api/traces/$id.ts` - Get single trace endpoint
3. Create `src/lib/tracing/db.ts` - Database reader utility

## Requirements

### Database Reader (`src/lib/tracing/db.ts`)

Create a utility to read from `traces.db`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const TRACES_DB_PATH = path.join(process.cwd(), 'traces.db');

export interface TraceRow {
  id: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  request_id: string | null;
  metadata: string | null;  // JSON string
  started_at: string;
  completed_at: string | null;
  status: 'UNSET' | 'OK' | 'ERROR';
  span_count: number;
  total_duration_ms: number;
}

export interface SpanRow {
  id: string;
  trace_id: string;
  parent_id: string | null;
  name: string;
  kind: string;
  span_type: string | null;
  start_time: number;  // microseconds
  end_time: number | null;
  duration_us: number | null;
  attributes: string | null;  // JSON string
  status: 'UNSET' | 'OK' | 'ERROR';
  status_message: string | null;
  events: string | null;  // JSON string
  created_at: string;
}

export function getTracesDb(): Database.Database {
  return new Database(TRACES_DB_PATH);
}

export function listTraces(options: {
  userId?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}): TraceRow[] {
  // Query traces with optional filters
}

export function getTrace(traceId: string): TraceRow | null {
  // Get single trace
}

export function getSpans(traceId: string): SpanRow[] {
  // Get all spans for a trace
}

export function getSpanTree(traceId: string): SpanRow[] {
  // Get spans with children nested (build hierarchy)
}

export function getTraceStats(): {
  trace_count: number;
  span_count: number;
  avg_duration_ms: number;
} {
  // Get statistics
}
```

### API Route: GET /api/traces (`src/routes/api/traces/index.ts`)

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { listTraces, getTraceStats } from "@/lib/tracing/db";

export const Route = createFileRoute("/api/traces/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const sessionId = url.searchParams.get("sessionId");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        
        // If stats requested
        if (url.searchParams.get("stats") === "true") {
          const stats = getTraceStats();
          return Response.json({ stats });
        }
        
        const traces = listTraces({ userId, sessionId, limit, offset });
        return Response.json({ traces });
      },
    },
  },
});
```

### API Route: GET /api/traces/:id (`src/routes/api/traces/$id.ts`)

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { getTrace, getSpans, getSpanTree } from "@/lib/tracing/db";

export const Route = createFileRoute("/api/traces/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const url = new URL(request.url);
        const includeTree = url.searchParams.get("tree") === "true";
        
        const trace = getTrace(params.id);
        if (!trace) {
          return Response.json({ error: "Trace not found" }, { status: 404 });
        }
        
        const spans = includeTree ? getSpanTree(params.id) : getSpans(params.id);
        
        return Response.json({ 
          trace: {
            ...trace,
            spans
          } 
        });
      },
    },
  },
});
```

## JSON Parsing

Remember to parse JSON strings in the response:

```typescript
// For each span
{
  ...span,
  attributes: JSON.parse(span.attributes || '{}'),
  events: JSON.parse(span.events || '[]')
}
```

## Error Handling

- Return 404 if trace not found
- Return 500 if database error (file not found, etc.)
- Handle missing database gracefully

## Files to Reference

- `src/routes/api/jobs/index.ts` - Similar API pattern
- `src/db/db.ts` - Database setup pattern
- `python-workers/tracing/collector.py` - Database schema reference

## Acceptance Criteria

1. GET /api/traces returns list of traces
2. GET /api/traces/:id returns trace with spans
3. GET /api/traces?stats=true returns statistics
4. GET /api/traces/:id?tree=true returns nested span tree
5. Proper error handling for missing traces/database
6. JSON parsing for attributes and events
