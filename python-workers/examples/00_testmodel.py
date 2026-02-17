"""
Simple test using TestModel to verify tracing without API calls.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel
from pydantic import BaseModel

from tracing import get_tracer, print_trace, TraceViewer
from tracing.spans import SpanKind, SpanType


class SimpleOutput(BaseModel):
    message: str
    count: int


async def main():
    print("=" * 60)
    print("Tracing Test with TestModel (no API calls)")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    agent = Agent(
        TestModel(),
        output_type=SimpleOutput,
        instructions="You are a test agent.",
    )
    
    trace = tracer.start_trace(
        name="test_model_run",
        user_id="test_user",
        session_id="test_session",
        metadata={"test": True},
    )
    
    print(f"\nTrace ID: {trace.id}")
    
    agent_span = tracer.start_span(
        name="agent.run:test_agent",
        kind=SpanKind.internal,
        span_type=SpanType.agent_run,
        attributes={"agent.name": "test_agent", "agent.model": "TestModel"},
    )
    
    print("Running agent with TestModel...")
    
    try:
        result = await agent.run("Hello, test!")
        
        tracer.add_event("agent_completed", {"output_type": type(result.output).__name__})
        
        agent_span.set_attribute("result.message", result.output.message)
        agent_span.set_attribute("result.count", result.output.count)
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        print(f"\nResult: {result.output}")
        
        print("\n" + "=" * 60)
        print("Trace Summary:")
        print("=" * 60)
        print_trace(trace.id, str(db_path))
        
        print("\n" + "=" * 60)
        print("Database Stats:")
        print("=" * 60)
        stats = viewer.get_stats()
        print(f"  Traces: {stats['trace_count']}")
        print(f"  Spans: {stats['span_count']}")
        print(f"  Avg duration: {stats['avg_duration_ms']:.2f}ms")
        
    except Exception as e:
        tracer.end_span(agent_span)
        tracer.end_trace()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(main())
