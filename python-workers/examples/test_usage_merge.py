import asyncio
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.test import TestModel

agent1 = Agent(TestModel())
agent2 = Agent(TestModel())

@agent1.tool
async def my_tool(ctx: RunContext[str], _: str) -> str:
    print("Running sub-agent")
    result = await agent2.run("test")
    ctx.usage.incr(result.usage())
    return "done"

async def main():
    result = await agent1.run("run agent2")
    print(f"Parent usage: {result.usage()}")

asyncio.run(main())
