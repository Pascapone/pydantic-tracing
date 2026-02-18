# Walkthrough: Trace Timeline & Log Components

**Task:** react-trace-components-timeline  
**Datum:** 2026-02-17 13:30:00  
**Status:** Abgeschlossen

## Zusammenfassung

Implementierung der Timeline- und Log-Komponenten für das Trace Terminal basierend auf dem Design `design/tracing-design-concept.html`.

## Erstellte Dateien

### 1. `src/types/tracing.ts`
TypeScript Type-Definitionen für alle Tracing-Komponenten:
- `SpanType`, `SpanStatus`, `LogLevel`, `TraceStatus`
- `Span`, `Trace`, `LogEntry`, `SpanEvent`
- `TraceSummary`, `TraceStats`
- Props-Interfaces für alle Komponenten

### 2. `src/components/tracing/SpanNode.tsx`
Individuelle Span-Visualisierung mit:
- **Icon-Mapping** für verschiedene Span-Types:
  - `agent.run` → Brain icon (primary color)
  - `tool.call` → Bolt icon (purple)
  - `model.request` → Bot icon (blue)
  - `model.response` → ArrowDownToLine icon (matrix-green)
  - `agent.delegation` → GitBranch icon (amber)
  - `user_input` → User icon (slate)
- **Relative Timestamps** (`00:00.120 (+120ms)`)
- **Status-basiertes Styling** (Active, Error, Success)
- **Expandable Content** mit verschiedenen Render-Modi je nach Span-Type
- **Hierarchische Darstellung** für nested spans

### 3. `src/components/tracing/TraceTimeline.tsx`
Center Panel mit:
- **Header** mit Expand All und Re-run Buttons
- **Status Badges** (Active, Done, Errors counts)
- **Vertikale Timeline** mit verbundener Linie
- **Span Tree Builder** für hierarchische Darstellung
- **Auto-Scroll** bei Streaming
- **Empty State** wenn kein Trace ausgewählt
- **Streaming Indicator** am Ende der Timeline
- **Footer** mit Total Duration

### 4. `src/components/tracing/TraceLogStream.tsx`
Right Panel mit:
- **Color-coded Log Levels**:
  - INFO: primary border
  - DEBUG: slate-700 (50% opacity)
  - WARN: warning-orange
  - SUCCESS: matrix-green
  - ERROR: red-500
- **JSON Syntax Highlighting** (keys: purple, strings: green, numbers: blue, booleans: yellow)
- **Auto-Scroll** wenn nicht pausiert
- **Pause/Download Controls**
- **Streaming Indicator** am Ende
- **Footer** mit Log Count und PAUSED indicator

### 5. `src/components/tracing/index.ts` (aktualisiert)
Exports für alle neuen Komponenten und Types.

## Technische Details

### Timestamp-Berechnung
```typescript
// Microseconds to relative time
const formatRelativeTime = (currentUs, startUs, prevUs) => {
  const diffMs = (currentUs - startUs) / 1000;
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  const milliseconds = Math.floor(diffMs % 1000);
  
  const baseTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  
  if (prevUs !== undefined) {
    const deltaMs = Math.round((currentUs - prevUs) / 1000);
    return `${baseTime} (+${deltaMs}ms)`;
  }
  
  return baseTime;
};
```

### Span Tree Builder
```typescript
// Build hierarchical structure from flat spans array
const buildSpanTree = (spans: Span[]): Span[] => {
  const spanMap = new Map<string, Span>();
  const rootSpans: Span[] = [];
  
  // First pass: create map
  spans.forEach(span => {
    spanMap.set(span.id, { ...span, children: [] });
  });
  
  // Second pass: build tree
  spans.forEach(span => {
    const currentSpan = spanMap.get(span.id)!;
    if (span.parentId) {
      const parent = spanMap.get(span.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(currentSpan);
      } else {
        rootSpans.push(currentSpan);
      }
    } else {
      rootSpans.push(currentSpan);
    }
  });
  
  return rootSpans.sort((a, b) => a.startTime - b.startTime);
};
```

### JSON Syntax Highlighting
Einfacher Tokenizer-Ansatz für syntax highlighting:
- Purple für JSON keys
- Green für string values
- Blue für numbers
- Yellow für booleans
- Slate für null

## Bekannte Einschränkungen

1. **JSON Highlighting** ist ein vereinfachter Tokenizer - für komplexe JSON-Strukturen könnte eine echte Parser-Bibliothek wie `react-json-view` oder `json-bigint` besser sein.

2. **Auto-Scroll** basiert auf `shouldAutoScroll.current` - der User kann das Scrollen unterbrechen, indem er nach oben scrollt.

3. **Download** speichert als `.txt` Datei - könnte erweitert werden um JSON export.

## Nächste Schritte

1. Integration mit `TraceTerminal.tsx` (bereits vorhanden)
2. API-Endpoints für `/api/traces` erstellen
3. Hook `use-traces.ts` implementieren
4. Testing mit echten Trace-Daten

## Lint-Status

Keine Lint-Fehler in den neuen Dateien. Die Python-Lint-Fehler in anderen Dateien sind nicht Teil dieses Tasks.
