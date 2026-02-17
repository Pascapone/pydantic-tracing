import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

/**
 * Central role & permission definitions for better-auth's admin plugin.
 *
 * To add a new role:
 *   1. Define it here with ac.newRole({ ... })
 *   2. Add it to the `roles` export
 *   3. Pass it to the admin plugin in auth.ts and auth-client.ts
 *   4. Define resource-auth abilities for it in abilities.ts
 */

const statement = {
  ...defaultStatements,
  // Add custom resources here as the app grows, e.g.:
  // project: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({
  // Standard users — no admin permissions
});

export const admin = ac.newRole({
  ...adminAc.statements, // Full admin permissions
});

// Future roles example:
// export const moderator = ac.newRole({
//   user: ["list", "ban"],
// });

export const roles = { user, admin };
