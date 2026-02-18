import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { ac, roles } from "@/lib/permissions";
import type { AdminRoles } from "@/types/better-auth";

export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles: roles as AdminRoles })],
});

export const { signIn, signUp, signOut, useSession } = authClient;
