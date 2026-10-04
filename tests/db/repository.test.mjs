import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pool, closeDb } from "../../lib/db.mjs";
import {
  upsertUser,
  createCollection,
  mutate,
  snapshot,
  history,
  listCollections,
  inviteToken,
  acceptInvitation,
  changes,
} from "../../lib/repository.mjs";
import { reserveUpload, downloadAttachment } from "../../lib/uploads.mjs";
import { sendInvitation } from "../../lib/mail.mjs";
let owner, editor, viewer, outsider, cid, other, apt, definition;
const cmd = (type, target, payload = {}, extra = {}) => ({
  id: randomUUID(),
  type,
  targetId: target?.id || randomUUID(),
  expectedRevision: target?.revision || 0,
  payload,
  ...extra,
});
const edit = (type, target, payload, extra = {}, user = owner) =>
  mutate(cid, user, cmd(type, target, payload, extra));
test("numeric housing fee migration preserves descriptions and evidence, converts explicit yen amounts and publishes idempotent changes", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const template = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key'='H05'",
        [cid],
      )
    ).rows[0];
    const untouched = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key' IN ('H01','H15','H19','H20') ORDER BY id",
        [cid],
      )
    ).rows;
    const cases = [
      [
        {
          state: "answered",
          value: "50000",
          notes: "Tax included",
          source: "agent",
          sourceUrl: "https://example.com/quote",
          suitability: "meets",
        },
        50000,
        "answered",
      ],
      [{ state: "answered", value: "0" }, 0, "answered"],
      [
        {
          state: "answered",
          value: "One month's rent + tax",
          notes: "Confirm with broker",
        },
        null,
        "not_checked",
      ],
      [
        { state: "answered", value: "50,000 JPY annually; 10,000 JPY renewal" },
        null,
        "not_checked",
      ],
      [{ state: "answered", value: "9007199254740992" }, null, "not_checked"],
      [
        { state: "not_applicable", value: null, notes: "Exempt" },
        null,
        "not_applicable",
      ],
    ];
    const ids = [];
    for (const [data] of cases) {
      const criterionId = randomUUID(),
        answerId = randomUUID();
      ids.push({ criterionId, answerId });
      await db.query(
        "INSERT INTO criteria(id,collection_id,section_id,data) VALUES($1,$2,$3,$4)",
        [
          criterionId,
          cid,
          template.section_id,
          { ...template.data, type: "text", unit: null },
        ],
      );
      await db.query(
        "INSERT INTO answers(id,collection_id,apartment_id,criterion_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
        [answerId, cid, apt.id, criterionId, data, owner.id],
      );
    }
    const before = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    const sql = await readFile(
      new URL(
        "../../migrations/1791004588464_numeric-housing-fees.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.query(sql);
    for (const [i, [original, value, state]] of cases.entries()) {
      const { criterionId, answerId } = ids[i];
      const criterion = (
        await db.query("SELECT * FROM criteria WHERE id=$1", [criterionId])
      ).rows[0];
      const answer = (
        await db.query("SELECT * FROM answers WHERE id=$1", [answerId])
      ).rows[0];
      assert.equal(criterion.data.type, "number");
      assert.equal(criterion.data.unit, "JPY");
      assert.deepEqual(criterion.data.labels, template.data.labels);
      assert.equal(answer.data.value, value);
      assert.equal(answer.data.state, state);
      assert.deepEqual(answer.data.legacyFeeAnswer, original);
      if (original.value) assert.ok(answer.data.notes.includes(original.value));
      if (original.notes) assert.ok(answer.data.notes.includes(original.notes));
      for (const key of ["source", "sourceUrl", "suitability"])
        if (original[key]) assert.equal(answer.data[key], original[key]);
      const events = (
        await db.query(
          "SELECT * FROM events WHERE record_id IN ($1,$2) AND sequence>$3 ORDER BY sequence",
          [criterionId, answerId, before.sequence],
        )
      ).rows;
      assert.equal(events.length, 2);
      assert.equal(events[0].entity, "answers");
      assert.equal(events[0].payload.value, value);
      assert.equal(events[0].payload.criterionId, criterionId);
      assert.equal(events[1].entity, "criteria");
      assert.equal(events[1].payload.unit, "JPY");
      assert.equal(events[1].payload.type, "number");
    }
    assert.deepEqual(
      (
        await db.query(
          "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key' IN ('H01','H15','H19','H20') ORDER BY id",
          [cid],
        )
      ).rows,
      untouched,
    );
    const after = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    assert.equal(
      after.checklist_revision,
      before.checklist_revision + cases.length,
    );
    assert.equal(
      Number(after.sequence),
      Number(before.sequence) + cases.length * 2,
    );
    await db.query(sql);
    assert.deepEqual(
      (await db.query("SELECT * FROM collections WHERE id=$1", [cid])).rows[0],
      after,
    );
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});
test("retiring the duplicate agency fee check preserves answers and adjacent checks, publishes changes and is idempotent", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const neighbor = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key'='H05'",
        [cid],
      )
    ).rows[0];
    const criterionId = randomUUID();
    const answerId = randomUUID();
    await db.query(
      "INSERT INTO criteria(id,collection_id,section_id,data) VALUES($1,$2,$3,$4)",
      [
        criterionId,
        cid,
        neighbor.section_id,
        {
          ...neighbor.data,
          key: "H06",
          sourceKey: "H06",
        },
      ],
    );
    const original = {
      state: "answered",
      value: "Same charge",
      notes: "Agent confirmed",
      suitability: "meets",
    };
    await db.query(
      "INSERT INTO answers(id,collection_id,apartment_id,criterion_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
      [answerId, cid, apt.id, criterionId, original, owner.id],
    );
    const before = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    const sql = await readFile(
      new URL(
        "../../migrations/1791004068954_remove-duplicate-agency-fee-check.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.query(sql);
    const retired = (
      await db.query("SELECT * FROM criteria WHERE id=$1", [criterionId])
    ).rows[0];
    assert.equal(retired.data.archived, true);
    assert.equal(retired.revision, 2);
    const answer = (
      await db.query("SELECT * FROM answers WHERE id=$1", [answerId])
    ).rows[0];
    assert.deepEqual(answer.data, original);
    assert.equal(answer.revision, 1);
    assert.deepEqual(
      (await db.query("SELECT * FROM criteria WHERE id=$1", [neighbor.id]))
        .rows[0],
      neighbor,
    );
    const after = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    assert.equal(after.checklist_revision, before.checklist_revision + 1);
    assert.equal(Number(after.sequence), Number(before.sequence) + 1);
    const events = (
      await db.query(
        "SELECT * FROM events WHERE collection_id=$1 AND sequence>$2",
        [cid, before.sequence],
      )
    ).rows;
    assert.equal(events.length, 1);
    assert.equal(events[0].entity, "criteria");
    assert.equal(events[0].record_id, criterionId);
    assert.equal(events[0].payload.archived, true);
    assert.equal(events[0].payload.revision, retired.revision);
    await db.query(sql);
    assert.deepEqual(
      (await db.query("SELECT * FROM collections WHERE id=$1", [cid])).rows[0],
      after,
    );
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});
test("bicycle checklist migration preserves answers and custom labels, restores missing entries and publishes idempotent changes", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const criteria = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key' IN ('G05','G06') ORDER BY data->>'key'",
        [cid],
      )
    ).rows;
    for (const criterion of criteria) {
      const legacy = { ...criterion.data };
      legacy.stages = ["A", "S"];
      legacy.labels =
        criterion.data.key === "G05"
          ? {
              en: "Suitable bicycle parking",
              ja: "使える駐輪場",
              vi: "Chỗ đỗ riêng đã chỉnh",
            }
          : { ...legacy.labels, en: "Bicycle-parking cost" };
      await db.query("UPDATE criteria SET data=$2 WHERE id=$1", [
        criterion.id,
        legacy,
      ]);
    }
    const original = {
      state: "answered",
      value: 1200,
      support: { station: 500 },
      notes: "Keep the parking contract",
      suitability: "meets",
    };
    const answerId = randomUUID();
    await db.query(
      "INSERT INTO answers(id,collection_id,apartment_id,criterion_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
      [answerId, cid, apt.id, criteria[1].id, original, owner.id],
    );
    const before = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    const sql = await readFile(
      new URL(
        "../../migrations/1791002687108_bicycle-parking-checklist.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.query(sql);
    const after = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    assert.equal(after.checklist_revision, before.checklist_revision + 2);
    const saved = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key' IN ('G05','G06') ORDER BY data->>'key'",
        [cid],
      )
    ).rows;
    assert.equal(saved[0].data.labels.vi, "Chỗ đỗ riêng đã chỉnh");
    assert.equal(saved[0].data.labels.en, "Bicycle parking available");
    assert.equal(saved[0].data.type, "boolean");
    assert.equal(saved[1].data.type, "number");
    assert.equal(saved[1].data.unit, "JPY/month");
    for (const criterion of saved)
      assert.ok(criterion.data.stages.includes("V"));
    assert.deepEqual(
      saved[1].data.supportFields,
      criteria[1].data.supportFields,
    );
    const answer = (
      await db.query("SELECT * FROM answers WHERE id=$1", [answerId])
    ).rows[0];
    assert.deepEqual(answer.data, original);
    assert.equal(answer.revision, 1);
    const events = (
      await db.query(
        "SELECT * FROM events WHERE collection_id=$1 AND sequence>$2 ORDER BY sequence",
        [cid, before.sequence],
      )
    ).rows;
    assert.equal(events.length, 2);
    for (const event of events) {
      assert.equal(event.entity, "criteria");
      assert.equal(event.payload.id, event.record_id);
      assert.ok(event.payload.stages.includes("V"));
    }
    await db.query(sql);
    assert.deepEqual(
      (await db.query("SELECT * FROM collections WHERE id=$1", [cid])).rows[0],
      after,
    );
    await db.query("DELETE FROM criteria WHERE id=$1", [criteria[0].id]);
    await db.query(sql);
    const restored = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key'='G05'",
        [cid],
      )
    ).rows;
    assert.equal(restored.length, 1);
    assert.equal(restored[0].section_id, criteria[0].section_id);
    assert.equal(restored[0].data.type, "boolean");
    assert.equal(restored[0].data.labels.vi, "Chỗ đỗ xe đạp");
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});

test("kitchen migration preserves answers and custom fields, publishes changes and is safe to rerun", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const kitchen = (
      await db.query(
        "SELECT * FROM sections WHERE collection_id=$1 AND data->>'key'='E'",
        [cid],
      )
    ).rows[0];
    const appliances = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key' IN ('E04','E07')",
        [cid],
      )
    ).rows;
    const gas = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key'='E10'",
        [cid],
      )
    ).rows[0];
    await db.query("DELETE FROM criteria WHERE id=$1", [gas.id]);
    for (const criterion of appliances) {
      const supportFields = criterion.data.supportFields.filter(
        (f) => f.id !== "available",
      );
      supportFields.push({
        id: "customNote",
        type: "text",
        labels: { en: "Custom note" },
      });
      await db.query(
        "UPDATE criteria SET data=jsonb_set(data,'{supportFields}',$2) WHERE id=$1",
        [criterion.id, JSON.stringify(supportFields)],
      );
    }
    const answerId = randomUUID();
    const original = {
      state: "answered",
      value: "Old appliance notes",
      notes: "Preserve me",
      support: { width: 0.65, customNote: "Keep custom field" },
      suitability: "meets",
    };
    await db.query(
      "INSERT INTO answers(id,collection_id,apartment_id,criterion_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
      [answerId, cid, apt.id, appliances[0].id, original, owner.id],
    );
    const before = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    const sql = await readFile(
      new URL(
        "../../migrations/1791000000000_appliance-availability-and-gas-type.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.query(sql);
    const after = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    assert.equal(after.checklist_revision, before.checklist_revision + 3);
    for (const criterion of appliances) {
      const saved = (
        await db.query("SELECT * FROM criteria WHERE id=$1", [criterion.id])
      ).rows[0];
      assert.equal(saved.revision, criterion.revision + 1);
      assert.equal(
        saved.data.supportFields.find((f) => f.id === "available").type,
        "boolean",
      );
      assert.ok(saved.data.supportFields.some((f) => f.id === "customNote"));
    }
    const migratedGas = (
      await db.query(
        "SELECT * FROM criteria WHERE collection_id=$1 AND data->>'key'='E10'",
        [cid],
      )
    ).rows;
    assert.equal(migratedGas.length, 1);
    assert.equal(migratedGas[0].section_id, kitchen.id);
    assert.deepEqual(migratedGas[0].data.choices, gas.data.choices);
    const answer = (
      await db.query("SELECT * FROM answers WHERE id=$1", [answerId])
    ).rows[0];
    assert.deepEqual(answer.data, original);
    assert.equal(answer.revision, 1);
    const events = (
      await db.query(
        "SELECT * FROM events WHERE collection_id=$1 AND sequence>$2 ORDER BY sequence",
        [cid, before.sequence],
      )
    ).rows;
    assert.equal(events.length, 3);
    assert.ok(
      events.every(
        (event) =>
          event.entity === "criteria" && event.payload.id === event.record_id,
      ),
    );
    await db.query(sql);
    assert.deepEqual(
      (await db.query("SELECT * FROM collections WHERE id=$1", [cid])).rows[0],
      after,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM criteria WHERE collection_id=$1 AND data->>'key'='E10'",
          [cid],
        )
      ).rows[0].count,
      "1",
    );
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});
before(async () => {
  [owner, editor, viewer, outsider] = await Promise.all(
    ["owner", "editor", "viewer", "outsider"].map((role) =>
      upsertUser({
        sub: `test:${randomUUID()}`,
        email: `${role}-${randomUUID()}@example.test`,
        name: role,
      }),
    ),
  );
  cid = (await createCollection(owner, "Integration search")).id;
  other = await createCollection(outsider, "Other search");
  await pool().query(
    "INSERT INTO memberships(collection_id,user_id,role) VALUES($1,$2,'editor'),($1,$3,'viewer')",
    [cid, editor.id, viewer.id],
  );
  apt = (await edit("apartment.put", null, { name: "Test apartment" })).record;
  definition = (await snapshot(cid, owner)).criteria.find(
    (c) => c.key === "A02",
  );
});
after(async () => {
  if (cid)
    await pool().query("DELETE FROM collections WHERE id=ANY($1::uuid[])", [
      [cid, other.id],
    ]);
  await pool().query("DELETE FROM users WHERE id=ANY($1::uuid[])", [
    [owner.id, editor.id, viewer.id, outsider.id],
  ]);
  await closeDb();
});
test("an account can create multiple collections concurrently with independent checklists and access", async () => {
  const u = await upsertUser({
    sub: `test:${randomUUID()}`,
    email: "race@example.test",
    name: "Race",
  });
  try {
    const results = await Promise.allSettled([
      createCollection(u, "One"),
      createCollection(u, "Two"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    const third = await createCollection(u, "Three");
    const collections = await listCollections(u);
    assert.equal(collections.length, 3);
    assert.ok(collections.every((c) => c.role === "owner"));
    assert.deepEqual(collections.map((c) => c.name).sort(), [
      "One",
      "Three",
      "Two",
    ]);
    assert.deepEqual(await createCollection(u, "Three", third.id), third);
    const snapshots = await Promise.all(
      collections.map((c) => snapshot(c.id, u)),
    );
    const first = snapshots[0];
    assert.ok(first.criteria.length > 0);
    for (const s of snapshots.slice(1)) {
      assert.equal(s.criteria.length, first.criteria.length);
      assert.ok(s.criteria.every((c) => c.collectionId === s.collection.id));
      assert.ok(
        !s.criteria.some((c) => first.criteria.some((a) => a.id === c.id)),
      );
    }
    await assert.rejects(snapshot(third.id, editor), { code: "NOT_FOUND" });
    assert.equal((await listCollections(editor)).length, 1);
  } finally {
    await pool().query("DELETE FROM collections WHERE owner_id=$1", [u.id]);
    await pool().query("DELETE FROM users WHERE id=$1", [u.id]);
  }
});
test("only the owner can archive and restore collections with revision checks while keeping their data", async () => {
  const collection = await createCollection(owner, "Archive fixture");
  const archive = (record, archived, user = owner, mutationId = randomUUID()) =>
    mutate(collection.id, user, {
      ...cmd("collection.archive", record, { archived }),
      id: mutationId,
    });
  try {
    await pool().query(
      "INSERT INTO memberships(collection_id,user_id,role) VALUES($1,$2,'editor'),($1,$3,'viewer')",
      [collection.id, editor.id, viewer.id],
    );
    const property = (
      await mutate(
        collection.id,
        owner,
        cmd("apartment.put", null, { name: "Keep this apartment" }),
      )
    ).record;
    const before = await snapshot(collection.id, owner);
    for (const user of [editor, viewer])
      await assert.rejects(archive(collection, true, user), {
        code: "FORBIDDEN",
      });
    await assert.rejects(archive(collection, true, outsider), {
      code: "NOT_FOUND",
    });
    for (const value of ["true", null, 1])
      await assert.rejects(archive(collection, value), {
        code: "INVALID_ARCHIVED",
      });
    const mutationId = randomUUID();
    const archived = await archive(collection, true, owner, mutationId);
    assert.equal(archived.record.archived, true);
    assert.equal(archived.record.revision, collection.revision + 1);
    assert.deepEqual(
      await archive(collection, true, owner, mutationId),
      archived,
    );
    for (const user of [owner, editor, viewer])
      assert.equal(
        (await listCollections(user)).find((c) => c.id === collection.id)
          .archived,
        true,
      );
    await assert.rejects(archive(collection, false), { code: "CONFLICT" });
    const saved = await snapshot(collection.id, owner);
    assert.deepEqual(saved.criteria, before.criteria);
    assert.deepEqual(saved.answers, before.answers);
    assert.deepEqual(saved.apartments, before.apartments);
    assert.equal(
      saved.apartments.find((a) => a.id === property.id).name,
      "Keep this apartment",
    );
    assert.equal(saved.collection.deletedAt, null);
    const restored = await archive(archived.record, false);
    assert.equal(restored.record.archived, false);
    assert.equal(
      (await listCollections(owner)).find((c) => c.id === collection.id)
        .archived,
      false,
    );
    const updated = await changes(
      collection.id,
      viewer,
      before.collection.sequence,
    );
    assert.equal(updated.collection.archived, false);
    assert.equal(
      updated.changes.filter((c) => c.entity === "collection").length,
      2,
    );
  } finally {
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
  }
});
test("viewer writes, editor member control, cross-collection answers and file access are denied", async () => {
  await assert.rejects(
    edit("apartment.put", apt, { name: "Denied" }, {}, viewer),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(
    edit("member.delete", { id: viewer.id, revision: 1 }, {}, {}, editor),
    { code: "FORBIDDEN" },
  );
  const foreign = (await snapshot(other.id, outsider)).criteria[0];
  await assert.rejects(
    edit(
      "answer.put",
      null,
      { state: "answered", value: 20 },
      { apartmentId: apt.id, criterionId: foreign.id, checklistRevision: 1 },
    ),
    { code: "CRITERION_UNAVAILABLE" },
  );
  const before = (await snapshot(cid, owner)).apartments[0];
  await assert.rejects(
    mutate(
      other.id,
      outsider,
      cmd(
        "apartment.put",
        { id: apt.id, revision: 0 },
        { name: "Cross identity overwrite" },
      ),
    ),
    { code: "IDENTITY_CONFLICT" },
  );
  assert.equal((await snapshot(cid, owner)).apartments[0].name, before.name);
  await assert.rejects(
    reserveUpload(cid, viewer, {
      id: randomUUID(),
      apartmentId: apt.id,
      mime: "image/png",
      size: 10,
      name: "x.png",
    }),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(downloadAttachment(cid, outsider, randomUUID()), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    reserveUpload(cid, owner, {
      id: randomUUID(),
      apartmentId: apt.id,
      criterionId: foreign.id,
      mime: "image/png",
      size: 10,
      name: "x.png",
    }),
    { code: "23503" },
  );
});
test("property ordering is collection-scoped, versioned and independent of settings and entry timestamps", async () => {
  const collection = await createCollection(owner, "Ordering integration");
  const reorder = (order, version = 0) => ({
    id: randomUUID(),
    type: "apartments.reorder",
    targetId: collection.id,
    expectedRevision: version,
    payload: { apartmentOrder: order },
  });
  try {
    await pool().query(
      "INSERT INTO memberships(collection_id,user_id,role) VALUES($1,$2,'editor'),($1,$3,'viewer')",
      [collection.id, editor.id, viewer.id],
    );
    const properties = [];
    for (const name of ["Zulu", "Alpha"])
      properties.push(
        (
          await mutate(
            collection.id,
            owner,
            cmd("apartment.put", null, { name }),
          )
        ).record,
      );
    assert.ok(
      properties.every((a) => Number.isFinite(Date.parse(a.createdAt))),
    );
    assert.ok(
      Date.parse(properties[0].createdAt) < Date.parse(properties[1].createdAt),
    );
    const renamed = await mutate(
      collection.id,
      owner,
      cmd("apartment.put", properties[0], {
        name: "Renamed",
        createdAt: "2099-01-01",
      }),
    );
    assert.equal(
      new Date(renamed.record.createdAt).toISOString(),
      new Date(properties[0].createdAt).toISOString(),
    );
    await assert.rejects(
      mutate(collection.id, viewer, reorder(properties.map((a) => a.id))),
      { code: "FORBIDDEN" },
    );
    for (const invalid of [
      [properties[0].id, properties[0].id],
      [apt.id],
      [randomUUID()],
    ])
      await assert.rejects(mutate(collection.id, editor, reorder(invalid)), {
        code: "INVALID_ORDER",
      });
    const command = reorder(properties.map((a) => a.id).reverse());
    const result = await mutate(collection.id, editor, command);
    assert.deepEqual(await mutate(collection.id, editor, command), result);
    const saved = await snapshot(collection.id, viewer);
    assert.deepEqual(
      saved.collection.apartmentOrder,
      command.payload.apartmentOrder,
    );
    assert.equal(saved.collection.apartmentOrderRevision, 1);
    assert.equal(saved.collection.revision, collection.revision);
    assert.equal(
      saved.collection.checklistRevision,
      collection.checklistRevision,
    );
    await assert.rejects(
      mutate(collection.id, owner, reorder(properties.map((a) => a.id))),
      { code: "CONFLICT" },
    );
    const event = (
      await changes(collection.id, viewer, result.collection.sequence - 1)
    ).changes[0];
    assert.deepEqual(
      event.record.apartmentOrder,
      command.payload.apartmentOrder,
    );
    assert.deepEqual(
      (await snapshot(cid, owner)).collection.apartmentOrder,
      [],
    );
    // A property added after reordering stays outside the saved list and appends by entry time.
    const added = await mutate(
      collection.id,
      owner,
      cmd("apartment.put", null, { name: "New property" }),
    );
    const reset = await mutate(collection.id, owner, reorder([], 1));
    assert.deepEqual(reset.collection.apartmentOrder, []);
    assert.ok(
      Date.parse(added.record.createdAt) > Date.parse(properties[1].createdAt),
    );
  } finally {
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
  }
});
test("property order migrations recover entry times and publish them to cached devices without changing property data", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    for (const table of ["collections", "apartments", "history", "events"])
      await db.query(
        `CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`,
      );
    await db.query("ALTER TABLE apartments DROP COLUMN created_at");
    await db.query(
      "ALTER TABLE collections DROP COLUMN apartment_order, DROP COLUMN apartment_order_revision",
    );
    const collection = randomUUID(),
      first = randomUUID(),
      seeded = randomUUID();
    await db.query(
      "INSERT INTO collections(id,owner_id,name,created_at,sequence) VALUES($1,$2,'Legacy order','2026-01-01T00:00:00Z',9)",
      [collection, owner.id],
    );
    await db.query(
      "INSERT INTO apartments(id,collection_id,data,revision) VALUES($1,$3,$4,3),($2,$3,$5,1)",
      [
        first,
        seeded,
        collection,
        { name: "Zulu", notes: "Keep evidence" },
        { name: "Seeded" },
      ],
    );
    await db.query(
      "INSERT INTO history(collection_id,entity,record_id,actor_id,created_at) VALUES($1,'apartments',$2,$3,'2026-02-01T00:00:00Z'),($1,'apartments',$2,$3,'2026-03-01T00:00:00Z')",
      [collection, first, owner.id],
    );
    for (const name of [
      "1790956800000_property_order.sql",
      "1790956800001_publish_property_entry_times.sql",
    ])
      await db.query(
        await readFile(
          new URL(`../../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    const rows = (
      await db.query("SELECT * FROM apartments ORDER BY created_at")
    ).rows;
    assert.equal(rows[0].id, seeded);
    assert.equal(rows[0].created_at.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(rows[1].created_at.toISOString(), "2026-02-01T00:00:00.000Z");
    assert.equal(rows[1].revision, 3);
    assert.deepEqual(rows[1].data, { name: "Zulu", notes: "Keep evidence" });
    const events = (await db.query("SELECT * FROM events ORDER BY sequence"))
      .rows;
    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((e) => Number(e.sequence)),
      [10, 11],
    );
    assert.equal(events[1].payload.id, first);
    assert.equal(
      new Date(events[1].payload.createdAt).toISOString(),
      "2026-02-01T00:00:00.000Z",
    );
    assert.equal(events[1].payload.notes, "Keep evidence");
    const c = (await db.query("SELECT * FROM collections")).rows[0];
    assert.equal(Number(c.sequence), 11);
    assert.equal(c.revision, 1);
    assert.deepEqual(c.apartment_order, []);
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});
test("property decisions, viewing and archiving persist independently with validated values", async () => {
  let property = (
    await edit("apartment.put", null, { name: "Decision workflow" })
  ).record;
  assert.equal(property.status, "considering");
  assert.equal(property.viewed, false);
  for (const status of ["shortlisted", "disqualified", "considering"]) {
    property = (await edit("apartment.put", property, { status }, {}, editor))
      .record;
    assert.equal(property.status, status);
    assert.equal(property.viewed, false);
  }
  for (const status of [
    "viewed",
    "contacted",
    "viewing_scheduled",
    "applied",
    "selected",
    "rejected",
    "unavailable",
  ]) {
    await assert.rejects(edit("apartment.put", property, { status }), {
      code: "INVALID_STATUS",
    });
  }
  for (const viewed of ["false", 1, null]) {
    await assert.rejects(edit("apartment.put", property, { viewed }), {
      code: "INVALID_VIEWED",
    });
  }
  for (const archived of ["false", 1, null]) {
    await assert.rejects(edit("apartment.put", property, { archived }), {
      code: "INVALID_ARCHIVED",
    });
  }
  property = (
    await edit("apartment.put", property, {
      status: "shortlisted",
      viewingAt: "2026-10-04T14:00:00+09:00",
    })
  ).record;
  property = (await edit("apartment.put", property, { viewed: true })).record;
  for (const patch of [
    { status: "disqualified" },
    { viewed: false },
    { archived: true },
  ]) {
    await assert.rejects(edit("apartment.put", property, patch, {}, viewer), {
      code: "FORBIDDEN",
    });
  }
  property = (await edit("apartment.put", property, { archived: true })).record;
  property = (await edit("apartment.put", property, { archived: false }))
    .record;
  const saved = (await snapshot(cid, owner)).apartments.find(
    (a) => a.id === property.id,
  );
  assert.equal(saved.status, "shortlisted");
  assert.equal(saved.viewed, true);
  assert.equal(saved.archived, false);
  assert.equal(saved.viewingAt, "2026-10-04T14:00:00+09:00");
});
test("status migration preserves viewing, original decisions and metadata, publishes changes and is idempotent", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const cases = [
      ["considering", "considering", false],
      ["contacted", "considering", false],
      ["viewing_scheduled", "considering", false],
      ["viewed", "considering", true],
      ["shortlisted", "shortlisted", false],
      ["applied", "shortlisted", false],
      ["selected", "shortlisted", false],
      ["rejected", "disqualified", false],
      ["unavailable", "disqualified", false],
      ["disqualified", "disqualified", false],
    ];
    const ids = [];
    for (const [status] of cases) {
      const id = randomUUID();
      ids.push(id);
      await db.query(
        "INSERT INTO apartments(id,collection_id,data) VALUES($1,$2,$3)",
        [
          id,
          cid,
          {
            name: status,
            status,
            archived: true,
            address: "Keep address",
            viewingAt: "2026-10-04T14:00:00+09:00",
          },
        ],
      );
    }
    const sequence = Number(
      (await db.query("SELECT sequence FROM collections WHERE id=$1", [cid]))
        .rows[0].sequence,
    );
    const sql = await readFile(
      new URL(
        "../../migrations/1790940000000_property_decisions_and_viewing.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.query(sql);
    for (const [i, [old, status, viewed]] of cases.entries()) {
      const row = (
        await db.query("SELECT * FROM apartments WHERE id=$1", [ids[i]])
      ).rows[0];
      assert.equal(row.data.status, status);
      assert.equal(row.data.viewed, viewed);
      assert.equal(row.data.archived, true);
      assert.equal(row.data.address, "Keep address");
      assert.equal(row.data.viewingAt, "2026-10-04T14:00:00+09:00");
      assert.equal(row.revision, 2);
      if (old !== status) assert.equal(row.data.legacyStatus, old);
      const event = (
        await db.query(
          "SELECT * FROM events WHERE record_id=$1 AND sequence>$2",
          [ids[i], sequence],
        )
      ).rows[0];
      assert.equal(event.entity, "apartments");
      assert.equal(event.payload.id, ids[i]);
      assert.equal(event.payload.revision, 2);
      assert.equal(event.payload.viewed, viewed);
    }
    const after = Number(
      (await db.query("SELECT sequence FROM collections WHERE id=$1", [cid]))
        .rows[0].sequence,
    );
    assert.equal(after, sequence + cases.length);
    await db.query(sql);
    assert.equal(
      Number(
        (await db.query("SELECT sequence FROM collections WHERE id=$1", [cid]))
          .rows[0].sequence,
      ),
      after,
    );
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});
test("checklist simplification preserves legacy evidence, promotes only explicit years and publishes idempotent changes", async () => {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const section = (
      await db.query("SELECT section_id FROM criteria WHERE id=$1", [
        definition.id,
      ])
    ).rows[0].section_id;
    const availabilityId = randomUUID();
    await db.query(
      "INSERT INTO criteria(id,collection_id,section_id,data) VALUES($1,$2,$3,$4)",
      [
        availabilityId,
        cid,
        section,
        { key: "A01", type: "select", archived: false },
      ],
    );
    const availabilityAnswerId = randomUUID();
    await db.query(
      "INSERT INTO answers(id,collection_id,apartment_id,criterion_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
      [
        availabilityAnswerId,
        cid,
        apt.id,
        availabilityId,
        { state: "answered", value: "available" },
        owner.id,
      ],
    );
    const cases = [
      [
        {
          state: "answered",
          value: "Fourth floor",
          support: { builtYear: 2008, floor: "4", construction: "RC" },
          notes: "Keep source note",
          source: "document",
        },
        2008,
        "answered",
      ],
      [{ state: "answered", value: "1997", support: {} }, 1997, "answered"],
      [
        {
          state: "answered",
          value: "Renovated in 2020; year unknown",
          support: { floor: "2" },
        },
        null,
        "not_checked",
      ],
      [
        { state: "not_applicable", value: null, support: { builtYear: 2001 } },
        null,
        "not_applicable",
      ],
    ];
    const ids = [];
    for (const [data] of cases) {
      const criterionId = randomUUID(),
        answerId = randomUUID();
      ids.push({ criterionId, answerId });
      await db.query(
        "INSERT INTO criteria(id,collection_id,section_id,data) VALUES($1,$2,$3,$4)",
        [
          criterionId,
          cid,
          section,
          {
            key: "A05",
            type: "text",
            supportFields: [{ id: "builtYear", type: "number" }],
            labels: { en: "Old details" },
          },
        ],
      );
      await db.query(
        "INSERT INTO answers(id,collection_id,apartment_id,criterion_id,data,updated_by) VALUES($1,$2,$3,$4,$5,$6)",
        [answerId, cid, apt.id, criterionId, data, owner.id],
      );
    }
    const sql = await readFile(
      new URL(
        "../../migrations/1790943423409_simplify-building-year-and-remove-availability.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const before = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    await db.query(sql);
    assert.equal(
      (
        await db.query("SELECT data FROM criteria WHERE id=$1", [
          availabilityId,
        ])
      ).rows[0].data.archived,
      true,
    );
    assert.deepEqual(
      (
        await db.query("SELECT data FROM answers WHERE id=$1", [
          availabilityAnswerId,
        ])
      ).rows[0].data,
      { state: "answered", value: "available" },
    );
    for (const [i, [original, year, state]] of cases.entries()) {
      const { criterionId, answerId } = ids[i];
      const criterion = (
        await db.query("SELECT * FROM criteria WHERE id=$1", [criterionId])
      ).rows[0];
      const answer = (
        await db.query("SELECT * FROM answers WHERE id=$1", [answerId])
      ).rows[0];
      assert.equal(criterion.data.type, "number");
      assert.equal(criterion.data.labels.vi, "Năm xây dựng");
      assert.deepEqual(criterion.data.supportFields, []);
      assert.equal(answer.data.value, year);
      assert.equal(answer.data.state, state);
      assert.deepEqual(answer.data.support, {});
      assert.deepEqual(answer.data.legacyBuildingDetails, original);
      if (original.value) assert.ok(answer.data.notes.includes(original.value));
      if (original.notes) assert.ok(answer.data.notes.includes(original.notes));
      if (original.source) assert.equal(answer.data.source, original.source);
      const event = (
        await db.query(
          "SELECT * FROM events WHERE record_id=$1 AND sequence>$2",
          [answerId, before.sequence],
        )
      ).rows[0];
      assert.equal(event.entity, "answers");
      assert.equal(event.payload.value, year);
      assert.equal(event.payload.revision, answer.revision);
      assert.equal(event.payload.criterionId, criterionId);
    }
    const after = (
      await db.query("SELECT * FROM collections WHERE id=$1", [cid])
    ).rows[0];
    assert.equal(
      after.checklist_revision,
      before.checklist_revision + cases.length + 1,
    );
    await db.query(sql);
    assert.deepEqual(
      (await db.query("SELECT * FROM collections WHERE id=$1", [cid])).rows[0],
      after,
    );
    assert.equal(
      (await db.query("SELECT data FROM criteria WHERE id=$1", [definition.id]))
        .rows[0].data.type,
      "number",
    );
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
});
test("renaming preserves property data and collection settings, validates names and rejects stale or unauthorized edits", async () => {
  const initial = await snapshot(cid, owner);
  const property = (
    await edit("apartment.put", null, {
      name: "Original property",
      room: "302",
      address: "Test address",
      status: "shortlisted",
    })
  ).record;
  for (const [type, record, limit] of [
    ["collection.put", initial.collection, 120],
    ["apartment.put", property, 200],
  ]) {
    for (const name of ["   ", "x".repeat(limit + 1)])
      await assert.rejects(edit(type, record, { name }), {
        code: "NAME_REQUIRED",
      });
    await assert.rejects(edit(type, record, { name: "Denied" }, {}, viewer), {
      code: "FORBIDDEN",
    });
    const renamed = await edit(
      type,
      record,
      { name: "  New name 日本語  " },
      {},
      editor,
    );
    assert.equal(renamed.record.name, "New name 日本語");
    assert.equal(renamed.record.id, record.id);
    assert.equal(renamed.record.revision, record.revision + 1);
    await assert.rejects(edit(type, record, { name: "Stale rename" }), {
      code: "CONFLICT",
    });
  }
  const saved = await snapshot(cid, owner);
  const updated = saved.apartments.find((a) => a.id === property.id);
  assert.equal(updated.room, "302");
  assert.equal(updated.address, "Test address");
  assert.equal(updated.status, "shortlisted");
  assert.deepEqual(saved.collection.settings, initial.collection.settings);
  assert.equal((await listCollections(editor))[0].name, "New name 日本語");
});
test("same-answer edits expose conflict, independent answers save, retry is idempotent and restore creates history", async () => {
  const command = cmd(
    "answer.put",
    null,
    { state: "answered", value: 25 },
    { apartmentId: apt.id, criterionId: definition.id, checklistRevision: 1 },
  );
  const first = await mutate(cid, owner, command);
  assert.deepEqual(
    await mutate(cid, owner, command),
    JSON.parse(JSON.stringify(first)),
  );
  const concurrent = await Promise.allSettled([
    edit(
      "answer.put",
      first.record,
      { state: "answered", value: 26 },
      { apartmentId: apt.id, criterionId: definition.id, checklistRevision: 1 },
    ),
    edit(
      "answer.put",
      first.record,
      { state: "answered", value: 27 },
      { apartmentId: apt.id, criterionId: definition.id, checklistRevision: 1 },
      editor,
    ),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  const conflict = concurrent.find((r) => r.status === "rejected").reason;
  assert.equal(conflict.code, "CONFLICT");
  assert.equal(conflict.details.current.revision, 2);
  assert.equal((await history(cid, owner, first.id)).length, 2);
  const current = concurrent.find((r) => r.status === "fulfilled").value.record,
    old = (await history(cid, owner, current.id)).at(-1);
  const restored = await edit(
    "answer.restore",
    current,
    { historyId: old.id },
    { apartmentId: apt.id, criterionId: definition.id, checklistRevision: 1 },
  );
  assert.equal(restored.record.value, 25);
  assert.equal((await history(cid, owner, current.id)).length, 3);
  const definitions = (await snapshot(cid, owner)).criteria.filter((c) =>
    ["A07", "A08"].includes(c.key),
  );
  await Promise.all(
    definitions.map((c) =>
      edit(
        "answer.put",
        null,
        { state: "answered", value: false },
        { apartmentId: apt.id, criterionId: c.id, checklistRevision: 1 },
      ),
    ),
  );
  assert.equal(
    (await snapshot(cid, owner)).answers.filter((a) =>
      definitions.some((c) => c.id === a.criterionId),
    ).length,
    2,
  );
});
test("definition changes keep identity and answers, block incompatible types, archive and restore with revision checks", async () => {
  let s = await snapshot(cid, owner);
  await assert.rejects(
    edit(
      "criterion.put",
      definition,
      { type: "text" },
      { checklistRevision: s.collection.checklistRevision },
    ),
    { code: "TYPE_CHANGE_BLOCKED" },
  );
  const renamed = await edit(
    "criterion.put",
    definition,
    { labels: { en: "Usable floor area" }, order: 1 },
    { checklistRevision: s.collection.checklistRevision },
  );
  assert.equal(renamed.record.id, definition.id);
  assert.equal(renamed.record.labels.ja, undefined);
  const archived = await edit(
    "criterion.put",
    renamed.record,
    { archived: true },
    { checklistRevision: renamed.collection.checklistRevision },
  );
  assert.ok(
    (await snapshot(cid, owner)).answers.some(
      (a) => a.criterionId === definition.id,
    ),
  );
  const restored = await edit(
    "criterion.put",
    archived.record,
    { archived: false },
    { checklistRevision: archived.collection.checklistRevision },
  );
  assert.equal(restored.record.archived, false);
  const added = await edit(
    "criterion.put",
    null,
    {
      key: "custom.test",
      sectionId: definition.sectionId,
      labels: { en: "New check" },
      guidance: { en: "Ask" },
      type: "boolean",
      choices: [],
      unit: "",
      importance: "information",
      scope: "apartment",
      stages: ["V"],
      order: 9000,
    },
    { checklistRevision: restored.collection.checklistRevision },
  );
  s = await snapshot(cid, editor);
  assert.ok(s.criteria.some((c) => c.id === added.id));
  assert.ok(!s.answers.some((a) => a.criterionId === added.id));
});
test("invitations enforce recipient, expiry, revocation and idempotent acceptance; delivery never creates membership", async () => {
  const inviteCommand = cmd("invitation.create", null, {
    email: outsider.email,
    role: "editor",
  });
  const invitation = await mutate(cid, owner, inviteCommand);
  const ownerFeed = await changes(cid, owner, 0);
  assert.ok(
    ownerFeed.changes.some(
      (e) => e.entity === "invitations" && e.id === invitation.id,
    ),
  );
  const memberFeed = await changes(cid, viewer, 0);
  assert.equal(memberFeed.role, "viewer");
  assert.equal(memberFeed.collection.sequence, ownerFeed.collection.sequence);
  assert.ok(!memberFeed.changes.some((e) => e.entity === "invitations"));
  assert.ok(
    memberFeed.changes.some(
      (e) => e.entity === "apartments" && e.id === apt.id,
    ),
  );
  assert.deepEqual(
    (await changes(cid, viewer, memberFeed.collection.sequence)).changes,
    [],
  );
  await assert.rejects(changes(other.id, viewer, 0), { code: "NOT_FOUND" });
  const token = inviteToken(cid, inviteCommand.id);
  process.env.LOCAL_AUTH = "false";
  try {
    await assert.rejects(sendInvitation(cid, owner, invitation.id, token), {
      code: "GMAIL_CONNECT_REQUIRED",
    });
  } finally {
    process.env.LOCAL_AUTH = "true";
  }
  assert.equal(
    (await snapshot(cid, owner)).invitations.find((i) => i.id === invitation.id)
      .delivery,
    "failed",
  );
  await sendInvitation(cid, owner, invitation.id, token);
  assert.ok(
    !(await snapshot(cid, owner)).members.some((m) => m.id === outsider.id),
  );
  await assert.rejects(acceptInvitation(viewer, token), {
    code: "INVITATION_EMAIL_MISMATCH",
  });
  await acceptInvitation(outsider, token);
  await acceptInvitation(outsider, token);
  assert.equal(
    (await snapshot(cid, owner)).members.filter((m) => m.id === outsider.id)
      .length,
    1,
  );
  const exp = cmd("invitation.create", null, {
    email: viewer.email,
    role: "editor",
  });
  const result = await mutate(cid, owner, exp);
  await pool().query(
    "UPDATE invitations SET expires_at=now()-interval '1 day',delivery='failed' WHERE id=$1",
    [result.id],
  );
  await assert.rejects(acceptInvitation(viewer, inviteToken(cid, exp.id)), {
    code: "INVITATION_EXPIRED",
  });
  assert.equal(
    (await snapshot(cid, owner)).members.find((m) => m.id === viewer.id).role,
    "viewer",
  );
  const revoked = cmd("invitation.create", null, {
    email: editor.email,
    role: "viewer",
  });
  const r = await mutate(cid, owner, revoked);
  await edit("invitation.revoke", r.record, {});
  await assert.rejects(acceptInvitation(editor, inviteToken(cid, revoked.id)), {
    code: "INVITATION_INVALID",
  });
});
test("revocation is ordered with writes and rejects a queued mutation and future reads", async () => {
  const queued = cmd(
    "record.put",
    null,
    { kind: "question", text: "Queued offline", status: "open" },
    { apartmentId: apt.id },
  );
  await edit("member.delete", { id: editor.id, revision: 1 }, {});
  await assert.rejects(mutate(cid, editor, queued), { code: "NOT_FOUND" });
  await assert.rejects(changes(cid, editor, 0), { code: "NOT_FOUND" });
  await assert.rejects(snapshot(cid, editor), { code: "NOT_FOUND" });
});
