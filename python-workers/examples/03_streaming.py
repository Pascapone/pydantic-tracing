"""
Streaming example: Agent with streaming output and trace capture.
Demonstrates: streaming, real-time spans, partial outputs.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_coding_agent, AgentDeps
from tracing import get_tracer, SpanKind, SpanType


async def main():
    print("=" * 60)
    print("Example 3: Streaming with Trace Capture")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    agent = create_coding_agent()
    deps = AgentDeps(
        user_id="user_003",
        session_id="session_003",
        request_id="req_003",
        metadata={"example": "streaming"},
    )
    
    trace = tracer.start_trace(
        name="streaming_example",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
        metadata=deps.metadata,
    )
    
    agent_span = tracer.start_span(
        name="agent.stream:coding",
        kind=SpanKind.internal,
        span_type=SpanType.agent_stream,
        attributes={
            "agent.name": "coding",
            "agent.model": "openrouter:minimax/minimax-m2.5",
        },
    )
    
    print(f"\nTrace ID: {trace.id}")
    print("Streaming output from coding agent...\n")
    print("-" * 40)
    
    try:
        async with agent.run_stream(
            "Write a Python function to calculate fibonacci numbers with memoization",
            deps=deps,
        ) as result:
            chunks_received = 0
            
            async for text in result.stream_text(delta=True):
                print(text, end="", flush=True)
                chunks_received += 1
                
                if chunks_received % 10 == 0:
                    tracer.add_event("chunk", {"count": chunks_received})
            
            final_result = await result.get_output()
        
        print("\n" + "-" * 40)
        
        agent_span.set_attribute("chunks_received", chunks_received)
        agent_span.set_attribute("output_type", type(final_result).__name__)
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        print(f"\nCode Result:")
        print(f"  Files generated: {len(final_result.files)}")
        if final_result.files:
            print(f"  Main file: {final_result.files[0].filename}")
            print(f"  Lines: {final_result.files[0].line_count}")
        print(f"  Explanation: {final_result.explanation[:100]}...")
        print(f"  Chunks streamed: {chunks_received}")
        
    except Exception as e:
        tracer.end_span()
        tracer.end_trace()
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
