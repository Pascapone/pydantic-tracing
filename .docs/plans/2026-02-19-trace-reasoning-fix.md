# Implementation Plan: Deep Tracing with TracedModel

## 1. Goal & Requirements
- **Capture Reasoning**: Ensure model chain-of-thought/reasoning is captured in traces
- **Handle Timeouts**: Preserve partial traces when model calls timeout
- **Support Deep Nesting**: Works for any depth of agent delegation
- **Streaming Support**: Capture streaming responses incrementally
- **Location**: `python-workers/tracing/wrappers.py` (new file)

## 2. Architecture: `TracedModel` Wrapper

**Key Design**: Use `pydantic_ai.models.wrapper.WrapperModel` as base class (not `Model`).

```python
from typing import Any, AsyncIterator
from contextlib import asynccontextmanager

from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.models import ModelResponse, ModelSettings, ModelRequestParameters, StreamedResponse
from pydantic_ai.messages import ModelMessage
from pydantic_ai.settings import ModelSettings as Settings

from tracing import get_tracer
from tracing.spans import SpanType, SpanKind, SpanStatus


class TracedStreamedResponse:
    """Wrapper for streaming responses that captures events for tracing."""
    
    def __init__(self, stream: StreamedResponse, span, tracer):
        self._stream = stream
        self._span = span
        self._tracer = tracer
        self._parts = []
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        event = await self._stream.__anext__()
        if hasattr(event, 'part') and event.part:
            self._parts.append(event.part)
        return event
    
    def get_captured_content(self) -> dict:
        return {"parts_captured": len(self._parts)}


class TracedModel(WrapperModel):
    """
    Model wrapper that traces all requests and responses.
    
    Automatically parents spans to the current context span,
    supporting infinite nesting depth.
    """
    
    def __init__(self, wrapped):
        super().__init__(wrapped)
    
    async def request(
        self,
        messages: list[ModelMessage],
        model_settings: Settings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> ModelResponse:
        tracer = get_tracer()
        
        span = tracer.start_span(
            name=f"model.request:{self.model_name}",
            kind=SpanKind.client,
            span_type=SpanType.model_request,
            attributes={
                "model.name": self.model_name,
                "model.messages_count": len(messages),
                "model.messages_preview": str(messages)[:500],
            },
        )
        
        try:
            response = await self.wrapped.request(
                messages, model_settings, model_request_parameters
            )
            
            text_parts = []
            thinking_parts = []
            tool_calls = []
            
            for part in response.parts:
                part_type = part.__class__.__name__
                if part_type == "TextPart":
                    text_parts.append(part.content)
                elif part_type == "ThinkingPart":
                    thinking_parts.append(part.content)
                elif part_type == "ToolCallPart":
                    tool_calls.append(part.tool_name)
            
            span.set_attribute("model.response_parts_count", len(response.parts))
            
            if text_parts:
                span.set_attribute("model.text", "\n".join(text_parts)[:2000])
            if thinking_parts:
                span.set_attribute("model.reasoning", "\n".join(thinking_parts)[:5000])
            if tool_calls:
                span.set_attribute("model.tool_calls", tool_calls)
            
            if hasattr(response, 'usage') and response.usage:
                span.set_attribute("model.usage.input_tokens", response.usage.input_tokens)
                span.set_attribute("model.usage.output_tokens", response.usage.output_tokens)
            
            tracer.end_span(span, status=SpanStatus.ok)
            return response
            
        except Exception as e:
            tracer.record_exception(e)
            tracer.end_span(span, status=SpanStatus.error, message=str(e))
            raise
    
    @asynccontextmanager
    async def request_stream(
        self,
        messages: list[ModelMessage],
        model_settings: Settings | None,
        model_request_parameters: ModelRequestParameters,
        run_context: Any = None,
    ) -> AsyncIterator[TracedStreamedResponse]:
        tracer = get_tracer()
        
        span = tracer.start_span(
            name=f"model.request_stream:{self.model_name}",
            kind=SpanKind.client,
            span_type=SpanType.model_request,
            attributes={
                "model.name": self.model_name,
                "model.streaming": True,
                "model.messages_count": len(messages),
            },
        )
        
        try:
            async with self.wrapped.request_stream(
                messages, model_settings, model_request_parameters, run_context
            ) as stream:
                traced_stream = TracedStreamedResponse(stream, span, tracer)
                yield traced_stream
            
            tracer.end_span(span, status=SpanStatus.ok)
            
        except Exception as e:
            tracer.record_exception(e)
            tracer.end_span(span, status=SpanStatus.error, message=str(e))
            raise
```

## 3. Nesting Verification

This approach relies on `TracingContext` using `contextvars`:

```
Orchestrator.run [agent.run:orchestrator]
└── model.request:openrouter:... [TracedModel.request]
└── tool.call:delegate_research
    └── agent.delegation:research
        └── agent.run:research
            └── model.request:openrouter:... [TracedModel.request]
            └── tool.call:web_search
                └── tool.result
```

Each `start_span()` automatically picks up `context.current_span` as parent.

## 4. Agent Factory Helper

Create `python-workers/agents/common.py`:

```python
from pydantic_ai import Agent
from pydantic_ai.models import Model
from tracing.wrappers import TracedModel


def create_traced_agent(model: str | Model, **kwargs) -> Agent:
    """
    Create an agent with automatic model tracing.
    
    Usage:
        agent = create_traced_agent("openrouter:minimax/minimax-m2.5", output_type=MyOutput)
    """
    return Agent(TracedModel(model), **kwargs)


def wrap_model(model: str | Model) -> TracedModel:
    """Wrap a model for tracing. Use when passing model to existing agents."""
    return TracedModel(model)
```

## 5. Implementation Steps

### Step 1: Create `python-workers/tracing/wrappers.py`
Implement `TracedModel` and `TracedStreamedResponse` as defined above.

### Step 2: Update `python-workers/tracing/__init__.py`
Export new classes:
```python
from .wrappers import TracedModel, TracedStreamedResponse, wrap_model
```

### Step 3: Create `python-workers/agents/common.py`
Add the factory helper.

### Step 4: Update `python-workers/agents/*.py`
Replace:
```python
agent = Agent(model, output_type=..., deps_type=...)
```
With:
```python
from tracing import TracedModel
agent = Agent(TracedModel(model), output_type=..., deps_type=...)
```

Or use the factory:
```python
from agents.common import create_traced_agent
agent = create_traced_agent(model, output_type=..., deps_type=...)
```

### Step 5: Update `reproduce_issue.py`
Replace `TestModel()` with `TracedModel(TestModel())`.

## 6. Verification Plan

1. **Mock Test**: Run `reproduce_issue.py` - verify `model.request` spans appear
2. **Thinking Test**: Run with a model that produces `ThinkingPart` (e.g., DeepSeek)
3. **Streaming Test**: Run with streaming enabled, verify spans capture stream events
4. **Timeout Test**: Simulate timeout, verify error span is created
5. **Nesting Test**: Run `examples/02_delegation.py`, verify deep nesting works
