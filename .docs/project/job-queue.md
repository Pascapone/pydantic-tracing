# Job Queue System

BullMQ + Python workers for async job processing. Gracefully degrades to sync processing without Redis.

## Architecture

```
┌──────────────┐     ┌─────────────┐     ┌─────────────────┐
│  createJob() │ ──→ │   BullMQ    │ ──→ │ Python Worker   │
│              │     │   (Redis)   │     │ (worker.py)     │
└──────────────┘     └─────────────┘     └─────────────────┘
       │                   ↓                      │
       │            ┌─────────────┐               │
       └─────────→  │   SQLite    │ ←─────────────┘
                    │  (job table)│   Result/Progress
                    └─────────────┘
```

**Without Redis:** Jobs process synchronously via `processJobLocally()`.

## Creating Jobs

**Import:** `import { createJob } from "@/lib/queue";`

```ts
const jobId = await createJob({
  type: "ai.generate_text",
  payload: {
    model: "gpt-4",
    prompt: "Hello, world!",
    temperature: 0.7,
  },
  userId: "user-123",
  options: {
    priority: 10,
    attempts: 3,
    delay: 5000, // ms
  },
});
```

## Job Types

Defined in `src/lib/queue/types.ts`:

| Type | Payload Fields |
|------|----------------|
| `ai.generate_text` | model, prompt, systemPrompt?, temperature?, maxTokens? |
| `ai.generate_image` | model, prompt, width?, height?, steps? |
| `ai.analyze_data` | model, data, analysisType, instructions? |
| `ai.embeddings` | model, texts[], batchSize? |
| `data.process` | operation, input, options? |
| `data.transform` | transformer, input, schema? |
| `data.export` | format, data, filename? |
| `custom` | handler, args[], kwargs? |

## API Endpoints

**Base:** `/api/jobs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs?userId=X` | List user's jobs |
| GET | `/api/jobs?id=X&logs=true` | Get job with logs |
| GET | `/api/jobs?stats=true` | Queue statistics |
| POST | `/api/jobs` | Create job |
| DELETE | `/api/jobs/:id` | Cancel job |
| POST | `/api/jobs/:id` | Retry job |

### POST /api/jobs

```json
{
  "type": "ai.generate_text",
  "payload": { "model": "gpt-4", "prompt": "..." },
  "userId": "user-123",
  "options": { "priority": 10 }
}
```

## Adding Python Handlers

1. Create handler in `python-workers/worker.py` or `python-workers/handlers/__init__.py`:

```python
class MyHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "custom.my_task"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        ctx.progress(10, "Starting...")
        result = await my_async_function(payload)
        ctx.progress(100, "Complete")
        return result
```

2. Register in `JobRegistry._register_builtin_handlers()`:

```python
self.register(MyHandler())
```

## JobContext API

Available in Python handlers:

```python
ctx.progress(percentage, message?, step?)  # Update progress (0-100)
ctx.log(message, level?, metadata?)        # Log event
ctx.heartbeat()                            # Signal alive
ctx.job_id                                 # Job ID string
```

## Queue Functions

**File:** `src/lib/queue/index.ts`

```ts
createJob(opts)              // Create and queue job
getJob(id)                   // Get job record
getJobWithLogs(id)           // Job + all logs
updateJobStatus(id, status)  // Update status
updateJobProgress(id, progress)
logJobEvent(jobId, level, message, metadata?)
cancelJob(id)                // Cancel pending/running job
retryJob(id)                 // Retry failed job
getQueueStats()              // { waiting, active, completed, failed, ... }
getJobsByUser(userId, options?)
getJobsByStatus(status, options?)
isRedisAvailable()           // Check Redis connectivity
```

## Worker Management

**File:** `src/lib/queue/worker.ts`

```ts
createJobWorker()            // Create BullMQ worker
startWorker()                // Start global worker
stopWorker()                 // Stop worker
getActiveWorkers()           // List running jobs
killWorker(jobId)            // Kill specific worker
executePythonJob(jobId, payload)  // Direct Python execution
```

## Database Schema

**File:** `src/db/schema.ts`

- `job` table: id, type, status, payload, result, progress, etc.
- `jobLog` table: jobId, level, message, metadata

## Environment Variables

```bash
REDIS_URL=redis://localhost:6379  # Optional - sync mode without it
PYTHON_PATH=python                # Python executable
MAX_PYTHON_WORKERS=4              # Concurrent workers
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/queue/index.ts` | Queue API, job creation |
| `src/lib/queue/types.ts` | TypeScript job types |
| `src/lib/queue/worker.ts` | Python worker execution |
| `src/lib/queue/redis.ts` | Redis connection |
| `python-workers/worker.py` | Main Python worker |
| `python-workers/handlers/` | Job handler implementations |
| `src/routes/api/jobs/` | REST API endpoints |
