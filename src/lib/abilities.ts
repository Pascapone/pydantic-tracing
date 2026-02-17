import { createAbilitiesBuilder, type BaseUser } from "resource-auth";

/**
 * Resource-based authorization using resource-auth.
 *
 * This defines WHAT each role can do with specific resources.
 * better-auth handles WHO the user is (authentication + role),
 * resource-auth handles WHAT they can do (permissions on resources).
 *
 * better-auth stores multiple roles as comma-separated strings (e.g. "user,admin").
 * We parse that into an array and grant abilities for ALL roles the user holds.
 */

// App user type — extends resource-auth's BaseUser
export interface AppUser extends BaseUser {
  id: string;
  role: string; // raw comma-separated string from better-auth
  roles: string[]; // parsed array
}

/**
 * Parse better-auth's comma-separated role string into an array.
 */
export function parseRoles(roleString: string | null | undefined): string[] {
  if (!roleString) return ["user"];
  return roleString
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

// Define your application resources
export type Resources = {
  Dashboard: { ownerId: string };
  UserList: Record<string, never>;
  Settings: { ownerId: string };
};

// Define available actions
export type Actions = "view" | "manage" | "create" | "update" | "delete";

/**
 * Build abilities for a specific user based on ALL their roles.
 * Abilities are additive — each role grants additional permissions.
 * Add new role cases here when new roles are added to permissions.ts.
 */
export function getAbilitiesForUser(user: AppUser) {
  const builder = createAbilitiesBuilder<Resources, Actions, AppUser>();
  const roles = user.roles;

  // All authenticated users can view their own dashboard and settings
  builder.addAbility("view", "Dashboard");
  builder.addAbility("view", "Settings");
  builder.addAbility(
    "update",
    "Settings",
    (u, settings) => settings?.ownerId === u.id
  );

  // Admin abilities
  if (roles.includes("admin")) {
    builder.addAbility("manage", "Dashboard");
    builder.addAbility("view", "UserList");
    builder.addAbility("manage", "UserList");
    builder.addAbility("manage", "Settings");
  }

  // Add future roles here:
  // if (roles.includes("moderator")) {
  //   builder.addAbility("view", "UserList");
  // }

  return builder.abilitiesForUser(user);
}
