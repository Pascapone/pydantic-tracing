# Task: React Trace Components - Part 1 (Core UI)

**Task ID:** react-trace-components-core
**Status:** Completed
**Created:** 2026-02-17
**Priority:** High

## Objective

Create the core React components for the Trace Terminal UI based on the design in `design/tracing-design-concept.html`.

## Context

The design concept shows an "Industrial Trace Terminal" with:
- Header with navigation and search
- Left sidebar with stats and trace list
- Center panel with timeline visualization
- Right sidebar with raw log stream

Reference `.specs/trace-integration.md` for component interfaces and styling guidelines.

## Deliverables

1. Create `src/components/tracing/TraceTerminal.tsx` - Main container
2. Create `src/components/tracing/TraceHeader.tsx` - Top navigation
3. Create `src/components/tracing/TraceSidebar.tsx` - Left panel with stats and list
4. Create `src/components/tracing/TraceStats.tsx` - Stats grid component

## Requirements

### Color Theme (Tailwind v4 Custom Colors)

Add to your tailwind config or use inline styles for custom colors:
```css
primary: #11a4d4
background-dark: #101d22
background-light: #f6f8f8
matrix-green: #0bda57
warning-orange: #ff6b00
surface-dark: #1a262b
surface-light: #ffffff
```

### TraceTerminal

Main container with three-column layout:

```tsx
interface TraceTerminalProps {
  jobId?: string;
  traceId?: string;
  onTraceSelect?: (id: string) => void;
}

// Layout structure:
// - Fixed header (h-16)
// - Three columns: w-80 | flex-1 | w-96
// - Dark mode by default
```

### TraceHeader

Top navigation bar (h-16) with:
- Logo with terminal icon
- Title "Trace Terminal v1.0"
- Global search input (placeholder: "Search Trace ID...")
- Navigation tabs (Dashboard, Traces, Settings)
- Notification and account buttons

### TraceSidebar (w-80)

Left panel with:
1. Stats grid (2x2)
   - Status card with pulsing indicator
   - Latency card with change indicator
   - Token budget with progress bar (spans 2 columns)
2. "Recent Traces" header
3. Scrollable trace list

```tsx
interface TraceSidebarProps {
  traces: TraceSummary[];
  selectedId?: string;
  stats: TraceStats;
  onSelect: (id: string) => void;
  isLoading?: boolean;
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

### TraceStats

Stats grid component with:

1. **Status Card:**
   - Label: "STATUS"
   - Pulsing green dot for running
   - Status text

2. **Latency Card:**
   - Label: "LATENCY"
   - Value in ms
   - Change indicator (▲/▼ with percentage)

3. **Token Budget Card:**
   - Label: "TOKEN BUDGET"
   - Used/Total text
   - Progress bar (primary color)

### Styling Notes

Use Material Symbols Outlined for icons:
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

Or use Lucide icons as fallback (already in project).

### Dark Mode

Default to dark mode. Apply these classes:
- Main bg: `bg-background-dark` (#101d22)
- Surface: `bg-surface-dark` (#1a262b)
- Borders: `border-slate-800`
- Text: `text-slate-100`

### Code Block Styling

For code/log content:
```css
.font-mono
.bg-[#0e1116]
.text-green-400
```

## Files to Reference

- `design/tracing-design-concept.html` - Full design reference
- `src/components/jobs/JobList.tsx` - Similar list component pattern
- `src/components/jobs/JobDetails.tsx` - Similar detail panel pattern

## Acceptance Criteria

1. TraceTerminal renders three-column layout
2. TraceHeader shows navigation and search
3. TraceSidebar shows stats grid and trace list
4. TraceStats shows all three stat cards correctly
5. Dark mode styling applied
6. Responsive considerations (sidebar collapse on mobile optional)
7. Material Symbols or Lucide icons used appropriately
