/**
 * TraceTerminal Component
 * 
 * Main container component for the Trace Terminal UI.
 * Implements a three-column layout with:
 * - Left Sidebar (w-80): Stats and trace list
 * - Center Panel (flex-1): Timeline visualization
 * - Right Sidebar (w-96): Raw log stream
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { TraceHeader } from "./TraceHeader";
import { TraceSidebar, type TraceSummary } from "./TraceSidebar";
import type { TraceStatsData } from "./TraceStats";
import { TraceTimeline } from "./TraceTimeline";
import { TraceLogStream } from "./TraceLogStream";
import {
  useTraces,
  useTrace,
  useCreateAgentJob,
  toTraceSummary,
  type Trace,
  type Span,
  type LogEntry,
} from "@/lib/hooks/use-traces";
import { useTracesSubscription } from "@/lib/hooks/use-trace-websocket";
import type { TraceRow } from "@/lib/tracing/db";
import type { Trace as TimelineTrace, Span as TimelineSpan } from "@/types/tracing";

interface TraceTerminalProps {
  jobId?: string;
  traceId?: string;
  userId?: string;
  onTraceSelect?: (id: string) => void;
}

/**
 * Convert TraceRow (from WebSocket/db) to Trace format (used by hooks)
 */
function traceRowToTrace(row: TraceRow): Trace {
  return {
    id: row.id,
    name: row.name,
    user_id: row.user_id,
    session_id: row.session_id,
    status: row.status,
    span_count: row.span_count,
    total_duration_ms: row.total_duration_ms,
    started_at: row.started_at,
    completed_at: row.completed_at,
    spans: [], // WebSocket updates don't include spans, will be fetched separately
  };
}

// Convert API Trace to Timeline Trace format
function adaptTraceForTimeline(trace: Trace | null): TimelineTrace | null {
  if (!trace) return null;

  return {
    id: trace.id,
    name: trace.name,
    status: trace.status,
    spans: (trace.spans || []).map(adaptSpan),
    startedAt: new Date(trace.started_at),
    completedAt: trace.completed_at ? new Date(trace.completed_at) : undefined,
    totalDurationMs: trace.total_duration_ms,
  };
}

function adaptSpan(span: Span): TimelineSpan {
  return {
    id: span.id,
    parentId: span.parent_id || undefined,
    name: span.name,
    spanType: (span.span_type as TimelineSpan["spanType"]) || "agent.run",
    startTime: span.start_time,
    endTime: span.end_time || undefined,
    durationUs: span.duration_us || undefined,
    attributes: span.attributes,
    status: span.status,
    statusMessage: span.status_message || undefined,
    events: span.events,
    children: span.children?.map(adaptSpan),
  };
}

function flattenSpans(spans: Span[]): Span[] {
  return spans.flatMap((span) => [span, ...(span.children ? flattenSpans(span.children) : [])]);
}

// Convert spans to log entries
function spansToLogs(trace: Trace | null): LogEntry[] {
  if (!trace?.spans) return [];

  const logs: LogEntry[] = [];
  const allSpans = flattenSpans(trace.spans).sort((a, b) => a.start_time - b.start_time);

  // Add trace start log
  logs.push({
    id: `trace-start-${trace.id}`,
    level: "INFO",
    timestamp: new Date(trace.started_at),
    content: {
      event: "trace_start",
      id: trace.id,
      name: trace.name,
    },
  });

  // Add logs for each span
  allSpans.forEach((span) => {
    const level = span.status === "ERROR" ? "ERROR" : span.status === "OK" ? "SUCCESS" : "INFO";

    // Span start
    logs.push({
      id: `span-start-${span.id}`,
      level,
      timestamp: new Date(span.start_time / 1000),
      content: {
        event: "span_start",
        span_id: span.id,
        name: span.name,
        type: span.span_type,
      },
    });

    // Span events
    span.events?.forEach((event, idx) => {
      logs.push({
        id: `event-${span.id}-${idx}`,
        level: "INFO",
        timestamp: new Date(event.timestamp / 1000),
        content: {
          event: event.name,
          ...event.attributes,
        },
      });
    });

    // Span end
    if (span.end_time) {
      logs.push({
        id: `span-end-${span.id}`,
        level: span.status === "ERROR" ? "ERROR" : "SUCCESS",
        timestamp: new Date(span.end_time / 1000),
        content: {
          event: "span_end",
          span_id: span.id,
          duration_us: span.duration_us,
          status: span.status,
        },
      });
    }
  });

  // Add trace end log
  if (trace.completed_at) {
    logs.push({
      id: `trace-end-${trace.id}`,
      level: trace.status === "ERROR" ? "ERROR" : "SUCCESS",
      timestamp: new Date(trace.completed_at),
      content: {
        event: "trace_end",
        id: trace.id,
        status: trace.status,
        duration_ms: trace.total_duration_ms,
      },
    });
  }

  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function TraceTerminal({
  traceId: initialTraceId,
  userId,
  onTraceSelect,
}: TraceTerminalProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "traces" | "settings">("traces");
  const [searchValue, setSearchValue] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>(initialTraceId);
  const [isLogPaused, setIsLogPaused] = useState(false);

  // Track WebSocket updates separately to merge with polled traces
  const [wsTraces, setWsTraces] = useState<Map<string, Trace>>(new Map());

  // Fetch traces list with polling
  const { traces, stats, isLoading: tracesLoading, refetch: refetchTraces } = useTraces({
    userId,
    limit: 50,
    pollInterval: 5000,
  });

  // WebSocket subscription for real-time updates
  const { isConnected } = useTracesSubscription({
    onTraceCreated: (traceRow: TraceRow) => {
      const trace = traceRowToTrace(traceRow);
      setWsTraces((prev) => {
        const next = new Map(prev);
        next.set(trace.id, trace);
        return next;
      });
    },
    onTraceUpdated: (traceRow: TraceRow) => {
      const trace = traceRowToTrace(traceRow);
      setWsTraces((prev) => {
        const next = new Map(prev);
        next.set(trace.id, trace);
        return next;
      });
    },
  });

  // Merge polled traces with WebSocket updates
  // WebSocket updates take precedence for traces that exist in both
  const mergedTraces = useMemo(() => {
    const traceMap = new Map<string, Trace>();

    // Start with polled traces
    for (const trace of traces) {
      traceMap.set(trace.id, trace);
    }

    // Overlay WebSocket updates (these have priority)
    for (const [id, trace] of wsTraces) {
      // Only use WebSocket trace if it doesn't exist in polled data,
      // or if we want to prefer the WebSocket version
      if (!traceMap.has(id)) {
        traceMap.set(id, trace);
      }
    }

    // Convert back to array and sort by started_at
    return Array.from(traceMap.values()).sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
  }, [traces, wsTraces]);

  // Fetch selected trace with polling
  const { trace } = useTrace(selectedTraceId || null, {
    pollInterval: 2000,
    pollWhileRunning: true,
  });

  // Create agent job
  const { createJob } = useCreateAgentJob();

  // Convert traces to sidebar format (use merged traces for real-time updates)
  const traceSummaries: TraceSummary[] = useMemo(() => {
    return mergedTraces.map(toTraceSummary);
  }, [mergedTraces]);

  // Convert stats to sidebar format (use merged traces for real-time updates)
  const sidebarStats: TraceStatsData = useMemo(() => {
    const hasRunning = mergedTraces.some((t) => t.status === "UNSET");
    return {
      status: hasRunning ? "running" : "idle",
      latency: Math.round(stats?.avg_duration_ms || 0),
      latencyChange: 0,
      tokenBudget: {
        used: mergedTraces.reduce((sum, t) => sum + (t.span_count * 100), 0),
        total: 4000,
      },
    };
  }, [stats, mergedTraces]);

  // Adapt trace for timeline
  const adaptedTrace = useMemo(() => adaptTraceForTimeline(trace), [trace]);

  // Convert spans to logs
  const logs = useMemo(() => spansToLogs(trace), [trace]);

  // Check if trace is streaming (status = UNSET)
  const isStreaming = trace?.status === "UNSET";

  // Handle trace selection
  const handleTraceSelect = useCallback((id: string) => {
    setSelectedTraceId(id);
    onTraceSelect?.(id);
  }, [onTraceSelect]);

  // Handle search
  const handleSearch = useCallback((id: string) => {
    if (id) {
      // Try to find trace by ID (use merged traces for real-time updates)
      const found = mergedTraces.find((t) => t.id.startsWith(id));
      if (found) {
        setSelectedTraceId(found.id);
      }
    }
  }, [mergedTraces]);

  // Handle expand all
  const handleExpandAll = useCallback(() => {
    // Expand all is handled inside TraceTimeline
  }, []);

  // Handle re-run
  const handleRerun = useCallback(async () => {
    if (!trace) return;

    // Extract agent type from trace name
    const agentType = trace.name.replace("agent_", "") as "research" | "coding" | "analysis" | "orchestrator";

    // Find original prompt from first span
    const firstSpan = trace.spans?.[0];
    const prompt = (firstSpan?.attributes?.prompt as string) || "Rerun agent";

    await createJob({
      agent: agentType,
      prompt,
      userId,
    });

    // Poll for new trace after a delay
    setTimeout(() => {
      refetchTraces();
    }, 1000);
  }, [trace, createJob, userId, refetchTraces]);

  // Handle download logs
  const handleDownloadLogs = useCallback(() => {
    // Log download is handled inside TraceLogStream
  }, []);

  // Update search when trace is selected
  useEffect(() => {
    if (selectedTraceId) {
      setSearchValue(selectedTraceId.slice(0, 8));
    }
  }, [selectedTraceId]);

  return (
    <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      {/* Top Navigation */}
      <TraceHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value);
          handleSearch(value);
        }}
        isConnected={isConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Trace List & Stats */}
        <TraceSidebar
          traces={traceSummaries}
          selectedId={selectedTraceId}
          stats={sidebarStats}
          onSelect={handleTraceSelect}
          isLoading={tracesLoading}
        />

        {/* Center: Visual Trace Timeline */}
        <TraceTimeline
          trace={adaptedTrace}
          isStreaming={isStreaming}
          onExpandAll={handleExpandAll}
          onRerun={handleRerun}
        />

        {/* Right Sidebar: Raw Log Stream */}
        <TraceLogStream
          logs={logs}
          isPaused={isLogPaused}
          isStreaming={isStreaming}
          onPauseToggle={() => setIsLogPaused(!isLogPaused)}
          onDownload={handleDownloadLogs}
        />
      </main>
    </div>
  );
}

export default TraceTerminal;
