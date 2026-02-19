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
class FakeModelResponse:
    parts: list
    model_name: str = "test-model"


class FakeRunResult:
    def __init__(self):
        self.output = {"status": "ok"}

    def all_messages(self):
        return [
            FakeModelResponse(parts=[FakeTextPart("ignored text")]),
            FakeModelResponse(parts=[FakeThinkingPart("Delegated sub-agent reasoning")]),
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

