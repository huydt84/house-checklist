import { readFile, writeFile, mkdir } from "node:fs/promises";
import { get } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { pool, transaction } from "./db.mjs";
import { access, uuidPattern } from "./repository.mjs";
import { localMode } from "./config.mjs";
import { ensure } from "./errors.mjs";
const MAX = 20 * 1024 * 1024;
const MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export function validateFile(file) {
  ensure(
    file && MIMES.includes(file.type) && file.size > 0 && file.size <= MAX,
    "FILE_INVALID",
  );
}
async function fileEvent(db, cid, record, user, before = null) {
  const seq = (
    await db.query(
      "UPDATE collections SET sequence=sequence+1 WHERE id=$1 RETURNING sequence",
      [cid],
    )
  ).rows[0].sequence;
  await db.query(
    "INSERT INTO events(collection_id,sequence,entity,record_id,payload) VALUES($1,$2,'records',$3,$4)",
    [cid, seq, record.id, record],
  );
  await db.query(
    "INSERT INTO history(collection_id,entity,record_id,before_value,after_value,actor_id) VALUES($1,'records',$2,$3,$4,$5)",
    [cid, record.id, before, record, user.id],
  );
}
export async function reserveUpload(cid, user, input) {
  return transaction(async (db) => {
    const { role } = await access(db, cid, user, true);
    ensure(role !== "viewer", "FORBIDDEN", 403);
    ensure(
      uuidPattern.test(input.id) && uuidPattern.test(input.apartmentId),
      "INVALID_ID",
    );
    validateFile({ type: input.mime, size: input.size });
    const apartment = (
      await db.query(
        "SELECT data FROM apartments WHERE collection_id=$1 AND id=$2",
        [cid, input.apartmentId],
      )
    ).rows[0];
    ensure(apartment && !apartment.data.archived, "APARTMENT_UNAVAILABLE", 409);
    const old = (
      await db.query("SELECT * FROM records WHERE id=$1", [input.id])
    ).rows[0];
    if (old) {
      ensure(
        old.collection_id === cid &&
          old.apartment_id === input.apartmentId &&
          old.kind === "attachment" &&
          old.criterion_id === (input.criterionId || null) &&
          old.scenario_id === (input.scenarioId || null) &&
          old.data.size === input.size &&
          old.data.mime === input.mime,
        "IDENTITY_CONFLICT",
        409,
      );
      return {
        ...old.data,
        id: old.id,
        apartmentId: old.apartment_id,
        criterionId: old.criterion_id,
        scenarioId: old.scenario_id,
        kind: "attachment",
        revision: old.revision,
      };
    }
    const data = {
      name: String(input.name).slice(0, 200),
      mime: input.mime,
      size: input.size,
      storage: localMode() ? "local" : "blob",
      pathname: `collections/${cid}/${input.id}`,
      uploadState: "pending",
    };
    await db.query(
      "INSERT INTO records(id,collection_id,kind,apartment_id,criterion_id,scenario_id,data) VALUES($1,$2,'attachment',$3,$4,$5,$6)",
      [
        input.id,
        cid,
        input.apartmentId,
        input.criterionId || null,
        input.scenarioId || null,
        data,
      ],
    );
    const record = {
      ...data,
      id: input.id,
      apartmentId: input.apartmentId,
      criterionId: input.criterionId || null,
      scenarioId: input.scenarioId || null,
      kind: "attachment",
      revision: 1,
    };
    await fileEvent(db, cid, record, user);
    return record;
  });
}
export async function finalizeUpload(cid, user, attachmentId, pathname) {
  return transaction(async (db) => {
    const { role } = await access(db, cid, user, true);
    ensure(role !== "viewer", "FORBIDDEN", 403);
    const old = (
      await db.query(
        "SELECT * FROM records WHERE collection_id=$1 AND id=$2 AND kind='attachment'",
        [cid, attachmentId],
      )
    ).rows[0];
    ensure(
      old && !old.data.archived && old.data.pathname === pathname,
      "NOT_FOUND",
      404,
    );
    if (old.data.uploadState === "ready")
      return {
        ...old.data,
        id: old.id,
        apartmentId: old.apartment_id,
        kind: "attachment",
        revision: old.revision,
      };
    const data = { ...old.data, uploadState: "ready" };
    const row = (
      await db.query(
        "UPDATE records SET data=$2,revision=revision+1 WHERE id=$1 RETURNING *",
        [attachmentId, data],
      )
    ).rows[0];
    const record = {
      ...data,
      id: row.id,
      apartmentId: row.apartment_id,
      criterionId: row.criterion_id,
      scenarioId: row.scenario_id,
      kind: "attachment",
      revision: row.revision,
    };
    await fileEvent(db, cid, record, user, old.data);
    return record;
  });
}
export async function uploadRequest(request, cid, user) {
  ensure(localMode(), "USE_DIRECT_UPLOAD", 400);
  const form = await request.formData();
  const file = form.get("file");
  validateFile(file);
  const input = {
    id: form.get("id"),
    apartmentId: form.get("apartmentId"),
    criterionId: form.get("criterionId") || null,
    scenarioId: form.get("scenarioId") || null,
    name: file.name,
    mime: file.type,
    size: file.size,
  };
  const reserved = await reserveUpload(cid, user, input);
  if (reserved.uploadState !== "ready") {
    await mkdir(".local-files", { recursive: true });
    await writeFile(
      `.local-files/${input.id}`,
      Buffer.from(await file.arrayBuffer()),
    );
  }
  return Response.json(
    await finalizeUpload(cid, user, input.id, reserved.pathname),
  );
}
export async function cloudUpload(request, getViewer) {
  const body = await request.json();
  return Response.json(
    await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getViewer();
        ensure(user, "UNAUTHENTICATED", 401);
        const p = JSON.parse(clientPayload || "{}");
        ensure(
          pathname === `collections/${p.collectionId}/${p.id}`,
          "INVALID_PATH",
        );
        await reserveUpload(p.collectionId, user, p);
        return {
          allowedContentTypes: MIMES,
          maximumSizeInBytes: MAX,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            collectionId: p.collectionId,
            attachmentId: p.id,
            userId: user.id,
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const p = JSON.parse(tokenPayload);
        const user = (
          await pool().query("SELECT id,email,name FROM users WHERE id=$1", [
            p.userId,
          ])
        ).rows[0];
        ensure(user, "UNAUTHENTICATED", 401);
        ensure(blob.pathname === p.pathname, "INVALID_PATH");
        await finalizeUpload(
          p.collectionId,
          user,
          p.attachmentId,
          blob.pathname,
        );
      },
    }),
  );
}
export async function downloadAttachment(cid, user, attachmentId) {
  await access(pool(), cid, user);
  ensure(uuidPattern.test(attachmentId), "INVALID_ID");
  const row = (
    await pool().query(
      "SELECT * FROM records WHERE collection_id=$1 AND id=$2 AND kind='attachment'",
      [cid, attachmentId],
    )
  ).rows[0];
  ensure(
    row && !row.data.archived && row.data.uploadState === "ready",
    "NOT_FOUND",
    404,
  );
  const headers = {
    "Content-Type": row.data.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.data.name)}`,
  };
  if (row.data.storage === "local") {
    ensure(localMode(), "NOT_FOUND", 404);
    return new Response(await readFile(`.local-files/${attachmentId}`), {
      headers,
    });
  }
  const result = await get(row.data.pathname, { access: "private" });
  ensure(result?.statusCode === 200, "NOT_FOUND", 404);
  return new Response(result.stream, { headers });
}
