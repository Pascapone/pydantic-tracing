# Configuration

> Environment variables and settings for the job system.

## Environment Variables

### Required

```bash
# Authentication (existing)
BETTER_AUTH_SECRET=your-secret-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
```

### Job System

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Python Worker Configuration
PYTHON_PATH=python                    # Python executable (default: python)
MAX_PYTHON_WORKERS=4                  # Concurrent workers (default: 4)
JOB_DEFAULT_TIMEOUT=300000            # 5 minutes in milliseconds
JOB_HEARTBEAT_INTERVAL=30000          # 30 seconds in milliseconds

# Logging
LOG_LEVEL=INFO                        # Python worker log level
```

---

## Configuration Files

### .env.example

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Python Worker Configuration
PYTHON_PATH=python
MAX_PYTHON_WORKERS=4
JOB_DEFAULT_TIMEOUT=300000
JOB_HEARTBEAT_INTERVAL=30000

# Authentication
BETTER_AUTH_SECRET=your-secret-here-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3000
```

---

## TypeScript Configuration

### src/lib/queue/redis.ts

```typescript
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export function getRedisConnectionOptions() {
  return {
    host: parseHostFromUrl(REDIS_URL),
    port: parsePortFromUrl(REDIS_URL),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
```

### src/lib/queue/worker.ts

```typescript
const maxWorkers = parseInt(process.env.MAX_PYTHON_WORKERS || "4", 10);
const pythonPath = process.env.PYTHON_PATH || "python";
const timeout = parseInt(process.env.JOB_DEFAULT_TIMEOUT || "300000", 10);
```

---

## Python Configuration

### python-workers/config.py

```python
from pydantic import BaseModel
import os

class WorkerConfig(BaseModel):
    redis_url: str = "redis://localhost:6379"
    max_workers: int = 4
    default_timeout: int = 300000
    heartbeat_interval: int = 30000
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

### python-workers/pyproject.toml

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

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.black]
line-length = 100
target-version = ["py311"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

---

## Drizzle Configuration

### drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./sqlite.db",
  },
});
```

---

## Default Values

| Setting | Default | Description |
|---------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `PYTHON_PATH` | `python` | Python executable path |
| `MAX_PYTHON_WORKERS` | `4` | Max concurrent workers |
| `JOB_DEFAULT_TIMEOUT` | `300000` | 5 minutes |
| `JOB_HEARTBEAT_INTERVAL` | `30000` | 30 seconds |
| `LOG_LEVEL` | `INFO` | Python log level |

---

## Queue Settings

### BullMQ Defaults

```typescript
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,  // 1s, 2s, 4s
  },
  removeOnComplete: {
    age: 3600,    // 1 hour
    count: 1000,  // max 1000 jobs
  },
  removeOnFail: {
    age: 86400,   // 24 hours
  },
};
```

### Worker Settings

```typescript
const workerOptions = {
  concurrency: 4,          // Max parallel jobs
  limiter: {
    max: 100,              // Max 100 jobs
    duration: 1000,        // Per second
  },
};
```

---

## Processing Modes

### Mode Detection

The system automatically detects Redis availability:

```typescript
async function checkRedisAvailability(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
```

### Mode Comparison

| Aspect | Redis Available | No Redis |
|--------|-----------------|----------|
| Distribution | Multi-server | Single server |
| Persistence | Redis + SQLite | SQLite only |
| Retry | BullMQ handles | Manual |
| Scalability | Horizontal | Vertical |

---

## Production Checklist

### Redis

- [ ] Redis server running
- [ ] `REDIS_URL` configured
- [ ] Redis persistence enabled (AOF/RDB)
- [ ] Memory limits configured

### Python Workers

- [ ] Python 3.11+ installed
- [ ] `pip install -e python-workers/`
- [ ] API keys for AI services (OpenAI, Anthropic)
- [ ] Worker process monitoring

### Database

- [ ] SQLite file backed up
- [ ] Migration applied
- [ ] Indexes created

### Security

- [ ] `BETTER_AUTH_SECRET` is strong
- [ ] API keys in environment variables
- [ ] Redis not exposed publicly
- [ ] Rate limiting enabled

---

## Development Setup

### Without Redis

Jobs will process synchronously without Redis:

```bash
# Just run the app
npm run dev
```

### With Redis

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start app
npm run dev
```

### Python Setup

```bash
# Install Python dependencies
cd python-workers
pip install -e .

# Optional: Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows
pip install -e .
```

---

## Monitoring

### Logs

```bash
# Server logs
npm run dev

# Worker logs appear in server output:
[Queue] Redis connected, starting distributed worker...
[Worker] Job abc-123 completed
[Worker] Job def-456 failed: Connection timeout
```

### Queue Stats

```bash
# Via API
curl http://localhost:3000/api/jobs/stats

# Response
{
  "queue": {
    "waiting": 2,
    "active": 1,
    "completed": 10,
    "failed": 0
  },
  "activeWorkers": [
    { "jobId": "abc-123", "runningTime": 15000 }
  ]
}
```

### Database

```bash
# Open Drizzle Studio
npx drizzle-kit studio
```
