"""
Test nested traces with multi-agent delegation.
Demonstrates: agent.delegation spans with nested agent.run and tool calls.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_orchestrator, AgentDeps
from tracing import get_tracer, print_trace, TraceViewer


async def main():
    print("=" * 60)
    print("Example 7: Nested Traces (Multi-Agent Delegation)")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    orchestrator = create_orchestrator()
    deps = AgentDeps(
        user_id="user_007",
        session_id="session_007",
        request_id="req_007",
        metadata={"example": "nested_traces"},
    )
    
    print("Running orchestrator with nested delegation tracing...\n")
    
    try:
        from tracing import traced_agent
        
        with traced_agent(
            agent_name="orchestrator_nested",
            model="openrouter:minimax/minimax-m2.5",
            user_id=deps.user_id,
            session_id=deps.session_id,
            tracer=tracer
        ) as run:
            run.trace.request_id = deps.request_id
            run.trace.metadata = deps.metadata
            
            result = await orchestrator.run(
                """Please help me with a quick research task:
                1. Research what 'async/await' means in Python
                2. Provide a brief summary
                
                Use your research agent for this.""",
                deps=deps,
            )
            
            run.set_result(result)
            trace_id = run.trace.id
            
        print(f"\nTask Result:")
        print(f"  Task: {result.output.task[:100]}...")
        print(f"  Status: {result.output.status.value}")
        print(f"  Final Answer: {result.output.final_answer[:200]}...")
        print(f"  Subtasks completed: {len([s for s in result.output.subtasks if s.status.value == 'completed'])}")
        print(f"  Total tokens: {result.output.total_tokens_used}")
        print(f"  Total duration: {result.output.total_duration_ms}ms")
        
        print("\n" + "=" * 60)
        print("Trace Tree (showing nested structure):")
        print("=" * 60)
        print_trace(trace_id, str(db_path))
        
        print("\n" + "=" * 60)
        print("Verifying Nested Span Structure:")
        print("=" * 60)
        trace_data = viewer.get_trace(trace_id)
        if trace_data:
            spans = trace_data.get("spans", [])
            print(f"Total spans: {len(spans)}")
            
            delegation_spans = [s for s in spans if s.get("span_type") == "agent.delegation"]
            print(f"Delegation spans: {len(delegation_spans)}")
            
            agent_run_spans = [s for s in spans if s.get("span_type") == "agent.run"]
            print(f"Agent run spans: {len(agent_run_spans)}")
            
            for d in delegation_spans:
                print(f"\n  Delegation: {d.get('name')}")
                print(f"    Target: {d.get('attributes', {}).get('delegation.target_agent')}")
                print(f"    Parent ID: {d.get('parent_id')}")
                print(f"    Children: {len([s for s in spans if s.get('parent_id') == d.get('id')])}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
