# Deep Tracing Problem Analysis Report

**Date:** 2026-02-18  
**Status:** OPEN - Requires Expert Analysis  
**Priority:** CRITICAL

---

## Executive Summary

The deep tracing system for pydantic-ai agents is not capturing model thinking, tool calls, tool results, or any detailed execution information. Traces in the UI only show basic span information without any expandable content or detailed data.

**Symptom:**
```
[INFO] trace_start
[SUCCESS] span_start: agent.run:research
[INFO] agent_start
[INFO] agent_complete
[SUCCESS] span_end
[SUCCESS] trace_end
```

**Expected:** Tool calls with arguments, tool results, model reasoning/thinking, usage statistics per message

**Actual:** Only high-level agent start/complete events, no detailed spans

---

## System Architecture

### Components Involved

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT JOB EXECUTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Job Queue (BullMQ)                                                      │
│     └─> AgentTraceHandler.execute()                                         │
│         ├─> create agent                                                    │
│         ├─> tracer.start_trace()                                            │
│         ├─> tracer.start_span()  [agent.run]                                │
│         ├─> agent.run_stream_events()  ◄── CURRENT IMPLEMENTATION           │
│         │   └─> async for event in stream:                                  │
│         │       └─> _handle_stream_event()                                  │
│         │           ├─> FunctionToolCallEvent → tool.call span              │
│         │           ├─> FunctionToolResultEvent → end tool span             │
│         │           ├─> PartStartEvent → model.reasoning span               │
│         │           ├─> PartDeltaEvent → accumulate reasoning               │
│         │           └─> FinalResultEvent → end reasoning                    │
│         ├─> tracer.end_span()  [agent.run]                                  │
│         └─> tracer.end_trace()                                              │
│                                                                             │
│  2. Tracing System                                                          │
│     ├─> PydanticAITracer (processor.py)                                     │
│     │   ├─> start_trace() → TraceCollector.create_trace()                   │
│     │   ├─> start_span() → Span + push to context                           │
│     │   ├─> end_span() → Span.end() + TraceCollector.save_span()            │
│     │   └─> end_trace() → TraceCollector.complete_trace()                   │
│     └─> TraceCollector (collector.py)                                       │
│         ├─> SQLite storage in traces.db                                     │
│         ├─> spans table with parent_id for hierarchy                        │
│         └─> JSON serialization for attributes/events                        │
│                                                                             │
│  3. WebSocket Real-time Updates                                             │
│     ├─> Trace watcher polls traces.db                                       │
│     └─> Client receives span updates                                        │
│                                                                             │
│  4. UI (React)                                                              │
│     ├─> TraceTerminal component                                             │
│     ├─> SpanNode renders individual spans                                   │
│     └─> Expands based on span type to show content                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Attempted Solutions

### Attempt 1: Post-Hoc Message Capture (FAILED)

**Approach:** After `agent.run()` completes, iterate through `result.all_messages()` and create spans.

**Code:**
```python
result = await agent.run(prompt, deps=deps)
if hasattr(result, 'all_messages'):
    messages = result.all_messages()
    self._capture_conversation_history(tracer, messages, agent_span)
```

**Problems Identified:**
1. **Timing Issue:** Spans created after agent span ends
2. **No Real-time Updates:** All spans created at once at the end
3. **Complex Message Parsing:** Different pydantic-ai versions have different structures
4. **Parent-Child Hierarchy Lost:** Tool spans not properly nested under agent span

**Result:** Only basic agent span created, no detailed spans visible

---

### Attempt 2: Streaming Event-Based Tracing (CURRENT - NOT WORKING)

**Approach:** Use `agent.run_stream_events()` to capture events in real-time.

**Code:**
```python
async for event in agent.run_stream_events(prompt, deps=deps):
    result_tuple = self._handle_stream_event(
        tracer=tracer,
        event=event,
        active_tool_spans=active_tool_spans,
        reasoning_span=reasoning_span,
        reasoning_text=reasoning_text,
        total_usage=total_usage,
        ctx=ctx,
    )
```

**Event Handling:**
```python
def _handle_stream_event(self, tracer, event, ...):
    event_type = type(event).__name__
    
    if event_type == "FunctionToolCallEvent":
        tool_span = tracer.start_span(
            name=f"tool.call:{tool_name}",
            span_type=SpanType.tool_call,
            attributes={"tool.name": tool_name, ...}
        )
        active_tool_spans[tool_call_id] = tool_span
    
    elif event_type == "FunctionToolResultEvent":
        if tool_call_id in active_tool_spans:
            tool_span = active_tool_spans.pop(tool_call_id)
            tracer.end_span(tool_span)
    
    elif event_type == "PartStartEvent":
        if part_type == 'text':
            reasoning_span = tracer.start_span(...)
    
    # ... etc
```

**Current Status:** 
- Handler imports successfully
- No runtime errors reported
- BUT: UI shows no detailed spans, no expandable content

---

## Key Technical Findings

### Finding 1: pydantic-ai Message Structure (from debug_messages.py)

**Message Types:**
```python
ModelRequest(
    parts=[UserPromptPart(content="...", part_kind="user-prompt")],
    instructions="...",
    timestamp=datetime,
)

ModelResponse(
    parts=[
        ThinkingPart(content="...", part_kind="thinking"),  # <-- Model reasoning!
        ToolCallPart(
            tool_name="final_result",
            args='{"answer": "..."}',  # <-- JSON string!
            tool_call_id="...",
            part_kind="tool-call"
        ),
    ],
    usage=RequestUsage(input_tokens=199, output_tokens=101),
    model_name="minimax/minimax-m2.5",
)
```

**Critical Discovery:**
- `ThinkingPart` contains model reasoning (not TextPart!)
- Tool arguments are JSON strings, not ArgsJson objects
- Usage stats are in `ModelResponse.usage`

---

### Finding 2: pydantic-ai Version Compatibility

**Installed Version:** pydantic-ai 1.60.0

**Available Methods:**
- `agent.run()` - Returns RunResult
- `agent.run_stream()` - Returns StreamedRunResult (NO event streaming!)
- `agent.run_stream_events()` - Returns async iterator of events ✓

**Critical Issue:** 
The documentation mentions `run_stream_events()` but the event types and their attributes may differ from what's expected.

**Event Types from Documentation:**
- `FunctionToolCallEvent`
- `FunctionToolResultEvent`
- `PartStartEvent`
- `PartDeltaEvent`
- `FinalResultEvent`
- `AgentRunResultEvent`

**BUT:** The actual event class names and attributes may be different in the installed version.

---

### Finding 3: Tracing Context Management

**Current Implementation (processor.py):**
```python
class PydanticAITracer:
    def __init__(self, ...):
        self._context = threading.local()  # Thread-local storage
    
    def start_span(self, ...):
        span = Span(...)
        self.context.push_span(span)  # Adds to stack
        return span
    
    def end_span(self, span, ...):
        if span:
            span.end(status, message)
            self.collector.save_span(span)  # Saves to SQLite
```

**Potential Issues:**
1. **Thread-local vs Async:** Using `threading.local()` in async code may cause issues
2. **Span Parenting:** Tool spans created during event handling should be children of agent span
3. **Context Persistence:** Context may not persist across event callbacks

---

### Finding 4: Database Schema

**spans table:**
```sql
CREATE TABLE spans (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    parent_id TEXT,          -- For hierarchy
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    span_type TEXT,          -- 'agent.run', 'tool.call', etc.
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_us INTEGER,
    attributes JSON,         -- Key-value metadata
    status TEXT NOT NULL,
    status_message TEXT,
    events JSON,             -- List of events
    created_at TEXT NOT NULL
);
```

**Observations:**
- `parent_id` is present for hierarchy
- `span_type` stored as string
- `attributes` and `events` are JSON

---

## Hypotheses for Root Cause

### Hypothesis 1: Events Not Being Created

**Theory:** The `_handle_stream_event()` method is not matching event types correctly.

**Evidence:**
- Event type matching uses `type(event).__name__`
- Event class names may differ from expected

**Test:** Add logging to see what events are actually received:
```python
async for event in agent.run_stream_events(prompt, deps=deps):
    print(f"EVENT: {type(event).__name__}")
    print(f"  Attributes: {dir(event)}")
```

---

### Hypothesis 2: Spans Not Being Saved

**Theory:** Spans are created but not persisted to database.

**Evidence:**
- `tracer.end_span()` calls `self.collector.save_span(span)`
- But `end_span()` requires the span to be in the context stack

**Test:** Check if spans are actually being saved:
```python
# After running agent job
cd python-workers
python -c "
import sqlite3
conn = sqlite3.connect('traces.db')
cursor = conn.cursor()
cursor.execute('SELECT name, span_type FROM spans ORDER BY created_at DESC LIMIT 10')
for row in cursor.fetchall():
    print(row)
"
```

---

### Hypothesis 3: Parent-Child Hierarchy Broken

**Theory:** Tool spans are created but not as children of the agent span.

**Evidence:**
- `_handle_stream_event()` creates spans during event streaming
- But the agent span context may be lost

**Test:** Check parent_id relationships in database:
```sql
SELECT s1.name as child, s2.name as parent
FROM spans s1
LEFT JOIN spans s2 ON s1.parent_id = s2.id
WHERE s1.trace_id = '<trace_id>';
```

---

### Hypothesis 4: UI Not Rendering Child Spans

**Theory:** Spans are saved correctly but UI doesn't show them.

**Evidence:**
- UI components exist for different span types
- But tree building logic may be failing

**Test:** Check what the API returns:
```bash
curl http://localhost:3000/api/traces/<trace_id>?tree=true
```

---

### Hypothesis 5: Async Context Issues

**Theory:** `threading.local()` doesn't work properly with async/await.

**Evidence:**
- `PydanticAITracer` uses `threading.local()` for context
- Async code runs in the same thread but different contexts

**Potential Fix:** Use `contextvars` instead of `threading.local()`:
```python
import contextvars

_current_trace = contextvars.ContextVar('current_trace', default=None)
_current_span = contextvars.ContextVar('current_span', default=None)
```

---

## Files to Examine

### Critical Files:

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `python-workers/handlers/agent_trace.py` | Main handler | 45-275 (execute), 428-564 (_handle_stream_event) |
| `python-workers/tracing/processor.py` | Tracer implementation | 33-139 (PydanticAITracer class) |
| `python-workers/tracing/collector.py` | SQLite storage | 120-156 (save_span) |
| `python-workers/tracing/spans.py` | Data models | 37-68 (Span class) |

### UI Files:

| File | Purpose |
|------|---------|
| `src/components/tracing/SpanNode.tsx` | Span rendering |
| `src/components/tracing/TraceTimeline.tsx` | Timeline display |
| `src/lib/tracing/db.ts` | TypeScript DB reader |
| `src/routes/api/traces/$id.ts` | API endpoint |

---

## Debugging Steps Required

### Step 1: Verify Events Are Received

Add this to `_handle_stream_event()`:
```python
print(f"[DEBUG] Event: {type(event).__name__}")
print(f"[DEBUG]   Attributes: {[x for x in dir(event) if not x.startswith('_')]}")
```

### Step 2: Verify Spans Are Created

Add this after each `tracer.start_span()`:
```python
print(f"[DEBUG] Created span: {tool_span.id} - {tool_span.name}")
print(f"[DEBUG]   Parent: {tool_span.parent_id}")
```

### Step 3: Verify Spans Are Saved

Check database directly after job execution:
```bash
cd python-workers
sqlite3 traces.db "SELECT id, name, span_type, parent_id FROM spans WHERE trace_id = '<id>';"
```

### Step 4: Verify API Response

Check what the API returns:
```bash
curl http://localhost:3000/api/traces/<trace_id> | jq .
curl http://localhost:3000/api/traces/<trace_id>?tree=true | jq .
```

### Step 5: Check UI Rendering

Add console logging to SpanNode component:
```typescript
console.log("SpanNode rendering:", span.name, span.spanType, span.children?.length);
```

---

## Alternative Approaches to Consider

### Option 1: Synchronous Post-Hoc Capture

Instead of streaming events, capture everything after agent completes:

```python
result = await agent.run(prompt, deps=deps)

# Create agent span first
agent_span = tracer.start_span(...)

# Then create child spans from messages
for msg in result.all_messages():
    if isinstance(msg, ModelResponse):
        for part in msg.parts:
            if part.part_kind == 'tool-call':
                tracer.start_span(name=f"tool.call:{part.tool_name}", ...)
                tracer.end_span()
            elif part.part_kind == 'thinking':
                tracer.start_span(name="model.reasoning", ...)
                tracer.end_span()

tracer.end_span(agent_span)
```

**Pros:** Simpler, all data available at once  
**Cons:** No real-time updates, timing information lost

---

### Option 2: Instrument pydantic-ai Internals

Use pydantic-ai's internal instrumentation hooks:

```python
from pydantic_ai.instrumentation import instrument

instrument(tracer)  # If such API exists
```

**Pros:** Proper integration  
**Cons:** May not exist, requires library knowledge

---

### Option 3: Use Logfire/OpenTelemetry

Instead of custom tracing, use official solutions:

```python
from logfire import configure
configure()

# pydantic-ai auto-instruments with logfire
```

**Pros:** Battle-tested, proper instrumentation  
**Cons:** Requires external service, not self-hosted

---

## Questions for Expert Analysis

1. **Async Context Management:** Should we use `contextvars` instead of `threading.local()` for async tracing?

2. **Event Type Names:** How can we reliably identify pydantic-ai event types across versions?

3. **Span Parenting:** Should we explicitly pass `parent_id` when creating spans in `_handle_stream_event()`?

4. **Database Storage:** Is the SQLite schema sufficient for complex agent traces?

5. **UI Rendering:** Does the SpanNode component properly handle nested children?

6. **Alternative APIs:** Is there a better pydantic-ai API for capturing execution details?

---

## Appendix: Related Sessions

- `.sessions/2026-02-17-deep-tracing-debug.md` - Previous debugging session
- `.sessions/2026-02-17-trace-integration.md` - Initial trace integration
- `.specs/deep-tracing-fix.md` - Implementation specification

---

## Conclusion

The deep tracing implementation has been attempted twice:
1. Post-hoc message capture - failed due to timing and hierarchy issues
2. Streaming event-based - currently implemented but not showing in UI

The most likely causes are:
1. Event types not matching (class names differ)
2. Spans not being properly saved to database
3. Parent-child hierarchy not maintained
4. Async context issues with `threading.local()`

**Immediate action needed:** Add debug logging to verify events are received and spans are saved.
