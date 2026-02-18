# Database

SQLite + Drizzle ORM with better-sqlite3 driver.

## Schema Location

**File:** `src/db/schema.ts`

All tables and relations defined in one file.

## Tables

| Table | Purpose |
|-------|---------|
| `user` | User accounts (better-auth) |
| `session` | Auth sessions |
| `account` | OAuth accounts |
| `verification` | Email verification tokens |
| `job` | Job queue records |
| `jobLog` | Job execution logs |

### Job Table Columns

The `job` table includes these key columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `type` | TEXT | Job type (e.g., `ai.generate_text`, `agent.run`) |
| `status` | TEXT | pending, running, completed, failed, cancelled |
| `payload` | JSON | Job payload |
| `result` | JSON | Job result |
| `parentJobId` | TEXT | Optional parent job ID for hierarchies |
| `userId` | TEXT | User who created the job |
| `priority` | INTEGER | Job priority (default: 0) |
| `progress` | INTEGER | Progress percentage (0-100) |
| `attempts` | INTEGER | Current attempt count |
| `maxAttempts` | INTEGER | Maximum retry attempts |

### Job Indexes

- `job_status_idx` - Filter by status
- `job_type_idx` - Filter by job type
- `job_userId_idx` - Filter by user
- `job_createdAt_idx` - Time-based queries

## Drizzle Instance

**File:** `src/db/db.ts`

```ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database("sqlite.db");
export const db = drizzle(sqlite, { schema });
```

## Usage

```ts
import { db } from "@/db/db";
import { user, job } from "@/db/schema";
import { eq } from "drizzle-orm";

// Select
const users = await db.select().from(user);
const [found] = await db.select().from(user).where(eq(user.id, "123")).limit(1);

// Insert
await db.insert(user).values({ id: "123", name: "Test", email: "test@example.com" });

// Update
await db.update(user).set({ name: "New Name" }).where(eq(user.id, "123"));

// Delete
await db.delete(user).where(eq(user.id, "123"));
```

## Migrations

```bash
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Apply migrations
npx drizzle-kit studio     # Open database GUI
```

**Config:** `drizzle.config.ts`

## Adding a Table

1. Define in `src/db/schema.ts`:

```ts
export const myTable = sqliteTable("my_table", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
}, (table) => [
  index("my_table_userId_idx").on(table.userId),
]);

export const myTableRelations = relations(myTable, ({ one }) => ({
  user: one(user, { fields: [myTable.userId], references: [user.id] }),
}));
```

2. Generate migration:
```bash
npx drizzle-kit generate
```

3. Apply:
```bash
npx drizzle-kit migrate
```

## Timestamps Pattern

SQLite uses integer milliseconds:

```ts
createdAt: integer("created_at", { mode: "timestamp_ms" })
  .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
  .notNull(),

updatedAt: integer("updated_at", { mode: "timestamp_ms" })
  .$onUpdate(() => new Date())
  .notNull(),
```

## JSON Columns

```ts
payload: text("payload", { mode: "json" }).notNull(),
metadata: text("metadata", { mode: "json" }),
```

## Indexes

Define inline with table:

```ts
(table) => [
  index("job_status_idx").on(table.status),
  index("job_userId_idx").on(table.userId),
]
```

## Relations

```ts
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const jobRelations = relations(job, ({ one, many }) => ({
  user: one(user, { fields: [job.userId], references: [user.id] }),
  parentJob: one(job, { fields: [job.parentJobId], references: [job.id], relationName: "parent_child_jobs" }),
  childJobs: many(job, { relationName: "parent_child_jobs" }),
  logs: many(jobLog),
}));
```

---

## Traces Database

The tracing system uses a separate SQLite database (`traces.db`) stored in the project root.

**File:** `traces.db` (created by Python workers)

### traces Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | Trace name |
| `user_id` | TEXT | User identifier |
| `session_id` | TEXT | Session identifier |
| `request_id` | TEXT | Request identifier |
| `metadata` | JSON | Custom metadata |
| `started_at` | TEXT | ISO 8601 timestamp |
| `completed_at` | TEXT | Completion timestamp |
| `status` | TEXT | UNSET, OK, or ERROR |
| `span_count` | INTEGER | Number of spans |
| `total_duration_ms` | REAL | Total duration |

### spans Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `trace_id` | TEXT | Foreign key to traces |
| `parent_id` | TEXT | Parent span ID |
| `name` | TEXT | Span name |
| `kind` | TEXT | INTERNAL, CLIENT, SERVER, PRODUCER, CONSUMER |
| `span_type` | TEXT | agent.run, tool.call, model.request, etc. |
| `start_time` | INTEGER | Start time in microseconds |
| `end_time` | INTEGER | End time in microseconds |
| `duration_us` | INTEGER | Duration in microseconds |
| `attributes` | JSON | Key-value attributes |
| `status` | TEXT | UNSET, OK, or ERROR |
| `events` | JSON | List of events |

### Traces Indexes

- `idx_spans_trace_id` - Lookup spans by trace
- `idx_spans_parent_id` - Build span hierarchy
- `idx_traces_user_id` - Filter by user
- `idx_traces_session_id` - Filter by session
- `idx_spans_name` - Search by span name
- `idx_spans_start_time` - Time-based queries

## Key Files

| File | Purpose |
|------|---------|
| `src/db/db.ts` | Drizzle instance export |
| `src/db/schema.ts` | All tables and relations |
| `drizzle.config.ts` | Migration config |
| `drizzle/` | Generated migrations |
| `sqlite.db` | Database file (gitignored) |
