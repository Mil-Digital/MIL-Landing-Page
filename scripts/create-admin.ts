/**
 * Create a CMS admin, or reset an existing admin's password. Runs LOCALLY only.
 *
 *   npm run admin:create -- <email> ["Full Name"] [owner|editor]
 *   npm run admin:password -- <email>
 *
 * Password: set ADMIN_PASSWORD in the environment, otherwise a strong random one is
 * generated and printed once. Needs DATABASE_URL (+ BETTER_AUTH_SECRET) in .env.local.
 * Tip: use the neondb_owner connection string here (DATABASE_URL_OWNER) — admin_users can
 * only be written by the owner, never by the app role.
 */
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";

const mode = process.argv[2] === "--reset" ? "reset" : "create";
const args = process.argv.slice(mode === "reset" ? 3 : 2);
const [email, fullName = "", role = "owner"] = args;
const url = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;

if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- <email> ["Full Name"] [owner|editor]\n       npm run admin:password -- <email>');
  process.exit(1);
}
if (!url) { console.error("Missing DATABASE_URL_OWNER / DATABASE_URL in .env.local"); process.exit(1); }
if (!["owner", "editor"].includes(role)) { console.error("Role must be owner or editor"); process.exit(1); }

const pool = new Pool({ connectionString: url });
// Script-only instance: sign-up enabled here (it is disabled in the website).
const auth = betterAuth({ database: pool, secret: process.env.BETTER_AUTH_SECRET || "script-only", emailAndPassword: { enabled: true, minPasswordLength: 10 } });

(async () => {
  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  const existing = (await pool.query(`select id from "user" where lower(email) = lower($1)`, [email])).rows[0];

  if (mode === "reset") {
    if (!existing) throw new Error(`User ${email} tidak ditemukan`);
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    const r = await pool.query(`update "account" set "password" = $2, "updatedAt" = now() where "userId" = $1 and "providerId" = 'credential'`, [existing.id, hash]);
    if (!r.rowCount) throw new Error("Akun ini tidak memiliki login email/password");
    await pool.query(`delete from "session" where "userId" = $1`, [existing.id]);
    console.log(`\n✅ Password ${email} direset. Semua sesi lama dikeluarkan.`);
    console.log(process.env.ADMIN_PASSWORD ? "   Password: (dari ADMIN_PASSWORD)" : `   Password sementara: ${password}`);
    return;
  }

  let userId = existing?.id as string | undefined;
  if (!userId) {
    const res = await auth.api.signUpEmail({ body: { email, password, name: fullName || email.split("@")[0] } });
    userId = res.user.id;
    await pool.query(`update "user" set "emailVerified" = true where id = $1`, [userId]);
  }
  await pool.query(
    `insert into public.admin_users (user_id, email, full_name, role) values ($1, $2, $3, $4)
     on conflict (user_id) do update set email = excluded.email, full_name = coalesce(excluded.full_name, admin_users.full_name), role = excluded.role`,
    [userId, email, fullName || null, role],
  );
  console.log(`\n✅ ${email} sekarang admin CMS (${role}).`);
  if (!existing) console.log(process.env.ADMIN_PASSWORD ? "   Password: (dari ADMIN_PASSWORD)" : `   Password sementara: ${password}\n   Minta pengguna menggantinya di CMS › Akun.`);
  else console.log("   User sudah ada — password tidak diubah (gunakan admin:password untuk reset).");
})()
  .catch((e) => { console.error("❌", e.message ?? e); process.exitCode = 1; })
  .finally(() => pool.end());
