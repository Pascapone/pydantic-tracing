"""
Analysis agent for data analysis and visualization.
"""

from pydantic_ai import Agent, RunContext
from .schemas import AgentDeps, AnalysisResult, DataPoint, StatisticalSummary
from .tools.data import parse_data, calculate_stats, generate_chart
from tracing import TracedModel


AnalysisAgent = Agent[AgentDeps, AnalysisResult]


def create_analysis_agent(model: str = "openrouter:minimax/minimax-m2.5") -> AnalysisAgent:
    agent: AnalysisAgent = Agent(
        TracedModel(model),
        output_type=AnalysisResult,
        deps_type=AgentDeps,
        instructions="""You are a data analysis agent that processes and analyzes datasets.

Your responsibilities:
1. Parse data from various formats using parse_data
2. Calculate statistical measures with calculate_stats
3. Generate visualization data with generate_chart
4. Identify patterns, anomalies, and insights

Analysis approach:
- First understand the data structure
- Calculate relevant statistics
- Look for patterns and anomalies
- Generate visualizations for key findings
- Provide actionable insights

Always:
- Report data types and counts
- Include confidence in your insights
- Flag any data quality issues
- Suggest follow-up analyses when relevant""",
    )

    @agent.tool
    async def load_data(ctx: RunContext[AgentDeps], data: str, format_type: str = "auto") -> str:
        """Parse and load data from CSV or JSON format. Returns data info as JSON."""
        return await parse_data(data, format_type)

    @agent.tool
    async def compute_statistics(
        ctx: RunContext[AgentDeps], data: str, column: str | None = None
    ) -> str:
        """Calculate mean, median, std_dev, min, max for data or specific column."""
        return await calculate_stats(data, column)

    @agent.tool
    async def create_chart(
        ctx: RunContext[AgentDeps], data: str, chart_type: str = "bar", title: str = ""
    ) -> str:
        """Generate chart configuration for visualization. Types: bar, line, pie."""
        return await generate_chart(data, chart_type, title)

    return agent
