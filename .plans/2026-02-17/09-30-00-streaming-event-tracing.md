# Implementation Plan: Streaming Event-Based Deep Tracing

**Date:** 2026-02-17
**Task:** Update the agent trace handler to use streaming events for real-time tracing capture

## Context

The current deep tracing implementation in `python-workers/handlers/agent_trace.py` is not capturing model thinking, tool calls, and other agent internals correctly. The task is to switch from post-hoc message capture to streaming event-based tracing.

## Problem Analysis

### Current Implementation Issues:
1. **Post-hoc capture**: The `_capture_conversation_history()` method runs AFTER the agent completes
2. **Timing issues**: Spans are created after execution, losing temporal accuracy
3. **Structure mismatch**: Tool call arguments have `ArgsJson` wrapper, not plain dicts
4. **No real-time visibility**: Can't see what's happening during execution

### Solution:
Use pydantic-ai's `run_stream()` with `stream_events()` for real-time event capture.

## Implementation Steps

### Step 1: Add `import json` to imports
- Add `import json` to the imports section at the top of `agent_trace.py`

### Step 2: Replace the `execute` method (lines 44-260)
Key changes:
1. Replace `agent.run()` with `agent.run_stream()` wrapped in `asyncio.timeout()`
2. Use `async with agent.run_stream(prompt, deps=deps) as run_result:`
3. Iterate over `run_result.stream_events()` for real-time events
4. Call `_handle_stream_event()` for each event
5. Track active tool spans by call_id
6. Track reasoning span and text as mutable state
7. Accumulate usage statistics from events
8. Get final output via `run_result.get_output()`

### Step 3: Add `_handle_stream_event` method
New method to handle streaming events:

| Event | Action |
|-------|--------|
| `FunctionToolCallEvent` | Start tool span, parse ArgsJson, store by call_id |
| `FunctionToolResultEvent` | End tool span, record result |
| `PartStartEvent` (text) | Start reasoning span |
| `PartDeltaEvent` (text) | Accumulate reasoning text |
| `FinalResultEvent` | End reasoning span, capture usage |

### Step 4: Keep existing helper methods
- `_capture_conversation_history` - Keep as fallback
- `_serialize_output` - Keep for output serialization
- `_serialize_value` - Keep for value serialization
- `validate_payload` - Keep as is

## Files to Modify

| File | Changes |
|------|---------|
| `python-workers/handlers/agent_trace.py` | Add import, replace execute, add _handle_stream_event |

## Risk Assessment

1. **Event API differences**: pydantic-ai event types may differ from documentation
   - Mitigation: Use `type(event).__name__` and `getattr()` for flexible access
   
2. **Mutable state across async calls**: Need to track reasoning span/text
   - Mitigation: Return updated values from handler, or use list references

3. **Streaming might not be supported by all models**
   - Mitigation: Keep `_capture_conversation_history` as fallback

## Testing Plan

1. Verify file has no syntax errors after changes
2. Test with curl:
   ```bash
   curl -X POST http://localhost:3000/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"type": "agent.run", "payload": {"agent": "research", "prompt": "What is pydantic-ai?"}, "userId": "test"}'
   ```
3. Verify traces in UI show tool calls, results, and reasoning

## Estimated Time

- Implementation: ~15 minutes
- Testing: ~10 minutes

## Approval Required

Please review and approve this implementation plan before I proceed with the changes.
