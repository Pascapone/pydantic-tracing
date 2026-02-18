# Task: React Trace Components - Part 2 (Timeline & Logs)

**Task ID:** react-trace-components-timeline
**Status:** Pending
**Created:** 2026-02-17
**Priority:** High

## Objective

Create the timeline visualization and log stream components for the Trace Terminal.

## Context

These are the center and right panels of the Trace Terminal design. The timeline shows agent execution flow as a vertical timeline with spans, and the log stream shows raw JSON output.

Reference `.specs/trace-integration.md` for component interfaces.

## Deliverables

1. Create `src/components/tracing/TraceTimeline.tsx` - Center panel
2. Create `src/components/tracing/SpanNode.tsx` - Individual span visualization
3. Create `src/components/tracing/TraceLogStream.tsx` - Right panel with logs

## Requirements

### TraceTimeline

Center panel (flex-1) with:

1. **Header (h-14):**
   - Icon + title "Active Execution Flow"
   - "Expand All" button
   - "Re-run" button with refresh icon

2. **Timeline Content:**
   - Vertical line (left side)
   - Span nodes with icons and timestamps
   - Relative time calculation

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
```

### SpanNode

Individual span visualization with:

1. **Node Icon (circular):**
   - User Input: person icon, gray
   - Agent Thought: psychology icon, primary color with glow
   - Tool Call: bolt icon, purple
   - Final Output: check icon, matrix-green

2. **Content Card:**
   - Header with type label and timestamp
   - Content area (code or text)
   - Optional: output section

3. **Visual States:**
   - Active: pulsing border, primary glow
   - Error: warning-orange border
   - Success: matrix-green border

```tsx
interface SpanNodeProps {
  span: Span;
  startTime: number;  // Base time for relative timestamps
  isExpanded?: boolean;
  onToggle?: () => void;
  depth?: number;  // For nested spans
}

interface Span {
  id: string;
  parentId?: string;
  name: string;
  spanType: 'agent.run' | 'tool.call' | 'model.request' | 'model.response' | 'agent.delegation';
  startTime: number;  // microseconds
  endTime?: number;
  durationUs?: number;
  attributes: Record<string, unknown>;
  status: 'UNSET' | 'OK' | 'ERROR';
  events: SpanEvent[];
  children?: Span[];
}
```

### Span Type Visualization

| spanType | Icon | Color | Label |
|----------|------|-------|-------|
| agent.run | psychology | primary | Agent Run |
| tool.call | bolt | purple | Tool Call |
| model.request | smart_toy | blue | Model Request |
| model.response | output | matrix-green | Model Response |
| agent.delegation | hub | amber | Agent Delegation |
| user_input | person | slate | User Input |

### Timestamp Formatting

Show relative time from trace start:
```
00:00.000  (start)
00:00.120 (+120ms)
00:00.450 (+330ms)
```

### TraceLogStream

Right panel (w-96) with:

1. **Header (h-10):**
   - "Raw Log Stream" title
   - Pause button
   - Download button

2. **Log Items:**
   - Color-coded by level
   - Timestamp
   - JSON content with syntax highlighting

3. **Streaming Indicator:**
   - Animate cursor at bottom when streaming

```tsx
interface TraceLogStreamProps {
  logs: LogEntry[];
  isPaused: boolean;
  isStreaming: boolean;
  onPauseToggle: () => void;
  onDownload: () => void;
}

interface LogEntry {
  level: 'INFO' | 'DEBUG' | 'WARN' | 'SUCCESS' | 'ERROR';
  timestamp: Date;
  content: Record<string, unknown>;
}
```

### Log Level Colors

| Level | Border Color | Background | Text Color |
|-------|-------------|------------|------------|
| INFO | primary | transparent | primary |
| DEBUG | slate-700 | transparent (50% opacity) | slate-400 |
| WARN | warning-orange | warning-orange/5 | warning-orange |
| SUCCESS | matrix-green | matrix-green/5 | matrix-green |
| ERROR | red-500 | red-500/5 | red-500 |

### JSON Syntax Highlighting

For log content:
```tsx
// Simple syntax highlighting
<span className="text-purple-400">"key"</span>: 
<span className="text-green-400">"value"</span>
<span className="text-blue-400">123</span>
<span className="text-yellow-300">"string"</span>
```

### Auto-Scroll

The log stream should auto-scroll to bottom unless paused.

## Files to Reference

- `design/tracing-design-concept.html` - Full design with visual examples
- `.specs/trace-integration.md` - Type definitions

## Acceptance Criteria

1. TraceTimeline shows vertical timeline with spans
2. SpanNode renders different span types with correct icons/colors
3. TraceLogStream shows color-coded log entries
4. Timestamps calculated correctly as relative times
5. Auto-scroll works when not paused
6. Dark mode styling applied
7. Streaming indicator animates when active
