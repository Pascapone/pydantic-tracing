import asyncio
import sys
from pathlib import Path
from typing import Any, List
from dataclasses import dataclass

sys.path.insert(0, str(Path(__file__).parent))

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.test import TestModel
from tracing import get_tracer, traced_agent_run, traced_delegation, TracedModel
from tracing.spans import SpanType

# Setup tracer
db_path = Path(__file__).parent / "reproduce_traces.db"
if db_path.exists():
    db_path.unlink()

tracer = get_tracer(str(db_path))


async def main():
    print("Testing TracedModel: Model request spans should now appear...")

    # 1. Create agent with TracedModel wrapping TestModel
    # This ensures model requests are traced
    model = TracedModel(TestModel())

    agent = Agent(model, output_type=str, system_prompt="You are a test agent.")

    # 2. Run agent within tracing context
    print("Running agent with TracedModel...")

    tracer.start_trace("traced_model_test", user_id="test_user")

    try:
        with traced_agent_run("test_agent", "test-model", tracer=tracer) as run:
            result = await agent.run("Hello, world!")
            run.set_result(result)

        print("Agent run completed.")

    finally:
        tracer.end_trace()

    # 3. Analyze trace
    from tracing.collector import TraceCollector

    collector = TraceCollector(str(db_path))

    await asyncio.sleep(0.5)

    # Read from DB
    import sqlite3
    import json

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT name, attributes, span_type FROM spans")
    rows = cursor.fetchall()
    spans = []
    for row in rows:
        attr = json.loads(row[1]) if row[1] else {}
        spans.append({"name": row[0], "attributes": attr, "span_type": row[2]})

    print(f"\nTotal spans captured: {len(spans)}")
    for s in spans:
        print(f"  - {s['name']} ({s['span_type']})")

    model_request_spans = [s for s in spans if s.get("span_type") == "model.request"]
    model_response_spans = [s for s in spans if s.get("span_type") == "model.response"]

    print(f"\nModel Request Spans: {len(model_request_spans)}")
    print(f"Model Response Spans: {len(model_response_spans)}")

    if len(model_request_spans) >= 1:
        print("\n[SUCCESS] Model request spans are now captured!")
        for s in model_request_spans:
            print(f"  Span: {s['name']}")
            print(f"  Attributes: {s['attributes']}")
    else:
        print("\n[FAILED] No model.request spans found.")


if __name__ == "__main__":
    asyncio.run(main())
