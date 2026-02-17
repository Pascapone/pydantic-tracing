"""
Web-related tools for research agent.
"""
import asyncio
import json
import time
from typing import Any


_web_search_db: dict[str, list[dict[str, Any]]] = {
    "python": [
        {"url": "https://docs.python.org/3/", "title": "Python 3 Documentation", "snippet": "Official Python 3 documentation with tutorials and API reference."},
        {"url": "https://realpython.com/", "title": "Real Python", "snippet": "Python tutorials, articles, and resources for developers."},
        {"url": "https://pypi.org/", "title": "PyPI", "snippet": "Python Package Index - the official repository for Python packages."},
    ],
    "ai agents": [
        {"url": "https://ai.pydantic.dev/", "title": "Pydantic AI", "snippet": "Build production-grade AI agents with Pydantic AI framework."},
        {"url": "https://langchain.com/", "title": "LangChain", "snippet": "Framework for developing applications powered by language models."},
        {"url": "https://openai.com/api/", "title": "OpenAI API", "snippet": "API for accessing GPT models and other AI capabilities."},
    ],
    "tracing": [
        {"url": "https://opentelemetry.io/", "title": "OpenTelemetry", "snippet": "Observability framework for distributed tracing and metrics."},
        {"url": "https://ai.pydantic.dev/logfire/", "title": "Pydantic Logfire", "snippet": "Observability platform for Pydantic AI agents."},
    ],
}


async def search_web(query: str, max_results: int = 5) -> str:
    """
    Search the web for information related to the query.
    
    Args:
        query: The search query string
        max_results: Maximum number of results to return (1-10)
    
    Returns:
        JSON string containing search results with url, title, and snippet
    """
    await asyncio.sleep(0.3)
    
    query_lower = query.lower()
    results = []
    
    for keyword, entries in _web_search_db.items():
        if keyword in query_lower:
            results.extend(entries)
    
    if not results:
        results = [
            {
                "url": f"https://example.com/search?q={query}",
                "title": f"Search results for: {query}",
                "snippet": f"General information about {query}.",
            }
        ]
    
    results = results[:max_results]
    return json.dumps(results)


async def fetch_url(url: str, timeout_seconds: int = 30) -> str:
    """
    Fetch content from a URL.
    
    Args:
        url: The URL to fetch
        timeout_seconds: Request timeout in seconds
    
    Returns:
        The page content as a string (simulated)
    """
    await asyncio.sleep(0.5)
    
    if "docs.python.org" in url:
        return """
        Python 3 Documentation
        
        Python is a programming language that lets you work quickly
        and integrate systems more effectively. Key features include:
        - Easy to learn syntax
        - Dynamic typing
        - Extensive standard library
        - Object-oriented programming support
        """
    elif "pydantic" in url:
        return """
        Pydantic AI Documentation
        
        Build production-grade AI agents with type safety and validation.
        Features:
        - Structured outputs with Pydantic models
        - Tool calling with automatic validation
        - Multi-agent orchestration
        - OpenTelemetry tracing support
        """
    else:
        return f"Content from {url}: This is simulated content for the URL."


async def summarize_text(text: str, max_length: int = 200) -> str:
    """
    Summarize a block of text.
    
    Args:
        text: The text to summarize
        max_length: Maximum length of the summary in characters
    
    Returns:
        A condensed summary of the text
    """
    await asyncio.sleep(0.2)
    
    sentences = text.replace("\n", " ").split(". ")
    if len(sentences) <= 2:
        summary = text.strip()[:max_length]
    else:
        summary = ". ".join(sentences[:2]) + "."
        if len(summary) > max_length:
            summary = summary[:max_length - 3] + "..."
    
    return summary.strip()
