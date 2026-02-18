# Deep Tracing Fix Specification

> Fix the agent tracing system to capture model thinking, tool calling, and all agent internals.

## Problem Statement

The current deep tracing implementation in `python-workers/handlers/agent_trace.py` is not capturing:
- Model reasoning/thinking content
- Tool call arguments and results
- Conversation history details
- Usage statistics per message

Traces show minimal data:
```
[INFO] trace_start
[SUCCESS] span_start: agent.run:research
[INFO] agent_start
[INFO] agent_complete
[SUCCESS] span_end
[SUCCESS] trace_end
```

## Root Cause Analysis

### 1. Message Structure Mismatch

The `_capture_conversation_history()` method expects specific pydantic-ai message types:

```python
# Expected:
ModelRequest(parts=[UserPromptPart, SystemPromptPart, ToolReturnPart])
ModelResponse(parts=[TextPart, ToolCallPart], usage=RequestUsage)
```

But the actual structure from `result.all_messages()` may differ, especially:
- `ToolCallPart` has `args` as `ArgsJson(args_json='...')` not a dict
- Part types are strings in `part_kind` attribute, not class names
- Usage might be in a different location

### 2. Span Parenting Issues

New spans created in `_capture_conversation_history()` are not properly nested:
- They're created AFTER the agent span ends
- The parent context is lost when spans are created outside the agent span's context

### 3. Timing Issues

The conversation history is captured AFTER the agent completes, which means:
- No real-time visibility during execution
- Spans are created after the fact, losing temporal accuracy

## Solution: Streaming Event-Based Tracing

Instead of reconstructing history after execution, use pydantic-ai's streaming events for real-time capture:

```python
# Using run_stream_events() for real-time capture
async for event in agent.run_stream_events(prompt, deps=deps):
    if isinstance(event, FunctionToolCallEvent):
        # Create tool call span immediately
        tool_span = tracer.start_span(
            name=f"tool.call:{event.tool_name}",
            span_type=SpanType.tool_call,
            attributes={
                "tool.name": event.tool_name,
                "tool.arguments": event.args,
            }
        )
    elif isinstance(event, FunctionToolResultEvent):
        # End tool span with result
        tool_span.set_attribute("tool.result", event.result)
        tracer.end_span(tool_span)
```

## Implementation Plan

### Phase 1: Debug Current Implementation

Create a debug script to understand the actual message structure:

```python
# python-workers/examples/debug_messages.py
import asyncio
from pydantic_ai import Agent
from pydantic import BaseModel

class Output(BaseModel):
    answer: str
    confidence: float

async def main():
    agent = Agent("openrouter:minimax/minimax-m2.5", output_type=Output)
    result = await agent.run("What is 2+2?")
    
    print("Result type:", type(result))
    print("Has all_messages:", hasattr(result, 'all_messages'))
    
    messages = result.all_messages()
    print(f"\nMessages count: {len(messages)}")
    
    for i, msg in enumerate(messages):
        print(f"\n=== Message {i} ===")
        print(f"Type: {type(msg).__name__}")
        print(f"Attributes: {[x for x in dir(msg) if not x.startswith('_')]}")
        
        if hasattr(msg, 'parts'):
            print(f"Parts count: {len(msg.parts)}")
            for j, part in enumerate(msg.parts):
                print(f"  Part {j}: type={type(part).__name__}")
                print(f"    Attributes: {[x for x in dir(part) if not x.startswith('_')]}")

asyncio.run(main())
```

### Phase 2: Implement Event-Based Tracing

Modify the `AgentTraceHandler` to use streaming events:

```python
# python-workers/handlers/agent_trace.py

async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
    # ... initialization code ...
    
    # Track active tool spans
    active_tool_spans: Dict[str, Span] = {}
    
    # Use run_stream_events for real-time tracing
    async with agent.run_stream(prompt, deps=deps) as run_result:
        async for event in run_result.stream_events():
            await self._handle_stream_event(
                tracer, event, active_tool_spans, ctx
            )
        
        # Get final result
        result = await run_result.get_output()
    
    # ... finalization code ...

async def _handle_stream_event(
    self,
    tracer: PydanticAITracer,
    event: Any,
    active_tool_spans: Dict[str, Span],
    ctx: JobContext,
) -> None:
    """Handle streaming events and create spans."""
    from pydantic_ai import FunctionToolCallEvent, FunctionToolResultEvent
    
    if isinstance(event, FunctionToolCallEvent):
        # Start tool call span
        tool_span = tracer.start_span(
            name=f"tool.call:{event.tool_name}",
            kind=SpanKind.internal,
            span_type=SpanType.tool_call,
            attributes={
                "tool.name": event.tool_name,
                "tool.call_id": event.tool_call_id,
            }
        )
        active_tool_spans[event.tool_call_id] = tool_span
        ctx.log(f"Tool called: {event.tool_name}", level="debug")
        
    elif isinstance(event, FunctionToolResultEvent):
        # End tool call span with result
        if event.tool_call_id in active_tool_spans:
            tool_span = active_tool_spans.pop(event.tool_call_id)
            tool_span.set_attribute("tool.result", str(event.result)[:2000])
            tracer.end_span(tool_span)
```

### Phase 3: Capture Model Responses

For model thinking and responses:

```python
async def _handle_stream_event(self, tracer, event, active_tool_spans, ctx):
    from pydantic_ai import (
        FunctionToolCallEvent,
        FunctionToolResultEvent,
        PartStartEvent,
        PartDeltaEvent,
        FinalResultEvent,
    )
    
    if isinstance(event, PartStartEvent):
        if event.part_type == 'text':
            # Start reasoning span
            self.reasoning_span = tracer.start_span(
                name="model.reasoning",
                kind=SpanKind.client,
                span_type=SpanType.model_response,
            )
            self.reasoning_text = ""
            
    elif isinstance(event, PartDeltaEvent):
        if hasattr(self, 'reasoning_span') and event.part_type == 'text':
            # Accumulate reasoning text
            self.reasoning_text += event.content
            
    elif isinstance(event, FinalResultEvent):
        if hasattr(self, 'reasoning_span'):
            self.reasoning_span.set_attribute(
                "model.reasoning", self.reasoning_text
            )
            tracer.end_span(self.reasoning_span)
```

### Phase 4: Update Message History Capture

Fix the `_capture_conversation_history()` to handle actual pydantic-ai structures:

```python
def _capture_conversation_history(self, tracer, messages: List[Any], parent_span: Any) -> None:
    """
    Capture conversation history with correct pydantic-ai message parsing.
    """
    for msg in messages:
        msg_type = type(msg).__name__
        
        if msg_type == "ModelRequest":
            # Handle parts - check part_kind attribute
            for part in getattr(msg, 'parts', []):
                part_kind = getattr(part, 'part_kind', None) or type(part).__name__
                
                if part_kind in ('user-prompt', 'UserPromptPart'):
                    content = getattr(part, 'content', '')
                    tracer.add_event("user_prompt", {"content": str(content)[:1000]})
                    
                elif part_kind in ('system-prompt', 'SystemPromptPart'):
                    content = getattr(part, 'content', '')
                    tracer.add_event("system_prompt", {"content": str(content)[:500]})
                    
                elif part_kind in ('tool-return', 'ToolReturnPart'):
                    tool_name = getattr(part, 'tool_name', 'unknown')
                    content = getattr(part, 'content', '')
                    tracer.add_event("tool_result", {
                        "tool_name": tool_name,
                        "result": str(content)[:2000]
                    })
        
        elif msg_type == "ModelResponse":
            for part in getattr(msg, 'parts', []):
                part_kind = getattr(part, 'part_kind', None) or type(part).__name__
                
                if part_kind in ('text', 'TextPart'):
                    content = getattr(part, 'content', '')
                    tracer.add_event("model_text", {"content": str(content)[:5000]})
                    
                elif part_kind in ('tool-call', 'ToolCallPart'):
                    tool_name = getattr(part, 'tool_name', 'unknown')
                    # ArgsJson has args_json attribute
                    args_json = getattr(part, 'args', None)
                    if hasattr(args_json, 'args_json'):
                        args = json.loads(args_json.args_json)
                    else:
                        args = args_json or {}
                    
                    tracer.add_event("tool_call", {
                        "tool_name": tool_name,
                        "arguments": args
                    })
            
            # Capture usage
            usage = getattr(msg, 'usage', None)
            if usage:
                tracer.add_event("model_usage", {
                    "input_tokens": getattr(usage, 'input_tokens', 0),
                    "output_tokens": getattr(usage, 'output_tokens', 0),
                })
```

## Event Types Reference (pydantic-ai)

| Event | Description |
|-------|-------------|
| `FunctionToolCallEvent` | Model is calling a tool |
| `FunctionToolResultEvent` | Tool returned a result |
| `PartStartEvent` | Starting a new response part |
| `PartDeltaEvent` | Delta update to current part |
| `FinalResultEvent` | Final result is ready |

## Message Types Reference (pydantic-ai)

| Type | Key Attributes |
|------|----------------|
| `ModelRequest` | `parts`, `instructions`, `timestamp` |
| `ModelResponse` | `parts`, `usage`, `model_name`, `timestamp` |
| `UserPromptPart` | `content`, `timestamp`, `part_kind='user-prompt'` |
| `SystemPromptPart` | `content`, `part_kind='system-prompt'` |
| `TextPart` | `content`, `part_kind='text'` |
| `ToolCallPart` | `tool_name`, `args` (ArgsJson), `tool_call_id`, `part_kind='tool-call'` |
| `ToolReturnPart` | `tool_name`, `content`, `tool_call_id`, `part_kind='tool-return'` |

## Files to Modify

| File | Changes |
|------|---------|
| `python-workers/handlers/agent_trace.py` | Implement streaming event handling |
| `python-workers/tracing/processor.py` | Add helper methods for span management |
| `python-workers/examples/debug_messages.py` | NEW: Debug script for message structure |
| `src/components/tracing/SpanNode.tsx` | Update to display new span types |
| `src/types/tracing.ts` | Add new span types if needed |

## Testing

1. Run debug script to verify message structure:
   ```bash
   cd python-workers
   python examples/debug_messages.py
   ```

2. Create an agent job and verify traces:
   ```bash
   curl -X POST http://localhost:3000/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"type": "agent.run", "payload": {"agent": "research", "prompt": "What is pydantic-ai?"}, "userId": "test"}'
   ```

3. Check trace in UI at `/traces`

## Success Criteria

- [ ] Traces show tool calls with arguments
- [ ] Traces show tool results
- [ ] Traces show model reasoning/thinking
- [ ] Traces show usage statistics per message
- [ ] Spans are properly nested and timed
- [ ] Real-time updates work in UI
