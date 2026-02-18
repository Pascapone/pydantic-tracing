"""
Debug script to analyze pydantic-ai streaming events.
Run: python examples/debug_streaming.py
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
    print("Debug: Pydantic-AI Streaming Events Analysis")
    print("=" * 60)
    
    # Create a simple agent with tools
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        output_type=Output,
        instructions="Answer questions concisely.",
    )
    
    print("\nRunning agent with streaming...")
    
    event_types = set()
    tool_calls = []
    tool_results = []
    reasoning_parts = []
    
    try:
        async with agent.run_stream("What is 2+2?") as run_result:
            async for event in run_result.stream_events():
                event_type = type(event).__name__
                event_types.add(event_type)
                
                print(f"\n--- Event: {event_type} ---")
                print(f"  Attributes: {[x for x in dir(event) if not x.startswith('_')]}")
                
                if event_type == "FunctionToolCallEvent":
                    tool_name = getattr(event, 'tool_name', 'unknown')
                    tool_args = getattr(event, 'args', {})
                    print(f"  tool_name: {tool_name}")
                    print(f"  args type: {type(tool_args).__name__}")
                    print(f"  args: {tool_args}")
                    tool_calls.append({"name": tool_name, "args": tool_args})
                
                elif event_type == "FunctionToolResultEvent":
                    tool_name = getattr(event, 'tool_name', 'unknown')
                    tool_result = getattr(event, 'result', None)
                    print(f"  tool_name: {tool_name}")
                    print(f"  result: {str(tool_result)[:100]}...")
                    tool_results.append({"name": tool_name, "result": tool_result})
                
                elif event_type == "PartStartEvent":
                    part_type = getattr(event, 'part_type', '')
                    print(f"  part_type: {part_type}")
                    if part_type == 'thinking':
                        print("  (Model is reasoning)")
                        reasoning_parts.append("start")
                
                elif event_type == "PartDeltaEvent":
                    part_type = getattr(event, 'part_type', '')
                    content = getattr(event, 'content', '')
                    print(f"  part_type: {part_type}")
                    if content and len(str(content)) < 100:
                        print(f"  content: {content}")
                    elif content:
                        print(f"  content: {str(content)[:100]}...")
                
                elif event_type == "FinalResultEvent":
                    if hasattr(event, 'usage') and event.usage:
                        usage = event.usage
                        print(f"  usage: input={getattr(usage, 'input_tokens', 0)}, output={getattr(usage, 'output_tokens', 0)}")
            
            # Get final output
            output = await run_result.get_output()
            print(f"\n--- Final Output ---")
            print(f"Output: {output}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Event types seen: {event_types}")
    print(f"Tool calls: {len(tool_calls)}")
    print(f"Tool results: {len(tool_results)}")
    print(f"Reasoning parts: {len(reasoning_parts)}")


if __name__ == "__main__":
    asyncio.run(main())
