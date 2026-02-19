# Better-Auth Role Type Incompatibility

**Status:** Resolved
**Severity:** Low (does not affect runtime)
**Files:** `src/lib/auth.ts:20`, `src/lib/auth-client.ts:6`

## Solution Applied

Created a type helper in `src/types/better-auth.d.ts` that provides a properly typed `AdminRoles` type. Updated `auth.ts` and `auth-client.ts` to cast the `roles` object using this type.

### Changes Made

1. **Created `src/types/better-auth.d.ts`** - Type helper file with `AdminRoles` type
2. **Updated `src/lib/auth.ts:20`** - Added cast: `roles: roles as AdminRoles`
3. **Updated `src/lib/auth-client.ts:6`** - Added cast: `roles: roles as AdminRoles`

## Error

```
error TS2322: Type '{ user: { authorize<K_1 extends never>(request: ...) }' 
is not assignable to type '{ [x: string]: Role; }'.
  Property 'user' is incompatible with index signature.
    Types of property 'authorize' are incompatible.
```

## Cause

The `roles` object exported from `src/lib/permissions.ts` is passed to better-auth's admin plugin, but the type returned by `ac.newRole()` does not match the expected `Role` type from better-auth.

In `src/lib/permissions.ts`:
```ts
export const user = ac.newRole({ });  // Returns object with authorize method
export const admin = ac.newRole({ ...adminAc.statements });
export const roles = { user, admin }; // Type mismatch when passed to auth
```

The `newRole()` method returns a role object with a generic `authorize` method signature that doesn't match better-auth's expected `Role` type.

## Impact

- TypeScript compilation fails
- Build process fails (`npm run build`)
- Runtime behavior is unaffected (JavaScript works correctly)

## Workaround

Current workaround is to use type assertions:

```ts
// In auth.ts and auth-client.ts
import { roles } from "@/lib/permissions";

// Cast to any to bypass type check
adminPlugin({
  acRoles: roles as any,
}),
```

## Proper Fix Options

1. **Update better-auth** - Check if newer version fixes type definitions
2. **Report upstream** - File issue with better-auth repository
3. **Custom type declaration** - Create type augmentation to reconcile the types

## Related

- better-auth/plugins/access documentation
- `src/lib/permissions.ts` role definitions
