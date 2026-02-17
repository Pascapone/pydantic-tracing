# Integration Guide

This document explains how to integrate the tracing system with your existing pydantic-ai projects.

---

## Quick Integration

### Step 1: Install Dependencies

```bash
pip install pydantic-ai
```

### Step 2: Copy Tracing Module

Copy the `tracing/` directory to your project:

```
your-project/
├── tracing/
│   ├── __init__.py
│   ├── spans.py
│   ├── collector.py
│   ├── processor.py
│   └── viewer.py
└── ...
```

### Step 3: Add Tracing to Agents

```python
from pydantic_ai import Agent
from tracing import get_tracer, SpanKind, SpanType

tracer = get_tracer("traces.db")

async def run_with_tracing(prompt: str):
    trace = tracer.start_trace("my_agent_run", user_id="user123")
    
    span = tracer.start_span(
        "agent.run:my_agent",
        kind=SpanKind.internal,
        span_type=SpanType.agent_run
    )
    
    agent = Agent("openrouter:minimax/minimax-m2.5")
    result = await agent.run(prompt)
    
    span.set_attribute("result.preview", str(result.output)[:100])
    tracer.end_span(span)
    tracer.end_trace()
    
    return result
```

---

## Integration Patterns

### Pattern 1: Decorator-Based

Create a decorator for automatic tracing:

```python
from functools import wraps
from tracing import get_tracer, SpanKind, SpanType

tracer = get_tracer("traces.db")

def traced(name: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            trace = tracer.start_trace(name)
            span = tracer.start_span(
                f"function:{func.__name__}",
                kind=SpanKind.internal
            )
            
            try:
                result = await func(*args, **kwargs)
                tracer.end_span(span)
                tracer.end_trace()
                return result
            except Exception as e:
                tracer.end_span(span)
                tracer.end_trace()
                raise
        
        return wrapper
    return decorator

# Usage
@traced("process_query")
async def process_query(query: str):
    agent = Agent("openrouter:minimax/minimax-m2.5")
    return await agent.run(query)
```

---

### Pattern 2: Context Manager

Use context managers for scoped tracing:

```python
from tracing import get_tracer, traced_agent, traced_tool

tracer = get_tracer("traces.db")

async def workflow():
    with traced_agent("orchestrator", "minimax-m2.5") as agent_span:
        result1 = await step1()
        agent_span.set_attribute("step1.result", result1)
        
        with traced_tool("search", {"query": "python"}) as tool_span:
            result2 = await search_web("python")
            tool_span.set_attribute("result.count", len(result2))
        
        return combine(result1, result2)
```

---

### Pattern 3: Middleware Integration

Integrate with web frameworks:

```python
from fastapi import Request
from tracing import get_tracer, SpanKind

tracer = get_tracer("traces.db")

@app.middleware("http")
async def tracing_middleware(request: Request, call_next):
    trace = tracer.start_trace(
        name=f"http:{request.method}:{request.url.path}",
        user_id=request.headers.get("X-User-ID"),
        session_id=request.headers.get("X-Session-ID")
    )
    
    span = tracer.start_span(
        f"http.request:{request.method}",
        kind=SpanKind.server,
        attributes={
            "http.method": request.method,
            "http.path": request.url.path,
            "http.query": str(request.query_params)
        }
    )
    
    response = await call_next(request)
    
    span.set_attribute("http.status_code", response.status_code)
    tracer.end_span(span)
    tracer.end_trace()
    
    return response
```

---

## Integration with Job Queue

The tracing system integrates with the existing BullMQ job system:

### Handler Integration

```python
# python-workers/handlers/traced_handler.py
from worker import JobHandler, JobContext
from tracing import get_tracer, SpanKind, SpanType

tracer = get_tracer("traces.db")

class TracedAIHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.traced"
    
    async def execute(self, ctx: JobContext, payload: dict) -> dict:
        trace = tracer.start_trace(
            name=f"job:{ctx.job_id}",
            user_id=payload.get("user_id"),
            metadata={"job_type": self.job_type}
        )
        
        span = tracer.start_span(
            f"job.execute:{self.job_type}",
            kind=SpanKind.internal,
            span_type=SpanType.agent_run,
            attributes={"job.id": ctx.job_id}
        )
        
        ctx.progress(10, "Starting...")
        
        try:
            # Execute AI task
            from pydantic_ai import Agent
            agent = Agent("openrouter:minimax/minimax-m2.5")
            result = await agent.run(payload["prompt"])
            
            ctx.progress(100, "Complete")
            
            span.set_attribute("result.length", len(str(result.output)))
            tracer.end_span(span)
            tracer.end_trace()
            
            return {"result": result.output}
            
        except Exception as e:
            tracer.end_span(span)
            tracer.end_trace()
            raise
```

---

## Custom Span Types

Define custom span types for your application:

```python
from tracing.spans import SpanType

# Extend SpanType enum (modify spans.py)
class CustomSpanType(str, Enum):
    # Built-in types
    agent_run = "agent.run"
    tool_call = "tool.call"
    
    # Custom types
    database_query = "database.query"
    cache_lookup = "cache.lookup"
    external_api = "external.api"
```

---

## Export to External Systems

### OpenTelemetry Export

```python
from tracing import TraceViewer

viewer = TraceViewer("traces.db")

# Export single trace
otel_json = viewer.export_trace(trace_id, format="otel")

# Send to OTLP collector
import httpx
response = httpx.post(
    "http://localhost:4318/v1/traces",
    content=otel_json,
    headers={"Content-Type": "application/json"}
)
```

### Custom Export

```python
import json
from tracing import TraceViewer

viewer = TraceViewer("traces.db")

def export_to_elasticsearch():
    traces = viewer.list_recent_traces(limit=1000)
    
    for t in traces:
        full_trace = viewer.get_trace(t["id"])
        
        # Transform for Elasticsearch
        doc = {
            "trace_id": full_trace["id"],
            "name": full_trace["name"],
            "duration_ms": full_trace["total_duration_ms"],
            "spans": [
                {
                    "name": s["name"],
                    "duration_us": s["duration_us"],
                    "attributes": s["attributes"]
                }
                for s in full_trace["spans"]
            ],
            "@timestamp": full_trace["started_at"]
        }
        
        # Index to Elasticsearch
        es.index(index="traces", body=doc)
```

---

## Best Practices

### 1. Consistent Naming

Use consistent span naming conventions:

```python
# Good
"agent.run:research"
"tool.call:search_web"
"model.request:minimax-m2.5"

# Bad
"research agent"
"calling search"
"minimax"
```

### 2. Meaningful Attributes

Include useful attributes:

```python
span.set_attribute("agent.model", "minimax-m2.5")
span.set_attribute("agent.input_length", len(prompt))
span.set_attribute("agent.output_length", len(result.output))
span.set_attribute("user.id", user_id)
span.set_attribute("request.id", request_id)
```

### 3. Error Handling

Always handle errors in traces:

```python
try:
    result = await agent.run(prompt)
    tracer.end_trace()
except Exception as e:
    tracer.record_exception(e)
    tracer.end_trace()  # Status automatically set to ERROR
    raise
```

### 4. Performance

- Use batch writes for high-volume tracing
- Limit span attributes to essential data
- Archive old traces periodically

---

## Performance Considerations

### Database Size

Monitor database size:

```python
import os

db_size_mb = os.path.getsize("traces.db") / (1024 * 1024)
print(f"Database size: {db_size_mb:.2f} MB")
```

### Cleanup Old Traces

```python
import sqlite3
from datetime import datetime, timedelta

def cleanup_old_traces(days: int = 30):
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    
    conn = sqlite3.connect("traces.db")
    conn.execute("DELETE FROM spans WHERE trace_id IN (SELECT id FROM traces WHERE started_at < ?)", (cutoff,))
    conn.execute("DELETE FROM traces WHERE started_at < ?", (cutoff,))
    conn.commit()
    
    # Vacuum to reclaim space
    conn.execute("VACUUM")
    conn.close()
```

### Connection Pooling

For high-concurrency applications:

```python
from threading import Lock
import sqlite3

class ConnectionPool:
    def __init__(self, db_path: str, pool_size: int = 5):
        self.db_path = db_path
        self.pool = []
        self.lock = Lock()
    
    def get_connection(self) -> sqlite3.Connection:
        with self.lock:
            if self.pool:
                return self.pool.pop()
            return sqlite3.connect(self.db_path)
    
    def return_connection(self, conn: sqlite3.Connection):
        with self.lock:
            if len(self.pool) < self.pool_size:
                self.pool.append(conn)
            else:
                conn.close()
```

---

## Troubleshooting

### Database Locked

```python
# Increase timeout
conn = sqlite3.connect("traces.db", timeout=30.0)

# Or use WAL mode
conn.execute("PRAGMA journal_mode=WAL")
```

### Memory Usage

For large traces, consider streaming:

```python
# Instead of loading all spans at once
def stream_spans(trace_id: str):
    conn = sqlite3.connect("traces.db")
    cursor = conn.execute(
        "SELECT * FROM spans WHERE trace_id = ?",
        (trace_id,)
    )
    
    for row in cursor:
        yield row
    
    conn.close()
```

---

## Migration from Logfire

If migrating from Logfire:

1. **Span names**: Compatible format
2. **Attributes**: Use dot-notation
3. **Export**: Convert to OTel format for external systems

```python
# Logfire style
logfire.span("agent_run", model="gpt-4")

# This tracing system
tracer.start_span(
    "agent.run:my_agent",
    attributes={"model.name": "gpt-4"}
)
```
