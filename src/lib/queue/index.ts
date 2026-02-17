import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/db";
import { job as jobTable, jobLog as jobLogTable } from "../../db/schema";
import { getRedisConnectionOptions, checkRedisConnection } from "./redis";
import { createJobWorker } from "./worker";
import { executePythonJob } from "./worker";
import type {
  JobPayload,
  JobResult,
  JobStatus,
  JobOptions,
  QueueStats,
  JobProgress,
} from "./types";

const QUEUE_NAME = "python-jobs";
let workerStarted = false;
let redisAvailable: boolean | null = null;

declare global {
  var jobQueue: Queue | undefined;
  var queueEvents: QueueEvents | undefined;
  var jobWorker: Worker | undefined;
}

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

function ensureWorkerStarted(): void {
  if (workerStarted || typeof window !== "undefined") return;
  workerStarted = true;
  
  (async () => {
    try {
      const available = await checkRedisAvailability();
      if (available) {
        console.log("[Queue] Redis connected, starting distributed worker...");
        if (!globalThis.jobWorker) {
          globalThis.jobWorker = createJobWorker();
          console.log("[Queue] Distributed worker started successfully");
        }
      } else {
        console.log("[Queue] Redis not available, using synchronous job processing");
      }
    } catch (err) {
      console.error("[Queue] Failed to start worker:", err);
    }
  })();
}

export function getQueue(): Queue | null {
  if (typeof window !== "undefined") {
    throw new Error("Queue cannot be used in browser");
  }

  ensureWorkerStarted();

  if (!globalThis.jobQueue) {
    const connection = getRedisConnectionOptions();
    try {
      globalThis.jobQueue = new Queue(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: {
            age: 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 86400,
          },
        },
      });
    } catch (err) {
      console.error("[Queue] Failed to create BullMQ queue:", err);
      return null;
    }
  }

  return globalThis.jobQueue;
}

export function getQueueEvents(): QueueEvents | null {
  if (typeof window !== "undefined") {
    throw new Error("QueueEvents cannot be used in browser");
  }

  if (!globalThis.queueEvents) {
    const connection = getRedisConnectionOptions();
    try {
      globalThis.queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    } catch (err) {
      console.error("[Queue] Failed to create queue events:", err);
      return null;
    }
  }

  return globalThis.queueEvents;
}

export interface CreateJobOptions {
  type: JobPayload["type"];
  payload: Omit<JobPayload, "type">;
  userId?: string;
  options?: JobOptions;
  parentId?: string;
}

export async function createJob(opts: CreateJobOptions): Promise<string> {
  const id = uuidv4();

  const jobPayload: JobPayload = {
    ...opts.payload,
    type: opts.type,
  } as JobPayload;

  await db.insert(jobTable).values({
    id,
    type: opts.type,
    status: "pending",
    priority: opts.options?.priority ?? 0,
    payload: jobPayload,
    userId: opts.userId,
    parentJobId: opts.parentId,
    maxAttempts: opts.options?.attempts ?? 3,
    scheduledFor: jobPayload.scheduledFor,
  });

  await logJobEvent(id, "info", `Job created: ${opts.type}`);

  const useRedis = await checkRedisAvailability();

  if (useRedis) {
    const queue = getQueue();
    if (queue) {
      const jobOptions: JobsOptions = {
        priority: opts.options?.priority ?? 0,
        delay: opts.options?.delay,
        attempts: opts.options?.attempts ?? 3,
        backoff: opts.options?.backoff ?? {
          type: "exponential",
          delay: 1000,
        },
      };

      await queue.add(opts.type, jobPayload, {
        jobId: id,
        ...jobOptions,
      });

      await logJobEvent(id, "info", "Job added to Redis queue");
    }
  } else {
    await logJobEvent(id, "info", "Processing job synchronously (no Redis)");
    
    // Process job asynchronously but immediately
    processJobLocally(id, jobPayload).catch((err) => {
      console.error(`[Queue] Job ${id} failed:`, err);
    });
  }

  return id;
}

async function processJobLocally(jobId: string, payload: JobPayload): Promise<void> {
  await updateJobStatus(jobId, "running", {
    startedAt: new Date(),
  });

  await logJobEvent(jobId, "info", "Job started (local processing)");

  const startTime = Date.now();

  try {
    const result = await executePythonJob(jobId, payload);
    const duration = Date.now() - startTime;

    if (result.success) {
      await updateJobStatus(jobId, "completed", {
        result,
        completedAt: new Date(),
      });
      await logJobEvent(jobId, "info", `Job completed in ${duration}ms`);
    } else {
      throw new Error(result.error || "Job execution failed");
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logJobEvent(jobId, "error", `Job failed: ${errorMessage}`, {
      duration,
    });

    await updateJobStatus(jobId, "failed", {
      error: errorMessage,
      completedAt: new Date(),
    });
  }
}

export async function getJob(id: string) {
  const [job] = await db
    .select()
    .from(jobTable)
    .where(eq(jobTable.id, id))
    .limit(1);

  return job ?? null;
}

export async function getJobWithLogs(id: string) {
  const job = await getJob(id);
  if (!job) return null;

  const logs = await db
    .select()
    .from(jobLogTable)
    .where(eq(jobLogTable.jobId, id))
    .orderBy(jobLogTable.createdAt);

  return { ...job, logs };
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  updates?: Partial<{
    result: JobResult;
    error: string;
    progress: number;
    progressMessage: string;
    attempts: number;
    startedAt: Date;
    completedAt: Date;
  }>
): Promise<void> {
  await db
    .update(jobTable)
    .set({
      status,
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(jobTable.id, id));
}

export async function updateJobProgress(
  id: string,
  progress: JobProgress
): Promise<void> {
  await db
    .update(jobTable)
    .set({
      progress: progress.percentage,
      progressMessage: progress.message,
      updatedAt: new Date(),
    })
    .where(eq(jobTable.id, id));

  await logJobEvent(id, "info", progress.message ?? `Progress: ${progress.percentage}%`, {
    step: progress.step,
    metadata: progress.metadata,
  });
}

export async function logJobEvent(
  jobId: string,
  level: "info" | "warn" | "error" | "debug",
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(jobLogTable).values({
    id: uuidv4(),
    jobId,
    level,
    message,
    metadata,
  });
}

export async function cancelJob(id: string): Promise<boolean> {
  const job = await getJob(id);

  if (!job) return false;

  if (job.status === "pending" || job.status === "running") {
    const useRedis = await checkRedisAvailability();
    
    if (useRedis) {
      const queue = getQueue();
      if (queue) {
        const bullJob = await queue.getJob(id);
        if (bullJob) {
          await bullJob.remove();
        }
      }
    }

    await updateJobStatus(id, "cancelled");
    await logJobEvent(id, "info", "Job cancelled by user");
    return true;
  }

  return false;
}

export async function retryJob(id: string): Promise<boolean> {
  const job = await getJob(id);

  if (!job || job.status !== "failed") return false;

  await updateJobStatus(id, "pending", {
    error: undefined,
    attempts: 0,
  });

  const jobPayload = job.payload as JobPayload;
  const useRedis = await checkRedisAvailability();

  if (useRedis) {
    const queue = getQueue();
    if (queue) {
      await queue.add(job.type, jobPayload, {
        jobId: id,
        priority: job.priority ?? 0,
        attempts: job.maxAttempts ?? 3,
      });
    }
  } else {
    await logJobEvent(id, "info", "Retrying job synchronously");
    processJobLocally(id, jobPayload).catch((err) => {
      console.error(`[Queue] Job ${id} retry failed:`, err);
    });
  }

  await logJobEvent(id, "info", "Job retry requested");

  return true;
}

export async function getQueueStats(): Promise<QueueStats> {
  const stats = await db
    .select({
      status: jobTable.status,
      count: sql<number>`count(*)`.as("count"),
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

export async function getJobsByUser(
  userId: string,
  options?: { status?: JobStatus; limit?: number; offset?: number }
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = db
    .select()
    .from(jobTable)
    .where(eq(jobTable.userId, userId))
    .orderBy(jobTable.createdAt)
    .limit(limit)
    .offset(offset);

  return query;
}

export async function getJobsByStatus(
  status: JobStatus,
  options?: { limit?: number; offset?: number }
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return db
    .select()
    .from(jobTable)
    .where(eq(jobTable.status, status))
    .orderBy(jobTable.createdAt)
    .limit(limit)
    .offset(offset);
}

export async function cleanOldJobs(olderThanDays: number = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await db
    .delete(jobTable)
    .where(eq(jobTable.status, "completed"))
    .execute();

  return result.changes ?? 0;
}

export function isRedisAvailable(): boolean | null {
  return redisAvailable;
}

export * from "./types";
export * from "./redis";
export * from "./worker";
