# Session Report: Real-time Trace Integration

**Date:** 2026-02-17
**Status:** Completed

## Summary

Successfully implemented real-time WebSocket support for trace updates and added the ability to launch AI agents from the Jobs page. Users can now create agent jobs directly from the UI and see trace updates in real-time on the Traces page.

## Completed Tasks

### 1. Agent Job Template in Jobs Page
- **Files Modified:**
  - `src/lib/hooks/use-jobs.ts` - Added `agentRun` template
  - `src/components/jobs/JobCreateForm.tsx` - Added Brain icon
- **Features:**
  - New "AI Agent" template option in job creation form
  - Select from 4 agent types: research, coding, analysis, orchestrator
  - Choose model: minimax-m2.5, claude-3.5-sonnet, gpt-4o
  - Required prompt field

### 2. WebSocket Server Implementation
- **Files Created:**
  - `server/routes/_ws.ts` - Nitro WebSocket handler
  - `src/lib/websocket/trace-watcher.ts` - Database poller for changes
  - `src/lib/websocket/manager.ts` - Connection and subscription manager
  - `src/lib/websocket/index.ts` - Module exports
- **Protocol:**
  - Client → Server: `subscribe:traces`, `subscribe:trace:{id}`, `unsubscribe:trace:{id}`, `pong`
  - Server → Client: `trace:created`, `trace:updated`, `span:created`, `ping`
- **Features:**
  - Polling-based trace watcher (500ms interval)
  - Automatic broadcast of new/updated traces
  - Connection management with ping/pong keepalive

### 3. WebSocket Client Integration
- **Files Created/Modified:**
  - `src/lib/hooks/use-trace-websocket.ts` - React hook for WebSocket
  - `src/components/tracing/TraceTerminal.tsx` - Integrated WebSocket
  - `src/components/tracing/TraceHeader.tsx` - Connection status indicator
- **Features:**
  - Auto-connect on component mount
  - Exponential backoff reconnection
  - Visual connection indicator (Live/Polling)
  - Hybrid mode: WebSocket + HTTP polling fallback

### 4. Configuration Updates
- **File:** `vite.config.ts`
  - Enabled experimental WebSocket feature for Nitro

## File Structure Created

```
server/routes/
└── _ws.ts                      # NEW: WebSocket handler

src/
├── lib/
│   ├── websocket/
│   │   ├── index.ts            # NEW: Module exports
│   │   ├── manager.ts          # NEW: Connection manager
│   │   └── trace-watcher.ts    # NEW: DB poller
│   └── hooks/
│       └── use-trace-websocket.ts  # NEW: React hook
└── components/
    ├── jobs/
    │   └── JobCreateForm.tsx   # MODIFIED: Added agent template
    └── tracing/
        ├── TraceTerminal.tsx   # MODIFIED: WebSocket integration
        └── TraceHeader.tsx     # MODIFIED: Connection indicator
```

## Known Issues

1. **Production Build Error:** Pre-existing Rollup bundler error:
   ```
   Cannot read properties of null (reading 'getVariableForExportName')
   ```
   This is a TanStack Start/Rollup compatibility issue, not related to our changes. Development mode works correctly.

2. **WebSocket in Production:** Due to the Rollup bug, the WebSocket feature is disabled for production builds. For production deployment, consider:
   - Upgrading TanStack Start when the bug is fixed
   - Using a separate WebSocket server
   - Falling back to HTTP polling only

## How to Test

### 1. Start Development Server

```bash
npm run dev
```

### 2. Create an Agent Job

1. Navigate to `/jobs`
2. Click on "AI Agent" template (4th option with brain icon)
3. Select agent type (e.g., "research")
4. Enter a prompt
5. Click "Start AI Agent"

### 3. View Real-time Traces

1. Navigate to `/traces`
2. Verify connection indicator shows "Live" (green dot)
3. The trace should appear immediately when the agent starts
4. Updates should appear in real-time as the agent runs

### 4. Test WebSocket

```javascript
// In browser console:
const ws = new WebSocket('ws://localhost:3000/_ws');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({type: 'subscribe:traces'}));
```

## Next Steps

1. **Fix Production Build** - Wait for TanStack Start update or find workaround
2. **Add Trace Filtering** - Filter traces by agent type, status, date
3. **Add Trace Comparison** - Compare multiple traces side-by-side
4. **Add Span Details** - Click on span to see full attributes
5. **Add Export** - Export traces to JSON/OTel format

## Documentation

- Specification: `.specs/realtime-updates.md`
- Tasks: `.tasks/agent-job-template.md`, `.tasks/websocket-server.md`, `.tasks/websocket-client.md`
