import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { localMode } from "./config.mjs";
function key() {
  const secret =
    process.env.OAUTH_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    (localMode() ? "house-local-auth-only" : "");
  if (!secret) throw new Error("AUTH_NOT_CONFIGURED");
  return createHash("sha256").update(`house-oauth:${secret}`).digest();
}
export function encrypt(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decrypt(value) {
  const b = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString(
      "utf8",
    ),
  );
}
