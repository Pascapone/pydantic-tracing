# Pydantic AI Tracing System

A self-hosted observability solution for pydantic-ai agents with SQLite storage. This system provides an open-source alternative to Logfire, enabling detailed tracing of agent execution, tool calls, and multi-agent delegation patterns.

## Overview

The system combines two complementary components:

- **Multi-Agent System**: A comprehensive test bed with orchestrator, research, coding, and analysis agents that exercise all pydantic-ai capabilities
- **Tracing System**: Custom observability infrastructure that captures agent runs, tool calls, model requests, and agent-to-agent delegation

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

### Key Capabilities

- **Agent Execution Tracing**: Sync, async, and streaming execution with full call stacks
- **Tool Call Capture**: Complex payloads and return values for all tool invocations
- **Structured Outputs**: Pydantic models validated and recorded in traces
- **Agent Delegation**: Nested traces when agents call other agents
- **Delegated Reasoning Capture**: Sub-agent reasoning is persisted as explicit `model.reasoning` spans
- **Error Handling**: ModelRetry, validation failures, and exception capture
- **Message History**: Multi-turn conversation tracking
- **SQLite Storage**: Local persistence with query and export utilities
- **OpenTelemetry Compatible**: Export to OTLP receivers
- **OpenRouter Stream Compatibility**: Missing `native_finish_reason` is normalized before chunk validation

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

## Documentation Reference

### [Agent System](agents.md)

Multi-agent architecture designed to test pydantic-ai tracing capabilities.

| Topic | Description |
|-------|-------------|
| **Orchestrator Agent** | Coordinates sub-agents for complex multi-step tasks; delegates research, coding, analysis |
| **Research Agent** | Web search, URL fetching, text summarization; outputs structured `ResearchReport` |
| **Coding Agent** | Code generation, execution, analysis; outputs structured `CodeResult` |
| **Analysis Agent** | Data parsing, statistics, visualization; outputs structured `AnalysisResult` |
| **Tool Reference** | Web tools (`search_web`, `fetch_url`, `summarize_text`), Code tools (`write_file`, `run_code`), Data tools (`parse_data`, `calculate_stats`, `generate_chart`) |
| **Schema Reference** | `AgentDeps`, `TaskResult`, `ResearchReport`, `CodeResult`, `AnalysisResult`, enums |
| **Customization** | Using different models, adding custom tools |

**When to read**: Understanding agent capabilities, implementing custom agents, or debugging tool behavior.

---

### [Tracing System](tracing.md)

Custom observability infrastructure with SQLite storage.

| Topic | Description |
|-------|-------------|
| **Core Concepts** | Traces (top-level containers), Spans (hierarchical work units), Events (point-in-time annotations), Attributes (key-value metadata) |
| **API Reference** | `get_tracer()`, `start_trace()`, `end_trace()`, `start_span()`, `end_span()`, `add_event()`, `set_attribute()` |
| **Context Managers** | `traced_agent()`, `traced_tool()` for scoped tracing |
| **Database Schema** | `traces` table (id, name, user_id, session_id, status, duration), `spans` table (id, trace_id, parent_id, name, attributes, events) |
| **Query Utilities** | `TraceViewer` class for querying, listing, exporting traces |
| **Span Types** | `agent.run`, `agent.stream`, `tool.call`, `model.request`, `model.response`, `agent.delegation` |
| **Span Kinds** | `INTERNAL`, `CLIENT`, `SERVER`, `PRODUCER`, `CONSUMER` (OpenTelemetry compatible) |
| **OpenTelemetry Export** | Export traces in OTel format for external observability systems |

**When to read**: Implementing tracing in agents, querying trace data, or integrating with external observability.

---

### [Examples Guide](examples.md)

Detailed walkthroughs of all test scripts.

| Script | API Calls | Duration | Purpose |
|--------|-----------|----------|---------|
| `00_testmodel.py` | No | <1s | Test tracing without API calls using TestModel |
| `00_real_api.py` | Yes | ~5s | Quick API connectivity test |
| `00_instrumented.py` | Yes | ~3s | Full instrumentation with events, attributes, usage tracking |
| `01_basic.py` | Yes | ~10s | Single research agent with tool calls |
| `02_delegation.py` | Yes | ~20s | Orchestrator delegating to sub-agents |
| `03_streaming.py` | Yes | ~10s | Streaming execution with trace capture |
| `04_errors.py` | Yes | ~5s | Error handling with ModelRetry |
| `05_concurrent.py` | Yes | ~15s | Parallel agent execution |
| `06_conversation.py` | Yes | ~15s | Multi-turn conversation with history |

**When to read**: Learning how to use the system, understanding specific execution patterns, or troubleshooting.

---

### [API Reference](api-reference.md)

Complete function and class documentation.

| Module | Contents |
|--------|----------|
| **`agents`** | Factory functions (`create_orchestrator`, `create_research_agent`, `create_coding_agent`, `create_analysis_agent`), schema classes (`AgentDeps`, `TaskResult`, `ResearchReport`, `CodeResult`, `AnalysisResult`), enums (`TaskStatus`, `AgentType`) |
| **`agents.tools`** | Web tools (`search_web`, `fetch_url`, `summarize_text`), Code tools (`write_file`, `read_file`, `run_code`, `analyze_code`), Data tools (`parse_data`, `calculate_stats`, `generate_chart`) |
| **`tracing`** | Functions (`get_tracer`, `get_collector`, `print_trace`, `export_traces`), classes (`PydanticAITracer`, `TraceCollector`, `TraceViewer`), context managers (`traced_agent`, `traced_tool`), models (`Span`, `Trace`), enums (`SpanKind`, `SpanStatus`, `SpanType`) |

**When to read**: Looking up specific function signatures, return types, or class methods.

---

### [Integration Guide](integration.md)

Patterns for integrating tracing into existing projects.

| Topic | Description |
|-------|-------------|
| **Quick Integration** | 3-step setup: install, copy module, add tracing to agents |
| **Decorator Pattern** | `@traced()` decorator for automatic function tracing |
| **Context Manager Pattern** | `traced_agent()`, `traced_tool()` for scoped tracing |
| **Middleware Integration** | FastAPI/Starlette middleware for HTTP request tracing |
| **Job Queue Integration** | Integrating with BullMQ handlers for async job tracing |
| **Custom Span Types** | Extending `SpanType` enum for application-specific spans |
| **External Export** | OpenTelemetry export, Elasticsearch integration |
| **Best Practices** | Naming conventions, meaningful attributes, error handling, performance |
| **Migration from Logfire** | Compatibility notes and code examples |

**When to read**: Adding tracing to your own pydantic-ai projects or integrating with existing infrastructure.

---

## Common Tasks

| Task | Reference |
|------|-----------|
| Run a simple agent with tracing | [examples.md#01_basic](examples.md#01_basicpy---single-research-agent) |
| Add tracing to my project | [integration.md#quick-integration](integration.md#quick-integration) |
| Understand agent capabilities | [agents.md#orchestrator-agent](agents.md#orchestrator-agent) |
| Query stored traces | [tracing.md#query-utilities](tracing.md#query-utilities) |
| Look up a function signature | [api-reference.md](api-reference.md) |
| Debug a failing agent | [examples.md#04_errors](examples.md#04_errorspy---error-handling) |
| Export traces to external system | [integration.md#export-to-external-systems](integration.md#export-to-external-systems) |
| Run multiple agents in parallel | [examples.md#05_concurrent](examples.md#05_concurrentpy---parallel-execution) |
| Handle multi-turn conversations | [examples.md#06_conversation](examples.md#06_conversationpy---multi-turn-conversation) |

---

## Project Structure

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
│       ├── code.py           # write_file, read_file, run_code, analyze_code
│       └── data.py           # parse_data, calculate_stats, generate_chart
├── tracing/
│   ├── __init__.py           # Tracing exports
│   ├── spans.py              # Span and Trace models
│   ├── collector.py          # SQLite storage
│   ├── processor.py          # Tracer implementation
│   ├── openrouter_compat.py  # OpenRouter streaming compatibility patch
│   └── viewer.py             # Query utilities
├── examples/
│   ├── 00_testmodel.py       # No API calls
│   ├── 00_real_api.py        # API connectivity test
│   ├── 00_instrumented.py    # Full instrumentation
│   ├── 01_basic.py           # Single agent
│   ├── 02_delegation.py      # Multi-agent delegation
│   ├── 03_streaming.py       # Streaming execution
│   ├── 04_errors.py          # Error handling
│   ├── 05_concurrent.py      # Parallel execution
│   └── 06_conversation.py    # Multi-turn conversation
├── handlers/
│   ├── __init__.py           # Job handler registry
│   └── context.py            # Job context utilities
├── docs/
│   ├── index.md              # This file
│   ├── agents.md             # Agent system documentation
│   ├── tracing.md            # Tracing system documentation
│   ├── examples.md           # Example walkthroughs
│   ├── api-reference.md      # Complete API reference
│   └── integration.md        # Integration patterns
├── worker.py                 # Main worker entry point
├── config.py                 # Worker configuration
└── pyproject.toml            # Package configuration
```
