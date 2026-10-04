import { pool, transaction } from "./db.mjs";
import { access } from "./repository.mjs";
import { localMode } from "./config.mjs";
import { encrypt, decrypt } from "./crypto.mjs";
import { ensure } from "./errors.mjs";
async function accessToken(user) {
  const raw = (
    await pool().query("SELECT oauth_encrypted FROM users WHERE id=$1", [
      user.id,
    ])
  ).rows[0]?.oauth_encrypted;
  ensure(raw, "GMAIL_CONNECT_REQUIRED", 403);
  const credentials = decrypt(raw);
  ensure(
    credentials.scope?.includes("gmail.send"),
    "GMAIL_CONNECT_REQUIRED",
    403,
  );
  if (credentials.expiresAt * 1000 > Date.now() + 60000)
    return credentials.accessToken;
  ensure(credentials.refreshToken, "GMAIL_CONNECT_REQUIRED", 403);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID,
      client_secret: process.env.AUTH_GOOGLE_SECRET,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  ensure(response.ok, "GMAIL_CONNECT_REQUIRED", 403);
  const data = await response.json();
  credentials.accessToken = data.access_token;
  credentials.expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await pool().query("UPDATE users SET oauth_encrypted=$2 WHERE id=$1", [
    user.id,
    encrypt(credentials),
  ]);
  return credentials.accessToken;
}
export async function sendInvitation(collectionId, user, invitationId, token) {
  const { row, role } = await access(pool(), collectionId, user);
  ensure(role === "owner", "FORBIDDEN", 403);
  const invitation = (
    await pool().query(
      "SELECT * FROM invitations WHERE id=$1 AND collection_id=$2",
      [invitationId, collectionId],
    )
  ).rows[0];
  ensure(
    invitation && !invitation.revoked_at && !invitation.accepted_by,
    "INVITATION_INVALID",
  );
  if (invitation.delivery === "sent" || invitation.delivery === "local")
    return invitation.delivery;
  if (localMode()) {
    await setDelivery(collectionId, invitationId, "local");
    return "local";
  }
  let status = "failed";
  try {
    const bearer = await accessToken(user);
    const appUrl = process.env.APP_URL;
    ensure(appUrl?.startsWith("https://"), "APP_URL_REQUIRED", 503);
    const body = `${user.name} invited you to ${row.name} in House Checklist.\n\nJoin with ${invitation.email}:\n${appUrl}/invite/${token}\n\nThis invitation expires in seven days. Access: ${invitation.role}.`;
    const raw = Buffer.from(
      `To: ${invitation.email}\r\nSubject: House Checklist invitation\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(body).toString("base64")}`,
    ).toString("base64url");
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
        signal: AbortSignal.timeout(15000),
      },
    );
    ensure(response.ok, "EMAIL_FAILED", 502);
    status = "sent";
    return status;
  } finally {
    await setDelivery(collectionId, invitationId, status);
  }
}
async function setDelivery(collectionId, id, delivery) {
  await transaction(async (db) => {
    await db.query("SELECT id FROM collections WHERE id=$1 FOR UPDATE", [
      collectionId,
    ]);
    await db.query("UPDATE invitations SET delivery=$2 WHERE id=$1", [
      id,
      delivery,
    ]);
    // Owners refresh invitation metadata after a send; membership is never changed here.
  });
}
