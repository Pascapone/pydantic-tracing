"""
Conversation history example: Multi-turn with message history.
Demonstrates: message history, conversation spans, context tracking.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents import create_research_agent, AgentDeps
from tracing import get_tracer, SpanKind, SpanType, print_trace


async def main():
    print("=" * 60)
    print("Example 6: Multi-Turn Conversation with History")
    print("=" * 60)
    
    db_path = Path(__file__).parent.parent / "traces.db"
    tracer = get_tracer(str(db_path))
    
    agent = create_research_agent()
    deps = AgentDeps(
        user_id="user_006",
        session_id="session_006",
        request_id="req_006",
        metadata={"example": "conversation_history"},
    )
    
    main_trace = tracer.start_trace(
        name="multi_turn_conversation",
        user_id=deps.user_id,
        session_id=deps.session_id,
        request_id=deps.request_id,
        metadata={"example": "conversation_history", "turns": 3},
    )
    
    print(f"\nMain Trace ID: {main_trace.id}")
    print("=" * 60)
    
    conversation = [
        "What is pydantic-ai?",
        "Tell me more about its agent features",
        "How does tool calling work in it?",
    ]
    
    history = None
    turn_spans = []
    
    for i, question in enumerate(conversation, 1):
        print(f"\nTurn {i}: {question}")
        print("-" * 40)
        
        turn_span = tracer.start_span(
            name=f"conversation.turn_{i}",
            kind=SpanKind.internal,
            attributes={
                "turn.number": i,
                "turn.question": question,
                "turn.has_history": history is not None,
            },
        )
        
        try:
            if history:
                result = await agent.run(question, deps=deps, message_history=history)
            else:
                result = await agent.run(question, deps=deps)
            
            history = result.all_messages()
            
            turn_span.set_attribute("turn.response_length", len(result.output.summary))
            turn_span.set_attribute("turn.findings_count", len(result.output.key_findings))
            tracer.end_span(turn_span)
            turn_spans.append(turn_span)
            
            print(f"Summary: {result.output.summary[:150]}...")
            print(f"Findings: {len(result.output.key_findings)}")
            
        except Exception as e:
            tracer.end_span(turn_span)
            print(f"Error in turn {i}: {e}")
            break
    
    tracer.end_trace()
    
    print("\n" + "=" * 60)
    print("Conversation Trace Summary:")
    print("=" * 60)
    print_trace(main_trace.id, str(db_path))
    
    print("\n" + "=" * 60)
    print("Conversation Stats:")
    print("=" * 60)
    print(f"  Total turns: {len(turn_spans)}")
    print(f"  Messages in final history: {len(history) if history else 0}")
    
    total_duration = sum(s.duration_us or 0 for s in turn_spans) / 1000
    print(f"  Total conversation duration: {total_duration:.2f}ms")


if __name__ == "__main__":
    asyncio.run(main())
