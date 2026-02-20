import asyncio
from pydantic_ai import Agent, RunContext
from pydantic_ai.usage import RunUsage

agent = Agent('test')

@agent.tool
async def my_tool(ctx: RunContext[str], _: str) -> str:
    usage2 = RunUsage(input_tokens=10, output_tokens=5, requests=1)
    try:
        ctx.usage.incr(usage2)
        print("incr(RunUsage) works")
    except Exception as e:
        print(f"incr failed: {e}")
        ctx.usage.input_tokens += usage2.input_tokens
        ctx.usage.output_tokens += usage2.output_tokens
        ctx.usage.requests += usage2.requests
        print("+= works")
    return "done"

async def main():
    await agent.run("call my_tool")

asyncio.run(main())
