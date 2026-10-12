import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localMode } from "../../lib/config.mjs";
import { pool, closeDb } from "../../lib/db.mjs";
import {
  localUser,
  createCollection,
  snapshot,
  changes,
} from "../../lib/repository.mjs";
import { downloadAttachment } from "../../lib/uploads.mjs";

const execute = promisify(execFile);
test("property intake previews without writes, preserves unknown fees and zero deposit, publishes private files and updates without duplicates", async () => {
  assert.ok(localMode(), "This test requires the isolated local database");
  const user = await localUser("owner");
  const collection = await createCollection(
    user,
    `Import test ${randomUUID()}`,
  );
  const directory = await mkdtemp(join(tmpdir(), "house-intake-"));
  const filename = join(directory, "property.json");
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=",
    "base64",
  );
  const input = {
    environment: "local",
    collectionId: collection.id,
    actorId: user.id,
    propertyKey: "test-property-108",
    apartment: { name: "Intake apartment 108", room: "108" },
    scenarios: [
      {
        key: "work",
        payload: {
          name: "Work",
          person: "Renter",
          purpose: "work",
          destination: "Toyosu",
          frequencyUnit: "week",
          frequency: null,
        },
      },
    ],
    answers: [
      {
        key: "H01",
        payload: { state: "answered", value: 42000, source: "listing" },
      },
      {
        key: "H03",
        payload: { state: "answered", value: 0, source: "listing" },
      },
      {
        key: "H07",
        payload: {
          state: "not_checked",
          notes: "JACCS 10000 or 50%; company not confirmed",
          source: "listing",
        },
      },
      {
        key: "E10",
        payload: { state: "answered", value: "propane", source: "listing" },
      },
      {
        key: "B04",
        scenarioKey: "work",
        payload: { state: "answered", value: 1, source: "estimate" },
      },
    ],
    records: [
      {
        key: "eligibility",
        payload: { kind: "question", text: "Are foreign residents eligible?" },
      },
    ],
    attachments: [
      { path: "image.png", name: "Listing.png", mime: "image/png" },
    ],
  };
  const save = () => writeFile(filename, JSON.stringify(input));
  const run = (...flags) =>
    execute(process.execPath, [
      "scripts/import-property.mjs",
      filename,
      ...flags,
    ]);
  try {
    await writeFile(join(directory, "image.png"), bytes);
    await save();
    const preview = await run();
    assert.equal(JSON.parse(preview.stdout.trim()).mode, "preview");
    assert.equal((await snapshot(collection.id, user)).apartments.length, 0);
    input.environment = "production";
    await save();
    await assert.rejects(run("--apply"), (error) =>
      error.stderr.includes("IMPORT_ENVIRONMENT_MISMATCH"),
    );
    assert.equal((await snapshot(collection.id, user)).apartments.length, 0);
    input.environment = "local";
    input.attachments[0].path = "missing.png";
    await save();
    await assert.rejects(run("--apply"), (error) =>
      error.stderr.includes("ENOENT"),
    );
    assert.equal((await snapshot(collection.id, user)).apartments.length, 0);
    input.attachments[0].path = "image.png";
    await save();
    await run("--apply");
    const first = await snapshot(collection.id, user);
    assert.equal(first.apartments.length, 1);
    assert.equal(first.apartments[0].name, "Intake apartment 108");
    const value = (key) =>
      first.answers.find(
        (a) => a.criterionId === first.criteria.find((c) => c.key === key).id,
      );
    assert.equal(value("H01").value, 42000);
    assert.equal(value("H03").value, 0);
    assert.equal(value("H07").value, null);
    assert.equal(value("H07").state, "not_checked");
    assert.equal(value("E10").value, "propane");
    assert.equal(first.scenarios.length, 1);
    assert.equal(value("B04").value, 1);
    assert.equal(value("B04").scenarioId, first.scenarios[0].id);
    assert.equal(
      first.records.find((r) => r.kind === "question").text,
      "Are foreign residents eligible?",
    );
    const attachment = first.records.find((r) => r.kind === "attachment");
    assert.equal(attachment.uploadState, "ready");
    const response = await downloadAttachment(
      collection.id,
      user,
      attachment.id,
    );
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const published = await changes(collection.id, user, 0);
    assert.ok(
      published.changes.some(
        (c) =>
          c.entity === "apartments" && c.record.name === "Intake apartment 108",
      ),
    );
    assert.ok(
      published.changes.some(
        (c) => c.entity === "records" && c.record.uploadState === "ready",
      ),
    );
    await run("--apply");
    const repeated = await snapshot(collection.id, user);
    assert.equal(repeated.collection.sequence, first.collection.sequence);
    assert.equal(repeated.apartments.length, 1);
    assert.equal(repeated.answers.length, 5);
    assert.equal(repeated.records.length, 2);
    input.apartment.agentName = "Example broker";
    await save();
    await run("--apply");
    const updated = await snapshot(collection.id, user);
    assert.equal(updated.apartments.length, 1);
    assert.equal(updated.apartments[0].id, first.apartments[0].id);
    assert.equal(updated.apartments[0].agentName, "Example broker");
    assert.equal(updated.answers.length, 5);
    assert.equal(updated.records.length, 2);
  } finally {
    const s = await snapshot(collection.id, user);
    for (const file of s.records.filter((r) => r.kind === "attachment"))
      await rm(`.local-files/${file.id}`, { force: true });
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
    await rm(directory, { recursive: true, force: true });
    await closeDb();
  }
});
