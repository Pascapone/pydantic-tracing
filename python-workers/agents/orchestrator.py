"""
Orchestrator agent that coordinates sub-agents for complex tasks.
"""
import time
from typing import Any
from pydantic_ai import Agent, RunContext, ModelRetry
from .schemas import (
    AgentDeps, TaskResult, SubTaskResult, TaskStatus, AgentType,
    ResearchReport, CodeResult, AnalysisResult,
)
from .research import create_research_agent
from .coding import create_coding_agent
from .analysis import create_analysis_agent
from tracing import get_tracer, traced_delegation, traced_agent_run
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


def create_orchestrator(model: str = "openrouter:minimax/minimax-m2.5") -> OrchestratorAgent:
    agent: OrchestratorAgent = Agent(
        model,
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
                    result = await research_agent.run(
                        query,
                        deps=ctx.deps,
                        usage=ctx.usage,
                    )
                    duration_ms = int((time.time() - start) * 1000)
                    
                    report = result.output
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute("result.summary", report.summary[:200] if report.summary else "")
                    delegation_span.set_attribute("result.confidence", report.confidence)
                    run.set_result(result)
                    
                    return str({
                        "status": "completed",
                        "agent_type": "research",
                        "duration_ms": duration_ms,
                        "summary": report.summary,
                        "findings": report.key_findings,
                        "sources_count": len(report.sources),
                        "confidence": report.confidence,
                    })
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    return str({
                        "status": "failed",
                        "agent_type": "research",
                        "duration_ms": duration_ms,
                        "error": str(e),
                    })
    
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
                    result = await coding_agent.run(
                        f"Language: {language}\nTask: {task}",
                        deps=ctx.deps,
                        usage=ctx.usage,
                    )
                    duration_ms = int((time.time() - start) * 1000)
                    
                    code_result = result.output
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute("result.files_count", len(code_result.files))
                    delegation_span.set_attribute("result.executed", code_result.execution is not None)
                    run.set_result(result)
                    
                    return str({
                        "status": "completed",
                        "agent_type": "coding",
                        "duration_ms": duration_ms,
                        "files_count": len(code_result.files),
                        "explanation": code_result.explanation,
                        "suggestions": code_result.suggestions,
                        "executed": code_result.execution is not None,
                    })
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    return str({
                        "status": "failed",
                        "agent_type": "coding",
                        "duration_ms": duration_ms,
                        "error": str(e),
                    })
    
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
                    result = await analysis_agent.run(
                        f"Analysis type: {analysis_type}\nData: {data_description}",
                        deps=ctx.deps,
                        usage=ctx.usage,
                    )
                    duration_ms = int((time.time() - start) * 1000)
                    
                    analysis_result = result.output
                    delegation_span.set_attribute("result.status", "completed")
                    delegation_span.set_attribute("result.data_type", analysis_result.data_type)
                    delegation_span.set_attribute("result.row_count", analysis_result.row_count)
                    run.set_result(result)
                    
                    return str({
                        "status": "completed",
                        "agent_type": "analysis",
                        "duration_ms": duration_ms,
                        "data_type": analysis_result.data_type,
                        "row_count": analysis_result.row_count,
                        "insights": analysis_result.insights,
                        "anomalies_count": len(analysis_result.anomalies),
                    })
                except Exception as e:
                    duration_ms = int((time.time() - start) * 1000)
                    delegation_span.set_attribute("result.status", "failed")
                    delegation_span.set_attribute("result.error", str(e))
                    return str({
                        "status": "failed",
                        "agent_type": "analysis",
                        "duration_ms": duration_ms,
                        "error": str(e),
                    })
    
    return agent
