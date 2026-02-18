/**
 * Trace Components Index
 * 
 * Exports all tracing-related React components.
 */

export { TraceTerminal } from "./TraceTerminal";
export { TraceHeader } from "./TraceHeader";
export { TraceSidebar } from "./TraceSidebar";
export type { TraceSummary } from "./TraceSidebar";
export { TraceStats } from "./TraceStats";
export type { TraceStatsData } from "./TraceStats";

// Timeline and Log Components
export { SpanNode } from "./SpanNode";
export { TraceTimeline } from "./TraceTimeline";
export { TraceLogStream } from "./TraceLogStream";

// Re-export types for convenience
export type {
  Span,
  Trace,
  LogEntry,
  SpanType,
  SpanStatus,
  LogLevel,
  TraceStats as TraceStatsType,
  SpanNodeProps,
  TraceTimelineProps,
  TraceLogStreamProps,
} from "@/types/tracing";
