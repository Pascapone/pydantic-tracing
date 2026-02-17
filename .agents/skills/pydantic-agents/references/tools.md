# Tools Reference

Advanced tool calling patterns for Pydantic AI agents.

## Tool Decorators

| Decorator | Use When |
|-----------|----------|
| `@agent.tool` | Tool needs `RunContext` (deps, usage, messages) |
| `@agent.tool_plain` | Standalone function, no context needed |

```python
from pydantic_ai import Agent, RunContext

agent = Agent('openrouter:anthropic/claude-3.5-sonnet', deps_type=dict)

@agent.tool
async def query_db(ctx: RunContext[dict], table: str) -> list:
    """Query a database table. Returns rows as list of dicts."""
    return ctx.deps['db'].fetch_all(f"SELECT * FROM {table}")

@agent.tool_plain
def format_date(timestamp: int) -> str:
    """Convert Unix timestamp to ISO date string."""
    from datetime import datetime
    return datetime.fromtimestamp(timestamp).isoformat()
```

## Tool Schema Generation

Pydantic AI extracts schemas from function signatures and docstrings.

```python
@agent.tool_plain
def search(
    query: str,
    limit: int = 10,
    filters: dict[str, str] | None = None
) -> list[dict]:
    """Search the knowledge base.
    
    Args:
        query: Search query string
        limit: Maximum results to return (default 10)
        filters: Optional key-value filters
    
    Returns:
        List of matching documents with title and content
    """
    ...
```

Supported docstring formats: Google, NumPy, Sphinx.

## ModelRetry for Error Recovery

Ask the model to retry with different arguments.

```python
from pydantic_ai import ModelRetry

@agent.tool
async def execute_sql(ctx: RunContext[AppDeps], query: str) -> list:
    """Execute a SQL query safely."""
    try:
        return await ctx.deps.db.execute(query)
    except SyntaxError as e:
        raise ModelRetry(f"SQL syntax error: {e}. Fix the query and try again.")
    except PermissionError:
        raise ModelRetry("Query not allowed. Only SELECT statements are permitted.")
```

## Dynamic Tools

Conditionally enable tools or modify their schema.

```python
from pydantic_ai import Tool
from pydantic_ai.tools import ToolDefinition

async def prepare_admin_tool(ctx: RunContext, tool_def: ToolDefinition) -> ToolDefinition | None:
    """Only show admin tools to admin users."""
    if ctx.deps.get('role') != 'admin':
        return None  # Tool not available
    return tool_def

admin_agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    tools=[Tool(delete_user, prepare=prepare_admin_tool)]
)
```

## Built-in Tools

Tools provided by LLM providers.

```python
from pydantic_ai import Agent
from pydantic_ai.builtin_tools import WebSearchTool, CodeExecutionTool

# Web search (Anthropic, OpenAI)
agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    builtin_tools=[WebSearchTool()],
    instructions="Search the web for current information."
)

# Code execution (Anthropic)
agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    builtin_tools=[CodeExecutionTool()],
    instructions="Run Python code to solve problems."
)
```

## Toolsets

Group tools for reuse across agents.

```python
from pydantic_ai.toolsets import FunctionToolset

db_tools = FunctionToolset([
    query_table,
    insert_record,
    update_record,
])

agent = Agent('openrouter:openai/gpt-4o', toolsets=[db_tools])
```

## MCP Toolsets

Use Model Context Protocol servers as tool sources.

```python
from pydantic_ai.mcp import MCPServer

mcp_server = MCPServer('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/data'])

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=[mcp_server]
)
```

See [mcp.md](mcp.md) for full MCP integration details.

## Tool Output Options

Return rich content from tools.

```python
from pydantic_ai.tools import ToolOutput

@agent.tool
async def get_image(ctx: RunContext, path: str) -> ToolOutput:
    """Retrieve an image file."""
    from pydantic_ai import BinaryContent
    
    with open(path, 'rb') as f:
        data = f.read()
    
    return ToolOutput(
        content=BinaryContent(data=data, media_type='image/png'),
        metadata={'filename': path}
    )
```

## Tool Execution Control

Limit or control tool execution.

```python
from pydantic_ai import Agent, UsageLimits

agent = Agent('openrouter:openai/gpt-4o')

result = agent.run_sync(
    "Complex task",
    usage_limits=UsageLimits(
        tool_calls_limit=10,  # Max tool calls per run
        request_limit=5,       # Max LLM requests
        total_tokens_limit=10000
    )
)
```

## Testing Tools

Mock tool behavior in tests.

```python
from pydantic_ai.models.function import FunctionModel

def mock_tool_call(messages, info):
    # Custom tool response logic
    return ModelResponse(parts=[TextPart("Mocked result")])

async def test_with_mock():
    with agent.override(model=FunctionModel(mock_tool_call)):
        result = await agent.run("test")
```

See [testing.md](testing.md) for more testing patterns.
