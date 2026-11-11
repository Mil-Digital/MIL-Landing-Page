import { Pool, type PoolClient } from "pg";
import { DATABASE_URL } from "./env";

/**
 * One small connection pool per server instance. Use Neon's *pooled* connection string
 * (host contains "-pooler") for the `cms_app` role — see README.
 */
const g = globalThis as unknown as { __milPool?: Pool };
export const pool: Pool =
  g.__milPool ??
  (g.__milPool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000, // Neon scale-to-zero: first connection may wait for compute wake-up
    statement_timeout: 10_000,
  }));

/**
 * Run queries as a specific (already authenticated) user. Sets `app.user_id` for the
 * transaction so the database RLS policies (is_admin()) apply to every statement.
 */
export async function asUser<T>(userId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.user_id', $1, true)", [userId]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
