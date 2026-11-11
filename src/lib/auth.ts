import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { pool } from "./db";

const origins = () =>
  [
    process.env.BETTER_AUTH_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ].filter(Boolean).map((u) => String(u).replace(/\/$/, ""));

export const authOptions = (opts: { allowSignUp?: boolean } = {}) => ({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: origins()[0],
  trustedOrigins: origins(),
  emailAndPassword: {
    enabled: true,
    // No public registration. Admin accounts are created with `npm run admin:create`.
    disableSignUp: !opts.allowSignUp,
    minPasswordLength: 10,
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [nextCookies()],
});

const create = () => betterAuth(authOptions());
/** Lazily created so builds without secrets/env don't fail. */
let instance: ReturnType<typeof create> | null = null;
export function getAuth() {
  return (instance ??= create());
}
