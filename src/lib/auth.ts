import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { ac, roles } from "@/lib/permissions";
import type { AdminRoles } from "@/types/better-auth";

export const auth = betterAuth({
  trustedOrigins: [
    "http://localhost:3341",
    "http://127.0.0.1:3341",
  ],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      ac,
      roles: roles as AdminRoles,
      defaultRole: "user",
    }),
    tanstackStartCookies(), // Must be last plugin
  ],
});
