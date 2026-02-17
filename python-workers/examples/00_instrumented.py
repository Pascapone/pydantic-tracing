"""
Test using pydantic-ai's built-in instrumentation with our custom tracer.
This shows how the tracing system captures agent internals.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai import Agent
from pydantic import BaseModel
from tracing import get_tracer, print_trace, TraceViewer
from tracing.spans import SpanKind, SpanType


class Output(BaseModel):
    answer: str
    confidence: float


async def main():
    print("=" * 60)
    print("Pydantic-AI Built-in Instrumentation Test")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        output_type=Output,
        instructions="Answer questions concisely.",
    )
    
    trace = tracer.start_trace(
        name="instrumented_agent_run",
        user_id="test_user",
        session_id="test_session",
        metadata={"test": "instrumentation"},
    )
    
    print(f"\nTrace ID: {trace.id}")
    
    agent_span = tracer.start_span(
        name="agent.run:instrumented",
        kind=SpanKind.internal,
        span_type=SpanType.agent_run,
        attributes={
            "agent.name": "instrumented_agent",
            "agent.model": "minimax/m2.5",
        },
    )
    
    tracer.add_event("agent_start", {"prompt": "What is 2+2?"})
    
    print("Running agent...")
    
    try:
        result = await asyncio.wait_for(
            agent.run("What is 2+2?"),
            timeout=30
        )
        
        tracer.add_event("agent_complete", {
            "answer": result.output.answer,
            "confidence": result.output.confidence,
        })
        
        agent_span.set_attribute("result.answer", result.output.answer)
        agent_span.set_attribute("result.confidence", result.output.confidence)
        agent_span.set_attribute("usage.total_tokens", result.usage().total_tokens if result.usage() else 0)
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        print(f"\nResult:")
        print(f"  Answer: {result.output.answer}")
        print(f"  Confidence: {result.output.confidence}")
        
        print("\n" + "=" * 60)
        print("Trace Summary:")
        print("=" * 60)
        print_trace(trace.id, str(db_path))
        
        print("\n" + "=" * 60)
        print("Full Trace Data (JSON):")
        print("=" * 60)
        import json
        trace_data = viewer.get_trace(trace.id)
        print(json.dumps(trace_data, indent=2, default=str)[:1500])
        
    except asyncio.TimeoutError:
        tracer.end_span(agent_span)
        tracer.end_trace()
        print("Timeout")
    except Exception as e:
        tracer.end_span(agent_span)
        tracer.end_trace()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
