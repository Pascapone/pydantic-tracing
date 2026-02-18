# Implementierungsplan: React Trace Hooks and Integration

**Task ID:** react-trace-hooks
**Created:** 2026-02-17 11:30
**Status:** Ready for Review

## Übersicht

Implementierung von React Hooks für Trace Fetching und Integration mit dem Job-System.

## Analyse

### Vorhandene Komponenten
- `src/lib/hooks/use-jobs.ts` - Ähnliches Hook-Pattern mit Polling
- `src/routes/api/jobs/index.ts` - Jobs API (benötigt `agent.run` Typ)
- `src/components/tracing/TraceSidebar.tsx` - Existiert bereits
- `src/components/tracing/TraceStats.tsx` - Existiert bereits

### Fehlende Komponenten
- `src/lib/hooks/use-traces.ts` - Trace Fetching Hooks (Hauptaufgabe)
- `src/routes/traces.tsx` - Traces Page Route
- `src/components/tracing/TraceTerminal.tsx` - Hauptcontainer (muss für Page existieren)
- API Routes für `/api/traces` - werden von anderen Tasks erstellt

## Implementierungsplan

### Phase 1: use-traces.ts Hook erstellen

**Datei:** `src/lib/hooks/use-traces.ts`

Enthält:
1. **Interfaces:**
   - `Trace` - Trace-Datenmodell
   - `Span` - Span-Datenmodell
   - `SpanEvent` - Event-Datenmodell
   - `TraceStats` - Statistik-Datenmodell

2. **Hooks:**
   - `useTraces(options?)` - Liste Traces mit Stats und Polling
   - `useTrace(traceId, options?)` - Einzelner Trace mit Polling
   - `useCreateAgentJob()` - Erstelle Agent Jobs

### Phase 2: Jobs API erweitern

**Datei:** `src/routes/api/jobs/index.ts`

- Füge `agent.run` zu den validTypes hinzu

### Phase 3: TraceTerminal Component erstellen

**Datei:** `src/components/tracing/TraceTerminal.tsx`

Einfacher Wrapper der:
- TraceSidebar integriert
- Placeholder für Timeline und LogStream zeigt
- useTraces Hook verwendet

### Phase 4: Traces Page Route erstellen

**Datei:** `src/routes/traces.tsx`

- Auth-geschützte Route
- Verwendet TraceTerminal
- Session-Check mit Loading State

## Technische Details

### Polling-Verhalten
- `useTraces`: Polling alle 5s (konfigurierbar)
- `useTrace`: Polling alle 2s, stoppt wenn Trace abgeschlossen

### Error Handling
- Graceful Error States
- Error wird nicht geworfen, sondern zurückgegeben
- Loading States für alle Operationen

### API Endpunkte (werden von anderen Tasks erstellt)
- `GET /api/traces` - List traces
- `GET /api/traces/:id` - Get single trace with spans
- `GET /api/traces?stats=true` - Get trace statistics

## Abhängigkeiten

- Keine neuen externen Dependencies erforderlich
- Nutzt existierende Patterns aus `use-jobs.ts`

## Dateiübersicht

| Datei | Aktion |
|-------|--------|
| `src/lib/hooks/use-traces.ts` | Neu erstellen |
| `src/routes/api/jobs/index.ts` | Bearbeiten (1 Zeile) |
| `src/components/tracing/TraceTerminal.tsx` | Neu erstellen |
| `src/routes/traces.tsx` | Neu erstellen |

## Akzeptanzkriterien

- [ ] useTraces hook fetches trace list and stats
- [ ] useTrace hook fetches single trace with polling
- [ ] useCreateAgentJob creates agent.run jobs
- [ ] Traces page renders TraceTerminal
- [ ] Jobs API accepts agent.run type
- [ ] Polling works for running traces
- [ ] Error states handled gracefully
