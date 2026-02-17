# Python Job System - Overview

> Single source of truth for the async job processing system with Python workers.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ JobCreateForm│  │   JobList    │  │      JobDetails          │   │
│  │              │  │              │  │  (results, logs, cancel)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘   │
│         │                 │                       │                  │
│         └─────────────────┼───────────────────────┘                  │
│                           │                                          │
│                    useJobs() hook                                    │
│                    useJob() hook                                     │
│                    useQueueStats() hook                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Layer (TanStack Start)                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /api/jobs          │ POST │ Create job                        │   │
│  │  /api/jobs          │ GET  │ List jobs (userId, status, limit) │   │
│  │  /api/jobs/:id      │ GET  │ Get job details + logs            │   │
│  │  /api/jobs/:id      │ DELETE│ Cancel job                        │   │
│  │  /api/jobs/:id      │ POST │ Retry job                         │   │
│  │  /api/jobs/stats    │ GET  │ Queue statistics                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Queue Layer (BullMQ + SQLite)                    │
│                                                                       │
│  ┌─────────────────┐     ┌─────────────────┐     ┌────────────────┐  │
│  │   Redis/BullMQ  │     │  SQLite (Drizzle)│     │  Queue Module  │  │
│  │                 │     │                  │     │                │  │
│  │  - Job Queue    │     │  - job table     │     │  - index.ts    │  │
│  │  - Distribution │     │  - job_log table │     │  - worker.ts   │  │
│  │  - Retry logic  │     │  - Persist state │     │  - redis.ts    │  │
│  │                 │     │                  │     │  - types.ts    │  │
│  └────────┬────────┘     └────────┬─────────┘     └────────────────┘  │
│           │                       │                                   │
│           └───────────────────────┼───────────────────────────────────┘
│                                   │                                    │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Worker Layer (Python)                            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    worker.py (Main Entry)                    │    │
│  │                                                              │    │
│  │  - JobExecutor: Orchestrates job execution                  │    │
│  │  - JobRegistry: Maps job types to handlers                  │    │
│  │  - JobContext: Progress reporting, logging                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    handlers/ (Job Handlers)                  │    │
│  │                                                              │    │
│  │  - AIGenerateTextHandler: GPT-4, Claude text generation     │    │
│  │  - AIGenerateImageHandler: DALL-E, Stable Diffusion         │    │
│  │  - AIAnalyzeDataHandler: Classification, extraction         │    │
│  │  - AIEmbeddingsHandler: Text embeddings                     │    │
│  │  - DataProcessHandler: Filter, transform, aggregate         │    │
│  │  - DataTransformHandler: Data pipelines                     │    │
│  │  - DataExportHandler: JSON, CSV, XLSX export                │    │
│  │  - CustomHandler: User-defined handlers                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Job Lifecycle

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│ PENDING  │───▶│ RUNNING  │───▶│ COMPLETED │    │  FAILED   │
└──────────┘    └──────────┘    └───────────┘    └───────────┘
      │               │                                 ▲
      │               │                                 │
      │               ▼                                 │
      │         ┌───────────┐                          │
      │         │ CANCELLED │                          │
      │         └───────────┘                          │
      │                                                 │
      └─────────────────────────────────────────────────┘
                         (retry)
```

### Processing Modes

| Mode | Redis Available | Description |
|------|-----------------|-------------|
| **Distributed** | Yes | Jobs queued in BullMQ, processed by distributed workers |
| **Synchronous** | No | Jobs processed immediately in-process (development) |

### Communication Flow

```
Node.js Server                          Python Worker
     │                                       │
     │  1. Write job input to temp file      │
     │────────────────────────────────────▶  │
     │                                       │
     │  2. Spawn Python process              │
     │────────────────────────────────────▶  │
     │                                       │
     │                    3. Execute job     │
     │                    (async operations) │
     │                                       │
     │  4. Progress updates (JSON on stdout) │
     │◀────────────────────────────────────  │
     │                                       │
     │  5. Write result to output file       │
     │◀────────────────────────────────────  │
     │                                       │
     │  6. Process exits with code           │
     │◀────────────────────────────────────  │
     │                                       │
     │  7. Read result, update database      │
     │                                       │
```

## Key Features

### 1. Async Python Execution
- Full async/await support in Python workers
- Support for AI model APIs (OpenAI, Anthropic)
- Long-running job support with progress updates

### 2. Progress Reporting
```python
ctx.progress(50, "Processing batch 5/10", step="batch_processing")
```

### 3. Structured Logging
```python
ctx.log("Model loaded successfully", level="info")
ctx.warn("Rate limit approaching")
ctx.error("API request failed", metadata={"status": 429})
```

### 4. Automatic Retries
- Configurable retry attempts
- Exponential backoff
- Failed job recovery

### 5. Job Cancellation
- Cancel pending/running jobs
- SIGTERM to Python process
- Database status update

### 6. Result Storage
- JSON-serializable results
- Error traces for debugging
- Metadata preservation

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Job Queue | BullMQ | Redis-based queue distribution |
| Database | SQLite + Drizzle | Persistent job state |
| Workers | Python 3.11+ | Async job execution |
| API | TanStack Start | REST endpoints |
| Frontend | React + TanStack Router | Job management UI |

## File Structure

```
src/
├── lib/
│   └── queue/
│       ├── index.ts        # Queue management, job CRUD
│       ├── worker.ts       # Node.js worker, Python process spawner
│       ├── redis.ts        # Redis connection management
│       └── types.ts        # TypeScript type definitions
├── db/
│   └── schema.ts           # Job and job_log tables
├── routes/
│   ├── api/jobs/
│   │   ├── index.ts        # GET/POST /api/jobs
│   │   ├── $id.ts          # GET/DELETE/POST /api/jobs/:id
│   │   └── stats.ts        # GET /api/jobs/stats
│   └── jobs.tsx            # Job management page
└── components/jobs/
    ├── JobList.tsx         # Job cards with status
    ├── JobCreateForm.tsx   # Job creation form
    ├── JobDetails.tsx      # Job details modal
    └── JobStats.tsx        # Queue statistics

python-workers/
├── worker.py               # Main worker entry point
├── config.py               # Worker configuration
├── pyproject.toml          # Python dependencies
└── handlers/
    ├── __init__.py         # Built-in handlers
    └── context.py          # JobContext utilities
```

## Related Specifications

- [Database Schema](./database.md) - Job and log table definitions
- [Queue System](./queue-system.md) - BullMQ configuration and management
- [Python Workers](./python-workers.md) - Worker architecture and handlers
- [API Endpoints](./api-endpoints.md) - REST API specifications
- [Frontend Components](./frontend.md) - UI components and hooks
- [Job Types](./job-types.md) - Payload definitions and validation
- [Configuration](./configuration.md) - Environment variables and settings