# Python Workers

> Async Python worker infrastructure for job execution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        worker.py                                 │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │   JobExecutor  │  │   JobRegistry  │  │    JobContext    │   │
│  │                │  │                │  │                  │   │
│  │ - execute()    │  │ - register()   │  │ - progress()     │   │
│  │ - read input   │  │ - get()        │  │ - log()          │   │
│  │ - write output │  │ - list()       │  │ - heartbeat()    │   │
│  └────────────────┘  └────────────────┘  └──────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     handlers/__init__.py                         │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │AIGenerateText    │  │AIGenerateImage   │  │DataProcess    │  │
│  │Handler           │  │Handler           │  │Handler        │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │AIAnalyzeData     │  │AIEmbeddings      │  │DataTransform  │  │
│  │Handler           │  │Handler           │  │Handler        │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │DataExport        │  │CustomHandler     │                     │
│  │Handler           │  │                  │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
python-workers/
├── worker.py           # Main entry point
├── config.py           # Configuration management
├── pyproject.toml      # Dependencies
└── handlers/
    ├── __init__.py     # Built-in handlers
    └── context.py      # JobContext utilities
```

## Main Worker (worker.py)

### JobContext Class

Provides utilities for progress reporting and logging.

```python
class JobContext:
    def __init__(self, job_id: str, input_path: str, output_path: str):
        self.job_id = job_id
        self.input_path = input_path
        self.output_path = output_path
        self._progress = 0
        self._step: Optional[str] = None
        self._start_time = time.time()
        self._metadata: Dict[str, Any] = {}

    def progress(
        self,
        percentage: int,
        message: Optional[str] = None,
        step: Optional[str] = None,
    ) -> None:
        """Report job progress to parent process."""
        self._progress = max(0, min(100, percentage))
        self._step = step or self._step

        self._send_message("progress", {
            "percentage": self._progress,
            "message": message,
            "step": self._step,
        })

    def log(
        self,
        message: str,
        level: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a message."""
        self._send_message("log", {
            "level": level,
            "message": message,
            "metadata": metadata,
        })

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self.log(message, level="warn", metadata=metadata)

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self.log(message, level="error", metadata=metadata)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self.log(message, level="debug", metadata=metadata)

    def heartbeat(self) -> None:
        """Send heartbeat to indicate job is still running."""
        self._send_message("heartbeat", {
            "timestamp": int(time.time() * 1000),
            "elapsed_ms": int((time.time() - self._start_time) * 1000),
        })

    def elapsed_seconds(self) -> float:
        """Get elapsed time in seconds."""
        return time.time() - self._start_time

    def _send_message(self, msg_type: str, payload: Any) -> None:
        """Send JSON message to stdout for parent process."""
        message = {
            "type": msg_type,
            "jobId": self.job_id,
            "timestamp": int(time.time() * 1000),
            "payload": payload,
        }
        print(json.dumps(message), flush=True)
```

### JobHandler Base Class

```python
from abc import ABC, abstractmethod
from typing import Any, Dict

class JobHandler(ABC):
    @property
    @abstractmethod
    def job_type(self) -> str:
        """Return the job type this handler processes."""
        pass

    @abstractmethod
    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        """Execute the job. Override in subclasses."""
        pass

    async def validate_payload(self, payload: Dict[str, Any]) -> Optional[str]:
        """Validate payload. Return error message if invalid, None if valid."""
        return None
```

### JobRegistry

```python
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
```

### JobExecutor

```python
class JobExecutor:
    def __init__(self):
        self.registry = JobRegistry()

    async def execute(self, input_path: str) -> Dict[str, Any]:
        start_time = time.time()

        try:
            with open(input_path, 'r') as f:
                job_data = json.load(f)

            job_id = job_data.get("jobId")
            payload = job_data.get("payload", {})
            output_path = job_data.get("outputPath")
            job_type = payload.get("type")

            ctx = JobContext(job_id, input_path, output_path or "")

            handler = self.registry.get(job_type)
            if not handler:
                raise ValueError(f"No handler for job type: {job_type}")

            ctx.log(f"Starting job execution: {job_type}")
            result = await handler.execute(ctx, payload)

            duration = time.time() - start_time
            ctx.log(f"Job completed in {duration:.2f}s")

            return {
                "success": True,
                "data": result,
                "metadata": {
                    "job_id": job_id,
                    "job_type": job_type,
                    "duration_ms": int(duration * 1000),
                },
            }

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
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "type": "error",
            "error": "No input file provided",
        }), file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    executor = JobExecutor()
    result = await executor.execute(input_path)

    if "outputPath" in json.loads(open(input_path).read()):
        executor.write_output(result, output_path)
    else:
        print(json.dumps(result))

    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    asyncio.run(main())
```

## Built-in Handlers

### AIGenerateTextHandler

```python
class AIGenerateTextHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.generate_text"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        model = payload.get("model", "gpt-4")
        prompt = payload.get("prompt", "")
        system_prompt = payload.get("systemPrompt")
        temperature = payload.get("temperature", 0.7)
        max_tokens = payload.get("maxTokens", 2000)

        ctx.progress(10, "Initializing AI model...", "init")

        # Simulate API call - replace with actual AI SDK
        await asyncio.sleep(0.5)
        
        ctx.progress(30, "Sending prompt to model...", "generation")
        await asyncio.sleep(1)
        
        ctx.progress(80, "Processing response...", "postprocessing")
        await asyncio.sleep(0.5)

        result_text = f"[Simulated response from {model}] Generated: {prompt[:100]}..."

        ctx.progress(100, "Complete", "done")

        return {
            "text": result_text,
            "model": model,
            "usage": {
                "prompt_tokens": len(prompt.split()),
                "completion_tokens": len(result_text.split()),
                "total_tokens": len(prompt.split()) + len(result_text.split()),
            },
            "finish_reason": "stop",
        }
```

### AIGenerateImageHandler

```python
class AIGenerateImageHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "ai.generate_image"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        model = payload.get("model", "dall-e-3")
        prompt = payload.get("prompt", "")
        width = payload.get("width", 1024)
        height = payload.get("height", 1024)
        steps = payload.get("steps", 30)

        ctx.progress(10, "Initializing image model...", "init")

        for i in range(steps):
            await asyncio.sleep(0.05)
            progress = 10 + int((i / steps) * 80)
            ctx.progress(progress, f"Step {i + 1}/{steps}", "generation")

        ctx.progress(100, "Complete", "done")

        return {
            "image_url": f"https://placeholder.com/image-{ctx.job_id}.png",
            "model": model,
            "width": width,
            "height": height,
        }
```

### DataProcessHandler

```python
class DataProcessHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "data.process"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        operation = payload.get("operation")
        input_data = payload.get("input")

        ctx.progress(10, f"Starting operation: {operation}", "init")

        if operation == "filter":
            ctx.progress(30, "Filtering data...", "processing")
            await asyncio.sleep(0.5)
            result = [item for item in input_data if item]
        elif operation == "transform":
            ctx.progress(30, "Transforming data...", "processing")
            await asyncio.sleep(0.5)
            result = {"transformed": input_data, "operation": operation}
        else:
            result = input_data

        ctx.progress(100, "Complete", "done")
        return result
```

## Adding Custom Handlers

### Step 1: Create Handler Class

```python
# python-workers/handlers/my_handler.py

from worker import JobHandler, JobContext
from typing import Any, Dict

class MyCustomHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "custom.my_task"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        ctx.progress(10, "Starting...", "init")
        
        # Your async code here
        result = await my_async_function(payload)
        
        ctx.progress(100, "Complete", "done")
        return result
```

### Step 2: Register Handler

```python
# python-workers/worker.py

from handlers.my_handler import MyCustomHandler

# In JobRegistry.__init__ or after:
registry.register(MyCustomHandler())
```

## Configuration (config.py)

```python
import os
from pydantic import BaseModel

class WorkerConfig(BaseModel):
    redis_url: str = "redis://localhost:6379"
    max_workers: int = 4
    default_timeout: int = 300000  # 5 minutes
    heartbeat_interval: int = 30000  # 30 seconds
    log_level: str = "INFO"

def get_config() -> WorkerConfig:
    return WorkerConfig(
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        max_workers=int(os.getenv("MAX_PYTHON_WORKERS", "4")),
        default_timeout=int(os.getenv("JOB_DEFAULT_TIMEOUT", "300000")),
        heartbeat_interval=int(os.getenv("JOB_HEARTBEAT_INTERVAL", "30000")),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )
```

## Dependencies (pyproject.toml)

```toml
[project]
name = "python-workers"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "pydantic>=2.0.0",
    "redis>=5.0.0",
    "aiohttp>=3.9.0",
    "openai>=1.0.0",
    "anthropic>=0.18.0",
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "black>=24.0.0",
    "ruff>=0.3.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## Input/Output Format

### Input File

```json
{
  "jobId": "abc-123-def",
  "payload": {
    "type": "ai.generate_text",
    "model": "gpt-4",
    "prompt": "Hello, world!",
    "temperature": 0.7
  },
  "inputPath": "/path/to/input.json",
  "outputPath": "/path/to/output.json"
}
```

### Output File

```json
{
  "success": true,
  "data": {
    "text": "Generated response...",
    "model": "gpt-4",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 50,
      "total_tokens": 60
    }
  },
  "metadata": {
    "job_id": "abc-123-def",
    "job_type": "ai.generate_text",
    "duration_ms": 1500
  }
}
```

## Running Workers

### Standalone

```bash
cd python-workers
python worker.py input.json
```

### With the Application

Workers are automatically managed by the Node.js application:
1. Queue module spawns Python processes as needed
2. Input/output via temp files
3. Progress via JSON messages on stdout

## Best Practices

1. **Always use async** for I/O operations (API calls, file operations)
2. **Report progress** for long-running operations
3. **Handle errors gracefully** with descriptive messages
4. **Use ctx.log()** for debugging, not print()
5. **Return serializable data** (JSON-compatible types)
6. **Respect timeout** - check elapsed time for long operations
