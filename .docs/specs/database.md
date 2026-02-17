# Database Schema

> SQLite schema for job persistence using Drizzle ORM.

## Tables

### `job` Table

Primary table for storing job state and metadata.

```typescript
// src/db/schema.ts

export const job = sqliteTable("job", {
  // Primary key (UUID)
  id: text("id").primaryKey(),
  
  // Job type identifier (e.g., "ai.generate_text")
  type: text("type").notNull(),
  
  // Current status
  status: text("status", { 
    enum: ["pending", "running", "completed", "failed", "cancelled"] 
  })
    .default("pending")
    .notNull(),
  
  // Priority for queue ordering (higher = more urgent)
  priority: integer("priority").default(0).notNull(),
  
  // Full job payload (JSON)
  payload: text("payload", { mode: "json" }).notNull(),
  
  // Job result on completion (JSON)
  result: text("result", { mode: "json" }),
  
  // Error message on failure
  error: text("error"),
  
  // Progress percentage (0-100)
  progress: integer("progress").default(0),
  
  // Human-readable progress message
  progressMessage: text("progress_message"),
  
  // Current attempt number
  attempts: integer("attempts").default(0).notNull(),
  
  // Maximum retry attempts
  maxAttempts: integer("max_attempts").default(3).notNull(),
  
  // Owner reference
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  
  // Timing
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
  
  // Scheduled execution time
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
  
  // Parent job for job hierarchies
  parentJobId: text("parent_job_id"),
}, (table) => [
  index("job_status_idx").on(table.status),
  index("job_type_idx").on(table.type),
  index("job_userId_idx").on(table.userId),
  index("job_createdAt_idx").on(table.createdAt),
]);
```

### `job_log` Table

Event log for job execution details.

```typescript
// src/db/schema.ts

export const jobLog = sqliteTable("job_log", {
  id: text("id").primaryKey(),
  
  // Associated job
  jobId: text("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
  
  // Log level
  level: text("level", { 
    enum: ["info", "warn", "error", "debug"] 
  })
    .default("info")
    .notNull(),
  
  // Log message
  message: text("message").notNull(),
  
  // Additional structured data (JSON)
  metadata: text("metadata", { mode: "json" }),
  
  // Timestamp
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
}, (table) => [
  index("job_log_jobId_idx").on(table.jobId),
]);
```

### Relations

```typescript
// src/db/schema.ts

export const jobRelations = relations(job, ({ one, many }) => ({
  // Job owner
  user: one(user, {
    fields: [job.userId],
    references: [user.id],
  }),
  
  // Parent job (for job hierarchies)
  parentJob: one(job, {
    fields: [job.parentJobId],
    references: [job.id],
    relationName: "parent_child_jobs",
  }),
  
  // Child jobs
  childJobs: many(job, { relationName: "parent_child_jobs" }),
  
  // Execution logs
  logs: many(jobLog),
}));

export const jobLogRelations = relations(jobLog, ({ one }) => ({
  job: one(job, {
    fields: [jobLog.jobId],
    references: [job.id],
  }),
}));
```

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `job_status_idx` | job | status | Filter by status |
| `job_type_idx` | job | type | Filter by type |
| `job_userId_idx` | job | userId | Filter by user |
| `job_createdAt_idx` | job | createdAt | Order by creation time |
| `job_log_jobId_idx` | job_log | jobId | Join logs to job |

## Migrations

### Generating Migrations

```bash
npx drizzle-kit generate
```

### Applying Migrations

```bash
npx drizzle-kit migrate
```

### Example Migration

```sql
-- drizzle/0001_bored_frank_castle.sql
CREATE TABLE `job` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `priority` integer DEFAULT 0 NOT NULL,
  `payload` text NOT NULL,
  `result` text,
  `error` text,
  `progress` integer DEFAULT 0,
  `progress_message` text,
  `attempts` integer DEFAULT 0 NOT NULL,
  `max_attempts` integer DEFAULT 3 NOT NULL,
  `user_id` text REFERENCES `user`(`id`) ON DELETE set null,
  `started_at` integer,
  `completed_at` integer,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `scheduled_for` integer,
  `parent_job_id` text
);

CREATE TABLE `job_log` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL REFERENCES `job`(`id`) ON DELETE cascade,
  `level` text DEFAULT 'info' NOT NULL,
  `message` text NOT NULL,
  `metadata` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX `job_status_idx` ON `job` (`status`);
CREATE INDEX `job_type_idx` ON `job` (`type`);
CREATE INDEX `job_userId_idx` ON `job` (`user_id`);
CREATE INDEX `job_createdAt_idx` ON `job` (`created_at`);
CREATE INDEX `job_log_jobId_idx` ON `job_log` (`job_id`);
```

## TypeScript Types

### Job Select Type

```typescript
type Job = {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  progressMessage: string | null;
  attempts: number;
  maxAttempts: number;
  userId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor: Date | null;
  parentJobId: string | null;
};
```

### Job Log Select Type

```typescript
type JobLog = {
  id: string;
  jobId: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};
```

### Job With Logs

```typescript
type JobWithLogs = Job & {
  logs: JobLog[];
};
```

## Query Examples

### Get Job by ID

```typescript
const job = await db
  .select()
  .from(jobTable)
  .where(eq(jobTable.id, jobId))
  .limit(1);
```

### Get Jobs by User

```typescript
const jobs = await db
  .select()
  .from(jobTable)
  .where(eq(jobTable.userId, userId))
  .orderBy(desc(jobTable.createdAt))
  .limit(50);
```

### Get Jobs by Status

```typescript
const pendingJobs = await db
  .select()
  .from(jobTable)
  .where(eq(jobTable.status, "pending"))
  .orderBy(jobTable.priority, jobTable.createdAt);
```

### Get Queue Statistics

```typescript
const stats = await db
  .select({
    status: jobTable.status,
    count: sql<number>`count(*)`.as("count"),
  })
  .from(jobTable)
  .groupBy(jobTable.status);
```

### Get Job with Logs

```typescript
const job = await db
  .select()
  .from(jobTable)
  .where(eq(jobTable.id, jobId))
  .limit(1);

const logs = await db
  .select()
  .from(jobLogTable)
  .where(eq(jobLogTable.jobId, jobId))
  .orderBy(jobLogTable.createdAt);
```

### Update Job Status

```typescript
await db
  .update(jobTable)
  .set({
    status: "running",
    startedAt: new Date(),
    updatedAt: new Date(),
  })
  .where(eq(jobTable.id, jobId));
```

### Create Job Log Entry

```typescript
await db.insert(jobLogTable).values({
  id: uuidv4(),
  jobId,
  level: "info",
  message: "Job started",
  metadata: { attempt: 1 },
});
```
