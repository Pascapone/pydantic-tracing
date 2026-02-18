# Walkthrough: TypeScript Trace API Routes

**Task ID:** typescript-trace-api
**Erstellt:** 2026-02-17
**Status:** Abgeschlossen

## Implementierte Dateien

### 1. `src/lib/tracing/db.ts` - Database Reader Utility

**Zweck:** Liest Daten aus der Python Tracing SQLite-Datenbank (`traces.db`).

**Implementierte Funktionen:**

| Funktion | Beschreibung |
|----------|--------------|
| `tracesDbExists()` | Prüft ob `traces.db` existiert |
| `getTracesDb()` | Erstellt readonly SQLite-Verbindung |
| `listTraces(options)` | Listet Traces mit Filteroptionen |
| `getTrace(traceId)` | Holt einen einzelnen Trace |
| `getSpans(traceId)` | Holt alle Spans (flache Liste) |
| `getSpanTree(traceId)` | Holt Spans als hierarchischer Baum |
| `getTraceStats()` | Holt Statistiken |
| `getTraceWithSpans(traceId)` | Trace mit geparsten Spans |
| `getTraceWithTree(traceId)` | Trace mit nested Baum |

**Typen:**

```typescript
interface TraceRow {
  id: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  request_id: string | null;
  metadata: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'UNSET' | 'OK' | 'ERROR';
  span_count: number;
  total_duration_ms: number;
}

interface SpanRow {
  id: string;
  trace_id: string;
  parent_id: string | null;
  name: string;
  kind: string;
  span_type: string | null;
  start_time: number;  // microseconds
  end_time: number | null;
  duration_us: number | null;
  attributes: string | null;
  status: 'UNSET' | 'OK' | 'ERROR';
  status_message: string | null;
  events: string | null;
  created_at: string;
}

interface SpanWithChildren extends Omit<SpanRow, 'attributes' | 'events'> {
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  children: SpanWithChildren[];
}
```

### 2. `src/routes/api/traces/index.ts` - List Traces Endpoint

**Endpoint:** `GET /api/traces`

**Query Parameters:**
- `userId` - Filter nach User
- `sessionId` - Filter nach Session
- `limit` - Max Ergebnisse (default: 50)
- `offset` - Pagination (default: 0)
- `stats=true` - Statistiken zurückgeben

**Response Beispiele:**

```json
// GET /api/traces
{
  "traces": [
    {
      "id": "uuid",
      "name": "agent_run",
      "status": "OK",
      "span_count": 5,
      "total_duration_ms": 1500.0
    }
  ]
}

// GET /api/traces?stats=true
{
  "stats": {
    "trace_count": 10,
    "span_count": 50,
    "avg_duration_ms": 1234.5
  }
}
```

### 3. `src/routes/api/traces/$id.ts` - Single Trace Endpoint

**Endpoint:** `GET /api/traces/:id`

**Query Parameters:**
- `tree=true` - Nested Span Tree zurückgeben

**Response Beispiele:**

```json
// GET /api/traces/:id
{
  "trace": {
    "id": "uuid",
    "name": "agent_run",
    "status": "OK",
    "metadata": {},
    "spans": [
      {
        "id": "span-uuid",
        "parent_id": null,
        "name": "agent.run:research",
        "span_type": "agent.run",
        "attributes": { "agent.model": "minimax-m2.5" },
        "events": []
      }
    ]
  }
}

// GET /api/traces/:id?tree=true
{
  "trace": {
    "id": "uuid",
    "spans": [
      {
        "id": "root-span",
        "parent_id": null,
        "children": [
          {
            "id": "child-span",
            "parent_id": "root-span",
            "children": []
          }
        ]
      }
    ]
  }
}
```

## Implementierungsdetails

### JSON Parsing

Die `attributes` und `events` Felder werden als JSON-Strings in SQLite gespeichert. Sie werden automatisch geparst:

```typescript
// Safe parsing with fallback
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
```

### Span Tree Building Algorithmus

1. Alle Spans für `trace_id` laden
2. `span_map = {id -> span}` erstellen
3. `children` Arrays initialisieren
4. Für jeden Span: parent finden und zu dessen `children` hinzufügen
5. Root-Spans (ohne parent oder parent nicht in trace) zurückgeben
6. Children nach `start_time` sortieren

### Error Handling

| Situation | Response |
|-----------|----------|
| `traces.db` existiert nicht | 404 mit Message |
| Trace nicht gefunden | 404 mit traceId |
| JSON Parse Error | Fallback auf `{}` oder `[]` |

### Database Connection Pattern

Jeder Request öffnet eine neue readonly-Verbindung und schließt sie im `finally` Block:

```typescript
const db = getTracesDb();
if (!db) return [];
try {
  // Query
} finally {
  db.close();
}
```

## Testszenarien

| Request | Erwartetes Ergebnis |
|---------|---------------------|
| `GET /api/traces` | Liste aller Traces |
| `GET /api/traces?stats=true` | Statistiken |
| `GET /api/traces?userId=user1` | Gefilterte Liste |
| `GET /api/traces/:id` | Trace mit flachen Spans |
| `GET /api/traces/:id?tree=true` | Hierarchischer Baum |
| `GET /api/traces/nonexistent` | 404 Error |

## Probleme und Lösungen

### Problem: Database not found
**Lösung:** `tracesDbExists()` check und graceful 404 Response

### Problem: JSON Parse Errors
**Lösung:** `safeJsonParse()` mit Fallback-Werten

### Problem: Span Tree Reihenfolge
**Lösung:** Sortierung der Children nach `start_time`

## Referenzen

- Python Collector: `python-workers/tracing/collector.py`
- Job API Pattern: `src/routes/api/jobs/index.ts`
- Database Setup: `src/db/db.ts`
