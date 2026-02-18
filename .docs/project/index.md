# Project Documentation Index

Quick reference for project-specific patterns. Read only what you need.

## Topics

| Topic | When to Read | File |
|-------|--------------|------|
| **Authorization** | Adding/modifying roles, permissions, or access control | [authorization.md](./authorization.md) |
| **Job Queue** | Creating jobs, adding Python handlers, queue API | [job-queue.md](./job-queue.md) |
| **AI Agents & Tracing** | Multi-agent system, pydantic-ai, observability, traces UI | [ai-agents.md](./ai-agents.md) |
| **Database** | Modifying schema, adding tables, migrations | [database.md](./database.md) |
| **Conventions** | General patterns, file organization, coding style | [conventions.md](./conventions.md) |

## Key Files Quick Reference

```
src/lib/
├── auth.ts           # Server auth instance (better-auth)
├── auth-client.ts    # Client auth hooks
├── permissions.ts    # Role definitions (RBAC)
├── abilities.ts      # Resource permissions (ReBAC)
├── middleware.ts     # Auth middleware for routes
├── hooks/
│   ├── use-jobs.ts      # Job query hooks
│   ├── use-traces.ts    # Trace query hooks
│   └── use-trace-websocket.ts # Real-time trace updates (useTraceWebSocket, useTracesSubscription)
├── tracing/
│   └── db.ts            # SQLite reader for traces.db
└── queue/
    ├── index.ts      # Queue API: createJob, getJob, etc.
    ├── types.ts      # Job types and payloads
    └── worker.ts     # Python worker execution

src/db/
├── db.ts             # Drizzle instance
└── schema.ts         # All database tables

src/routes/
├── api/jobs/         # Job management API endpoints
├── api/traces/       # Traces API endpoints
├── api/auth/$.ts     # Auth API endpoint
├── jobs.tsx          # Jobs page
└── traces.tsx        # Traces viewer page

src/components/
├── jobs/             # Job-related components
└── tracing/          # Trace viewing components
    ├── TraceTerminal.tsx  # Main three-panel layout
    ├── TraceTimeline.tsx  # Visual span timeline (filters model.request, non-final model.response)
    ├── SpanNode.tsx       # Individual span renderer (JSON viewer via @uiw/react-json-view)
    └── ...                 # Other trace components

python-workers/
├── worker.py         # Main worker entry point
├── handlers/         # Job handler implementations
│   ├── __init__.py      # Base handler + registry
│   ├── context.py       # JobContext utility
│   └── agent_trace.py   # agent.run handler
├── agents/           # Multi-agent system (pydantic-ai)
│   ├── orchestrator.py  # Coordinator agent
│   ├── research.py      # Web research agent
│   ├── coding.py        # Code generation agent
│   └── analysis.py      # Data analysis agent
├── tracing/          # Custom tracing system
│   ├── collector.py     # SQLite storage
│   ├── processor.py     # Tracer implementation
│   └── viewer.py        # Query utilities
└── docs/             # Detailed Python documentation
```

## Environment Variables

```bash
BETTER_AUTH_SECRET=    # Required: 32+ char random string
BETTER_AUTH_URL=       # Required: http://localhost:3000
REDIS_URL=             # Optional: redis://localhost:6379
PYTHON_PATH=           # Optional: python executable path
MAX_PYTHON_WORKERS=    # Optional: concurrent worker limit (default: 4)
OPENROUTER_API_KEY=    # Optional: API key for pydantic-ai agents
```
