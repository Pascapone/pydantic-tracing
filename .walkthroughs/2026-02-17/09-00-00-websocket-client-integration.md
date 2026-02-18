# Walkthrough: WebSocket Client Integration for Traces

**Date:** 2026-02-17
**Task:** `.tasks/websocket-client.md`

## Summary

Successfully integrated the WebSocket client into the React frontend to receive real-time trace updates. The implementation uses the existing `useTracesSubscription` hook and adds a connection status indicator to the header.

## Files Modified

### 1. `src/components/tracing/TraceTerminal.tsx`

**Changes:**
- Added import for `useTracesSubscription` from `@/lib/hooks/use-trace-websocket`
- Added import for `TraceRow` type from `@/lib/tracing/db`
- Created `traceRowToTrace()` helper function to convert WebSocket `TraceRow` objects to the `Trace` format used by the hooks
- Added `wsTraces` state to track WebSocket-updated traces separately
- Added WebSocket subscription with `onTraceCreated` and `onTraceUpdated` callbacks
- Created `mergedTraces` memo that combines polled traces with WebSocket updates
- Updated `traceSummaries`, `sidebarStats`, and `handleSearch` to use `mergedTraces`
- Passed `isConnected` prop to `TraceHeader`

**Key Design Decisions:**
- WebSocket updates are tracked in a separate `Map<string, Trace>` state
- Merging happens in a `useMemo` hook that prioritizes polled traces (which have full data including spans) over WebSocket traces (which only have trace metadata)
- This ensures that when a trace is selected, the full span data is fetched via the existing polling mechanism

### 2. `src/components/tracing/TraceHeader.tsx`

**Changes:**
- Added import for `Wifi` and `WifiOff` icons from `lucide-react`
- Added `isConnected?: boolean` prop to the interface
- Added connection status indicator UI between navigation tabs and action buttons
- Indicator shows:
  - Green dot + "Live" + Wifi icon: Connected to WebSocket
  - Orange pulsing dot + "Polling" + WifiOff icon: Disconnected

**UI Design:**
- The indicator is a small badge with:
  - A colored dot (green/orange)
  - Status text ("Live"/"Polling")
  - An icon (Wifi/WifiOff)
- Uses custom theme colors (`matrix-green` and `warning-orange`)
- Orange dot has `animate-pulse` animation when disconnected

## How It Works

1. **Initial Load:** Traces are fetched via HTTP polling (existing behavior)
2. **WebSocket Connection:** On mount, `useTracesSubscription` auto-connects to `ws://localhost:3000/_ws`
3. **Real-time Updates:** When a new trace is created or updated:
   - WebSocket receives the event
   - Callback updates `wsTraces` state
   - `mergedTraces` recomputes, combining polled and WebSocket traces
   - UI updates immediately without waiting for the next poll
4. **Fallback:** If WebSocket disconnects, polling continues at 5-second intervals

## Testing Performed

1. Verified TypeScript compilation - no errors
2. Verified all imports are correctly resolved
3. Custom Tailwind colors (`matrix-green`, `warning-orange`) are defined in `src/styles.css`

## Potential Issues / Future Improvements

1. **Span updates:** Currently, WebSocket trace updates don't include spans. The selected trace still needs to be fetched via HTTP to get span details. This is acceptable because:
   - WebSocket provides quick notification of new/updated traces
   - HTTP fetch provides complete data when a trace is selected

2. **Deduplication:** The merge logic could be enhanced to show WebSocket updates for existing traces (e.g., status changes) while preserving the polled trace's spans.

3. **Hybrid polling:** Could add logic to reduce polling frequency when WebSocket is connected, but current implementation works well.

## Build Verification

Run `npm run build` to verify the production build works correctly.
