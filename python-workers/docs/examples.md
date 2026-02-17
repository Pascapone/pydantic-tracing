# Examples Guide

This document provides detailed walkthroughs of all example scripts.

## Example Overview

| Script | API | Duration | Purpose |
|--------|-----|----------|---------|
| `00_testmodel.py` | No | <1s | Test tracing without API calls |
| `00_real_api.py` | Yes | ~5s | Quick API connectivity test |
| `00_instrumented.py` | Yes | ~3s | Full instrumentation example |
| `01_basic.py` | Yes | ~10s | Single research agent with tools |
| `02_delegation.py` | Yes | ~20s | Orchestrator + sub-agents |
| `03_streaming.py` | Yes | ~10s | Streaming with trace capture |
| `04_errors.py` | Yes | ~5s | Error handling, ModelRetry |
| `05_concurrent.py` | Yes | ~15s | Parallel agent execution |
| `06_conversation.py` | Yes | ~15s | Multi-turn with history |

## Running Examples

```bash
cd python-workers
source venv/Scripts/activate  # Windows: venv\Scripts\activate
PYTHONIOENCODING=utf-8 python examples/00_testmodel.py
```

---

## 00_testmodel.py - TestModel Without API

Tests the tracing system without making any API calls using pydantic-ai's `TestModel`.

### What It Tests

- Trace creation and completion
- Span creation and attributes
- Event recording
- Database persistence
- TraceViewer queries

### Key Code

```python
from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel
from tracing import get_tracer, print_trace

agent = Agent(TestModel(), output_type=SimpleOutput)
trace = tracer.start_trace("test_model_run")

result = await agent.run("Hello, test!")
tracer.end_trace()

print_trace(trace.id, "traces.db")
```

### Expected Output

```
============================================================
Tracing Test with TestModel (no API calls)
============================================================

Trace ID: 1fe82cb9-dc44-440b-905f-8aaa884fc9f0
Running agent with TestModel...

Result: message='a' count=0

============================================================
Trace Summary:
============================================================

Trace: test_model_run
ID: 1fe82cb9-dc44-440b-905f-8aaa884fc9f0
Status: OK
Spans: 1
Duration: 6.88ms

[...] agent.run:test_agent (6.88ms)
  -> agent.name: test_agent

============================================================
Database Stats:
============================================================
  Traces: 1
  Spans: 1
  Avg duration: 6.88ms
```

---

## 00_real_api.py - Quick API Test

Tests connectivity to the OpenRouter API with a simple request.

### What It Tests

- API key configuration
- OpenRouter connectivity
- Agent execution with real LLM
- Trace capture with real latency

### Key Code

```python
agent = create_research_agent()
result = await asyncio.wait_for(
    agent.run("What is pydantic-ai? Answer in one sentence.", deps=deps),
    timeout=60.0
)
```

### Troubleshooting

- **Timeout**: Check your internet connection
- **401 Unauthorized**: Verify `OPENROUTER_API_KEY` is set
- **429 Rate Limited**: Wait and retry

---

## 00_instrumented.py - Full Instrumentation

Demonstrates complete tracing with events, attributes, and usage tracking.

### What It Tests

- Structured output with Pydantic models
- Custom events (`agent_start`, `agent_complete`)
- Usage tracking (tokens)
- Full trace export to JSON

### Key Code

```python
tracer.add_event("agent_start", {"prompt": "What is 2+2?"})

result = await agent.run("What is 2+2?")

agent_span.set_attribute("result.answer", result.output.answer)
agent_span.set_attribute("usage.total_tokens", result.usage().total_tokens)

tracer.add_event("agent_complete", {
    "answer": result.output.answer,
    "confidence": result.output.confidence
})
```

### Expected Output

```json
{
  "id": "5f4c025d-ed89-4dbb-aa0f-046af79fca73",
  "name": "instrumented_agent_run",
  "status": "OK",
  "span_count": 1,
  "total_duration_ms": 1901.879,
  "spans": [
    {
      "name": "agent.run:instrumented",
      "duration_us": 1901879,
      "attributes": {
        "agent.name": "instrumented_agent",
        "result.answer": "2+2 equals 4",
        "usage.total_tokens": 231
      },
      "events": [
        {"name": "agent_start", "attributes": {"prompt": "What is 2+2?"}},
        {"name": "agent_complete", "attributes": {"answer": "2+2 equals 4"}}
      ]
    }
  ]
}
```

---

## 01_basic.py - Single Research Agent

Runs the research agent with tool calls.

### What It Tests

- Research agent execution
- Tool calling (`web_search`, `fetch_url`, `summarize_text`)
- Structured output (`ResearchReport`)
- Multiple tool invocations

### Key Code

```python
agent = create_research_agent()
result = await agent.run(
    "Research information about pydantic-ai agents and tracing",
    deps=deps
)

print(f"Summary: {result.output.summary}")
print(f"Findings: {result.output.key_findings}")
print(f"Confidence: {result.output.confidence:.0%}")
```

---

## 02_delegation.py - Multi-Agent Delegation

Demonstrates orchestrator delegating to sub-agents.

### What It Tests

- Orchestrator agent
- Agent-to-agent delegation
- Multiple sub-agent calls
- Result aggregation
- Nested span hierarchy

### Key Code

```python
orchestrator = create_orchestrator()

result = await orchestrator.run("""
    I need you to help me with a coding task:
    1. First, research best practices for Python async programming
    2. Then, write a simple async function that demonstrates those practices
    3. Finally, analyze the code structure and provide feedback
""", deps=deps)

print(f"Subtasks: {len(result.output.subtasks)}")
for subtask in result.output.subtasks:
    print(f"  - {subtask.agent_type}: {subtask.status}")
```

### Expected Output

```
Task: Write a simple Python Hello World program...
Status: completed
Subtasks: 2
Answer: Here is a simple Python Hello World program...
```

---

## 03_streaming.py - Streaming with Tracing

Captures traces during streaming agent execution.

### What It Tests

- `run_stream()` with tracing
- Real-time span events
- Chunk counting
- Partial output handling

### Key Code

```python
async with agent.run_stream(prompt, deps=deps) as result:
    chunks_received = 0
    
    async for text in result.stream_text(delta=True):
        print(text, end="", flush=True)
        chunks_received += 1
        
        if chunks_received % 10 == 0:
            tracer.add_event("chunk", {"count": chunks_received})
    
    final_result = await result.get_output()

agent_span.set_attribute("chunks_received", chunks_received)
```

---

## 04_errors.py - Error Handling

Demonstrates error handling with `ModelRetry`.

### What It Tests

- Output validators
- `ModelRetry` for retrying with feedback
- Error span capture
- Validation failures

### Key Code

```python
@agent.output_validator
async def validate_result(ctx, output: StrictResult) -> StrictResult:
    if output.value < 100:
        raise ModelRetry(
            f"Value must be at least 100, got {output.value}. "
            "Please try again with a larger number."
        )
    return output
```

### How It Works

1. Agent generates initial output
2. Validator checks the output
3. If invalid, `ModelRetry` tells the LLM to try again
4. Tracing captures each attempt

---

## 05_concurrent.py - Parallel Execution

Runs multiple agents in parallel using `asyncio.gather`.

### What It Tests

- Concurrent agent execution
- Trace correlation
- Timing analysis
- Parallel vs sequential comparison

### Key Code

```python
results = await asyncio.gather(
    run_agent(agent_a, "Say hello", tracer, trace.id),
    run_agent(agent_b, "Say goodbye", tracer, trace.id),
    run_agent(agent_c, "Say thanks", tracer, trace.id),
)

total_time = time.time() - start
print(f"Parallel time: {total_time:.2f}s")
print(f"Sequential would take: ~{sum(r['duration_ms'])/1000:.2f}s")
```

### Note on Threading

The current tracer uses thread-local storage. For concurrent execution, each agent should create its own tracer instance or use a lock mechanism.

---

## 06_conversation.py - Multi-Turn Conversation

Demonstrates conversation history across multiple turns.

### What It Tests

- Message history preservation
- Context passing between turns
- Span correlation across turns
- Conversation-level tracing

### Key Code

```python
history = None

for i, question in enumerate(conversation, 1):
    if history:
        result = await agent.run(question, message_history=history)
    else:
        result = await agent.run(question)
    
    history = result.all_messages()
    turn_span.set_attribute("turn.has_history", history is not None)
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Timeout | Increase timeout, check network |
| Unicode error | Set `PYTHONIOENCODING=utf-8` |
| Import error | Activate venv, run from `python-workers/` |
| API key error | Export `OPENROUTER_API_KEY` |
| Database locked | Close other connections to traces.db |

### Debug Mode

Add verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Reset Database

```bash
rm traces.db  # Delete and start fresh
```

---

## Creating Custom Examples

### Template

```python
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_research_agent, AgentDeps
from tracing import get_tracer, print_trace, SpanKind, SpanType

async def main():
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    # Your code here
    trace = tracer.start_trace("my_example")
    
    agent = create_research_agent()
    result = await agent.run("Your prompt here")
    
    tracer.end_trace()
    print_trace(trace.id, str(db_path))

if __name__ == "__main__":
    asyncio.run(main())
```

### Best Practices

1. Always use `PYTHONIOENCODING=utf-8` on Windows
2. Set reasonable timeouts for API calls
3. Handle exceptions and mark traces as errors
4. Use descriptive trace names
5. Add meaningful attributes to spans
