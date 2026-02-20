"""
Search agent for executing web searches and retrieving web page contents.
"""

from pydantic_ai import Agent, RunContext
from .schemas import AgentDeps, SearchReport, ResearchSource
from .tools.web import search_web, fetch_url
from tracing import TracedModel


SearchAgent = Agent[AgentDeps, SearchReport]


def create_search_agent(model: str = "openrouter:minimax/minimax-m2.5") -> SearchAgent:
    agent: SearchAgent = Agent(
        TracedModel(model),
        output_type=SearchReport,
        deps_type=AgentDeps,
        instructions="""You are a search agent that executes web searches and reads pages.

Your responsibilities:
1. Search for relevant information using the search_web tool
2. Fetch and read content from URLs using fetch_url
3. Compile findings into a structured SearchReport

Always:
- Verify information from multiple sources when possible
- Include source URLs in your report
- Extract key findings as bullet points""",
    )

    @agent.tool
    async def web_search(ctx: RunContext[AgentDeps], query: str, max_results: int = 5) -> str:
        """Search the web for information. Returns JSON with results."""
        return await search_web(query, max_results)

    @agent.tool
    async def get_url_content(ctx: RunContext[AgentDeps], url: str) -> str:
        """Fetch and return content from a URL."""
        return await fetch_url(url)

    return agent
