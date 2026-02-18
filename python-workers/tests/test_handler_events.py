"""
Unit tests for agent_trace handler event processing.
"""
import asyncio
import sys
import tempfile
import os
import gc
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch
from dataclasses import dataclass
from typing import Any, Dict, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from tracing.collector import TraceCollector
from tracing.spans import Span, SpanType, SpanKind, SpanStatus


def get_tracer(db_path: str):
    from tracing.processor import PydanticAITracer, set_tracer
    TraceCollector.reset_instance()
    tracer = PydanticAITracer(db_path=db_path)
    set_tracer(tracer)
    return tracer


def close_tracer():
    from tracing.processor import set_tracer
    set_tracer(None)
    TraceCollector.reset_instance()
    gc.collect()


@dataclass
class MockPart:
    tool_name: str = "test_tool"
    tool_call_id: str = "call_123"
    args: Dict[str, Any] = None
    content: str = ""
    part_kind: str = "tool-call"
    
    def __post_init__(self):
        if self.args is None:
            self.args = {"query": "test"}


@dataclass
class MockResultPart:
    tool_name: str = "test_tool"
    tool_call_id: str = "call_123"
    content: Any = "test result"
    part_kind: str = "tool-return"


@dataclass
class MockThinkingPart:
    content: str = "thinking about it..."
    part_kind: str = "thinking"


@dataclass
class MockEvent:
    event_kind: str
    part: Any = None
    result: Any = None
    tool_call_id: str = None
    index: int = None
    delta: Any = None


@dataclass
class MockContext:
    job_id: str = "test_job"
    
    def progress(self, pct, msg, stage=None):
        pass
    
    def log(self, msg, level="info"):
        print(f"[{level.upper()}] {msg}")
    
    def error(self, msg):
        print(f"[ERROR] {msg}")


def test_tool_call_event_with_tool_name():
    """Test that tool name is correctly extracted from tool call event."""
    from handlers.agent_trace import AgentTraceHandler
    
    handler = AgentTraceHandler()
    ctx = MockContext()
    
    db_path = None
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, "test.db")
        tracer = get_tracer(db_path)
        
        trace = tracer.start_trace("test_trace")
        agent_span = tracer.start_span(
            name="agent.run:test",
            span_type=SpanType.agent_run,
        )
        
        active_tool_spans = {}
        active_part_spans = {}
        total_usage = {"input_tokens": 0, "output_tokens": 0, "requests": 0, "tool_calls": 0}
        stream_state = {"detail_spans": 0}
        
        # Test tool call event with explicit tool_name
        event = MockEvent(
            event_kind="function_tool_call",
            part=MockPart(tool_name="web_search", tool_call_id="call_abc"),
        )
        
        handler._handle_stream_event(
            tracer=tracer,
            event=event,
            agent_span=agent_span,
            active_tool_spans=active_tool_spans,
            active_part_spans=active_part_spans,
            total_usage=total_usage,
            stream_state=stream_state,
            ctx=ctx,
        )
        
        assert "call_abc" in active_tool_spans, "Tool span should be tracked"
        tool_span = active_tool_spans["call_abc"]
        assert tool_span.name == "tool.call:web_search", f"Expected tool.call:web_search, got {tool_span.name}"
        assert tool_span.attributes.get("tool.name") == "web_search"
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        print("✅ test_tool_call_event_with_tool_name passed")
    finally:
        close_tracer()
        if db_path:
            import shutil
            try:
                shutil.rmtree(os.path.dirname(db_path), ignore_errors=True)
            except:
                pass


def test_tool_call_event_without_tool_name():
    """Test that tool name falls back to 'unknown' when not provided."""
    from handlers.agent_trace import AgentTraceHandler
    
    handler = AgentTraceHandler()
    ctx = MockContext()
    
    db_path = None
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, "test.db")
        tracer = get_tracer(db_path)
        
        trace = tracer.start_trace("test_trace")
        agent_span = tracer.start_span(
            name="agent.run:test",
            span_type=SpanType.agent_run,
        )
        
        active_tool_spans = {}
        active_part_spans = {}
        total_usage = {"input_tokens": 0, "output_tokens": 0, "requests": 0, "tool_calls": 0}
        stream_state = {"detail_spans": 0}
        
        # Test tool call event without tool_name
        event = MockEvent(
            event_kind="function_tool_call",
            part=MockPart(tool_name=None, tool_call_id="call_xyz"),
        )
        
        handler._handle_stream_event(
            tracer=tracer,
            event=event,
            agent_span=agent_span,
            active_tool_spans=active_tool_spans,
            active_part_spans=active_part_spans,
            total_usage=total_usage,
            stream_state=stream_state,
            ctx=ctx,
        )
        
        assert "call_xyz" in active_tool_spans, "Tool span should be tracked even without tool_name"
        tool_span = active_tool_spans["call_xyz"]
        assert tool_span.name == "tool.call:unknown", f"Expected tool.call:unknown, got {tool_span.name}"
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        print("✅ test_tool_call_event_without_tool_name passed")
    finally:
        close_tracer()
        if db_path:
            import shutil
            try:
                shutil.rmtree(os.path.dirname(db_path), ignore_errors=True)
            except:
                pass


def test_tool_result_updates_unknown_tool_name():
    """Test that tool result updates unknown tool name."""
    from handlers.agent_trace import AgentTraceHandler
    
    handler = AgentTraceHandler()
    ctx = MockContext()
    
    db_path = None
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, "test.db")
        tracer = get_tracer(db_path)
        
        trace = tracer.start_trace("test_trace")
        agent_span = tracer.start_span(
            name="agent.run:test",
            span_type=SpanType.agent_run,
        )
        
        active_tool_spans = {}
        active_part_spans = {}
        total_usage = {"input_tokens": 0, "output_tokens": 0, "requests": 0, "tool_calls": 0}
        stream_state = {"detail_spans": 0}
        
        # Create tool call with unknown name
        event1 = MockEvent(
            event_kind="function_tool_call",
            part=MockPart(tool_name=None, tool_call_id="call_123"),
        )
        
        handler._handle_stream_event(
            tracer=tracer,
            event=event1,
            agent_span=agent_span,
            active_tool_spans=active_tool_spans,
            active_part_spans=active_part_spans,
            total_usage=total_usage,
            stream_state=stream_state,
            ctx=ctx,
        )
        
        assert active_tool_spans["call_123"].name == "tool.call:unknown"
        
        # Tool result should update the name
        event2 = MockEvent(
            event_kind="function_tool_result",
            result=MockResultPart(tool_name="web_search", tool_call_id="call_123"),
        )
        
        handler._handle_stream_event(
            tracer=tracer,
            event=event2,
            agent_span=agent_span,
            active_tool_spans=active_tool_spans,
            active_part_spans=active_part_spans,
            total_usage=total_usage,
            stream_state=stream_state,
            ctx=ctx,
        )
        
        # Span should be ended now
        assert "call_123" not in active_tool_spans
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        # Check database
        collector = TraceCollector(db_path)
        spans = collector.get_spans(trace.id)
        tool_span = next((s for s in spans if "tool.call" in s["name"]), None)
        
        assert tool_span is not None, "Tool span should exist in database"
        assert tool_span["name"] == "tool.call:web_search", f"Expected tool.call:web_search, got {tool_span['name']}"
        assert tool_span["attributes"].get("tool.name") == "web_search"
        
        print("✅ test_tool_result_updates_unknown_tool_name passed")
    finally:
        close_tracer()
        if db_path:
            import shutil
            try:
                shutil.rmtree(os.path.dirname(db_path), ignore_errors=True)
            except:
                pass


def test_thinking_part_creates_reasoning_span():
    """Test that thinking parts create model.reasoning spans."""
    from handlers.agent_trace import AgentTraceHandler
    
    handler = AgentTraceHandler()
    ctx = MockContext()
    
    db_path = None
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, "test.db")
        tracer = get_tracer(db_path)
        
        trace = tracer.start_trace("test_trace")
        agent_span = tracer.start_span(
            name="agent.run:test",
            span_type=SpanType.agent_run,
        )
        
        active_tool_spans = {}
        active_part_spans = {}
        total_usage = {"input_tokens": 0, "output_tokens": 0, "requests": 0, "tool_calls": 0}
        stream_state = {"detail_spans": 0}
        
        # Test thinking part start
        event = MockEvent(
            event_kind="part_start",
            part=MockThinkingPart(content="Let me think..."),
            index=0,
        )
        
        handler._handle_stream_event(
            tracer=tracer,
            event=event,
            agent_span=agent_span,
            active_tool_spans=active_tool_spans,
            active_part_spans=active_part_spans,
            total_usage=total_usage,
            stream_state=stream_state,
            ctx=ctx,
        )
        
        assert 0 in active_part_spans, "Thinking part should be tracked"
        assert active_part_spans[0]["kind"] == "thinking"
        
        # End the thinking part
        end_event = MockEvent(
            event_kind="part_end",
            part=MockThinkingPart(content="Done thinking."),
            index=0,
        )
        
        handler._handle_stream_event(
            tracer=tracer,
            event=end_event,
            agent_span=agent_span,
            active_tool_spans=active_tool_spans,
            active_part_spans=active_part_spans,
            total_usage=total_usage,
            stream_state=stream_state,
            ctx=ctx,
        )
        
        assert 0 not in active_part_spans, "Thinking part should be removed after end"
        
        tracer.end_span(agent_span)
        tracer.end_trace()
        
        # Check database
        collector = TraceCollector(db_path)
        spans = collector.get_spans(trace.id)
        reasoning_span = next((s for s in spans if s["span_type"] == "model.reasoning"), None)
        
        assert reasoning_span is not None, "Reasoning span should exist"
        assert reasoning_span["attributes"].get("model.reasoning") == "Done thinking."
        
        print("✅ test_thinking_part_creates_reasoning_span passed")
    finally:
        close_tracer()
        if db_path:
            import shutil
            try:
                shutil.rmtree(os.path.dirname(db_path), ignore_errors=True)
            except:
                pass


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Running handler event tests...")
    print("=" * 60)
    
    test_tool_call_event_with_tool_name()
    test_tool_call_event_without_tool_name()
    test_tool_result_updates_unknown_tool_name()
    test_thinking_part_creates_reasoning_span()
    
    print()
    print("=" * 60)
    print("All tests passed! ✅")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()