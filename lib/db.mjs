import pg from "pg";
import { databaseUrl } from "./config.mjs";
const globalDb = globalThis;
export function pool() {
  if (!globalDb.housePool)
    globalDb.housePool = new pg.Pool({
      connectionString: databaseUrl(),
      max: 5,
      // The client polls every 20s. Keep idle connections across those polls
      // instead of paying a fresh TLS/database handshake each time.
      idleTimeoutMillis: 60000,
      allowExitOnIdle: true,
    });
  return globalDb.housePool;
}
export async function transaction(fn) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function closeDb() {
  if (globalDb.housePool) {
    await globalDb.housePool.end();
    delete globalDb.housePool;
  }
}
