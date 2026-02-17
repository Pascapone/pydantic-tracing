# Python Job System Specifications

> Complete documentation for the async job processing system with Python workers.

## Overview

This job system enables asynchronous execution of Python jobs through a BullMQ-backed queue. It supports AI model queries, data processing, and custom handlers with real-time progress updates.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | System architecture and core concepts |
| [Database](./database.md) | SQLite schema for job persistence |
| [Queue System](./queue-system.md) | BullMQ configuration and management |
| [Python Workers](./python-workers.md) | Worker architecture and handlers |
| [API Endpoints](./api-endpoints.md) | REST API specifications |
| [Frontend](./frontend.md) | React components and hooks |
| [Job Types](./job-types.md) | Payload definitions for all job types |
| [Configuration](./configuration.md) | Environment variables and settings |

## Quick Start

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Python dependencies
cd python-workers
pip install -e .
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Apply Database Migrations

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 4. Start the Application

```bash
# With Redis (recommended for production)
redis-server
npm run dev

# Without Redis (development mode)
npm run dev
```

## Architecture Summary

```
Frontend (React)
    │
    ▼ HTTP
API Routes (TanStack Start)
    │
    ▼
Queue System (BullMQ + SQLite)
    │
    ▼ spawn
Python Workers
    │
    ▼
AI Models / Data Processing
```

## Key Features

- **Async Python Execution**: Full async/await support for AI APIs
- **Progress Reporting**: Real-time progress updates via JSON messages
- **Automatic Retries**: Exponential backoff with configurable attempts
- **Dual Mode**: Works with or without Redis
- **Type Safety**: End-to-end TypeScript types
- **Dark Mode**: Full UI dark mode support

## File Structure

```
src/
├── lib/queue/          # Queue management
│   ├── index.ts        # Main API
│   ├── worker.ts       # Node.js worker
│   ├── redis.ts        # Redis connection
│   └── types.ts        # Type definitions
├── db/schema.ts        # Database schema
├── routes/
│   ├── api/jobs/       # API endpoints
│   └── jobs.tsx        # UI page
└── components/jobs/    # UI components

python-workers/
├── worker.py           # Main entry
├── config.py           # Configuration
├── pyproject.toml      # Dependencies
└── handlers/           # Job handlers

.docs/specs/            # This documentation
```

## Support

For issues or questions, refer to the individual specification documents or check the AGENTS.md file for development guidelines.
