// Type declaration to fix better-auth role type incompatibility
// See: .problems/better-auth-role-types.md
//
// This file provides a type helper to fix the type mismatch between:
// - ac.newRole() which returns roles with generic authorize<K extends never> signatures
// - better-auth's admin plugin which expects roles with authorize(request: any, ...) signatures
//
// Usage: Cast your roles object to this type before passing to the admin plugin:
//   admin({ ac, roles: roles as AdminRoles, defaultRole: "user" })

import type { Role } from "better-auth/plugins/access";

/**
 * Type helper for admin plugin roles.
 * 
 * The roles object returned by createAccessControl().newRole() has a generic
 * authorize method signature that TypeScript doesn't recognize as compatible
 * with the Role type expected by the admin plugin.
 * 
 * Use this type to cast your roles object when passing it to the admin plugin.
 */
export type AdminRoles = Record<string, Role>;
