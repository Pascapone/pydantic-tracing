"""
Research agent for web search and information gathering.
"""

from pydantic_ai import Agent, RunContext
from .schemas import AgentDeps, ResearchReport, ResearchSource
from .tools.web import search_web, fetch_url, summarize_text
from tracing import TracedModel


ResearchAgent = Agent[AgentDeps, ResearchReport]


def create_research_agent(model: str = "openrouter:minimax/minimax-m2.5") -> ResearchAgent:
    agent: ResearchAgent = Agent(
        TracedModel(model),
        output_type=ResearchReport,
        deps_type=AgentDeps,
        instructions="""You are a research agent that gathers and synthesizes information.

Your responsibilities:
1. Search for relevant information using the search_web tool
2. Fetch and read content from URLs using fetch_url
3. Summarize long texts using summarize_text
4. Compile findings into a structured ResearchReport

Always:
- Verify information from multiple sources when possible
- Include source URLs in your report
- Rate your confidence based on source quality and quantity
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

    @agent.tool
    async def create_summary(ctx: RunContext[AgentDeps], text: str, max_length: int = 200) -> str:
        """Summarize a block of text to make it more manageable."""
        return await summarize_text(text, max_length)

    return agent
