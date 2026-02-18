/**
 * Type definitions for the Trace Terminal
 * Based on .specs/trace-integration.md
 */

// Span types that represent different stages of agent execution
export type SpanType =
  | 'agent.run'
  | 'tool.call'
  | 'tool.result'
  | 'model.request'
  | 'model.response'
  | 'model.reasoning'
  | 'agent.delegation'
  | 'user.prompt'
  | 'user_input';

// Span status values
export type SpanStatus = 'UNSET' | 'OK' | 'ERROR';

// Log levels for trace log stream
export type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'SUCCESS' | 'ERROR';

// Trace status (same as span status)
export type TraceStatus = SpanStatus;

/**
 * Event that occurred during a span's lifetime
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

/**
 * Individual span representing a unit of work in a trace
 */
export interface Span {
  id: string;
  parentId?: string;
  name: string;
  spanType: SpanType;
  startTime: number;  // microseconds since epoch
  endTime?: number;
  durationUs?: number;
  attributes: Record<string, unknown>;
  status: SpanStatus;
  events: SpanEvent[];
  children?: Span[];
}

/**
 * Complete trace with all spans
 */
export interface Trace {
  id: string;
  name: string;
  status: TraceStatus;
  spans: Span[];
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs: number;
}

/**
 * Log entry in the raw log stream
 */
export interface LogEntry {
  id: string;
  level: LogLevel;
  timestamp: Date;
  content: Record<string, unknown>;
}

/**
 * Summary of a trace for list display
 */
export interface TraceSummary {
  id: string;
  name: string;
  status: 'active' | 'done' | 'error';
  preview: string;
  timestamp: Date;
  tokens: number;
}

/**
 * Stats for the trace sidebar
 */
export interface TraceStats {
  status: 'running' | 'idle';
  latency: number;
  latencyChange: number;
  tokenBudget: { used: number; total: number };
}

/**
 * Props for TraceTimeline component
 */
export interface TraceTimelineProps {
  trace: Trace | null;
  isStreaming: boolean;
  onExpandAll: () => void;
  onRerun: () => void;
}

/**
 * Props for SpanNode component
 */
export interface SpanNodeProps {
  span: Span;
  startTime: number;  // Base time for relative timestamps (microseconds)
  isExpanded?: boolean;
  onToggle?: () => void;
  depth?: number;
  forceExpanded?: boolean;
  forceExpandedSignal?: number;
}

/**
 * Props for TraceLogStream component
 */
export interface TraceLogStreamProps {
  logs: LogEntry[];
  isPaused: boolean;
  isStreaming: boolean;
  onPauseToggle: () => void;
  onDownload: () => void;
}

/**
 * Configuration for span type visualization
 */
export interface SpanTypeConfig {
  icon: string;  // Material Symbols icon name
  color: string;  // Tailwind color class
  bgColor: string;  // Background color class
  borderColor: string;  // Border color class
  label: string;  // Human-readable label
}

/**
 * Configuration for log level styling
 */
export interface LogLevelConfig {
  borderColor: string;
  bgColor: string;
  textColor: string;
  labelColor: string;
}
