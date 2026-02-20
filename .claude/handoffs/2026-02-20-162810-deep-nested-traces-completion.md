# Handoff: Implementing Deep Nested Agent Tracing and Pickling Fixes

## Session Metadata
- Created: 2026-02-20 16:28:10
- Project: C:\Users\Pasko\Documents\projects\tanstack-python-jobs
- Branch: main
- Session duration: ~3 hours

### Recent Commits (for context)
  - 71ab44f nested reasoning and tool calling traces complete
  - 094187b docs: add session handoff for working-tree cleanup recovery
  - 96ed1c9 test(e2e): stabilize signup transition in trace flow
  - af11b2f fix: preserve delegated tracing data on cancellation and errors
  - 9170531 chore: normalize docs tree and remove legacy workflow artifacts

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

> This is a comprehensive handoff covering the implementation of 3-level agent delegation and performance/stability fixes in the custom tracing system.

## Current State Summary

We have successfully implemented and verified a 3-level agent delegation hierarchy: **Orchestrator -> Research -> Search**. The system now correctly captures nested spans for these calls in the SQLite tracing database. Along the way, we identified and fixed a critical bug where the tracer would crash with a pickling error when handling objects containing threading locks. We also resolved a deadlock issue in Pydantic AI when sharing token usage objects between nested streaming agents by switching to a manual increment strategy.

## Architecture Overview

- **3-Level Nesting**: The `OrchestratorAgent` delegates to `ResearchAgent`, which now delegates web search tasks to a specialized `SearchAgent`.
- **Trace Context Propagation**: Nested tracing is handled via `_run_delegated_agent_with_trace` which handles stream events manually to ensure no trace data is swallowed.
- **Safe Serialization**: The tracer uses a custom JSON encoder for SQLite (in `python-workers/tracing/collector.py`). It must avoid recursive `deepcopy` operations (like `dataclasses.asdict`) because framework objects (like `RunUsage`) often contain unpicklable thread locks.

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| python-workers/agents/search.py | New low-level agent | Handles atomic search tasks. |
| python-workers/agents/research.py | Intermediate agent | Orchestrates search delegation and summarization. |
| python-workers/tracing/collector.py | SQLite trace storage | Contains the fix for the `_thread.RLock` pickling bug. |
| python-workers/examples/08_deep_nested_traces.py | Validation script | Exercises the full 3-level chain. |

## Key Patterns Discovered

- **Manual Token Merging**: Sharing `usage=ctx.usage` across nested `run_stream_events` calls causes an internal `anyio/asyncio` deadlock. The correct pattern is to omit `usage` from the sub-agent call and manually merge it afterward using `ctx.usage.incr(result.usage())`.
- **Defensive Asdict**: `dataclasses.asdict()` is dangerous for complex objects with internal state. Shallow field extraction via dict comprehension is safer for tracing attributes in SQLite.

## Work Completed

### Tasks Finished

- [x] Create dedicated `SearchAgent` and move search logic from Research to Search.
- [x] Implement `delegate_search` tool in `ResearchAgent`.
- [x] Fix "Unknown model" error in tracing when provider prefixes were stripped.
- [x] Resolve `cannot pickle '_thread.RLock' object` crash in trace collector.
- [x] Resolve `anyio.WouldBlock` deadlock in nested agent streaming.
- [x] Verify full 3-level trace hierarchy with `python-workers/examples/08_deep_nested_traces.py`.

## Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| python-workers/tracing/collector.py | Replaced `asdict` with dict comprehension | Fixed pickling crash for objects with locks. |
| python-workers/agents/schemas.py | Added `SearchReport` | Support for new agent output. |
| python-workers/agents/research.py | Added `delegate_search` and tracing logic | Enable nested delegation. |
| python-workers/agents/orchestrator.py | Updated tracing/usage logic | Support manual usage merging. |
| python-workers/agents/__init__.py | Exported `SearchAgent` | Public API visibility. |
| AGENTS.md | Updated architecture docs | Reflect 3-level hierarchy. |

## Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| **Manual Token Merging** | Shared `RunUsage` object vs `incr()` | Shared object causes deadlocks in streaming sub-agents. |
| **Search Sub-Agent** | Keep in Research vs Separate | Separation allows for clearer tracing of search-specific tool calls. |
| **Shallow Dict Serialization** | Pydantic JSON vs `asdict` | `asdict` is recursive and fails on locks; shallow is sufficient for SQLite attributes. |

## Immediate Next Steps

1. **Scalability Testing**: Verify if the SQLite backend handles high-concurrency nested calls without lock contention.
2. **Streaming Progress**: Ensure that nested stream events (`model.reasoning`) are correctly ordered in the UI for the 3rd levels.
3. **Documentation**: Update the technical traces guide with the new "Manual Token Merging" requirement for developers.

## Blockers/Open Questions

- [ ] Does the `anyio` performance impact search latency when multiple research agents run in parallel?

## Deferred Items

- None. Deep nesting objective is 100% complete for the current scope.

## Important Context

- **NEVER** use `usage=ctx.usage` when calling `sub_agent.run_stream_events` or `sub_agent.iter` inside another agent's tool. It WILL deadlock.
- The `collector.py` fix for `_thread.RLock` is critical. If you add new Pydantic dataclasses to the tracing system, ensure they don't contain objects that `json.dumps` can't handle.

## Assumptions Made

- Minimax model is capable of following instructions when explicitly prompted in the tool query argument.

## Potential Gotchas

- If the trace ID looks correct but child spans are missing, check if the sub-agent initialization is stripping provider-prefixes (e.g., `openrouter:`).

## Environment State

### Tools/Services Used

- **Python 3.13** (via `uv`)
- **OpenRouter** (Minimax, GPT-4o)

### Active Processes

- `npm run dev` (Vite / TanStack Start server)

### Environment Variables

- `OPENROUTER_API_KEY`

## Related Resources

- `python-workers/docs/tracing.md`
- `python-workers/examples/08_deep_nested_traces.py`
