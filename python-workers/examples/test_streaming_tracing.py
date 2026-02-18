"""
Test script for the streaming event-based tracing.
Run: python examples/test_streaming_tracing.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_research_agent, AgentDeps
from tracing import get_tracer, print_trace
from tracing.spans import SpanKind, SpanType


async def main():
    print("=" * 60)
    print("Test: Streaming Event-Based Tracing")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    agent = create_research_agent()
    deps = AgentDeps(
        user_id="test_user",
        session_id="test_session",
        request_id="test_request",
        metadata={"test": "streaming"},
    )
    
    trace = tracer.start_trace(
        name="test_streaming_tracing",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
        metadata=deps.metadata,
    )
    
    print(f"\nTrace ID: {trace.id}")
    
    # Start agent span
    agent_span = tracer.start_span(
        name="agent.run:research",
        kind=SpanKind.internal,
        span_type=SpanType.agent_run,
        attributes={"agent.name": "research", "agent.model": "minimax-m2.5"},
    )
    
    # Track active tool spans
    active_tool_spans = {}
    reasoning_span = None
    reasoning_text = ""
    total_usage = {"input_tokens": 0, "output_tokens": 0}
    output_data = None
    
    print("Running agent with run_stream_events...")
    print("-" * 40)
    
    try:
        async for event in agent.run_stream_events("What is pydantic-ai?", deps=deps):
            event_type = type(event).__name__
            print(f"Event: {event_type}")
            
            if event_type == "FunctionToolCallEvent":
                tool_name = getattr(event, 'tool_name', 'unknown')
                tool_call_id = getattr(event, 'tool_call_id', '')
                tool_args = getattr(event, 'args', {})
                print(f"  -> Tool called: {tool_name}")
                
                # Start tool span
                tool_span = tracer.start_span(
                    name=f"tool.call:{tool_name}",
                    kind=SpanKind.internal,
                    span_type=SpanType.tool_call,
                    attributes={
                        "tool.name": tool_name,
                        "tool.call_id": tool_call_id,
                        "tool.arguments": str(tool_args)[:200],
                    },
                )
                active_tool_spans[tool_call_id] = tool_span
                
            elif event_type == "FunctionToolResultEvent":
                tool_call_id = getattr(event, 'tool_call_id', '')
                tool_name = getattr(event, 'tool_name', 'unknown')
                print(f"  -> Tool result: {tool_name}")
                
                if tool_call_id in active_tool_spans:
                    tool_span = active_tool_spans.pop(tool_call_id)
                    tracer.end_span(tool_span)
                    
            elif event_type == "PartStartEvent":
                part_type = getattr(event, 'part_type', '')
                print(f"  -> Part start: {part_type}")
                
                if part_type == 'thinking':
                    reasoning_span = tracer.start_span(
                        name="model.reasoning",
                        kind=SpanKind.client,
                        span_type=SpanType.model_response,
                    )
                    reasoning_text = ""
                    
            elif event_type == "PartDeltaEvent":
                part_type = getattr(event, 'part_type', '')
                if part_type == 'thinking':
                    content = getattr(event, 'content', getattr(event, 'delta', ''))
                    reasoning_text += content
                    
            elif event_type == "FinalResultEvent":
                print(f"  -> Final result")
                if reasoning_span and reasoning_text:
                    reasoning_span.set_attribute("model.reasoning", reasoning_text[:5000])
                    tracer.end_span(reasoning_span)
                    reasoning_span = None
                
            elif event_type == "AgentRunResultEvent":
                print(f"  -> Run complete")
                if hasattr(event, 'result'):
                    output_data = event.result
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    
    # End agent span
    tracer.end_span(agent_span)
    
    # End trace
    tracer.end_trace()
    
    print("-" * 40)
    print(f"\nOutput: {output_data}")
    
    print("\n" + "=" * 60)
    print("Trace Summary")
    print("=" * 60)
    print_trace(trace.id, str(db_path))


if __name__ == "__main__":
    asyncio.run(main())
