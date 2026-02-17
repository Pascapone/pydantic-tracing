"""
Span data models for tracing storage.
"""
from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime
from enum import Enum
import uuid


class SpanKind(str, Enum):
    internal = "INTERNAL"
    client = "CLIENT"
    server = "SERVER"
    producer = "PRODUCER"
    consumer = "CONSUMER"


class SpanStatus(str, Enum):
    unset = "UNSET"
    ok = "OK"
    error = "ERROR"


class SpanType(str, Enum):
    agent_run = "agent.run"
    agent_stream = "agent.stream"
    tool_call = "tool.call"
    model_request = "model.request"
    model_response = "model.response"
    delegation = "agent.delegation"


class Span(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trace_id: str
    parent_id: Optional[str] = None
    name: str
    kind: SpanKind = SpanKind.internal
    span_type: Optional[SpanType] = None
    start_time: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1_000_000))
    end_time: Optional[int] = None
    duration_us: Optional[int] = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    status: SpanStatus = SpanStatus.unset
    status_message: Optional[str] = None
    events: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    
    def end(self, status: SpanStatus = SpanStatus.ok, message: Optional[str] = None) -> None:
        self.end_time = int(datetime.now().timestamp() * 1_000_000)
        self.duration_us = self.end_time - self.start_time
        self.status = status
        self.status_message = message
    
    def add_event(self, name: str, attributes: Optional[dict[str, Any]] = None) -> None:
        self.events.append({
            "name": name,
            "timestamp": int(datetime.now().timestamp() * 1_000_000),
            "attributes": attributes or {},
        })
    
    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value


class Trace(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "unnamed_trace"
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    spans: list[Span] = Field(default_factory=list)
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    status: SpanStatus = SpanStatus.unset
    
    def add_span(self, span: Span) -> None:
        span.trace_id = self.id
        self.spans.append(span)
    
    def complete(self, status: SpanStatus = SpanStatus.ok) -> None:
        self.completed_at = datetime.now()
        self.status = status
    
    @property
    def total_duration_ms(self) -> float:
        if not self.spans:
            return 0
        durations = [s.duration_us for s in self.spans if s.duration_us]
        return sum(durations) / 1000 if durations else 0
    
    @property
    def span_count(self) -> int:
        return len(self.spans)


class AgentRunSpan(Span):
    span_type: SpanType = SpanType.agent_run
    
    @classmethod
    def create(
        cls,
        agent_name: str,
        model: str,
        input_prompt: str,
        deps: Optional[dict[str, Any]] = None,
        trace_id: Optional[str] = None,
        parent_id: Optional[str] = None,
    ) -> "AgentRunSpan":
        return cls(
            trace_id=trace_id or str(uuid.uuid4()),
            parent_id=parent_id,
            name=f"agent.run:{agent_name}",
            attributes={
                "agent.name": agent_name,
                "agent.model": model,
                "agent.input": input_prompt[:1000],
                "agent.deps": deps or {},
            },
        )


class ToolCallSpan(Span):
    span_type: SpanType = SpanType.tool_call
    
    @classmethod
    def create(
        cls,
        tool_name: str,
        arguments: dict[str, Any],
        trace_id: str,
        parent_id: str,
    ) -> "ToolCallSpan":
        return cls(
            trace_id=trace_id,
            parent_id=parent_id,
            name=f"tool.call:{tool_name}",
            kind=SpanKind.internal,
            attributes={
                "tool.name": tool_name,
                "tool.arguments": arguments,
            },
        )


class ModelRequestSpan(Span):
    span_type: SpanType = SpanType.model_request
    
    @classmethod
    def create(
        cls,
        model: str,
        messages: list[dict[str, Any]],
        trace_id: str,
        parent_id: str,
    ) -> "ModelRequestSpan":
        return cls(
            trace_id=trace_id,
            parent_id=parent_id,
            name=f"model.request:{model}",
            kind=SpanKind.client,
            attributes={
                "model.name": model,
                "model.messages_count": len(messages),
                "model.messages": messages,
            },
        )


class ModelResponseSpan(Span):
    span_type: SpanType = SpanType.model_response
    
    @classmethod
    def create(
        cls,
        model: str,
        response: str,
        usage: dict[str, int],
        trace_id: str,
        parent_id: str,
    ) -> "ModelResponseSpan":
        return cls(
            trace_id=trace_id,
            parent_id=parent_id,
            name=f"model.response:{model}",
            kind=SpanKind.client,
            attributes={
                "model.name": model,
                "model.response": response[:2000],
                "model.usage": usage,
            },
        )
