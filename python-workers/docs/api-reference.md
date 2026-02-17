# API Reference

Complete API documentation for the pydantic-ai tracing system.

---

## Module: `agents`

Agent factory functions and schemas for the multi-agent system.

### Factory Functions

#### `create_orchestrator`

```python
def create_orchestrator(
    model: str = "openrouter:minimax/minimax-m2.5"
) -> Agent[AgentDeps, TaskResult]
```

Create an orchestrator agent that coordinates sub-agents.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `str` | `"openrouter:minimax/minimax-m2.5"` | Model identifier |

**Returns:** `Agent[AgentDeps, TaskResult]` - Configured orchestrator agent

**Example:**
```python
from agents import create_orchestrator

orchestrator = create_orchestrator()
result = await orchestrator.run("Research and summarize Python async patterns")
```

---

#### `create_research_agent`

```python
def create_research_agent(
    model: str = "openrouter:minimax/minimax-m2.5"
) -> Agent[AgentDeps, ResearchReport]
```

Create a research agent for web search and summarization.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `str` | `"openrouter:minimax/minimax-m2.5"` | Model identifier |

**Returns:** `Agent[AgentDeps, ResearchReport]` - Configured research agent

**Example:**
```python
from agents import create_research_agent, AgentDeps

agent = create_research_agent()
deps = AgentDeps(user_id="u1", session_id="s1", request_id="r1")
result = await agent.run("What is pydantic-ai?", deps=deps)
```

---

#### `create_coding_agent`

```python
def create_coding_agent(
    model: str = "openrouter:minimax/minimax-m2.5"
) -> Agent[AgentDeps, CodeResult]
```

Create a coding agent for code generation and execution.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `str` | `"openrouter:minimax/minimax-m2.5"` | Model identifier |

**Returns:** `Agent[AgentDeps, CodeResult]` - Configured coding agent

---

#### `create_analysis_agent`

```python
def create_analysis_agent(
    model: str = "openrouter:minimax/minimax-m2.5"
) -> Agent[AgentDeps, AnalysisResult]
```

Create an analysis agent for data analysis and visualization.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `str` | `"openrouter:minimax/minimax-m2.5"` | Model identifier |

**Returns:** `Agent[AgentDeps, AnalysisResult]` - Configured analysis agent

---

### Schema Classes

#### `AgentDeps`

```python
class AgentDeps(BaseModel):
    user_id: str
    session_id: str
    request_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)
```

Dependencies injected into agents.

---

#### `TaskResult`

```python
class TaskResult(BaseModel):
    task: str
    status: TaskStatus
    subtasks: list[SubTaskResult]
    final_answer: str
    total_tokens_used: int
    total_duration_ms: int
```

Output from orchestrator agent.

---

#### `ResearchReport`

```python
class ResearchReport(BaseModel):
    query: str
    summary: str
    sources: list[ResearchSource]
    key_findings: list[str]
    confidence: float  # 0.0 - 1.0
```

Output from research agent.

---

#### `CodeResult`

```python
class CodeResult(BaseModel):
    files: list[CodeFile]
    execution: Optional[CodeExecutionResult]
    explanation: str
    suggestions: list[str]
```

Output from coding agent.

---

#### `AnalysisResult`

```python
class AnalysisResult(BaseModel):
    data_type: str
    row_count: int
    column_count: Optional[int]
    statistics: dict[str, StatisticalSummary]
    insights: list[str]
    anomalies: list[dict[str, Any]]
    chart_data: Optional[list[DataPoint]]
```

Output from analysis agent.

---

### Enums

#### `TaskStatus`

```python
class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
```

---

#### `AgentType`

```python
class AgentType(str, Enum):
    orchestrator = "orchestrator"
    research = "research"
    coding = "coding"
    analysis = "analysis"
```

---

## Module: `agents.tools`

Tool implementations for agents.

### Web Tools

#### `search_web`

```python
async def search_web(
    query: str,
    max_results: int = 5
) -> str
```

Search the web for information.

**Returns:** JSON string with `[{url, title, snippet}, ...]`

---

#### `fetch_url`

```python
async def fetch_url(
    url: str,
    timeout_seconds: int = 30
) -> str
```

Fetch content from a URL.

**Returns:** Page content as string

---

#### `summarize_text`

```python
async def summarize_text(
    text: str,
    max_length: int = 200
) -> str
```

Summarize a block of text.

**Returns:** Condensed summary

---

### Code Tools

#### `write_file`

```python
async def write_file(
    filename: str,
    content: str,
    language: str = "python"
) -> str
```

Write content to a virtual file.

**Returns:** JSON with `{filename, language, line_count, size_bytes, status}`

---

#### `read_file`

```python
async def read_file(filename: str) -> str
```

Read content from a virtual file.

---

#### `run_code`

```python
async def run_code(
    code: str,
    language: str = "python",
    timeout_ms: int = 5000
) -> str
```

Execute code with timeout.

**Returns:** JSON with `{stdout, stderr, exit_code, execution_time_ms}`

---

#### `analyze_code`

```python
async def analyze_code(
    code: str,
    check_type: str = "syntax"  # "syntax", "style", "complexity", "all"
) -> str
```

Analyze code for issues.

**Returns:** JSON with `{check_type, issues, suggestions, lines_analyzed}`

---

### Data Tools

#### `parse_data`

```python
async def parse_data(
    data: str,
    format_type: str = "auto"  # "auto", "csv", "json"
) -> str
```

Parse data from various formats.

**Returns:** JSON with `{format, row_count, column_count, columns, sample_rows}`

---

#### `calculate_stats`

```python
async def calculate_stats(
    data: str,
    column: str | None = None
) -> str
```

Calculate statistical measures.

**Returns:** JSON with `{column_name: {count, mean, median, std_dev, min, max}}`

---

#### `generate_chart`

```python
async def generate_chart(
    data: str,
    chart_type: str = "bar",  # "bar", "line", "pie"
    title: str = ""
) -> str
```

Generate chart configuration.

**Returns:** JSON with `{chart_type, title, data: {labels, values}, summary}`

---

## Module: `tracing`

Core tracing functionality.

### Functions

#### `get_tracer`

```python
def get_tracer(db_path: str = "traces.db") -> PydanticAITracer
```

Get or create a tracer instance.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `db_path` | `str` | `"traces.db"` | SQLite database path |

**Returns:** `PydanticAITracer` - Tracer instance

---

#### `get_collector`

```python
def get_collector(db_path: str = "traces.db") -> TraceCollector
```

Get or create a trace collector.

---

#### `print_trace`

```python
def print_trace(trace_id: str, db_path: str = "traces.db") -> None
```

Print a formatted trace summary.

---

#### `export_traces`

```python
def export_traces(
    output_path: str,
    db_path: str = "traces.db",
    **kwargs
) -> int
```

Export traces to a JSON file.

**Returns:** Number of traces exported

---

### Classes

#### `PydanticAITracer`

Main tracer class for managing traces and spans.

```python
class PydanticAITracer:
    def start_trace(
        self,
        name: str,
        user_id: str = None,
        session_id: str = None,
        request_id: str = None,
        metadata: dict = None
    ) -> Trace
    
    def end_trace(self, status: SpanStatus = SpanStatus.ok) -> Optional[Trace]
    
    def start_span(
        self,
        name: str,
        kind: SpanKind = SpanKind.internal,
        span_type: SpanType = None,
        attributes: dict = None
    ) -> Span
    
    def end_span(
        self,
        span: Span = None,
        status: SpanStatus = SpanStatus.ok,
        message: str = None
    ) -> Optional[Span]
    
    def add_event(self, name: str, attributes: dict = None) -> None
    
    def set_attribute(self, key: str, value: Any) -> None
    
    def record_exception(self, exception: Exception) -> None
    
    def get_current_trace_id(self) -> Optional[str]
    
    def get_current_span_id(self) -> Optional[str]
```

---

#### `TraceCollector`

SQLite-based trace storage.

```python
class TraceCollector:
    def create_trace(
        self,
        name: str,
        user_id: str = None,
        session_id: str = None,
        request_id: str = None,
        metadata: dict = None
    ) -> Trace
    
    def save_span(self, span: Span) -> None
    
    def complete_trace(self, trace: Trace) -> None
    
    def get_trace(self, trace_id: str) -> Optional[dict]
    
    def get_spans(self, trace_id: str) -> list[dict]
    
    def list_traces(
        self,
        user_id: str = None,
        session_id: str = None,
        limit: int = 100,
        offset: int = 0
    ) -> list[dict]
    
    def get_span_tree(self, trace_id: str) -> list[dict]
    
    def delete_trace(self, trace_id: str) -> bool
    
    def get_stats(self) -> dict[str, Any]
```

---

#### `TraceViewer`

Query and export utility for traces.

```python
class TraceViewer:
    def __init__(
        self,
        collector: TraceCollector = None,
        db_path: str = "traces.db"
    )
    
    def get_trace(self, trace_id: str) -> Optional[dict]
    
    def get_span_tree(self, trace_id: str) -> list[dict]
    
    def list_recent_traces(self, limit: int = 20) -> list[dict]
    
    def find_traces_by_user(self, user_id: str, limit: int = 50) -> list[dict]
    
    def find_traces_by_session(self, session_id: str, limit: int = 50) -> list[dict]
    
    def get_stats(self) -> dict[str, Any]
    
    def export_trace(self, trace_id: str, format: str = "json") -> Optional[str]
    
    def export_traces(
        self,
        output_path: str,
        user_id: str = None,
        session_id: str = None,
        limit: int = 1000
    ) -> int
    
    def print_trace_summary(self, trace_id: str) -> None
```

---

### Context Managers

#### `traced_agent`

```python
@contextmanager
def traced_agent(
    agent_name: str,
    model: str,
    user_id: str = None,
    session_id: str = None,
    tracer: PydanticAITracer = None
) -> Iterator[Span]
```

Context manager for tracing agent execution.

**Example:**
```python
with traced_agent("research", "minimax-m2.5", user_id="u1") as span:
    result = await agent.run("query")
    span.set_attribute("result.length", len(result.output))
```

---

#### `traced_tool`

```python
@contextmanager
def traced_tool(
    tool_name: str,
    arguments: dict,
    tracer: PydanticAITracer = None
) -> Iterator[Span]
```

Context manager for tracing tool calls.

**Example:**
```python
with traced_tool("search_web", {"query": "python"}) as span:
    results = await search_web("python")
    span.set_attribute("result.count", len(results))
```

---

### Span Models

#### `Span`

```python
class Span(BaseModel):
    id: str
    trace_id: str
    parent_id: Optional[str]
    name: str
    kind: SpanKind
    span_type: Optional[SpanType]
    start_time: int  # microseconds
    end_time: Optional[int]
    duration_us: Optional[int]
    attributes: dict[str, Any]
    status: SpanStatus
    status_message: Optional[str]
    events: list[dict[str, Any]]
    created_at: datetime
    
    def end(
        self,
        status: SpanStatus = SpanStatus.ok,
        message: str = None
    ) -> None
    
    def add_event(self, name: str, attributes: dict = None) -> None
    
    def set_attribute(self, key: str, value: Any) -> None
```

---

#### `Trace`

```python
class Trace(BaseModel):
    id: str
    name: str
    user_id: Optional[str]
    session_id: Optional[str]
    request_id: Optional[str]
    metadata: dict[str, Any]
    spans: list[Span]
    started_at: datetime
    completed_at: Optional[datetime]
    status: SpanStatus
    
    @property
    def total_duration_ms(self) -> float
    
    @property
    def span_count(self) -> int
```

---

### Enums

#### `SpanKind`

```python
class SpanKind(str, Enum):
    internal = "INTERNAL"
    client = "CLIENT"
    server = "SERVER"
    producer = "PRODUCER"
    consumer = "CONSUMER"
```

---

#### `SpanStatus`

```python
class SpanStatus(str, Enum):
    unset = "UNSET"
    ok = "OK"
    error = "ERROR"
```

---

#### `SpanType`

```python
class SpanType(str, Enum):
    agent_run = "agent.run"
    agent_stream = "agent.stream"
    tool_call = "tool.call"
    model_request = "model.request"
    model_response = "model.response"
    delegation = "agent.delegation"
```
