# Multi-Agent Patterns

Patterns for building systems with multiple agents.

## Agent Delegation

One agent calls another as a tool. Control returns to parent after delegate completes.

```python
from pydantic_ai import Agent, RunContext

# Specialist agent
researcher = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    output_type=list[str],
    instructions="Research topics thoroughly. Return key findings as a list."
)

# Coordinator agent
writer = Agent(
    'openrouter:openai/gpt-4o',
    instructions="Write articles based on research. Use the research tool."
)

@writer.tool
async def research(ctx: RunContext, topic: str) -> list[str]:
    """Research a topic using the research specialist."""
    result = await researcher.run(
        f"Research: {topic}",
        usage=ctx.usage  # Track usage in parent
    )
    return result.output

result = writer.run_sync("Write about quantum computing")
```

### Delegation with Dependencies

Share dependencies between agents:

```python
from dataclasses import dataclass

@dataclass
class SharedDeps:
    db: Database
    user_id: str

researcher = Agent('openrouter:anthropic/claude-3.5-sonnet', deps_type=SharedDeps)
writer = Agent('openrouter:openai/gpt-4o', deps_type=SharedDeps)

@writer.tool
async def research(ctx: RunContext[SharedDeps], topic: str) -> list[str]:
    result = await researcher.run(topic, deps=ctx.deps, usage=ctx.usage)
    return result.output
```

## Programmatic Hand-off

Application code orchestrates agent transitions.

```python
from pydantic import BaseModel
from typing import Literal

class Intent(BaseModel):
    type: Literal["question", "task", "chat"]
    confidence: float

# Intent classifier
classifier = Agent(
    'openrouter:openai/gpt-4o-mini',
    output_type=Intent,
    instructions="Classify user intent."
)

# Specialists
qa_agent = Agent('openrouter:anthropic/claude-3.5-sonnet', instructions="Answer questions.")
task_agent = Agent('openrouter:anthropic/claude-3.5-sonnet', instructions="Execute tasks.")
chat_agent = Agent('openrouter:openai/gpt-4o', instructions="Casual conversation.")

async def route_query(query: str):
    # Step 1: Classify
    intent = await classifier.run(query)
    
    # Step 2: Route to specialist
    if intent.output.type == "question":
        return await qa_agent.run(query)
    elif intent.output.type == "task":
        return await task_agent.run(query)
    else:
        return await chat_agent.run(query)
```

### Hand-off with History

Pass conversation context between agents:

```python
async def handoff_with_context(query: str, history: list = None):
    # First agent processes
    result1 = await agent1.run(query, message_history=history)
    
    # Second agent continues
    result2 = await agent2.run(
        "Continue from where we left off",
        message_history=result1.all_messages()
    )
    
    return result2
```

## Usage Tracking Across Agents

Track tokens and costs across delegations:

```python
from pydantic_ai import RunUsage, UsageLimits

async def track_usage():
    usage = RunUsage()
    limits = UsageLimits(total_tokens_limit=50000)
    
    # All agents share usage tracking
    result1 = await agent1.run("task 1", usage=usage, usage_limits=limits)
    result2 = await agent2.run("task 2", usage=usage, usage_limits=limits)
    
    print(f"Total tokens: {usage.total_tokens}")
```

## Output Function Hand-off

Complete hand-off using output functions (no return to parent):

```python
from pydantic_ai import RunContext

async def handoff_to_specialist(ctx: RunContext, request: str) -> str:
    """Hand off to specialist agent."""
    result = await specialist.run(request, message_history=ctx.messages[:-1])
    return result.output

router = Agent(
    'openrouter:openai/gpt-4o',
    output_type=handoff_to_specialist,
    instructions="Route requests to the specialist."
)
```

## Pydantic Graphs

For complex state machines with multiple agents:

```python
from pydantic_graph import BaseNode, End, Graph
from pydantic_ai import Agent

class State:
    messages: list = []
    current_step: str = "start"

class ProcessNode(BaseNode[State]):
    async def run(self, ctx) -> BaseNode | End:
        result = await agent.run("process", message_history=ctx.state.messages)
        ctx.state.messages = result.all_messages()
        
        if result.output.complete:
            return End(result.output)
        return NextStepNode()

class NextStepNode(BaseNode[State]):
    async def run(self, ctx) -> BaseNode | End:
        result = await agent.run("next step", message_history=ctx.state.messages)
        ctx.state.messages = result.all_messages()
        return ProcessNode()

workflow = Graph(nodes=[ProcessNode, NextStepNode])
result = await workflow.run(State())
```

## Parallel Agent Execution

Run multiple agents concurrently:

```python
import asyncio

async def parallel_analysis(text: str):
    tasks = [
        sentiment_agent.run(text),
        entity_agent.run(text),
        summary_agent.run(text),
    ]
    
    results = await asyncio.gather(*tasks)
    
    return {
        "sentiment": results[0].output,
        "entities": results[1].output,
        "summary": results[2].output,
    }
```

## Agent Pool Pattern

Specialized agents for different domains:

```python
class AgentPool:
    def __init__(self):
        self.agents = {
            "sql": Agent('openrouter:anthropic/claude-3.5-sonnet', instructions="SQL expert."),
            "python": Agent('openrouter:anthropic/claude-3.5-sonnet', instructions="Python expert."),
            "docs": Agent('openrouter:openai/gpt-4o', instructions="Documentation writer."),
        }
    
    async def route(self, query: str, domain: str):
        agent = self.agents.get(domain, self.agents["docs"])
        return await agent.run(query)
```

## Debugging Multi-Agent Systems

Use Logfire for tracing:

```python
import logfire

logfire.configure()
logfire.instrument_pydantic_ai()

# All agent calls are traced
result = await coordinator.run("complex task")
# View traces at logfire.pydantic.dev
```

Key debugging insights:
- Which agent handled which request
- Delegation chains and decision points
- Token usage per agent
- Tool call sequences
- Error propagation across agents
