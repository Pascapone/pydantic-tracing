"""
OpenTelemetry-compatible span processor for pydantic-ai.
"""
import contextvars
import json
import threading
import time
from typing import Optional, Any, Sequence
from dataclasses import dataclass, field

from .spans import Span, SpanKind, SpanStatus, SpanType, Trace
from .collector import TraceCollector, get_collector


@dataclass
class TracingContext:
    trace: Optional[Trace] = None
    current_span: Optional[Span] = None
    span_stack: list[Span] = field(default_factory=list)
    
    def push_span(self, span: Span) -> None:
        if self.current_span and not span.parent_id:
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
        self._time_lock = threading.Lock()
        self._last_start_time_us = 0
        self._context_var: contextvars.ContextVar[Optional[TracingContext]] = contextvars.ContextVar(
            "pydantic_ai_tracing_context",
            default=None,
        )
    
    @property
    def context(self) -> TracingContext:
        ctx = self._context_var.get()
        if ctx is None:
            ctx = TracingContext()
            self._context_var.set(ctx)
        return ctx
    
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
            self.context.trace.status = status
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
        parent_id: Optional[str] = None,
        activate: bool = True,
    ) -> Span:
        if not self.context.trace:
            self.start_trace(f"auto_trace_{name}")
        
        span = Span(
            trace_id=self.context.trace.id,
            parent_id=parent_id if parent_id is not None else (
                self.context.current_span.id if self.context.current_span else None
            ),
            name=name,
            kind=kind,
            span_type=span_type,
            attributes=attributes or {},
        )

        # Guarantee strictly increasing span start times so UI ordering is deterministic
        # even when spans are created within the same microsecond.
        with self._time_lock:
            if span.start_time <= self._last_start_time_us:
                span.start_time = self._last_start_time_us + 1
            self._last_start_time_us = span.start_time
        
        if activate:
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
                    self.context.current_span = self.context.span_stack[-1] if self.context.span_stack else None
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
    
    def __enter__(self) -> "traced_agent":
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
        return self
    
    def set_result(self, result: Any) -> None:
        """Set the result of the agent run."""
        if not self.span:
            return
            
        # Extract output from result object if possible
        output = result
        if hasattr(result, "output"):
            output = result.output
        elif hasattr(result, "data"):
            output = result.data
            
        # Serialize output
        serialized = self._serialize_value(output)

        # Set attributes
        self.span.set_attribute("output", serialized)
        if hasattr(output, "__class__"):
            self.span.set_attribute("result.type", output.__class__.__name__)

        reasoning_span_count = self._capture_reasoning_spans(result)
        if reasoning_span_count > 0:
            self.span.set_attribute("trace.reasoning_span_count", reasoning_span_count)

        # Create a final model response span for visibility
        final_span = self.tracer.start_span(
            name="model.response:final",
            kind=SpanKind.client,
            span_type=SpanType.model_response,
            parent_id=self.span.id,
            activate=False,
            attributes={
                "output": serialized,
                "model.response": str(output)[:1000] if output else "",
            },
        )
        self.tracer.end_span(final_span)

    def _capture_reasoning_spans(self, result: Any) -> int:
        """Extract model thinking from run messages and persist model.reasoning spans."""
        if not self.span or not hasattr(result, "all_messages"):
            return 0

        try:
            messages = result.all_messages()
        except Exception:
            return 0

        captured = 0
        for index, message in enumerate(messages):
            parts = getattr(message, "parts", None)
            if not parts:
                continue

            reasoning_parts = []
            for part in parts:
                if getattr(part, "part_kind", "") != "thinking":
                    continue
                content = getattr(part, "content", None)
                if content:
                    reasoning_parts.append(str(content))

            if not reasoning_parts:
                continue

            reasoning_text = "\n".join(reasoning_parts).strip()
            if not reasoning_text:
                continue

            reasoning_span = self.tracer.start_span(
                name="model.reasoning",
                kind=SpanKind.client,
                span_type=SpanType.model_reasoning,
                parent_id=self.span.id,
                activate=False,
                attributes={
                    "message.index": index,
                    "model.name": getattr(message, "model_name", None),
                    "model.reasoning": reasoning_text[:10000],
                },
            )
            self.tracer.end_span(reasoning_span)
            captured += 1

        return captured

    def _serialize_value(self, value: Any) -> Any:
        try:
            if hasattr(value, "model_dump"):
                return value.model_dump()
            if hasattr(value, "__dict__"):
                return str(value)
            return value
        except Exception:
            return str(value)

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


class traced_delegation:
    """
    Context manager for agent delegation with nested tracing.
    
    Creates an agent.delegation span that becomes the parent for all
    spans created by the delegated sub-agent.
    
    Usage:
        with traced_delegation("research", "What is pydantic-ai?") as span:
            result = await research_agent.run(query)
            span.set_attribute("result.summary", result.output.summary)
    """
    
    def __init__(
        self,
        target_agent: str,
        query: str,
        tracer: Optional[PydanticAITracer] = None,
    ):
        self.target_agent = target_agent
        self.query = query
        self.tracer = tracer or get_tracer()
        self.span: Optional[Span] = None
    
    def __enter__(self) -> Span:
        self.span = self.tracer.start_span(
            name=f"agent.delegation:{self.target_agent}",
            kind=SpanKind.internal,
            span_type=SpanType.delegation,
            attributes={
                "delegation.target_agent": self.target_agent,
                "delegation.query": self.query[:500] if self.query else "",
            },
        )
        self.tracer.collector.save_span(self.span)
        return self.span
    
    def set_result(self, result: Any) -> None:
        """Set the result of the delegation."""
        if not self.span:
            return
        
        output = result
        if hasattr(result, "output"):
            output = result.output
        
        serialized = self._serialize_value(output)
        self.span.set_attribute("delegation.result", serialized)
        
        if hasattr(output, "__class__"):
            self.span.set_attribute("result.type", output.__class__.__name__)
    
    def _serialize_value(self, value: Any) -> Any:
        try:
            if hasattr(value, "model_dump"):
                return value.model_dump()
            if hasattr(value, "__dict__"):
                return str(value)[:500]
            return value
        except Exception:
            return str(value)[:500]
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if not self.span:
            return
        
        if exc_type:
            self.span.status = SpanStatus.error
            self.span.status_message = str(exc_val)
            self.span.set_attribute("delegation.error", str(exc_val))
        
        self.tracer.end_span(self.span)


class traced_agent_run:
    """
    Context manager for sub-agent runs inside a delegation context.
    
    Creates an agent.run span WITHOUT starting a new trace.
    This is used by sub-agents when they run as part of a delegation.
    
    Usage:
        with traced_agent_run("research", "openrouter:minimax/minimax-m2.5") as run:
            result = await agent.run(query)
            run.set_result(result)
    """
    
    def __init__(
        self,
        agent_name: str,
        model: str,
        tracer: Optional[PydanticAITracer] = None,
    ):
        self.agent_name = agent_name
        self.model = model
        self.tracer = tracer or get_tracer()
        self.span: Optional[Span] = None
        self._active_tool_spans: dict[str, Span] = {}
        self._active_part_spans: dict[int, dict[str, Any]] = {}
        self._stream_event_count = 0
        self._stream_reasoning_span_count = 0
        self._stream_tool_span_count = 0
    
    def __enter__(self) -> "traced_agent_run":
        self.span = self.tracer.start_span(
            name=f"agent.run:{self.agent_name}",
            kind=SpanKind.internal,
            span_type=SpanType.agent_run,
            attributes={
                "agent.name": self.agent_name,
                "agent.model": self.model,
            },
        )
        self.tracer.collector.save_span(self.span)
        return self

    def handle_stream_event(self, event: Any) -> None:
        """Capture delegated sub-agent stream events in real time."""
        if not self.span:
            return

        event_kind = str(getattr(event, "event_kind", ""))
        event_type = type(event).__name__

        if event_kind in {"function_tool_call", "builtin_tool_call"} or event_type in {
            "FunctionToolCallEvent",
            "BuiltinToolCallEvent",
        }:
            part = getattr(event, "part", None)
            if part is None:
                return

            tool_name = self._extract_tool_name(part, default="unknown")
            tool_call_id = getattr(event, "tool_call_id", None) or getattr(part, "tool_call_id", None)
            if tool_call_id is None:
                tool_call_id = f"stream-{time.time_ns()}-{tool_name}"
            tool_call_id = str(tool_call_id)

            tool_span = self.tracer.start_span(
                name=f"tool.call:{tool_name}",
                kind=SpanKind.internal,
                span_type=SpanType.tool_call,
                parent_id=self.span.id,
                activate=False,
                attributes={
                    "tool.name": tool_name,
                    "tool.call_id": tool_call_id,
                    "tool.arguments": self._extract_tool_arguments(getattr(part, "args", None)),
                },
            )
            tool_span.add_event("tool_call", {"tool.call_id": tool_call_id})
            self.tracer.collector.save_span(tool_span)
            self._active_tool_spans[tool_call_id] = tool_span
            self._stream_event_count += 1
            return

        if event_kind in {"function_tool_result", "builtin_tool_result"} or event_type in {
            "FunctionToolResultEvent",
            "BuiltinToolResultEvent",
        }:
            result_part = getattr(event, "result", None)
            if result_part is None:
                return

            tool_call_id_raw = getattr(result_part, "tool_call_id", None) or getattr(event, "tool_call_id", None)
            tool_call_id = str(tool_call_id_raw) if tool_call_id_raw is not None else None
            tool_name = self._extract_tool_name(result_part, default="unknown")
            result_content = getattr(result_part, "content", None)
            part_kind = self._normalize_part_kind(result_part)
            status = SpanStatus.error if part_kind == "retry-prompt" else SpanStatus.ok

            tool_span = self._active_tool_spans.pop(tool_call_id, None) if tool_call_id else None
            if tool_span is None:
                tool_span = self.tracer.start_span(
                    name=f"tool.call:{tool_name}",
                    kind=SpanKind.internal,
                    span_type=SpanType.tool_call,
                    parent_id=self.span.id,
                    activate=False,
                    attributes={
                        "tool.name": tool_name,
                        "tool.call_id": tool_call_id,
                    },
                )
                self.tracer.collector.save_span(tool_span)
            elif tool_name and tool_span.attributes.get("tool.name") == "unknown":
                tool_span.set_attribute("tool.name", tool_name)
                tool_span.name = f"tool.call:{tool_name}"

            tool_span.set_attribute("tool.result", self._serialize_value(result_content))
            tool_span.set_attribute(
                "tool.result_type",
                type(result_content).__name__ if result_content is not None else "None",
            )
            tool_span.add_event("tool_result", {"status": status.value})
            self.tracer.end_span(tool_span, status=status)
            self._stream_tool_span_count += 1
            self._stream_event_count += 1
            return

        if event_kind == "part_start" or event_type == "PartStartEvent":
            part = getattr(event, "part", None)
            index = getattr(event, "index", None)
            if part is None or index is None:
                return

            part_kind = self._normalize_part_kind(part)
            if part_kind not in {"text", "thinking"}:
                return

            previous = self._active_part_spans.pop(index, None)
            if previous:
                self._close_part_span(previous, incomplete=False)

            span_type = SpanType.model_reasoning if part_kind == "thinking" else SpanType.model_response
            span_name = "model.reasoning" if part_kind == "thinking" else "model.response"
            initial_content = str(getattr(part, "content", "") or "")

            part_span = self.tracer.start_span(
                name=span_name,
                kind=SpanKind.client,
                span_type=span_type,
                parent_id=self.span.id,
                activate=False,
                attributes={
                    "model.part_kind": part_kind,
                    "model.part_index": index,
                    "model.provider": getattr(part, "provider_name", None),
                    "content": self._truncate(initial_content, 6000),
                },
            )
            self._active_part_spans[index] = {
                "span": part_span,
                "kind": part_kind,
                "content": initial_content,
            }
            self._stream_event_count += 1
            return

        if event_kind == "part_delta" or event_type == "PartDeltaEvent":
            index = getattr(event, "index", None)
            delta = getattr(event, "delta", None)
            if index is None or delta is None:
                return

            part_state = self._active_part_spans.get(index)
            if not part_state:
                return

            delta_kind = self._normalize_part_kind(delta)
            if delta_kind not in {"text", "thinking"}:
                return

            content_delta = getattr(delta, "content_delta", None)
            if content_delta:
                part_state["content"] += str(content_delta)
            self._stream_event_count += 1
            return

        if event_kind == "part_end" or event_type == "PartEndEvent":
            part = getattr(event, "part", None)
            index = getattr(event, "index", None)
            if part is None or index is None:
                return

            part_state = self._active_part_spans.pop(index, None)
            part_kind = self._normalize_part_kind(part)
            if part_kind not in {"text", "thinking"}:
                return

            content = str(getattr(part, "content", "") or "")

            if part_state:
                if content:
                    part_state["content"] = content
            else:
                span_type = SpanType.model_reasoning if part_kind == "thinking" else SpanType.model_response
                span_name = "model.reasoning" if part_kind == "thinking" else "model.response"
                part_span = self.tracer.start_span(
                    name=span_name,
                    kind=SpanKind.client,
                    span_type=span_type,
                    parent_id=self.span.id,
                    activate=False,
                    attributes={
                        "model.part_kind": part_kind,
                        "model.part_index": index,
                    },
                )
                part_state = {
                    "span": part_span,
                    "kind": part_kind,
                    "content": content,
                }

            self._close_part_span(part_state, incomplete=False)
            self._stream_event_count += 1
            return
    
    def set_result(self, result: Any) -> None:
        """Set the result of the agent run."""
        if not self.span:
            return

        # Ensure in-flight stream spans are closed before final output is attached.
        self._finalize_stream_spans(incomplete=False)
        
        output = result
        if hasattr(result, "output"):
            output = result.output
        elif hasattr(result, "data"):
            output = result.data
        
        serialized = self._serialize_value(output)
        self.span.set_attribute("output", serialized)
        
        if hasattr(output, "__class__"):
            self.span.set_attribute("result.type", output.__class__.__name__)

        if self._stream_event_count > 0:
            reasoning_span_count = self._stream_reasoning_span_count
            tool_call_span_count = self._stream_tool_span_count
            self.span.set_attribute("trace.stream_event_count", self._stream_event_count)
        else:
            reasoning_span_count, tool_call_span_count = self._capture_message_spans_in_order(result)

        if reasoning_span_count > 0:
            self.span.set_attribute("trace.reasoning_span_count", reasoning_span_count)
        if tool_call_span_count > 0:
            self.span.set_attribute("trace.tool_call_span_count", tool_call_span_count)
        
        final_span = self.tracer.start_span(
            name="model.response:final",
            kind=SpanKind.client,
            span_type=SpanType.model_response,
            parent_id=self.span.id,
            activate=False,
            attributes={
                "output": serialized,
                "model.response": str(output)[:1000] if output else "",
            },
        )
        self.tracer.end_span(final_span)

    def set_partial_messages(
        self,
        messages: Sequence[Any],
        *,
        error: BaseException | None = None,
    ) -> None:
        """
        Persist best-effort reasoning/tool spans from an incomplete sub-agent run.

        This is used for timeout/cancellation/error paths where no final AgentRunResult
        is available, but partial message history exists.
        """
        if not self.span:
            return

        if error is not None:
            self.set_error(error)

        # Always flush active stream spans first so cancellations/timeouts are visible immediately.
        self._finalize_stream_spans(incomplete=True)

        extracted_messages = self._extract_messages(messages)
        self.span.set_attribute("stream.incomplete", True)
        if extracted_messages:
            self.span.set_attribute("trace.partial_message_count", len(extracted_messages))

        if self._stream_event_count > 0:
            reasoning_span_count = self._stream_reasoning_span_count
            tool_call_span_count = self._stream_tool_span_count
            self.span.set_attribute("trace.stream_event_count", self._stream_event_count)
        else:
            reasoning_span_count, tool_call_span_count = self._capture_message_spans_in_order(
                extracted_messages,
                incomplete=True,
            )

        if reasoning_span_count > 0:
            self.span.set_attribute("trace.reasoning_span_count", reasoning_span_count)
        if tool_call_span_count > 0:
            self.span.set_attribute("trace.tool_call_span_count", tool_call_span_count)

    def set_error(self, error: BaseException) -> None:
        """Mark the delegated run span as failed even if the exception is handled upstream."""
        if not self.span:
            return

        self.span.status = SpanStatus.error
        self.span.status_message = str(error)
        self.span.set_attribute("agent.error_type", type(error).__name__)
        self.span.set_attribute("agent.error_message", str(error)[:2000])

    def _extract_messages(self, source: Any) -> list[Any]:
        if source is None:
            return []

        if isinstance(source, list):
            return source

        if isinstance(source, tuple):
            return list(source)

        if isinstance(source, Sequence) and not isinstance(source, (str, bytes, bytearray)):
            return list(source)

        if hasattr(source, "all_messages"):
            try:
                return list(source.all_messages())
            except Exception:
                return []

        return []

    def _capture_message_spans_in_order(
        self,
        result: Any,
        *,
        incomplete: bool = False,
    ) -> tuple[int, int]:
        """
        Capture reasoning + tool spans in strict message/part order.

        This preserves the exact execution order for non-streaming/fallback paths.
        """
        if not self.span:
            return 0, 0

        messages = self._extract_messages(result)
        if not messages:
            return 0, 0

        active_tool_spans: dict[str, Span] = {}
        reasoning_count = 0
        tool_count = 0

        for message_index, message in enumerate(messages):
            parts = getattr(message, "parts", None)
            if not parts:
                continue

            for part_index, part in enumerate(parts):
                part_kind = self._normalize_part_kind(part)

                if part_kind == "thinking":
                    content = str(getattr(part, "content", "") or "").strip()
                    if not content:
                        continue

                    reasoning_span = self.tracer.start_span(
                        name="model.reasoning",
                        kind=SpanKind.client,
                        span_type=SpanType.model_reasoning,
                        parent_id=self.span.id,
                        activate=False,
                        attributes={
                            "message.index": message_index,
                            "message.part_index": part_index,
                            "model.name": getattr(message, "model_name", None),
                            "model.reasoning": content[:10000],
                        },
                    )
                    if incomplete:
                        reasoning_span.set_attribute("stream.incomplete", True)
                    self.tracer.end_span(reasoning_span)
                    reasoning_count += 1
                    continue

                if part_kind == "tool-call":
                    tool_name = self._extract_tool_name(part, default="unknown")
                    tool_call_id = (
                        getattr(part, "tool_call_id", None)
                        or f"msg-{message_index}-part-{part_index}-{tool_name}"
                    )
                    tool_call_id = str(tool_call_id)

                    tool_span = self.tracer.start_span(
                        name=f"tool.call:{tool_name}",
                        kind=SpanKind.internal,
                        span_type=SpanType.tool_call,
                        parent_id=self.span.id,
                        activate=False,
                        attributes={
                            "message.index": message_index,
                            "message.part_index": part_index,
                            "tool.name": tool_name,
                            "tool.call_id": tool_call_id,
                            "tool.arguments": self._extract_tool_arguments(getattr(part, "args", None)),
                        },
                    )
                    active_tool_spans[tool_call_id] = tool_span
                    continue

                if part_kind not in {"tool-return", "retry-prompt"}:
                    continue

                tool_call_id_raw = getattr(part, "tool_call_id", None)
                tool_call_id = str(tool_call_id_raw) if tool_call_id_raw is not None else None
                tool_name = self._extract_tool_name(part, default="unknown")
                result_content = getattr(part, "content", None)
                status = SpanStatus.error if part_kind == "retry-prompt" else SpanStatus.ok

                tool_span = active_tool_spans.pop(tool_call_id, None) if tool_call_id else None
                if tool_span is None:
                    tool_span = self.tracer.start_span(
                        name=f"tool.call:{tool_name}",
                        kind=SpanKind.internal,
                        span_type=SpanType.tool_call,
                        parent_id=self.span.id,
                        activate=False,
                        attributes={
                            "message.index": message_index,
                            "message.part_index": part_index,
                            "tool.name": tool_name,
                            "tool.call_id": tool_call_id,
                        },
                    )
                elif tool_name and tool_span.attributes.get("tool.name") == "unknown":
                    tool_span.set_attribute("tool.name", tool_name)
                    tool_span.name = f"tool.call:{tool_name}"

                tool_span.set_attribute("tool.result", self._serialize_value(result_content))
                tool_span.set_attribute(
                    "tool.result_type",
                    type(result_content).__name__ if result_content is not None else "None",
                )
                if incomplete:
                    tool_span.set_attribute("stream.incomplete", True)
                self.tracer.end_span(tool_span, status=status)
                tool_count += 1

        for pending_span in active_tool_spans.values():
            pending_span.set_attribute("stream.incomplete", True)
            pending_span.set_attribute("tool.result", "<missing tool-return>")
            self.tracer.end_span(
                pending_span,
                status=SpanStatus.error,
                message="Tool return missing from message history",
            )
            tool_count += 1

        return reasoning_count, tool_count

    def _finalize_stream_spans(self, *, incomplete: bool) -> None:
        for index, part_state in list(self._active_part_spans.items()):
            self._close_part_span(part_state, incomplete=incomplete)
            self._active_part_spans.pop(index, None)

        for tool_call_id, tool_span in list(self._active_tool_spans.items()):
            tool_span.set_attribute("stream.incomplete", True)
            tool_span.set_attribute("tool.result", "<tool result event missing>")
            self.tracer.end_span(
                tool_span,
                status=SpanStatus.error,
                message="Tool result event missing",
            )
            self._stream_tool_span_count += 1
            self._active_tool_spans.pop(tool_call_id, None)

    def _close_part_span(self, part_state: dict[str, Any], *, incomplete: bool) -> None:
        span = part_state["span"]
        part_kind = part_state["kind"]
        content = self._truncate(str(part_state.get("content", "")), 10000)
        if part_kind == "thinking":
            span.set_attribute("model.reasoning", content)
            self._stream_reasoning_span_count += 1
        else:
            span.set_attribute("output", content)
            span.set_attribute("model.response", content)
        if incomplete:
            span.set_attribute("stream.incomplete", True)
        self.tracer.end_span(span)

    def _normalize_part_kind(self, part: Any) -> str:
        part_kind = str(getattr(part, "part_kind", "")).lower().replace("_", "-")
        if part_kind:
            return part_kind

        part_type = type(part).__name__
        type_map = {
            "ThinkingPart": "thinking",
            "TextPart": "text",
            "ToolCallPart": "tool-call",
            "ToolReturnPart": "tool-return",
            "RetryPromptPart": "retry-prompt",
            "ThinkingPartDelta": "thinking",
            "TextPartDelta": "text",
        }
        return type_map.get(part_type, "")

    def _extract_tool_name(self, part: Any, default: str = "unknown") -> str:
        tool_name = getattr(part, "tool_name", None) or getattr(part, "name", None)
        if tool_name is None:
            return default
        return str(tool_name)

    def _truncate(self, value: str, max_len: int) -> str:
        if len(value) <= max_len:
            return value
        return value[:max_len] + f"... ({len(value) - max_len} chars truncated)"

    def _extract_tool_arguments(self, raw_args: Any) -> Any:
        if raw_args is None:
            return {}

        if isinstance(raw_args, dict):
            return self._serialize_value(raw_args)

        if isinstance(raw_args, str):
            try:
                return self._serialize_value(json.loads(raw_args))
            except json.JSONDecodeError:
                return {"raw": self._serialize_value(raw_args)}

        if hasattr(raw_args, "args_as_dict"):
            try:
                return self._serialize_value(raw_args.args_as_dict())
            except Exception:
                pass

        if hasattr(raw_args, "args_json"):
            try:
                return self._serialize_value(json.loads(raw_args.args_json))
            except Exception:
                return {"raw": self._serialize_value(getattr(raw_args, "args_json", ""))}

        return self._serialize_value(raw_args)
    
    def _serialize_value(self, value: Any) -> Any:
        try:
            if hasattr(value, "model_dump"):
                return value.model_dump()
            if hasattr(value, "__dict__"):
                return str(value)[:500]
            return value
        except Exception:
            return str(value)[:500]
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if not self.span:
            return

        if self._active_part_spans or self._active_tool_spans:
            self._finalize_stream_spans(incomplete=True)

        if self._stream_event_count > 0:
            self.span.set_attribute("trace.stream_event_count", self._stream_event_count)

        end_status = self.span.status if self.span.status != SpanStatus.unset else SpanStatus.ok
        end_message = self.span.status_message

        if exc_type:
            error_message = str(exc_val)
            self.span.set_attribute("agent.error_type", getattr(exc_type, "__name__", str(exc_type)))
            self.span.set_attribute("agent.error_message", error_message[:2000])
            end_status = SpanStatus.error
            end_message = error_message

        self.tracer.end_span(self.span, status=end_status, message=end_message)
