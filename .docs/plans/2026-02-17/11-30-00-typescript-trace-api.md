# Implementierungsplan: TypeScript Trace API Routes

**Task ID:** typescript-trace-api
**Erstellt:** 2026-02-17 11:30
**Status:** Zur Prüfung

## Überblick

Implementierung von TypeScript API Routes zum Lesen der Python-Tracing SQLite-Datenbank.

## Deliverables

1. `src/lib/tracing/db.ts` - Database Reader Utility
2. `src/routes/api/traces/index.ts` - List Traces Endpoint
3. `src/routes/api/traces/$id.ts` - Get Single Trace Endpoint

## Implementierungsschritte

### 1. Database Reader Utility (`src/lib/tracing/db.ts`)

**Funktionen:**
- `getTracesDb()` - Erstellt SQLite-Verbindung zu `traces.db`
- `listTraces(options)` - Listet Traces mit Filteroptionen
- `getTrace(traceId)` - Holt einen einzelnen Trace
- `getSpans(traceId)` - Holt alle Spans für einen Trace
- `getSpanTree(traceId)` - Holt Spans als hierarchischer Baum
- `getTraceStats()` - Holt Statistiken

**Typen:**
- `TraceRow` - Trace-Datensatz
- `SpanRow` - Span-Datensatz
- `SpanWithChildren` - Span mit nested children

**Error Handling:**
- Graceful handling wenn `traces.db` nicht existiert
- JSON Parsing für `attributes` und `events` Felder

### 2. List Traces Endpoint (`src/routes/api/traces/index.ts`)

**Query Parameters:**
- `userId` - Filter nach User
- `sessionId` - Filter nach Session
- `limit` - Max Ergebnisse (default: 50)
- `offset` - Pagination
- `stats=true` - Statistiken zurückgeben

**Response Format:**
```json
{
  "traces": [...],
  "stats": { "trace_count": 10, "span_count": 50, "avg_duration_ms": 1500 }
}
```

### 3. Single Trace Endpoint (`src/routes/api/traces/$id.ts`)

**Query Parameters:**
- `tree=true` - Nested Span Tree zurückgeben

**Response Format:**
```json
{
  "trace": {
    "id": "uuid",
    "name": "agent_run",
    "status": "OK",
    "spans": [...]
  }
}
```

## Technische Details

### Datenbank-Schema (aus Python)

**traces Tabelle:**
- id (TEXT PRIMARY KEY)
- name, user_id, session_id, request_id
- metadata (JSON)
- started_at, completed_at
- status (UNSET, OK, ERROR)
- span_count, total_duration_ms

**spans Tabelle:**
- id (TEXT PRIMARY KEY)
- trace_id (FK), parent_id
- name, kind, span_type
- start_time, end_time, duration_us (Microseconds)
- attributes, events (JSON)
- status, status_message

### Span Tree Building

Algorithmus:
1. Alle Spans für trace_id laden
2. span_map = {id -> span} erstellen
3. children arrays initialisieren
4. Für jeden Span: parent finden und zu dessen children hinzufügen
5. Root-Spans (ohne parent oder parent nicht in trace) zurückgeben

### Error Handling

1. Datenbank nicht gefunden → 404 mit message
2. Trace nicht gefunden → 404
3. JSON Parse Errors → Fallback auf leere Objekte/Arrays

## Dateien

```
src/
├── lib/
│   └── tracing/
│       └── db.ts           # NEU: Database reader
└── routes/
    └── api/
        └── traces/
            ├── index.ts    # NEU: List traces
            └── $id.ts      # NEU: Single trace
```

## Abhängigkeiten

- `better-sqlite3` - Bereits installiert
- `@tanstack/react-router` - Bereits installiert

## Test-Szenarien

1. GET /api/traces → Liste aller Traces
2. GET /api/traces?stats=true → Statistiken
3. GET /api/traces?userId=user1 → Gefilterte Liste
4. GET /api/traces/:id → Einzelner Trace mit Spans
5. GET /api/traces/:id?tree=true → Hierarchischer Baum
6. GET /api/traces/nonexistent → 404 Error

## Geschätzter Aufwand

- Database Reader: 30 Min
- API Endpoints: 20 Min
- Testing & Debugging: 10 Min
- **Gesamt: ~60 Min**
