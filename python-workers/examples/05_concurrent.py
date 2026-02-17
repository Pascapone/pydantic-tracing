"""
Concurrent agents example: Multiple agents running in parallel.
Demonstrates: parallel execution, trace correlation, timing analysis.
"""
import asyncio
import sys
from pathlib import Path
import time

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import (
    create_research_agent,
    create_coding_agent,
    create_analysis_agent,
    AgentDeps,
)
from tracing import get_tracer, print_trace, TraceViewer


async def run_agent(agent, prompt: str, agent_name: str, deps: AgentDeps, tracer):
    start = time.time()
    
    trace = tracer.start_trace(
        name=f"concurrent_{agent_name}",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=f"{deps.request_id}_{agent_name}",
        metadata={"agent_type": agent_name, "concurrent": True},
    )
    
    try:
        result = await agent.run(prompt, deps=deps)
        duration_ms = int((time.time() - start) * 1000)
        
        tracer.end_trace()
        
        return {
            "agent": agent_name,
            "trace_id": trace.id,
            "duration_ms": duration_ms,
            "success": True,
            "output_type": type(result.output).__name__,
        }
    except Exception as e:
        tracer.end_trace()
        return {
            "agent": agent_name,
            "trace_id": trace.id,
            "success": False,
            "error": str(e),
        }


async def main():
    print("=" * 60)
    print("Example 5: Concurrent Agent Execution")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    research_agent = create_research_agent()
    coding_agent = create_coding_agent()
    analysis_agent = create_analysis_agent()
    
    base_deps = AgentDeps(
        user_id="user_005",
        session_id="session_005",
        request_id="req_005",
        metadata={"example": "concurrent"},
    )
    
    main_trace = tracer.start_trace(
        name="concurrent_orchestration",
        user_id=base_deps.user_id,
        session_id=base_deps.session_id,
        request_id=base_deps.request_id,
        metadata={"example": "concurrent", "agents": ["research", "coding", "analysis"]},
    )
    
    print(f"\nMain Trace ID: {main_trace.id}")
    print("Running 3 agents concurrently...\n")
    
    start_time = time.time()
    
    tasks = [
        run_agent(
            research_agent,
            "Research best practices for error handling in Python",
            "research",
            base_deps,
            tracer,
        ),
        run_agent(
            coding_agent,
            "Write a simple Python function to sort a list",
            "coding",
            base_deps,
            tracer,
        ),
        run_agent(
            analysis_agent,
            "Analyze this data: [10, 20, 30, 40, 50]",
            "analysis",
            base_deps,
            tracer,
        ),
    ]
    
    results = await asyncio.gather(*tasks)
    
    total_duration = int((time.time() - start_time) * 1000)
    
    tracer.end_trace()
    
    print("=" * 60)
    print("Concurrent Execution Results:")
    print("=" * 60)
    
    for r in results:
        status = "✓" if r["success"] else "✗"
        duration = f"{r.get('duration_ms', 0)}ms" if r["success"] else "failed"
        print(f"  {status} {r['agent']:12} | {duration:10} | trace: {r['trace_id'][:8]}...")
    
    print(f"\nTotal wall-clock time: {total_duration}ms")
    print(f"(Parallel execution saved time vs sequential)")
    
    print("\n" + "=" * 60)
    print("Main Trace Summary:")
    print("=" * 60)
    print_trace(main_trace.id, str(db_path))
    
    print("\n" + "=" * 60)
    print("Database Stats:")
    print("=" * 60)
    stats = viewer.get_stats()
    print(f"  Total traces: {stats['trace_count']}")
    print(f"  Total spans: {stats['span_count']}")
    print(f"  Avg duration: {stats['avg_duration_ms']:.2f}ms")


if __name__ == "__main__":
    asyncio.run(main())
