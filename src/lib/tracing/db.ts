/**
 * Database reader for Python tracing SQLite database.
 * Reads from traces.db created by python-workers/tracing/collector.py
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TRACES_DB_PATH = path.join(process.cwd(), "python-workers", "traces.db");

// Types matching the Python trace database schema

export interface TraceRow {
  id: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  request_id: string | null;
  metadata: string | null; // JSON string
  started_at: string;
  completed_at: string | null;
  status: "UNSET" | "OK" | "ERROR";
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
  start_time: number; // microseconds
  end_time: number | null;
  duration_us: number | null;
  attributes: string | null; // JSON string
  status: "UNSET" | "OK" | "ERROR";
  status_message: string | null;
  events: string | null; // JSON string
  created_at: string;
}

export interface SpanWithChildren extends Omit<SpanRow, "attributes" | "events"> {
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  children: SpanWithChildren[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export interface ParsedTrace extends Omit<TraceRow, "metadata"> {
  metadata: Record<string, unknown>;
  spans?: ParsedSpan[];
}

export interface ParsedSpan extends Omit<SpanRow, "attributes" | "events"> {
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export interface TraceStats {
  trace_count: number;
  span_count: number;
  avg_duration_ms: number;
}

/**
 * Check if traces database exists
 */
export function tracesDbExists(): boolean {
  return fs.existsSync(TRACES_DB_PATH);
}

/**
 * Get SQLite database connection for traces.db
 * Returns null if database doesn't exist
 */
export function getTracesDb(): Database.Database | null {
  if (!tracesDbExists()) {
    return null;
  }
  return new Database(TRACES_DB_PATH, { readonly: true });
}

/**
 * List traces with optional filters
 */
export function listTraces(options: {
  userId?: string | null;
  sessionId?: string | null;
  limit?: number;
  offset?: number;
}): TraceRow[] {
  const db = getTracesDb();
  if (!db) {
    return [];
  }

  try {
    const { userId, sessionId, limit = 50, offset = 0 } = options;

    let query = "SELECT * FROM traces";
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push("user_id = ?");
      params.push(userId);
    }
    if (sessionId) {
      conditions.push("session_id = ?");
      params.push(sessionId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY started_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as TraceRow[];

    return rows;
  } finally {
    db.close();
  }
}

/**
 * Get a single trace by ID
 */
export function getTrace(traceId: string): TraceRow | null {
  const db = getTracesDb();
  if (!db) {
    return null;
  }

  try {
    const stmt = db.prepare("SELECT * FROM traces WHERE id = ?");
    const row = stmt.get(traceId) as TraceRow | undefined;
    return row || null;
  } finally {
    db.close();
  }
}

/**
 * Get all spans for a trace (flat list)
 */
export function getSpans(traceId: string): SpanRow[] {
  const db = getTracesDb();
  if (!db) {
    return [];
  }

  try {
    const stmt = db.prepare(
      "SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time"
    );
    const rows = stmt.all(traceId) as SpanRow[];
    return rows;
  } finally {
    db.close();
  }
}

/**
 * Build a nested span tree from flat span list
 */
export function getSpanTree(traceId: string): SpanWithChildren[] {
  const spans = getSpans(traceId);

  // Parse JSON fields and create span map
  const spanMap = new Map<string, SpanWithChildren>();
  const parsedSpans: SpanWithChildren[] = spans.map((span) => {
    const parsed: SpanWithChildren = {
      ...span,
      attributes: safeJsonParse(span.attributes, {}),
      events: safeJsonParse(span.events, []),
      children: [],
    };
    spanMap.set(span.id, parsed);
    return parsed;
  });

  // Build tree structure
  const roots: SpanWithChildren[] = [];

  for (const span of parsedSpans) {
    if (span.parent_id && spanMap.has(span.parent_id)) {
      // Add to parent's children
      spanMap.get(span.parent_id)!.children.push(span);
    } else {
      // Root span (no parent or parent not in this trace)
      roots.push(span);
    }
  }

  // Sort children by start_time
  const sortChildren = (span: SpanWithChildren) => {
    span.children.sort((a, b) => a.start_time - b.start_time);
    span.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.start_time - b.start_time);
  roots.forEach(sortChildren);

  return roots;
}

/**
 * Get trace statistics
 */
export function getTraceStats(): TraceStats {
  const db = getTracesDb();
  if (!db) {
    return {
      trace_count: 0,
      span_count: 0,
      avg_duration_ms: 0,
    };
  }

  try {
    const traceCount = (
      db.prepare("SELECT COUNT(*) as count FROM traces").get() as {
        count: number;
      }
    ).count;

    const spanCount = (
      db.prepare("SELECT COUNT(*) as count FROM spans").get() as {
        count: number;
      }
    ).count;

    const avgDuration = (
      db
        .prepare(
          "SELECT AVG(total_duration_ms) as avg FROM traces WHERE completed_at IS NOT NULL"
        )
        .get() as { avg: number | null }
    ).avg;

    return {
      trace_count: traceCount,
      span_count: spanCount,
      avg_duration_ms: avgDuration || 0,
    };
  } finally {
    db.close();
  }
}

/**
 * Parse a trace with all spans
 */
export function getTraceWithSpans(traceId: string): ParsedTrace | null {
  const trace = getTrace(traceId);
  if (!trace) {
    return null;
  }

  const spans = getSpans(traceId);
  const parsedSpans: ParsedSpan[] = spans.map((span) => ({
    ...span,
    attributes: safeJsonParse(span.attributes, {}),
    events: safeJsonParse(span.events, []),
  }));

  return {
    ...trace,
    metadata: safeJsonParse(trace.metadata, {}),
    spans: parsedSpans,
  };
}

/**
 * Parse a trace with nested span tree
 */
export function getTraceWithTree(traceId: string): ParsedTrace | null {
  const trace = getTrace(traceId);
  if (!trace) {
    return null;
  }

  const spanTree = getSpanTree(traceId);

  return {
    ...trace,
    metadata: safeJsonParse(trace.metadata, {}),
    spans: spanTree as unknown as ParsedSpan[],
  };
}

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
