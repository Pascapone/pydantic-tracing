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
│   └── middleware.ts  # TanStack Start middleware
├── routes/        # File-based routes
│   ├── api/       # API routes (e.g. /api/auth/$)
│   ├── login.tsx  # Auth page
│   └── dashboard.tsx # Protected app area
└── types/         # TypeScript declarations
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
| `npx drizzle-kit generate` | Generate SQL migrations from schema changes |
| `npx drizzle-kit migrate` | Apply migrations to `sqlite.db` |
| `npx drizzle-kit studio` | Open database GUI |
