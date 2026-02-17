"""
Test research agent with real API call (shorter test).
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_research_agent, AgentDeps
from tracing import get_tracer, print_trace, TraceViewer


async def main():
    print("=" * 60)
    print("Research Agent Test with Real API")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    agent = create_research_agent()
    deps = AgentDeps(
        user_id="test_user",
        session_id="test_session",
        request_id="test_req_001",
        metadata={"test": "real_api"},
    )
    
    trace = tracer.start_trace(
        name="research_api_test",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
    )
    
    print(f"\nTrace ID: {trace.id}")
    print("Calling OpenRouter API...")
    
    try:
        result = await asyncio.wait_for(
            agent.run("What is pydantic-ai? Answer in one sentence.", deps=deps),
            timeout=60.0,
        )
        
        tracer.end_trace()
        
        print(f"\nResearch Report:")
        print(f"  Query: {result.output.query}")
        print(f"  Summary: {result.output.summary[:200]}")
        print(f"  Findings: {len(result.output.key_findings)}")
        print(f"  Sources: {len(result.output.sources)}")
        print(f"  Confidence: {result.output.confidence:.0%}")
        
        print("\n" + "=" * 60)
        print("Trace Summary:")
        print("=" * 60)
        print_trace(trace.id, str(db_path))
        
    except asyncio.TimeoutError:
        tracer.end_trace()
        print("Request timed out after 60 seconds")
    except Exception as e:
        tracer.end_trace()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
