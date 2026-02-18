# Task: React Trace Hooks and Integration

**Task ID:** react-trace-hooks
**Status:** Pending
**Created:** 2026-02-17
**Priority:** High

## Objective

Create React hooks for trace fetching and integrate all trace components with the job system.

## Context

We have created the trace API routes and UI components. Now we need hooks to fetch trace data and connect everything together.

## Deliverables

1. Create `src/lib/hooks/use-traces.ts` - Trace fetching hook
2. Create `src/routes/traces.tsx` - Traces page route
3. Update `src/routes/api/jobs/index.ts` - Add agent.run job type

## Requirements

### useTraces Hook

```typescript
// src/lib/hooks/use-traces.ts

import { useState, useEffect, useCallback } from 'react';

export interface Trace {
  id: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  status: 'UNSET' | 'OK' | 'ERROR';
  span_count: number;
  total_duration_ms: number;
  started_at: string;
  completed_at: string | null;
  spans?: Span[];
}

export interface Span {
  id: string;
  trace_id: string;
  parent_id: string | null;
  name: string;
  span_type: string | null;
  start_time: number;
  end_time: number | null;
  duration_us: number | null;
  attributes: Record<string, unknown>;
  status: 'UNSET' | 'OK' | 'ERROR';
  events: SpanEvent[];
  children?: Span[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export interface TraceStats {
  trace_count: number;
  span_count: number;
  avg_duration_ms: number;
}

// Hook for listing traces
export function useTraces(options?: {
  userId?: string;
  limit?: number;
  pollInterval?: number;
}) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTraces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (options?.userId) params.set('userId', options.userId);
      if (options?.limit) params.set('limit', String(options.limit));

      const [tracesRes, statsRes] = await Promise.all([
        fetch(`/api/traces?${params}`),
        fetch('/api/traces?stats=true')
      ]);

      if (tracesRes.ok) {
        const data = await tracesRes.json();
        setTraces(data.traces);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch traces'));
    } finally {
      setIsLoading(false);
    }
  }, [options?.userId, options?.limit]);

  useEffect(() => {
    fetchTraces();

    if (options?.pollInterval) {
      const interval = setInterval(fetchTraces, options.pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTraces, options?.pollInterval]);

  return { traces, stats, isLoading, error, refetch: fetchTraces };
}

// Hook for single trace with polling
export function useTrace(traceId: string | null, options?: {
  pollInterval?: number;
  pollWhileRunning?: boolean;
}) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrace = useCallback(async () => {
    if (!traceId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/traces/${traceId}?tree=true`);
      if (res.ok) {
        const data = await res.json();
        setTrace(data.trace);
      } else {
        setError(new Error('Trace not found'));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch trace'));
    } finally {
      setIsLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    fetchTrace();

    if (options?.pollInterval && traceId) {
      const interval = setInterval(() => {
        // Only poll if trace is still running
        if (options.pollWhileRunning && trace?.status === 'UNSET') {
          fetchTrace();
        } else if (!options.pollWhileRunning) {
          fetchTrace();
        }
      }, options.pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTrace, options?.pollInterval, options?.pollWhileRunning, trace?.status, traceId]);

  return { trace, isLoading, error, refetch: fetchTrace };
}

// Hook for creating agent jobs
export function useCreateAgentJob() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createJob = useCallback(async (params: {
    agent: 'research' | 'coding' | 'analysis' | 'orchestrator';
    prompt: string;
    model?: string;
    userId?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'agent.run',
          payload: {
            agent: params.agent,
            prompt: params.prompt,
            model: params.model,
          },
          userId: params.userId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create job');
      }

      const data = await res.json();
      return data.jobId;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create job'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { createJob, isLoading, error };
}
```

### Traces Page Route

Create a page that uses all components:

```typescript
// src/routes/traces.tsx

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
      <div className="min-h-screen bg-[#101d22] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#11a4d4]" />
      </div>
    );
  }

  return <TraceTerminal userId={session?.user?.id} />;
}
```

### Update Jobs API

Add `agent.run` to valid job types in `src/routes/api/jobs/index.ts`:

```typescript
const validTypes = [
  "ai.generate_text",
  "ai.generate_image",
  "ai.analyze_data",
  "ai.embeddings",
  "data.process",
  "data.transform",
  "data.export",
  "custom",
  "agent.run",  // ADD THIS
];
```

## Integration Flow

1. User opens `/traces` page
2. `TraceTerminal` renders with empty state
3. User can:
   - Select existing trace from sidebar
   - Create new agent job
4. When job completes, `trace_id` is in result
5. Frontend polls `/api/traces/:id` for trace data
6. Timeline updates in real-time

## Files to Reference

- `src/lib/hooks/use-jobs.ts` - Similar hook pattern
- `src/routes/dashboard.tsx` - Similar page pattern
- `.specs/trace-integration.md` - API specifications

## Acceptance Criteria

1. useTraces hook fetches trace list and stats
2. useTrace hook fetches single trace with polling
3. useCreateAgentJob creates agent.run jobs
4. Traces page renders TraceTerminal
5. Jobs API accepts agent.run type
6. Polling works for running traces
7. Error states handled gracefully
