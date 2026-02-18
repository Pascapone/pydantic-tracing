# Trace Integration Specification

**Version:** 1.0
**Status:** Active
**Created:** 2026-02-17

## Overview

Integrate the Python Agent Tracing System with the TypeScript Job System to enable launching AI agents from the web UI and visualizing their execution traces in real-time.

## Design Reference

The UI design is defined in `design/tracing-design-concept.html`. Key design elements:

### Color Palette (Tailwind)
- **Primary:** `#11a4d4` (cyan-600 equivalent)
- **Background Dark:** `#101d22`
- **Background Light:** `#f6f8f8`
- **Matrix Green:** `#0bda57` (success/active)
- **Warning Orange:** `#ff6b00` (errors/warnings)
- **Surface Dark:** `#1a262b`
- **Surface Light:** `#ffffff`

### Layout Structure
```
+------------------+------------------------+------------------+
|    Sidebar       |      Main Timeline     |    Log Stream    |
|    (w-80)        |      (flex-1)          |    (w-96)        |
|                  |                        |                  |
|  [Stats Grid]    |  [Timeline Header]     |  [Log Header]    |
|  [Trace List]    |  [Span Timeline]       |  [Log Items]     |
+------------------+------------------------+------------------+
```

## Architecture

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Frontend   │────>│  TypeScript  │────>│  Python Worker │
│  (React)    │     │  Job Queue   │     │  (Agent + Tracing) │
└─────────────┘     └──────────────┘     └────────────────┘
       │                   │                      │
       │                   │                      ▼
       │                   │              ┌────────────────┐
       │                   │              │  traces.db     │
       │                   │              │  (SQLite)      │
       │                   │              └────────────────┘
       │                   │                      │
       ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│                    API Endpoints                         │
│  GET /api/traces      - List traces                      │
│  GET /api/traces/:id  - Get trace with spans             │
│  POST /api/jobs       - Create agent job                 │
└─────────────────────────────────────────────────────────┘
```

### Components

#### Python Side

1. **AgentTraceHandler** (`python-workers/handlers/agent_trace.py`)
   - Job type: `agent.run`
   - Executes pydantic-ai agents with tracing
   - Returns trace_id in job result
   - Supports: research, coding, analysis, orchestrator agents

2. **Tracing Integration** (`python-workers/tracing/`)
   - Already implemented: spans, collector, processor, viewer
   - Database: `traces.db` (separate from main SQLite)

#### TypeScript Side

1. **API Routes**
   - `src/routes/api/traces/index.ts` - List/get traces
   - `src/routes/api/traces/$id.ts` - Single trace details

2. **React Components** (`src/components/tracing/`)
   - `TraceTerminal.tsx` - Main container
   - `TraceSidebar.tsx` - Stats + trace list
   - `TraceTimeline.tsx` - Visual span timeline
   - `TraceLogStream.tsx` - Raw log output
   - `SpanNode.tsx` - Individual span visualization
   - `TraceStats.tsx` - Statistics grid

3. **Hooks** (`src/lib/hooks/`)
   - `use-traces.ts` - Trace fetching and polling

#### Database

The tracing system uses its own SQLite database (`traces.db`) managed by Python. The TypeScript backend reads from this database.

**traces table:**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| name | TEXT | Trace name |
| user_id | TEXT | User identifier |
| session_id | TEXT | Session identifier |
| status | TEXT | UNSET, OK, ERROR |
| span_count | INTEGER | Number of spans |
| total_duration_ms | REAL | Total duration |
| started_at | TEXT | ISO 8601 timestamp |
| completed_at | TEXT | ISO 8601 timestamp |

**spans table:**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| trace_id | TEXT | Foreign key |
| parent_id | TEXT | Parent span ID |
| name | TEXT | Span name |
| span_type | TEXT | agent.run, tool.call, etc. |
| start_time | INTEGER | Microseconds |
| end_time | INTEGER | Microseconds |
| duration_us | INTEGER | Duration |
| attributes | JSON | Metadata |
| status | TEXT | UNSET, OK, ERROR |
| events | JSON | Event list |

## Component Specifications

### TraceTerminal

Main container component that orchestrates the three-panel layout.

```tsx
interface TraceTerminalProps {
  jobId?: string;           // Optional: start from job
  traceId?: string;         // Optional: view specific trace
  onTraceSelect?: (id: string) => void;
}
```

### TraceSidebar (w-80)

Left panel with:
1. Stats grid (status, latency, token budget)
2. Recent traces list

```tsx
interface TraceSidebarProps {
  traces: TraceSummary[];
  selectedId?: string;
  stats: TraceStats;
  onSelect: (id: string) => void;
}

interface TraceStats {
  status: 'running' | 'idle';
  latency: number;
  latencyChange: number;
  tokenBudget: { used: number; total: number };
}

interface TraceSummary {
  id: string;
  name: string;
  status: 'active' | 'done' | 'error';
  preview: string;
  timestamp: Date;
  tokens: number;
}
```

### TraceTimeline (flex-1)

Center panel with visual timeline showing:
1. User input
2. Agent thoughts
3. Tool calls
4. Final output

```tsx
interface TraceTimelineProps {
  trace: Trace | null;
  isStreaming: boolean;
  onExpandAll: () => void;
  onRerun: () => void;
}

interface Trace {
  id: string;
  name: string;
  status: 'UNSET' | 'OK' | 'ERROR';
  spans: Span[];
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs: number;
}

interface Span {
  id: string;
  parentId?: string;
  name: string;
  spanType: 'agent.run' | 'tool.call' | 'model.request' | 'model.response';
  startTime: number;
  endTime?: number;
  durationUs?: number;
  attributes: Record<string, unknown>;
  status: 'UNSET' | 'OK' | 'ERROR';
  events: SpanEvent[];
  children: Span[];
}

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}
```

### TraceLogStream (w-96)

Right panel with raw JSON log stream:
- Color-coded log levels (INFO, DEBUG, WARN, SUCCESS)
- Timestamps
- Auto-scrolling
- Pause/download controls

```tsx
interface TraceLogStreamProps {
  logs: LogEntry[];
  isPaused: boolean;
  onPauseToggle: () => void;
  onDownload: () => void;
}

interface LogEntry {
  level: 'INFO' | 'DEBUG' | 'WARN' | 'SUCCESS';
  timestamp: Date;
  content: Record<string, unknown>;
}
```

### SpanNode

Individual span visualization in timeline:

```tsx
interface SpanNodeProps {
  span: Span;
  depth: number;
  startTime: number;  // For calculating relative timestamps
  isExpanded: boolean;
  onToggle: () => void;
}
```

## API Endpoints

### GET /api/traces

List traces with optional filtering.

**Query Parameters:**
- `userId` - Filter by user
- `sessionId` - Filter by session
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "traces": [
    {
      "id": "uuid",
      "name": "agent_run",
      "user_id": "user123",
      "status": "OK",
      "span_count": 5,
      "total_duration_ms": 1500.0,
      "started_at": "2026-02-17T12:00:00Z",
      "completed_at": "2026-02-17T12:00:01.5Z"
    }
  ]
}
```

### GET /api/traces/:id

Get full trace with spans.

**Response:**
```json
{
  "trace": {
    "id": "uuid",
    "name": "agent_run",
    "status": "OK",
    "spans": [
      {
        "id": "span-uuid",
        "parent_id": null,
        "name": "agent.run:research",
        "span_type": "agent.run",
        "start_time": 1234567890000000,
        "end_time": 1234567891500000,
        "duration_us": 1500000,
        "attributes": { "agent.model": "minimax-m2.5" },
        "status": "OK",
        "events": []
      }
    ]
  }
}
```

## Job Integration

### Agent Job Type

New job type: `agent.run`

**Payload:**
```json
{
  "type": "agent.run",
  "agent": "research" | "coding" | "analysis" | "orchestrator",
  "prompt": "User prompt text",
  "model": "openrouter:minimax/minimax-m2.5",
  "options": {
    "streaming": true,
    "maxTokens": 2000
  }
}
```

**Result:**
```json
{
  "success": true,
  "trace_id": "uuid",
  "output": { /* agent-specific output */ },
  "duration_ms": 1500
}
```

## Styling Guidelines

### Tailwind Classes (from design)

```css
/* Backgrounds */
.bg-background-dark  /* #101d22 */
.bg-background-light /* #f6f8f8 */
.bg-surface-dark     /* #1a262b */
.bg-surface-light    /* #ffffff */

/* Primary */
.text-primary        /* #11a4d4 */
.bg-primary          /* #11a4d4 */
.border-primary      /* #11a4d4 */

/* Status Colors */
.text-matrix-green   /* #0bda57 - success/active */
.bg-matrix-green     /* #0bda57 */
.text-warning-orange /* #ff6b00 - errors/warnings */
.bg-warning-orange   /* #ff6b00 */

/* Terminal Glow Effect */
.terminal-glow {
  box-shadow: 0 0 10px rgba(17, 164, 212, 0.1);
}

/* Fonts */
.font-display        /* Public Sans */
.font-mono           /* Monospace for code/logs */

/* Border Radius */
.rounded-sm          /* 0.125rem */
.rounded-lg          /* 0.25rem */
```

## Implementation Order

1. **Phase 1: Python Handler**
   - Create `AgentTraceHandler` in Python
   - Test with existing agent system

2. **Phase 2: TypeScript API**
   - Create trace API routes
   - Implement trace database reader

3. **Phase 3: React Components**
   - Build UI components from design
   - Integrate with job system

4. **Phase 4: Integration**
   - Connect all pieces
   - Add polling for real-time updates

## File Structure

```
python-workers/
├── handlers/
│   └── agent_trace.py     # NEW: Agent trace handler
└── tracing/               # EXISTING: Tracing system

src/
├── routes/api/
│   └── traces/
│       ├── index.ts       # NEW: List traces
│       └── $id.ts         # NEW: Get trace
├── components/tracing/    # NEW: UI components
│   ├── TraceTerminal.tsx
│   ├── TraceSidebar.tsx
│   ├── TraceTimeline.tsx
│   ├── TraceLogStream.tsx
│   ├── SpanNode.tsx
│   └── TraceStats.tsx
└── lib/
    └── hooks/
        └── use-traces.ts  # NEW: Trace fetching hook
```

## References

- Design: `design/tracing-design-concept.html`
- Python Tracing Docs: `python-workers/docs/tracing.md`
- Python Agent Docs: `python-workers/docs/agents.md`
- Job Queue Docs: `.docs/project/job-queue.md`
- Existing Components: `src/components/jobs/`
