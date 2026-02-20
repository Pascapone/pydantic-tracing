"""
Test 3-level deep nested traces with multi-agent delegation.
Demonstrates: Orchestrator -> Research -> Search tracing structure.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_orchestrator, AgentDeps
from tracing import get_tracer, print_trace, TraceViewer


async def main():
    print("=" * 60)
    print("Example 8: Deep Nested Traces (Orchestrator -> Research -> Search)")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    viewer = TraceViewer(db_path=str(db_path))
    
    orchestrator = create_orchestrator()
    deps = AgentDeps(
        user_id="user_008",
        session_id="session_008",
        request_id="req_008",
        metadata={"example": "deep_nested_traces"},
    )
    
    print("Running orchestrator with deep nested delegation tracing...\n")
    
    try:
        from tracing import traced_agent
        
        with traced_agent(
            agent_name="orchestrator_deep_nested",
            model="openrouter:minimax/minimax-m2.5",
            user_id=deps.user_id,
            session_id=deps.session_id,
            tracer=tracer
        ) as run:
            run.trace.request_id = deps.request_id
            run.trace.metadata = deps.metadata
            
            result = await orchestrator.run(
                """I need you to find information about the latest version of Pydantic AI.

IMPORTANT INSTRUCTION SET:
1. You (OrchestratorAgent) MUST NOT try to answer this yourself.
2. You MUST use the `delegate_research` tool.
3. CRITICAL: When you call `delegate_research`, you MUST pass the following exact string as the `query` argument so the research agent knows what to do:
   "Find information about the latest version of Pydantic AI. YOU MUST use the `delegate_search` tool to search the web for this information. Do not answer from your own knowledge."
4. If you use the coding agent or answer from internal knowledge, you fail.""",
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
        print("Trace Tree (showing 3-level nested structure):")
        print("=" * 60)
        print_trace(trace_id, str(db_path))
        
        print("\n" + "=" * 60)
        print("Verifying Deep Nested Span Structure:")
        print("=" * 60)
        trace_data = viewer.get_trace(trace_id)
        if trace_data:
            spans = trace_data.get("spans", [])
            print(f"Total spans: {len(spans)}")
            
            delegation_spans = [s for s in spans if s.get("span_type") == "agent.delegation"]
            print(f"Delegation spans: {len(delegation_spans)}")
            
            agent_run_spans = [s for s in spans if s.get("span_type") == "agent.run"]
            print(f"Agent run spans: {len(agent_run_spans)}")
            
            # Print the nesting hierarchy specifically
            for d in delegation_spans:
                print(f"\n  Delegation: {d.get('name')}")
                target = d.get('attributes', {}).get('delegation.target_agent')
                print(f"    Target: {target}")
                
            print("\nIf you see BOTH 'research' and 'search' as targets, the deep nesting succeeded.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
