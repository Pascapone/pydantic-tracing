/**
 * Trace Fetching Hooks
 *
 * React hooks for fetching and polling trace data from the API.
 * Provides hooks for:
 * - Listing traces with stats
 * - Fetching a single trace with polling
 * - Creating agent jobs
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export type TraceStatus = "UNSET" | "OK" | "ERROR";

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
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
  status: TraceStatus;
  status_message?: string;
  events: SpanEvent[];
  children?: Span[];
}

export interface Trace {
  id: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  status: TraceStatus;
  span_count: number;
  total_duration_ms: number;
  started_at: string;
  completed_at: string | null;
  spans?: Span[];
}

export interface TraceStats {
  trace_count: number;
  span_count: number;
  avg_duration_ms: number;
}

export interface LogEntry {
  id: string;
  level: "INFO" | "DEBUG" | "WARN" | "SUCCESS" | "ERROR";
  timestamp: Date;
  content: Record<string, unknown>;
}

export interface CreateAgentJobParams {
  agent: "research" | "coding" | "analysis" | "orchestrator";
  prompt: string;
  model?: string;
  userId?: string;
}

// ============================================================================
// useTraces - List traces with stats and polling
// ============================================================================

export interface UseTracesOptions {
  userId?: string;
  limit?: number;
  pollInterval?: number;
}

export interface UseTracesResult {
  traces: Trace[];
  stats: TraceStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTraces(options?: UseTracesOptions): UseTracesResult {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollInterval = options?.pollInterval ?? 5000;

  const fetchTraces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (options?.userId) params.set("userId", options.userId);
      if (options?.limit) params.set("limit", String(options.limit));

      const [tracesRes, statsRes] = await Promise.all([
        fetch(`/api/traces?${params}`),
        fetch("/api/traces?stats=true"),
      ]);

      if (tracesRes.ok) {
        const data = await tracesRes.json();
        setTraces(data.traces || []);
      } else {
        // If traces endpoint doesn't exist yet, set empty array
        setTraces([]);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      } else {
        // Default stats if endpoint doesn't exist yet
        setStats({
          trace_count: 0,
          span_count: 0,
          avg_duration_ms: 0,
        });
      }

      setError(null);
    } catch (err) {
      // Gracefully handle errors (e.g., API not yet available)
      if (err instanceof TypeError && err.message.includes("fetch")) {
        // Network error or API not available
        setTraces([]);
        setStats({
          trace_count: 0,
          span_count: 0,
          avg_duration_ms: 0,
        });
      } else {
        setError(err instanceof Error ? err : new Error("Failed to fetch traces"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [options?.userId, options?.limit]);

  useEffect(() => {
    fetchTraces();

    intervalRef.current = setInterval(fetchTraces, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTraces, pollInterval]);

  return { traces, stats, isLoading, error, refetch: fetchTraces };
}

// ============================================================================
// useTrace - Single trace with polling
// ============================================================================

export interface UseTraceOptions {
  pollInterval?: number;
  pollWhileRunning?: boolean;
}

export interface UseTraceResult {
  trace: Trace | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTrace(
  traceId: string | null,
  options?: UseTraceOptions
): UseTraceResult {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollInterval = options?.pollInterval ?? 2000;
  const pollWhileRunning = options?.pollWhileRunning ?? true;

  const fetchTrace = useCallback(async () => {
    if (!traceId) return;

    try {
      const res = await fetch(`/api/traces/${traceId}?tree=true`);
      if (res.ok) {
        const data = await res.json();
        setTrace(data.trace);
        setError(null);

        // Stop polling if trace is complete and pollWhileRunning is enabled
        if (
          pollWhileRunning &&
          data.trace?.status !== "UNSET" &&
          intervalRef.current
        ) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (res.status === 404) {
        setError(new Error("Trace not found"));
        setTrace(null);
      } else {
        setError(new Error("Failed to fetch trace"));
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        // Network error or API not available
        setTrace(null);
      } else {
        setError(err instanceof Error ? err : new Error("Failed to fetch trace"));
      }
    }
  }, [traceId, pollWhileRunning]);

  useEffect(() => {
    if (!traceId) {
      setTrace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchTrace().finally(() => setIsLoading(false));

    // Start polling
    intervalRef.current = setInterval(fetchTrace, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [traceId, fetchTrace, pollInterval]);

  return { trace, isLoading, error, refetch: fetchTrace };
}

// ============================================================================
// useCreateAgentJob - Create agent.run jobs
// ============================================================================

export interface UseCreateAgentJobResult {
  createJob: (params: CreateAgentJobParams) => Promise<string | null>;
  isLoading: boolean;
  error: Error | null;
}

export function useCreateAgentJob(): UseCreateAgentJobResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createJob = useCallback(
    async (params: CreateAgentJobParams): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "agent.run",
            payload: {
              agent: params.agent,
              prompt: params.prompt,
              model: params.model,
            },
            userId: params.userId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create job");
        }

        const data = await res.json();
        return data.jobId;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to create job"));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { createJob, isLoading, error };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert API Trace to TraceSummary format for TraceSidebar
 */
export function toTraceSummary(trace: Trace): {
  id: string;
  name: string;
  status: "active" | "done" | "error";
  preview: string;
  timestamp: Date;
  tokens: number;
} {
  const statusMap: Record<TraceStatus, "active" | "done" | "error"> = {
    UNSET: "active",
    OK: "done",
    ERROR: "error",
  };

  // Extract a preview from the first span or use the trace name
  const preview =
    trace.spans?.[0]?.attributes?.prompt?.toString().slice(0, 50) ||
    trace.spans?.[0]?.attributes?.["agent.prompt"]?.toString().slice(0, 50) ||
    trace.spans?.[0]?.name ||
    `Trace ${trace.id.slice(0, 8)}`;

  // Extract tokens from attributes if available
  const tokens =
    (trace.spans?.reduce((sum, span) => {
      const attrTokens = span.attributes?.tokens as number | undefined;
      return sum + (attrTokens || 0);
    }, 0) as number) || 0;

  return {
    id: trace.id,
    name: trace.name || trace.id.slice(0, 8),
    status: statusMap[trace.status],
    preview: preview.slice(0, 50),
    timestamp: new Date(trace.started_at),
    tokens,
  };
}

/**
 * Calculate stats from trace list
 */
export function calculateStatsFromTraces(traces: Trace[]): TraceStats {
  if (traces.length === 0) {
    return {
      trace_count: 0,
      span_count: 0,
      avg_duration_ms: 0,
    };
  }

  const totalSpans = traces.reduce((sum, t) => sum + t.span_count, 0);
  const totalDuration = traces.reduce((sum, t) => sum + t.total_duration_ms, 0);

  return {
    trace_count: traces.length,
    span_count: totalSpans,
    avg_duration_ms: totalDuration / traces.length,
  };
}
