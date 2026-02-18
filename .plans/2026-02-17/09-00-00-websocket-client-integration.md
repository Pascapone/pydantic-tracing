# Implementation Plan: WebSocket Client Integration for Traces

**Date:** 2026-02-17
**Task:** `.tasks/websocket-client.md`

## Overview

Integrate the existing WebSocket client hook (`useTraceWebSocket`) into the React frontend to receive real-time trace updates, while keeping polling as a fallback mechanism.

## Files to Modify

1. `src/components/tracing/TraceTerminal.tsx` - Integrate WebSocket subscription
2. `src/components/tracing/TraceHeader.tsx` - Add connection status indicator

## Implementation Details

### Step 1: Update TraceTerminal Component

**File:** `src/components/tracing/TraceTerminal.tsx`

Changes:
1. Import `useTracesSubscription` from `@/lib/hooks/use-trace-websocket`
2. Add WebSocket subscription hook with callbacks for:
   - `onTraceCreated`: Add new trace to the list
   - `onTraceUpdated`: Update existing trace in the list
3. Pass `isConnected` to `TraceHeader` component
4. Keep existing polling as fallback (no changes needed)

**Key Logic:**
- When a new trace is received via WebSocket, prepend it to the traces array
- When a trace is updated, find and replace it in the array
- If the updated trace is the currently selected one, also update the selected trace

### Step 2: Update TraceHeader Component

**File:** `src/components/tracing/TraceHeader.tsx`

Changes:
1. Add `isConnected?: boolean` prop to interface
2. Add connection status indicator showing:
   - Green dot + "Live": Connected to WebSocket
   - Yellow dot (pulsing) + "Connecting...": Attempting to connect
   - Red dot + "Polling": Disconnected (using polling fallback)

**UI Placement:**
- Add indicator between the navigation tabs and action buttons

### Step 3: Type Compatibility

The WebSocket hook returns `TraceRow` from `@/lib/tracing/db`, while `use-traces.ts` defines its own `Trace` type. These types are compatible (same schema), but we need to ensure proper type handling.

## Testing Plan

1. Start dev server: `npm run dev`
2. Open Traces page
3. Verify connection indicator shows "Live" (green dot)
4. Run an agent job (e.g., from Jobs page)
5. Verify new traces appear immediately without waiting for poll
6. Stop server briefly to test disconnection handling
7. Verify build works: `npm run build`

## Risk Mitigation

- **Fallback:** Polling remains active as backup
- **Type Safety:** TraceRow and Trace types have identical schemas
- **Performance:** WebSocket updates are additive, not replacing polling

## Estimated Time

- TraceTerminal.tsx: ~15 minutes
- TraceHeader.tsx: ~10 minutes
- Testing: ~10 minutes
- Total: ~35 minutes
