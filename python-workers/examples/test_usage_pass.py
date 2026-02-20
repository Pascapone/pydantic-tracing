"""Script to check if ctx.usage has a lock"""
import asyncio
from pydantic_ai import Agent, RunContext
import copy
from pydantic_ai.models.test import TestModel

import traceback

agent1 = Agent(TestModel())
agent2 = Agent(TestModel())

@agent1.tool
async def my_tool(ctx: RunContext[str], _: str) -> str:
    print("Agent1 tool called. Trying to deepcopy usage...")
    try:
        copy.deepcopy(ctx.usage)
        print("Agent1 usage deepcopy OK")
    except Exception as e:
        print(f"Agent1 usage deepcopy failed: {e}")
        traceback.print_exc()
        
    # Start agent2 with agent1's usage
    print("Now passing usage to agent2...")
    try:
        await agent2.run("test", usage=ctx.usage)
        print("Agent2 run OK")
    except Exception as e:
        print(f"Agent2 run failed: {e}")
        traceback.print_exc()
    
    return "done"

async def main():
    await agent1.run("run agent2")

asyncio.run(main())
