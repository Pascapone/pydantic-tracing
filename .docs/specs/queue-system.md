# Queue System

> BullMQ-based job queue with Redis for distributed processing and SQLite fallback.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Queue Module                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  index.ts   │  │  worker.ts  │  │      redis.ts       │  │
│  │             │  │             │  │                     │  │
│  │ - getQueue  │  │ - Worker    │  │ - getRedisClient    │  │
│  │ - createJob │  │ - execute   │  │ - checkConnection   │  │
│  │ - cancelJob │  │   Python    │  │ - connection opts   │  │
│  │ - retryJob  │  │ - progress  │  │                     │  │
│  │ - getStats  │  │ - spawning  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Redis Connection

```typescript
// src/lib/queue/redis.ts

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export function getRedisConnectionOptions() {
  return {
    host: parseHost(REDIS_URL),
    port: parsePort(REDIS_URL),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
```

### Queue Settings

```typescript
// src/lib/queue/index.ts

const QUEUE_NAME = "python-jobs";

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,  // Start at 1s, double each retry
  },
  removeOnComplete: {
    age: 3600,    // Keep completed jobs for 1 hour
    count: 1000,  // Or max 1000 jobs
  },
  removeOnFail: {
    age: 86400,   // Keep failed jobs for 24 hours
  },
};
```

## Processing Modes

### Mode Detection

```typescript
let redisAvailable: boolean | null = null;

async function checkRedisAvailability(): Promise<boolean> {
  if (redisAvailable !== null) return redisAvailable;
  
  try {
    redisAvailable = await checkRedisConnection();
    return redisAvailable;
  } catch {
    redisAvailable = false;
    return false;
  }
}
```

### Distributed Mode (Redis Available)

```typescript
// Add job to BullMQ queue
const queue = getQueue();
await queue.add(jobType, jobPayload, {
  jobId: id,
  priority: options.priority,
  attempts: options.attempts,
  backoff: { type: "exponential", delay: 1000 },
});

// Worker picks up job from Redis
worker = new Worker(QUEUE_NAME, processor, {
  connection: getRedisConnectionOptions(),
  concurrency: maxWorkers,
});
```

### Synchronous Mode (No Redis)

```typescript
// Process immediately in-process
await processJobLocally(jobId, jobPayload);

async function processJobLocally(jobId: string, payload: JobPayload) {
  await updateJobStatus(jobId, "running", { startedAt: new Date() });
  
  try {
    const result = await executePythonJob(jobId, payload);
    await updateJobStatus(jobId, "completed", { result });
  } catch (error) {
    await updateJobStatus(jobId, "failed", { error: error.message });
  }
}
```

## Worker Implementation

### Creating the Worker

```typescript
// src/lib/queue/worker.ts

export function createJobWorker(): Worker {
  const connection = getRedisConnectionOptions();
  const maxWorkers = parseInt(process.env.MAX_PYTHON_WORKERS || "4", 10);

  const worker = new Worker(
    QUEUE_NAME,
    async (bullJob: Job) => {
      const jobId = bullJob.id!;
      const payload = bullJob.data as JobPayload;

      // Update status
      await updateJobStatus(jobId, "running", {
        attempts: bullJob.attemptsMade,
        startedAt: new Date(),
      });

      // Execute Python job
      const result = await executePythonJob(jobId, payload);

      if (!result.success) {
        throw new Error(result.error || "Job execution failed");
      }

      return result;
    },
    {
      connection,
      concurrency: maxWorkers,
      limiter: {
        max: 100,      // Max 100 jobs
        duration: 1000, // Per second
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err));
  worker.on("error", (err) => console.error("[Worker] Error:", err));
  worker.on("stalled", (jobId) => console.warn(`[Worker] Job ${jobId} stalled`));

  return worker;
}
```

### Auto-Starting Worker

```typescript
// src/lib/queue/index.ts

let workerStarted = false;

function ensureWorkerStarted(): void {
  if (workerStarted || typeof window !== "undefined") return;
  workerStarted = true;
  
  (async () => {
    const available = await checkRedisAvailability();
    if (available) {
      console.log("[Queue] Redis connected, starting distributed worker...");
      globalThis.jobWorker = createJobWorker();
    } else {
      console.log("[Queue] Redis not available, using synchronous processing");
    }
  })();
}
```

## Job Operations

### Create Job

```typescript
export async function createJob(opts: CreateJobOptions): Promise<string> {
  const id = uuidv4();
  
  // Insert to database
  await db.insert(jobTable).values({
    id,
    type: opts.type,
    status: "pending",
    priority: opts.options?.priority ?? 0,
    payload: { ...opts.payload, type: opts.type },
    userId: opts.userId,
    maxAttempts: opts.options?.attempts ?? 3,
  });

  // Queue for processing
  const useRedis = await checkRedisAvailability();
  
  if (useRedis) {
    await queue.add(opts.type, jobPayload, { jobId: id, ...jobOptions });
  } else {
    await processJobLocally(id, jobPayload);
  }

  return id;
}
```

### Cancel Job

```typescript
export async function cancelJob(id: string): Promise<boolean> {
  const job = await getJob(id);
  if (!job) return false;
  
  if (job.status === "pending" || job.status === "running") {
    // Remove from BullMQ if present
    if (await checkRedisAvailability()) {
      const bullJob = await queue.getJob(id);
      if (bullJob) await bullJob.remove();
    }
    
    // Update database
    await updateJobStatus(id, "cancelled");
    return true;
  }
  
  return false;
}
```

### Retry Job

```typescript
export async function retryJob(id: string): Promise<boolean> {
  const job = await getJob(id);
  if (!job || job.status !== "failed") return false;
  
  // Reset status
  await updateJobStatus(id, "pending", {
    error: undefined,
    attempts: 0,
  });

  // Re-queue
  const useRedis = await checkRedisAvailability();
  if (useRedis) {
    await queue.add(job.type, job.payload, { jobId: id });
  } else {
    await processJobLocally(id, job.payload);
  }
  
  return true;
}
```

### Get Queue Stats

```typescript
export async function getQueueStats(): Promise<QueueStats> {
  const stats = await db
    .select({
      status: jobTable.status,
      count: sql<number>`count(*)`,
    })
    .from(jobTable)
    .groupBy(jobTable.status);

  const dbStats: Record<string, number> = {};
  for (const row of stats) {
    dbStats[row.status] = row.count;
  }

  return {
    waiting: dbStats["pending"] ?? 0,
    active: dbStats["running"] ?? 0,
    completed: dbStats["completed"] ?? 0,
    failed: dbStats["failed"] ?? 0,
    delayed: 0,
    paused: dbStats["cancelled"] ?? 0,
  };
}
```

## Python Process Spawning

### Process Execution

```typescript
// src/lib/queue/worker.ts

async function executePythonJob(
  jobId: string,
  payload: JobPayload
): Promise<JobResult> {
  // Create temp files
  const inputPath = join(TEMP_DIR, `${jobId}-input.json`);
  const outputPath = join(TEMP_DIR, `${jobId}-output.json`);
  
  await writeFile(inputPath, JSON.stringify({ jobId, payload }));

  return new Promise((resolve) => {
    // Spawn Python process
    const workerProcess = spawn("python", ["worker.py", inputPath], {
      cwd: WORKER_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Handle stdout (progress messages)
    workerProcess.stdout?.on("data", (data: Buffer) => {
      const messages = parseWorkerMessages(data.toString());
      for (const msg of messages) {
        if (msg.type === "progress") {
          updateJobProgress(jobId, msg.payload);
        }
      }
    });

    // Handle completion
    workerProcess.on("close", async (code) => {
      if (code === 0 && existsSync(outputPath)) {
        const result = JSON.parse(await readFile(outputPath, "utf-8"));
        resolve(result);
      } else {
        resolve({ success: false, error: `Process exited with code ${code}` });
      }
    });

    // Timeout handling
    setTimeout(() => {
      workerProcess.kill("SIGTERM");
    }, payload.timeout ?? 300000);
  });
}
```

### Progress Message Format

```json
{
  "type": "progress",
  "jobId": "abc-123",
  "timestamp": 1234567890000,
  "payload": {
    "percentage": 50,
    "message": "Processing batch 5/10",
    "step": "batch_processing"
  }
}
```

## Global State Management

```typescript
declare global {
  var jobQueue: Queue | undefined;
  var queueEvents: QueueEvents | undefined;
  var jobWorker: Worker | undefined;
  var redisClient: Redis | undefined;
}
```

## Error Handling

### Worker Error Events

```typescript
worker.on("failed", async (job, err) => {
  if (job) {
    await updateJobStatus(job.id, "failed", {
      error: err.message,
      completedAt: new Date(),
    });
  }
});

worker.on("error", (err) => {
  console.error("[Worker] Fatal error:", err);
});
```

### Retry Logic

```typescript
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,  // 1s, 2s, 4s
  },
};
```

## Performance Tuning

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_PYTHON_WORKERS` | 4 | Concurrent Python processes |
| `JOB_DEFAULT_TIMEOUT` | 300000 | 5 minute timeout |
| `JOB_HEARTBEAT_INTERVAL` | 30000 | 30 second heartbeat |
| Concurrency | 4 | BullMQ worker concurrency |
| Rate Limit | 100/sec | Max jobs per second |
