# Walkthrough: WebSocket Server for Real-time Trace Updates

**Created:** 2026-02-17 14:45:00
**Task:** WebSocket Server for Real-time Trace Updates

## Overview

This walkthrough documents the implementation of a WebSocket server that enables real-time trace updates for the pydantic-tracing application. Clients can subscribe to trace updates and receive notifications when traces are created, updated, or when new spans are added.

## Implementation Summary

### Files Created

1. **`vite.config.ts`** - Updated to enable WebSocket support
2. **`src/lib/websocket/trace-watcher.ts`** - Database watcher for trace changes
3. **`src/lib/websocket/manager.ts`** - WebSocket connection manager
4. **`src/lib/websocket/index.ts`** - Module exports
5. **`src/lib/hooks/use-trace-websocket.ts`** - React hook for client-side WebSocket
6. **`server/routes/_ws.ts`** - Nitro WebSocket handler

### Files Modified

1. **`vite.config.ts`** - Added `features: { websocket: true }` to Nitro plugin

## Technical Implementation

### 1. Vite Configuration Update

Enabled experimental WebSocket support in Nitro by adding `features: { websocket: true }` to the nitro plugin configuration:

```typescript
nitro({ 
  rollupConfig: { external: [/^@sentry\//] },
  features: { websocket: true },
})
```

### 2. Trace Watcher (`src/lib/websocket/trace-watcher.ts`)

A polling-based database watcher that:
- Opens a readonly SQLite connection to `traces.db`
- Polls every 500ms for changes
- Tracks trace states (id, status, span_count)
- Emits events for:
  - `trace:created` - When a new trace is discovered
  - `trace:updated` - When trace status or span_count changes
  - `span:created` - When new spans are added to a trace

Key features:
- Singleton pattern for single watcher instance
- Graceful handling when database doesn't exist
- Memory limit (tracks max 100 traces)

### 3. WebSocket Manager (`src/lib/websocket/manager.ts`)

Manages WebSocket connections and broadcasts:
- Tracks connected clients with unique IDs
- Manages subscriptions (`traces`, `trace:{id}`)
- Broadcasts trace events to subscribed clients
- Implements ping/pong keepalive (30 second interval)

### 4. WebSocket Handler (`server/routes/_ws.ts`)

Nitro WebSocket handler using `defineWebSocketHandler` from h3:

```typescript
export default defineWebSocketHandler({
  open(peer) { /* Register client */ },
  message(peer, message) { /* Handle subscriptions */ },
  close(peer) { /* Clean up */ },
  error(peer, error) { /* Error handling */ },
});
```

### 5. React Hook (`src/lib/hooks/use-trace-websocket.ts`)

Client-side hook for WebSocket connections:
- Auto-connect on mount (configurable)
- Auto-reconnect with exponential backoff
- Subscribe/unsubscribe helpers
- Type-safe event callbacks

Usage example:
```tsx
const { isConnected, subscribeToTraces } = useTraceWebSocket({
  onTraceCreated: (trace) => {
    console.log('New trace:', trace);
  },
  onTraceUpdated: (trace) => {
    console.log('Updated trace:', trace);
  },
});
```

## Protocol

### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `subscribe:traces` | Subscribe to all trace updates | - |
| `subscribe:trace` | Subscribe to specific trace | `{ traceId: string }` |
| `unsubscribe:trace` | Unsubscribe from trace | `{ traceId: string }` |
| `pong` | Keepalive response | - |

### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `connected` | Connection established | `{ clientId: string }` |
| `trace:created` | New trace discovered | `{ trace: TraceRow }` |
| `trace:updated` | Trace updated | `{ trace: TraceRow }` |
| `span:created` | New span added | `{ span: SpanRow, traceId: string }` |
| `ping` | Keepalive request | - |
| `error` | Error message | `{ message: string }` |

## Testing

### Manual Testing

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser console and test WebSocket:
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/_ws');
   ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
   ws.onopen = () => ws.send(JSON.stringify({type: 'subscribe:traces'}));
   ```

3. Run a Python agent to create traces:
   ```bash
   cd python-workers
   python examples/01_basic.py
   ```

4. Verify WebSocket receives `trace:created` and `span:created` events

### Integration with TraceTerminal

To integrate with the existing TraceTerminal component:

```tsx
import { useTracesSubscription } from '@/lib/hooks/use-trace-websocket';

function TraceTerminal() {
  const [traces, setTraces] = useState<Trace[]>([]);
  
  const { isConnected } = useTracesSubscription({
    onTraceCreated: (trace) => {
      setTraces(prev => [trace, ...prev]);
    },
    onTraceUpdated: (trace) => {
      setTraces(prev => prev.map(t => t.id === trace.id ? trace : t));
    },
  });
  
  // Show connection indicator
  return (
    <div>
      <div className={isConnected ? 'text-green-500' : 'text-red-500'}>
        WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      {/* ... rest of component */}
    </div>
  );
}
```

## Challenges and Solutions

### Challenge 1: TanStack Start WebSocket Support

TanStack Start doesn't have built-in WebSocket support in its route files. The solution was to use Nitro's experimental WebSocket support by:
1. Creating a `server/routes/` directory at the project root
2. Using `defineWebSocketHandler` from h3

### Challenge 2: Database Polling vs File Watching

Initial consideration was to use file system watching, but:
- SQLite doesn't reliably trigger file change events
- Polling is simpler and more predictable
- 500ms polling is acceptable for trace updates

### Challenge 3: Memory Management

To prevent memory leaks:
- Limited tracked traces to 100
- Cleaned up traces that are no longer in database
- Proper cleanup on process exit

## Future Improvements

1. **Redis Pub/Sub** - For multi-instance deployments, use Redis pub/sub instead of in-memory broadcasting

2. **SSE Fallback** - Add Server-Sent Events fallback for environments that don't support WebSocket

3. **Authentication** - Add authentication to WebSocket connections using the existing better-auth system

4. **Message Batching** - Batch updates if too frequent (max 10/sec)

5. **Compression** - Add message compression for large traces

## Files Changed

```
vite.config.ts                            # Modified: Added WebSocket feature flag
src/lib/websocket/trace-watcher.ts        # Created: Database watcher
src/lib/websocket/manager.ts              # Created: WebSocket manager
src/lib/websocket/index.ts                # Created: Module exports
src/lib/hooks/use-trace-websocket.ts      # Created: React hook
server/routes/_ws.ts                      # Created: WebSocket handler
```

## Verification Checklist

- [x] Vite config updated with WebSocket support
- [x] Trace watcher polls database for changes
- [x] WebSocket manager tracks connections and subscriptions
- [x] WebSocket handler processes client messages
- [x] React hook provides easy client-side integration
- [x] Protocol documented
- [ ] Manual testing completed
- [ ] Integration with TraceTerminal component
