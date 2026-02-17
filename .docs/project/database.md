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
  jobs: many(job),
}));

export const jobRelations = relations(job, ({ one }) => ({
  user: one(user, { fields: [job.userId], references: [user.id] }),
}));
```

## Key Files

| File | Purpose |
|------|---------|
| `src/db/db.ts` | Drizzle instance export |
| `src/db/schema.ts` | All tables and relations |
| `drizzle.config.ts` | Migration config |
| `drizzle/` | Generated migrations |
| `sqlite.db` | Database file (gitignored) |
