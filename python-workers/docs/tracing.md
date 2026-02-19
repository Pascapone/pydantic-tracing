# Tracing System Documentation

This document covers the custom tracing system for pydantic-ai agents with SQLite storage.

## Overview

The tracing system captures detailed information about agent execution:

- **Traces**: Top-level containers for agent runs
- **Spans**: Hierarchical units of work (agent runs, tool calls, model requests)
- **Events**: Point-in-time annotations during execution
- **Attributes**: Key-value metadata on spans

## Architecture

```
+------------------+     +------------------+     +------------------+
|   PydanticAI     |     |     Tracer       |     |    Collector     |
|     Agent        |---->|  (context mgmt)  |---->|    (SQLite)      |
+------------------+     +------------------+     +------------------+
                                |                         |
                                v                         v
                         +-----------+            +-------------+
                         |   Spans   |            |   traces    |
                         +-----------+            +-------------+
                         |   Events  |            |   spans     |
                         +-----------+            +-------------+
```

---

## Core Concepts

### Traces

A **trace** represents a complete agent execution session. It contains:

- Unique identifier (UUID)
- User/session context
- Start and end timestamps
- List of spans
- Overall status (UNSET, OK, ERROR)

```python
trace = tracer.start_trace(
    name="my_agent_run",
    user_id="user123",
    session_id="session456",
    request_id="req789",
    metadata={"custom": "data"}
)
```

### Spans

A **span** represents a unit of work within a trace. Spans can be nested:

```python
span = tracer.start_span(
    name="tool.call:search_web",
    kind=SpanKind.internal,
    span_type=SpanType.tool_call,
    attributes={
        "tool.name": "search_web",
        "tool.arguments": {"query": "python"}
    }
)
```

### Events

**Events** are point-in-time annotations on spans:

```python
span.add_event("progress", {"percent": 50, "step": "processing"})
```

### Attributes

**Attributes** are key-value metadata on spans:

```python
span.set_attribute("result.count", 42)
span.set_attribute("model.name", "minimax-m2.5")
```

---

## API Reference

### Getting a Tracer

```python
from tracing import get_tracer

tracer = get_tracer("traces.db")  # SQLite database path
```

### Trace Management

#### Start a Trace

```python
trace = tracer.start_trace(
    name: str,                    # Trace name
    user_id: str = None,          # User identifier
    session_id: str = None,       # Session identifier
    request_id: str = None,       # Request identifier
    metadata: dict = None         # Custom metadata
) -> Trace
```

#### End a Trace

```python
tracer.end_trace(status: SpanStatus = SpanStatus.ok) -> Optional[Trace]
```

### Span Management

#### Start a Span

```python
span = tracer.start_span(
    name: str,                    # Span name (e.g., "agent.run:research")
    kind: SpanKind = SpanKind.internal,  # INTERNAL, CLIENT, SERVER, etc.
    span_type: SpanType = None,   # agent.run, tool.call, model.request, etc.
    attributes: dict = None       # Initial attributes
) -> Span
```

#### End a Span

```python
tracer.end_span(
    span: Span = None,            # Span to end (None = current)
    status: SpanStatus = SpanStatus.ok,
    message: str = None           # Status message (for errors)
) -> Optional[Span]
```

### Adding Data

#### Add Event

```python
tracer.add_event(
    name: str,                    # Event name
    attributes: dict = None       # Event attributes
)
```

#### Set Attribute

```python
tracer.set_attribute(
    key: str,                     # Attribute key
    value: Any                    # Attribute value (JSON-serializable)
)
```

### Context Information

```python
# Get current trace ID
trace_id = tracer.get_current_trace_id()

# Get current span ID
span_id = tracer.get_current_span_id()
```

---

## Context Managers

### traced_agent

Automatically wrap agent execution with tracing:

```python
from tracing import traced_agent

with traced_agent("research", "openrouter:minimax/minimax-m2.5", user_id="user1") as span:
    result = await agent.run("What is Python?")
    span.set_attribute("result.preview", result.output[:100])
```

The `traced_agent` decorator automatically:
- Creates an `agent.run:{name}` span
- Captures the final result in `attributes.output`
- Records timing and status

### traced_agent_run and delegated reasoning

Delegated sub-agent runs use `traced_agent_run` in `python-workers/tracing/processor.py`.

Recent behavior update:

- When a delegated run completes, reasoning is extracted from `result.all_messages()` and stored as explicit `model.reasoning` spans under the delegated `agent.run:*` span.
- The delegated `agent.run:*` span also records `trace.reasoning_span_count` when reasoning spans are captured.

This avoids losing reasoning visibility when `model.request` spans are filtered in the UI.

### traced_tool

Automatically wrap tool calls with tracing:

```python
from tracing import traced_tool

with traced_tool("search_web", {"query": "python"}) as span:
    results = await search_web("python")
    span.set_attribute("result.count", len(results))
```

---

## Provider Compatibility Notes

### OpenRouter streaming (`native_finish_reason`)

OpenRouter streamed chunks may omit `choices[*].native_finish_reason` in some provider routes.  
Current `pydantic-ai` OpenRouter chunk validation can treat this field as required, which may raise a validation error before agent execution completes.

Project-specific mitigation:

- `python-workers/tracing/openrouter_compat.py` patches OpenRouter streamed chunk validation by injecting `native_finish_reason=None` when missing.
- The patch is applied from `TracedModel.__init__` in `python-workers/tracing/wrappers.py`.

This keeps streaming runs stable while upstream schema behavior evolves.

---

## Database Schema

### traces Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | Trace name |
| `user_id` | TEXT | User identifier |
| `session_id` | TEXT | Session identifier |
| `request_id` | TEXT | Request identifier |
| `metadata` | JSON | Custom metadata |
| `started_at` | TEXT | ISO 8601 timestamp |
| `completed_at` | TEXT | ISO 8601 timestamp (nullable) |
| `status` | TEXT | UNSET, OK, or ERROR |
| `span_count` | INTEGER | Number of spans |
| `total_duration_ms` | REAL | Total duration in milliseconds |

### spans Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `trace_id` | TEXT | Foreign key to traces |
| `parent_id` | TEXT | Parent span ID (nullable) |
| `name` | TEXT | Span name |
| `kind` | TEXT | INTERNAL, CLIENT, SERVER, PRODUCER, CONSUMER |
| `span_type` | TEXT | agent.run, tool.call, model.request, model.response |
| `start_time` | INTEGER | Start time in microseconds |
| `end_time` | INTEGER | End time in microseconds (nullable) |
| `duration_us` | INTEGER | Duration in microseconds |
| `attributes` | JSON | Key-value attributes |
| `status` | TEXT | UNSET, OK, or ERROR |
| `status_message` | TEXT | Status message (for errors) |
| `events` | JSON | List of events |
| `created_at` | TEXT | ISO 8601 timestamp |

### Indexes

- `idx_spans_trace_id` - Lookup spans by trace
- `idx_spans_parent_id` - Build span hierarchy
- `idx_traces_user_id` - Filter by user
- `idx_traces_session_id` - Filter by session
- `idx_spans_name` - Search by span name
- `idx_spans_start_time` - Time-based queries

---

## Query Utilities

### TraceViewer

Query and visualize traces:

```python
from tracing import TraceViewer

viewer = TraceViewer(db_path="traces.db")
```

#### Get a Trace

```python
trace = viewer.get_trace(trace_id)
# Returns: dict with id, name, spans, status, duration, etc.
```

#### Get Span Tree

```python
tree = viewer.get_span_tree(trace_id)
# Returns: list of spans with nested children
```

#### List Traces

```python
# Recent traces
traces = viewer.list_recent_traces(limit=20)

# By user
traces = viewer.find_traces_by_user("user123")

# By session
traces = viewer.find_traces_by_session("session456")
```

#### Print Summary

```python
viewer.print_trace_summary(trace_id)
# Output:
# ============================================================
# Trace: my_agent_run
# ID: 5f4c025d-ed89-4dbb-aa0f-046af79fca73
# Status: OK
# Spans: 3
# Duration: 1901.88ms
# Started: 2026-02-17T20:29:26.103101
# Completed: 2026-02-17T20:29:28.022871
# ============================================================
# 
# [...] agent.run:research (1500.00ms)
#   -> agent.name: research
#   [OK] tool.call:search_web (500.00ms)
#     -> tool.name: search_web
```

#### Get Statistics

```python
stats = viewer.get_stats()
# Returns: {"trace_count": 10, "span_count": 25, "avg_duration_ms": 1500.0}
```

#### Export Traces

```python
# Export single trace to JSON
json_str = viewer.export_trace(trace_id, format="json")

# Export single trace to OpenTelemetry format
otel_str = viewer.export_trace(trace_id, format="otel")

# Export multiple traces to file
count = viewer.export_traces("output.json", user_id="user123", limit=100)
```

---

## Span Types

| Type | Constant | Description |
|------|----------|-------------|
| `agent.run` | `SpanType.agent_run` | Agent execution (run, run_sync) - stores final result in `attributes.output` |
| `agent.stream` | `SpanType.agent_stream` | Streaming agent execution |
| `tool.call` | `SpanType.tool_call` | Tool function invocation |
| `tool.result` | `SpanType.tool_result` | Tool return value |
| `model.request` | `SpanType.model_request` | LLM API request |
| `model.response` | `SpanType.model_response` | LLM API response (use `:final` suffix for final output) |
| `model.reasoning` | `SpanType.model_reasoning` | Model thinking/reasoning |
| `agent.delegation` | `SpanType.delegation` | Agent-to-agent delegation |
| `user.prompt` | `SpanType.user_prompt` | User input prompt |

## Span Kinds

| Kind | Constant | Description |
|------|----------|-------------|
| `INTERNAL` | `SpanKind.internal` | Internal operation |
| `CLIENT` | `SpanKind.client` | Outbound request (e.g., API call) |
| `SERVER` | `SpanKind.server` | Inbound request handler |
| `PRODUCER` | `SpanKind.producer` | Message producer |
| `CONSUMER` | `SpanKind.consumer` | Message consumer |

---

## Complete Example

```python
import asyncio
from pathlib import Path
from pydantic_ai import Agent
from pydantic import BaseModel

from tracing import (
    get_tracer, print_trace, TraceViewer,
    SpanKind, SpanType, SpanStatus
)

class Output(BaseModel):
    answer: str
    confidence: float

async def main():
    db_path = Path("traces.db")
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    # Create agent
    agent = Agent("openrouter:minimax/minimax-m2.5", output_type=Output)
    
    # Start trace
    trace = tracer.start_trace(
        name="complete_example",
        user_id="demo_user",
        session_id="demo_session",
        metadata={"example": "complete"}
    )
    
    # Start agent span
    agent_span = tracer.start_span(
        name="agent.run:demo",
        kind=SpanKind.internal,
        span_type=SpanType.agent_run,
        attributes={"agent.model": "minimax-m2.5"}
    )
    
    # Add event
    tracer.add_event("agent_start", {"prompt": "What is 2+2?"})
    
    # Run agent
    result = await agent.run("What is 2+2?")
    
    # Record results
    agent_span.set_attribute("result.answer", result.output.answer)
    agent_span.set_attribute("result.confidence", result.output.confidence)
    tracer.add_event("agent_complete", {"answer": result.output.answer})
    
    # End span and trace
    tracer.end_span(agent_span)
    tracer.end_trace()
    
    # View results
    print(f"Answer: {result.output.answer}")
    print(f"Confidence: {result.output.confidence}")
    print()
    print_trace(trace.id, str(db_path))
    
    # Query stats
    stats = viewer.get_stats()
    print(f"Total traces: {stats['trace_count']}")
    print(f"Total spans: {stats['span_count']}")

asyncio.run(main())
```

---

## OpenTelemetry Compatibility

The tracing system is designed to be compatible with OpenTelemetry:

1. **Span naming** follows OTel conventions
2. **Attributes** use dot-notation (e.g., `agent.name`)
3. **Export to OTel format** via `export_trace(trace_id, format="otel")`
4. **Timestamps** in microseconds since epoch

### OTel Export Example

```python
viewer = TraceViewer("traces.db")
otel_json = viewer.export_trace(trace_id, format="otel")

# Output is compatible with OTLP receivers
```

---

## Performance Considerations

1. **SQLite is file-based**: Suitable for development and moderate loads
2. **Connection pooling**: One connection per thread
3. **Batch writes**: Consider batching for high-volume tracing
4. **Index usage**: Queries use indexes efficiently

### Recommended Limits

| Metric | Recommended |
|--------|-------------|
| Spans per trace | < 1000 |
| Attributes per span | < 50 |
| Events per span | < 100 |
| Traces in database | < 100,000 |
