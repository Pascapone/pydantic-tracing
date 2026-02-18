# Session Report: Deep Tracing Debug

**Date:** 2026-02-17
**Status:** In Progress - Debugging Required

## Summary

Extended the agent trace handler to capture detailed conversation history including tool calls, reasoning, and model responses. However, the deep tracing is not yet working - traces still show minimal data.

## Completed Work

### 1. Agent Job Template (✅ Working)
- Added "AI Agent" template to Jobs page
- 4 agent types: research, coding, analysis, orchestrator
- Model selection (minimax, claude, gpt-4o)
- Jobs are created and execute successfully

### 2. WebSocket Real-time Updates (✅ Working)
- WebSocket server at `/_ws`
- Trace watcher polls `python-workers/traces.db`
- Client hook `useTracesSubscription` for real-time updates
- Connection status indicator in TraceHeader

### 3. Traces Display (⚠️ Partially Working)
- Traces are now visible in the UI
- Database path fixed: `python-workers/traces.db`
- notFoundComponent added to root route
- **Problem:** Only showing basic spans, no deep details

### 4. Deep Tracing Implementation (❌ Not Working)
- Added `_capture_conversation_history()` method to handler
- Added new SpanTypes: `tool.result`, `model.reasoning`, `user.prompt`
- Updated UI components for new span types
- **Problem:** The conversation history is not being captured/displayed

## Current Problem

### Symptom
When running an agent job, the trace shows:
```
[INFO] trace_start
[SUCCESS] span_start: agent.run:research
[INFO] agent_start
[INFO] agent_complete
[SUCCESS] span_end
[SUCCESS] trace_end
```

No tool calls, reasoning, or model responses are captured.

### Root Cause Analysis

The `_capture_conversation_history()` method is called AFTER `agent.run()` completes:

```python
# In execute() method - line ~172
result = await asyncio.wait_for(
    agent.run(prompt, deps=deps),
    timeout=timeout,
)

ctx.progress(70, "Capturing conversation history...", "postprocessing")

# Extract conversation history for deep tracing
if hasattr(result, 'all_messages'):
    messages = result.all_messages()
    self._capture_conversation_history(tracer, messages, agent_span)
```

**Problems identified:**

1. **Result structure may differ** - `result.all_messages()` might not exist or return different structure
2. **Span parenting** - New spans are created but may not be properly nested under the agent_span
3. **Message parsing** - The message types (ModelRequest, ModelResponse, etc.) may have different structures in pydantic-ai

### Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `python-workers/handlers/agent_trace.py` | Main handler with `_capture_conversation_history()` | Needs debugging |
| `python-workers/tracing/processor.py` | Tracer implementation | OK |
| `python-workers/tracing/spans.py` | Span data models | OK |
| `src/components/tracing/SpanNode.tsx` | UI for displaying spans | OK |
| `src/types/tracing.ts` | TypeScript types | OK |

## Next Steps

### Step 1: Debug the Conversation History Extraction

Add debug logging to understand what `result.all_messages()` returns:

```python
# Add to _capture_conversation_history()
print(f"Messages count: {len(messages) if messages else 0}")
for i, msg in enumerate(messages or []):
    print(f"Message {i}: type={type(msg).__name__}")
    print(f"  dir: {[x for x in dir(msg) if not x.startswith('_')]}")
```

### Step 2: Verify pydantic-ai Message Structure

The pydantic-ai library returns different message types:
- `ModelRequest` - Contains user prompts, system prompts
- `ModelResponse` - Contains model outputs, tool calls

Need to verify the actual attribute names:
- Is it `.parts` or `.content`?
- Is it `.tool_name` or `.tool`?
- Is there a `.content` attribute on TextPart?

### Step 3: Consider Alternative Approach - Event Streaming

Instead of capturing history after the fact, use pydantic-ai's streaming events:

```python
# Use run_stream_events() for real-time capture
async for event in agent.run_stream_events(prompt, deps=deps):
    if isinstance(event, FunctionToolCallEvent):
        # Create tool call span immediately
        pass
    elif isinstance(event, FunctionToolResultEvent):
        # End tool span with result
        pass
```

This would capture events as they happen rather than reconstructing from history.

### Step 4: Check pydantic-ai Documentation

Reference: https://ai.pydantic.dev/agent/

Key methods:
- `agent.run()` - Returns `RunResult`
- `result.all_messages()` - Returns list of `ModelRequest | ModelResponse`
- `agent.run_stream_events()` - Async iterable of events

### Step 5: Verify Span Creation

Ensure spans are being saved to the database:

```python
# In _capture_conversation_history(), verify spans are created
print(f"Created span: {tool_span.id} for tool {tool_name}")
```

Then check database:
```bash
cd python-workers
python -c "
import sqlite3
conn = sqlite3.connect('traces.db')
cursor = conn.cursor()
cursor.execute('SELECT id, name, span_type FROM spans ORDER BY created_at DESC LIMIT 10')
for row in cursor.fetchall():
    print(row)
"
```

## Code Locations for Debugging

### Handler Entry Point
`python-workers/handlers/agent_trace.py:172` - Where `agent.run()` is called

### Conversation Capture
`python-workers/handlers/agent_trace.py:262` - `_capture_conversation_history()` method

### Message Type Handling
`python-workers/handlers/agent_trace.py:280-340` - ModelRequest/ModelResponse parsing

### UI Rendering
`src/components/tracing/SpanNode.tsx:150-260` - SpanContent component

## Testing Commands

```bash
# Start dev server
npm run dev

# Create agent job via API
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "agent.run",
    "payload": {
      "agent": "research",
      "prompt": "What is pydantic-ai?"
    },
    "userId": "test-user"
  }'

# Check traces database
cd python-workers
python -c "
import sqlite3
conn = sqlite3.connect('traces.db')
c = conn.cursor()
c.execute('SELECT id, name, span_count FROM traces ORDER BY started_at DESC LIMIT 1')
trace = c.fetchone()
if trace:
    print(f'Trace: {trace}')
    c.execute('SELECT id, name, span_type FROM spans WHERE trace_id=?', (trace[0],))
    for span in c.fetchall():
        print(f'  Span: {span}')
"
```

## Related Documentation

- Pydantic AI Agents: https://ai.pydantic.dev/agent/
- Streaming Events: https://ai.pydantic.dev/agent/#streaming-events-and-final-output
- Function Tools: https://ai.pydantic.dev/tools/
- Instrumentation: https://ai.pydantic.dev/api/models/instrumented/

## Session Files

- Previous session: `.sessions/2026-02-17-trace-integration.md`
- Spec: `.specs/realtime-updates.md`
- Tasks: `.tasks/agent-job-template.md`, `.tasks/websocket-server.md`, `.tasks/websocket-client.md`
