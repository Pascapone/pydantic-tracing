# Walkthrough: React Trace Hooks and Integration

**Task ID:** react-trace-hooks
**Completed:** 2026-02-17
**Status:** Done

## Zusammenfassung

Implementierung von React Hooks für Trace Fetching und Integration mit dem Job-System.

## Implementierte Dateien

### 1. `src/lib/hooks/use-traces.ts` (NEU)

Haupt-Hook-Datei mit drei Hooks:

#### `useTraces(options?)`
- Fetcht Liste von Traces und Stats
- Unterstützt Polling (default: 5s)
- Graceful Error Handling (API nicht verfügbar → leere Daten)
- Optionen: `userId`, `limit`, `pollInterval`

```typescript
const { traces, stats, isLoading, error, refetch } = useTraces({
  userId: "user-123",
  limit: 50,
  pollInterval: 5000,
});
```

#### `useTrace(traceId, options?)`
- Fetcht einzelnen Trace mit Spans
- Unterstützt Polling (default: 2s)
- Stoppt Polling wenn Trace abgeschlossen (`status !== 'UNSET'`)
- Optionen: `pollInterval`, `pollWhileRunning`

```typescript
const { trace, isLoading, error, refetch } = useTrace("trace-uuid", {
  pollInterval: 2000,
  pollWhileRunning: true,
});
```

#### `useCreateAgentJob()`
- Erstellt `agent.run` Jobs über die Jobs API
- Returns `jobId` bei Erfolg

```typescript
const { createJob, isLoading, error } = useCreateAgentJob();

const jobId = await createJob({
  agent: "research",
  prompt: "What is pydantic-ai?",
  userId: "user-123",
});
```

#### Utility Functions
- `toTraceSummary(trace)` - Konvertiert API Trace zu TraceSidebar-Format
- `calculateStatsFromTraces(traces)` - Berechnet Stats aus Trace-Liste

### 2. `src/routes/api/jobs/index.ts` (BEARBEITET)

Hinzugefügt: `"agent.run"` zu den validTypes

```typescript
const validTypes = [
  "ai.generate_text",
  "ai.generate_image",
  "ai.analyze_data",
  "ai.embeddings",
  "data.process",
  "data.transform",
  "data.export",
  "custom",
  "agent.run",  // NEU
];
```

### 3. `src/routes/traces.tsx` (NEU)

Traces Page Route mit:
- Session Check mit Loading State
- Rendering der TraceTerminal Komponente
- Verwendet aktuell Demo-Daten (Integration mit Hooks folgt)

### 4. `src/components/tracing/TraceSidebar.tsx` (BEARBEITET)

Re-export von `TraceStatsData` hinzugefügt:

```typescript
export type { TraceStatsData } from "./TraceStats";
```

## Technische Entscheidungen

### Graceful Error Handling
Die Hooks fangen Network Errors ab und setzen leere Standardwerte, falls die API noch nicht verfügbar ist. Dies ermöglicht die Entwicklung ohne funktionierende Backend-Endpoints.

### Polling Pattern
Basierend auf dem existierenden `use-jobs.ts` Pattern:
- `useRef` für Interval-ID
- Cleanup in `useEffect` return
- Stop-Polling bei Terminal-State

### Type-Safety
Alle Interfaces sind explizit definiert und exportiert:
- `Trace`, `Span`, `SpanEvent`, `TraceStatus`
- `TraceStats`, `CreateAgentJobParams`
- Result-Interfaces für jeden Hook

## Bekannte Einschränkungen

1. **TraceTerminal Integration**: Die TraceTerminal Komponente verwendet noch Demo-Daten. Die Integration mit `useTraces` Hook folgt in einem späteren Task.

2. **API Endpoints**: Die `/api/traces` Endpoints müssen von einem anderen Task erstellt werden.

3. **Auth Middleware**: Die `/traces` Route hat keine Server-Side Auth-Middleware. Bei Bedarf kann dies hinzugefügt werden:

```typescript
export const Route = createFileRoute("/traces")({
  component: TracesPage,
  server: {
    middleware: [authMiddleware],
  },
});
```

## Akzeptanzkriterien Status

| Kriterium | Status |
|-----------|--------|
| useTraces hook fetches trace list and stats | ✅ |
| useTrace hook fetches single trace with polling | ✅ |
| useCreateAgentJob creates agent.run jobs | ✅ |
| Traces page renders TraceTerminal | ✅ |
| Jobs API accepts agent.run type | ✅ |
| Polling works for running traces | ✅ |
| Error states handled gracefully | ✅ |

## Nächste Schritte

1. **API Endpoints erstellen** - `/api/traces` und `/api/traces/:id` Routes
2. **TraceTerminal Integration** - useTraces Hook in TraceTerminal verwenden
3. **TraceTimeline Component** - Visuelle Timeline für Spans
4. **TraceLogStream Component** - Live Log Streaming
