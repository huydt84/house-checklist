import { randomUUID, createHash, createHmac } from "node:crypto";
import { pool, transaction } from "./db.mjs";
import { ensure, AppError } from "./errors.mjs";
import {
  instantiateTemplate,
  personalPreset,
  presetScenarios,
} from "./seed.mjs";
import {
  normalizeAnswer,
  STATUSES,
  IMPORTANCE,
  STAGES,
  validateUrl,
  scenarioApplies,
} from "./domain.mjs";
import { localMode, personas } from "./config.mjs";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(value) {
  ensure(typeof value === "string" && uuidPattern.test(value), "INVALID_ID");
  return value;
}
function dataRow(row) {
  if (!row) return null;
  return {
    ...row.data,
    id: row.id,
    collectionId: row.collection_id,
    revision: row.revision,
    ...(row.created_at
      ? {
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
        }
      : {}),
    ...(row.apartment_id ? { apartmentId: row.apartment_id } : {}),
    ...(row.criterion_id ? { criterionId: row.criterion_id } : {}),
    ...(row.section_id ? { sectionId: row.section_id } : {}),
    scenarioId: row.scenario_id || null,
    ...(row.kind ? { kind: row.kind } : {}),
    ...(row.updated_by
      ? { updatedBy: row.updated_by, updatedAt: row.updated_at }
      : {}),
  };
}
function collectionRow(row) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    settings: row.settings,
    revision: row.revision,
    checklistRevision: row.checklist_revision,
    sequence: Number(row.sequence),
    templateVersion: row.template_version,
    apartmentOrder: row.apartment_order,
    apartmentOrderRevision: row.apartment_order_revision,
    deletedAt: row.deleted_at,
    archived: row.archived,
  };
}
function invitationRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    revision: row.revision,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    acceptedBy: row.accepted_by,
    delivery: row.delivery,
  };
}
export async function upsertUser({ sub, email, name, oauthEncrypted }) {
  const { rows } = await pool().query(
    `INSERT INTO users(id,google_sub,email,name,oauth_encrypted) VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,name=excluded.name,oauth_encrypted=coalesce(excluded.oauth_encrypted,users.oauth_encrypted)
 RETURNING id,email,name,locale`,
    [
      randomUUID(),
      sub,
      email.trim().toLowerCase(),
      name || email,
      oauthEncrypted || null,
    ],
  );
  return rows[0];
}
export async function localUser(key) {
  ensure(localMode(), "NOT_FOUND", 404);
  const p = personas[key];
  if (!p) return null;
  await pool().query(
    "INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
    [p.id, `local:${key}`, p.email, p.name],
  );
  return (
    await pool().query("SELECT id,email,name,locale FROM users WHERE id=$1", [
      p.id,
    ])
  ).rows[0];
}
export async function listCollections(user) {
  return (
    await pool().query(
      `SELECT c.*,CASE WHEN c.owner_id=$1 THEN 'owner' ELSE m.role END AS role
 FROM collections c LEFT JOIN memberships m ON m.collection_id=c.id AND m.user_id=$1
 WHERE c.deleted_at IS NULL AND (c.owner_id=$1 OR m.user_id=$1) ORDER BY c.created_at`,
      [user.id],
    )
  ).rows.map((r) => ({ ...collectionRow(r), role: r.role }));
}
export async function access(db, collectionId, user, write = false) {
  id(collectionId);
  const row = (
    await db.query(
      `SELECT * FROM collections WHERE id=$1${write ? " FOR UPDATE" : ""}`,
      [collectionId],
    )
  ).rows[0];
  ensure(row && !row.deleted_at, "NOT_FOUND", 404);
  const role =
    row.owner_id === user.id
      ? "owner"
      : (
          await db.query(
            "SELECT role FROM memberships WHERE collection_id=$1 AND user_id=$2",
            [collectionId, user.id],
          )
        ).rows[0]?.role;
  ensure(role, "NOT_FOUND", 404);
  return { row, role };
}
export async function createCollection(
  user,
  name,
  collectionId = randomUUID(),
) {
  id(collectionId);
  ensure(
    typeof name === "string" && name.trim() && name.length <= 120,
    "NAME_REQUIRED",
  );
  return transaction(async (db) => {
    const existing = (
      await db.query(
        "SELECT * FROM collections WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL",
        [collectionId, user.id],
      )
    ).rows[0];
    if (existing) return { ...collectionRow(existing), role: "owner" };
    const { rows } = await db.query(
      "INSERT INTO collections(id,owner_id,name,settings) VALUES($1,$2,$3,$4) RETURNING *",
      [
        collectionId,
        user.id,
        name.trim(),
        { currency: "JPY", timezone: "Asia/Tokyo", moveInDate: "" },
      ],
    );
    const seed = instantiateTemplate(randomUUID);
    const sections = seed.sections.map((section) => {
      const { id: sectionId, revision, ...data } = section;
      void revision;
      return { id: sectionId, data };
    });
    const criteria = seed.criteria.map((criterion) => {
      const { id: criterionId, sectionId, revision, ...data } = criterion;
      void revision;
      return { id: criterionId, section_id: sectionId, data };
    });
    // Keep the seed atomic without a network round trip for every check.
    await db.query(
      `INSERT INTO sections(id,collection_id,data)
         SELECT id,$1,data FROM jsonb_to_recordset($2::jsonb) AS seed(id uuid,data jsonb)`,
      [collectionId, JSON.stringify(sections)],
    );
    await db.query(
      `INSERT INTO criteria(id,collection_id,section_id,data)
         SELECT id,$1,section_id,data FROM jsonb_to_recordset($2::jsonb) AS seed(id uuid,section_id uuid,data jsonb)`,
      [collectionId, JSON.stringify(criteria)],
    );
    return { ...collectionRow(rows[0]), role: "owner" };
  });
}
export async function snapshot(collectionId, user) {
  return transaction(async (db) => {
    await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const { row, role } = await access(db, collectionId, user);
    const result = { collection: collectionRow(row), role };
    // One round trip for the snapshot entities, still inside the authorized
    // repeatable-read transaction. Table names are fixed, never user input.
    const tables = [
      "sections",
      "criteria",
      "apartments",
      "answers",
      "records",
      "scenarios",
    ];
    const entities = (
      await db.query(
        `SELECT ${tables
          .map(
            (table) =>
              `(SELECT coalesce(jsonb_agg(t ORDER BY t.id), '[]'::jsonb) FROM ${table} t WHERE collection_id=$1) AS ${table}`,
          )
          .join(", ")},
      (SELECT coalesce(jsonb_agg(members), '[]'::jsonb) FROM (
        SELECT m.user_id AS id,m.role,m.revision,u.name,u.email
        FROM memberships m JOIN users u ON u.id=m.user_id WHERE collection_id=$1
      ) members) AS members,
      CASE WHEN $2::boolean THEN (SELECT coalesce(jsonb_agg(i ORDER BY created_at DESC), '[]'::jsonb)
        FROM invitations i WHERE collection_id=$1) ELSE '[]'::jsonb END AS invitations`,
        [collectionId, role === "owner"],
      )
    ).rows[0];
    for (const table of tables) result[table] = entities[table].map(dataRow);
    result.members = entities.members;
    result.invitations = entities.invitations.map(invitationRow);
    return result;
  });
}
export async function changes(collectionId, user, since) {
  id(collectionId);
  // A single PostgreSQL statement uses one consistent snapshot for membership,
  // collection sequence and events; it avoids five sequential network trips.
  const row = (
    await pool().query(
      `
    SELECT c.*, CASE WHEN c.owner_id=$2 THEN 'owner' ELSE m.role END AS role,
      (SELECT coalesce(jsonb_agg(e ORDER BY e.sequence), '[]'::jsonb)
       FROM events e WHERE e.collection_id=c.id AND e.sequence>$3
         AND e.sequence<=c.sequence
         AND (c.owner_id=$2 OR e.entity<>'invitations')) AS events
    FROM collections c
    LEFT JOIN memberships m ON m.collection_id=c.id AND m.user_id=$2
    WHERE c.id=$1 AND c.deleted_at IS NULL
      AND (c.owner_id=$2 OR m.user_id IS NOT NULL)`,
      [collectionId, user.id, Math.max(0, Number(since) || 0)],
    )
  ).rows[0];
  ensure(row, "NOT_FOUND", 404);
  return {
    collection: collectionRow(row),
    role: row.role,
    changes: row.events.map((e) => ({
      entity: e.entity,
      id: e.record_id,
      record: e.payload,
      sequence: Number(e.sequence),
    })),
  };
}
export async function history(collectionId, user, recordId) {
  await access(pool(), collectionId, user);
  id(recordId);
  return (
    await pool().query(
      "SELECT h.*,u.name AS actor FROM history h JOIN users u ON u.id=h.actor_id WHERE collection_id=$1 AND record_id=$2 ORDER BY h.id DESC LIMIT 100",
      [collectionId, recordId],
    )
  ).rows;
}
function revision(current, expected) {
  ensure(Number.isInteger(expected) && expected >= 0, "REVISION_REQUIRED");
  ensure((current?.revision || 0) === expected, "CONFLICT", 409, { current });
}
function pick(input, keys) {
  return Object.fromEntries(
    keys.filter((k) => Object.hasOwn(input, k)).map((k) => [k, input[k]]),
  );
}
function cleanCriterion(payload, previous) {
  const next = {
    ...(previous || {}),
    ...pick(payload, [
      "key",
      "sourceKey",
      "section",
      "sectionId",
      "labels",
      "guidance",
      "type",
      "unit",
      "choices",
      "supportFields",
      "sourceLocale",
      "order",
      "importance",
      "stages",
      "archived",
      "scope",
    ]),
  };
  ensure(
    ["boolean", "text", "number", "select", "date"].includes(next.type),
    "INVALID_TYPE",
  );
  ensure(IMPORTANCE.includes(next.importance), "INVALID_IMPORTANCE");
  ensure(
    Array.isArray(next.stages) &&
      next.stages.length > 0 &&
      next.stages.every((s) => STAGES.includes(s)),
    "INVALID_STAGES",
  );
  ensure(
    next.labels &&
      Object.values(next.labels).some((x) => typeof x === "string" && x.trim()),
    "NAME_REQUIRED",
  );
  ensure(
    ["apartment", "journey"].includes(next.scope || "apartment"),
    "INVALID_SCOPE",
  );
  ensure(
    Array.isArray(next.choices) &&
      next.choices.every((o) => typeof o.id === "string" && o.labels),
    "INVALID_CHOICE",
  );
  ensure(
    new Set(next.choices.map((o) => o.id)).size === next.choices.length,
    "DUPLICATE_CHOICE",
  );
  ensure(
    next.type !== "select" || next.choices.some((o) => !o.retired),
    "CHOICES_REQUIRED",
  );
  if (previous) {
    next.key = previous.key;
    next.sourceKey = previous.sourceKey;
    const lang = next.sourceLocale || "en";
    if (next.labels[lang] !== previous.labels?.[lang])
      next.labels = { [lang]: next.labels[lang] };
    if (next.guidance?.[lang] !== previous.guidance?.[lang])
      next.guidance = { [lang]: next.guidance?.[lang] || "" };
  }
  return next;
}
function cleanApartment(payload, previous) {
  const next = {
    ...previous,
    ...pick(payload, [
      "name",
      "room",
      "address",
      "listingUrls",
      "mapUrl",
      "agentName",
      "agentEmail",
      "agentPhone",
      "status",
      "viewed",
      "viewingAt",
      "rentStart",
      "handoverDate",
      "advantages",
      "disadvantages",
      "rejectionReason",
      "archived",
      "costsReviewed",
      "moveOutDate",
      "quoteTotal",
      "expense24",
    ]),
  };
  ensure(
    typeof next.name === "string" &&
      next.name.trim() &&
      next.name.length <= 200,
    "NAME_REQUIRED",
  );
  next.name = next.name.trim();
  if (next.expense24 === "") next.expense24 = null;
  if (next.expense24 != null) {
    ensure(
      typeof next.expense24 === "number" &&
        Number.isFinite(next.expense24) &&
        next.expense24 >= 0,
      "INVALID_AMOUNT",
    );
  }
  next.status ||= "considering";
  ensure(STATUSES.includes(next.status), "INVALID_STATUS");
  if (next.viewed === undefined) next.viewed = false;
  if (next.archived === undefined) next.archived = false;
  ensure(typeof next.viewed === "boolean", "INVALID_VIEWED");
  ensure(typeof next.archived === "boolean", "INVALID_ARCHIVED");
  if (next.mapUrl) validateUrl(next.mapUrl);
  for (const url of next.listingUrls || []) validateUrl(url);
  ensure(
    !next.viewingAt || !Number.isNaN(Date.parse(next.viewingAt)),
    "INVALID_DATE",
  );
  return next;
}
function cleanRecord(payload, previous) {
  const next = { ...previous, ...payload };
  delete next.id;
  delete next.revision;
  delete next.collectionId;
  ensure(
    [
      "cost",
      "adjustment",
      "benefit",
      "payment",
      "journey",
      "question",
      "attachment",
    ].includes(next.kind),
    "INVALID_RECORD",
  );
  if (previous) ensure(next.kind === previous.kind, "INVALID_RECORD");
  if (next.url) validateUrl(next.url);
  for (const key of [
    "amount",
    "frequency",
    "taxRate",
    "reimbursed",
    "outboundMinutes",
    "returnMinutes",
    "outboundFare",
    "returnFare",
    "transfers",
    "taxiFare",
    "bookingSurcharge",
  ])
    if (next[key] !== null && next[key] !== undefined && next[key] !== "")
      ensure(
        typeof next[key] === "number" &&
          Number.isFinite(next[key]) &&
          next[key] >= 0,
        "INVALID_AMOUNT",
      );
  for (const key of [
    "amount",
    "reimbursed",
    "outboundFare",
    "returnFare",
    "taxiFare",
    "bookingSurcharge",
  ])
    if (next[key] != null && next[key] !== "")
      ensure(Number.isInteger(next[key]), "INVALID_AMOUNT");
  if (next.kind === "question")
    ensure(
      typeof next.text === "string" && next.text.trim(),
      "QUESTION_REQUIRED",
    );
  if (["cost", "benefit", "payment", "adjustment"].includes(next.kind))
    ensure(typeof next.name === "string" && next.name.trim(), "NAME_REQUIRED");
  if (next.kind === "question") {
    next.status ||= "open";
    ensure(["open", "resolved"].includes(next.status), "INVALID_STATUS");
  }
  if (["cost", "benefit", "payment", "adjustment"].includes(next.kind)) {
    next.currency = "JPY";
    if (next.formula) {
      ensure(
        typeof next.formula === "object" && !Array.isArray(next.formula),
        "INVALID_FORMULA",
      );
      for (const key of ["factor", "percent"])
        if (next.formula[key] != null)
          ensure(
            typeof next.formula[key] === "number" &&
              Number.isFinite(next.formula[key]) &&
              next.formula[key] >= 0,
            "INVALID_AMOUNT",
          );
      if (next.formula.type === "percentage")
        ensure(
          Array.isArray(next.formula.bases) &&
            next.formula.bases.every((b) => typeof b === "string"),
          "INVALID_FORMULA",
        );
    }
  }
  if (next.kind === "cost") {
    ensure(
      ["once", "monthly", "annual", "renewal"].includes(
        next.frequencyUnit || "once",
      ),
      "INVALID_FREQUENCY",
    );
    ensure(
      ["expense", "deposit", "hold"].includes(next.treatment || "expense"),
      "INVALID_TREATMENT",
    );
  }
  if (next.kind === "attachment") {
    if (!previous) {
      ensure(Boolean(next.url), "UPLOAD_REQUIRED");
      next.storage = "link";
    } else
      for (const key of ["storage", "pathname", "mime", "size", "uploadState"])
        next[key] = previous[key];
  }
  return next;
}
export function inviteToken(collectionId, mutationId) {
  const secret =
    process.env.AUTH_SECRET ||
    (localMode() ? "local-house-development-secret" : null);
  ensure(secret, "AUTH_NOT_CONFIGURED", 503);
  return createHmac("sha256", secret)
    .update(`${collectionId}:${mutationId}`)
    .digest("base64url");
}
export async function mutate(collectionId, user, command) {
  id(command.id);
  id(command.targetId);
  ensure(typeof command.type === "string", "INVALID_MUTATION");
  ensure(
    command.payload &&
      typeof command.payload === "object" &&
      !Array.isArray(command.payload),
    "INVALID_MUTATION",
  );
  const hash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex");
  return transaction(async (db) => {
    const { row: collection, role } = await access(
      db,
      collectionId,
      user,
      true,
    );
    const ownerOnly = [
      "collection.delete",
      "collection.archive",
      "member.put",
      "member.delete",
      "invitation.create",
      "invitation.revoke",
      "invitation.resend",
    ];
    ensure(
      role === "owner" ||
        (!ownerOnly.includes(command.type) && role === "editor"),
      "FORBIDDEN",
      403,
    );
    const receipt = (
      await db.query(
        "SELECT * FROM mutation_receipts WHERE collection_id=$1 AND actor_id=$2 AND mutation_id=$3",
        [collectionId, user.id, command.id],
      )
    ).rows[0];
    if (receipt) {
      ensure(receipt.request_hash === hash, "MUTATION_ID_REUSED", 409);
      return receipt.result;
    }
    const p = command.payload;
    let entity,
      record,
      current = null;
    if (
      ["criterion.put", "section.put", "answer.put", "answer.restore"].includes(
        command.type,
      )
    )
      ensure(
        command.checklistRevision === collection.checklist_revision,
        "CHECKLIST_CHANGED",
        409,
        { checklistRevision: collection.checklist_revision },
      );
    if (command.type === "apartments.reorder") {
      entity = "collection";
      current = collectionRow(collection);
      ensure(command.targetId === collectionId, "INVALID_ID");
      ensure(
        Number.isInteger(command.expectedRevision) &&
          command.expectedRevision >= 0,
        "REVISION_REQUIRED",
      );
      ensure(
        command.expectedRevision === current.apartmentOrderRevision,
        "CONFLICT",
        409,
        { current },
      );
      ensure(
        Array.isArray(p.apartmentOrder) &&
          new Set(p.apartmentOrder).size === p.apartmentOrder.length,
        "INVALID_ORDER",
      );
      p.apartmentOrder.forEach(id);
      const properties = await db.query(
        "SELECT id FROM apartments WHERE collection_id=$1 AND id=ANY($2::uuid[])",
        [collectionId, p.apartmentOrder],
      );
      ensure(properties.rowCount === p.apartmentOrder.length, "INVALID_ORDER");
      record = collectionRow(
        (
          await db.query(
            "UPDATE collections SET apartment_order=$2,apartment_order_revision=apartment_order_revision+1 WHERE id=$1 RETURNING *",
            [collectionId, JSON.stringify(p.apartmentOrder)],
          )
        ).rows[0],
      );
    } else if (
      command.type === "collection.put" ||
      command.type === "collection.archive" ||
      command.type === "collection.delete"
    ) {
      entity = "collection";
      current = collectionRow(collection);
      revision(current, command.expectedRevision);
      if (command.type === "collection.archive") {
        ensure(command.targetId === collectionId, "INVALID_ID");
        ensure(typeof p.archived === "boolean", "INVALID_ARCHIVED");
        record = collectionRow(
          (
            await db.query(
              "UPDATE collections SET archived=$2,revision=revision+1 WHERE id=$1 RETURNING *",
              [collectionId, p.archived],
            )
          ).rows[0],
        );
      } else if (command.type === "collection.delete") {
        await db.query(
          "UPDATE collections SET deleted_at=now(),revision=revision+1 WHERE id=$1",
          [collectionId],
        );
        record = {
          ...current,
          deletedAt: new Date().toISOString(),
          revision: current.revision + 1,
        };
      } else {
        const name = p.name ?? collection.name;
        ensure(
          typeof name === "string" && name.trim() && name.length <= 120,
          "NAME_REQUIRED",
        );
        const settings = {
          ...collection.settings,
          ...p.settings,
          currency: "JPY",
          timezone: "Asia/Tokyo",
        };
        for (const key of [
          "budget",
          "minArea",
          "maxWalkMinutes",
          "futonWidth",
          "futonLength",
          "allowanceAmount",
          "allowanceRadius",
        ])
          if (settings[key] != null && settings[key] !== "")
            ensure(
              typeof settings[key] === "number" && settings[key] >= 0,
              "INVALID_AMOUNT",
            );
        record = collectionRow(
          (
            await db.query(
              "UPDATE collections SET name=$2,settings=$3,revision=revision+1 WHERE id=$1 RETURNING *",
              [collectionId, name.trim(), settings],
            )
          ).rows[0],
        );
      }
    } else if (
      command.type === "member.put" ||
      command.type === "member.delete"
    ) {
      entity = "members";
      ensure(command.targetId !== collection.owner_id, "OWNER_ROLE_FIXED");
      current = (
        await db.query(
          "SELECT m.user_id AS id,m.role,m.revision,u.name,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.collection_id=$1 AND m.user_id=$2",
          [collectionId, command.targetId],
        )
      ).rows[0];
      ensure(current, "NOT_FOUND", 404);
      revision(current, command.expectedRevision);
      if (command.type === "member.delete") {
        await db.query(
          "DELETE FROM memberships WHERE collection_id=$1 AND user_id=$2",
          [collectionId, command.targetId],
        );
        record = null;
      } else {
        ensure(["viewer", "editor"].includes(p.role), "INVALID_ROLE");
        await db.query(
          "UPDATE memberships SET role=$3,revision=revision+1 WHERE collection_id=$1 AND user_id=$2",
          [collectionId, command.targetId, p.role],
        );
        record = { ...current, role: p.role, revision: current.revision + 1 };
      }
    } else if (command.type.startsWith("invitation.")) {
      entity = "invitations";
      const old = (
        await db.query(
          "SELECT * FROM invitations WHERE collection_id=$1 AND id=$2",
          [collectionId, command.targetId],
        )
      ).rows[0];
      current = old ? invitationRow(old) : null;
      revision(current, command.expectedRevision);
      if (command.type === "invitation.revoke") {
        ensure(old, "NOT_FOUND", 404);
        record = invitationRow(
          (
            await db.query(
              "UPDATE invitations SET revoked_at=now(),revision=revision+1 WHERE id=$1 RETURNING *",
              [old.id],
            )
          ).rows[0],
        );
      } else {
        ensure(
          ["invitation.create", "invitation.resend"].includes(command.type),
          "INVALID_MUTATION",
        );
        const email = (p.email || old?.email || "").trim().toLowerCase();
        const inviteRole = p.role || old?.role;
        ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "INVALID_EMAIL");
        ensure(email !== user.email, "CANNOT_INVITE_SELF");
        ensure(["viewer", "editor"].includes(inviteRole), "INVALID_ROLE");
        const tokenHash = createHash("sha256")
          .update(inviteToken(collectionId, command.id))
          .digest("hex");
        record = invitationRow(
          (
            await db.query(
              `INSERT INTO invitations(id,collection_id,email,role,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')
      ON CONFLICT(id) DO UPDATE SET email=excluded.email,role=excluded.role,token_hash=excluded.token_hash,expires_at=excluded.expires_at,revoked_at=NULL,accepted_by=NULL,delivery='pending',revision=invitations.revision+1 WHERE invitations.collection_id=excluded.collection_id RETURNING *`,
              [command.targetId, collectionId, email, inviteRole, tokenHash],
            )
          ).rows[0],
        );
      }
    } else if (
      command.type === "answer.put" ||
      command.type === "answer.restore"
    ) {
      entity = "answers";
      id(command.apartmentId);
      id(command.criterionId);
      if (command.scenarioId) id(command.scenarioId);
      const apartment = (
        await db.query(
          "SELECT * FROM apartments WHERE collection_id=$1 AND id=$2",
          [collectionId, command.apartmentId],
        )
      ).rows[0];
      ensure(
        apartment && !apartment.data.archived,
        "APARTMENT_UNAVAILABLE",
        409,
      );
      const criterionRow = (
        await db.query(
          "SELECT c.*,s.data AS section FROM criteria c JOIN sections s ON s.id=c.section_id WHERE c.collection_id=$1 AND c.id=$2",
          [collectionId, command.criterionId],
        )
      ).rows[0];
      ensure(
        criterionRow &&
          !criterionRow.data.archived &&
          criterionRow.section.enabled,
        "CRITERION_UNAVAILABLE",
        409,
      );
      const criterion = {
        ...dataRow(criterionRow),
        section: criterionRow.section.key,
      };
      ensure(
        criterion.scope === "journey"
          ? Boolean(command.scenarioId)
          : !command.scenarioId,
        "SCENARIO_REQUIRED",
      );
      if (command.scenarioId) {
        const scenario = (
          await db.query(
            "SELECT * FROM scenarios WHERE collection_id=$1 AND id=$2",
            [collectionId, command.scenarioId],
          )
        ).rows[0];
        ensure(
          scenario &&
            !scenario.data.archived &&
            scenarioApplies(criterion, scenario.data),
          "SCENARIO_UNAVAILABLE",
          409,
        );
      }
      const old = (
        await db.query(
          "SELECT * FROM answers WHERE collection_id=$1 AND apartment_id=$2 AND criterion_id=$3 AND scenario_id IS NOT DISTINCT FROM $4",
          [
            collectionId,
            command.apartmentId,
            command.criterionId,
            command.scenarioId || null,
          ],
        )
      ).rows[0];
      current = dataRow(old);
      revision(current, command.expectedRevision);
      let value = p;
      if (command.type === "answer.restore") {
        const h = (
          await db.query(
            "SELECT after_value FROM history WHERE collection_id=$1 AND record_id=$2 AND id=$3 AND entity='answers'",
            [collectionId, old?.id, p.historyId],
          )
        ).rows[0];
        ensure(h, "NOT_FOUND", 404);
        value = h.after_value;
      }
      const data = normalizeAnswer(
        value,
        criterion,
        current,
        collection.revision,
      );
      record = dataRow(
        (
          await db.query(
            `INSERT INTO answers(id,collection_id,apartment_id,criterion_id,scenario_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_by=excluded.updated_by,updated_at=now(),revision=answers.revision+1 WHERE answers.collection_id=excluded.collection_id AND answers.apartment_id=excluded.apartment_id AND answers.criterion_id=excluded.criterion_id AND answers.scenario_id IS NOT DISTINCT FROM excluded.scenario_id RETURNING *`,
            [
              old?.id || command.targetId,
              collectionId,
              command.apartmentId,
              command.criterionId,
              command.scenarioId || null,
              data,
              user.id,
            ],
          )
        ).rows[0],
      );
    } else {
      const tables = {
        "apartment.put": "apartments",
        "criterion.put": "criteria",
        "section.put": "sections",
        "scenario.put": "scenarios",
        "record.put": "records",
      };
      entity = tables[command.type];
      ensure(entity, "INVALID_MUTATION");
      const old = (
        await db.query(
          `SELECT * FROM ${entity} WHERE collection_id=$1 AND id=$2`,
          [collectionId, command.targetId],
        )
      ).rows[0];
      current = dataRow(old);
      revision(current, command.expectedRevision);
      let data;
      if (entity === "apartments") data = cleanApartment(p, current);
      if (entity === "criteria") {
        data = cleanCriterion(p, current);
        id(data.sectionId);
        ensure(
          (
            await db.query(
              "SELECT id FROM sections WHERE collection_id=$1 AND id=$2",
              [collectionId, data.sectionId],
            )
          ).rowCount,
          "INVALID_SECTION",
        );
        if (current) {
          const hasAnswers = (
            await db.query(
              "SELECT 1 FROM answers WHERE collection_id=$1 AND criterion_id=$2 LIMIT 1",
              [collectionId, current.id],
            )
          ).rowCount;
          ensure(
            !hasAnswers ||
              (data.type === current.type &&
                data.unit === current.unit &&
                data.scope === current.scope),
            "TYPE_CHANGE_BLOCKED",
            409,
          );
          for (const choice of current.choices || [])
            if (!data.choices.some((o) => o.id === choice.id))
              data.choices.push({ ...choice, retired: true });
        }
      }
      if (entity === "sections") {
        data = {
          ...current,
          ...pick(p, ["key", "labels", "enabled", "order"]),
        };
        ensure(
          data.labels && Object.values(data.labels).some(Boolean),
          "NAME_REQUIRED",
        );
      }
      if (entity === "scenarios") {
        data = {
          ...current,
          ...pick(p, [
            "name",
            "person",
            "purpose",
            "origin",
            "destination",
            "returnDestination",
            "frequency",
            "frequencyUnit",
            "archived",
          ]),
        };
        ensure(data.name?.trim() && data.person?.trim(), "NAME_REQUIRED");
        ensure(
          ["week", "month"].includes(data.frequencyUnit),
          "INVALID_FREQUENCY",
        );
        ensure(
          data.frequency == null ||
            (typeof data.frequency === "number" && data.frequency >= 0),
          "INVALID_AMOUNT",
        );
      }
      if (entity === "records") {
        id(command.apartmentId || current?.apartmentId);
        if (command.criterionId) id(command.criterionId);
        if (command.scenarioId) id(command.scenarioId);
        const apartment = (
          await db.query(
            "SELECT data FROM apartments WHERE collection_id=$1 AND id=$2",
            [collectionId, command.apartmentId || current?.apartmentId],
          )
        ).rows[0];
        ensure(
          apartment && !apartment.data.archived,
          "APARTMENT_UNAVAILABLE",
          409,
        );
        data = cleanRecord(p, current);
        if (data.costId) {
          const linked = (
            await db.query(
              "SELECT id FROM records WHERE collection_id=$1 AND apartment_id=$2 AND id::text=$3 AND kind='cost'",
              [
                collectionId,
                command.apartmentId || current?.apartmentId,
                data.costId,
              ],
            )
          ).rowCount;
          ensure(
            linked ||
              [
                "H01",
                "H02",
                "H03",
                "H04",
                "H10",
                "F05",
                "F06",
                "G06",
                "G06.station",
              ].includes(data.costId),
            "INVALID_REFERENCE",
          );
        }
        if (data.amountSource)
          ensure(
            [
              "H01",
              "H02",
              "H03",
              "H04",
              "H10",
              "F05",
              "F06",
              "G06",
              "J07",
            ].includes(data.amountSource),
            "INVALID_REFERENCE",
          );
        if (
          data.amountSource &&
          ["cost", "benefit"].includes(data.kind) &&
          !data.archived
        ) {
          const other = (
            await db.query(
              "SELECT id FROM records WHERE collection_id=$1 AND apartment_id=$2 AND kind=$3 AND id<>$4 AND data->>'amountSource'=$5 AND coalesce((data->>'archived')::boolean,false)=false",
              [
                collectionId,
                command.apartmentId || current?.apartmentId,
                data.kind,
                command.targetId,
                data.amountSource,
              ],
            )
          ).rowCount;
          ensure(!other, "CANONICAL_RECORD_EXISTS", 409);
        }
        if (command.scenarioId || current?.scenarioId) {
          const scenario = (
            await db.query(
              "SELECT data FROM scenarios WHERE collection_id=$1 AND id=$2",
              [collectionId, command.scenarioId || current?.scenarioId],
            )
          ).rows[0];
          ensure(
            scenario && !scenario.data.archived,
            "SCENARIO_UNAVAILABLE",
            409,
          );
        }
        if (data.kind === "journey")
          ensure(
            command.scenarioId || current?.scenarioId,
            "SCENARIO_REQUIRED",
          );
      }
      for (const key of [
        "id",
        "revision",
        "collectionId",
        "updatedAt",
        "updatedBy",
      ])
        delete data[key];
      const extra =
        entity === "criteria"
          ? { section_id: data.sectionId }
          : entity === "records"
            ? {
                kind: data.kind,
                apartment_id: command.apartmentId || current.apartmentId,
                criterion_id:
                  command.criterionId || current?.criterionId || null,
                scenario_id: command.scenarioId || current?.scenarioId || null,
              }
            : {};
      const fields = ["id", "collection_id", "data", ...Object.keys(extra)];
      const values = [
        command.targetId,
        collectionId,
        data,
        ...Object.values(extra),
      ];
      record = dataRow(
        (
          await db.query(
            `INSERT INTO ${entity}(${fields.join(",")}) VALUES(${values.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=${entity}.revision+1${entity === "criteria" ? ",section_id=excluded.section_id" : ""} WHERE ${entity}.collection_id=excluded.collection_id RETURNING *`,
            values,
          )
        ).rows[0],
      );
      if (["criteria", "sections", "scenarios"].includes(entity))
        await db.query(
          "UPDATE collections SET checklist_revision=checklist_revision+1 WHERE id=$1",
          [collectionId],
        );
    }
    ensure(
      record || command.type === "member.delete",
      "IDENTITY_CONFLICT",
      409,
    );
    const updated = collectionRow(
      (
        await db.query(
          "UPDATE collections SET sequence=sequence+1 WHERE id=$1 RETURNING *",
          [collectionId],
        )
      ).rows[0],
    );
    const recordId = record?.id || command.targetId;
    await db.query(
      "INSERT INTO history(collection_id,entity,record_id,before_value,after_value,actor_id) VALUES($1,$2,$3,$4,$5,$6)",
      [collectionId, entity, recordId, current, record, user.id],
    );
    await db.query(
      "INSERT INTO events(collection_id,sequence,entity,record_id,payload) VALUES($1,$2,$3,$4,$5)",
      [collectionId, updated.sequence, entity, recordId, record],
    );
    const result = { entity, id: recordId, record, collection: updated };
    await db.query(
      "INSERT INTO mutation_receipts(collection_id,actor_id,mutation_id,request_hash,result) VALUES($1,$2,$3,$4,$5)",
      [collectionId, user.id, command.id, hash, result],
    );
    return result;
  });
}
export async function acceptInvitation(user, token) {
  return transaction(async (db) => {
    const hash = createHash("sha256").update(token).digest("hex");
    const first = (
      await db.query(
        "SELECT collection_id FROM invitations WHERE token_hash=$1",
        [hash],
      )
    ).rows[0];
    ensure(first, "INVITATION_INVALID", 404);
    const collection = (
      await db.query("SELECT * FROM collections WHERE id=$1 FOR UPDATE", [
        first.collection_id,
      ])
    ).rows[0];
    ensure(collection && !collection.deleted_at, "INVITATION_INVALID", 404);
    const inv = (
      await db.query(
        "SELECT * FROM invitations WHERE token_hash=$1 FOR UPDATE",
        [hash],
      )
    ).rows[0];
    ensure(inv && !inv.revoked_at, "INVITATION_INVALID", 404);
    ensure(
      inv.email === user.email.toLowerCase(),
      "INVITATION_EMAIL_MISMATCH",
      403,
    );
    if (inv.accepted_by === user.id) {
      const member = (
        await db.query(
          "SELECT 1 FROM memberships WHERE collection_id=$1 AND user_id=$2",
          [collection.id, user.id],
        )
      ).rowCount;
      ensure(
        member || collection.owner_id === user.id,
        "INVITATION_INVALID",
        410,
      );
      return collectionRow(collection);
    }
    ensure(
      !inv.accepted_by && new Date(inv.expires_at) > new Date(),
      "INVITATION_EXPIRED",
      410,
    );
    if (collection.owner_id !== user.id)
      await db.query(
        "INSERT INTO memberships(collection_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(collection_id,user_id) DO NOTHING",
        [collection.id, user.id, inv.role],
      );
    await db.query(
      "UPDATE invitations SET accepted_by=$2,revision=revision+1 WHERE id=$1",
      [inv.id, user.id],
    );
    const seq = (
      await db.query(
        "UPDATE collections SET sequence=sequence+1 WHERE id=$1 RETURNING sequence",
        [collection.id],
      )
    ).rows[0].sequence;
    await db.query(
      "INSERT INTO events(collection_id,sequence,entity,record_id,payload) VALUES($1,$2,'members',$3,$4)",
      [collection.id, seq, user.id, { ...user, role: inv.role, revision: 1 }],
    );
    return collectionRow(collection);
  });
}
export async function applyPreset(collectionId, user) {
  const s = await snapshot(collectionId, user);
  await mutate(collectionId, user, {
    id: randomUUID(),
    targetId: collectionId,
    type: "collection.put",
    expectedRevision: s.collection.revision,
    payload: { settings: personalPreset },
  });
  for (const scenario of presetScenarios)
    if (!s.scenarios.some((x) => x.purpose === scenario.purpose))
      await mutate(collectionId, user, {
        id: randomUUID(),
        targetId: randomUUID(),
        type: "scenario.put",
        expectedRevision: 0,
        payload: scenario,
      });
  return snapshot(collectionId, user);
}
