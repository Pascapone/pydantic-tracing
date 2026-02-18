export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type JobType =
  | "ai.generate_text"
  | "ai.generate_image"
  | "ai.analyze_data"
  | "ai.embeddings"
  | "agent.run"
  | "data.process"
  | "data.transform"
  | "data.export"
  | "custom";

export interface BaseJobPayload {
  timeout?: number;
  priority?: number;
  maxAttempts?: number;
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

export interface AIGenerateTextPayload extends BaseJobPayload {
  type: "ai.generate_text";
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface AIGenerateImagePayload extends BaseJobPayload {
  type: "ai.generate_image";
  model: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}

export interface AIAnalyzeDataPayload extends BaseJobPayload {
  type: "ai.analyze_data";
  model: string;
  data: unknown;
  analysisType: "classification" | "extraction" | "sentiment" | "summary" | "custom";
  instructions?: string;
}

export interface AIEmbeddingsPayload extends BaseJobPayload {
  type: "ai.embeddings";
  model: string;
  texts: string[];
  batchSize?: number;
}

export interface DataProcessPayload extends BaseJobPayload {
  type: "data.process";
  operation: string;
  input: unknown;
  options?: Record<string, unknown>;
}

export interface DataTransformPayload extends BaseJobPayload {
  type: "data.transform";
  transformer: string;
  input: unknown;
  schema?: Record<string, unknown>;
}

export interface DataExportPayload extends BaseJobPayload {
  type: "data.export";
  format: "json" | "csv" | "xlsx" | "parquet";
  data: unknown;
  filename?: string;
}

export interface CustomPayload extends BaseJobPayload {
  type: "custom";
  handler: string;
  args: unknown[];
  kwargs?: Record<string, unknown>;
}

export type JobPayload =
  | AIGenerateTextPayload
  | AIGenerateImagePayload
  | AIAnalyzeDataPayload
  | AIEmbeddingsPayload
  | DataProcessPayload
  | DataTransformPayload
  | DataExportPayload
  | CustomPayload;

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
}

export interface JobProgress {
  percentage: number;
  message?: string;
  step?: string;
  metadata?: Record<string, unknown>;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface PythonWorkerMessage {
  type: "progress" | "log" | "result" | "error" | "heartbeat";
  jobId: string;
  timestamp: number;
  payload: unknown;
}

export interface PythonWorkerConfig {
  pythonPath?: string;
  workerScript: string;
  timeout: number;
  maxWorkers: number;
  env?: Record<string, string>;
}
