"use client";
import Dexie from "dexie";
import { upload } from "@vercel/blob/client";
import { apartmentState } from "./domain.mjs";
const db = new Dexie("house-checklist");
db.version(1).stores({
  snapshots: "key,userId,collectionId",
  outbox: "id,[userId+collectionId],userId,collectionId,created",
  files: "key,userId,collectionId",
  meta: "key",
  uploads: "id,userId,collectionId,created",
});
const key = (u, c) => `${u}:${c}`;
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  for (const fn of listeners) fn();
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("house-data"));
}
export async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: options.signal || AbortSignal.timeout(10000),
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw { error: "NETWORK_TIMEOUT" };
    if (error instanceof TypeError) throw { error: "NETWORK_ERROR" };
    throw error;
  }
  let result;
  try {
    result = await response.json();
  } catch {
    result = { error: "SERVER_ERROR" };
  }
  if (!response.ok) throw { ...result, status: response.status };
  return result;
}
export async function rememberSession(session) {
  const old = await db.meta.get("session");
  if (old?.value?.user?.id && old.value.user.id !== session.user?.id)
    await clearAccount(old.value.user.id);
  await db.meta.put({ key: "session", value: session });
}
export async function cachedSession() {
  return (await db.meta.get("session"))?.value;
}
export async function clearAccount(userId) {
  await db.transaction(
    "rw",
    db.snapshots,
    db.outbox,
    db.files,
    db.uploads,
    db.meta,
    async () => {
      for (const table of [db.snapshots, db.outbox, db.files, db.uploads])
        await table.where("userId").equals(userId).delete();
      await db.meta.delete("session");
    },
  );
  changed();
}
export async function cacheSnapshot(userId, snapshot) {
  await db.snapshots.put({
    key: key(userId, snapshot.collection.id),
    userId,
    collectionId: snapshot.collection.id,
    value: snapshot,
  });
  changed();
  return snapshot;
}
export function applyChange(snapshot, change) {
  if (change.entity === "collection")
    return { ...snapshot, collection: change.collection || change.record };
  const list = snapshot[change.entity] || [];
  return {
    ...snapshot,
    [change.entity]: change.record
      ? [...list.filter((r) => r.id !== change.id), change.record]
      : list.filter((r) => r.id !== change.id),
    collection: change.collection || snapshot.collection,
  };
}
function optimistic(snapshot, job) {
  const c = job.command;
  if (c.type === "apartments.reorder")
    return {
      ...snapshot,
      collection: {
        ...snapshot.collection,
        apartmentOrder: c.payload.apartmentOrder,
        apartmentOrderRevision: c.expectedRevision + 1,
      },
    };
  const entity = {
    "answer.put": "answers",
    "apartment.put": "apartments",
    "criterion.put": "criteria",
    "section.put": "sections",
    "scenario.put": "scenarios",
    "record.put": "records",
    "collection.put": "collection",
  }[c.type];
  if (!entity) return snapshot;
  if (entity === "collection")
    return {
      ...snapshot,
      collection: {
        ...snapshot.collection,
        ...c.payload,
        settings: { ...snapshot.collection.settings, ...c.payload.settings },
        revision: c.expectedRevision + 1,
      },
    };
  const current = snapshot[entity]?.find((r) => r.id === c.targetId) || {};
  const record = {
    ...current,
    ...c.payload,
    ...(entity === "apartments" && !current.createdAt
      ? { createdAt: new Date(job.created).toISOString() }
      : {}),
    id: c.targetId,
    revision: c.expectedRevision + 1,
    ...(c.apartmentId ? { apartmentId: c.apartmentId } : {}),
    ...(c.criterionId ? { criterionId: c.criterionId } : {}),
    scenarioId: c.scenarioId || current.scenarioId || null,
    localStatus: job.status,
    settingsRevision: snapshot.collection.revision,
  };
  if (entity === "answers")
    snapshot = {
      ...snapshot,
      answers: snapshot.answers.filter(
        (a) =>
          !(
            a.apartmentId === c.apartmentId &&
            a.criterionId === c.criterionId &&
            (a.scenarioId || null) === (c.scenarioId || null)
          ),
      ),
    };
  return applyChange(snapshot, { entity, id: c.targetId, record });
}
export async function loadWorkspace(userId, cid) {
  const stored = await db.snapshots.get(key(userId, cid));
  if (!stored) return null;
  const jobs = (
    await db.outbox
      .where("[userId+collectionId]")
      .equals([userId, cid])
      .toArray()
  ).sort((a, b) => a.created - b.created);
  const snapshot = jobs.reduce(optimistic, stored.value);
  return {
    snapshot: {
      ...snapshot,
      apartments: snapshot.apartments.map(apartmentState),
    },
    jobs,
    uploads: await db.uploads
      .where("collectionId")
      .equals(cid)
      .filter((x) => x.userId === userId)
      .toArray(),
  };
}
export async function enqueue(userId, cid, command) {
  await db.transaction("rw", db.outbox, async () => {
    const previous = await db.outbox
      .where("[userId+collectionId]")
      .equals([userId, cid])
      .filter(
        (j) =>
          !j.attempted &&
          j.status === "pending" &&
          j.command.type === command.type &&
          (j.command.targetId === command.targetId ||
            (command.type === "answer.put" &&
              j.command.apartmentId === command.apartmentId &&
              j.command.criterionId === command.criterionId &&
              (j.command.scenarioId || null) === (command.scenarioId || null))),
      )
      .first();
    if (previous) {
      command = {
        ...command,
        id: previous.id,
        targetId: previous.command.targetId,
        expectedRevision: previous.command.expectedRevision,
        checklistRevision: previous.command.checklistRevision,
        payload: { ...previous.command.payload, ...command.payload },
      };
      await db.outbox.put({ ...previous, command });
    } else
      await db.outbox.put({
        id: command.id,
        userId,
        collectionId: cid,
        command,
        created: Date.now(),
        status: "pending",
        attempted: false,
      });
  });
  changed();
}
async function receive(userId, cid, result) {
  const stored = await db.snapshots.get(key(userId, cid));
  if (stored) {
    const value = applyChange(stored.value, result);
    value.collection = {
      ...value.collection,
      sequence: stored.value.collection.sequence,
    };
    await db.snapshots.put({ ...stored, value });
  }
}
const syncPromises = new Map();
export function synchronize(userId, cid) {
  const scope = key(userId, cid);
  if (syncPromises.has(scope)) return syncPromises.get(scope);
  const work = () => syncWork(userId, cid);
  const promise = (
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(`house-sync:${scope}`, work)
      : work()
  ).finally(() => {
    syncPromises.delete(scope);
    changed();
  });
  syncPromises.set(scope, promise);
  return promise;
}
async function syncWork(userId, cid) {
  if (!navigator.onLine) return;
  const jobs = (
    await db.outbox
      .where("[userId+collectionId]")
      .equals([userId, cid])
      .toArray()
  ).sort((a, b) => a.created - b.created);
  const blocked = new Set();
  for (const job of jobs) {
    const target = job.command.targetId;
    if (blocked.has(target)) continue;
    if (job.status !== "pending") {
      blocked.add(target);
      continue;
    }
    await db.outbox.update(job.id, { attempted: true });
    try {
      const result = await request(`/api/collections/${cid}/mutations`, {
        method: "POST",
        body: JSON.stringify(job.command),
      });
      await receive(userId, cid, result);
      await db.outbox.delete(job.id);
    } catch (error) {
      if (!error.status) throw error;
      await db.outbox.update(job.id, {
        status: error.status === 409 ? "conflict" : "failed",
        error,
      });
      blocked.add(target);
      if ([401, 403, 404].includes(error.status)) break;
    }
  }
  try {
    const stored = await db.snapshots.get(key(userId, cid));
    if (stored) {
      const response = await request(
        `/api/collections/${cid}/changes?since=${stored.value.collection.sequence}`,
      );
      let value = stored.value;
      for (const change of response.changes) value = applyChange(value, change);
      value = {
        ...value,
        collection: response.collection,
        role: response.role,
      };
      await db.snapshots.put({ ...stored, value });
    }
  } catch (error) {
    if (error.status === 404) {
      await db.snapshots.delete(key(userId, cid));
      await db.files
        .where("collectionId")
        .equals(cid)
        .filter((f) => f.userId === userId)
        .delete();
    }
    throw error;
  }
  if (blocked.size === 0) {
    const uploaded = await syncUploads(userId, cid);
    if (uploaded) {
      const fresh = await request(`/api/collections/${cid}`);
      await cacheSnapshot(userId, fresh);
    }
  }
}
export async function resolveJob(job, choice, current, checklistRevision) {
  await db.transaction("rw", db.outbox, async () => {
    await db.outbox.delete(job.id);
    if (choice === "mine") {
      const command = {
        ...job.command,
        id: crypto.randomUUID(),
        targetId: current?.id || job.command.targetId,
        expectedRevision:
          job.command.type === "apartments.reorder"
            ? current?.apartmentOrderRevision || 0
            : current?.revision || 0,
        checklistRevision,
      };
      await db.outbox.put({
        ...job,
        id: command.id,
        command,
        created: Date.now(),
        status: "pending",
        attempted: false,
        error: null,
      });
    }
  });
  changed();
}
export async function retryJob(job, checklistRevision) {
  const command = {
    ...job.command,
    id: crypto.randomUUID(),
    checklistRevision,
  };
  await db.outbox.delete(job.id);
  await db.outbox.put({
    ...job,
    id: command.id,
    command,
    status: "pending",
    attempted: false,
    error: null,
  });
  changed();
}
export async function exportDrafts(userId) {
  const jobs = await db.outbox.where("userId").equals(userId).toArray();
  const blob = new Blob([JSON.stringify(jobs, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, "house-checklist-drafts.json");
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function pendingCount(userId) {
  return (
    (await db.outbox.where("userId").equals(userId).count()) +
    (await db.uploads.where("userId").equals(userId).count())
  );
}
export async function queueFile(
  userId,
  cid,
  apartmentId,
  criterionId,
  file,
  local,
  scenarioId = null,
) {
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    ) ||
    file.size > 20 * 1024 * 1024 ||
    file.size === 0
  )
    throw { error: "FILE_INVALID" };
  const id = crypto.randomUUID();
  await db.uploads.put({
    id,
    userId,
    collectionId: cid,
    apartmentId,
    criterionId,
    scenarioId,
    bytes: await file.arrayBuffer(),
    name: file.name,
    mime: file.type,
    size: file.size,
    local,
    created: Date.now(),
    status: "pending",
  });
  changed();
  return id;
}
async function syncUploads(userId, cid) {
  let uploaded = false;
  const uploads = await db.uploads
    .where("collectionId")
    .equals(cid)
    .filter((u) => u.userId === userId)
    .sortBy("created");
  for (const item of uploads) {
    if (item.status === "failed") continue;
    try {
      const file = item.file || new Blob([item.bytes], { type: item.mime });
      if (item.local) {
        const form = new FormData();
        form.append("file", file, item.name);
        for (const key of ["id", "apartmentId", "criterionId", "scenarioId"])
          if (item[key]) form.append(key, item[key]);
        await request(`/api/collections/${cid}/uploads`, {
          method: "POST",
          body: form,
        });
      } else
        await upload(`collections/${cid}/${item.id}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({
            ...item,
            file: undefined,
            bytes: undefined,
          }),
          multipart: item.size > 4 * 1024 * 1024,
        });
      await db.files.put({
        key: key(userId, item.id),
        userId,
        collectionId: cid,
        bytes: item.bytes || (await file.arrayBuffer()),
        mime: item.mime,
      });
      await db.uploads.delete(item.id);
      uploaded = true;
    } catch (error) {
      if (!navigator.onLine) break;
      await db.uploads.update(item.id, {
        status: "failed",
        error: error.error || "UPLOAD_FAILED",
      });
    }
  }
  return uploaded;
}
export async function retryUpload(id) {
  await db.uploads.update(id, { status: "pending", error: null });
  changed();
}
export async function getCachedFile(userId, attachmentId) {
  const file = await db.files.get(key(userId, attachmentId));
  return (
    file?.blob ||
    (file?.bytes ? new Blob([file.bytes], { type: file.mime }) : undefined)
  );
}
export async function prepareViewing(userId, snapshot, apartmentId) {
  const files = snapshot.records.filter(
    (r) =>
      r.kind === "attachment" &&
      r.apartmentId === apartmentId &&
      !r.archived &&
      r.uploadState === "ready",
  );
  for (const file of files) {
    const response = await fetch(
      `/api/collections/${snapshot.collection.id}/files/${file.id}`,
    );
    if (!response.ok) throw { error: "DOWNLOAD_FAILED" };
    await db.files.put({
      key: key(userId, file.id),
      userId,
      collectionId: snapshot.collection.id,
      bytes: await response.arrayBuffer(),
      mime: file.mime,
    });
  }
  await db.meta.put({
    key: `prepared:${userId}:${apartmentId}`,
    value: new Date().toISOString(),
  });
  changed();
  return files.length;
}
