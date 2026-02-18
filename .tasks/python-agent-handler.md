# Task: Python Agent Trace Handler

**Task ID:** python-agent-handler
**Status:** Pending
**Created:** 2026-02-17
**Priority:** High

## Objective

Create a Python job handler that executes pydantic-ai agents with tracing enabled, returning trace_id in the job result.

## Context

We have an existing Python worker system (`python-workers/worker.py`) with job handlers. We have a complete tracing system (`python-workers/tracing/`) and agent system (`python-workers/agents/`).

The tracing system documentation is in `python-workers/docs/tracing.md` and agent documentation in `python-workers/docs/agents.md`.

## Deliverables

1. Create `python-workers/handlers/agent_trace.py` with `AgentTraceHandler` class

## Requirements

### AgentTraceHandler

```python
class AgentTraceHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "agent.run"
    
    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        # 1. Extract parameters from payload
        agent_type = payload.get("agent", "research")  # research, coding, analysis, orchestrator
        prompt = payload.get("prompt", "")
        model = payload.get("model", "openrouter:minimax/minimax-m2.5")
        
        # 2. Create agent based on type
        from agents import create_research_agent, create_coding_agent, create_analysis_agent, create_orchestrator, AgentDeps
        
        # 3. Initialize tracer with traces.db
        from tracing import get_tracer
        tracer = get_tracer("traces.db")
        
        # 4. Start trace
        trace = tracer.start_trace(
            name=f"agent_{agent_type}",
            user_id=payload.get("userId"),
            session_id=payload.get("sessionId"),
            metadata={"agent_type": agent_type, "model": model}
        )
        
        # 5. Execute agent with tracing
        # Use traced_agent context manager or manual span management
        
        # 6. End trace and return result
        tracer.end_trace()
        
        return {
            "trace_id": trace.id,
            "output": result.output,  # Agent-specific output
            "duration_ms": duration
        }
```

### Agent Types Mapping

| agent_type | Factory Function | Output Type |
|------------|------------------|-------------|
| `research` | `create_research_agent()` | `ResearchReport` |
| `coding` | `create_coding_agent()` | `CodeResult` |
| `analysis` | `create_analysis_agent()` | `AnalysisResult` |
| `orchestrator` | `create_orchestrator()` | `TaskResult` |

### Error Handling

- Catch exceptions and set trace status to ERROR
- Include error message in result
- Use `tracer.record_exception(exception)` for error traces

### Progress Updates

Use `ctx.progress()` to report:
- 10% - Initializing agent
- 30% - Starting trace
- 50% - Executing agent
- 90% - Processing result
- 100% - Complete

## Files to Reference

- `python-workers/worker.py` - Existing handler patterns
- `python-workers/handlers/__init__.py` - Handler base classes
- `python-workers/tracing/__init__.py` - Tracer API
- `python-workers/agents/__init__.py` - Agent factory functions
- `python-workers/examples/01_basic.py` - Example agent usage with tracing

## Acceptance Criteria

1. Handler registered with job_type `agent.run`
2. Supports all 4 agent types (research, coding, analysis, orchestrator)
3. Creates trace with correct metadata
4. Returns trace_id in result
5. Handles errors gracefully
6. Reports progress updates

## Testing

After implementation, test with:

```python
# Test payload
{
    "type": "agent.run",
    "agent": "research",
    "prompt": "What is pydantic-ai?",
    "userId": "test-user"
}
```

The trace should be visible in `traces.db` and queryable via `TraceViewer`.
