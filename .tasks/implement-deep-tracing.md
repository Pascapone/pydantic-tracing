# Task: Implement Deep Tracing with Streaming Events

## Context

The deep tracing system is not capturing model thinking, tool calls, and other agent internals. See `.specs/deep-tracing-fix.md` for the full specification.

## Objective

Implement streaming event-based tracing to capture agent internals in real-time.

## Deliverables

### 1. Debug Script (NEW FILE)

Create `python-workers/examples/debug_messages.py`:

```python
"""
Debug script to analyze pydantic-ai message structure.
Run: python examples/debug_messages.py
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai import Agent
from pydantic import BaseModel


class Output(BaseModel):
    answer: str
    confidence: float


async def main():
    print("=" * 60)
    print("Debug: Pydantic-AI Message Structure Analysis")
    print("=" * 60)
    
    # Create a simple agent
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        output_type=Output,
        instructions="Answer questions concisely.",
    )
    
    print("\nRunning agent...")
    
    try:
        result = await asyncio.wait_for(
            agent.run("What is 2+2?"),
            timeout=30
        )
    except Exception as e:
        print(f"Error: {e}")
        return
    
    print("\n--- Result Analysis ---")
    print(f"Result type: {type(result).__name__}")
    print(f"Result attributes: {[x for x in dir(result) if not x.startswith('_')]}")
    
    # Check for all_messages
    print(f"\nHas all_messages: {hasattr(result, 'all_messages')}")
    
    if hasattr(result, 'all_messages'):
        messages = result.all_messages()
        print(f"Messages count: {len(messages)}")
        
        for i, msg in enumerate(messages):
            print(f"\n{'='*40}")
            print(f"Message {i}")
            print(f"{'='*40}")
            print(f"Type: {type(msg).__name__}")
            print(f"Attributes: {[x for x in dir(msg) if not x.startswith('_')]}")
            
            # Check for parts
            if hasattr(msg, 'parts'):
                print(f"\nParts count: {len(msg.parts)}")
                for j, part in enumerate(msg.parts):
                    print(f"\n  Part {j}:")
                    print(f"    Type: {type(part).__name__}")
                    attrs = [x for x in dir(part) if not x.startswith('_')]
                    print(f"    Attributes: {attrs}")
                    
                    # Check for part_kind
                    if hasattr(part, 'part_kind'):
                        print(f"    part_kind: {part.part_kind}")
                    
                    # Check content
                    if hasattr(part, 'content'):
                        content = str(part.content)[:100]
                        print(f"    content: {content}...")
                    
                    # Check tool_name
                    if hasattr(part, 'tool_name'):
                        print(f"    tool_name: {part.tool_name}")
                    
                    # Check args (for ToolCallPart)
                    if hasattr(part, 'args'):
                        args = part.args
                        print(f"    args type: {type(args).__name__}")
                        if hasattr(args, 'args_json'):
                            print(f"    args_json: {args.args_json[:100]}...")
                        else:
                            print(f"    args: {str(args)[:100]}...")
            
            # Check usage
            if hasattr(msg, 'usage'):
                usage = msg.usage
                print(f"\n  Usage:")
                print(f"    Type: {type(usage).__name__}")
                if usage:
                    print(f"    input_tokens: {getattr(usage, 'input_tokens', 'N/A')}")
                    print(f"    output_tokens: {getattr(usage, 'output_tokens', 'N/A')}")
            
            # Check model_name
            if hasattr(msg, 'model_name'):
                print(f"\n  model_name: {msg.model_name}")
    
    # Check usage on result
    print(f"\n--- Result Usage ---")
    if hasattr(result, 'usage'):
        try:
            usage = result.usage()
            print(f"Usage type: {type(usage).__name__}")
            print(f"  total_tokens: {getattr(usage, 'total_tokens', 'N/A')}")
            print(f"  input_tokens: {getattr(usage, 'input_tokens', 'N/A')}")
            print(f"  output_tokens: {getattr(usage, 'output_tokens', 'N/A')}")
        except Exception as e:
            print(f"Error getting usage: {e}")
    
    # Check output
    print(f"\n--- Result Output ---")
    if hasattr(result, 'output'):
        print(f"Output type: {type(result.output).__name__}")
        if hasattr(result.output, 'model_dump'):
            print(f"Output: {result.output.model_dump()}")
        else:
            print(f"Output: {result.output}")
    
    print("\n" + "=" * 60)
    print("Analysis Complete")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
```

### 2. Update AgentTraceHandler (MODIFY FILE)

Update `python-workers/handlers/agent_trace.py` to use streaming events.

Key changes:
1. Replace `agent.run()` with `agent.run_stream()`
2. Handle streaming events in real-time
3. Create spans for tool calls during execution
4. Capture model reasoning as it streams

Replace the execute method (lines 44-260) with:

```python
async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute an agent with streaming event-based tracing enabled.
    
    Uses agent.run_stream() to capture events in real-time:
    - Tool calls with arguments
    - Tool results
    - Model reasoning/thinking
    - Usage statistics
    """
    start_time = time.time()
    trace_id = None
    trace = None
    agent_span = None
    tracer = None
    
    # Extract parameters
    agent_type = payload.get("agent", "research")
    prompt = payload.get("prompt", "")
    model = payload.get("model", self.DEFAULT_MODEL)
    user_id = payload.get("userId") or payload.get("user_id")
    session_id = payload.get("sessionId") or payload.get("session_id")
    request_id = payload.get("requestId") or payload.get("request_id")
    options = payload.get("options", {})
    timeout = options.get("timeout", self.DEFAULT_TIMEOUT)
    
    # Validate agent type
    valid_agents = ["research", "coding", "analysis", "orchestrator"]
    if agent_type not in valid_agents:
        raise ValueError(f"Invalid agent type: {agent_type}. Must be one of: {valid_agents}")
    
    # Validate prompt
    if not prompt:
        raise ValueError("Prompt is required for agent execution")

    try:
        # Phase 1: Initialize (10%)
        ctx.progress(10, f"Initializing {agent_type} agent...", "init")
        
        # Import agent factory functions
        from agents import (
            create_research_agent,
            create_coding_agent,
            create_analysis_agent,
            create_orchestrator,
            AgentDeps,
        )
        from tracing import get_tracer, SpanKind, SpanType
        
        # Phase 2: Create agent and tracer (30%)
        ctx.progress(20, "Creating agent instance...", "init")
        
        # Map agent type to factory function
        agent_factories = {
            "research": create_research_agent,
            "coding": create_coding_agent,
            "analysis": create_analysis_agent,
            "orchestrator": create_orchestrator,
        }
        
        agent = agent_factories[agent_type](model=model)
        
        ctx.progress(30, "Initializing tracer...", "init")
        
        # Initialize tracer with database path
        db_path = Path(__file__).parent.parent / "traces.db"
        tracer = get_tracer(str(db_path))
        
        # Phase 3: Start trace (40%)
        ctx.progress(40, "Starting trace...", "tracing")
        
        trace = tracer.start_trace(
            name=f"agent_{agent_type}",
            user_id=user_id,
            session_id=session_id,
            request_id=request_id,
            metadata={
                "agent_type": agent_type,
                "model": model,
                "job_id": ctx.job_id,
                "prompt_preview": prompt[:100] + "..." if len(prompt) > 100 else prompt,
            },
        )
        trace_id = trace.id
        
        ctx.log(f"Trace started: {trace_id}", level="debug")
        
        # Start main agent span
        agent_span = tracer.start_span(
            name=f"agent.run:{agent_type}",
            kind=SpanKind.internal,
            span_type=SpanType.agent_run,
            attributes={
                "agent.name": agent_type,
                "agent.model": model,
                "agent.job_id": ctx.job_id,
            },
        )
        
        # Phase 4: Execute agent with streaming (50-80%)
        ctx.progress(50, "Executing agent with streaming...", "execution")
        
        # Create agent dependencies
        deps = AgentDeps(
            user_id=user_id or "anonymous",
            session_id=session_id or ctx.job_id,
            request_id=request_id or trace_id,
            metadata={
                "job_id": ctx.job_id,
                "agent_type": agent_type,
                "model": model,
            },
        )
        
        tracer.add_event("agent_start", {"prompt": prompt})
        
        # Track active spans and state
        active_tool_spans: Dict[str, Any] = {}
        reasoning_span = None
        reasoning_text = ""
        total_usage = {"input_tokens": 0, "output_tokens": 0}
        
        ctx.log(f"Running {agent_type} agent with streaming...", level="info")
        
        try:
            # Use run_stream for real-time event capture
            async with asyncio.timeout(timeout):
                async with agent.run_stream(prompt, deps=deps) as run_result:
                    # Stream events
                    async for event in run_result.stream_events():
                        event_result = self._handle_stream_event(
                            tracer=tracer,
                            event=event,
                            active_tool_spans=active_tool_spans,
                            reasoning_span_ref=[reasoning_span],
                            reasoning_text_ref=[reasoning_text],
                            total_usage=total_usage,
                            ctx=ctx,
                        )
                        if event_result:
                            reasoning_span, reasoning_text = event_result
                    
                    # Get final result
                    output_data = await run_result.get_output()
                    result = run_result
                    
        except asyncio.TimeoutError:
            raise TimeoutError(f"Agent execution timed out after {timeout} seconds")
        
        ctx.progress(80, "Processing result...", "postprocessing")
        
        # End any remaining reasoning span
        if reasoning_span:
            reasoning_span.set_attribute("model.reasoning", reasoning_text[:5000])
            tracer.end_span(reasoning_span)
        
        # Record result in trace
        tracer.add_event("agent_complete", {
            "status": "success",
        })
        
        # Extract output
        if output_data is not None:
            output = self._serialize_output(output_data)
            
            agent_span.set_attribute("result.type", type(output_data).__name__)
            
            # Record total usage
            agent_span.set_attribute("usage.total_tokens", total_usage["input_tokens"] + total_usage["output_tokens"])
            agent_span.set_attribute("usage.input_tokens", total_usage["input_tokens"])
            agent_span.set_attribute("usage.output_tokens", total_usage["output_tokens"])
        else:
            output = {"raw": str(result)}
        
        # Phase 5: Finalize (90-100%)
        ctx.progress(90, "Finalizing trace...", "finalizing")
        
        # End agent span
        tracer.end_span(agent_span)
        agent_span = None
        
        # End trace
        tracer.end_trace()
        trace = None
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        ctx.progress(100, "Complete", "done")
        ctx.log(f"Agent execution completed in {duration_ms}ms", level="info")
        
        return {
            "trace_id": trace_id,
            "agent_type": agent_type,
            "output": output,
            "duration_ms": duration_ms,
            "status": "ok",
            "model": model,
        }
        
    except Exception as e:
        # Handle errors and record in trace
        error_message = str(e)
        error_type = type(e).__name__
        
        ctx.error(f"Agent execution failed: {error_type}: {error_message}")
        
        # Record exception in trace if tracer was initialized
        if tracer:
            if agent_span:
                tracer.record_exception(e)
                tracer.end_span(agent_span)
            if trace:
                tracer.end_trace()
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return {
            "trace_id": trace_id,
            "agent_type": agent_type,
            "error": {
                "type": error_type,
                "message": error_message,
            },
            "duration_ms": duration_ms,
            "status": "error",
        }
```

Add the new `_handle_stream_event` method:

```python
async def _handle_stream_event(
    self,
    tracer: Any,
    event: Any,
    active_tool_spans: Dict[str, Any],
    reasoning_span_ref: List[Any],
    reasoning_text_ref: List[str],
    total_usage: Dict[str, int],
    ctx: JobContext,
) -> Optional[tuple]:
    """
    Handle streaming events from pydantic-ai agent.
    
    Creates spans for:
    - Tool calls with arguments
    - Tool results
    - Model reasoning (text parts)
    
    Args:
        tracer: Tracer instance
        event: Streaming event from pydantic-ai
        active_tool_spans: Dict tracking active tool spans by call_id
        reasoning_span_ref: List containing current reasoning span (mutable ref)
        reasoning_text_ref: List containing accumulated reasoning text (mutable ref)
        total_usage: Dict to accumulate usage stats
        ctx: Job context for logging
    
    Returns:
        Updated (reasoning_span, reasoning_text) tuple if changed
    """
    from tracing import SpanKind, SpanType
    import json
    
    event_type = type(event).__name__
    
    # Handle tool call events
    if event_type == "FunctionToolCallEvent":
        tool_name = getattr(event, 'tool_name', 'unknown')
        tool_call_id = getattr(event, 'tool_call_id', str(time.time()))
        tool_args = getattr(event, 'args', {})
        
        # Parse args if it's ArgsJson
        if hasattr(tool_args, 'args_json'):
            try:
                args = json.loads(tool_args.args_json)
            except json.JSONDecodeError:
                args = {"raw": tool_args.args_json}
        else:
            args = tool_args if isinstance(tool_args, dict) else {"value": str(tool_args)}
        
        # Start tool call span
        tool_span = tracer.start_span(
            name=f"tool.call:{tool_name}",
            kind=SpanKind.internal,
            span_type=SpanType.tool_call,
            attributes={
                "tool.name": tool_name,
                "tool.call_id": tool_call_id,
                "tool.arguments": args,
            },
        )
        active_tool_spans[tool_call_id] = tool_span
        
        ctx.log(f"Tool called: {tool_name}({list(args.keys())})", level="debug")
        tracer.add_event("tool_call", {
            "tool_name": tool_name,
            "arguments_preview": str(args)[:200],
        })
    
    # Handle tool result events
    elif event_type == "FunctionToolResultEvent":
        tool_call_id = getattr(event, 'tool_call_id', '')
        tool_name = getattr(event, 'tool_name', 'unknown')
        tool_result = getattr(event, 'result', None)
        
        if tool_call_id in active_tool_spans:
            tool_span = active_tool_spans.pop(tool_call_id)
            
            # Serialize result
            if tool_result is not None:
                if hasattr(tool_result, 'model_dump'):
                    result_str = json.dumps(tool_result.model_dump())
                else:
                    result_str = str(tool_result)
            else:
                result_str = "None"
            
            tool_span.set_attribute("tool.result", result_str[:2000])
            tracer.end_span(tool_span)
            
            ctx.log(f"Tool result: {tool_name} -> {result_str[:100]}...", level="debug")
            tracer.add_event("tool_result", {
                "tool_name": tool_name,
                "result_preview": result_str[:200],
            })
    
    # Handle part events for reasoning capture
    elif event_type == "PartStartEvent":
        part_type = getattr(event, 'part_type', '')
        
        if part_type == 'text':
            # End any existing reasoning span
            if reasoning_span_ref[0]:
                tracer.end_span(reasoning_span_ref[0])
            
            # Start new reasoning span
            reasoning_span_ref[0] = tracer.start_span(
                name="model.reasoning",
                kind=SpanKind.client,
                span_type=SpanType.model_response,
                attributes={
                    "model.reasoning": "",
                },
            )
            reasoning_text_ref[0] = ""
    
    elif event_type == "PartDeltaEvent":
        part_type = getattr(event, 'part_type', '')
        content = getattr(event, 'content', getattr(event, 'delta', ''))
        
        if part_type == 'text' and content:
            reasoning_text_ref[0] += content
    
    elif event_type == "FinalResultEvent":
        # End reasoning span with full text
        if reasoning_span_ref[0] and reasoning_text_ref[0]:
            reasoning_span_ref[0].set_attribute("model.reasoning", reasoning_text_ref[0][:5000])
            tracer.end_span(reasoning_span_ref[0])
            reasoning_span_ref[0] = None
        
        # Capture usage from final result
        if hasattr(event, 'usage') and event.usage:
            usage = event.usage
            total_usage["input_tokens"] += getattr(usage, 'input_tokens', 0)
            total_usage["output_tokens"] += getattr(usage, 'output_tokens', 0)
    
    return (reasoning_span_ref[0], reasoning_text_ref[0])
```

Add the required import at the top of the file:

```python
import json
from typing import Any, Dict, Optional, List
```

### 3. Test the Implementation

After making the changes, test by:

1. Running the debug script:
   ```bash
   cd python-workers
   python examples/debug_messages.py
   ```

2. Creating an agent job:
   ```bash
   curl -X POST http://localhost:3000/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"type": "agent.run", "payload": {"agent": "research", "prompt": "What is pydantic-ai?"}, "userId": "test"}'
   ```

3. Checking traces in the UI at `/traces`

## Success Criteria

- [ ] Debug script runs and shows message structure
- [ ] Agent jobs execute with streaming events
- [ ] Traces show tool calls with arguments
- [ ] Traces show tool results
- [ ] Traces show model reasoning
- [ ] No errors in execution

## Notes

- The streaming event API might differ slightly from the documentation
- Check pydantic-ai version for exact event types
- Some models might not support streaming events - fallback to post-hoc capture if needed
