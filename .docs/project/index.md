# Project Documentation Index

Quick reference for project-specific patterns. Read only what you need.

## Topics

| Topic | When to Read | File |
|-------|--------------|------|
| **Authorization** | Adding/modifying roles, permissions, or access control | [authorization.md](./authorization.md) |
| **Job Queue** | Creating jobs, adding Python handlers, queue API | [job-queue.md](./job-queue.md) |
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
└── queue/
    ├── index.ts      # Queue API: createJob, getJob, etc.
    ├── types.ts      # Job types and payloads
    └── worker.ts     # Python worker execution

src/db/
├── db.ts             # Drizzle instance
└── schema.ts         # All database tables

src/routes/
├── api/jobs/         # Job management API endpoints
└── api/auth/$.ts     # Auth API endpoint

python-workers/
├── worker.py         # Main worker entry point
└── handlers/         # Job handler implementations
```

## Environment Variables

```bash
BETTER_AUTH_SECRET=    # Required: 32+ char random string
BETTER_AUTH_URL=       # Required: http://localhost:3000
REDIS_URL=             # Optional: redis://localhost:6379
PYTHON_PATH=           # Optional: python executable path
MAX_PYTHON_WORKERS=    # Optional: concurrent worker limit (default: 4)
```
