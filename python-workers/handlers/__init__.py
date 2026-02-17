"""
Built-in job handlers for common AI and data processing tasks.
Extend this module to add custom handlers for your application.
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List
from .context import JobContext


class BaseHandler(ABC):
    """Base class for all job handlers."""

    @property
    @abstractmethod
    def job_type(self) -> str:
        """Return the job type this handler processes."""
        pass

    @abstractmethod
    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        """Execute the job. Override this method in subclasses."""
        pass

    async def validate_payload(self, payload: Dict[str, Any]) -> Optional[str]:
        """Validate the payload. Return error message if invalid, None if valid."""
        return None


class OpenAITextHandler(BaseHandler):
    """Handler for OpenAI text generation."""

    job_type = "ai.openai.text"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    @property
    def job_type(self) -> str:
        return "ai.openai.text"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)

        model = payload.get("model", "gpt-4-turbo-preview")
        messages = []

        if payload.get("systemPrompt"):
            messages.append({"role": "system", "content": payload["systemPrompt"]})

        messages.append({"role": "user", "content": payload["prompt"]})

        ctx.progress(10, "Sending request to OpenAI...", "api_call")

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=payload.get("temperature", 0.7),
            max_tokens=payload.get("maxTokens", 2000),
            stop=payload.get("stopSequences"),
        )

        ctx.progress(100, "Complete")

        return {
            "text": response.choices[0].message.content,
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
            "finish_reason": response.choices[0].finish_reason,
        }


class AnthropicTextHandler(BaseHandler):
    """Handler for Anthropic Claude text generation."""

    job_type = "ai.anthropic.text"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    @property
    def job_type(self) -> str:
        return "ai.anthropic.text"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=self.api_key)

        model = payload.get("model", "claude-3-opus-20240229")

        ctx.progress(10, "Sending request to Anthropic...", "api_call")

        response = await client.messages.create(
            model=model,
            max_tokens=payload.get("maxTokens", 4096),
            temperature=payload.get("temperature", 0.7),
            system=payload.get("systemPrompt"),
            messages=[{"role": "user", "content": payload["prompt"]}],
        )

        ctx.progress(100, "Complete")

        return {
            "text": response.content[0].text,
            "model": response.model,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            "stop_reason": response.stop_reason,
        }


class BatchProcessHandler(BaseHandler):
    """Handler for batch processing of items."""

    @property
    def job_type(self) -> str:
        return "data.batch"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        items = payload.get("items", [])
        batch_size = payload.get("batchSize", 10)
        process_fn = payload.get("processFunction", "default")

        results = []
        errors = []
        total = len(items)

        for i in range(0, total, batch_size):
            batch = items[i : i + batch_size]
            batch_num = i // batch_size + 1

            progress = 10 + int((i / total) * 80)
            ctx.progress(progress, f"Processing batch {batch_num}...", f"batch_{batch_num}")

            # Process each item in batch
            for item in batch:
                try:
                    # Simulate processing - replace with actual logic
                    await asyncio.sleep(0.1)
                    results.append({"input": item, "output": f"processed_{item}"})
                except Exception as e:
                    errors.append({"input": item, "error": str(e)})

        ctx.progress(100, "Complete")

        return {
            "total": total,
            "processed": len(results),
            "errors": len(errors),
            "results": results,
            "error_details": errors if errors else None,
        }


class DataPipelineHandler(BaseHandler):
    """Handler for multi-step data pipelines."""

    @property
    def job_type(self) -> str:
        return "data.pipeline"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        steps = payload.get("steps", [])
        initial_data = payload.get("input")

        current_data = initial_data
        step_results = []
        total_steps = len(steps)

        for i, step in enumerate(steps):
            step_name = step.get("name", f"step_{i}")
            step_type = step.get("type")
            step_config = step.get("config", {})

            progress = int((i / total_steps) * 90)
            ctx.progress(progress, f"Executing: {step_name}", step_name)

            # Execute step based on type
            if step_type == "transform":
                # Apply transformation
                current_data = self._apply_transform(current_data, step_config)
            elif step_type == "filter":
                # Apply filter
                current_data = self._apply_filter(current_data, step_config)
            elif step_type == "aggregate":
                # Apply aggregation
                current_data = self._apply_aggregate(current_data, step_config)
            else:
                # Custom step - simulate
                await asyncio.sleep(0.2)

            step_results.append(
                {
                    "step": step_name,
                    "type": step_type,
                    "output_rows": len(current_data) if isinstance(current_data, list) else 1,
                }
            )

        ctx.progress(100, "Pipeline complete")

        return {
            "input_rows": len(initial_data) if isinstance(initial_data, list) else 1,
            "output_rows": len(current_data) if isinstance(current_data, list) else 1,
            "steps_executed": len(step_results),
            "step_results": step_results,
            "output": current_data,
        }

    def _apply_transform(self, data: Any, config: Dict[str, Any]) -> Any:
        # Placeholder for transformation logic
        return data

    def _apply_filter(self, data: Any, config: Dict[str, Any]) -> Any:
        if isinstance(data, list):
            return [item for item in data if item]
        return data

    def _apply_aggregate(self, data: Any, config: Dict[str, Any]) -> Any:
        if isinstance(data, list):
            return {"count": len(data)}
        return data


# Handler registry for easy registration
BUILTIN_HANDLERS = [
    OpenAITextHandler,
    AnthropicTextHandler,
    BatchProcessHandler,
    DataPipelineHandler,
]


def register_handlers(registry):
    """Register all built-in handlers with the given registry."""
    for handler_class in BUILTIN_HANDLERS:
        handler = handler_class()
        registry.register(handler)
