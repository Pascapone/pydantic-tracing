# Agent System Documentation

This document covers the multi-agent system designed to test pydantic-ai tracing capabilities.

## Overview

The agent system provides a comprehensive test bed for tracing by exercising:

- **Agent runs**: Sync, async, and streaming execution
- **Tool calling**: Multiple tools with complex payloads
- **Structured outputs**: Pydantic models for type safety
- **Agent delegation**: Agents calling other agents
- **Error handling**: ModelRetry and error recovery
- **Message history**: Multi-turn conversations

## Architecture

```
                    +-------------------+
                    |   Orchestrator    |
                    |     Agent         |
                    +-------------------+
                            |
           +----------------+----------------+
           |                |                |
           v                v                v
    +-----------+    +-----------+    +-------------+
    | Research  |    |   Code    |    |  Analysis   |
    |  Agent    |    |  Agent    |    |   Agent     |
    +-----------+    +-----------+    +-------------+
           |                |                |
           v                v                v
    +-----------+    +-----------+    +-------------+
    | Web Tools |    |Code Tools |    | Data Tools  |
    +-----------+    +-----------+    +-------------+
```

---

## Orchestrator Agent

The orchestrator coordinates sub-agents for complex multi-step tasks.

### Purpose

- Analyze incoming tasks
- Determine which sub-agents are needed
- Delegate tasks in the correct order
- Aggregate results into a final answer
- Track token usage and timing

### Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `delegate_research` | Delegate to research agent | JSON with summary, findings, confidence |
| `delegate_coding` | Delegate to coding agent | JSON with files, explanation, execution |
| `delegate_analysis` | Delegate to analysis agent | JSON with insights, statistics, charts |

### Output Schema

```python
class TaskResult(BaseModel):
    task: str                          # Original task description
    status: TaskStatus                 # pending, in_progress, completed, failed
    subtasks: list[SubTaskResult]      # Results from delegated agents
    final_answer: str                  # Synthesized answer
    total_tokens_used: int             # Aggregate token count
    total_duration_ms: int             # Total execution time
```

### Example

```python
from agents import create_orchestrator, AgentDeps

orchestrator = create_orchestrator()
deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")

result = await orchestrator.run(
    "Research Python async best practices, write a demo function, and analyze its structure.",
    deps=deps
)

print(f"Status: {result.output.status}")
print(f"Subtasks: {len(result.output.subtasks)}")
print(f"Answer: {result.output.final_answer}")
```

---

## Research Agent

Gathers and synthesizes information from web sources.

### Purpose

- Search for relevant information
- Fetch content from URLs
- Summarize long texts
- Compile findings into structured reports

### Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `web_search` | Search the web | `query: str`, `max_results: int` |
| `get_url_content` | Fetch URL content | `url: str` |
| `create_summary` | Summarize text | `text: str`, `max_length: int` |

### Output Schema

```python
class ResearchSource(BaseModel):
    url: str
    title: str
    snippet: str
    relevance_score: float  # 0.0 - 1.0

class ResearchReport(BaseModel):
    query: str                      # Original search query
    summary: str                    # Synthesized summary
    sources: list[ResearchSource]   # List of sources used
    key_findings: list[str]         # Bullet-point findings
    confidence: float               # 0.0 - 1.0
```

### Example

```python
from agents import create_research_agent, AgentDeps

research = create_research_agent()
deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")

result = await research.run(
    "What are the best practices for pydantic-ai agents?",
    deps=deps
)

print(f"Summary: {result.output.summary}")
print(f"Findings: {result.output.key_findings}")
print(f"Confidence: {result.output.confidence:.0%}")
```

---

## Coding Agent

Generates, executes, and analyzes code.

### Purpose

- Write code in multiple languages
- Read existing code files
- Execute code safely with timeout limits
- Analyze code for issues and improvements

### Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_file` | Create/update a file | `filename: str`, `content: str`, `language: str` |
| `read_existing_file` | Read file contents | `filename: str` |
| `execute_code` | Run code with timeout | `code: str`, `language: str`, `timeout_ms: int` |
| `check_code` | Analyze code quality | `code: str`, `check_type: str` |

### Output Schema

```python
class CodeFile(BaseModel):
    filename: str
    language: str
    content: str
    line_count: int

class CodeExecutionResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: int

class CodeResult(BaseModel):
    files: list[CodeFile]                    # Generated files
    execution: Optional[CodeExecutionResult] # Execution results (if run)
    explanation: str                         # What the code does
    suggestions: list[str]                   # Improvement suggestions
```

### Example

```python
from agents import create_coding_agent, AgentDeps

coding = create_coding_agent()
deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")

result = await coding.run(
    "Write a Python function to calculate fibonacci numbers with memoization",
    deps=deps
)

for file in result.output.files:
    print(f"File: {file.filename} ({file.line_count} lines)")
    print(file.content)
```

---

## Analysis Agent

Analyzes data and generates visualizations.

### Purpose

- Parse data from various formats (CSV, JSON)
- Calculate statistical measures
- Identify patterns and anomalies
- Generate chart configurations

### Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `load_data` | Parse CSV/JSON data | `data: str`, `format_type: str` |
| `compute_statistics` | Calculate stats | `data: str`, `column: str | None` |
| `create_chart` | Generate chart config | `data: str`, `chart_type: str`, `title: str` |

### Output Schema

```python
class StatisticalSummary(BaseModel):
    count: int
    mean: float
    median: float
    std_dev: float
    min: float
    max: float

class DataPoint(BaseModel):
    label: str
    value: float
    metadata: dict[str, Any]

class AnalysisResult(BaseModel):
    data_type: str                            # Type of data analyzed
    row_count: int                            # Number of rows
    column_count: Optional[int]               # Number of columns (tabular)
    statistics: dict[str, StatisticalSummary] # Per-column stats
    insights: list[str]                       # Key insights
    anomalies: list[dict[str, Any]]           # Detected anomalies
    chart_data: Optional[list[DataPoint]]     # Chart visualization data
```

### Example

```python
from agents import create_analysis_agent, AgentDeps

analysis = create_analysis_agent()
deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")

data = "name,value\nAlice,100\nBob,200\nCharlie,150"

result = await analysis.run(
    f"Analyze this data: {data}",
    deps=deps
)

print(f"Rows: {result.output.row_count}")
print(f"Insights: {result.output.insights}")
for col, stats in result.output.statistics.items():
    print(f"{col}: mean={stats.mean}, median={stats.median}")
```

---

## Tool Reference

### Web Tools (`agents.tools.web`)

```python
async def search_web(query: str, max_results: int = 5) -> str:
    """Search the web. Returns JSON with url, title, snippet."""

async def fetch_url(url: str, timeout_seconds: int = 30) -> str:
    """Fetch content from a URL. Returns page content."""

async def summarize_text(text: str, max_length: int = 200) -> str:
    """Summarize text. Returns condensed summary."""
```

### Code Tools (`agents.tools.code`)

```python
async def write_file(filename: str, content: str, language: str = "python") -> str:
    """Write to virtual file. Returns JSON with file info."""

async def read_file(filename: str) -> str:
    """Read from virtual file. Returns content."""

async def run_code(code: str, language: str = "python", timeout_ms: int = 5000) -> str:
    """Execute code. Returns JSON with stdout, stderr, exit_code."""

async def analyze_code(code: str, check_type: str = "syntax") -> str:
    """Analyze code. check_type: syntax, style, complexity, all."""
```

### Data Tools (`agents.tools.data`)

```python
async def parse_data(data: str, format_type: str = "auto") -> str:
    """Parse CSV/JSON. Returns JSON with row_count, columns, sample."""

async def calculate_stats(data: str, column: str | None = None) -> str:
    """Calculate statistics. Returns JSON with mean, median, std_dev, etc."""

async def generate_chart(data: str, chart_type: str = "bar", title: str = "") -> str:
    """Generate chart config. Types: bar, line, pie. Returns chart JSON."""
```

---

## Schema Reference

All schemas are defined in `agents/schemas.py`:

### Enums

```python
class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"

class AgentType(str, Enum):
    orchestrator = "orchestrator"
    research = "research"
    coding = "coding"
    analysis = "analysis"
```

### Dependencies

```python
class AgentDeps(BaseModel):
    user_id: str
    session_id: str
    request_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)
```

### Results

- `TaskResult` - Orchestrator output
- `ResearchReport` - Research agent output
- `CodeResult` - Coding agent output
- `AnalysisResult` - Analysis agent output

---

## Customization

### Using Different Models

```python
# Default: MiniMax M2.5 via OpenRouter
agent = create_research_agent()

# Custom model
agent = create_research_agent(model="openrouter:anthropic/claude-3.5-sonnet")
agent = create_coding_agent(model="openrouter:openai/gpt-4o")
```

### Adding Custom Tools

```python
from pydantic_ai import Agent, RunContext
from agents.schemas import AgentDeps

agent = Agent("openrouter:minimax/minimax-m2.5", deps_type=AgentDeps)

@agent.tool
async def my_custom_tool(ctx: RunContext[AgentDeps], param: str) -> str:
    """Tool description goes here."""
    return f"Result: {param}"
```
