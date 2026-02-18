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
│  │OpenAIText        │  │AnthropicText     │  │AgentTrace     │  │
│  │Handler           │  │Handler           │  │Handler        │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │BatchProcess      │  │DataPipeline      │                     │
│  │Handler           │  │Handler           │                     │
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
├── handlers/
│   ├── __init__.py     # Built-in handlers
│   ├── context.py      # JobContext utilities
│   └── agent_trace.py  # Agent execution with tracing
├── agents/             # Multi-agent system (pydantic-ai)
│   ├── __init__.py     # Agent exports
│   ├── orchestrator.py # Coordinator agent
│   ├── research.py     # Research agent
│   ├── coding.py       # Coding agent
│   ├── analysis.py     # Analysis agent
│   └── schemas.py      # Pydantic models
└── tracing/            # Custom tracing system
    ├── __init__.py     # Tracing exports
    ├── spans.py        # Span/Trace models
    ├── collector.py    # SQLite storage
    ├── processor.py    # Tracer implementation
    └── viewer.py       # Query utilities
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

### OpenAITextHandler

Text generation using OpenAI API.

```python
class OpenAITextHandler(BaseHandler):
    job_type = "ai.openai.text"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        from openai import AsyncOpenAI
        client = AsyncOpenAI()

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
        )

        ctx.progress(100, "Complete")
        return {
            "text": response.choices[0].message.content,
            "model": response.model,
            "usage": { ... },
        }
```

### AnthropicTextHandler

Text generation using Anthropic Claude API.

```python
class AnthropicTextHandler(BaseHandler):
    job_type = "ai.anthropic.text"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic()

        response = await client.messages.create(
            model=payload.get("model", "claude-3-opus-20240229"),
            max_tokens=payload.get("maxTokens", 4096),
            system=payload.get("systemPrompt"),
            messages=[{"role": "user", "content": payload["prompt"]}],
        )
        return {"text": response.content[0].text, ...}
```

### AgentTraceHandler

Execute pydantic-ai agents with full tracing. See `handlers/agent_trace.py`.

```python
class AgentTraceHandler(BaseHandler):
    job_type = "agent.run"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        agent_type = payload.get("agent", "research")
        prompt = payload.get("prompt")

        # Create agent
        agent = agent_factories[agent_type](model=model)

        # Initialize tracer
        tracer = get_tracer("traces.db")
        trace = tracer.start_trace(name=f"agent_{agent_type}", ...)

        # Execute agent
        result = await agent.run(prompt, deps=deps)

        # End trace
        tracer.end_trace()

        return {"trace_id": trace.id, "output": result.output, ...}
```

### BatchProcessHandler

Process items in batches.

```python
class BatchProcessHandler(BaseHandler):
    job_type = "data.batch"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        items = payload.get("items", [])
        batch_size = payload.get("batchSize", 10)
        results = []

        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            progress = 10 + int((i / len(items)) * 80)
            ctx.progress(progress, f"Processing batch {i // batch_size + 1}...")
            # Process batch...

        return {"total": len(items), "processed": len(results), ...}
```

### DataPipelineHandler

Multi-step data pipelines.

```python
class DataPipelineHandler(BaseHandler):
    job_type = "data.pipeline"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        steps = payload.get("steps", [])
        current_data = payload.get("input")

        for i, step in enumerate(steps):
            ctx.progress(int((i / len(steps)) * 90), f"Executing: {step['name']}")
            # Execute step...

        return {"steps_executed": len(steps), "output": current_data, ...}
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
