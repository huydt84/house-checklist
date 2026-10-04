import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { viewer } from "../../../lib/session.mjs";
import { localMode, personas } from "../../../lib/config.mjs";
import { AppError, ensure } from "../../../lib/errors.mjs";
import {
  listCollections,
  createCollection,
  snapshot,
  mutate,
  changes,
  history,
  acceptInvitation,
  inviteToken,
  applyPreset,
} from "../../../lib/repository.mjs";
import { sendInvitation } from "../../../lib/mail.mjs";
import { pool } from "../../../lib/db.mjs";
import { uploadRequest, downloadAttachment } from "../../../lib/uploads.mjs";
export const runtime = "nodejs";
function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
async function body(request) {
  ensure(
    Number(request.headers.get("content-length") || 0) < 1024 * 1024,
    "REQUEST_TOO_LARGE",
    413,
  );
  const text = await request.text();
  ensure(text.length < 1024 * 1024, "REQUEST_TOO_LARGE", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON");
  }
}
async function handle(request, { params }) {
  try {
    const { path } = await params;
    const [root, collectionId, action, arg] = path;
    const method = request.method;
    const url = new URL(request.url);
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin)
        ensure(
          origin === url.origin ||
            origin === process.env.APP_URL ||
            origin ===
              `${request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1)}://${request.headers.get("host")}`,
          "FORBIDDEN",
          403,
        );
    }
    if (root === "session" && method === "GET") {
      const user = await viewer();
      return json({
        user,
        local: localMode(),
        configured: Boolean(localMode() || process.env.AUTH_GOOGLE_ID),
        ...(user ? { collections: await listCollections(user) } : {}),
      });
    }
    if (root === "persona" && method === "POST") {
      ensure(localMode(), "NOT_FOUND", 404);
      const { key } = await body(request);
      ensure(key === "anonymous" || personas[key], "INVALID_PERSONA");
      (await cookies()).set("house-persona", key === "anonymous" ? "" : key, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      });
      return json({ ok: true });
    }
    const user = await viewer();
    ensure(user, "UNAUTHENTICATED", 401);
    if (root === "profile" && method === "POST") {
      const p = await body(request);
      ensure(["en", "ja", "vi"].includes(p.locale), "INVALID_LOCALE");
      await pool().query("UPDATE users SET locale=$2 WHERE id=$1", [
        user.id,
        p.locale,
      ]);
      return json({ locale: p.locale });
    }
    if (
      root === "invitations" &&
      collectionId === "accept" &&
      method === "POST"
    ) {
      const p = await body(request);
      ensure(
        typeof p.token === "string" && p.token.length <= 256,
        "INVITATION_INVALID",
      );
      return json({ collection: await acceptInvitation(user, p.token) });
    }
    if (root === "collections") {
      if (!collectionId && method === "GET")
        return json(await listCollections(user));
      if (!collectionId && method === "POST") {
        const p = await body(request);
        return json(await createCollection(user, p.name, p.id), 201);
      }
      if (collectionId && !action && method === "GET")
        return json(await snapshot(collectionId, user));
      if (action === "changes" && method === "GET")
        return json(
          await changes(collectionId, user, url.searchParams.get("since")),
        );
      if (action === "history" && method === "GET")
        return json(await history(collectionId, user, arg));
      if (action === "preset" && method === "POST")
        return json(await applyPreset(collectionId, user));
      if (action === "mutations" && method === "POST") {
        const command = await body(request);
        const result = await mutate(collectionId, user, command);
        if (["invitation.create", "invitation.resend"].includes(command.type)) {
          const token = inviteToken(collectionId, command.id);
          let deliveryError = null;
          try {
            result.record.delivery = await sendInvitation(
              collectionId,
              user,
              result.id,
              token,
            );
          } catch (e) {
            deliveryError = e.code || "EMAIL_FAILED";
            result.record.delivery = "failed";
          }
          return json({
            ...result,
            invitationUrl: `/invite/${token}`,
            deliveryError,
          });
        }
        return json(result);
      }
      if (action === "uploads" && method === "POST")
        return await uploadRequest(request, collectionId, user);
      if (action === "files" && method === "GET")
        return await downloadAttachment(collectionId, user, arg);
    }
    throw new AppError("NOT_FOUND", 404);
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.code, ...error.details }, error.status);
    if (["23503", "23505", "22P02"].includes(error.code))
      return json({ error: "INVALID_REFERENCE" }, 400);
    if (error.message === "DATABASE_NOT_CONFIGURED")
      return json({ error: "DATABASE_NOT_CONFIGURED" }, 503);
    console.error("Request failed", { code: error.code || error.name });
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
export const GET = handle;
export const POST = handle;
