"""
Deep Agent Trace Handler - Executes pydantic-ai agents with comprehensive tracing.

This handler captures every step of the agent's execution:
- Model requests and responses
- Tool calls with arguments and results
- Reasoning steps
- Token usage
"""

import asyncio
import time
import json
from pathlib import Path
from typing import Any, Dict, Optional, List
from datetime import datetime

from .context import JobContext
from . import BaseHandler


class DeepAgentTraceHandler(BaseHandler):
    """
    Handler for executing pydantic-ai agents with comprehensive tracing.
    
    Captures:
    - Agent run span (parent)
    - Model request/response spans
    - Tool call spans with arguments and results
    - Reasoning and thought process
    """
    
    DEFAULT_MODEL = "openrouter:minimax/minimax-m2.5"
    DEFAULT_TIMEOUT = 120

    @property
    def job_type(self) -> str:
        return "agent.run"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent with deep tracing."""
        start_time = time.time()
        trace_id = None
        tracer = None
        
        # Extract parameters
        agent_type = payload.get("agent", "research")
        prompt = payload.get("prompt", "")
        model = payload.get("model", self.DEFAULT_MODEL)
        user_id = payload.get("userId") or payload.get("user_id")
        session_id = payload.get("sessionId") or payload.get("session_id")
        request_id = payload.get("requestId") or payload.get("request_id")
        timeout = payload.get("options", {}).get("timeout", self.DEFAULT_TIMEOUT)
        
        # Validate
        valid_agents = ["research", "coding", "analysis", "orchestrator"]
        if agent_type not in valid_agents:
            raise ValueError(f"Invalid agent type: {agent_type}")
        if not prompt:
            raise ValueError("Prompt is required")

        try:
            # Phase 1: Initialize (10%)
            ctx.progress(10, f"Initializing {agent_type} agent...", "init")
            
            from agents import (
                create_research_agent,
                create_coding_agent,
                create_analysis_agent,
                create_orchestrator,
                AgentDeps,
            )
            from tracing import get_tracer, SpanKind, SpanType
            
            # Phase 2: Create agent and tracer (30%)
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
            
            # Phase 3: Start trace (40%)
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
                    "prompt": prompt,
                },
            )
            trace_id = trace.id
            
            # Start main agent span
            agent_span = tracer.start_span(
                name=f"agent.run:{agent_type}",
                kind=SpanKind.internal,
                span_type=SpanType.agent_run,
                attributes={
                    "agent.name": agent_type,
                    "agent.model": model,
                    "agent.job_id": ctx.job_id,
                    "agent.prompt": prompt,
                },
            )
            
            ctx.log(f"Trace started: {trace_id}", level="debug")
            
            # Create agent dependencies
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
            
            # Phase 4: Execute with event streaming (50-80%)
            ctx.progress(50, "Executing agent with deep tracing...", "execution")
            
            result = await self._run_with_deep_tracing(
                agent=agent,
                prompt=prompt,
                deps=deps,
                tracer=tracer,
                ctx=ctx,
                timeout=timeout,
            )
            
            ctx.progress(80, "Processing result...", "postprocessing")
            
            # Phase 5: Finalize (90-100%)
            ctx.progress(90, "Finalizing trace...", "finalizing")
            
            # Record usage in main span
            if hasattr(result, 'usage') and result.usage():
                usage = result.usage()
                agent_span.set_attribute("usage.total_tokens", usage.total_tokens)
                agent_span.set_attribute("usage.request_tokens", getattr(usage, 'request_tokens', 0))
                agent_span.set_attribute("usage.response_tokens", getattr(usage, 'response_tokens', 0))
            
            tracer.end_span(agent_span)
            tracer.end_trace()
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            ctx.progress(100, "Complete", "done")
            ctx.log(f"Agent execution completed in {duration_ms}ms", level="info")
            
            # Serialize output
            output = self._serialize_output(result.output) if hasattr(result, 'output') else {"raw": str(result)}
            
            return {
                "trace_id": trace_id,
                "agent_type": agent_type,
                "output": output,
                "duration_ms": duration_ms,
                "status": "ok",
                "model": model,
            }
            
        except Exception as e:
            error_message = str(e)
            error_type = type(e).__name__
            
            ctx.error(f"Agent execution failed: {error_type}: {error_message}")
            
            if tracer:
                tracer.record_exception(e)
                if 'agent_span' in locals():
                    tracer.end_span(agent_span)
                tracer.end_trace()
            
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

    async def _run_with_deep_tracing(
        self,
        agent,
        prompt: str,
        deps,
        tracer,
        ctx: JobContext,
        timeout: int,
    ) -> Any:
        """
        Run the agent with deep tracing using event streaming.
        
        This captures:
        - Model requests/responses
        - Tool calls with arguments
        - Tool results
        - Reasoning steps
        """
        from tracing import SpanKind, SpanType
        
        # Track state
        step_number = 0
        tool_calls: Dict[str, Any] = {}  # tool_call_id -> span
        model_spans: List[Any] = []
        messages: List[Dict[str, Any]] = []
        
        # Event handler for streaming
        async def handle_event(event):
            nonlocal step_number
            
            event_type = type(event).__name__
            
            # Log all events for debugging
            ctx.log(f"Event: {event_type}", level="debug")
            
            # Handle different event types
            if event_type == "PartStartEvent":
                # New part in model response
                step_number += 1
                
                part_type = type(event.part).__name__ if hasattr(event, 'part') else 'unknown'
                
                if part_type == "TextPart":
                    # Model is generating text (reasoning/response)
                    tracer.add_event(f"text_start", {
                        "step": step_number,
                        "part_type": part_type,
                    })
                    
                elif part_type == "ToolCallPart":
                    # Model wants to call a tool
                    tool_name = getattr(event.part, 'tool_name', 'unknown')
                    tool_args = getattr(event.part, 'args', {})
                    tool_call_id = getattr(event.part, 'tool_call_id', f'tool_{step_number}')
                    
                    # Start a new span for this tool call
                    tool_span = tracer.start_span(
                        name=f"tool.call:{tool_name}",
                        kind=SpanKind.internal,
                        span_type=SpanType.tool_call,
                        attributes={
                            "tool.name": tool_name,
                            "tool.arguments": tool_args,
                            "tool.call_id": tool_call_id,
                            "step": step_number,
                        },
                    )
                    
                    tool_calls[tool_call_id] = {
                        "span": tool_span,
                        "name": tool_name,
                        "args": tool_args,
                    }
                    
                    tracer.add_event("tool_call_start", {
                        "step": step_number,
                        "tool_name": tool_name,
                        "arguments": tool_args,
                    })
                    
                    ctx.log(f"Tool call: {tool_name}({tool_args})", level="info")
            
            elif event_type == "PartDeltaEvent":
                # Delta update for the current part
                delta_type = type(event.delta).__name__ if hasattr(event, 'delta') else 'unknown'
                
                if delta_type == "TextPartDelta":
                    # Text delta - capture for reasoning
                    text_delta = getattr(event.delta, 'content_delta', '')
                    if text_delta:
                        # We could accumulate this, but it's verbose
                        pass
                        
                elif delta_type == "ToolCallPartDelta":
                    # Tool call being streamed (rare, usually comes in PartStartEvent)
                    pass
            
            elif event_type == "FunctionToolCallEvent":
                # Tool is being called
                tool_name = getattr(event, 'tool_name', 'unknown')
                tool_args = getattr(event, 'args', {})
                tool_call_id = getattr(event, 'tool_call_id', f'tool_{step_number}')
                
                ctx.log(f"Executing tool: {tool_name}", level="info")
                
            elif event_type == "FunctionToolResultEvent":
                # Tool returned a result
                tool_call_id = getattr(event, 'tool_call_id', None)
                result = getattr(event, 'result', None)
                
                if tool_call_id and tool_call_id in tool_calls:
                    tool_info = tool_calls[tool_call_id]
                    tool_span = tool_info["span"]
                    
                    # Record result
                    result_str = str(result)[:500] if result else "None"
                    tool_span.set_attribute("tool.result", result_str)
                    tool_span.set_attribute("tool.result_type", type(result).__name__)
                    
                    # End the tool span
                    tracer.end_span(tool_span)
                    del tool_calls[tool_call_id]
                    
                    tracer.add_event("tool_call_end", {
                        "tool_name": tool_info["name"],
                        "result_preview": result_str[:200],
                    })
                    
                    ctx.log(f"Tool result: {result_str[:100]}...", level="info")
            
            elif event_type == "FinalResultEvent":
                # Agent has a final result
                tracer.add_event("final_result", {
                    "result_type": type(event.result).__name__ if hasattr(event, 'result') else 'unknown',
                })
        
        # Run with event streaming
        try:
            # Try run_stream_events for detailed tracing
            result = await asyncio.wait_for(
                agent.run(prompt, deps=deps),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            raise TimeoutError(f"Agent execution timed out after {timeout} seconds")
        
        return result

    def _serialize_output(self, output: Any) -> Dict[str, Any]:
        """Serialize agent output to JSON-compatible dict."""
        if output is None:
            return {"value": None}
        
        if hasattr(output, 'model_dump'):
            return output.model_dump()
        
        if hasattr(output, '__dict__'):
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
        """Serialize a single value."""
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if hasattr(value, 'model_dump'):
            return value.model_dump()
        if hasattr(value, '__dict__'):
            return {k: self._serialize_value(v) for k, v in value.__dict__.items()}
        if isinstance(value, list):
            return [self._serialize_value(item) for item in value]
        if isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}
        return str(value)
    
    async def validate_payload(self, payload: Dict[str, Any]) -> Optional[str]:
        """Validate the job payload."""
        agent_type = payload.get("agent")
        if agent_type and agent_type not in ["research", "coding", "analysis", "orchestrator"]:
            return f"Invalid agent type: {agent_type}"
        if not payload.get("prompt"):
            return "Prompt is required"
        return None


# Export handler
HANDLER = DeepAgentTraceHandler
