# Task: WebSocket Client Integration for Traces

**Priority:** High
**Estimate:** 1.5 hours
**Dependencies:** WebSocket Server task must be completed first

## Objective

Integrate WebSocket client into the React frontend to receive real-time trace updates. Replace polling-based updates with WebSocket-based updates where possible.

## Context

- The WebSocket server is at `ws://localhost:3000/api/ws`
- The specification is at `.specs/realtime-updates.md`
- Current polling is implemented in `src/lib/hooks/use-traces.ts`

## Implementation Steps

### Step 1: Create WebSocket Hook

**File:** `src/lib/hooks/use-trace-websocket.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Trace, Span, TraceEvent } from './use-traces'

export interface UseTraceWebSocketOptions {
  onTraceCreated?: (trace: Trace) => void
  onTraceUpdated?: (trace: Trace) => void
  onSpanCreated?: (span: Span, traceId: string) => void
  autoConnect?: boolean
  reconnectInterval?: number
}

export interface UseTraceWebSocketResult {
  isConnected: boolean
  subscribe: (traceId: string) => void
  unsubscribe: (traceId: string) => void
  disconnect: () => void
  reconnect: () => void
}

export function useTraceWebSocket(
  options?: UseTraceWebSocketOptions
): UseTraceWebSocketResult {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Connection logic with auto-reconnect
  
  return {
    isConnected,
    subscribe,
    unsubscribe,
    disconnect,
    reconnect,
  }
}
```

### Step 2: Update use-traces Hook

**File:** `src/lib/hooks/use-traces.ts`

Add a hybrid mode that uses WebSocket when available, falls back to polling:

```typescript
export interface UseTracesOptions {
  userId?: string
  limit?: number
  pollInterval?: number
  useWebSocket?: boolean  // NEW: Enable WebSocket mode
}

export function useTraces(options?: UseTracesOptions): UseTracesResult {
  const useWebSocket = options?.useWebSocket ?? true
  
  // WebSocket for real-time updates
  const { isConnected } = useTraceWebSocket({
    onTraceCreated: (trace) => {
      setTraces(prev => [trace, ...prev])
    },
    onTraceUpdated: (trace) => {
      setTraces(prev => prev.map(t => t.id === trace.id ? trace : t))
    },
    autoConnect: useWebSocket,
  })
  
  // Fall back to polling if WebSocket not connected
  useEffect(() => {
    if (useWebSocket && isConnected) {
      // Don't poll if WebSocket is active
      return
    }
    // Use polling as fallback
  }, [useWebSocket, isConnected])
  
  // ... rest of implementation
}
```

### Step 3: Update TraceTerminal Component

**File:** `src/components/tracing/TraceTerminal.tsx`

1. Use WebSocket for real-time updates
2. Show connection status indicator
3. Handle disconnection gracefully

```tsx
export function TraceTerminal({ ... }: TraceTerminalProps) {
  const [wsConnected, setWsConnected] = useState(false)
  
  const { isConnected } = useTraceWebSocket({
    onTraceCreated: (trace) => {
      // Add to traces list
      setTraceSummaries(prev => [toTraceSummary(trace), ...prev])
    },
    onTraceUpdated: (trace) => {
      // Update in list
      setTraceSummaries(prev => 
        prev.map(t => t.id === trace.id ? toTraceSummary(trace) : t)
      )
      
      // Update selected trace if matches
      if (selectedTraceId === trace.id) {
        setTrace(trace)
      }
    },
    onSpanCreated: (span, traceId) => {
      // Add span to timeline
      if (selectedTraceId === traceId) {
        setTrace(prev => ({
          ...prev,
          spans: [...(prev?.spans || []), span],
        }))
      }
    },
    autoConnect: true,
  })
  
  // Show connection indicator in header
  // ...
}
```

### Step 4: Add Connection Status Indicator

Add a visual indicator showing WebSocket connection status:

- 🟢 Connected (green)
- 🟡 Connecting... (yellow, pulsing)
- 🔴 Disconnected (red)

This should appear in the `TraceHeader` component.

### Step 5: Update TraceHeader

**File:** `src/components/tracing/TraceHeader.tsx`

Add a connection status prop and display:

```tsx
interface TraceHeaderProps {
  activeTab: 'dashboard' | 'traces' | 'settings'
  onTabChange: (tab: 'dashboard' | 'traces' | 'settings') => void
  searchValue: string
  onSearchChange: (value: string) => void
  isConnected?: boolean  // NEW
}
```

## Testing

1. Start the dev server
2. Open the Traces page
3. Verify connection status indicator shows "connected"
4. Create an agent job from Jobs page
5. Switch to Traces page
6. Verify trace appears immediately (no waiting for poll)
7. Disconnect network
8. Verify indicator shows "disconnected"
9. Reconnect and verify auto-reconnect

## Notes

- Implement exponential backoff for reconnection
- Don't block UI if WebSocket fails - fall back to polling
- Keep polling as a backup mechanism
