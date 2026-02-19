import pytest
import asyncio
from pydantic_ai import Agent
from pydantic_ai.models.test import TestModel

from tracing.wrappers import TracedModel
from tracing.processor import traced_agent_run
from tracing.spans import SpanType

@pytest.mark.asyncio
async def test_agent_with_traced_model(tracer):
    """Test that an Agent using TracedModel produces correct nested spans."""
    
    # Setup
    model = TracedModel(TestModel())
    agent = Agent(model, system_prompt="You are a test agent.")
    
    trace_name = "integration_test_trace"
    
    # Execution
    trace = tracer.start_trace(trace_name, user_id="test_user")
    
    try:
        # We need to run within a traced_agent_run context to establish the agent span
        # This mirrors how the worker.py executes agents
        with traced_agent_run("test_agent", "test-model", tracer=tracer) as run:
            result = await agent.run("Hello!")
            run.set_result(result)
            
    finally:
        tracer.end_trace()
        
    # Verification
    spans = tracer.collector.get_spans(trace.id)
    
    # 1. Check Agent Run Span
    agent_span = next((s for s in spans if s["span_type"] == "agent.run"), None)
    assert agent_span is not None
    assert agent_span["name"] == "agent.run:test_agent"
    
    # 2. Check Model Request Span (Nested under Agent)
    model_span = next((s for s in spans if s["span_type"] == "model.request"), None)
    assert model_span is not None
    assert model_span["parent_id"] == agent_span["id"]
    assert model_span["attributes"]["model.name"] == "test"
    
    # 3. Check Model Response Data (attributes on model span)
    assert "model.text" in model_span["attributes"]
    # TestModel reflects input or generic response? 
    # TestModel by default returns valid response based on input or generic.
    
    print("\nSpans found:")
    for s in spans:
        print(f"{s['name']} (parent: {s['parent_id']})")

