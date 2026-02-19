import pytest
import asyncio
from typing import List, Optional
from dataclasses import dataclass
from pydantic_ai.models import Model, ModelRequestParameters, ModelResponse, ModelMessage
from pydantic_ai.messages import TextPart, ToolCallPart
from pydantic_ai.settings import ModelSettings

from tracing.wrappers import TracedModel
from tracing.spans import SpanType

from pydantic_ai.models.test import TestModel

# --- Tests ---

@pytest.mark.asyncio
async def test_traced_model_request(tracer):
    """Test that TracedModel.request creates correct spans."""
    # Use TestModel from pydantic-ai which is a concrete implementation
    mock_model = TestModel()
    traced_model = TracedModel(mock_model)
    
    # Start a parent trace/span
    trace = tracer.start_trace("test_trace", user_id="test")
    agent_span = tracer.start_span("agent.run:test", span_type=SpanType.agent_run)
    
    try:
        # Make request with required args
        settings = ModelSettings()
        # Correct arguments based on inspection: function_tools, allow_text_output
        params = ModelRequestParameters(function_tools=[], allow_text_output=True)
        await traced_model.request([], settings, params)
        
        # Verify spans
        collector = tracer.collector
        spans = collector.get_spans(trace.id)
        
        # Should have: agent.run, model.request
        # TracedModel creates a SINGLE span for the request which encapsulates the response
        request_span = next((s for s in spans if s["span_type"] == "model.request"), None)
        
        assert request_span is not None
        assert request_span["parent_id"] == agent_span.id
        
        # Check standard attributes that should be present on request span
        assert "model.name" in request_span["attributes"]
        assert "model.usage.input_tokens" in request_span["attributes"]
        
    finally:
        tracer.end_span(agent_span)
        tracer.end_trace()

@pytest.mark.asyncio
async def test_traced_model_attributes(tracer):
    """Verify attributes on model spans."""
    mock_model = TestModel()
    traced_model = TracedModel(mock_model)
    
    trace = tracer.start_trace("test_attrs", user_id="test")
    
    settings = ModelSettings()
    params = ModelRequestParameters(function_tools=[], allow_text_output=True)
    await traced_model.request([], settings, params)
    
    spans = tracer.collector.get_spans(trace.id)
    req = next(s for s in spans if s["span_type"] == "model.request")
    
    # TestModel's default name is 'test'
    assert "model.name" in req["attributes"]
    assert req["attributes"]["model.name"] == "test"
    
    tracer.end_trace()
