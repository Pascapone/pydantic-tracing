"""
Model wrappers for tracing pydantic-ai model requests and responses.
"""

from typing import Any, AsyncIterator, Optional
from contextlib import asynccontextmanager

from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.models import ModelResponse, ModelRequestParameters, StreamedResponse
from pydantic_ai.messages import ModelMessage

from .spans import SpanType, SpanKind, SpanStatus
from .processor import get_tracer
from .openrouter_compat import apply_openrouter_native_finish_reason_patch


class TracedStreamedResponse:
    """Wrapper for streaming responses that captures events for tracing."""

    def __init__(self, stream: StreamedResponse, span, tracer):
        self._stream = stream
        self._span = span
        self._tracer = tracer
        self._text_parts = []
        self._thinking_parts = []
        self._tool_calls = []
        self._model_name = getattr(stream, "model_name", "unknown")
        self._event_iterator: Optional[AsyncIterator[Any]] = None

    def __aiter__(self):
        if self._event_iterator is None:
            self._event_iterator = self._iter_events()
        return self._event_iterator

    async def __anext__(self):
        if self._event_iterator is None:
            self._event_iterator = self._iter_events()
        return await self._event_iterator.__anext__()

    def __getattr__(self, name: str) -> Any:
        # Delegate unknown attributes to preserve StreamedResponse compatibility.
        return getattr(self._stream, name)

    async def _iter_events(self) -> AsyncIterator[Any]:
        stream_iterator: AsyncIterator[Any]

        if hasattr(self._stream, "__aiter__"):
            stream_iterator = self._stream.__aiter__()
        elif hasattr(self._stream, "__anext__"):
            # Backward compatibility for legacy async-iterator implementations.
            stream_iterator = self._stream
        else:
            raise TypeError(
                f"Stream object {type(self._stream).__name__} is not async iterable"
            )

        async for event in stream_iterator:
            self._capture_event(event)
            yield event

    def _capture_event(self, event: Any) -> None:
        if hasattr(event, "part") and event.part:
            part = event.part
            part_type = part.__class__.__name__
            part_kind = str(getattr(part, "part_kind", "")).lower()

            if (part_type == "TextPart" or part_kind == "text") and hasattr(part, "content"):
                self._text_parts.append(part.content)
            elif (part_type == "ThinkingPart" or part_kind == "thinking") and hasattr(part, "content"):
                self._thinking_parts.append(part.content)
            elif (part_type == "ToolCallPart" or part_kind == "tool-call") and hasattr(part, "tool_name"):
                self._tool_calls.append(part.tool_name)

    def finalize_span(self):
        if self._text_parts:
            self._span.set_attribute("model.text", "\n".join(self._text_parts)[:2000])
        if self._thinking_parts:
            self._span.set_attribute("model.reasoning", "\n".join(self._thinking_parts)[:5000])
        if self._tool_calls:
            self._span.set_attribute("model.tool_calls", self._tool_calls)


class TracedModel(WrapperModel):
    """
    Model wrapper that traces all requests and responses.

    Automatically parents spans to the current context span,
    supporting infinite nesting depth.

    Usage:
        from tracing import TracedModel
        agent = Agent(TracedModel("openrouter:minimax/minimax-m2.5"), ...)

    Or use the factory:
        from agents.common import create_traced_agent
        agent = create_traced_agent("openrouter:minimax/minimax-m2.5", ...)
    """

    def __init__(self, wrapped):
        # Upstream compatibility: OpenRouter may omit native_finish_reason in chunks.
        apply_openrouter_native_finish_reason_patch()
        super().__init__(wrapped)

    async def request(
        self,
        messages: list[ModelMessage],
        model_settings: Any,
        model_request_parameters: ModelRequestParameters,
    ) -> ModelResponse:
        tracer = get_tracer()

        span = tracer.start_span(
            name=f"model.request:{self.model_name}",
            kind=SpanKind.client,
            span_type=SpanType.model_request,
            attributes={
                "model.name": self.model_name,
                "model.messages_count": len(messages),
                "model.messages_preview": str(messages)[:500],
            },
        )

        try:
            response = await self.wrapped.request(
                messages, model_settings, model_request_parameters
            )

            text_parts = []
            thinking_parts = []
            tool_calls = []

            for part in response.parts:
                part_type = part.__class__.__name__
                if part_type == "TextPart" and hasattr(part, "content"):
                    text_parts.append(part.content)
                elif part_type == "ThinkingPart" and hasattr(part, "content"):
                    thinking_parts.append(part.content)
                elif part_type == "ToolCallPart" and hasattr(part, "tool_name"):
                    tool_calls.append(part.tool_name)

            span.set_attribute("model.response_parts_count", len(response.parts))

            if text_parts:
                span.set_attribute("model.text", "\n".join(text_parts)[:2000])
            if thinking_parts:
                span.set_attribute("model.reasoning", "\n".join(thinking_parts)[:5000])
            if tool_calls:
                span.set_attribute("model.tool_calls", tool_calls)

            if hasattr(response, "usage") and response.usage:
                span.set_attribute("model.usage.input_tokens", response.usage.input_tokens)
                span.set_attribute("model.usage.output_tokens", response.usage.output_tokens)

            tracer.end_span(span, status=SpanStatus.ok)
            return response

        except Exception as e:
            tracer.record_exception(e)
            tracer.end_span(span, status=SpanStatus.error, message=str(e))
            raise

    @asynccontextmanager
    async def request_stream(
        self,
        messages: list[ModelMessage],
        model_settings: Any,
        model_request_parameters: ModelRequestParameters,
        run_context: Any = None,
    ) -> AsyncIterator[TracedStreamedResponse]:
        tracer = get_tracer()

        span = tracer.start_span(
            name=f"model.request_stream:{self.model_name}",
            kind=SpanKind.client,
            span_type=SpanType.model_request,
            attributes={
                "model.name": self.model_name,
                "model.streaming": True,
                "model.messages_count": len(messages),
            },
        )

        try:
            async with self.wrapped.request_stream(
                messages, model_settings, model_request_parameters, run_context
            ) as stream:
                traced_stream = TracedStreamedResponse(stream, span, tracer)
                yield traced_stream

            traced_stream.finalize_span()
            tracer.end_span(span, status=SpanStatus.ok)

        except Exception as e:
            tracer.record_exception(e)
            tracer.end_span(span, status=SpanStatus.error, message=str(e))
            raise


def wrap_model(model: Any) -> TracedModel:
    """
    Wrap a model for tracing.

    Args:
        model: A model name string or Model instance

    Returns:
        TracedModel instance

    Usage:
        from tracing import wrap_model
        agent = Agent(wrap_model("openrouter:minimax/minimax-m2.5"), ...)
    """
    return TracedModel(model)
