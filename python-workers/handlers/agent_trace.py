"""
Agent Trace Handler - Executes pydantic-ai agents with deep tracing enabled.

This handler captures:
- Tool calls and tool results (with arguments/result payloads)
- Model thinking and model response text parts
- Final structured output and run usage
- Model request/response message snapshots for post-run debugging
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Dict, Optional

from .context import JobContext
from . import BaseHandler


class AgentTraceHandler(BaseHandler):
    """
    Handler for executing pydantic-ai agents with deep tracing support.
    """

    DEFAULT_MODEL = "openrouter:minimax/minimax-m2.5"
    DEFAULT_TIMEOUT = 120

    @property
    def job_type(self) -> str:
        return "agent.run"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.time()
        trace_id = None
        trace = None
        agent_span = None
        tracer = None

        agent_type = payload.get("agent", "research")
        prompt = payload.get("prompt", "")
        model = payload.get("model", self.DEFAULT_MODEL)
        user_id = payload.get("userId") or payload.get("user_id")
        session_id = payload.get("sessionId") or payload.get("session_id")
        request_id = payload.get("requestId") or payload.get("request_id")
        options = payload.get("options", {})
        timeout = options.get("timeout", self.DEFAULT_TIMEOUT)

        valid_agents = ["research", "coding", "analysis", "orchestrator"]
        if agent_type not in valid_agents:
            raise ValueError(f"Invalid agent type: {agent_type}. Must be one of: {valid_agents}")
        if not prompt:
            raise ValueError("Prompt is required for agent execution")

        try:
            ctx.progress(10, f"Initializing {agent_type} agent...", "init")

            from agents import (
                create_research_agent,
                create_coding_agent,
                create_analysis_agent,
                create_orchestrator,
                AgentDeps,
            )
            from tracing import get_tracer, SpanKind, SpanStatus, SpanType

            ctx.progress(20, "Creating agent instance...", "init")

            agent_factories = {
                "research": create_research_agent,
                "coding": create_coding_agent,
                "analysis": create_analysis_agent,
                "orchestrator": create_orchestrator,
            }
            agent = agent_factories[agent_type](model=model)

            ctx.progress(30, "Initializing tracer...", "init")

            db_path = Path(__file__).parent.parent / "traces.db"
            tracer = get_tracer(str(db_path))

            ctx.progress(40, "Starting trace...", "tracing")

            trace = tracer.start_trace(
                name=f"agent_{agent_type}",
                user_id=user_id,
                session_id=session_id,
                request_id=request_id,
                metadata={
                    "agent_type": agent_type,
                    "model": model,
                    "job_id": ctx.job_id,
                    "prompt_preview": self._truncate(prompt, 200),
                },
            )
            trace_id = trace.id

            agent_span = tracer.start_span(
                name=f"agent.run:{agent_type}",
                kind=SpanKind.internal,
                span_type=SpanType.agent_run,
                attributes={
                    "agent.name": agent_type,
                    "agent.model": model,
                    "agent.job_id": ctx.job_id,
                    "prompt": self._truncate(prompt, 2000),
                },
            )

            prompt_span = tracer.start_span(
                name="user.prompt",
                kind=SpanKind.client,
                span_type=SpanType.user_prompt,
                parent_id=agent_span.id,
                activate=False,
                attributes={"content": self._truncate(prompt, 6000)},
            )
            tracer.end_span(prompt_span)

            ctx.progress(50, "Executing agent with streaming...", "execution")

            deps = AgentDeps(
                user_id=user_id or "anonymous",
                session_id=session_id or ctx.job_id,
                request_id=request_id or trace_id,
                metadata={
                    "job_id": ctx.job_id,
                    "agent_type": agent_type,
                    "model": model,
                },
            )

            tracer.add_event("agent_start", {"prompt": self._truncate(prompt, 500)})

            active_tool_spans: Dict[str, Any] = {}
            active_part_spans: Dict[int, Dict[str, Any]] = {}
            total_usage: Dict[str, int] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "requests": 0,
                "tool_calls": 0,
            }
            stream_state: Dict[str, Any] = {
                "output_data": None,
                "run_result": None,
                "detail_spans": 1,  # user.prompt span
                "final_result_tool_name": None,
            }

            try:
                async with asyncio.timeout(timeout):
                    async for event in agent.run_stream_events(prompt, deps=deps):
                        try:
                            self._handle_stream_event(
                                tracer=tracer,
                                event=event,
                                agent_span=agent_span,
                                active_tool_spans=active_tool_spans,
                                active_part_spans=active_part_spans,
                                total_usage=total_usage,
                                stream_state=stream_state,
                                ctx=ctx,
                            )
                        except Exception as event_error:
                            ctx.log(
                                f"Trace event processing warning ({type(event_error).__name__}): {event_error}",
                                level="warn",
                            )
            except asyncio.TimeoutError:
                raise TimeoutError(f"Agent execution timed out after {timeout} seconds")

            ctx.progress(80, "Processing result...", "postprocessing")

            self._finalize_open_spans(
                tracer=tracer,
                active_tool_spans=active_tool_spans,
                active_part_spans=active_part_spans,
            )

            run_result = stream_state.get("run_result")
            if run_result is not None:
                stream_state["detail_spans"] += self._capture_message_history_snapshot(
                    tracer=tracer,
                    agent_span_id=agent_span.id,
                    run_result=run_result,
                )

            output_data = stream_state.get("output_data")
            if output_data is None and run_result is not None:
                output_data = getattr(run_result, "output", None)
                stream_state["output_data"] = output_data

            if output_data is not None:
                output = self._serialize_output(output_data)

                final_output_span = tracer.start_span(
                    name="model.response:final",
                    kind=SpanKind.client,
                    span_type=SpanType.model_response,
                    parent_id=agent_span.id,
                    activate=False,
                    attributes={
                        "output": self._serialize_for_trace(output_data),
                        "output.tool_name": stream_state.get("final_result_tool_name"),
                    },
                )
                tracer.end_span(final_output_span)
                stream_state["detail_spans"] += 1

                agent_span.set_attribute("result.type", type(output_data).__name__)
                agent_span.set_attribute(
                    "result.preview",
                    self._truncate(json.dumps(self._serialize_for_trace(output), ensure_ascii=False), 800),
                )
            else:
                output = {"raw": "No output"}

            agent_span.set_attribute("usage.total_tokens", total_usage["input_tokens"] + total_usage["output_tokens"])
            agent_span.set_attribute("usage.input_tokens", total_usage["input_tokens"])
            agent_span.set_attribute("usage.output_tokens", total_usage["output_tokens"])
            agent_span.set_attribute("usage.requests", total_usage["requests"])
            agent_span.set_attribute("usage.tool_calls", total_usage["tool_calls"])
            agent_span.set_attribute("trace.detail_span_count", stream_state["detail_spans"])

            tracer.add_event("agent_complete", {"status": "success"})

            ctx.progress(90, "Finalizing trace...", "finalizing")

            tracer.end_span(agent_span, status=SpanStatus.ok)
            agent_span = None

            tracer.end_trace(status=SpanStatus.ok)
            trace = None

            duration_ms = int((time.time() - start_time) * 1000)
            ctx.progress(100, "Complete", "done")
            ctx.log(f"Agent execution completed in {duration_ms}ms", level="info")

            return {
                "trace_id": trace_id,
                "agent_type": agent_type,
                "output": output,
                "duration_ms": duration_ms,
                "status": "ok",
                "model": model,
                "detail_spans": stream_state["detail_spans"],
            }

        except Exception as e:
            error_message = str(e)
            error_type = type(e).__name__

            ctx.error(f"Agent execution failed: {error_type}: {error_message}")

            if tracer:
                from tracing import SpanStatus

                if agent_span:
                    tracer.record_exception(e)
                    tracer.end_span(agent_span, status=SpanStatus.error, message=error_message)
                    agent_span = None
                if trace:
                    tracer.end_trace(status=SpanStatus.error)
                    trace = None

            duration_ms = int((time.time() - start_time) * 1000)
            return {
                "trace_id": trace_id,
                "agent_type": agent_type,
                "error": {
                    "type": error_type,
                    "message": error_message,
                },
                "duration_ms": duration_ms,
                "status": "error",
            }
        finally:
            if tracer and (trace or agent_span):
                from tracing import SpanStatus
                ctx.log("Cleaning up orphaned spans in finally block", level="warn")
                if agent_span:
                    agent_span.set_attribute("cleanup.orphaned", True)
                    tracer.end_span(agent_span, status=SpanStatus.error, message="Trace cleanup")
                if trace:
                    tracer.end_trace(status=SpanStatus.error)

    def _handle_stream_event(
        self,
        tracer: Any,
        event: Any,
        agent_span: Any,
        active_tool_spans: Dict[str, Any],
        active_part_spans: Dict[int, Dict[str, Any]],
        total_usage: Dict[str, int],
        stream_state: Dict[str, Any],
        ctx: JobContext,
    ) -> None:
        from tracing import SpanKind, SpanStatus, SpanType

        event_kind = getattr(event, "event_kind", "")
        event_type = type(event).__name__

        if event_kind in {"function_tool_call", "builtin_tool_call"} or event_type in {"FunctionToolCallEvent", "BuiltinToolCallEvent"}:
            part = getattr(event, "part", None)
            if part is None:
                return

            tool_name = getattr(part, "tool_name", None)
            if not tool_name:
                tool_name = getattr(event, "tool_name", None)
            if not tool_name:
                tool_name = getattr(part, "name", None)
            if not tool_name:
                tool_name = "unknown"
            
            tool_call_id = getattr(event, "tool_call_id", None) or getattr(part, "tool_call_id", None) or str(time.time_ns())
            tool_args = self._extract_tool_args(getattr(part, "args", None))

            tool_span = tracer.start_span(
                name=f"tool.call:{tool_name}",
                kind=SpanKind.internal,
                span_type=SpanType.tool_call,
                parent_id=agent_span.id,
                activate=False,
                attributes={
                    "tool.name": tool_name,
                    "tool.call_id": tool_call_id,
                    "tool.arguments": tool_args,
                },
            )
            tool_span.add_event("tool_call", {"tool.call_id": tool_call_id})
            active_tool_spans[tool_call_id] = tool_span
            stream_state["detail_spans"] += 1

            ctx.log(f"Tool called: {tool_name}", level="debug")
            return

        if event_kind in {"function_tool_result", "builtin_tool_result"} or event_type in {"FunctionToolResultEvent", "BuiltinToolResultEvent"}:
            result_part = getattr(event, "result", None)
            if result_part is None:
                return

            tool_call_id = getattr(result_part, "tool_call_id", None) or getattr(event, "tool_call_id", None) or ""
            
            tool_name = getattr(result_part, "tool_name", None)
            if not tool_name:
                tool_name = getattr(event, "tool_name", None)
            
            result_content = getattr(result_part, "content", None)
            part_kind = getattr(result_part, "part_kind", "")
            status = SpanStatus.error if part_kind == "retry-prompt" else SpanStatus.ok

            tool_span = active_tool_spans.pop(tool_call_id, None)
            if tool_span is None:
                if not tool_name:
                    tool_name = "unknown"
                tool_span = tracer.start_span(
                    name=f"tool.call:{tool_name}",
                    kind=SpanKind.internal,
                    span_type=SpanType.tool_call,
                    parent_id=agent_span.id,
                    activate=False,
                    attributes={
                        "tool.name": tool_name,
                        "tool.call_id": tool_call_id,
                    },
                )
                stream_state["detail_spans"] += 1
            else:
                if tool_name and tool_span.attributes.get("tool.name") == "unknown":
                    tool_span.set_attribute("tool.name", tool_name)
                    tool_span.name = f"tool.call:{tool_name}"

            tool_span.set_attribute("tool.result", self._serialize_for_trace(result_content))
            tool_span.set_attribute("tool.result_type", type(result_content).__name__ if result_content is not None else "None")
            tool_span.add_event("tool_result", {"status": status.value})
            tracer.end_span(tool_span, status=status)
            return

        if event_kind == "part_start" or event_type == "PartStartEvent":
            part = getattr(event, "part", None)
            index = getattr(event, "index", None)
            if part is None or index is None:
                return

            part_kind = getattr(part, "part_kind", "")
            if part_kind not in {"text", "thinking"}:
                return

            previous = active_part_spans.pop(index, None)
            if previous:
                tracer.end_span(previous["span"])

            span_type = SpanType.model_reasoning if part_kind == "thinking" else SpanType.model_response
            span_name = "model.reasoning" if part_kind == "thinking" else "model.response"
            initial_content = getattr(part, "content", "")

            part_span = tracer.start_span(
                name=span_name,
                kind=SpanKind.client,
                span_type=span_type,
                parent_id=agent_span.id,
                activate=False,
                attributes={
                    "model.part_kind": part_kind,
                    "model.part_index": index,
                    "model.provider": getattr(part, "provider_name", None),
                    "content": self._truncate(str(initial_content), 6000) if initial_content else "",
                },
            )
            active_part_spans[index] = {
                "span": part_span,
                "kind": part_kind,
                "content": str(initial_content) if initial_content else "",
            }
            return

        if event_kind == "part_delta" or event_type == "PartDeltaEvent":
            index = getattr(event, "index", None)
            delta = getattr(event, "delta", None)
            if index is None or delta is None:
                return

            part_state = active_part_spans.get(index)
            if not part_state:
                return

            delta_kind = getattr(delta, "part_delta_kind", "")
            if delta_kind not in {"text", "thinking"}:
                return

            content_delta = getattr(delta, "content_delta", None)
            if content_delta:
                part_state["content"] += str(content_delta)
            return

        if event_kind == "part_end" or event_type == "PartEndEvent":
            part = getattr(event, "part", None)
            index = getattr(event, "index", None)
            if part is None or index is None:
                return

            part_state = active_part_spans.pop(index, None)
            part_kind = getattr(part, "part_kind", part_state["kind"] if part_state else "")
            if part_kind not in {"text", "thinking"}:
                return

            content = str(getattr(part, "content", "") or "")
            if not content and part_state:
                content = part_state["content"]

            if part_state:
                span = part_state["span"]
            else:
                span_type = SpanType.model_reasoning if part_kind == "thinking" else SpanType.model_response
                span_name = "model.reasoning" if part_kind == "thinking" else "model.response"
                span = tracer.start_span(
                    name=span_name,
                    kind=SpanKind.client,
                    span_type=span_type,
                    parent_id=agent_span.id,
                    activate=False,
                    attributes={"model.part_kind": part_kind, "model.part_index": index},
                )

            content_value = self._truncate(content, 10000)
            if part_kind == "thinking":
                span.set_attribute("model.reasoning", content_value)
            else:
                span.set_attribute("output", content_value)
                span.set_attribute("model.response", content_value)

            tracer.end_span(span)
            stream_state["detail_spans"] += 1
            return

        if event_kind == "final_result" or event_type == "FinalResultEvent":
            stream_state["final_result_tool_name"] = getattr(event, "tool_name", None)
            return

        if event_kind == "agent_run_result" or event_type == "AgentRunResultEvent":
            run_result = getattr(event, "result", None)
            stream_state["run_result"] = run_result
            if run_result is not None:
                stream_state["output_data"] = getattr(run_result, "output", None)
                usage_obj = run_result.usage() if hasattr(run_result, "usage") else None
                self._apply_usage_to_totals(total_usage, usage_obj)
            return

    def _capture_message_history_snapshot(
        self,
        tracer: Any,
        agent_span_id: str,
        run_result: Any,
    ) -> int:
        from tracing import SpanKind, SpanType

        if not hasattr(run_result, "all_messages"):
            return 0

        messages = run_result.all_messages()
        captured = 0

        for index, message in enumerate(messages):
            msg_type = type(message).__name__
            parts = getattr(message, "parts", [])
            serialized_parts = [self._serialize_message_part(part) for part in parts]

            if msg_type == "ModelRequest":
                instructions = getattr(message, "instructions", None)
                span = tracer.start_span(
                    name=f"model.request:{index}",
                    kind=SpanKind.client,
                    span_type=SpanType.model_request,
                    parent_id=agent_span_id,
                    activate=False,
                    attributes={
                        "message.index": index,
                        "message.type": msg_type,
                        "instructions": self._truncate(str(instructions), 4000) if instructions is not None else "",
                        "parts": serialized_parts,
                    },
                )
                tracer.end_span(span)
                captured += 1
                continue

            if msg_type == "ModelResponse":
                usage = self._serialize_usage(getattr(message, "usage", None))
                text_parts = [
                    str(getattr(part, "content", ""))
                    for part in parts
                    if getattr(part, "part_kind", "") == "text"
                ]
                thinking_parts = [
                    str(getattr(part, "content", ""))
                    for part in parts
                    if getattr(part, "part_kind", "") == "thinking"
                ]

                span = tracer.start_span(
                    name=f"model.response:{index}",
                    kind=SpanKind.client,
                    span_type=SpanType.model_response,
                    parent_id=agent_span_id,
                    activate=False,
                    attributes={
                        "message.index": index,
                        "message.type": msg_type,
                        "model.name": getattr(message, "model_name", None),
                        "usage": usage,
                        "parts": serialized_parts,
                        "output": self._truncate("\n".join(text_parts), 10000),
                        "model.reasoning": self._truncate("\n".join(thinking_parts), 10000),
                    },
                )
                tracer.end_span(span)
                captured += 1

        return captured

    def _serialize_message_part(self, part: Any) -> Dict[str, Any]:
        part_kind = getattr(part, "part_kind", type(part).__name__)
        payload: Dict[str, Any] = {"part_kind": part_kind}

        if hasattr(part, "content"):
            payload["content"] = self._serialize_for_trace(getattr(part, "content", None))

        if part_kind == "tool-call":
            payload["tool_name"] = getattr(part, "tool_name", None)
            payload["tool_call_id"] = getattr(part, "tool_call_id", None)
            payload["tool.arguments"] = self._extract_tool_args(getattr(part, "args", None))
        elif part_kind in {"tool-return", "retry-prompt"}:
            payload["tool_name"] = getattr(part, "tool_name", None)
            payload["tool_call_id"] = getattr(part, "tool_call_id", None)

        return payload

    def _finalize_open_spans(
        self,
        tracer: Any,
        active_tool_spans: Dict[str, Any],
        active_part_spans: Dict[int, Dict[str, Any]],
    ) -> None:
        from tracing import SpanStatus

        for _, part_state in list(active_part_spans.items()):
            span = part_state["span"]
            part_kind = part_state["kind"]
            content = self._truncate(part_state.get("content", ""), 10000)
            if part_kind == "thinking":
                span.set_attribute("model.reasoning", content)
            else:
                span.set_attribute("output", content)
            span.set_attribute("stream.incomplete", True)
            tracer.end_span(span)
        active_part_spans.clear()

        for _, tool_span in list(active_tool_spans.items()):
            tool_span.set_attribute("stream.incomplete", True)
            tool_span.set_attribute("tool.result", "<tool result event missing>")
            tracer.end_span(tool_span, status=SpanStatus.error, message="Tool result event missing")
        active_tool_spans.clear()

    def _extract_tool_args(self, raw_args: Any) -> Dict[str, Any]:
        if raw_args is None:
            return {}

        if isinstance(raw_args, dict):
            return self._serialize_for_trace(raw_args)

        if isinstance(raw_args, str):
            try:
                parsed = json.loads(raw_args)
                if isinstance(parsed, dict):
                    return self._serialize_for_trace(parsed)
                return {"value": self._serialize_for_trace(parsed)}
            except json.JSONDecodeError:
                return {"raw": self._truncate(raw_args, 4000)}

        if hasattr(raw_args, "args_as_dict"):
            try:
                return self._serialize_for_trace(raw_args.args_as_dict())
            except Exception:
                pass

        if hasattr(raw_args, "args_json"):
            try:
                parsed = json.loads(raw_args.args_json)
                if isinstance(parsed, dict):
                    return self._serialize_for_trace(parsed)
                return {"value": self._serialize_for_trace(parsed)}
            except Exception:
                return {"raw": self._truncate(str(raw_args.args_json), 4000)}

        if hasattr(raw_args, "model_dump"):
            try:
                return self._serialize_for_trace(raw_args.model_dump())
            except Exception:
                pass

        return {"value": self._serialize_for_trace(raw_args)}

    def _apply_usage_to_totals(self, totals: Dict[str, int], usage: Any) -> None:
        if usage is None:
            return

        totals["input_tokens"] += int(getattr(usage, "input_tokens", 0) or getattr(usage, "request_tokens", 0) or 0)
        totals["output_tokens"] += int(getattr(usage, "output_tokens", 0) or getattr(usage, "response_tokens", 0) or 0)
        totals["requests"] += int(getattr(usage, "requests", 0) or 0)
        totals["tool_calls"] += int(getattr(usage, "tool_calls", 0) or 0)

    def _serialize_usage(self, usage: Any) -> Dict[str, Any]:
        if usage is None:
            return {}

        result: Dict[str, Any] = {
            "input_tokens": int(getattr(usage, "input_tokens", 0) or getattr(usage, "request_tokens", 0) or 0),
            "output_tokens": int(getattr(usage, "output_tokens", 0) or getattr(usage, "response_tokens", 0) or 0),
            "requests": int(getattr(usage, "requests", 0) or 0),
            "tool_calls": int(getattr(usage, "tool_calls", 0) or 0),
        }
        result["total_tokens"] = result["input_tokens"] + result["output_tokens"]

        details = getattr(usage, "details", None)
        if details:
            result["details"] = self._serialize_for_trace(details)

        return result

    def _serialize_for_trace(self, value: Any, *, max_depth: int = 4, max_items: int = 25) -> Any:
        if max_depth <= 0:
            return "<max_depth_reached>"

        if value is None or isinstance(value, (bool, int, float)):
            return value

        if isinstance(value, str):
            return self._truncate(value, 10000)

        if hasattr(value, "model_dump"):
            try:
                return self._serialize_for_trace(value.model_dump(), max_depth=max_depth - 1, max_items=max_items)
            except Exception:
                return self._truncate(str(value), 2000)

        if isinstance(value, dict):
            result: Dict[str, Any] = {}
            for idx, (k, v) in enumerate(value.items()):
                if idx >= max_items:
                    result["__truncated__"] = f"{len(value) - max_items} more keys"
                    break
                result[str(k)] = self._serialize_for_trace(v, max_depth=max_depth - 1, max_items=max_items)
            return result

        if isinstance(value, (list, tuple, set)):
            items = list(value)
            serialized = [
                self._serialize_for_trace(item, max_depth=max_depth - 1, max_items=max_items)
                for item in items[:max_items]
            ]
            if len(items) > max_items:
                serialized.append(f"... {len(items) - max_items} more items")
            return serialized

        return self._truncate(str(value), 2000)

    def _truncate(self, value: str, max_len: int) -> str:
        if len(value) <= max_len:
            return value
        return value[:max_len] + f"... ({len(value) - max_len} chars truncated)"

    def _serialize_output(self, output: Any) -> Dict[str, Any]:
        if output is None:
            return {"value": None}

        if hasattr(output, "model_dump"):
            return output.model_dump()

        if hasattr(output, "__dict__"):
            result = {}
            for key, value in output.__dict__.items():
                result[key] = self._serialize_value(value)
            return result

        if isinstance(output, list):
            return {"items": [self._serialize_value(item) for item in output]}

        if isinstance(output, dict):
            return {k: self._serialize_value(v) for k, v in output.items()}

        return {"value": str(output)}

    def _serialize_value(self, value: Any) -> Any:
        if value is None:
            return None

        if isinstance(value, (str, int, float, bool)):
            return value

        if hasattr(value, "model_dump"):
            return value.model_dump()

        if hasattr(value, "__dict__"):
            return {k: self._serialize_value(v) for k, v in value.__dict__.items()}

        if isinstance(value, list):
            return [self._serialize_value(item) for item in value]

        if isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}

        return str(value)

    async def validate_payload(self, payload: Dict[str, Any]) -> Optional[str]:
        agent_type = payload.get("agent")
        if agent_type and agent_type not in ["research", "coding", "analysis", "orchestrator"]:
            return f"Invalid agent type: {agent_type}"

        if not payload.get("prompt"):
            return "Prompt is required"

        return None


HANDLER = AgentTraceHandler
