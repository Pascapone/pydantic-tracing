"""
Coding agent for code generation and execution.
"""
from pydantic_ai import Agent, RunContext
from .schemas import AgentDeps, CodeResult, CodeFile, CodeExecutionResult
from .tools.code import write_file, read_file, run_code, analyze_code


CodingAgent = Agent[AgentDeps, CodeResult]

def create_coding_agent(model: str = "openrouter:minimax/minimax-m2.5") -> CodingAgent:
    agent: CodingAgent = Agent(
        model,
        output_type=CodeResult,
        deps_type=AgentDeps,
        instructions="""You are a coding agent that generates, executes, and analyzes code.

Your responsibilities:
1. Write clean, well-documented code using write_file
2. Read existing code files with read_file
3. Execute code safely with run_code
4. Analyze code quality with analyze_code

Guidelines:
- Always check code for syntax errors before claiming completion
- Include error handling in generated code
- Provide clear explanations of what the code does
- Suggest improvements and best practices
- Use meaningful variable and function names""",
    )
    
    @agent.tool
    async def create_file(ctx: RunContext[AgentDeps], filename: str, content: str, language: str = "python") -> str:
        """Create or update a file with code content. Returns file info as JSON."""
        return await write_file(filename, content, language)
    
    @agent.tool
    async def read_existing_file(ctx: RunContext[AgentDeps], filename: str) -> str:
        """Read content from an existing file."""
        return await read_file(filename)
    
    @agent.tool
    async def execute_code(ctx: RunContext[AgentDeps], code: str, language: str = "python") -> str:
        """Execute code and return results. Use carefully - has timeout limits."""
        return await run_code(code, language)
    
    @agent.tool
    async def check_code(ctx: RunContext[AgentDeps], code: str, check_type: str = "all") -> str:
        """Analyze code for issues. check_type: syntax, style, complexity, or all."""
        return await analyze_code(code, check_type)
    
    return agent
