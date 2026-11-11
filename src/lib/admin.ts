import { headers } from "next/headers";
import { getAuth } from "./auth";
import { asUser } from "./db";
import { DB_CONFIGURED } from "./env";

export type Admin = { user_id: string; email: string; full_name: string | null; role: "owner" | "editor" };

/** Verified session + admin row (null when not signed in / not an admin). */
export type SessionUser = { id: string; email: string; name: string };

export async function getAdmin(): Promise<{ user: SessionUser | null; admin: Admin | null }> {
  if (!DB_CONFIGURED) return { user: null, admin: null };
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { user: null, admin: null };
  const admin = await asUser(session.user.id, (c) =>
    c.query<Admin>("select user_id, email, full_name, role from public.admin_users where user_id = $1", [session.user.id]).then((r) => r.rows[0] ?? null),
  );
  return { user: { id: session.user.id, email: session.user.email, name: session.user.name }, admin };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wrap an /api/admin handler: requires an authorised admin, maps errors to JSON. */
export function adminRoute<C>(fn: (ctx: { req: Request; admin: Admin; params: C }) => Promise<Response | unknown>) {
  return async (req: Request, ctx: { params: Promise<C> }) => {
    try {
      const { user, admin } = await getAdmin();
      if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
      if (!admin) return Response.json({ error: "Not authorized" }, { status: 403 });
      const out = await fn({ req, admin, params: (await ctx?.params) as C });
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (e) {
      const err = e as Error & { status?: number; code?: string };
      const status = err instanceof HttpError ? err.status : err.code === "42501" ? 403 : 500;
      if (status === 500) console.error("[cms api]", err);
      return Response.json({ error: err.message || "Server error" }, { status });
    }
  };
}

export async function readJson<T>(req: Request, maxBytes = 2_000_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Payload too large");
  try {
    return JSON.parse(text || "{}") as T;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
