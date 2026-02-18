"""
Debug script to analyze pydantic-ai streaming API.
Run: python examples/debug_streaming2.py
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai import Agent
from pydantic import BaseModel


class Output(BaseModel):
    answer: str
    confidence: float


async def main():
    print("=" * 60)
    print("Debug: Pydantic-AI Streaming API Analysis")
    print("=" * 60)
    
    # Create a simple agent with tools
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        output_type=Output,
        instructions="Answer questions concisely.",
    )
    
    print("\nRunning agent with streaming...")
    
    try:
        async with agent.run_stream("What is 2+2?") as run_result:
            print("\n--- Available methods on StreamedRunResult ---")
            methods = [x for x in dir(run_result) if not x.startswith('_')]
            for m in methods:
                print(f"  - {m}")
            
            print("\n--- Streaming text ---")
            async for text in run_result.stream_text():
                print(f"  Text: {text[:50]}...")
            
            # After streaming, get messages
            print("\n--- All messages after streaming ---")
            messages = run_result.all_messages()
            print(f"Message count: {len(messages)}")
            for i, msg in enumerate(messages):
                print(f"\n  Message {i}: {type(msg).__name__}")
                if hasattr(msg, 'parts'):
                    for j, part in enumerate(msg.parts):
                        print(f"    Part {j}: {type(part).__name__}")
                        if hasattr(part, 'part_kind'):
                            print(f"      part_kind: {part.part_kind}")
                        if hasattr(part, 'tool_name'):
                            print(f"      tool_name: {part.tool_name}")
            
            # Get output
            output = await run_result.get_output()
            print(f"\n--- Final Output ---")
            print(f"Output: {output}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n" + "=" * 60)
    print("Complete")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
