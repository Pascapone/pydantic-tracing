# Testing Reference

Patterns for testing Pydantic AI agents without LLM calls.

## TestModel

Fast, deterministic model replacement for unit tests.

```python
from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel

agent = Agent('openrouter:anthropic/claude-3.5-sonnet')

def test_with_test_model():
    with agent.override(model=TestModel()):
        result = agent.run_sync("any input")
        assert result.output  # Returns tool call summary or structured data
```

### TestModel Behavior

- Calls all tools registered on the agent
- Returns JSON summary of tool calls by default
- Generates valid structured output for `output_type`
- No actual LLM calls

### Custom TestModel Output

```python
from pydantic_ai.models.test import TestModel

test_model = TestModel(
    custom_output_text="Expected response",
    seed=42  # For reproducibility
)

with agent.override(model=test_model):
    result = agent.run_sync("input")
    assert result.output == "Expected response"
```

## FunctionModel

Full control over model behavior for complex tests.

```python
from pydantic_ai import Agent, ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models.function import FunctionModel

def custom_model(messages, info):
    """Custom model behavior for testing."""
    if len(messages) == 1:
        # First call: request tool
        return ModelResponse(parts=[
            ToolCallPart('my_tool', {'arg': 'value'})
        ])
    else:
        # Second call: return result
        tool_result = messages[-1].parts[0].content
        return ModelResponse(parts=[
            TextPart(f"Tool returned: {tool_result}")
        ])

agent = Agent('openrouter:anthropic/claude-3.5-sonnet')

@agent.tool_plain
def my_tool(arg: str) -> str:
    return f"processed {arg}"

def test_custom_behavior():
    with agent.override(model=FunctionModel(custom_model)):
        result = agent.run_sync("input")
        assert "processed value" in result.output
```

### FunctionModel with Structured Output

```python
from pydantic import BaseModel

class Result(BaseModel):
    value: int
    status: str

def return_structured(messages, info):
    # Return structured data directly
    return ModelResponse(parts=[
        ToolCallPart('Result', {'value': 42, 'status': 'ok'})
    ])

agent = Agent('openrouter:openai/gpt-4o', output_type=Result)

def test_structured():
    with agent.override(model=FunctionModel(return_structured)):
        result = agent.run_sync("input")
        assert result.output.value == 42
```

## Capture Run Messages

Inspect message history from tests.

```python
from pydantic_ai import capture_run_messages

def test_inspect_messages():
    with capture_run_messages() as messages:
        with agent.override(model=TestModel()):
            agent.run_sync("test input")
    
    # messages contains all ModelRequest and ModelResponse objects
    assert len(messages) >= 2
    assert messages[0].parts[0].content == "test input"
```

## Block Real API Calls

Prevent accidental API calls in tests.

```python
from pydantic_ai import models
import pytest

# Block all real model requests
models.ALLOW_MODEL_REQUESTS = False

# Or use fixture
@pytest.fixture(autouse=True)
def block_api_calls():
    models.ALLOW_MODEL_REQUESTS = False
    yield
    models.ALLOW_MODEL_REQUESTS = True
```

## Override Dependencies

Replace dependencies in tests.

```python
from dataclasses import dataclass

@dataclass
class ProdDeps:
    api_client: RealClient

@dataclass  
class TestDeps:
    api_client: MockClient

agent = Agent('openrouter:anthropic/claude-3.5-sonnet', deps_type=ProdDeps)

def test_with_mock_deps():
    mock_deps = TestDeps(api_client=MockClient())
    
    with agent.override(deps=mock_deps, model=TestModel()):
        result = agent.run_sync("input", deps=mock_deps)
```

## Testing Tools

Isolate and test individual tools.

```python
from pydantic_ai import RunContext

@agent.tool
async def my_tool(ctx: RunContext[AppDeps], query: str) -> str:
    result = await ctx.deps.db.search(query)
    return result

async def test_my_tool():
    mock_deps = AppDeps(db=MockDB())
    ctx = RunContext(deps=mock_deps, messages=[], usage=RunUsage())
    
    result = await my_tool(ctx, "test query")
    assert result == "expected result"
```

## Pytest Fixtures

Common testing fixtures.

```python
import pytest
from pydantic_ai import Agent, models
from pydantic_ai.models.test import TestModel

@pytest.fixture
def test_model():
    return TestModel()

@pytest.fixture
def blocked_api():
    """Block real API calls for duration of test."""
    original = models.ALLOW_MODEL_REQUESTS
    models.ALLOW_MODEL_REQUESTS = False
    yield
    models.ALLOW_MODEL_REQUESTS = original

@pytest.fixture
def agent_with_test_model(test_model):
    """Agent pre-configured with TestModel."""
    agent = Agent('openrouter:anthropic/claude-3.5-sonnet')
    with agent.override(model=test_model):
        yield agent
```

## Testing Streaming

Test streaming behavior.

```python
from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel

async def test_streaming():
    agent = Agent('openrouter:anthropic/claude-3.5-sonnet')
    
    chunks = []
    async with agent.run_stream("input", model=TestModel()) as result:
        async for text in result.stream_text(delta=True):
            chunks.append(text)
    
    assert len(chunks) > 0
```

## Testing Error Handling

Test ModelRetry behavior.

```python
from pydantic_ai import ModelRetry
from pydantic_ai.models.function import FunctionModel

def model_that_retries(messages, info):
    if len(messages) == 1:
        # First attempt: trigger retry
        return ModelResponse(parts=[
            ToolCallPart('my_tool', {'bad_arg': 'x'})
        ])
    else:
        # After retry
        return ModelResponse(parts=[TextPart("Success")])

@agent.tool
def my_tool(ctx, arg: str) -> str:
    if arg == 'x':
        raise ModelRetry("Bad argument, try 'y'")
    return f"Got {arg}"

async def test_retry():
    with agent.override(model=FunctionModel(model_that_retries)):
        result = await agent.run("input")
        assert result.output
```

## Assertion Helpers

Use dirty-equals for flexible assertions.

```python
from dirty_equals import IsNow, IsStr, IsInt

def test_with_dirty_equals():
    with capture_run_messages() as messages:
        with agent.override(model=TestModel()):
            agent.run_sync("test")
    
    assert messages == [
        ModelRequest(
            parts=[UserPromptPart(
                content="test",
                timestamp=IsNow()  # Matches any recent timestamp
            )],
            run_id=IsStr()  # Any string
        ),
        ModelResponse(
            usage=RequestUsage(
                input_tokens=IsInt(),  # Any integer
                output_tokens=IsInt()
            )
        )
    ]
```

## Integration Test Pattern

Combine multiple test utilities.

```python
import pytest
from pydantic_ai import Agent, models, capture_run_messages
from pydantic_ai.models.test import TestModel

pytestmark = pytest.mark.anyio  # For async tests
models.ALLOW_MODEL_REQUESTS = False

async def test_full_flow():
    agent = Agent(
        'openrouter:anthropic/claude-3.5-sonnet',
        output_type=Result,
        deps_type=TestDeps
    )
    
    with capture_run_messages() as messages:
        with agent.override(
            model=TestModel(),
            deps=TestDeps()
        ):
            result = await agent.run("test input")
    
    # Assert output
    assert isinstance(result.output, Result)
    
    # Assert message flow
    assert len(messages) == 3  # Request -> Tool -> Response
```
