# Implementation Plan: WebSocket Server for Real-time Trace Updates

**Created:** 2026-02-17 14:30:00
**Task Document:** `.tasks/websocket-server.md`
**Specification:** `.specs/realtime-updates.md`

## Overview

Implement a WebSocket server for real-time trace updates using Nitro's experimental WebSocket support. The implementation will enable clients to subscribe to trace updates and receive notifications when traces are created, updated, or when new spans are added.

## Research Summary

### TanStack Start WebSocket Support

Based on research:
1. TanStack Start uses Nitro for server functionality
2. Nitro has experimental WebSocket support via `crossws`
3. WebSocket handlers can be defined in `server/routes/` directory
4. Need to enable experimental WebSocket feature

### Implementation Approach

Since TanStack Start uses Nitro nightly, we'll use the standard Nitro WebSocket pattern with `defineWebSocketHandler`. Based on the gist by @darkobits, there's an adapter pattern that works with TanStack Start's server routes.

## Implementation Steps

### Step 1: Enable WebSocket Feature

**File:** `vite.config.ts` (update)

Add Nitro experimental WebSocket config:
```typescript
nitro({ 
  rollupConfig: { external: [/^@sentry\//] },
  experimental: { websocket: true }
})
```

### Step 2: Create Trace Watcher Module

**File:** `src/lib/websocket/trace-watcher.ts` (new)

Create a polling-based watcher that:
- Opens SQLite connection to traces.db
- Polls every 500ms for changes
- Tracks known trace states (id, status, span_count)
- Emits events for new/updated traces and spans

Key types:
```typescript
export type TraceEvent = 
  | { type: 'trace:created'; trace: TraceRow }
  | { type: 'trace:updated'; trace: TraceRow }
  | { type: 'span:created'; span: SpanRow; traceId: string }
```

### Step 3: Create WebSocket Manager

**File:** `src/lib/websocket/manager.ts` (new)

Create a singleton manager that:
- Tracks connected clients
- Manages subscriptions (traces, trace:{id})
- Broadcasts events to subscribers
- Handles keepalive ping/pong

### Step 4: Create WebSocket Route Handler

**File:** `src/routes/api/ws.ts` (new)

Using TanStack Start's server route pattern:
```typescript
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/ws")({
  server: {
    handlers: {
      GET: /* WebSocket upgrade handler */
    }
  }
})
```

Will need to use the crossws adapter pattern for Node.js.

### Step 5: Create WebSocket Utilities

**File:** `src/lib/websocket/index.ts` (new)

Export utilities:
- TraceWatcher class
- WebSocketManager singleton
- Broadcast helpers
- Type exports

### Step 6: Create Client Hook

**File:** `src/lib/hooks/use-trace-websocket.ts` (new)

React hook for WebSocket connection:
- Auto-connect to /api/ws
- Send subscribe/unsubscribe messages
- Handle reconnection with exponential backoff
- Provide callbacks for events

## File Structure

```
src/
├── lib/
│   ├── websocket/
│   │   ├── index.ts           # NEW: Exports
│   │   ├── manager.ts         # NEW: WebSocket connection manager
│   │   └── trace-watcher.ts   # NEW: Database watcher
│   └── hooks/
│       └── use-trace-websocket.ts  # NEW: React hook
└── routes/api/
    └── ws.ts                  # NEW: WebSocket endpoint
```

## Technical Details

### WebSocket Protocol

**Client → Server:**
```json
{"type": "subscribe:traces"}
{"type": "subscribe:trace", "traceId": "abc-123"}
{"type": "unsubscribe:trace", "traceId": "abc-123"}
{"type": "pong"}
```

**Server → Client:**
```json
{"type": "trace:created", "trace": {...}}
{"type": "trace:updated", "trace": {...}}
{"type": "span:created", "span": {...}, "traceId": "abc-123"}
{"type": "ping"}
```

### Database Watching Strategy

1. Poll every 500ms using `setInterval`
2. Compare trace states: `{id, status, span_count}`
3. New trace → emit `trace:created`
4. Changed status or span_count → emit `trace:updated`
5. For each updated trace, check for new spans

### Error Handling

1. Database not found: Skip silently, retry on next poll
2. Connection lost: Client auto-reconnects with backoff
3. Message parsing: Log and ignore invalid messages
4. Memory: Limit stored state to last 100 traces

### Dependencies

Already in project:
- `better-sqlite3` - SQLite access
- `nitro` - Server framework with WebSocket support

May need to install:
- `crossws` - Cross-platform WebSocket adapter (may be included with nitro)

## Testing Plan

1. Start dev server: `npm run dev`
2. Test WebSocket connection with browser console:
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/api/ws');
   ws.onmessage = (e) => console.log(e.data);
   ws.send(JSON.stringify({type: 'subscribe:traces'}));
   ```
3. Run Python agent to create traces
4. Verify WebSocket receives updates
5. Test reconnection by restarting server

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Experimental WebSocket support may have issues | Fallback to SSE or polling |
| Database locking during reads | Use readonly mode, close connections |
| Memory leak from state tracking | Limit to last 100 traces |
| Client connection management | Heartbeat, auto-reconnect |

## Estimated Time

- Step 1: Enable WebSocket: 15 min
- Step 2: Trace Watcher: 45 min
- Step 3: WebSocket Manager: 30 min
- Step 4: WebSocket Route: 30 min
- Step 5: Utilities: 15 min
- Step 6: Client Hook: 30 min
- Testing: 30 min

**Total: ~3 hours**

## Approval

- [ ] Manager approval required before implementation
