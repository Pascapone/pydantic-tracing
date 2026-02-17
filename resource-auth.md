# resource-auth

A flexible, type-safe authorization library for TypeScript applications with resource-based permissions. Inspired by CASL but with full type safety for your resources.

## Features

- ✅ **Fully Generic** - No hardcoded resources or actions
- ✅ **Type-Safe** - Full TypeScript support with resource type checking
- ✅ **Builder Pattern** - Fluent API for defining permissions
- ✅ **Composable** - Combine multiple ability modules
- ✅ **Lightweight** - Zero runtime dependencies
- ✅ **Well-tested** - Comprehensive test suite

## Installation

```bash
npm install resource-auth
```

### Using Locally

To use this package in another project without publishing:

1. In this project directory:
   ```bash
   # Create a global symlink
   npm link
   
   # Start the build watcher (IMPORTANT: changes won't be reflected without this)
   npm run dev
   ```

2. In your consuming project:
   ```bash
   # Link to the local package
   npm link resource-auth
   ```

> **Note:** `npm link` creates a symbolic link, not a copy. Any changes you make in this directory will be reflected in your consuming project as soon as the build watcher updates the `dist` folder.

## Quick Start

```typescript
import { createAbilitiesBuilder, BaseUser } from 'resource-auth';

// 1. Define your types
interface User extends BaseUser {
  id: string;
  roles: string[];
}

type Resources = {
  Post: { id: string; authorId: string; published: boolean };
};

type Actions = 'create' | 'read' | 'update' | 'delete';

// 2. Create abilities builder
const builder = createAbilitiesBuilder<Resources, Actions, User>();

// 3. Define permissions
builder
  .addAbility('read', 'Post', (user, post) => post?.published === true)
  .addAbility('create', 'Post')
  .addAbility('update', 'Post', (user, post) => post?.authorId === user.id)
  .addAbility('delete', 'Post', (user, post) => post?.authorId === user.id);

// 4. Check permissions
const user = { id: '1', roles: ['user'] };
const abilities = builder.abilitiesForUser(user);

const post = { id: '1', authorId: '1', published: true };
abilities.can('read', 'Post', post); // true
abilities.can('delete', 'Post', post); // true
```

## API Reference

### `createAbilitiesBuilder<TResources, TActions, TUser>()`

Creates a new abilities builder with fully customizable types.

```typescript
const builder = createAbilitiesBuilder<{
  Post: { id: string; authorId: string };
  Comment: { id: string; postId: string };
}, 'create' | 'read' | 'update' | 'delete', User>();
```

### `createCrudAbilitiesBuilder<TResources, TUser>()`

Creates a builder restricted to CRUD actions only.

```typescript
const builder = createCrudAbilitiesBuilder<Resources, User>();
```

### `builder.addAbility(action, resource, condition?)`

Adds a permission with an optional condition function.

```typescript
builder
  .addAbility('read', 'Post') // No condition = always allowed
  .addAbility('update', 'Post', (user, post) => post.authorId === user.id);
```

### `builder.abilitiesForUser(user)`

Creates an ability checker for a specific user.

```typescript
const abilities = builder.abilitiesForUser(user);
abilities.can('read', 'Post', post);
```

### `composeAbilities(builders)`

Combines multiple ability builders.

```typescript
const postAbilities = createAbilitiesBuilder<Resources, Actions, User>()
  .addAbility('read', 'Post');

const userAbilities = createAbilitiesBuilder<Resources, Actions, User>()
  .addAbility('read', 'User');

const combined = composeAbilities([postAbilities, userAbilities]);
```

## Advanced Usage

### Organizing by Resource

```typescript
const createPostAbilities = () => {
  return createAbilitiesBuilder<Resources, Actions, User>()
    .addAbility('read', 'Post')
    .addAbility('create', 'Post', user => user.roles.includes('author'))
    .addAbility('update', 'Post', (user, post) => post?.authorId === user.id);
};

const createCommentAbilities = () => {
  return createAbilitiesBuilder<Resources, Actions, User>()
    .addAbility('read', 'Comment')
    .addAbility('create', 'Comment', user => user.isVerified);
};

const builder = composeAbilities([
  createPostAbilities(),
  createCommentAbilities()
]);
```

### Multi-tenant Support

```typescript
type TenantResources = {
  Project: { id: string; tenantId: string; ownerId: string };
};

interface TenantUser extends BaseUser {
  tenantId: string;
}

const builder = createAbilitiesBuilder<TenantResources, Actions, TenantUser>();

builder
  .addAbility('read', 'Project', (user, project) => 
    project?.tenantId === user.tenantId
  )
  .addAbility('update', 'Project', (user, project) => 
    project?.tenantId === user.tenantId && project?.ownerId === user.id
  );
```

## Type Safety

The library provides full type safety:

```typescript
const builder = createAbilitiesBuilder<Resources, Actions, User>();

// TypeScript error: 'invalid' is not a valid action
builder.addAbility('invalid', 'Post');

// TypeScript error: 'Video' is not a valid resource
builder.addAbility('read', 'Video');

const abilities = builder.abilitiesForUser(user);

// TypeScript error: post must match Post type
abilities.can('read', 'Post', { invalid: 'data' });
```

## Testing

```bash
npm test
```

## Development

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Setup

```bash
# Install dependencies
npm install
```

### Building

The project uses `tsup` for bundling:

```bash
# Build for production
npm run build

# Watch mode for development
npm run dev
```

### Testing

Tests are written using `vitest`:

```bash
# Run tests (watch mode)
npm test

# Run tests (single run)
npm run test:run
```

## Project Structure

- `src/` - Source code
  - `builder.ts` - Main builder logic
  - `permission.ts` - Permission checking logic
  - `types.ts` - TypeScript definitions
- `examples/` - Usage examples
- `tests/` - Unit tests

## License

MIT
