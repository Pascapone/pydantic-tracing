"""
Debug script to analyze pydantic-ai streaming API.
Run: python examples/debug_streaming3.py
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic_ai import Agent


async def main():
    print("=" * 60)
    print("Debug: Pydantic-AI Streaming API Analysis (Text Mode)")
    print("=" * 60)
    
    # Create a simple agent WITHOUT structured output
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        instructions="Answer questions concisely.",
    )
    
    print("\nRunning agent with text streaming...")
    
    try:
        async with agent.run_stream("What is 2+2?") as run_result:
            print("\n--- Streaming text ---")
            full_text = ""
            async for text in run_result.stream_text():
                full_text = text  # Each iteration gives full text so far
                if len(text) < 50:
                    print(f"  Text chunk: '{text}'")
                else:
                    print(f"  Text chunk: '{text[:50]}...'")
            
            print(f"\n--- Final text ---")
            print(f"  {full_text}")
            
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
                        if hasattr(part, 'content') and len(str(part.content)) < 100:
                            print(f"      content: {part.content}")
                        elif hasattr(part, 'content'):
                            print(f"      content: {str(part.content)[:100]}...")
                        if hasattr(part, 'tool_name'):
                            print(f"      tool_name: {part.tool_name}")
                        if hasattr(part, 'args'):
                            print(f"      args: {part.args}")
            
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
