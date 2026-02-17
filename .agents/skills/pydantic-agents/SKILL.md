---
name: pydantic-agents
description: Build production-grade AI agents with Pydantic AI framework. Use when creating agents, implementing tool calling, structured outputs, multi-agent systems, MCP integration, or optimizing prompts for agentic workflows.
---

# Pydantic AI Agents

Build reliable, type-safe AI agents with structured outputs and tool calling.

## Core Concepts

An agent is a container for: **instructions** (system prompts), **tools** (functions the LLM calls), **output_type** (structured response schema), **deps_type** (dependency injection), and **model** (LLM provider).

```python
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel

class Result(BaseModel):
    answer: str
    confidence: float

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    output_type=Result,
    deps_type=str,
    instructions='You are a helpful assistant. Be concise.'
)

result = agent.run_sync('What is 2+2?', deps='user123')
print(result.output)  # Result(answer='4', confidence=1.0)
```

## Running Agents

| Method | Use Case |
|--------|----------|
| `agent.run()` | Async, returns complete result |
| `agent.run_sync()` | Sync wrapper, blocking |
| `agent.run_stream()` | Async, stream text/output |
| `agent.iter()` | Low-level graph iteration |

## Instructions (System Prompts)

Instructions define agent behavior. Use dynamic instructions for context-dependent prompts.

```python
agent = Agent(
    'openrouter:openai/gpt-4o',
    instructions="""You are a data analyst.
    - Always cite sources
    - Use bullet points for lists
    - Acknowledge uncertainty"""
)

# Dynamic instructions with context
@agent.instructions
async def add_context(ctx: RunContext[dict]) -> str:
    return f"User role: {ctx.deps['role']}"
```

## Tool Calling

Tools extend agents with external capabilities. Use `@agent.tool` when accessing context, `@agent.tool_plain` for standalone functions.

```python
from pydantic_ai import Agent, RunContext

agent = Agent('openrouter:anthropic/claude-3.5-sonnet', deps_type=dict)

@agent.tool
async def search_docs(ctx: RunContext[dict], query: str) -> str:
    """Search documentation for query. Returns relevant snippets."""
    # ctx.deps contains injected dependencies
    return ctx.deps['db'].search(query)

@agent.tool_plain
def calculate(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b
```

**Tool Best Practices:**
- Docstrings become tool descriptions (use Google/NumPy/Sphinx style)
- Pydantic validates tool arguments automatically
- Return strings for simple results, dicts/objects for structured data
- Raise `ModelRetry` to ask the LLM to try again with different arguments

## Structured Outputs

Force models to return validated Pydantic models instead of free text.

```python
from pydantic import BaseModel, Field
from typing import Literal

class Analysis(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float = Field(ge=0, le=1)
    keywords: list[str]
    reasoning: str

agent = Agent(
    'openrouter:openai/gpt-4o',
    output_type=Analysis,
    instructions='Analyze text sentiment with reasoning.'
)

result = agent.run_sync("I love this product!")
print(result.output.sentiment)  # "positive"
```

### Multiple Output Types

```python
class Success(BaseModel):
    data: dict

class Failure(BaseModel):
    error: str
    suggestion: str

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    output_type=[Success, Failure]  # Model chooses which to return
)
```

### Output Validators

Validate outputs that require async operations or complex logic.

```python
from pydantic_ai import ModelRetry

@agent.output_validator
async def validate_output(ctx, output: Analysis) -> Analysis:
    if output.confidence < 0.5 and not output.keywords:
        raise ModelRetry("Low confidence requires keywords for evidence")
    return output
```

## Dependencies

Inject services, configs, and context into tools and instructions.

```python
from dataclasses import dataclass
import httpx

@dataclass
class AppDeps:
    api_key: str
    db: Database

agent = Agent('openrouter:openai/gpt-4o', deps_type=AppDeps)

@agent.tool
async def query_db(ctx: RunContext[AppDeps], sql: str) -> list:
    return await ctx.deps.db.execute(sql)

# Usage
async with httpx.AsyncClient() as client:
    deps = AppDeps(api_key="xxx", db=Database())
    result = await agent.run("Query users", deps=deps)
```

## Message History

Maintain conversation context across runs.

```python
# First turn
result1 = agent.run_sync("What is Python?")
history = result1.all_messages()

# Continue conversation
result2 = agent.run_sync("Tell me more", message_history=history)

# Serialize for storage
from pydantic_ai import ModelMessagesTypeAdapter
json_bytes = result1.all_messages_json()
# Later: messages = ModelMessagesTypeAdapter.validate_json(json_bytes)
```

### History Processors

Filter or transform history before each request (e.g., limit tokens, summarize).

```python
async def keep_recent(messages: list) -> list:
    return messages[-10:]  # Keep last 10 messages

agent = Agent('openrouter:openai/gpt-4o', history_processors=[keep_recent])
```

## Error Handling & Retries

```python
from pydantic_ai import ModelRetry, UnexpectedModelBehavior

@agent.tool
async def risky_operation(ctx, data: str) -> str:
    try:
        return await external_api(data)
    except APIError as e:
        raise ModelRetry(f"API error: {e}. Try with different data.")

# Handle unexpected behavior
try:
    result = await agent.run("complex task")
except UnexpectedModelBehavior as e:
    print(f"Agent failed: {e}")
```

## Streaming

Stream responses for real-time feedback.

```python
async def stream_response():
    async with agent.run_stream("Explain quantum computing") as result:
        async for text in result.stream_text(delta=True):
            print(text, end='', flush=True)

# Stream structured output
agent = Agent('openrouter:openai/gpt-4o', output_type=Analysis)
async with agent.run_stream("Analyze this") as result:
    async for partial in result.stream_output():
        print(partial)  # Partially built Analysis objects
```

## Multi-Agent Patterns

### Agent Delegation

One agent calls another as a tool.

```python
researcher = Agent('openrouter:anthropic/claude-3.5-sonnet', output_type=list[str])
writer = Agent('openrouter:openai/gpt-4o')

@writer.tool
async def research_topic(ctx, topic: str) -> list[str]:
    result = await researcher.run(f"Research: {topic}", usage=ctx.usage)
    return result.output

result = writer.run_sync("Write about AI agents")
```

### Programmatic Hand-off

Application code orchestrates multiple agents.

```python
async def workflow(query: str):
    # Agent 1: Classify intent
    intent = await classifier.run(query)
    
    # Agent 2: Route based on intent
    if intent.output.type == "code":
        return await coder.run(query, message_history=intent.all_messages())
    else:
        return await chatbot.run(query, message_history=intent.all_messages())
```

## Prompt Engineering Patterns

### Chain-of-Thought in Instructions

```python
agent = Agent('openrouter:openai/gpt-4o', instructions="""
Solve problems step by step:
1. Understand the problem
2. Identify key information
3. Work through the solution
4. Verify your answer
5. State the final result clearly
""")
```

### Few-Shot via Dynamic Instructions

```python
@agent.instructions
async def add_examples(ctx: RunContext[dict]) -> str:
    examples = ctx.deps['example_db'].get_similar(ctx.query, k=3)
    return "Examples:\n" + "\n".join(f"Q: {e.q}\nA: {e.a}" for e in examples)
```

### Error Recovery Pattern

```python
@agent.output_validator
async def validate_with_retry(ctx, output: Result) -> Result:
    if not is_valid(output):
        raise ModelRetry(
            f"Output invalid: {get_errors(output)}. "
            "Please correct and try again."
        )
    return output
```

## Testing

Use `TestModel` for fast, deterministic tests without LLM calls.

```python
from pydantic_ai.models.test import TestModel
from pydantic_ai import models

models.ALLOW_MODEL_REQUESTS = False  # Block real API calls

def test_agent():
    with agent.override(model=TestModel()):
        result = agent.run_sync("test input")
        assert result.output is not None
```

See [references/testing.md](references/testing.md) for detailed testing patterns.

## Reference Files

- **[references/tools.md](references/tools.md)** - Advanced tool patterns, built-in tools, toolsets
- **[references/structured-output.md](references/structured-output.md)** - Output modes, streaming, validators
- **[references/multi-agent.md](references/multi-agent.md)** - Delegation, graphs, hand-offs
- **[references/mcp.md](references/mcp.md)** - Model Context Protocol integration
- **[references/testing.md](references/testing.md)** - TestModel, FunctionModel, mocking

## Model Reference (OpenRouter)

Common models via `openrouter:` prefix:

| Model | Strengths |
|-------|-----------|
| `anthropic/claude-3.5-sonnet` | Complex reasoning, tool use |
| `anthropic/claude-3-haiku` | Fast, cheap |
| `openai/gpt-4o` | General purpose, multimodal |
| `openai/gpt-4o-mini` | Fast, cost-effective |
| `google/gemini-2.0-flash-exp` | Fast, experimental features |
| `meta-llama/llama-3.3-70b-instruct` | Open source, strong performance |

## Best Practices

1. **Type everything** - Use `output_type` and `deps_type` for type safety
2. **Validate outputs** - Add `output_validator` for complex validation
3. **Use tools wisely** - Tools are for actions, instructions are for behavior
4. **Handle errors** - Use `ModelRetry` for recoverable errors
5. **Test with TestModel** - Avoid LLM calls in unit tests
6. **Stream for UX** - Use streaming for user-facing responses
7. **Track usage** - Pass `usage=ctx.usage` when delegating to track costs
