import { Worker, Job } from "bullmq";
import { spawn, ChildProcess } from "child_process";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getRedisConnectionOptions } from "./redis";
import { updateJobStatus, updateJobProgress, logJobEvent } from "./index";
import type { JobPayload, JobResult, JobProgress, PythonWorkerMessage } from "./types";

const QUEUE_NAME = "python-jobs";
const WORKER_DIR = join(process.cwd(), "python-workers");
const TEMP_DIR = join(process.cwd(), ".job-temp");

interface ActiveWorker {
  process: ChildProcess;
  jobId: string;
  startedAt: number;
}

const activeWorkers = new Map<string, ActiveWorker>();

async function ensureTempDir(): Promise<void> {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

function parseWorkerMessage(line: string): PythonWorkerMessage | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed.type === "string") {
      return parsed as PythonWorkerMessage;
    }
  } catch {
    // Not JSON, treat as stdout
  }
  return null;
}

async function handleWorkerMessage(
  jobId: string,
  message: PythonWorkerMessage
): Promise<void> {
  switch (message.type) {
    case "progress":
      await updateJobProgress(jobId, message.payload as JobProgress);
      break;
    case "log":
      console.log(`[Python Worker ${jobId}]`, message.payload);
      break;
    case "heartbeat":
      // Worker is alive, could update lastSeen timestamp
      break;
    default:
      console.warn(`[Python Worker ${jobId}] Unknown message type:`, message.type);
  }
}

export async function executePythonJob(
  jobId: string,
  payload: JobPayload
): Promise<JobResult> {
  await ensureTempDir();

  const inputPath = join(TEMP_DIR, `${jobId}-input.json`);
  const outputPath = join(TEMP_DIR, `${jobId}-output.json`);
  const workerScript = join(WORKER_DIR, "worker.py");

  const inputData = {
    jobId,
    payload,
    inputPath,
    outputPath,
  };

  await writeFile(inputPath, JSON.stringify(inputData, null, 2));

  const pythonPath = process.env.PYTHON_PATH || "python";

  return new Promise((resolve, reject) => {
    const workerProcess = spawn(pythonPath, [workerScript, inputPath], {
      cwd: WORKER_DIR,
      env: {
        ...process.env,
        JOB_ID: jobId,
        PYTHONUNBUFFERED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    activeWorkers.set(jobId, {
      process: workerProcess,
      jobId,
      startedAt: Date.now(),
    });

    let stdout = "";
    let stderr = "";

    workerProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        const message = parseWorkerMessage(line);
        if (message) {
          handleWorkerMessage(jobId, message).catch(console.error);
        } else {
          stdout += line + "\n";
        }
      }
    });

    workerProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timeout = payload.timeout ?? 300000; // 5 min default
    const timeoutId = setTimeout(() => {
      workerProcess.kill("SIGTERM");
      reject(new Error(`Job ${jobId} timed out after ${timeout}ms`));
    }, timeout);

    workerProcess.on("close", async (code) => {
      clearTimeout(timeoutId);
      activeWorkers.delete(jobId);

      try {
        if (code === 0 && existsSync(outputPath)) {
          const outputData = await readFile(outputPath, "utf-8");
          const result = JSON.parse(outputData) as JobResult;

          // Cleanup temp files
          await Promise.all([
            unlink(inputPath).catch(() => {}),
            unlink(outputPath).catch(() => {}),
          ]);

          resolve(result);
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
            metadata: { stdout, stderr, exitCode: code },
          });
        }
      } catch (err) {
        resolve({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error reading output",
          metadata: { stdout, stderr, exitCode: code },
        });
      }
    });

    workerProcess.on("error", (err) => {
      clearTimeout(timeoutId);
      activeWorkers.delete(jobId);
      resolve({
        success: false,
        error: `Failed to spawn Python process: ${err.message}`,
      });
    });
  });
}

export function createJobWorker(): Worker {
  if (typeof window !== "undefined") {
    throw new Error("Worker cannot be used in browser");
  }

  const connection = getRedisConnectionOptions();
  const maxWorkers = parseInt(process.env.MAX_PYTHON_WORKERS || "4", 10);

  const worker = new Worker(
    QUEUE_NAME,
    async (bullJob: Job) => {
      const jobId = bullJob.id!;
      const payload = bullJob.data as JobPayload;

      await updateJobStatus(jobId, "running", {
        attempts: bullJob.attemptsMade,
        startedAt: new Date(),
      });

      await logJobEvent(jobId, "info", `Job started (attempt ${bullJob.attemptsMade + 1}/${bullJob.opts.attempts})`);

      const startTime = Date.now();

      try {
        const result = await executePythonJob(jobId, payload);
        const duration = Date.now() - startTime;

        if (result.success) {
          await updateJobStatus(jobId, "completed", {
            result,
            completedAt: new Date(),
          });
          await logJobEvent(jobId, "info", `Job completed successfully in ${duration}ms`);
        } else {
          throw new Error(result.error || "Job execution failed");
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await logJobEvent(jobId, "error", `Job failed: ${errorMessage}`, {
          duration,
          attempt: bullJob.attemptsMade + 1,
        });

        if (bullJob.attemptsMade >= (bullJob.opts.attempts ?? 3) - 1) {
          await updateJobStatus(jobId, "failed", {
            error: errorMessage,
            completedAt: new Date(),
          });
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: maxWorkers,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (bullJob: Job) => {
    console.log(`[Worker] Job ${bullJob.id} completed`);
  });

  worker.on("failed", (bullJob: Job | undefined, err: Error) => {
    console.error(`[Worker] Job ${bullJob?.id} failed:`, err.message);
  });

  worker.on("error", (err: Error) => {
    console.error("[Worker] Worker error:", err);
  });

  worker.on("stalled", (jobId: string) => {
    console.warn(`[Worker] Job ${jobId} stalled`);
    logJobEvent(jobId, "warn", "Job stalled and will be retried").catch(console.error);
  });

  return worker;
}

export function getWorker(): Worker | undefined {
  return globalThis.jobWorker;
}

export function startWorker(): Worker {
  if (!globalThis.jobWorker) {
    globalThis.jobWorker = createJobWorker();
  }
  return globalThis.jobWorker;
}

export async function stopWorker(): Promise<void> {
  if (globalThis.jobWorker) {
    await globalThis.jobWorker.close();
    globalThis.jobWorker = undefined;
  }
}

export function getActiveWorkers(): Array<{ jobId: string; runningTime: number }> {
  return Array.from(activeWorkers.entries()).map(([jobId, worker]) => ({
    jobId,
    runningTime: Date.now() - worker.startedAt,
  }));
}

export async function killWorker(jobId: string): Promise<boolean> {
  const worker = activeWorkers.get(jobId);
  if (worker) {
    worker.process.kill("SIGTERM");
    return true;
  }
  return false;
}
