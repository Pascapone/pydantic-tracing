#!/usr/bin/env python3
"""
Main Python worker for processing jobs from BullMQ.
Supports async operations for AI model queries and complex data processing.
"""

import asyncio
import json
import sys
import os
import traceback
from datetime import datetime
from typing import Any, Dict, Optional, Callable, Awaitable
from pathlib import Path
from abc import ABC, abstractmethod
import time


class JobContext:
    def __init__(self, job_id: str, input_path: str, output_path: str):
        self.job_id = job_id
        self.input_path = input_path
        self.output_path = output_path
        self._progress = 0
        self._step: Optional[str] = None
        self._metadata: Dict[str, Any] = {}

    def progress(
        self, percentage: int, message: Optional[str] = None, step: Optional[str] = None
    ) -> None:
        self._progress = max(0, min(100, percentage))
        self._step = step or self._step
        self._send_message(
            "progress",
            {
                "percentage": self._progress,
                "message": message,
                "step": self._step,
            },
        )

    def log(
        self,
        message: str,
        level: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._send_message(
            "log",
            {
                "level": level,
                "message": message,
                "metadata": metadata,
            },
        )

    def _send_message(self, msg_type: str, payload: Any) -> None:
        message = {
            "type": msg_type,
            "jobId": self.job_id,
            "timestamp": int(time.time() * 1000),
            "payload": payload,
        }
        print(json.dumps(message), flush=True)

    def heartbeat(self) -> None:
        self._send_message("heartbeat", {"timestamp": int(time.time() * 1000)})


class JobHandler(ABC):
    @abstractmethod
    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        pass

    @property
    @abstractmethod
    def job_type(self) -> str:
        pass


class AIGenerateTextHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.generate_text"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        model = payload.get("model", "gpt-4")
        prompt = payload.get("prompt", "")
        system_prompt = payload.get("systemPrompt")
        temperature = payload.get("temperature", 0.7)
        max_tokens = payload.get("maxTokens", 2000)

        ctx.progress(10, "Initializing AI model...", "init")

        # Simulate API call - replace with actual AI SDK calls
        await asyncio.sleep(0.5)

        ctx.progress(30, "Sending prompt to model...", "generation")

        # Placeholder for actual AI integration
        # In production, use: openai, anthropic, etc.
        result_text = (
            f"[Simulated response from {model}] Generated text for: {prompt[:100]}..."
        )

        await asyncio.sleep(1)
        ctx.progress(80, "Processing response...", "postprocessing")

        usage = {
            "prompt_tokens": len(prompt.split()),
            "completion_tokens": len(result_text.split()),
            "total_tokens": len(prompt.split()) + len(result_text.split()),
        }

        ctx.progress(100, "Complete", "done")

        return {
            "text": result_text,
            "model": model,
            "usage": usage,
            "finish_reason": "stop",
        }


class AIGenerateImageHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.generate_image"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        model = payload.get("model", "dall-e-3")
        prompt = payload.get("prompt", "")
        width = payload.get("width", 1024)
        height = payload.get("height", 1024)
        steps = payload.get("steps", 30)

        ctx.progress(10, "Initializing image model...", "init")
        await asyncio.sleep(0.3)

        ctx.progress(30, "Generating image...", "generation")

        # Simulate image generation
        for i in range(steps):
            await asyncio.sleep(0.05)
            progress = 30 + int((i / steps) * 50)
            ctx.progress(progress, f"Step {i + 1}/{steps}", "generation")

        ctx.progress(85, "Finalizing image...", "postprocessing")
        await asyncio.sleep(0.2)

        ctx.progress(100, "Complete", "done")

        return {
            "image_url": f"https://placeholder.com/image-{ctx.job_id}.png",
            "model": model,
            "width": width,
            "height": height,
            "steps": steps,
        }


class AIAnalyzeDataHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.analyze_data"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        model = payload.get("model", "gpt-4")
        data = payload.get("data")
        analysis_type = payload.get("analysisType", "summary")
        instructions = payload.get("instructions")

        ctx.progress(10, "Preparing data for analysis...", "preparation")
        await asyncio.sleep(0.3)

        ctx.progress(30, "Running analysis...", "analysis")
        await asyncio.sleep(1)

        ctx.progress(70, "Interpreting results...", "interpretation")
        await asyncio.sleep(0.5)

        ctx.progress(100, "Complete", "done")

        result = {
            "analysis_type": analysis_type,
            "insights": [
                f"Simulated insight for {analysis_type} analysis",
                "Data patterns identified",
                "Recommendations generated",
            ],
            "confidence": 0.85,
            "metadata": {
                "model": model,
                "data_points": len(data) if isinstance(data, list) else 1,
            },
        }

        if instructions:
            result["instructions_applied"] = True

        return result


class AIEmbeddingsHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.embeddings"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        model = payload.get("model", "text-embedding-3-small")
        texts = payload.get("texts", [])
        batch_size = payload.get("batchSize", 100)

        embeddings = []
        total = len(texts)

        for i in range(0, total, batch_size):
            batch = texts[i : i + batch_size]
            progress = 10 + int((i / total) * 80)
            ctx.progress(
                progress, f"Processing batch {i // batch_size + 1}...", "embedding"
            )

            # Simulate embedding generation
            await asyncio.sleep(0.2)

            for _ in batch:
                embeddings.append([0.1] * 1536)  # Simulated embedding vector

        ctx.progress(100, "Complete", "done")

        return {
            "embeddings": embeddings,
            "model": model,
            "dimensions": len(embeddings[0]) if embeddings else 0,
            "total_texts": total,
        }


class DataProcessHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "data.process"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        operation = payload.get("operation")
        input_data = payload.get("input")
        options = payload.get("options", {})

        ctx.progress(10, f"Starting operation: {operation}", "init")

        # Common operations
        if operation == "filter":
            ctx.progress(30, "Filtering data...", "processing")
            await asyncio.sleep(0.5)
            result = [item for item in input_data if item]
        elif operation == "transform":
            ctx.progress(30, "Transforming data...", "processing")
            await asyncio.sleep(0.5)
            result = {"transformed": input_data, "operation": operation}
        elif operation == "aggregate":
            ctx.progress(30, "Aggregating data...", "processing")
            await asyncio.sleep(0.5)
            result = {"count": len(input_data) if isinstance(input_data, list) else 1}
        else:
            ctx.progress(30, f"Running custom operation: {operation}", "processing")
            await asyncio.sleep(1)
            result = input_data

        ctx.progress(100, "Complete", "done")
        return result


class DataTransformHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "data.transform"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        transformer = payload.get("transformer")
        input_data = payload.get("input")
        schema = payload.get("schema")

        ctx.progress(10, f"Loading transformer: {transformer}", "init")
        await asyncio.sleep(0.2)

        ctx.progress(30, "Applying transformation...", "transform")
        await asyncio.sleep(0.5)

        # Simulated transformation
        result = {
            "transformed": True,
            "transformer": transformer,
            "input_type": type(input_data).__name__,
            "output": input_data,
        }

        if schema:
            result["schema_applied"] = True

        ctx.progress(100, "Complete", "done")
        return result


class DataExportHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "data.export"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Dict[str, Any]:
        format_type = payload.get("format", "json")
        data = payload.get("data")
        filename = payload.get("filename", f"export-{ctx.job_id}")

        ctx.progress(10, f"Preparing {format_type.upper()} export...", "init")
        await asyncio.sleep(0.2)

        ctx.progress(40, "Serializing data...", "serialization")
        await asyncio.sleep(0.3)

        ctx.progress(70, "Writing output...", "writing")
        await asyncio.sleep(0.2)

        ctx.progress(100, "Complete", "done")

        return {
            "filename": f"{filename}.{format_type}",
            "format": format_type,
            "size_bytes": len(json.dumps(data)) if data else 0,
            "download_url": f"/api/jobs/{ctx.job_id}/download",
        }


class CustomHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "custom"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        handler = payload.get("handler")
        args = payload.get("args", [])
        kwargs = payload.get("kwargs", {})

        ctx.progress(10, f"Loading custom handler: {handler}", "init")
        await asyncio.sleep(0.2)

        ctx.progress(30, "Executing handler...", "execution")

        # In production, dynamically load and execute the handler
        # This is a placeholder
        await asyncio.sleep(1)

        ctx.progress(100, "Complete", "done")

        return {
            "handler": handler,
            "args": args,
            "kwargs": kwargs,
            "result": "custom_handler_result",
        }


class JobRegistry:
    def __init__(self):
        self._handlers: Dict[str, JobHandler] = {}
        self._register_builtin_handlers()

    def _register_builtin_handlers(self) -> None:
        handlers = [
            AIGenerateTextHandler(),
            AIGenerateImageHandler(),
            AIAnalyzeDataHandler(),
            AIEmbeddingsHandler(),
            DataProcessHandler(),
            DataTransformHandler(),
            DataExportHandler(),
            CustomHandler(),
        ]

        for handler in handlers:
            self.register(handler)

    def register(self, handler: JobHandler) -> None:
        self._handlers[handler.job_type] = handler

    def get(self, job_type: str) -> Optional[JobHandler]:
        return self._handlers.get(job_type)

    def list_handlers(self) -> list[str]:
        return list(self._handlers.keys())


class JobExecutor:
    def __init__(self):
        self.registry = JobRegistry()

    async def execute(self, input_path: str) -> Dict[str, Any]:
        start_time = time.time()

        try:
            with open(input_path, "r") as f:
                job_data = json.load(f)

            job_id = job_data.get("jobId")
            payload = job_data.get("payload", {})
            output_path = job_data.get("outputPath")
            job_type = payload.get("type")

            ctx = JobContext(job_id, input_path, output_path or "")

            handler = self.registry.get(job_type)
            if not handler:
                raise ValueError(f"No handler registered for job type: {job_type}")

            ctx.log(f"Starting job execution: {job_type}")
            result = await handler.execute(ctx, payload)

            duration = time.time() - start_time
            ctx.log(f"Job completed in {duration:.2f}s")

            output = {
                "success": True,
                "data": result,
                "metadata": {
                    "job_id": job_id,
                    "job_type": job_type,
                    "duration_ms": int(duration * 1000),
                },
            }

            return output

        except Exception as e:
            duration = time.time() - start_time
            return {
                "success": False,
                "error": str(e),
                "metadata": {
                    "duration_ms": int(duration * 1000),
                    "traceback": traceback.format_exc(),
                },
            }

    def write_output(self, output: Dict[str, Any], output_path: str) -> None:
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)


async def main():
    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "type": "error",
                    "error": "No input file provided",
                    "usage": "worker.py <input_file>",
                }
            ),
            file=sys.stderr,
        )
        sys.exit(1)

    input_path = sys.argv[1]

    executor = JobExecutor()
    result = await executor.execute(input_path)

    # Write output to stdout if no output path in input
    output_path = None
    try:
        with open(input_path, "r") as f:
            job_data = json.load(f)
            output_path = job_data.get("outputPath")
    except:
        pass

    if output_path:
        executor.write_output(result, output_path)
    else:
        print(json.dumps(result))

    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    asyncio.run(main())
