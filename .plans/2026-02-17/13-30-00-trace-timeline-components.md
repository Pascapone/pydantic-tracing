# Implementierungsplan: Trace Timeline & Log Components

**Task:** react-trace-components-timeline  
**Erstellt:** 2026-02-17 13:30:00  
**Status:** In Progress

## Übersicht

Implementierung der Timeline- und Log-Komponenten für das Trace Terminal basierend auf dem Design `design/tracing-design-concept.html`.

## Deliverables

1. `src/components/tracing/TraceTimeline.tsx` - Center Panel
2. `src/components/tracing/SpanNode.tsx` - Individual Span Visualization
3. `src/components/tracing/TraceLogStream.tsx` - Right Panel mit Logs
4. `src/types/tracing.ts` - TypeScript Type-Definitionen

## Technische Details

### Type-Definitionen

```typescript
// Span Types
type SpanType = 'agent.run' | 'tool.call' | 'model.request' | 'model.response' | 'agent.delegation' | 'user_input';
type SpanStatus = 'UNSET' | 'OK' | 'ERROR';
type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'SUCCESS' | 'ERROR';

interface Span {
  id: string;
  parentId?: string;
  name: string;
  spanType: SpanType;
  startTime: number;  // microseconds
  endTime?: number;
  durationUs?: number;
  attributes: Record<string, unknown>;
  status: SpanStatus;
  events: SpanEvent[];
  children?: Span[];
}

interface Trace {
  id: string;
  name: string;
  status: SpanStatus;
  spans: Span[];
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs: number;
}

interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  content: Record<string, unknown>;
}
```

### Span Type Visualisierung

| spanType | Icon | Color | Label |
|----------|------|-------|-------|
| agent.run | psychology | primary | Agent Run |
| tool.call | bolt | purple | Tool Call |
| model.request | smart_toy | blue | Model Request |
| model.response | output | matrix-green | Model Response |
| agent.delegation | hub | amber | Agent Delegation |
| user_input | person | slate | User Input |

### Log Level Colors

| Level | Border Color | Background | Text Color |
|-------|-------------|------------|------------|
| INFO | primary | transparent | primary |
| DEBUG | slate-700 | transparent (50% opacity) | slate-400 |
| WARN | warning-orange | warning-orange/5 | warning-orange |
| SUCCESS | matrix-green | matrix-green/5 | matrix-green |
| ERROR | red-500 | red-500/5 | red-500 |

### Timestamp-Formatierung

Relative Zeit vom Trace-Start:
- `00:00.000` (Start)
- `00:00.120 (+120ms)` (Relativ zum vorherigen)

## Implementierungsschritte

### Schritt 1: Type-Definitionen
- Erstelle `src/types/tracing.ts` mit allen Interfaces

### Schritt 2: SpanNode Component
- Icon-Mapping für Span-Types
- Timestamp-Berechnung
- Visual States (Active, Error, Success)
- Expandable Content

### Schritt 3: TraceTimeline Component
- Header mit Expand All und Re-run Buttons
- Vertikale Linie
- Span-Rendering mit relativen Timestamps
- Hierarchische Darstellung (nested spans)

### Schritt 4: TraceLogStream Component
- Color-coded Log Items
- JSON Syntax Highlighting
- Auto-Scroll
- Pause/Download Controls
- Streaming Indicator

## Tailwind Custom Colors (aus Design)

```css
primary: #11a4d4
matrix-green: #0bda57
warning-orange: #ff6b00
background-dark: #101d22
surface-dark: #1a262b
```

## Dependencies

- lucide-react für Icons (bereits vorhanden)
- Keine zusätzlichen Dependencies nötig

## Testing-Checkliste

- [ ] Timeline zeigt vertikale Linie mit Spans
- [ ] SpanNode rendert verschiedene Span-Types korrekt
- [ ] Relative Timestamps werden korrekt berechnet
- [ ] Log Stream zeigt color-coded Einträge
- [ ] Auto-Scroll funktioniert
- [ ] Dark Mode Styling ist korrekt
- [ ] Streaming Indicator animiert
