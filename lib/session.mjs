import { cookies } from "next/headers";
import { auth } from "../auth.js";
import { localMode } from "./config.mjs";
import { localUser } from "./repository.mjs";
import { pool } from "./db.mjs";
export async function viewer() {
  if (localMode()) {
    const key = (await cookies()).get("house-persona")?.value;
    return key ? localUser(key) : null;
  }
  if (!process.env.AUTH_GOOGLE_ID) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  return (
    (
      await pool().query("SELECT id,email,name,locale FROM users WHERE id=$1", [
        session.user.id,
      ])
    ).rows[0] || null
  );
}
