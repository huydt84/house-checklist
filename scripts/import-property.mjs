import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { put } from "@vercel/blob";
import { localMode } from "../lib/config.mjs";
import { pool, closeDb } from "../lib/db.mjs";
import { ensure } from "../lib/errors.mjs";
import { normalizeAnswer } from "../lib/domain.mjs";
import { snapshot, mutate, uuidPattern } from "../lib/repository.mjs";
import {
  validateFile,
  reserveUpload,
  finalizeUpload,
} from "../lib/uploads.mjs";

function stableId(...parts) {
  const bytes = createHash("sha256").update(JSON.stringify(parts)).digest();
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const same = (current, payload) =>
  current &&
  Object.entries(payload).every(([k, v]) => isDeepStrictEqual(current[k], v));

async function run(filename, apply) {
  const input = JSON.parse(await readFile(filename, "utf8"));
  ensure(
    uuidPattern.test(input.collectionId) && uuidPattern.test(input.actorId),
    "INVALID_ID",
  );
  ensure(
    typeof input.propertyKey === "string" && input.propertyKey.trim(),
    "PROPERTY_KEY_REQUIRED",
  );
  ensure(input.apartment?.name?.trim(), "NAME_REQUIRED");
  ensure(
    input.environment === (localMode() ? "local" : "production"),
    "IMPORT_ENVIRONMENT_MISMATCH",
  );
  if (!localMode())
    ensure(process.env.LOCAL_AUTH !== "true", "LOCAL_AUTH_FORBIDDEN");
  const user = (
    await pool().query("SELECT id,email,name FROM users WHERE id=$1", [
      input.actorId,
    ])
  ).rows[0];
  ensure(user, "USER_NOT_FOUND");
  const s = await snapshot(input.collectionId, user);
  ensure(["owner", "editor"].includes(s.role), "FORBIDDEN");
  ensure(!s.collection.archived, "COLLECTION_ARCHIVED");
  const cid = s.collection.id;
  const generatedId = stableId(cid, "property", input.propertyKey);
  const matches = s.apartments.filter(
    (a) =>
      a.id === (input.apartmentId || generatedId) ||
      a.name === input.apartment.name.trim(),
  );
  ensure(matches.length <= 1, "AMBIGUOUS_PROPERTY");
  const previous = matches[0];
  ensure(!previous?.archived, "PROPERTY_ARCHIVED");
  const apartmentId = previous?.id || input.apartmentId || generatedId;
  ensure(uuidPattern.test(apartmentId), "INVALID_ID");
  const plan = [];
  function add(type, targetId, current, payload, extra = {}) {
    if (!same(current, payload))
      plan.push({
        id: randomUUID(),
        type,
        targetId,
        expectedRevision: current?.revision || 0,
        payload,
        ...extra,
      });
  }
  add("apartment.put", apartmentId, previous, input.apartment);
  const scenarios = new Map();
  for (const item of input.scenarios || []) {
    ensure(item.key && !scenarios.has(item.key), "DUPLICATE_SCENARIO");
    const matches = s.scenarios.filter(
      (x) =>
        x.id === stableId(cid, "scenario", item.key) ||
        (x.name === item.payload.name &&
          x.destination === item.payload.destination),
    );
    ensure(matches.length <= 1, "AMBIGUOUS_SCENARIO");
    const current = matches[0];
    ensure(!current?.archived, "SCENARIO_ARCHIVED");
    const id = current?.id || stableId(cid, "scenario", item.key);
    scenarios.set(item.key, id);
    add("scenario.put", id, current, item.payload);
  }
  const answerKeys = new Set();
  for (const item of input.answers || []) {
    const criterion = s.criteria.find((c) => c.key === item.key && !c.archived);
    ensure(criterion, "CRITERION_NOT_FOUND", 400, { key: item.key });
    const scenarioId = item.scenarioKey
      ? scenarios.get(item.scenarioKey)
      : null;
    ensure(
      criterion.scope === "journey" ? Boolean(scenarioId) : !scenarioId,
      "ANSWER_SCOPE_MISMATCH",
    );
    const key = `${criterion.id}:${scenarioId || ""}`;
    ensure(!answerKeys.has(key), "DUPLICATE_ANSWER");
    answerKeys.add(key);
    const current = s.answers.find(
      (a) =>
        a.apartmentId === apartmentId &&
        a.criterionId === criterion.id &&
        a.scenarioId === scenarioId,
    );
    const payload = normalizeAnswer(
      { ...current, ...item.payload },
      criterion,
      current,
      s.collection.revision,
    );
    add(
      "answer.put",
      current?.id || stableId(apartmentId, "answer", key),
      current,
      payload,
      {
        apartmentId,
        criterionId: criterion.id,
        scenarioId,
        checklistRevision: s.collection.checklistRevision,
      },
    );
  }
  const recordKeys = new Set();
  for (const item of input.records || []) {
    ensure(item.key && !recordKeys.has(item.key), "DUPLICATE_RECORD");
    recordKeys.add(item.key);
    const id = stableId(apartmentId, "record", item.key);
    const current = s.records.find((r) => r.id === id);
    ensure(!current?.archived, "RECORD_ARCHIVED");
    const scenarioId = item.scenarioKey
      ? scenarios.get(item.scenarioKey)
      : null;
    ensure(!item.scenarioKey || scenarioId, "SCENARIO_NOT_FOUND");
    add("record.put", id, current, item.payload, { apartmentId, scenarioId });
  }
  const attachments = [];
  for (const item of input.attachments || []) {
    const bytes = await readFile(resolve(dirname(filename), item.path));
    validateFile({ type: item.mime, size: bytes.length });
    const hash = createHash("sha256").update(bytes).digest("hex");
    const id = stableId(apartmentId, "attachment", item.name, hash);
    const current = s.records.find((r) => r.id === id);
    ensure(!current?.archived, "ATTACHMENT_ARCHIVED");
    if (current?.uploadState !== "ready")
      attachments.push({
        bytes,
        input: {
          id,
          apartmentId,
          name: item.name,
          mime: item.mime,
          size: bytes.length,
        },
      });
  }
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "preview",
      collection: s.collection.name,
      property: input.apartment.name,
      apartmentId,
      mutations: plan.length,
      uploads: attachments.length,
    }),
  );
  if (!apply) return;
  let checklistRevision = s.collection.checklistRevision;
  for (const command of plan) {
    if (command.type === "answer.put")
      command.checklistRevision = checklistRevision;
    const result = await mutate(cid, user, command);
    if (command.type === "scenario.put") checklistRevision++;
    ensure(
      result.collection.checklistRevision === checklistRevision,
      "CHECKLIST_CHANGED",
    );
  }
  for (const attachment of attachments) {
    const reserved = await reserveUpload(cid, user, attachment.input);
    if (reserved.uploadState !== "ready") {
      if (localMode()) {
        await mkdir(".local-files", { recursive: true });
        await writeFile(`.local-files/${reserved.id}`, attachment.bytes);
      } else
        await put(reserved.pathname, attachment.bytes, {
          access: "private",
          contentType: attachment.input.mime,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
      await finalizeUpload(cid, user, reserved.id, reserved.pathname);
    }
  }
  const result = await snapshot(cid, user);
  for (const command of plan) {
    const table = {
      "apartment.put": "apartments",
      "scenario.put": "scenarios",
      "answer.put": "answers",
      "record.put": "records",
    }[command.type];
    ensure(
      same(
        result[table].find((r) => r.id === command.targetId),
        command.payload,
      ),
      "IMPORT_VERIFICATION_FAILED",
    );
  }
  for (const attachment of attachments)
    ensure(
      result.records.some(
        (r) => r.id === attachment.input.id && r.uploadState === "ready",
      ),
      "UPLOAD_VERIFICATION_FAILED",
    );
  console.log(
    JSON.stringify({
      verified: true,
      apartmentId,
      sequence: result.collection.sequence,
    }),
  );
}

try {
  const [filename, flag, ...rest] = process.argv.slice(2);
  ensure(
    filename && (!flag || flag === "--apply") && !rest.length,
    "USAGE: import:property input.json [--apply]",
  );
  await run(resolve(filename), flag === "--apply");
} catch (error) {
  console.error(JSON.stringify({ error: error.code || "IMPORT_FAILED" }));
  process.exitCode = 1;
} finally {
  await closeDb();
}
