# Authorization System

Two-layer authorization: **RBAC** (better-auth) for roles + **ReBAC** (resource-auth) for fine-grained permissions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Request → Middleware → Session Check → Route Handler      │
│                              ↓                              │
│                    getAbilitiesForUser()                    │
│                              ↓                              │
│              abilities.can(action, resource)                │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Role Definitions (RBAC)

**File:** `src/lib/permissions.ts`

Defines WHO the user is (admin, user, etc.). Uses `better-auth/plugins/access`.

```ts
import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  ...defaultStatements,
  // Add custom resources: project: ["create", "read", "update", "delete"]
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({ });
export const admin = ac.newRole({ ...adminAc.statements });

export const roles = { user, admin };
```

### Adding a New Role

1. Define in `src/lib/permissions.ts`:
```ts
export const editor = ac.newRole({
  project: ["create", "read", "update"],
});
```

2. Add to exports:
```ts
export const roles = { user, admin, editor };
```

3. Pass to auth plugins in `src/lib/auth.ts` and `src/lib/auth-client.ts`

## Layer 2: Resource Permissions (ReBAC)

**File:** `src/lib/abilities.ts`

Defines WHAT each role can do. Uses `resource-auth`.

```ts
export type Resources = {
  Dashboard: { ownerId: string };
  UserList: Record<string, never>;
  Settings: { ownerId: string };
};

export type Actions = "view" | "manage" | "create" | "update" | "delete";

export function getAbilitiesForUser(user: AppUser) {
  const builder = createAbilitiesBuilder<Resources, Actions, AppUser>();
  const roles = user.roles; // parsed from comma-separated string

  // Base abilities for all users
  builder.addAbility("view", "Dashboard");
  builder.addAbility("update", "Settings", (u, settings) => 
    settings?.ownerId === u.id
  );

  // Role-specific abilities
  if (roles.includes("admin")) {
    builder.addAbility("manage", "UserList");
  }

  return builder.abilitiesForUser(user);
}
```

## Role Storage

Roles are stored as comma-separated strings in `user.role` column:

```
"user"          → ["user"]
"user,admin"    → ["user", "admin"]
```

Parsed by `parseRoles()` in `src/lib/abilities.ts:24`.

## Usage in Components

```tsx
import { useSession } from "@/lib/auth-client";
import { getAbilitiesForUser, parseRoles } from "@/lib/abilities";

function MyComponent() {
  const { data: session } = useSession();
  
  if (!session?.user) return null;
  
  const user = {
    ...session.user,
    roles: parseRoles(session.user.role),
  };
  
  const abilities = getAbilitiesForUser(user);
  
  return (
    <div>
      {abilities.can("manage", "UserList") && <AdminPanel />}
    </div>
  );
}
```

## Protected Routes

**File:** `src/lib/middleware.ts`

```ts
export const authMiddleware = createMiddleware().server(
  async ({ next }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw redirect({ to: "/login" });
    return await next();
  }
);
```

Apply to routes:

```ts
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => authMiddleware,
  component: Dashboard,
});
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/permissions.ts` | Role definitions (RBAC) |
| `src/lib/abilities.ts` | Resource permissions (ReBAC) |
| `src/lib/auth.ts` | Server auth instance |
| `src/lib/auth-client.ts` | Client hooks (`useSession`, `signIn`, etc.) |
| `src/lib/middleware.ts` | Route protection |
| `src/types/resource-auth.d.ts` | Type augmentation for resource-auth |
