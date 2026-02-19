"""
Common utilities for creating traced agents.
"""

from typing import Any, Union

from pydantic_ai import Agent
from pydantic_ai.models import Model

from tracing import TracedModel


def create_traced_agent(model: Union[str, Model], **kwargs) -> Agent:
    """
    Create an agent with automatic model tracing.

    All model requests and responses will be traced with proper
    nesting support for multi-agent delegation scenarios.

    Args:
        model: A model name string (e.g., "openrouter:minimax/minimax-m2.5")
               or a Model instance
        **kwargs: Additional arguments passed to Agent constructor

    Returns:
        Agent instance with traced model

    Usage:
        from agents.common import create_traced_agent
        from agents.schemas import ResearchReport, AgentDeps

        agent = create_traced_agent(
            "openrouter:minimax/minimax-m2.5",
            output_type=ResearchReport,
            deps_type=AgentDeps,
        )
    """
    return Agent(TracedModel(model), **kwargs)


def wrap_model_for_tracing(model: Union[str, Model]) -> TracedModel:
    """
    Wrap a model for tracing.

    Use this when you need to pass a traced model to an existing
    agent or when you want to wrap models dynamically.

    Args:
        model: A model name string or Model instance

    Returns:
        TracedModel instance

    Usage:
        from pydantic_ai import Agent
        from agents.common import wrap_model_for_tracing

        agent = Agent(
            wrap_model_for_tracing("openrouter:minimax/minimax-m2.5"),
            output_type=MyOutput,
        )
    """
    return TracedModel(model)
