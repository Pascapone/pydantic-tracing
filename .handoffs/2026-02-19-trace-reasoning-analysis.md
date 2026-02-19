# Handoff: Missing Reasoning in Multi-Agent Traces

## Session Metadata
- Created: 2026-02-19
- Project: `tanstack-python-jobs`
- Goal: Fix missing reasoning/internal steps in multi-agent traces.

## Handoff Chain
- **Continues from**: `2026-02-19-003100-nested-traces-multi-agent.md`
- **Reference Plan**: `.plans/2026-02-19-trace-reasoning-fix.md`

---

## Current State Summary

We investigated why sub-agent reasoning and intermediate steps were missing from traces.
- **Root Cause**: The underlying `pydantic_ai.models.Model` is not instrumented. While `agent.run` and `tool.call` are traced, the actual model requests (where reasoning happens) are not.
- **Reproduction**: Created `python-workers/reproduce_issue.py` which confirmed that `model.request` and `model.response` spans are missing.
- **Solution Designed**: A `TracedModel` wrapper that intercepts `request()` calls to create the necessary spans.

## Important Context

1.  **Missing Spans**: Currently, only `agent.run` and `tool.call` spans exist. `model.request` spans (which would contain the prompt and reasoning) are absent.
2.  **Timeout Visibility**: Because `model.request` is not traced, timeouts result in a failed `agent.run` span with no info on *what* was actually sent to the model or how long it waited before timing out.
3.  **Nesting**: The `TracedModel` approach relies on `contextvars` (via `tracer.start_span`) to automatically parent the new spans to whatever span is currently active (e.g., a sub-agent's run span). This supports infinite nesting.

## Immediate Next Steps

1.  **Implement `TracedModel`**: Create `python-workers/tracing/wrappers.py` implementing the wrapper class as defined in the plan.
2.  **Update Agents**: Modify `python-workers/agents/*.py` (orchestrator, research, coding, analysis) to wrap their models with `TracedModel`.
3.  **Verify**: Run `python-workers/reproduce_issue.py` (updated to use the wrapper) and `python-workers/examples/07_nested_traces.py` to confirm reasoning is now visible.

## Decisions Made

- **Wrapper Pattern**: We chose to wrap the `Model` instance rather than subclassing or patching `Agent`, as this is less intrusive and more explicit.
- **Error Handling**: The wrapper will catch exceptions (like timeouts), record them in the span, and re-raise them, ensuring the trace reflects the failure accurately.

## Files Created/Modified
- `python-workers/reproduce_issue.py`: Reproduction script.
- `.plans/2026-02-19-trace-reasoning-fix.md`: Detailed implementation plan.
