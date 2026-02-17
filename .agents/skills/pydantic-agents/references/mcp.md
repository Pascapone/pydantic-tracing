# Model Context Protocol (MCP) Reference

Integrate MCP servers with Pydantic AI agents.

## What is MCP?

MCP (Model Context Protocol) is a standard for AI applications to connect to external tools and services. Pydantic AI can act as an MCP client or server.

## MCP Client

Connect agents to MCP servers for tool access.

### Stdio Transport (Local Servers)

```python
from pydantic_ai.mcp import MCPServer

# Connect to local MCP server
filesystem_server = MCPServer(
    'npx',
    ['-y', '@modelcontextprotocol/server-filesystem', '/data']
)

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=[filesystem_server]
)

# Tools from MCP server are automatically available
result = await agent.run("List files in /data")
```

### SSE Transport (Remote Servers)

```python
from pydantic_ai.mcp import MCPServer

remote_server = MCPServer(
    'https://api.example.com/mcp',
    transport='sse'
)

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=[remote_server]
)
```

### Connection Lifecycle

```python
async def run_with_mcp():
    # Server connects on first tool call
    async with agent.run_stream("Read file.txt") as result:
        async for text in result.stream_text():
            print(text)
    
    # Or manage lifecycle explicitly
    await filesystem_server.connect()
    try:
        result = await agent.run("Process files")
    finally:
        await filesystem_server.disconnect()
```

## Available MCP Servers

Common servers from [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers):

| Server | Tools Provided |
|--------|---------------|
| `@modelcontextprotocol/server-filesystem` | File read/write |
| `@modelcontextprotocol/server-postgres` | SQL queries |
| `@modelcontextprotocol/server-sqlite` | SQLite operations |
| `@modelcontextprotocol/server-github` | GitHub API |
| `@modelcontextprotocol/server-brave-search` | Web search |
| `@modelcontextprotocol/server-slack` | Slack integration |

## FastMCP Integration

Use [FastMCP](https://gofastmcp.com/) for custom MCP servers.

### Using FastMCP Client

```python
from pydantic_ai.mcp import FastMCPToolset
from fastmcp import FastMCP

# Connect to FastMCP server
mcp = FastMCP("my-tools")

@mcp.tool()
def my_custom_tool(query: str) -> str:
    """My custom tool description."""
    return process(query)

# Use in agent
agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=[FastMCPToolset(mcp)]
)
```

### FastMCP Server with Pydantic AI Agent

```python
from fastmcp import FastMCP
from pydantic_ai import Agent

mcp = FastMCP("agent-server")
agent = Agent('openrouter:anthropic/claude-3.5-sonnet')

@mcp.tool()
async def ask_agent(question: str) -> str:
    """Ask the AI agent a question."""
    result = await agent.run(question)
    return result.output

# Run as MCP server
if __name__ == "__main__":
    mcp.run()
```

## Combining MCP with Other Tools

Mix MCP tools with native tools:

```python
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServer

@agent.tool
async def native_tool(ctx, data: str) -> str:
    """Custom tool alongside MCP tools."""
    return process(data)

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=[
        MCPServer('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/data']),
        MCPServer('npx', ['-y', '@modelcontextprotocol/server-postgres', 'dbUrl']),
    ]
)
```

## Toolsets

Group and manage tool sources.

```python
from pydantic_ai.toolsets import CombinedToolset, FunctionToolset

# Combine multiple sources
agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=CombinedToolset([
        FunctionToolset([my_tool1, my_tool2]),
        MCPServer('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/data']),
    ])
)
```

## Requiring Tool Approval

Add human-in-the-loop for sensitive operations:

```python
from pydantic_ai.mcp import MCPServer
from pydantic_ai.toolsets import WithApproval

server = MCPServer('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/data'])

agent = Agent(
    'openrouter:anthropic/claude-3.5-sonnet',
    toolsets=[WithApproval(server, require_approval=['write_file', 'delete_file'])]
)

# Tools requiring approval will pause execution
async def run_with_approval():
    async with agent.run_stream("Delete old files") as result:
        async for event in result.stream_events():
            if hasattr(event, 'requires_approval'):
                # Prompt user for approval
                approved = input(f"Allow {event.tool_name}? (y/n): ")
                await event.respond(approved.lower() == 'y')
```

## MCP Server Implementation

Create your own MCP server for agent tools:

```python
from fastmcp import FastMCP

mcp = FastMCP("my-agent-tools")

@mcp.tool()
async def search_database(query: str) -> list[dict]:
    """Search the company database."""
    return await db.search(query)

@mcp.tool()
async def send_notification(message: str, channel: str) -> bool:
    """Send a notification to a Slack channel."""
    return await slack.send(channel, message)

@mcp.resource("config://settings")
def get_config() -> dict:
    """Agent configuration."""
    return {"model": "claude", "max_tokens": 4096}

if __name__ == "__main__":
    mcp.run()  # Start MCP server
```

## Troubleshooting

### Common Issues

1. **Server not found**: Ensure npm/npx is installed and the package exists
2. **Connection timeout**: Check network access for remote servers
3. **Tool not available**: Verify tool names match MCP server definitions

### Debug Mode

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# MCP connections will log details
```
