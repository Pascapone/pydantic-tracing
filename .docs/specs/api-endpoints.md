# API Endpoints

> REST API specifications for job management.

## Base URL

```
/api/jobs
```

## Endpoints

### POST /api/jobs

Create a new job.

**Request Body:**

```typescript
{
  type: "ai.generate_text" | "ai.generate_image" | "ai.analyze_data" | 
        "ai.embeddings" | "data.process" | "data.transform" | "data.export" | "custom",
  payload: Record<string, unknown>,
  userId?: string,
  options?: {
    priority?: number,      // Default: 0
    delay?: number,         // Milliseconds
    attempts?: number,      // Default: 3
  }
}
```

**Response (201):**

```json
{
  "jobId": "abc-123-def",
  "status": "created"
}
```

**Error Response (400):**

```json
{
  "error": "Invalid job type",
  "validTypes": ["ai.generate_text", "ai.generate_image", ...]
}
```

**Implementation:**

```typescript
// src/routes/api/jobs/index.ts

export const Route = createFileRoute("/api/jobs/")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json();
        const { type, payload, options, userId } = body;

        // Validate
        if (!type || !payload) {
          return Response.json(
            { error: "type and payload are required" },
            { status: 400 }
          );
        }

        const validTypes = [
          "ai.generate_text",
          "ai.generate_image",
          "ai.analyze_data",
          "ai.embeddings",
          "data.process",
          "data.transform",
          "data.export",
          "custom",
        ];

        if (!validTypes.includes(type)) {
          return Response.json(
            { error: "Invalid job type", validTypes },
            { status: 400 }
          );
        }

        const jobId = await createJob({ type, payload, userId, options });

        return Response.json({ jobId, status: "created" }, { status: 201 });
      },
    },
  },
});
```

---

### GET /api/jobs

List jobs with filtering options.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | string | required | Filter by user |
| `status` | string | - | Filter by status |
| `limit` | number | 50 | Max results |
| `offset` | number | 0 | Pagination offset |

**Response (200):**

```json
{
  "jobs": [
    {
      "id": "abc-123",
      "type": "ai.generate_text",
      "status": "completed",
      "priority": 0,
      "payload": { "prompt": "Hello" },
      "result": { "text": "World" },
      "error": null,
      "progress": 100,
      "progressMessage": null,
      "attempts": 1,
      "maxAttempts": 3,
      "userId": "user-1",
      "startedAt": "2024-01-15T10:00:00.000Z",
      "completedAt": "2024-01-15T10:00:05.000Z",
      "createdAt": "2024-01-15T09:59:55.000Z",
      "updatedAt": "2024-01-15T10:00:05.000Z"
    }
  ]
}
```

**Stats Mode (stats=true):**

```json
{
  "stats": {
    "waiting": 2,
    "active": 1,
    "completed": 10,
    "failed": 0,
    "delayed": 0,
    "paused": 0
  }
}
```

**Single Job (id=...):**

```json
{
  "job": { ... }
}
```

**With Logs (id=...&logs=true):**

```json
{
  "job": {
    "id": "abc-123",
    ...
    "logs": [
      {
        "id": "log-1",
        "jobId": "abc-123",
        "level": "info",
        "message": "Job started",
        "metadata": null,
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

### GET /api/jobs/:id

Get job details.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `logs` | boolean | Include job logs |

**Response (200):**

```json
{
  "job": {
    "id": "abc-123",
    "type": "ai.generate_text",
    "status": "completed",
    ...
  }
}
```

**Error Response (404):**

```json
{
  "error": "Job not found"
}
```

---

### DELETE /api/jobs/:id

Cancel a job.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Response (200):**

```json
{
  "status": "cancelled"
}
```

**Error Response (400):**

```json
{
  "error": "Job not found or cannot be cancelled"
}
```

---

### POST /api/jobs/:id

Retry or update a job.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Request Body:**

```typescript
// Retry failed job
{
  "action": "retry"
}

// Update job (internal use)
{
  "action": "update",
  "status": "running",
  "progress": 50,
  "progressMessage": "Processing...",
  "result": { ... },
  "error": "..."
}
```

**Response (200):**

```json
{
  "status": "retrying"
}
```

**Error Response (400):**

```json
{
  "error": "Job not found or cannot be retried"
}
```

---

### GET /api/jobs/stats

Get queue statistics.

**Response (200):**

```json
{
  "queue": {
    "waiting": 2,
    "active": 1,
    "completed": 10,
    "failed": 0,
    "delayed": 0,
    "paused": 0
  },
  "activeWorkers": [
    {
      "jobId": "abc-123",
      "runningTime": 15000
    }
  ],
  "recent": {
    "pending": 2,
    "running": 1,
    "failed": 0
  }
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "details": { ... }  // Optional additional info
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Authentication

Jobs are associated with users via `userId`. The API expects `userId` in the request body for job creation and as a query parameter for listing.

**Future Enhancement:** Integrate with better-auth session to automatically extract userId.

## Rate Limiting

Not currently implemented. Recommended for production:

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/jobs | 100 | 1 minute |
| GET /api/jobs | 1000 | 1 minute |
| DELETE /api/jobs/:id | 100 | 1 minute |

## Example Usage

### Create Text Generation Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ai.generate_text",
    "payload": {
      "model": "gpt-4",
      "prompt": "Write a haiku about coding"
    },
    "userId": "user-123"
  }'
```

### Check Job Status

```bash
curl http://localhost:3000/api/jobs/abc-123
```

### Get Job with Logs

```bash
curl "http://localhost:3000/api/jobs/abc-123?logs=true"
```

### Cancel Job

```bash
curl -X DELETE http://localhost:3000/api/jobs/abc-123
```

### Retry Failed Job

```bash
curl -X POST http://localhost:3000/api/jobs/abc-123 \
  -H "Content-Type: application/json" \
  -d '{"action": "retry"}'
```

### List User's Jobs

```bash
curl "http://localhost:3000/api/jobs?userId=user-123&limit=10"
```

### Get Queue Stats

```bash
curl http://localhost:3000/api/jobs/stats
```
