# Pydantic AI Tracing System

A custom, open-source tracing system for pydantic-ai agents with SQLite storage. Build, test, and monitor AI agents with full observability.

## Why This Exists

[Logfire](https://ai.pydantic.dev/logfire/) is pydantic-ai's official observability platform, but it's closed-source and requires a paid subscription. This project provides a self-hosted alternative using OpenTelemetry-compatible spans stored in SQLite.

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Agent System** | Orchestrator, Research, Coding, and Analysis agents |
| **Tool Calling** | Each agent has multiple tools with complex payloads |
| **Structured Outputs** | Pydantic models for type-safe outputs |
| **Agent Delegation** | Agents call other agents as tools |
| **SQLite Storage** | All traces persisted locally for querying |
| **Streaming Support** | Real-time trace capture during streaming |
| **OTel Compatible** | Export to OpenTelemetry format |

## Installation

```bash
cd python-workers
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -e .
```

Set your OpenRouter API key:
```bash
export OPENROUTER_API_KEY=your_key_here
```

## Quick Start

```python
import asyncio
from agents import create_research_agent, AgentDeps
from tracing import get_tracer, print_trace

async def main():
    tracer = get_tracer("traces.db")
    
    agent = create_research_agent()
    deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")
    
    trace = tracer.start_trace("my_trace", user_id="user1")
    result = await agent.run("What is pydantic-ai?", deps=deps)
    tracer.end_trace()
    
    print_trace(trace.id, "traces.db")

asyncio.run(main())
```

## Architecture

```
+-------------------+     +------------------+     +------------------+
|   Orchestrator    |---->| Research Agent   |     |  SQLite Database |
|     Agent         |     +------------------+     |    (traces.db)   |
+-------------------+              |               +------------------+
         |                         |                        ^
         |              +------------------+                |
         +------------->|   Coding Agent   |                |
         |              +------------------+                |
         |                         |                        |
         |              +------------------+                |
         +------------->|  Analysis Agent  |----------------+
                        +------------------+
                                 |
                        +------------------+
                        |   Tools Layer    |
                        +------------------+
                        | - Web (search)   |
                        | - Code (exec)    |
                        | - Data (stats)   |
                        +------------------+
```

## Project Structure

```
python-workers/
├── agents/
│   ├── __init__.py
│   ├── orchestrator.py    # Coordinates sub-agents
│   ├── research.py        # Web search and summarization
│   ├── coding.py          # Code generation and execution
│   ├── analysis.py        # Data analysis and visualization
│   ├── schemas.py         # Pydantic output models
│   └── tools/
│       ├── __init__.py
│       ├── web.py         # search_web, fetch_url, summarize
│       ├── code.py        # write_file, read_file, run_code
│       └── data.py        # parse_data, stats, charts
├── tracing/
│   ├── __init__.py
│   ├── spans.py           # Span data models
│   ├── collector.py       # SQLite storage
│   ├── processor.py       # Tracer and context management
│   └── viewer.py          # Query and export utilities
├── examples/
│   ├── 00_testmodel.py    # No API calls (fast testing)
│   ├── 00_real_api.py     # Quick API test
│   ├── 00_instrumented.py # Full instrumentation
│   ├── 01_basic.py        # Single agent with tools
│   ├── 02_delegation.py   # Multi-agent delegation
│   ├── 03_streaming.py    # Streaming with tracing
│   ├── 04_errors.py       # Error handling, ModelRetry
│   ├── 05_concurrent.py   # Parallel execution
│   └── 06_conversation.py # Multi-turn conversation
└── docs/
    ├── agents.md          # Agent system documentation
    ├── tracing.md         # Tracing system documentation
    ├── examples.md        # Example walkthroughs
    ├── api-reference.md   # Full API reference
    └── integration.md     # Integration guide
```

## Example Scripts

| Script | API Calls | Description |
|--------|-----------|-------------|
| `00_testmodel.py` | No | Test tracing without API calls |
| `00_real_api.py` | Yes | Quick API connectivity test |
| `00_instrumented.py` | Yes | Full instrumentation example |
| `01_basic.py` | Yes | Single research agent |
| `02_delegation.py` | Yes | Orchestrator + sub-agents |
| `03_streaming.py` | Yes | Streaming with trace capture |
| `04_errors.py` | Yes | Error handling, ModelRetry |
| `05_concurrent.py` | Yes | Parallel agent execution |
| `06_conversation.py` | Yes | Multi-turn with history |

Run examples:
```bash
cd python-workers
source venv/Scripts/activate
PYTHONIOENCODING=utf-8 python examples/00_testmodel.py
```

## Documentation

| Document | Description |
|----------|-------------|
| [Agent System](docs/agents.md) | Multi-agent architecture, tools, schemas |
| [Tracing System](docs/tracing.md) | Traces, spans, SQLite storage, querying |
| [Examples Guide](docs/examples.md) | Detailed walkthrough of all examples |
| [API Reference](docs/api-reference.md) | Full API documentation |
| [Integration Guide](docs/integration.md) | Using with existing projects |

## Model Configuration

Uses OpenRouter with MiniMax M2.5 by default:
```python
agent = Agent("openrouter:minimax/minimax-m2.5", ...)
```

Change model per agent:
```python
from agents import create_research_agent
agent = create_research_agent(model="openrouter:anthropic/claude-3.5-sonnet")
```

## License

MIT License - Free to use, modify, and distribute.
