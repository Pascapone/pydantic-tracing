"""
OpenTelemetry-compatible span processor for pydantic-ai.
"""
import time
from typing import Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime

from .spans import Span, SpanKind, SpanStatus, SpanType, Trace
from .collector import TraceCollector, get_collector


@dataclass
class TracingContext:
    trace: Optional[Trace] = None
    current_span: Optional[Span] = None
    span_stack: list[Span] = field(default_factory=list)
    
    def push_span(self, span: Span) -> None:
        if self.current_span:
            span.parent_id = self.current_span.id
        self.span_stack.append(span)
        self.current_span = span
    
    def pop_span(self) -> Optional[Span]:
        if self.span_stack:
            span = self.span_stack.pop()
            self.current_span = self.span_stack[-1] if self.span_stack else None
            return span
        return None


class PydanticAITracer:
    def __init__(
        self,
        collector: Optional[TraceCollector] = None,
        db_path: str = "traces.db",
    ):
        self.collector = collector or get_collector(db_path)
        self._context = threading.local()
    
    @property
    def context(self) -> TracingContext:
        if not hasattr(self._context, "ctx") or self._context.ctx is None:
            self._context.ctx = TracingContext()
        return self._context.ctx
    
    def start_trace(
        self,
        name: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Trace:
        trace = self.collector.create_trace(
            name=name,
            user_id=user_id,
            session_id=session_id,
            request_id=request_id,
            metadata=metadata,
        )
        self.context.trace = trace
        return trace
    
    def end_trace(self, status: SpanStatus = SpanStatus.ok) -> Optional[Trace]:
        if self.context.trace:
            self.collector.complete_trace(self.context.trace)
            trace = self.context.trace
            self.context.trace = None
            self.context.span_stack.clear()
            self.context.current_span = None
            return trace
        return None
    
    def start_span(
        self,
        name: str,
        kind: SpanKind = SpanKind.internal,
        span_type: Optional[SpanType] = None,
        attributes: Optional[dict[str, Any]] = None,
    ) -> Span:
        if not self.context.trace:
            self.start_trace(f"auto_trace_{name}")
        
        span = Span(
            trace_id=self.context.trace.id,
            parent_id=self.context.current_span.id if self.context.current_span else None,
            name=name,
            kind=kind,
            span_type=span_type,
            attributes=attributes or {},
        )
        
        self.context.push_span(span)
        return span
    
    def end_span(
        self,
        span: Optional[Span] = None,
        status: SpanStatus = SpanStatus.ok,
        message: Optional[str] = None,
    ) -> Optional[Span]:
        if span:
            for i, s in enumerate(self.context.span_stack):
                if s.id == span.id:
                    self.context.span_stack.pop(i)
                    break
        else:
            span = self.context.pop_span()
        
        if span:
            span.end(status, message)
            self.collector.save_span(span)
        
        return span
    
    def add_event(self, name: str, attributes: Optional[dict[str, Any]] = None) -> None:
        if self.context.current_span:
            self.context.current_span.add_event(name, attributes)
    
    def set_attribute(self, key: str, value: Any) -> None:
        if self.context.current_span:
            self.context.current_span.set_attribute(key, value)
    
    def record_exception(self, exception: Exception) -> None:
        if self.context.current_span:
            self.context.current_span.status = SpanStatus.error
            self.context.current_span.status_message = str(exception)
            self.context.current_span.add_event("exception", {
                "type": type(exception).__name__,
                "message": str(exception),
            })
    
    def get_current_trace_id(self) -> Optional[str]:
        return self.context.trace.id if self.context.trace else None
    
    def get_current_span_id(self) -> Optional[str]:
        return self.context.current_span.id if self.context.current_span else None


import threading

_tracer: Optional[PydanticAITracer] = None
_tracer_lock = threading.Lock()


def get_tracer(db_path: str = "traces.db") -> PydanticAITracer:
    global _tracer
    with _tracer_lock:
        if _tracer is None:
            _tracer = PydanticAITracer(db_path=db_path)
        return _tracer


def set_tracer(tracer: PydanticAITracer) -> None:
    global _tracer
    with _tracer_lock:
        _tracer = tracer


class traced_agent:
    def __init__(
        self,
        agent_name: str,
        model: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        tracer: Optional[PydanticAITracer] = None,
    ):
        self.agent_name = agent_name
        self.model = model
        self.user_id = user_id
        self.session_id = session_id
        self.tracer = tracer or get_tracer()
    
    def __enter__(self) -> Span:
        self.trace = self.tracer.start_trace(
            name=f"agent:{self.agent_name}",
            user_id=self.user_id,
            session_id=self.session_id,
        )
        self.span = self.tracer.start_span(
            name=f"agent.run:{self.agent_name}",
            kind=SpanKind.internal,
            span_type=SpanType.agent_run,
            attributes={
                "agent.name": self.agent_name,
                "agent.model": self.model,
            },
        )
        return self.span
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type:
            self.span.status = SpanStatus.error
            self.span.status_message = str(exc_val)
        
        self.tracer.end_span(self.span)
        self.tracer.end_trace()


class traced_tool:
    def __init__(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        tracer: Optional[PydanticAITracer] = None,
    ):
        self.tool_name = tool_name
        self.arguments = arguments
        self.tracer = tracer or get_tracer()
        self.span: Optional[Span] = None
    
    def __enter__(self) -> Span:
        self.span = self.tracer.start_span(
            name=f"tool.call:{self.tool_name}",
            kind=SpanKind.internal,
            span_type=SpanType.tool_call,
            attributes={
                "tool.name": self.tool_name,
                "tool.arguments": self.arguments,
            },
        )
        return self.span
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.span:
            self.tracer.end_span(self.span)
