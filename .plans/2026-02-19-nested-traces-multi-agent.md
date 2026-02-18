# Nested Traces für Multi-Agent-Delegation

**Created:** 2026-02-19
**Status:** Completed

## Problem-Zusammenfassung

Aktuell werden die `delegate_*` Tools im Orchestrator als **flache Tool Calls** gerendert. Die interne Ausführung des Sub-Agents (seine eigenen Tool Calls, Model Requests, etc.) wird nicht sichtbar. Für ein echtes Multi-Agent-System brauchen wir **nested traces** mit Hierarchie.

## Architektur-Analyse

**Current Flow:**
```
orchestrator.run()
  └── tool.call:delegate_research      ← wird gerendert
      └── (sub-agent läuft intern)      ← NICHT sichtbar
  └── tool.result                       ← wird gerendert
```

**Desired Flow:**
```
orchestrator.run()
  └── agent.delegation:research         ← Neuer Span-Typ
      └── agent.run:research            ← Sub-Agent Execution
          ├── tool.call:web_search
          ├── tool.call:fetch_url
          └── model.response:final
```

## Design-Entscheidungen

| Aspekt | Entscheidung |
|--------|-------------|
| **UI-Design** | Linien + Collapse-Buttons pro Ebene |
| **Tool Rendering** | Gleicher Style, aber indentiert nach Hierarchie |
| **Delegation** | Neuer Span-Typ `agent.delegation` mit nested Children |

---

## Phase 1: Python Backend

### 1.1 Context-Manager für Delegation

**Datei:** `python-workers/tracing/processor.py`

Neuer `traced_delegation` Context-Manager:
- Erstellt `agent.delegation:{target}` Span
- Setzt automatisch parent_id basierend auf aktuellem Span
- Sub-Agent Spans landen automatisch darunter

### 1.2 Orchestrator-Delegation aktualisieren

**Datei:** `python-workers/agents/orchestrator.py`

Die `delegate_*` Funktionen wrappen den Sub-Agent-Aufruf mit `traced_delegation`:
- `delegate_research` → `traced_delegation("research", query)`
- `delegate_coding` → `traced_delegation("coding", task)`
- `delegate_analysis` → `traced_delegation("analysis", data)`

### 1.3 Sub-Agent Tracing

**Datei:** `python-workers/agents/research.py`, `coding.py`, `analysis.py`

Sub-Agents müssen den **gleichen Tracer-Context** verwenden:
- `tracer.start_span()` ohne explizites `parent_id` → nimmt automatisch aktuellen Span als Parent
- Context-Variable hält den aktuellen Span-Stack

---

## Phase 2: UI Components

### 2.1 SpanNode.tsx - Hierarchische Visualisierung

**Änderungen:**

1. **Indentation + Vertikale Linien:**
   - `depth` prop für Einrückung
   - Vertikale Linie links für Parent-Verbindung
   - Border-left für Children-Bereich

2. **`agent.delegation` spezielles Rendering:**
   - Header mit Target-Agent Info
   - Query-Preview
   - Children werden indentiert dargestellt

### 2.2 TraceTimeline.tsx

- Keine größeren Änderungen nötig
- Hierarchie wird über `parent_id` aufgebaut
- Root-Level Spans mit `depth={0}` rendern

---

## Phase 3: Testing

### 3.1 Neues Beispiel

**Datei:** `python-workers/examples/07_nested_traces.py`

Test mit Orchestrator, der mehrere Delegations triggert.

### 3.2 Erwarteter Trace-Tree

```
agent.run:orchestrator
├── agent.delegation:research
│   ├── agent.run:research
│   │   ├── tool.call:web_search
│   │   ├── tool.call:get_url_content
│   │   └── model.response:final
├── agent.delegation:coding
│   ├── agent.run:coding
│   │   ├── tool.call:write_file
│   │   └── model.response:final
└── model.response:final
```

---

## Zu ändernde Dateien

| Datei | Änderung | Priorität |
|-------|----------|-----------|
| `python-workers/tracing/processor.py` | `traced_delegation` Context-Manager | Hoch |
| `python-workers/agents/orchestrator.py` | Delegation mit Tracing wrappen | Hoch |
| `python-workers/agents/research.py` | Tracing für Sub-Agent | Hoch |
| `python-workers/agents/coding.py` | Tracing für Sub-Agent | Hoch |
| `python-workers/agents/analysis.py` | Tracing für Sub-Agent | Hoch |
| `src/components/tracing/SpanNode.tsx` | Hierarchie-Rendering mit Linien | Hoch |
| `python-workers/examples/07_nested_traces.py` | Test-Beispiel | Mittel |

---

## Implementation Checklist

- [x] Python: `traced_delegation` Context-Manager in `processor.py`
- [x] Python: Orchestrator `delegate_*` Funktionen mit Tracing
- [x] Python: Sub-Agents mit Tracing instrumentieren
- [x] Python: Test-Beispiel `07_nested_traces.py`
- [x] UI: `SpanNode.tsx` Hierarchie-Rendering
- [x] UI: `agent.delegation` spezielles Rendering
- [x] Testing: End-to-End Test mit UI
