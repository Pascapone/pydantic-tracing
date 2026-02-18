# Task: WebSocket Server for Real-time Trace Updates

**Priority:** High
**Estimate:** 2 hours
**Dependencies:** None

## Objective

Implement a WebSocket server that enables real-time trace updates. Clients should be able to subscribe to trace updates and receive notifications when traces are created, updated, or when new spans are added.

## Context

- TanStack Start uses Nitro for server functionality
- Nitro supports WebSocket handlers
- The traces database is at `python-workers/traces.db`
- The specification is at `.specs/realtime-updates.md`

## Implementation Steps

### Step 1: Create WebSocket Handler

**File:** `src/routes/api/ws.ts`

Create a WebSocket handler using Nitro's built-in WebSocket support. Check the Nitro documentation for the correct way to implement WebSocket handlers in TanStack Start.

Key functionality:
1. Accept WebSocket connections
2. Handle subscription messages (`subscribe:traces`, `subscribe:trace:{id}`)
3. Handle unsubscription messages
4. Broadcast trace updates to subscribers
5. Implement ping/pong keepalive

### Step 2: Create Trace Watcher

**File:** `src/lib/websocket/trace-watcher.ts`

Create a module that watches for trace database changes:

```typescript
// Polling-based watcher (simplest approach)
export class TraceWatcher {
  private dbPath: string
  private pollInterval: NodeJS.Timeout | null
  private lastTraceIds: Set<string>
  private onUpdate: (event: TraceEvent) => void
  
  constructor(dbPath: string, onUpdate: (event: TraceEvent) => void) {
    // Initialize
  }
  
  start() {
    // Poll every 500ms for changes
  }
  
  stop() {
    // Clean up
  }
  
  private checkForChanges() {
    // Query traces.db for new/updated traces
    // Compare with last known state
    // Emit events for changes
  }
}

export type TraceEvent = 
  | { type: 'trace:created'; trace: Trace }
  | { type: 'trace:updated'; trace: Trace }
  | { type: 'span:created'; span: Span; traceId: string }
```

### Step 3: Integrate Watcher with WebSocket

The watcher should broadcast events to connected WebSocket clients:

```typescript
// In the WebSocket handler
const watcher = new TraceWatcher(dbPath, (event) => {
  // Broadcast to all subscribers
  broadcast(event)
})
```

### Step 4: Create WebSocket Utilities

**File:** `src/lib/websocket/index.ts`

Export utilities for WebSocket management:

```typescript
export type { TraceEvent } from './trace-watcher'
export { TraceWatcher } from './trace-watcher'

// Broadcast helper
export function broadcastTraceUpdate(event: TraceEvent): void
```

## Database Schema Reference

The traces.db has these tables:

**traces:**
- id (TEXT, PRIMARY KEY)
- name (TEXT)
- user_id (TEXT)
- session_id (TEXT)
- status (TEXT: UNSET, OK, ERROR)
- span_count (INTEGER)
- total_duration_ms (REAL)
- started_at (TEXT: ISO 8601)
- completed_at (TEXT: ISO 8601)

**spans:**
- id (TEXT, PRIMARY KEY)
- trace_id (TEXT)
- parent_id (TEXT)
- name (TEXT)
- span_type (TEXT)
- start_time (INTEGER: microseconds)
- end_time (INTEGER)
- duration_us (INTEGER)
- attributes (JSON)
- status (TEXT)
- events (JSON)

## Testing

1. Start the dev server: `npm run dev`
2. Connect to WebSocket: `ws://localhost:3000/api/ws`
3. Send: `{"type": "subscribe:traces"}`
4. Create an agent job from the Jobs page
5. Verify WebSocket receives `trace:created` event
6. Verify subsequent `trace:updated` and `span:created` events

## Notes

- Use `better-sqlite3` to read from `traces.db`
- The database path is: `python-workers/traces.db` (relative to project root)
- Handle connection cleanup properly
- Implement graceful shutdown
