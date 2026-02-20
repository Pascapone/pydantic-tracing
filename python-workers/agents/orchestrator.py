"""
Orchestrator agent that coordinates sub-agents for complex tasks.
"""

import asyncio
import time
from typing import Any
from pydantic_ai import Agent, RunContext, ModelRetry
from .schemas import (
    AgentDeps,
    TaskResult,
    SubTaskResult,
    TaskStatus,
    AgentType,
    ResearchReport,
    CodeResult,
    AnalysisResult,
)
from .research import create_research_agent
from .coding import create_coding_agent
from .analysis import create_analysis_agent
from tracing import get_tracer, traced_delegation, traced_agent_run, TracedModel
from tracing.spans import SpanKind, SpanType


OrchestratorAgent = Agent[AgentDeps, TaskResult]

_sub_agents: dict[str, Any] = {}


def _get_or_create_agent(agent_type: str, model: str) -> Any:
    if agent_type not in _sub_agents:
        if agent_type == "research":
            _sub_agents[agent_type] = create_research_agent(model)
        elif agent_type == "coding":
            _sub_agents[agent_type] = create_coding_agent(model)
        elif agent_type == "analysis":
            _sub_agents[agent_type] = create_analysis_agent(model)
    return _sub_agents[agent_type]


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
        # Preferred path: emit delegated events in real time so nested spans stream live.
        if hasattr(sub_agent, "run_stream_events"):
            used_stream_events = True
            stream_result = None
            async for event in sub_agent.run_stream_events(
                prompt,
                deps=ctx.deps,
                usage=ctx.usage,
            ):
                run.handle_stream_event(event)
                event_kind = str(getattr(event, "event_kind", ""))
                event_type = type(event).__name__
                if event_kind == "agent_run_result" or event_type == "AgentRunResultEvent":
                    stream_result = getattr(event, "result", None)

            if stream_result is not None:
                run.set_result(stream_result)
                return stream_result

        # Compatibility fallback for providers/versions that don't emit final stream result events.
        async with sub_agent.iter(
            prompt,
            deps=ctx.deps,
            usage=ctx.usage,
        ) as active_run:
            agent_run = active_run
            async for _ in active_run:
                pass

            result = active_run.result
            if result is None:
                raise RuntimeError("Delegated agent run completed without a final result")

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


def create_orchestrator(model: str = "openrouter:minimax/minimax-m2.5") -> OrchestratorAgent:
    agent: OrchestratorAgent = Agent(
        TracedModel(model),
        output_type=TaskResult,
        deps_type=AgentDeps,
        instructions="""You are an orchestrator agent that coordinates specialized sub-agents.

Available sub-agents:
1. research_agent - Gathers information from the web, summarizes content
2. coding_agent - Generates, executes, and analyzes code
3. analysis_agent - Analyzes data, calculates statistics, creates visualizations

Your workflow:
1. Analyze the incoming task
2. Determine which sub-agents are needed
3. Delegate tasks to appropriate agents in the right order
4. Aggregate results and provide a final answer
5. Track token usage and timing

Guidelines:
- Use the right agent for each subtask
- Pass context between agents when needed
- Handle errors gracefully
- Provide clear final answers synthesizing all sub-agent outputs""",
    )

    @agent.tool
    async def delegate_research(
        ctx: RunContext[AgentDeps],
        query: str,
    ) -> str:
        """
        Delegate a research task to the research agent.

        Args:
            query: The research query or topic to investigate

        Returns:
            JSON string with research results
        """
        start = time.time()
        research_agent = _get_or_create_agent("research", agent.model if agent.model else model)
        tracer = get_tracer()
        model_str = str(agent.model) if agent.model else model

        with traced_delegation("research", query, tracer=tracer) as delegation_span:
            with traced_agent_run("research", model_str, tracer=tracer) as run:
                try:
                    result = await _run_delegated_agent_with_trace(
                        sub_agent=research_agent,
                        prompt=query,
                        ctx=ctx,
                        run=run,
                    )
                    duration_ms = int((time.time() - start) * 1000)

                    report = result.output
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute(
                        "result.summary", report.summary[:200] if report.summary else ""
                    )
                    delegation_span.set_attribute("result.confidence", report.confidence)

                    return str(
                        {
                            "status": "completed",
                            "agent_type": "research",
                            "duration_ms": duration_ms,
                            "summary": report.summary,
                            "findings": report.key_findings,
                            "sources_count": len(report.sources),
                            "confidence": report.confidence,
                        }
                    )
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    return str(
                        {
                            "status": "failed",
                            "agent_type": "research",
                            "duration_ms": duration_ms,
                            "error": str(e),
                        }
                    )

    @agent.tool
    async def delegate_coding(
        ctx: RunContext[AgentDeps],
        task: str,
        language: str = "python",
    ) -> str:
        """
        Delegate a coding task to the coding agent.

        Args:
            task: Description of the coding task
            language: Programming language to use

        Returns:
            JSON string with code results
        """
        start = time.time()
        coding_agent = _get_or_create_agent("coding", agent.model if agent.model else model)
        tracer = get_tracer()
        model_str = str(agent.model) if agent.model else model

        with traced_delegation("coding", task, tracer=tracer) as delegation_span:
            delegation_span.set_attribute("coding.language", language)
            with traced_agent_run("coding", model_str, tracer=tracer) as run:
                try:
                    result = await _run_delegated_agent_with_trace(
                        sub_agent=coding_agent,
                        prompt=f"Language: {language}\nTask: {task}",
                        ctx=ctx,
                        run=run,
                    )
                    duration_ms = int((time.time() - start) * 1000)

                    code_result = result.output
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute("result.files_count", len(code_result.files))
                    delegation_span.set_attribute(
                        "result.executed", code_result.execution is not None
                    )

                    return str(
                        {
                            "status": "completed",
                            "agent_type": "coding",
                            "duration_ms": duration_ms,
                            "files_count": len(code_result.files),
                            "explanation": code_result.explanation,
                            "suggestions": code_result.suggestions,
                            "executed": code_result.execution is not None,
                        }
                    )
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    return str(
                        {
                            "status": "failed",
                            "agent_type": "coding",
                            "duration_ms": duration_ms,
                            "error": str(e),
                        }
                    )

    @agent.tool
    async def delegate_analysis(
        ctx: RunContext[AgentDeps],
        data_description: str,
        analysis_type: str = "summary",
    ) -> str:
        """
        Delegate a data analysis task to the analysis agent.

        Args:
            data_description: Description of the data or the data itself
            analysis_type: Type of analysis (summary, statistics, visualization)

        Returns:
            JSON string with analysis results
        """
        start = time.time()
        analysis_agent = _get_or_create_agent("analysis", agent.model if agent.model else model)
        tracer = get_tracer()
        model_str = str(agent.model) if agent.model else model

        with traced_delegation("analysis", data_description, tracer=tracer) as delegation_span:
            delegation_span.set_attribute("analysis.type", analysis_type)
            with traced_agent_run("analysis", model_str, tracer=tracer) as run:
                try:
                    result = await _run_delegated_agent_with_trace(
                        sub_agent=analysis_agent,
                        prompt=f"Analysis type: {analysis_type}\nData: {data_description}",
                        ctx=ctx,
                        run=run,
                    )
                    duration_ms = int((time.time() - start) * 1000)

                    analysis_result = result.output
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute("result.data_type", analysis_result.data_type)
                    delegation_span.set_attribute("result.row_count", analysis_result.row_count)

                    return str(
                        {
                            "status": "completed",
                            "agent_type": "analysis",
                            "duration_ms": duration_ms,
                            "data_type": analysis_result.data_type,
                            "row_count": analysis_result.row_count,
                            "insights": analysis_result.insights,
                            "anomalies_count": len(analysis_result.anomalies),
                        }
                    )
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    return str(
                        {
                            "status": "failed",
                            "agent_type": "analysis",
                            "duration_ms": duration_ms,
                            "error": str(e),
                        }
                    )

    return agent
