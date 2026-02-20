import asyncio
import copy
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.test import TestModel
from agents.schemas import AgentDeps

agent = Agent(TestModel())

@agent.tool
async def my_tool(ctx: RunContext[AgentDeps], _: str) -> str:
    print("Trying to deepcopy deps...")
    try:
        copy.deepcopy(ctx.deps)
        print("deps OK")
    except Exception as e:
        print(f"deps failed: {e}")

    return "done"

async def main():
    deps = AgentDeps(
        user_id="user_008",
        session_id="session_008",
        request_id="req_008",
        metadata={"example": "deep_nested_traces"},
    )
    await agent.run("hello", deps=deps)

asyncio.run(main())
