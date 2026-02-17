import { useState, useCallback, useEffect, useRef } from "react";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  progressMessage: string | null;
  attempts: number;
  maxAttempts: number;
  userId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobWithLogs extends Job {
  logs: Array<{
    id: string;
    jobId: string;
    level: "info" | "warn" | "error" | "debug";
    message: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface CreateJobInput {
  type: string;
  payload: Record<string, unknown>;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  };
}

const API_BASE = "/api/jobs";

export function useJobs(userId: string | undefined, options?: { pollInterval?: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = options?.pollInterval ?? 5000;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE}?userId=${userId}&limit=50`);
      if (!response.ok) throw new Error("Failed to fetch jobs");
      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchJobs();

    intervalRef.current = setInterval(fetchJobs, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchJobs, pollInterval]);

  const createJob = useCallback(async (input: CreateJobInput): Promise<string> => {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, userId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create job");
    }

    const data = await response.json();
    await fetchJobs();
    return data.jobId;
  }, [userId, fetchJobs]);

  const cancelJob = useCallback(async (jobId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${jobId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to cancel job");
    }
    await fetchJobs();
  }, [fetchJobs]);

  const retryJob = useCallback(async (jobId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to retry job");
    }
    await fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    error,
    createJob,
    cancelJob,
    retryJob,
    refetch: fetchJobs,
  };
}

export function useJob(jobId: string | null, options?: { pollInterval?: number }) {
  const [job, setJob] = useState<JobWithLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = options?.pollInterval ?? 2000;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`${API_BASE}/${jobId}?logs=true`);
      if (!response.ok) throw new Error("Failed to fetch job");
      const data = await response.json();
      setJob(data.job);
      setError(null);

      if (data.job.status === "completed" || data.job.status === "failed" || data.job.status === "cancelled") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchJob();

    intervalRef.current = setInterval(fetchJob, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [jobId, fetchJob, pollInterval]);

  return { job, loading, error, refetch: fetchJob };
}

export function useQueueStats(options?: { pollInterval?: number }) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = options?.pollInterval ?? 10000;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}?stats=true`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStats, pollInterval]);

  return { stats, loading, error, refetch: fetchStats };
}

export const JOB_TEMPLATES = {
  textGeneration: {
    type: "ai.generate_text",
    name: "AI Text Generation",
    description: "Generate text using AI models like GPT-4",
    icon: "sparkles",
    defaultPayload: {
      model: "gpt-4",
      prompt: "",
      temperature: 0.7,
      maxTokens: 1000,
    },
    fields: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, placeholder: "Enter your prompt..." },
      { key: "model", label: "Model", type: "select", options: ["gpt-4", "gpt-3.5-turbo", "claude-3"] },
      { key: "temperature", label: "Temperature", type: "number", min: 0, max: 2, step: 0.1 },
      { key: "maxTokens", label: "Max Tokens", type: "number", min: 100, max: 4000 },
    ],
  },
  imageGeneration: {
    type: "ai.generate_image",
    name: "AI Image Generation",
    description: "Generate images with DALL-E or Stable Diffusion",
    icon: "image",
    defaultPayload: {
      model: "dall-e-3",
      prompt: "",
      width: 1024,
      height: 1024,
    },
    fields: [
      { key: "prompt", label: "Image Description", type: "textarea", required: true, placeholder: "Describe the image you want..." },
      { key: "model", label: "Model", type: "select", options: ["dall-e-3", "dall-e-2", "stable-diffusion"] },
      { key: "width", label: "Width", type: "number", min: 256, max: 2048 },
      { key: "height", label: "Height", type: "number", min: 256, max: 2048 },
    ],
  },
  dataProcessing: {
    type: "data.process",
    name: "Data Processing",
    description: "Process and transform data with Python",
    icon: "data",
    defaultPayload: {
      operation: "transform",
      input: [],
      options: {},
    },
    fields: [
      { key: "operation", label: "Operation", type: "select", options: ["filter", "transform", "aggregate", "sort"] },
      { key: "input", label: "Input Data", type: "textarea", placeholder: "JSON array or object..." },
    ],
  },
} as const;

export type JobTemplateKey = keyof typeof JOB_TEMPLATES;
