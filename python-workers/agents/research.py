"""
Research agent for web search and information gathering.
"""

from pydantic_ai import Agent, RunContext
from .schemas import AgentDeps, ResearchReport, ResearchSource
from .tools.web import summarize_text
from tracing import TracedModel, get_tracer, traced_delegation, traced_agent_run
from .search import create_search_agent
import time
import asyncio
from typing import Any


ResearchAgent = Agent[AgentDeps, ResearchReport]


async def _run_delegated_agent_with_trace(
    *,
    sub_agent: Any,
    prompt: str,
    ctx: RunContext[AgentDeps],
    run: Any,
) -> Any:
    """
    Execute a delegated sub-agent while preserving partial history on cancellation/errors.
    """
    agent_run = None
    used_stream_events = False

    try:
        if hasattr(sub_agent, "run_stream_events"):
            used_stream_events = True
            stream_result = None
            async for event in sub_agent.run_stream_events(
                prompt,
                deps=ctx.deps,
            ):
                run.handle_stream_event(event)
                event_kind = str(getattr(event, "event_kind", ""))
                event_type = type(event).__name__
                if event_kind == "agent_run_result" or event_type == "AgentRunResultEvent":
                    stream_result = getattr(event, "result", None)

            if stream_result is not None:
                if hasattr(stream_result, "usage"):
                    ctx.usage.incr(stream_result.usage())
                run.set_result(stream_result)
                return stream_result

        async with sub_agent.iter(
            prompt,
            deps=ctx.deps,
        ) as active_run:
            agent_run = active_run
            async for _ in active_run:
                pass

            result = active_run.result
            if result is None:
                raise RuntimeError("Delegated agent run completed without a final result")

            if hasattr(result, "usage"):
                ctx.usage.incr(result.usage())

            run.set_result(result)
            return result
    except asyncio.CancelledError as cancel_error:
        if agent_run is not None:
            run.set_partial_messages(agent_run.all_messages(), error=cancel_error)
        elif used_stream_events:
            run.set_partial_messages([], error=cancel_error)
        else:
            run.set_error(cancel_error)
        raise
    except Exception as run_error:
        if agent_run is not None:
            run.set_partial_messages(agent_run.all_messages(), error=run_error)
        elif used_stream_events:
            run.set_partial_messages([], error=run_error)
        else:
            run.set_error(run_error)
        raise


def create_research_agent(model: str = "openrouter:minimax/minimax-m2.5") -> ResearchAgent:
    agent: ResearchAgent = Agent(
        TracedModel(model),
        output_type=ResearchReport,
        deps_type=AgentDeps,
        instructions="""You are a research agent that gathers and synthesizes information.

Your responsibilities:
1. Delegate web searches and content retrieval to the search agent using delegate_search
2. Summarize long texts using summarize_text if needed
3. Compile findings into a structured ResearchReport

Always:
- Verify information from multiple sources when possible
- Include source URLs in your report
- Rate your confidence based on source quality and quantity
- Extract key findings as bullet points""",
    )

    @agent.tool
    async def delegate_search(ctx: RunContext[AgentDeps], query: str) -> str:
        """Delegate a web search to the search agent. Returns JSON with results."""
        start = time.time()
        
        # Use the model string passed to create_research_agent
        model_str = model
        search_agent = create_search_agent(model_str)
        tracer = get_tracer()

        with traced_delegation("search", query, tracer=tracer) as delegation_span:
            with traced_agent_run("search", model_str, tracer=tracer) as run:
                try:
                    result = await _run_delegated_agent_with_trace(
                        sub_agent=search_agent,
                        prompt=query,
                        ctx=ctx,
                        run=run,
                    )
                    
                    duration_ms = int((time.time() - start) * 1000)
                    search_report = result.output
                    
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute("result.sources_count", len(search_report.sources))

                    return str({
                        "status": "completed",
                        "duration_ms": duration_ms,
                        "findings": search_report.findings,
                        "sources_count": len(search_report.sources),
                    })
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    run.set_error(e)
                    return str({
                        "status": "failed",
                        "duration_ms": duration_ms,
                        "error": str(e),
                    })

    @agent.tool
    async def create_summary(ctx: RunContext[AgentDeps], text: str, max_length: int = 200) -> str:
        """Summarize a block of text to make it more manageable."""
        return await summarize_text(text, max_length)

    return agent
