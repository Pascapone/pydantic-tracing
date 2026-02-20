# Project Conventions

Patterns and conventions specific to this project.

## File Organization

```
.docs/               # Project documentation and historical records
├── project/         # Core documentation (conventions, testing, db)
├── handoffs/        # Historical session handoffs
├── plans/           # Implementation plans
└── problems/        # Recorded issues and baselines
src/
├── components/       # Shared UI components
│   ├── jobs/        # Job-related components
│   └── tracing/     # Trace viewing components
│       ├── TraceTerminal.tsx   # Main three-panel layout
│       ├── TraceHeader.tsx     # Header with stats
│       ├── TraceTimeline.tsx   # Visual span timeline
│       ├── TraceSidebar.tsx    # Trace list sidebar
│       ├── TraceLogStream.tsx  # Real-time log stream
│       ├── TraceStats.tsx      # Statistics display
│       └── SpanNode.tsx        # Individual span renderer
├── db/              # Database (drizzle)
├── lib/             # Core logic
│   ├── auth.ts      # Server auth
│   ├── auth-client.ts # Client auth hooks
│   ├── permissions.ts # RBAC roles
│   ├── abilities.ts # ReBAC permissions
│   ├── middleware.ts # Route middleware
│   ├── hooks/       # Custom React hooks
│   │   ├── use-jobs.ts      # Job queries
│   │   ├── use-traces.ts    # Trace queries
│   │   └── use-trace-websocket.ts # Real-time updates
│   ├── tracing/     # Tracing utilities
│   │   └── db.ts    # SQLite reader for traces.db
│   └── queue/       # Job queue system
├── routes/          # File-based routing
│   └── api/         # API endpoints
│       ├── auth/$   # Auth endpoints
│       ├── jobs/    # Job API
│       └── traces/  # Traces API
└── types/           # TypeScript declarations

python-workers/      # Python job handlers
├── worker.py        # Main entry point
├── config.py        # Worker configuration
├── handlers/        # Job handlers
│   ├── __init__.py  # Base handler + registry
│   ├── context.py   # JobContext utility
│   └── agent_trace.py # agent.run handler
├── agents/          # Multi-agent system
├── tracing/         # Custom tracing system
└── examples/        # Test scenarios
```

## Route Structure

Routes follow TanStack Router file-based routing:

```
src/routes/
├── __root.tsx       # Root layout
├── index.tsx        # /
├── login.tsx        # /login
├── dashboard.tsx    # /dashboard
├── jobs.tsx         # /jobs
├── traces.tsx       # /traces
└── api/
    ├── auth/$.ts    # /api/auth/* (better-auth)
    ├── jobs/
    │   ├── index.ts # /api/jobs
    │   ├── $id.ts   # /api/jobs/:id
    │   └── stats.ts # /api/jobs/stats
    └── traces/
        ├── index.ts # /api/traces
        └── $id.ts   # /api/traces/:id
```

## API Routes Pattern

Use `server.handlers` in route definitions:

```ts
export const Route = createFileRoute("/api/my-endpoint")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return Response.json({ data: "..." });
      },
      POST: async ({ request }) => {
        const body = await request.json();
        return Response.json({ id: "..." }, { status: 201 });
      },
    },
  },
});
```

## Auth Route

`src/routes/api/auth/$.ts` delegates all `/api/auth/*` to better-auth:

```ts
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
```

## Protected Route Pattern

```ts
import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "@/lib/middleware";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => authMiddleware,
  component: Dashboard,
});
```

## Component Patterns

### Using Session

```tsx
import { useSession } from "@/lib/auth-client";

function MyComponent() {
  const { data: session, isPending } = useSession();
  
  if (isPending) return <div>Loading...</div>;
  if (!session) return null;
  
  return <div>Hello, {session.user.name}</div>;
}
```

### Using Abilities

```tsx
import { useSession } from "@/lib/auth-client";
import { getAbilitiesForUser, parseRoles } from "@/lib/abilities";

function AdminOnly({ children }) {
  const { data: session } = useSession();
  if (!session?.user) return null;
  
  const abilities = getAbilitiesForUser({
    ...session.user,
    roles: parseRoles(session.user.role),
  });
  
  if (!abilities.can("manage", "UserList")) return null;
  return children;
}
```

### Using Jobs Hook

```tsx
import { useJobs, useCreateJob } from "@/lib/hooks/use-jobs";

function JobPanel() {
  const { jobs, isLoading, refetch } = useJobs({ userId: "123" });
  const createJob = useCreateJob();
  
  const handleCreate = () => {
    createJob.mutate({
      type: "ai.generate_text",
      payload: { model: "gpt-4", prompt: "..." },
    });
  };
  
  return (/* ... */);
}
```

### Using Traces Hook

```tsx
import { useTraces, useTrace, useTraceStats } from "@/lib/hooks/use-traces";

function TracePanel() {
  const { traces, isLoading } = useTraces({ userId: "user123" });
  const { trace } = useTrace(traceId, { includeTree: true });
  const { stats } = useTraceStats();
  
  return (
    <div>
      <p>Total traces: {stats?.trace_count}</p>
      {traces.map(t => <div key={t.id}>{t.name}</div>)}
    </div>
  );
}
```

### Using WebSocket for Live Traces

```tsx
import { useTraceWebSocket, useTracesSubscription } from "@/lib/hooks/use-trace-websocket";

// Full control
function LiveTraceViewer({ traceId }: { traceId: string }) {
  const { spans, isConnected } = useTraceWebSocket(traceId);
  
  if (!isConnected) return <div>Connecting...</div>;
  
  return (
    <div>
      {spans.map(span => (
        <div key={span.id}>{span.name}</div>
      ))}
    </div>
  );
}

// Simplified subscription
function TraceMonitor() {
  const { isConnected, error } = useTracesSubscription({
    onTraceCreated: (trace) => console.log("New trace:", trace.id),
    onTraceUpdated: (trace) => console.log("Updated:", trace.id),
  });

  return <div>Monitoring: {isConnected ? "Active" : "Offline"}</div>;
}
```

## Global Queue State

Queue and worker stored on `globalThis` for hot-reload persistence:

```ts
declare global {
  var jobQueue: Queue | undefined;
  var queueEvents: QueueEvents | undefined;
  var jobWorker: Worker | undefined;
}
```

## Styling

Tailwind CSS v4. Styles in `src/styles.css`.

## Type Augmentation

Custom types in `src/types/`:

- `resource-auth.d.ts` - Extends resource-auth types

## Import Aliases

`@/` maps to `src/`:

```ts
import { db } from "@/db/db";
import { auth } from "@/lib/auth";
```

Configured in `vite.config.ts` and `tsconfig.json`.

## Error Handling

API routes return JSON errors:

```ts
if (!userId) {
  return Response.json({ error: "userId is required" }, { status: 400 });
}

if (!job) {
  return Response.json({ error: "Job not found" }, { status: 404 });
}
```

## No Comments Policy

Code should be self-documenting. Comments only for:
- Why something is done (not what)
- Non-obvious side effects
- TODO/FIXME markers
