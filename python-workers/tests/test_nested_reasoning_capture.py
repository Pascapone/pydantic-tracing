from dataclasses import dataclass

from tracing.processor import traced_agent_run


@dataclass
class FakeThinkingPart:
    content: str
    part_kind: str = "thinking"


@dataclass
class FakeTextPart:
    content: str
    part_kind: str = "text"


@dataclass
class FakeToolCallPart:
    tool_name: str
    tool_call_id: str
    args: dict
    part_kind: str = "tool-call"


@dataclass
class FakeToolReturnPart:
    tool_name: str
    tool_call_id: str
    content: str
    part_kind: str = "tool-return"


@dataclass
class FakeModelResponse:
    parts: list
    model_name: str = "test-model"


class FakeRunResult:
    def __init__(self):
        self.output = {"status": "ok"}

    def all_messages(self):
        return [
            FakeModelResponse(parts=[FakeTextPart("ignored text")]),
            FakeModelResponse(
                parts=[
                    FakeToolCallPart(
                        tool_name="web_search",
                        tool_call_id="call-1",
                        args={"query": "artificial intelligence", "max_results": 5},
                    )
                ]
            ),
            FakeModelResponse(
                parts=[
                    FakeToolReturnPart(
                        tool_name="web_search",
                        tool_call_id="call-1",
                        content='[{"title":"placeholder"}]',
                    )
                ]
            ),
            FakeModelResponse(parts=[FakeThinkingPart("Delegated sub-agent reasoning")]),
        ]


class FakeRunResultInterleaved:
    def __init__(self):
        self.output = {"status": "ok"}

    def all_messages(self):
        return [
            FakeModelResponse(
                parts=[
                    FakeThinkingPart("Reasoning before tool call"),
                    FakeToolCallPart(
                        tool_name="web_search",
                        tool_call_id="call-interleaved",
                        args={"query": "streaming traces"},
                    ),
                    FakeThinkingPart("Reasoning while tool executes"),
                    FakeToolReturnPart(
                        tool_name="web_search",
                        tool_call_id="call-interleaved",
                        content='[{"title":"streaming"}]',
                    ),
                    FakeThinkingPart("Reasoning after tool result"),
                ]
            )
        ]


def test_traced_agent_run_captures_reasoning_from_message_history(tracer):
    trace = tracer.start_trace("test_nested_reasoning", user_id="test-user")

    with traced_agent_run("research", "test-model", tracer=tracer) as run:
        run.set_result(FakeRunResult())

    tracer.end_trace()

    spans = tracer.collector.get_spans(trace.id)

    run_span = next((s for s in spans if s["name"] == "agent.run:research"), None)
    assert run_span is not None
    assert run_span["attributes"].get("trace.reasoning_span_count") == 1

    reasoning_spans = [s for s in spans if s["span_type"] == "model.reasoning"]
    assert len(reasoning_spans) == 1
    assert reasoning_spans[0]["parent_id"] == run_span["id"]
    assert (
        reasoning_spans[0]["attributes"].get("model.reasoning")
        == "Delegated sub-agent reasoning"
    )


def test_traced_agent_run_captures_tool_calls_from_message_history(tracer):
    trace = tracer.start_trace("test_nested_tool_calls", user_id="test-user")

    with traced_agent_run("research", "test-model", tracer=tracer) as run:
        run.set_result(FakeRunResult())

    tracer.end_trace()

    spans = tracer.collector.get_spans(trace.id)

    run_span = next((s for s in spans if s["name"] == "agent.run:research"), None)
    assert run_span is not None
    assert run_span["attributes"].get("trace.tool_call_span_count") == 1

    tool_spans = [s for s in spans if s["span_type"] == "tool.call"]
    assert len(tool_spans) == 1
    assert tool_spans[0]["parent_id"] == run_span["id"]
    assert tool_spans[0]["name"] == "tool.call:web_search"
    assert tool_spans[0]["attributes"].get("tool.call_id") == "call-1"
    assert tool_spans[0]["attributes"].get("tool.arguments") == {
        "query": "artificial intelligence",
        "max_results": 5,
    }
    assert tool_spans[0]["attributes"].get("tool.result") == '[{"title":"placeholder"}]'


def test_traced_agent_run_captures_partial_history_and_marks_error(tracer):
    trace = tracer.start_trace("test_partial_history_capture", user_id="test-user")
    partial_messages = FakeRunResult().all_messages()

    with traced_agent_run("research", "test-model", tracer=tracer) as run:
        run.set_partial_messages(partial_messages, error=RuntimeError("delegated run interrupted"))

    tracer.end_trace()

    spans = tracer.collector.get_spans(trace.id)

    run_span = next((s for s in spans if s["name"] == "agent.run:research"), None)
    assert run_span is not None
    assert run_span["status"] == "ERROR"
    assert run_span["status_message"] == "delegated run interrupted"
    assert run_span["attributes"].get("stream.incomplete") is True
    assert run_span["attributes"].get("trace.partial_message_count") == len(partial_messages)
    assert run_span["attributes"].get("trace.reasoning_span_count") == 1
    assert run_span["attributes"].get("trace.tool_call_span_count") == 1
    assert run_span["attributes"].get("agent.error_type") == "RuntimeError"

    reasoning_spans = [s for s in spans if s["span_type"] == "model.reasoning"]
    assert len(reasoning_spans) == 1
    assert reasoning_spans[0]["parent_id"] == run_span["id"]

    tool_spans = [s for s in spans if s["span_type"] == "tool.call"]
    assert len(tool_spans) == 1
    assert tool_spans[0]["parent_id"] == run_span["id"]

    final_spans = [s for s in spans if s["name"] == "model.response:final" and s["parent_id"] == run_span["id"]]
    assert len(final_spans) == 0


def test_traced_agent_run_preserves_reasoning_tool_order(tracer):
    trace = tracer.start_trace("test_reasoning_tool_order", user_id="test-user")

    with traced_agent_run("research", "test-model", tracer=tracer) as run:
        run.set_result(FakeRunResultInterleaved())

    tracer.end_trace()

    spans = sorted(tracer.collector.get_spans(trace.id), key=lambda s: s["start_time"])
    run_span = next((s for s in spans if s["name"] == "agent.run:research"), None)
    assert run_span is not None

    ordered_child_names = [
        s["name"]
        for s in spans
        if s["parent_id"] == run_span["id"] and s["span_type"] in {"model.reasoning", "tool.call"}
    ]

    assert ordered_child_names[:4] == [
        "model.reasoning",
        "tool.call:web_search",
        "model.reasoning",
        "model.reasoning",
    ]
