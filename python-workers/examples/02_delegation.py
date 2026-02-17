"""
Multi-agent delegation example: Orchestrator delegates to sub-agents.
Demonstrates: agent delegation, multiple tool calls, nested spans.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_orchestrator, AgentDeps
from tracing import get_tracer, get_collector, print_trace


async def main():
    print("=" * 60)
    print("Example 2: Multi-Agent Delegation (Orchestrator)")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    orchestrator = create_orchestrator()
    deps = AgentDeps(
        user_id="user_002",
        session_id="session_002",
        request_id="req_002",
        metadata={"example": "multi_agent_delegation"},
    )
    
    trace = tracer.start_trace(
        name="orchestrator_example",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
        metadata=deps.metadata,
    )
    
    print(f"\nTrace ID: {trace.id}")
    print("Running orchestrator with sub-agent delegation...\n")
    
    try:
        result = await orchestrator.run(
            """I need you to help me with a coding task:
            1. First, research best practices for Python async programming
            2. Then, write a simple async function that demonstrates those practices
            3. Finally, analyze the code structure and provide feedback
            
            Please coordinate this across your sub-agents.""",
            deps=deps,
        )
        
        tracer.end_trace()
        
        print(f"\nTask Result:")
        print(f"  Task: {result.output.task[:100]}...")
        print(f"  Status: {result.output.status.value}")
        print(f"  Final Answer: {result.output.final_answer[:200]}...")
        print(f"  Subtasks completed: {len([s for s in result.output.subtasks if s.status.value == 'completed'])}")
        print(f"  Total tokens: {result.output.total_tokens_used}")
        print(f"  Total duration: {result.output.total_duration_ms}ms")
        
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
