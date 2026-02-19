"""
Tracing system for pydantic-ai agents.
"""

from .spans import (
    Span,
    Trace,
    SpanKind,
    SpanStatus,
    SpanType,
    AgentRunSpan,
    ToolCallSpan,
    ModelRequestSpan,
    ModelResponseSpan,
)
from .collector import TraceCollector, get_collector
from .processor import (
    PydanticAITracer,
    TracingContext,
    traced_agent,
    traced_tool,
    traced_delegation,
    traced_agent_run,
    get_tracer,
    set_tracer,
)
from .viewer import TraceViewer, print_trace, export_traces
from .wrappers import TracedModel, TracedStreamedResponse, wrap_model

__all__ = [
    "Span",
    "Trace",
    "SpanKind",
    "SpanStatus",
    "SpanType",
    "AgentRunSpan",
    "ToolCallSpan",
    "ModelRequestSpan",
    "ModelResponseSpan",
    "TraceCollector",
    "get_collector",
    "PydanticAITracer",
    "TracingContext",
    "traced_agent",
    "traced_tool",
    "traced_delegation",
    "traced_agent_run",
    "get_tracer",
    "set_tracer",
    "TraceViewer",
    "print_trace",
    "export_traces",
    "TracedModel",
    "TracedStreamedResponse",
    "wrap_model",
]
