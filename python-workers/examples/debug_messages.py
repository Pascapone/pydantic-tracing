"""
Debug script to analyze pydantic-ai message structure.
Run: python examples/debug_messages.py
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
    print("Debug: Pydantic-AI Message Structure Analysis")
    print("=" * 60)
    
    # Create a simple agent
    agent = Agent(
        "openrouter:minimax/minimax-m2.5",
        output_type=Output,
        instructions="Answer questions concisely.",
    )
    
    print("\nRunning agent...")
    
    try:
        result = await asyncio.wait_for(
            agent.run("What is 2+2?"),
            timeout=30
        )
    except Exception as e:
        print(f"Error: {e}")
        return
    
    print("\n--- Result Analysis ---")
    print(f"Result type: {type(result).__name__}")
    print(f"Result attributes: {[x for x in dir(result) if not x.startswith('_')]}")
    
    # Check for all_messages
    print(f"\nHas all_messages: {hasattr(result, 'all_messages')}")
    
    if hasattr(result, 'all_messages'):
        messages = result.all_messages()
        print(f"Messages count: {len(messages)}")
        
        for i, msg in enumerate(messages):
            print(f"\n{'='*40}")
            print(f"Message {i}")
            print(f"{'='*40}")
            print(f"Type: {type(msg).__name__}")
            print(f"Attributes: {[x for x in dir(msg) if not x.startswith('_')]}")
            
            # Check for parts
            if hasattr(msg, 'parts'):
                print(f"\nParts count: {len(msg.parts)}")
                for j, part in enumerate(msg.parts):
                    print(f"\n  Part {j}:")
                    print(f"    Type: {type(part).__name__}")
                    attrs = [x for x in dir(part) if not x.startswith('_')]
                    print(f"    Attributes: {attrs}")
                    
                    # Check for part_kind
                    if hasattr(part, 'part_kind'):
                        print(f"    part_kind: {part.part_kind}")
                    
                    # Check content
                    if hasattr(part, 'content'):
                        content = str(part.content)[:100]
                        print(f"    content: {content}...")
                    
                    # Check tool_name
                    if hasattr(part, 'tool_name'):
                        print(f"    tool_name: {part.tool_name}")
                    
                    # Check args (for ToolCallPart)
                    if hasattr(part, 'args'):
                        args = part.args
                        print(f"    args type: {type(args).__name__}")
                        if hasattr(args, 'args_json'):
                            print(f"    args_json: {args.args_json[:100]}...")
                        else:
                            print(f"    args: {str(args)[:100]}...")
            
            # Check usage
            if hasattr(msg, 'usage'):
                usage = msg.usage
                print(f"\n  Usage:")
                print(f"    Type: {type(usage).__name__}")
                if usage:
                    print(f"    input_tokens: {getattr(usage, 'input_tokens', 'N/A')}")
                    print(f"    output_tokens: {getattr(usage, 'output_tokens', 'N/A')}")
            
            # Check model_name
            if hasattr(msg, 'model_name'):
                print(f"\n  model_name: {msg.model_name}")
    
    # Check usage on result
    print(f"\n--- Result Usage ---")
    if hasattr(result, 'usage'):
        try:
            usage = result.usage()
            print(f"Usage type: {type(usage).__name__}")
            print(f"  total_tokens: {getattr(usage, 'total_tokens', 'N/A')}")
            print(f"  input_tokens: {getattr(usage, 'input_tokens', 'N/A')}")
            print(f"  output_tokens: {getattr(usage, 'output_tokens', 'N/A')}")
        except Exception as e:
            print(f"Error getting usage: {e}")
    
    # Check output
    print(f"\n--- Result Output ---")
    if hasattr(result, 'output'):
        print(f"Output type: {type(result.output).__name__}")
        if hasattr(result.output, 'model_dump'):
            print(f"Output: {result.output.model_dump()}")
        else:
            print(f"Output: {result.output}")
    
    print("\n" + "=" * 60)
    print("Analysis Complete")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
