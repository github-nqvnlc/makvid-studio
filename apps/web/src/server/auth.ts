// Better Auth (T097): email + password, Google when configured. The "user" model is our users table;
// a personal workspace (owner membership) is created right after sign-up.
import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import {
  authAccounts,
  authSessions,
  authVerifications,
  memberships,
  users,
  withWorkspace,
  workspaces,
} from "@makvid/db";
import { contextFrom, recordSignup } from "./abuse";
import { server } from "./deps";

function createAuth() {
  const { db } = server();
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {};
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { users, authSessions, authAccounts, authVerifications },
    }),
    advanced: { database: { generateId: "uuid" } },
    user: { modelName: "users" },
    session: { modelName: "authSessions" },
    account: { modelName: "authAccounts" },
    verification: { modelName: "authVerifications" },
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    socialProviders: google,
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            // Free-plan abuse signals (hashed); never blocks the sign-up itself.
            await recordSignup(
              db,
              user.id,
              user.email,
              contextFrom(ctx?.headers ?? ctx?.request?.headers),
            ).catch((e: unknown) => console.warn("abuse signal failed", (e as Error).message));
            const id = randomUUID();
            await withWorkspace(db, id, async (tx) => {
              await tx.insert(workspaces).values({
                id,
                name: user.name || user.email.split("@")[0]!,
                slug: `ws-${id.slice(0, 8)}`,
                createdBy: user.id,
              });
              await tx.insert(memberships).values({ workspaceId: id, userId: user.id, role: "owner" });
            });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

const g = globalThis as typeof globalThis & { __makvidAuth?: ReturnType<typeof createAuth> };
export function auth() {
  g.__makvidAuth ??= createAuth();
  return g.__makvidAuth;
}
