"""
Multi-agent system for pydantic-ai tracing tests.
"""

from .schemas import (
    TaskStatus,
    AgentType,
    AgentDeps,
    ResearchSource,
    ResearchReport,
    SearchReport,
    CodeFile,
    CodeExecutionResult,
    CodeResult,
    DataPoint,
    StatisticalSummary,
    AnalysisResult,
    SubTaskResult,
    TaskResult,
    SpanKind,
    SpanStatus,
)
from .orchestrator import OrchestratorAgent, create_orchestrator
from .research import ResearchAgent, create_research_agent
from .search import SearchAgent, create_search_agent
from .coding import CodingAgent, create_coding_agent
from .analysis import AnalysisAgent, create_analysis_agent
from .common import create_traced_agent, wrap_model_for_tracing

__all__ = [
    "TaskStatus",
    "AgentType",
    "AgentDeps",
    "ResearchSource",
    "ResearchReport",
    "SearchReport",
    "CodeFile",
    "CodeExecutionResult",
    "CodeResult",
    "DataPoint",
    "StatisticalSummary",
    "AnalysisResult",
    "SubTaskResult",
    "TaskResult",
    "SpanKind",
    "SpanStatus",
    "OrchestratorAgent",
    "ResearchAgent",
    "SearchAgent",
    "CodingAgent",
    "AnalysisAgent",
    "create_orchestrator",
    "create_research_agent",
    "create_search_agent",
    "create_coding_agent",
    "create_analysis_agent",
    "create_traced_agent",
    "wrap_model_for_tracing",
]
