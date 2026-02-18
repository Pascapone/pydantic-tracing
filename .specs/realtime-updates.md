# Real-time Updates Specification

**Version:** 1.0
**Status:** Active
**Created:** 2026-02-17

## Overview

Add real-time WebSocket support for live trace streaming. This enables users to see trace updates as they happen, rather than relying on polling.

## Architecture

### WebSocket Flow

```
┌─────────────┐     WebSocket      ┌──────────────┐
│  Frontend   │<──────────────────>│  TanStack    │
│  (React)    │                    │  Server      │
└─────────────┘                    └──────────────┘
       │                                   │
       │                                   │ File Watch
       │                                   ▼
       │                           ┌────────────────┐
       │                           │  traces.db     │
       │                           │  (SQLite)      │
       │                           └────────────────┘
       │                                   │
       └───────────────────────────────────┘
              WebSocket Messages
```

### Message Types

**Server → Client:**

1. `trace:created` - New trace started
2. `trace:updated` - Trace status or span count changed
3. `trace:completed` - Trace finished (OK or ERROR)
4. `span:created` - New span added
5. `span:updated` - Span status changed
6. `ping` - Keepalive

**Client → Server:**

1. `subscribe:traces` - Subscribe to all trace updates
2. `subscribe:trace:{id}` - Subscribe to specific trace
3. `unsubscribe:trace:{id}` - Unsubscribe from trace
4. `pong` - Keepalive response

## WebSocket Endpoint

### URL

```
ws://localhost:3000/api/ws
```

### Connection Lifecycle

1. Client connects to `/api/ws`
2. Server accepts connection
3. Client sends `subscribe:traces` to receive all updates
4. Server pushes updates as they occur
5. Client can subscribe/unsubscribe to specific traces
6. Server sends `ping` every 30 seconds
7. Client responds with `pong`

## Implementation

### Server-Side (Nitro WebSocket)

TanStack Start uses Nitro, which has built-in WebSocket support via the `ws` preset or custom handlers.

**File:** `src/routes/api/ws.ts`

```typescript
import { defineWebSocketHandler } from 'h3'

export default defineWebSocketHandler({
  open(peer) {
    // New client connected
    console.log('WebSocket client connected')
  },
  
  message(peer, message) {
    // Handle client messages
    const data = JSON.parse(message.toString())
    
    if (data.type === 'subscribe:traces') {
      peer.subscribe('traces')
    }
    
    if (data.type === 'subscribe:trace') {
      peer.subscribe(`trace:${data.traceId}`)
    }
    
    if (data.type === 'pong') {
      // Keepalive response
    }
  },
  
  close(peer) {
    // Client disconnected
    console.log('WebSocket client disconnected')
  }
})
```

### Database Watcher

To detect changes in `traces.db`, we can:

1. **Option A: Poll-based watcher** (simpler, works with SQLite)
   - Poll every 500ms for new/updated traces
   - Compare with last known state
   - Emit WebSocket events on changes

2. **Option B: File system watcher** (more efficient)
   - Watch `traces.db` for file changes
   - Query for updates when file changes

3. **Option C: Python worker emits events** (best integration)
   - Python worker writes to a Redis pub/sub channel
   - Node server subscribes and forwards to WebSocket clients

We'll use **Option A** (poll-based) for simplicity, with the option to upgrade later.

### Client-Side Hook

**File:** `src/lib/hooks/use-trace-websocket.ts`

```typescript
export interface UseTraceWebSocketOptions {
  onTraceCreated?: (trace: Trace) => void
  onTraceUpdated?: (trace: Trace) => void
  onSpanCreated?: (span: Span) => void
  autoConnect?: boolean
}

export function useTraceWebSocket(options?: UseTraceWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  
  // Connection logic...
  
  return {
    isConnected,
    subscribe: (traceId: string) => void,
    unsubscribe: (traceId: string) => void,
    disconnect: () => void,
  }
}
```

## Integration Points

### 1. TraceTerminal Component

Update `TraceTerminal.tsx` to use WebSocket instead of polling:

```tsx
const { isConnected } = useTraceWebSocket({
  onTraceCreated: (trace) => {
    // Add to traces list
  },
  onTraceUpdated: (trace) => {
    // Update existing trace
  },
  onSpanCreated: (span) => {
    // Add span to timeline
  },
})
```

### 2. Job Status Updates

When an agent job creates a trace, the WebSocket should notify all connected clients.

### 3. Live Log Streaming

The `TraceLogStream` component should receive new logs in real-time via WebSocket.

## File Structure

```
src/
├── routes/api/
│   └── ws.ts                    # NEW: WebSocket handler
├── lib/
│   ├── websocket/
│   │   ├── index.ts             # NEW: WebSocket utilities
│   │   └── trace-watcher.ts     # NEW: Database watcher
│   └── hooks/
│       ├── use-traces.ts        # UPDATE: Add WebSocket integration
│       └── use-trace-websocket.ts # NEW: WebSocket hook
└── components/tracing/
    └── TraceTerminal.tsx        # UPDATE: Use WebSocket
```

## Fallback Behavior

When WebSocket is not available:
1. Fall back to HTTP polling (current behavior)
2. Show connection status indicator
3. Retry connection with exponential backoff

## Error Handling

1. **Connection lost:** Show indicator, auto-retry
2. **Message parsing errors:** Log and ignore
3. **Database errors:** Log, don't crash server

## Performance Considerations

1. **Connection limits:** Max 100 concurrent WebSocket connections
2. **Message batching:** Batch updates if too frequent (max 10/sec)
3. **Memory usage:** Clean up old trace data from memory

## Testing

1. Start agent job from Jobs page
2. Open Traces page in another tab
3. Verify trace appears in real-time
4. Verify span updates appear as they happen
5. Verify logs stream in real-time
