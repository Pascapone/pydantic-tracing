/**
 * Trace Watcher - Polls the traces.db SQLite database for changes
 * and emits events when traces are created or updated.
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { TraceRow, SpanRow } from "@/lib/tracing/db";

// ============================================================================
// Types
// ============================================================================

export type TraceEvent =
  | { type: "trace:created"; trace: TraceRow }
  | { type: "trace:updated"; trace: TraceRow }
  | { type: "span:created"; span: SpanRow; traceId: string };

export interface TraceWatcherOptions {
  /** Polling interval in milliseconds */
  pollInterval?: number;
  /** Maximum number of traces to track in memory */
  maxTrackedTraces?: number;
}

interface TraceState {
  status: string;
  span_count: number;
  lastSpanIds: Set<string>;
}

// ============================================================================
// TraceWatcher Class
// ============================================================================

export class TraceWatcher {
  private dbPath: string;
  private pollInterval: number;
  private maxTrackedTraces: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private traceStates: Map<string, TraceState> = new Map();
  private onEvent: (event: TraceEvent) => void;
  private isRunning = false;

  constructor(
    dbPath: string,
    onEvent: (event: TraceEvent) => void,
    options?: TraceWatcherOptions
  ) {
    this.dbPath = dbPath;
    this.onEvent = onEvent;
    this.pollInterval = options?.pollInterval ?? 500;
    this.maxTrackedTraces = options?.maxTrackedTraces ?? 100;
  }

  /**
   * Start polling for database changes
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Do an initial check immediately
    this.checkForChanges();

    // Then poll at the specified interval
    this.intervalId = setInterval(() => {
      this.checkForChanges();
    }, this.pollInterval);
  }

  /**
   * Stop polling for database changes
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Get current state for a trace
   */
  getTraceState(traceId: string): TraceState | undefined {
    return this.traceStates.get(traceId);
  }

  /**
   * Clear all tracked state
   */
  clearState(): void {
    this.traceStates.clear();
  }

  /**
   * Check for changes in the database
   */
  private checkForChanges(): void {
    // Check if database exists
    if (!fs.existsSync(this.dbPath)) {
      return;
    }

    let db: Database.Database;
    try {
      db = new Database(this.dbPath, { readonly: true });
    } catch {
      // Database might be locked or corrupted
      return;
    }

    try {
      // Get all traces, ordered by most recent
      const traces = db
        .prepare(
          "SELECT * FROM traces ORDER BY started_at DESC LIMIT ?"
        )
        .all(this.maxTrackedTraces) as TraceRow[];

      const currentTraceIds = new Set<string>();

      for (const trace of traces) {
        currentTraceIds.add(trace.id);
        const lastState = this.traceStates.get(trace.id);

        if (!lastState) {
          // New trace discovered
          this.traceStates.set(trace.id, {
            status: trace.status,
            span_count: trace.span_count,
            lastSpanIds: new Set(),
          });
          this.onEvent({ type: "trace:created", trace });

          // Check for existing spans on this trace
          this.checkForNewSpans(db, trace.id, new Set());
        } else if (
          lastState.status !== trace.status ||
          lastState.span_count !== trace.span_count
        ) {
          // Trace was updated
          this.traceStates.set(trace.id, {
            status: trace.status,
            span_count: trace.span_count,
            lastSpanIds: lastState.lastSpanIds,
          });
          this.onEvent({ type: "trace:updated", trace });

          // Check for new spans
          this.checkForNewSpans(db, trace.id, lastState.lastSpanIds);
        }
      }

      // Clean up old traces that are no longer in the database
      for (const [traceId] of this.traceStates) {
        if (!currentTraceIds.has(traceId)) {
          this.traceStates.delete(traceId);
        }
      }
    } catch (error) {
      // Silently handle errors (e.g., table doesn't exist yet)
      console.error("[TraceWatcher] Error checking for changes:", error);
    } finally {
      db.close();
    }
  }

  /**
   * Check for new spans on a trace
   */
  private checkForNewSpans(
    db: Database.Database,
    traceId: string,
    knownSpanIds: Set<string>
  ): void {
    try {
      const spans = db
        .prepare("SELECT * FROM spans WHERE trace_id = ?")
        .all(traceId) as SpanRow[];

      const newSpanIds = new Set<string>();

      for (const span of spans) {
        newSpanIds.add(span.id);

        if (!knownSpanIds.has(span.id)) {
          // New span discovered
          this.onEvent({
            type: "span:created",
            span,
            traceId,
          });
        }
      }

      // Update the known span IDs for this trace
      const state = this.traceStates.get(traceId);
      if (state) {
        state.lastSpanIds = newSpanIds;
      }
    } catch {
      // Silently handle errors
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let watcherInstance: TraceWatcher | null = null;

/**
 * Get the singleton TraceWatcher instance
 */
export function getTraceWatcher(
  onEvent: (event: TraceEvent) => void
): TraceWatcher {
  const dbPath = path.join(process.cwd(), "python-workers", "traces.db");

  if (!watcherInstance) {
    watcherInstance = new TraceWatcher(dbPath, onEvent);
  } else {
    // Update the callback
    watcherInstance = new TraceWatcher(dbPath, onEvent);
  }

  return watcherInstance;
}

/**
 * Stop and clean up the singleton watcher
 */
export function stopTraceWatcher(): void {
  if (watcherInstance) {
    watcherInstance.stop();
    watcherInstance = null;
  }
}
