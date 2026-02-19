Always read the index file of the docs (`.docs\project\index.md`) and read more on topics you are not familiar with and that are relevant to the task.

The virtual environment for python (`./python-workers/.venv`) must be used for running python and workers.

# Getting Started

To run this application:

```bash
npm install
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
npm run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).

# Project Specification

> Single source of truth for the TanStack Start application architecture, stack, and setup.

## 1. Tech Stack

| Component | Technology | Version / Details |
|-----------|------------|-------------------|
| **Framework** | [TanStack Start](https://tanstack.com/start) | Full-stack React framework |
| **Routing** | [TanStack Router](https://tanstack.com/router) | File-based routing (`src/routes`) |
| **Authentication** | [better-auth](https://better-auth.com) | Email/password, session management |
| **Authorization** | [resource-auth](https://github.com/resource-auth) | Fine-grained, resource-based permissions |
| **Job Queue** | [BullMQ](https://docs.bullmq.io/) | Redis-based job queue |
| **Python Workers** | Python 3.11+ | Async job processing for AI/data tasks |
| **AI Agents** | [pydantic-ai](https://ai.pydantic.dev/) | Multi-agent system with tool calling |
| **Agent Tracing** | Custom SQLite | Open-source alternative to Logfire |
| **Traces UI** | [@uiw/react-json-view](https://github.com/uiwjs/react-json-view) | JSON tree viewer for structured outputs |
| **Database** | [SQLite](https://sqlite.org) | Local file-based DB (`sqlite.db`) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) | TypeScript ORM with `better-sqlite3` driver |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) | Utility-first CSS framework (v4) |
| **Build Tool** | [Vite](https://vitejs.dev) | Frontend tooling |

---

## 2. Architecture & Patterns

### 2.1 File Structure
```
src/
├── components/     # Shared UI components (Header, etc.)
├── db/            # Database configuration & schema
│   ├── db.ts      # Drizzle instance export
│   └── schema.ts  # Database tables & relations
├── lib/           # Core application logic
│   ├── auth.ts      # Server-side auth instance
│   ├── auth-client.ts # Client-side auth hooks
│   ├── permissions.ts # Role definitions (better-auth)
│   ├── abilities.ts   # Resource permissions (resource-auth)
│   ├── middleware.ts  # TanStack Start middleware
│   └── queue/       # Job queue system (BullMQ)
│       ├── index.ts    # Queue management API
│       ├── worker.ts   # Python worker processor
│       ├── redis.ts    # Redis connection
│       └── types.ts    # Job type definitions
├── routes/        # File-based routes
│   ├── api/       # API routes (e.g. /api/auth/$)
│   │   └── jobs/  # Job management endpoints
│   ├── login.tsx  # Auth page
│   └── dashboard.tsx # Protected app area
└── types/         # TypeScript declarations

python-workers/    # Python async worker processes
├── worker.py      # Main worker entry point
├── config.py      # Worker configuration
├── agents/        # Multi-agent system for tracing tests
│   ├── orchestrator.py    # Coordinates sub-agents
│   ├── research.py        # Web search agent
│   ├── coding.py          # Code generation agent
│   ├── analysis.py        # Data analysis agent
│   ├── schemas.py         # Pydantic output models
│   └── tools/             # Tool implementations
├── tracing/       # Custom tracing system
│   ├── spans.py           # Span data models
│   ├── collector.py       # SQLite storage
│   ├── processor.py       # Tracer and context management
│   └── viewer.py          # Query and export utilities
├── docs/          # Documentation
│   ├── agents.md          # Agent system docs
│   ├── tracing.md         # Tracing system docs
│   ├── examples.md        # Example walkthroughs
│   ├── api-reference.md   # API reference
│   └── integration.md     # Integration guide
├── examples/      # Test scenarios
│   ├── 00_testmodel.py    # No API calls
│   ├── 01_basic.py        # Single agent
│   ├── 02_delegation.py   # Multi-agent delegation
│   ├── 03_streaming.py    # Streaming with tracing
│   ├── 04_errors.py       # Error handling
│   ├── 05_concurrent.py   # Parallel execution
│   └── 06_conversation.py # Multi-turn conversation
└── handlers/      # Job handler implementations
    ├── __init__.py
    └── context.py # Job context utilities
```

### 2.2 Two-Layer Authorization
The application uses a **hybrid authorization model**:

1. **Role-Based Access Control (RBAC)** via `better-auth`
   - **Purpose:** High-level user categorization (`admin`, `user`, etc.)
   - **Definition:** `src/lib/permissions.ts` using `createAccessControl`
   - **Storage:** `user.role` column (comma-separated string for multiple roles)

2. **Resource-Based access Control (ReBAC)** via `resource-auth`
   - **Purpose:** Fine-grained permission checks ("Can user X edit Document Y?")
   - **Definition:** `src/lib/abilities.ts` using `createAbilitiesBuilder`
   - **Usage:** UI components check `abilities.can(action, resource)`

### 2.3 Database Management
- **Schema Source:** `src/db/schema.ts` (generated by `@better-auth/cli`)
- **Migrations:** Managed by `drizzle-kit` in `drizzle/` folder
- **Driver:** `better-sqlite3` for synchronous, fast local SQLite operations

---

## 3. Configuration & Setup

### 3.1 Environment Variables (`.env`)
```bash
BETTER_AUTH_SECRET=...  # 32+ char random string
BETTER_AUTH_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # Redis for BullMQ
PYTHON_PATH=python  # Python executable path
MAX_PYTHON_WORKERS=4  # Concurrent worker limit
OPENROUTER_API_KEY=...  # API key for pydantic-ai agents
```

### 3.2 Authorization Flow
1. **Request:** User accesses a protected route or action.
2. **Middleware:** `src/lib/middleware.ts` checks for valid session cookie.
3. **Authentication:** redirects to `/login` if no session exists.
4. **Authorization:** Page/Component loads user roles & calculates abilities.
5. **UI Rendering:** Elements are conditionally rendered based on `abilities.can()`.

### 3.3 Adding New Roles
To introduce a new role (e.g. `editor`):
1. **Define it** in `src/lib/permissions.ts`: `export const editor = ac.newRole({ ... })`
2. **Add to export** in `src/lib/permissions.ts`: `export const roles = { user, admin, editor }`
3. **Map abilities** in `src/lib/abilities.ts`:
   ```ts
   if (roles.includes("editor")) {
     builder.addAbility("update", "Post");
   }
   ```

---

## 4. Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npx drizzle-kit generate` | Generate SQL migrations from schema changes |
| `npx drizzle-kit migrate` | Apply migrations to `sqlite.db` |
| `npx drizzle-kit studio` | Open database GUI |

---

## 5. Job Queue System

The application uses **BullMQ** with **Python workers** for async job processing.

### 5.1 Job Types

| Type | Description |
|------|-------------|
| `ai.generate_text` | Text generation with AI models |
| `ai.generate_image` | Image generation (DALL-E, Stable Diffusion) |
| `ai.analyze_data` | Data analysis and extraction |
| `ai.embeddings` | Generate text embeddings |
| `data.process` | General data processing |
| `data.transform` | Data transformation pipelines |
| `data.export` | Export data to various formats |
| `custom` | Custom Python handlers |

### 5.2 Creating a Job

```ts
import { createJob } from "@/lib/queue";

const jobId = await createJob({
  type: "ai.generate_text",
  payload: {
    model: "gpt-4",
    prompt: "Hello, world!",
    temperature: 0.7,
  },
  userId: "user-123",
  options: {
    priority: 10,
    attempts: 3,
  },
});
```

### 5.3 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | List jobs (query: `userId`, `status`, `limit`) |
| `/api/jobs` | POST | Create a new job |
| `/api/jobs/:id` | GET | Get job details |
| `/api/jobs/:id` | DELETE | Cancel a job |
| `/api/jobs/:id` | POST | Retry or update job |
| `/api/jobs/stats` | GET | Get queue statistics |

### 5.4 Adding Custom Python Handlers

1. Create a new handler in `python-workers/handlers/__init__.py`:

```python
class MyCustomHandler(JobHandler):
    @property
    def job_type(self) -> str:
        return "custom.my_task"

    async def execute(self, ctx: JobContext, payload: Dict[str, Any]) -> Any:
        ctx.progress(10, "Starting...")
        # Your async code here
        result = await my_async_function(payload)
        ctx.progress(100, "Complete")
        return result
```

2. Register in `python-workers/worker.py`:

```python
registry.register(MyCustomHandler())
```

### 5.5 Running Workers

```bash
# Start Redis (required for BullMQ)
redis-server

# Install Python dependencies
cd python-workers
pip install -e .

# Workers auto-start with the Node.js server
# Or run standalone:
python worker.py <input_file>
```

---

## 6. Pydantic AI Tracing System

The project includes a **custom tracing system** for pydantic-ai agents with SQLite storage. This is an open-source alternative to Logfire.

### 6.1 Why This Exists

[Logfire](https://ai.pydantic.dev/logfire/) is pydantic-ai's official observability platform, but it's closed-source and requires a paid subscription. This project provides a self-hosted alternative.

### 6.2 Features

| Feature | Description |
|---------|-------------|
| **Multi-Agent System** | Orchestrator, Research, Coding, Analysis agents |
| **Tool Calling** | Each agent has multiple tools with complex payloads |
| **Structured Outputs** | Pydantic models for type-safe outputs |
| **Agent Delegation** | Agents call other agents as tools |
| **SQLite Storage** | All traces persisted locally for querying |
| **OTel Compatible** | Export to OpenTelemetry format |

### 6.3 Quick Start

```bash
cd python-workers
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -e .

# Set API key
export OPENROUTER_API_KEY=your_key_here

# Run test (no API calls)
PYTHONIOENCODING=utf-8 python examples/00_testmodel.py
```

### 6.4 Architecture

```
python-workers/
├── agents/
│   ├── orchestrator.py    # Coordinates sub-agents
│   ├── research.py        # Web search and summarization
│   ├── coding.py          # Code generation and execution
│   ├── analysis.py        # Data analysis and visualization
│   ├── schemas.py         # Pydantic output models
│   └── tools/             # Tool implementations
├── tracing/
│   ├── spans.py           # Span data models
│   ├── collector.py       # SQLite storage
│   ├── processor.py       # Tracer and context management
│   └── viewer.py          # Query and export utilities
└── examples/              # Test scenarios (00-06_*.py)
```

### 6.5 Using the Tracing API

```python
from agents import create_research_agent, AgentDeps
from tracing import get_tracer, print_trace

tracer = get_tracer("traces.db")
agent = create_research_agent()
deps = AgentDeps(user_id="user1", session_id="session1", request_id="req1")

trace = tracer.start_trace("my_trace", user_id="user1")
result = await agent.run("What is pydantic-ai?", deps=deps)
tracer.end_trace()

print_trace(trace.id, "traces.db")
```

### 6.6 Span Types

| Type | Description |
|------|-------------|
| `agent.run` | Agent execution - final result stored in `attributes.output` |
| `tool.call` | Tool function invocation |
| `tool.result` | Tool return value |
| `model.request` | LLM API request (filtered in UI) |
| `model.response` | LLM API response - only `:final` shown in UI |
| `model.reasoning` | Model thinking/reasoning content |
| `agent.delegation` | Agent-to-agent delegation |
| `user.prompt` | User input prompt |

**Naming Convention:** Spans use `{type}:{subtype}` format. The `:final` suffix on `model.response` marks the final structured output — the UI filters out intermediate streaming chunks.

### 6.7 Traces UI

The traces viewer (`/traces`) renders structured JSON outputs using `@uiw/react-json-view`:

- **`model.response:final`** — Renders with "Structured Output" label and collapsible JSON tree
- **`tool.result`** — Shows returned value with collapsible JSON tree
- **Default depth:** `collapsed={2}` shows top-level keys
- **VS Code dark theme** with transparent background

**Timeline Filtering:**
- `model.request` spans are filtered out (redundant)
- `model.response` spans filtered except `:final`

### 6.8 Agent Types

| Agent | Purpose | Tools |
|-------|---------|-------|
| **Orchestrator** | Coordinates sub-agents | `delegate_research`, `delegate_coding`, `delegate_analysis` |
| **Research** | Web search and summarization | `web_search`, `fetch_url`, `summarize_text` |
| **Coding** | Code generation and execution | `write_file`, `read_file`, `run_code`, `analyze_code` |
| **Analysis** | Data analysis and visualization | `parse_data`, `calculate_stats`, `generate_chart` |

### 6.9 Example Scripts

| Script | API Calls | Description |
|--------|-----------|-------------|
| `00_testmodel.py` | No | Test tracing without API calls |
| `00_real_api.py` | Yes | Quick API connectivity test |
| `00_instrumented.py` | Yes | Full instrumentation example |
| `01_basic.py` | Yes | Single research agent |
| `02_delegation.py` | Yes | Orchestrator + sub-agents |
| `03_streaming.py` | Yes | Streaming with trace capture |
| `04_errors.py` | Yes | Error handling, ModelRetry |
| `05_concurrent.py` | Yes | Parallel agent execution |
| `06_conversation.py` | Yes | Multi-turn with history |

### 6.10 Database Schema

**traces table:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | Trace name |
| `user_id` | TEXT | User identifier |
| `session_id` | TEXT | Session identifier |
| `status` | TEXT | UNSET, OK, or ERROR |
| `span_count` | INTEGER | Number of spans |
| `total_duration_ms` | REAL | Total duration |

**spans table:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | UUID primary key |
| `trace_id` | TEXT | Foreign key to traces |
| `parent_id` | TEXT | Parent span ID |
| `name` | TEXT | Span name |
| `span_type` | TEXT | agent.run, tool.call, etc. |
| `attributes` | JSON | Key-value metadata |
| `events` | JSON | List of events |

### 6.11 Documentation

Full documentation available in `python-workers/docs/`:
- `agents.md` - Multi-agent system documentation
- `tracing.md` - Tracing system documentation
- `examples.md` - Example walkthroughs
- `api-reference.md` - Complete API reference
- `integration.md` - Integration patterns
