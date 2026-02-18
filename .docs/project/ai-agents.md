# AI Agents & Tracing System

> Multi-agent system with pydantic-ai and custom observability for agent execution.

## Overview

The project includes a Python-based AI agent system built on [pydantic-ai](https://ai.pydantic.dev/) with a custom tracing system for observability. This is an **open-source alternative to Logfire** that provides self-hosted tracing with SQLite storage.

### Why This Exists

[Logfire](https://ai.pydantic.dev/logfire/) is pydantic-ai's official observability platform, but it's closed-source and requires a paid subscription. This system provides equivalent functionality with:

- **Self-hosted**: All data stays in your SQLite database
- **Open-source**: Full control over tracing infrastructure
- **OTel compatible**: Export to OpenTelemetry collectors

---

## Architecture

```
                    +-------------------+
                    |   Orchestrator    |
                    |     Agent         |
                    +-------------------+
                            |
           +----------------+----------------+
           |                |                |
           v                v                v
    +-----------+    +-----------+    +-------------+
    | Research  |    |   Code    |    |  Analysis   |
    |  Agent    |    |  Agent    |    |   Agent     |
    +-----------+    +-----------+    +-------------+
           |                |                |
           v                v                v
    +-----------+    +-----------+    +-------------+
    | Web Tools |    |Code Tools |    | Data Tools  |
    +-----------+    +-----------+    +-------------+
```

### Tracing Architecture

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

## Multi-Agent System

The agent system provides a comprehensive test bed for AI workflows:

| Agent | Purpose | Tools |
|-------|---------|-------|
| **Orchestrator** | Coordinates sub-agents for complex multi-step tasks | `delegate_research`, `delegate_coding`, `delegate_analysis` |
| **Research** | Web search, URL fetching, text summarization | `web_search`, `fetch_url`, `summarize_text` |
| **Coding** | Code generation, execution, analysis | `write_file`, `read_file`, `run_code`, `analyze_code` |
| **Analysis** | Data parsing, statistics, visualization | `parse_data`, `calculate_stats`, `generate_chart` |

### Key Capabilities

- **Agent Execution**: Sync, async, and streaming execution
- **Tool Calling**: Multiple tools with complex payloads
- **Structured Outputs**: Pydantic models for type-safe results
- **Agent Delegation**: Agents calling other agents as tools
- **Error Handling**: ModelRetry and error recovery
- **Message History**: Multi-turn conversation support

### Example Usage

```python
from agents import create_orchestrator, AgentDeps

orchestrator = create_orchestrator()
deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")

result = await orchestrator.run(
    "Research Python async best practices, write a demo function, and analyze its structure.",
    deps=deps
)

print(f"Status: {result.output.status}")
print(f"Subtasks: {len(result.output.subtasks)}")
print(f"Answer: {result.output.final_answer}")
```

---

## Tracing System

The tracing system captures detailed information about agent execution:

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Trace** | Top-level container for an agent run (UUID, user/session context, status) |
| **Span** | Hierarchical unit of work (agent runs, tool calls, model requests) |
| **Event** | Point-in-time annotation during execution |
| **Attribute** | Key-value metadata on spans |

### Span Types

| Type | Description |
|------|-------------|
| `agent.run` | Agent execution (run, run_sync) |
| `agent.stream` | Streaming agent execution |
| `tool.call` | Tool function invocation |
| `model.request` | LLM API request |
| `model.response` | LLM API response |
| `agent.delegation` | Agent-to-agent delegation |

### Quick Example

```python
from tracing import get_tracer, print_trace, SpanKind, SpanType

tracer = get_tracer("traces.db")

trace = tracer.start_trace("my_agent_run", user_id="user123")

span = tracer.start_span(
    "agent.run:research",
    kind=SpanKind.internal,
    span_type=SpanType.agent_run,
    attributes={"agent.model": "minimax-m2.5"}
)

result = await agent.run("What is pydantic-ai?")

span.set_attribute("result.preview", str(result.output)[:100])
tracer.end_span(span)
tracer.end_trace()

print_trace(trace.id, "traces.db")
```

---

## Integration with Job Queue

The agent system integrates with the BullMQ job queue for async processing:

```python
from worker import JobHandler, JobContext
from tracing import get_tracer, SpanKind, SpanType

tracer = get_tracer("traces.db")

class AIAgentHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.agent_run"

    async def execute(self, ctx: JobContext, payload: dict) -> dict:
        trace = tracer.start_trace(
            name=f"job:{ctx.job_id}",
            user_id=payload.get("user_id")
        )

        span = tracer.start_span(
            f"job.execute:{self.job_type}",
            kind=SpanKind.internal,
            span_type=SpanType.agent_run
        )

        ctx.progress(10, "Starting agent...")

        agent = create_research_agent()
        result = await agent.run(payload["prompt"])

        ctx.progress(100, "Complete")
        tracer.end_span(span)
        tracer.end_trace()

        return {"result": result.output}
```

---

## Database Schema

### traces Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | Trace name |
| `user_id` | TEXT | User identifier |
| `session_id` | TEXT | Session identifier |
| `status` | TEXT | UNSET, OK, or ERROR |
| `span_count` | INTEGER | Number of spans |
| `total_duration_ms` | REAL | Total duration |

### spans Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `trace_id` | TEXT | Foreign key to traces |
| `parent_id` | TEXT | Parent span ID (for hierarchy) |
| `name` | TEXT | Span name |
| `span_type` | TEXT | agent.run, tool.call, etc. |
| `attributes` | JSON | Key-value metadata |
| `events` | JSON | List of events |

---

## OpenTelemetry Compatibility

The tracing system is designed to be compatible with OpenTelemetry:

1. **Span naming** follows OTel conventions
2. **Attributes** use dot-notation (e.g., `agent.name`)
3. **Export to OTel format** for external observability systems

```python
from tracing import TraceViewer

viewer = TraceViewer("traces.db")
otel_json = viewer.export_trace(trace_id, format="otel")

# Send to OTLP collector
import httpx
response = httpx.post(
    "http://localhost:4318/v1/traces",
    content=otel_json,
    headers={"Content-Type": "application/json"}
)
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- `OPENROUTER_API_KEY` environment variable

### Installation

```bash
cd python-workers
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -e .
export OPENROUTER_API_KEY=your_key_here
```

### Run First Test

```bash
PYTHONIOENCODING=utf-8 python examples/00_testmodel.py
```

This runs a trace without API calls, verifying the tracing system works correctly.

---

## File Structure

```
python-workers/
├── agents/
│   ├── __init__.py           # Agent factory exports
│   ├── orchestrator.py       # Coordinator agent
│   ├── research.py           # Web research agent
│   ├── coding.py             # Code generation agent
│   ├── analysis.py           # Data analysis agent
│   ├── schemas.py            # Pydantic models
│   └── tools/                # Tool implementations
│       ├── web.py            # search_web, fetch_url, summarize_text
│       ├── code.py           # write_file, read_file, run_code
│       └── data.py           # parse_data, calculate_stats, generate_chart
├── tracing/
│   ├── __init__.py           # Tracing exports
│   ├── spans.py              # Span and Trace models
│   ├── collector.py          # SQLite storage
│   ├── processor.py          # Tracer implementation
│   └── viewer.py             # Query utilities
├── examples/
│   ├── 00_testmodel.py       # No API calls
│   ├── 01_basic.py           # Single agent
│   ├── 02_delegation.py      # Multi-agent delegation
│   ├── 03_streaming.py       # Streaming execution
│   ├── 04_errors.py          # Error handling
│   ├── 05_concurrent.py      # Parallel execution
│   └── 06_conversation.py    # Multi-turn conversation
└── docs/                     # Detailed Python documentation
    ├── index.md
    ├── agents.md
    ├── tracing.md
    ├── examples.md
    ├── api-reference.md
    └── integration.md
```

---

## Detailed Documentation

For comprehensive documentation on the Python agent and tracing system, see:

| Document | Description |
|----------|-------------|
| [python-workers/docs/index.md](../../python-workers/docs/index.md) | Overview and quick start |
| [python-workers/docs/agents.md](../../python-workers/docs/agents.md) | Agent architecture, tools, schemas |
| [python-workers/docs/tracing.md](../../python-workers/docs/tracing.md) | Tracing API, database schema, queries |
| [python-workers/docs/examples.md](../../python-workers/docs/examples.md) | Example walkthroughs |
| [python-workers/docs/api-reference.md](../../python-workers/docs/api-reference.md) | Complete API reference |
| [python-workers/docs/integration.md](../../python-workers/docs/integration.md) | Integration patterns and best practices |

---

## Traces API (TypeScript)

The project includes a TypeScript library for reading traces from the SQLite database.

### API Endpoints

**Base:** `/api/traces`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/traces` | List traces (query: `userId`, `sessionId`, `limit`, `offset`) |
| GET | `/api/traces?stats=true` | Get trace statistics |
| GET | `/api/traces/:id` | Get trace with spans |
| GET | `/api/traces/:id?tree=true` | Get trace with nested span tree |

### TypeScript Library

**File:** `src/lib/tracing/db.ts`

```ts
import {
  listTraces,
  getTrace,
  getSpans,
  getSpanTree,
  getTraceStats,
  getTraceWithSpans,
  getTraceWithTree,
  tracesDbExists,
} from "@/lib/tracing/db";

// Check if database exists
if (!tracesDbExists()) {
  console.log("No traces.db found");
}

// List traces
const traces = listTraces({ userId: "user123", limit: 20 });

// Get trace with nested span tree
const trace = getTraceWithTree(traceId);

// Get statistics
const stats = getTraceStats();
// { trace_count, span_count, avg_duration_ms }
```

### Types

```ts
interface TraceRow {
  id: string;
  name: string;
  user_id: string | null;
  session_id: string | null;
  status: "UNSET" | "OK" | "ERROR";
  span_count: number;
  total_duration_ms: number;
}

interface SpanWithChildren {
  id: string;
  name: string;
  span_type: string | null;
  duration_us: number | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  children: SpanWithChildren[];
}
```

---

## Traces UI

The project includes a React-based trace viewer at `/traces`.

### Page Route

**File:** `src/routes/traces.tsx`

Access the traces page at `/traces` (requires authentication).

### Components

| Component | File | Description |
|-----------|------|-------------|
| `TraceTerminal` | `src/components/tracing/TraceTerminal.tsx` | Main three-panel layout |
| `TraceHeader` | `src/components/tracing/TraceHeader.tsx` | Header with stats and controls |
| `TraceTimeline` | `src/components/tracing/TraceTimeline.tsx` | Visual span timeline |
| `TraceSidebar` | `src/components/tracing/TraceSidebar.tsx` | Trace list sidebar |
| `TraceLogStream` | `src/components/tracing/TraceLogStream.tsx` | Real-time log stream |
| `TraceStats` | `src/components/tracing/TraceStats.tsx` | Statistics display |
| `SpanNode` | `src/components/tracing/SpanNode.tsx` | Individual span renderer |

### React Hooks

**File:** `src/lib/hooks/use-traces.ts`

```tsx
import { useTraces, useTrace, useTraceStats } from "@/lib/hooks/use-traces";

function MyComponent() {
  const { traces, isLoading, error } = useTraces({ userId: "user123" });
  const { trace } = useTrace(traceId, { includeTree: true });
  const { stats } = useTraceStats();

  return (/* ... */);
}
```

**File:** `src/lib/hooks/use-trace-websocket.ts`

```tsx
import { useTraceWebSocket, useTracesSubscription } from "@/lib/hooks/use-trace-websocket";

// Full control over WebSocket connection
function LiveTraceViewer({ traceId }: { traceId: string }) {
  const { spans, isConnected } = useTraceWebSocket(traceId);

  return (
    <div>
      Status: {isConnected ? "Connected" : "Disconnected"}
      {spans.map(span => /* render span */)}
    </div>
  );
}

// Simplified subscription to all trace updates
function TraceMonitor() {
  const { isConnected, error } = useTracesSubscription({
    onTraceCreated: (trace) => console.log("New trace:", trace.id),
    onTraceUpdated: (trace) => console.log("Trace updated:", trace.id),
  });

  return <div>Monitoring: {isConnected ? "Active" : "Disconnected"}</div>;
}
```

---

## Common Tasks

| Task | Reference |
|------|-----------|
| Run a simple agent with tracing | [examples.md#01_basic](../../python-workers/docs/examples.md#01_basicpy---single-research-agent) |
| Add tracing to my project | [integration.md#quick-integration](../../python-workers/docs/integration.md#quick-integration) |
| Understand agent capabilities | [agents.md#orchestrator-agent](../../python-workers/docs/agents.md#orchestrator-agent) |
| Query stored traces | [tracing.md#query-utilities](../../python-workers/docs/tracing.md#query-utilities) |
| Look up a function signature | [api-reference.md](../../python-workers/docs/api-reference.md) |
| Export traces to external system | [integration.md#export-to-external-systems](../../python-workers/docs/integration.md#export-to-external-systems) |
| Run multiple agents in parallel | [examples.md#05_concurrent](../../python-workers/docs/examples.md#05_concurrentpy---parallel-execution) |
| View traces in UI | Navigate to `/traces` |
| Query traces from TypeScript | Use `src/lib/tracing/db.ts` |
