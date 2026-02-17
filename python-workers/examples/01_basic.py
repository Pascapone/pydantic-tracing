"""
Basic example: Single research agent with tool calls.
Demonstrates: agent run, tool calls, structured output, tracing capture.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_research_agent, AgentDeps
from tracing import get_tracer, get_collector, print_trace


async def main():
    print("=" * 60)
    print("Example 1: Basic Research Agent")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    agent = create_research_agent()
    deps = AgentDeps(
        user_id="user_001",
        session_id="session_001",
        request_id="req_001",
        metadata={"example": "basic_workflow"},
    )
    
    trace = tracer.start_trace(
        name="basic_research_example",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
        metadata=deps.metadata,
    )
    
    print(f"\nTrace ID: {trace.id}")
    print("Running research agent...\n")
    
    try:
        result = await agent.run(
            "Research information about pydantic-ai agents and tracing",
            deps=deps,
        )
        
        tracer.end_trace()
        
        print(f"\nResearch Report:")
        print(f"  Query: {result.output.query}")
        print(f"  Summary: {result.output.summary[:200]}...")
        print(f"  Key Findings: {len(result.output.key_findings)}")
        print(f"  Sources: {len(result.output.sources)}")
        print(f"  Confidence: {result.output.confidence:.0%}")
        
        print("\n" + "=" * 60)
        print("Trace Summary:")
        print("=" * 60)
        print_trace(trace.id, str(db_path))
        
    except Exception as e:
        tracer.end_trace()
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
