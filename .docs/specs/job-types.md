# Job Types

> Job type definitions, payloads, and handlers.

## Available Job Types

| Type | Category | Description |
|------|----------|-------------|
| `ai.generate_text` | AI | Text generation with LLMs |
| `ai.generate_image` | AI | Image generation (DALL-E, SD) |
| `ai.analyze_data` | AI | Data analysis and extraction |
| `ai.embeddings` | AI | Text embeddings generation |
| `agent.run` | AI | Execute pydantic-ai agents with tracing |
| `data.process` | Data | General data processing |
| `data.transform` | Data | Data transformation pipelines |
| `data.export` | Data | Export to various formats |
| `custom` | Custom | User-defined handlers |

---

## AI Job Types

### ai.generate_text

Generate text using AI language models.

**Payload:**

```typescript
interface AIGenerateTextPayload {
  type: "ai.generate_text";
  
  // Required
  prompt: string;
  
  // Optional
  model?: string;           // Default: "gpt-4"
  systemPrompt?: string;    // System message for chat models
  temperature?: number;     // 0-2, default: 0.7
  maxTokens?: number;       // Default: 2000
  stopSequences?: string[]; // Stop generation at these sequences
  
  // Common options
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface AIGenerateTextResult {
  text: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: "stop" | "length" | "content_filter";
}
```

**Example:**

```json
{
  "type": "ai.generate_text",
  "prompt": "Write a haiku about programming",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 500
}
```

---

### ai.generate_image

Generate images with AI models.

**Payload:**

```typescript
interface AIGenerateImagePayload {
  type: "ai.generate_image";
  
  // Required
  prompt: string;
  
  // Optional
  model?: string;          // Default: "dall-e-3"
  negativePrompt?: string; // What to avoid
  width?: number;          // Default: 1024
  height?: number;         // Default: 1024
  steps?: number;          // For SD, default: 30
  seed?: number;           // Reproducibility
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface AIGenerateImageResult {
  image_url: string;
  model: string;
  width: number;
  height: number;
  steps?: number;
  seed?: number;
}
```

**Example:**

```json
{
  "type": "ai.generate_image",
  "prompt": "A serene mountain landscape at sunset",
  "model": "dall-e-3",
  "width": 1024,
  "height": 1024
}
```

---

### ai.analyze_data

Analyze data using AI.

**Payload:**

```typescript
interface AIAnalyzeDataPayload {
  type: "ai.analyze_data";
  
  // Required
  model: string;
  data: unknown;
  analysisType: "classification" | "extraction" | "sentiment" | "summary" | "custom";
  
  // Optional
  instructions?: string;    // Custom instructions
  schema?: Record<string, unknown>; // Output schema
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface AIAnalyzeDataResult {
  analysis_type: string;
  insights: string[];
  confidence: number;
  metadata: {
    model: string;
    data_points: number;
  };
}
```

**Example:**

```json
{
  "type": "ai.analyze_data",
  "model": "gpt-4",
  "data": ["Product A: Great!", "Product B: Terrible"],
  "analysisType": "sentiment"
}
```

---

### ai.embeddings

Generate text embeddings.

**Payload:**

```typescript
interface AIEmbeddingsPayload {
  type: "ai.embeddings";
  
  // Required
  model: string;
  texts: string[];
  
  // Optional
  batchSize?: number; // Default: 100
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface AIEmbeddingsResult {
  embeddings: number[][];  // Array of embedding vectors
  model: string;
  dimensions: number;
  total_texts: number;
}
```

**Example:**

```json
{
  "type": "ai.embeddings",
  "model": "text-embedding-3-small",
  "texts": ["Hello world", "Goodbye world"]
}
```

---

### agent.run

Execute pydantic-ai agents with full tracing support.

**Payload:**

```typescript
interface AgentRunPayload {
  type: "agent.run";
  
  // Required
  agent: "research" | "coding" | "analysis" | "orchestrator";
  prompt: string;
  
  // Optional
  model?: string;         // Default: "openrouter:minimax/minimax-m2.5"
  userId?: string;        // User identifier for trace
  sessionId?: string;     // Session identifier for trace
  requestId?: string;     // Request identifier for trace
  options?: {
    streaming?: boolean;
    maxTokens?: number;
    timeout?: number;     // Default: 120 seconds
  };
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface AgentRunResult {
  trace_id: string;       // UUID for viewing in traces UI
  agent_type: string;
  output: object;         // Agent-specific output
  duration_ms: number;
  status: "ok" | "error";
  model: string;
  error?: {
    type: string;
    message: string;
  };
}
```

**Example:**

```json
{
  "type": "agent.run",
  "agent": "research",
  "prompt": "What are the best practices for async Python?",
  "userId": "user-123",
  "sessionId": "session-456"
}
```

**Handler:** `python-workers/handlers/agent_trace.py`

**See Also:** [AI Agents & Tracing](../project/ai-agents.md)

---

## Data Job Types

### data.process

General data processing operations.

**Payload:**

```typescript
interface DataProcessPayload {
  type: "data.process";
  
  // Required
  operation: "filter" | "transform" | "aggregate" | "sort" | "custom";
  input: unknown;
  
  // Optional
  options?: Record<string, unknown>;
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface DataProcessResult {
  // Varies by operation
  // For filter: filtered array
  // For aggregate: aggregated stats
  // For transform: transformed data
}
```

**Example:**

```json
{
  "type": "data.process",
  "operation": "filter",
  "input": [1, 2, 3, 4, 5],
  "options": { "predicate": "x > 2" }
}
```

---

### data.transform

Data transformation pipelines.

**Payload:**

```typescript
interface DataTransformPayload {
  type: "data.transform";
  
  // Required
  transformer: string;
  input: unknown;
  
  // Optional
  schema?: Record<string, unknown>;
  options?: Record<string, unknown>;
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface DataTransformResult {
  transformed: boolean;
  transformer: string;
  input_type: string;
  output: unknown;
}
```

---

### data.export

Export data to various formats.

**Payload:**

```typescript
interface DataExportPayload {
  type: "data.export";
  
  // Required
  format: "json" | "csv" | "xlsx" | "parquet";
  data: unknown;
  
  // Optional
  filename?: string;
  options?: {
    sheet?: string;      // For xlsx
    delimiter?: string;  // For csv
    compression?: string;
  };
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface DataExportResult {
  filename: string;
  format: string;
  size_bytes: number;
  download_url: string;
}
```

**Example:**

```json
{
  "type": "data.export",
  "format": "csv",
  "data": [["name", "age"], ["Alice", 30], ["Bob", 25]],
  "filename": "users"
}
```

---

## Custom Job Type

### custom

User-defined custom handlers.

**Payload:**

```typescript
interface CustomPayload {
  type: "custom";
  
  // Required
  handler: string;  // Handler identifier
  
  // Optional
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  
  timeout?: number;
  metadata?: Record<string, unknown>;
}
```

**Result:**

```typescript
interface CustomResult {
  handler: string;
  result: unknown;
}
```

**Example:**

```json
{
  "type": "custom",
  "handler": "my_custom_task",
  "kwargs": {
    "param1": "value1",
    "param2": 42
  }
}
```

---

## Common Payload Fields

All payloads support these common fields:

```typescript
interface BaseJobPayload {
  // Execution timeout in milliseconds
  timeout?: number;
  
  // Job metadata (passed through to result)
  metadata?: Record<string, unknown>;
  
  // Scheduling
  scheduledFor?: Date;
}
```

---

## Validation

### Frontend Validation

```typescript
const validJobTypes = [
  "ai.generate_text",
  "ai.generate_image",
  "ai.analyze_data",
  "ai.embeddings",
  "agent.run",
  "data.process",
  "data.transform",
  "data.export",
  "custom",
];

function validateJobInput(input: CreateJobInput): string | null {
  if (!input.type) return "type is required";
  if (!validJobTypes.includes(input.type)) return "invalid job type";
  if (!input.payload) return "payload is required";
  return null;
}
```

### Backend Validation

```typescript
function validatePayload(type: string, payload: unknown): string | null {
  switch (type) {
    case "ai.generate_text":
      if (!payload.prompt) return "prompt is required";
      break;
    case "ai.generate_image":
      if (!payload.prompt) return "prompt is required";
      break;
    case "agent.run":
      if (!payload.agent) return "agent is required";
      if (!payload.prompt) return "prompt is required";
      if (!["research", "coding", "analysis", "orchestrator"].includes(payload.agent)) {
        return "invalid agent type";
      }
      break;
    case "data.process":
      if (!payload.operation) return "operation is required";
      break;
    // ... other types
  }
  return null;
}
```

---

## Handler Mapping

### Implemented Handlers

| Type | Handler Class | File |
|------|--------------|------|
| `ai.openai.text` | `OpenAITextHandler` | `handlers/__init__.py` |
| `ai.anthropic.text` | `AnthropicTextHandler` | `handlers/__init__.py` |
| `agent.run` | `AgentTraceHandler` | `handlers/agent_trace.py` |
| `data.batch` | `BatchProcessHandler` | `handlers/__init__.py` |
| `data.pipeline` | `DataPipelineHandler` | `handlers/__init__.py` |

### Planned Handlers (Not Yet Implemented)

| Type | Planned Handler | Status |
|------|----------------|--------|
| `ai.generate_text` | Generic text handler | Use `ai.openai.text` or `ai.anthropic.text` |
| `ai.generate_image` | Image generation | Planned |
| `ai.analyze_data` | Data analysis | Planned |
| `ai.embeddings` | Embedding generation | Planned |
| `data.process` | General processing | Use `data.batch` |
| `data.transform` | Transformation | Use `data.pipeline` |
| `data.export` | Export functionality | Planned |
| `custom` | Custom handlers | Implement your own |
