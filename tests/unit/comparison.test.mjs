import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  comparisonRows,
  comparisonSummaryRows,
} from "../../lib/comparison.mjs";
import { emptySnapshot } from "../../lib/domain.mjs";
import { instantiateTemplate } from "../../lib/seed.mjs";

test("comparison includes only selected properties' known facts and affirmative boolean answers", () => {
  const snapshot = {
    ...emptySnapshot(),
    ...instantiateTemplate(randomUUID),
    scenarios: [
      { id: "work", purpose: "work" },
      { id: "visit", purpose: "partner_home" },
    ],
  };
  const criterion = (key) => snapshot.criteria.find((c) => c.key === key);
  const answer = (apartmentId, key, payload, scenarioId = null) =>
    snapshot.answers.push({
      apartmentId,
      criterionId: criterion(key).id,
      scenarioId,
      state: "answered",
      ...payload,
    });
  const rows = (ids, filters) =>
    comparisonRows(snapshot, ids, filters).map((row) => [
      row.criterion.key,
      row.scenarioId,
    ]);

  answer("a", "G05", { value: false });
  answer("b", "G05", { value: false });
  answer("outside", "G05", { value: true });
  answer("outside", "A03", { value: "1K" });
  answer("a", "A02", { value: 0 });
  answer("b", "A09", { value: "Confirm the lease" });
  answer("a", "F01", { value: "   " });
  answer("a", "G07", { state: "not_checked", notes: "Need to inspect" });
  answer("a", "D01", {
    state: "not_checked",
    value: "N",
    suitability: "unassessed",
  });
  answer("a", "E02", {
    state: "not_checked",
    value: 0,
    suitability: "unassessed",
  });
  answer("a", "B07.one_way", { value: 0 }, "work");

  assert.deepEqual(rows(["a", "b"]), [
    ["A02", null],
    ["A09", null],
    ["B07.one_way", "work"],
    ["D01", null],
    ["E02", null],
  ]);
  answer("c", "G05", { value: true });
  assert.deepEqual(rows(["a", "c"], { section: criterion("G05").sectionId }), [
    ["G05", null],
  ]);
  assert.deepEqual(
    rows(["unknown", "c"], {
      section: criterion("G05").sectionId,
      unanswered: true,
    }),
    [["G05", null]],
  );
  assert.deepEqual(
    rows(["a", "b"], { section: criterion("G05").sectionId, unanswered: true }),
    [],
  );
  assert.deepEqual(rows(["a", "b"], { stage: "S" }), [["A09", null]]);
  assert.deepEqual(rows(["a", "b"], { required: true }), []);
  assert.deepEqual(rows([], {}), []);
});

test("comparison summaries hide unentered totals and fares but keep confirmed zero and partial amounts", () => {
  const snapshot = {
    ...emptySnapshot(),
    ...instantiateTemplate(randomUUID),
    collection: { settings: {} },
    apartments: [
      { id: "a", rentStart: "2026-11-01" },
      { id: "b" },
      { id: "c", rentStart: "2026-11-01", expense24: 0 },
    ],
    scenarios: [
      { id: "work", purpose: "work", frequency: 4, frequencyUnit: "month" },
    ],
  };
  assert.deepEqual(comparisonSummaryRows(snapshot, ["a", "b"]), []);
  for (const [apartmentId, key, value, scenarioId = null] of [
    ["b", "H03", 0],
    ["c", "H01", 45000],
    ["c", "H02", 0],
    ["c", "B07.one_way", 0, "work"],
  ])
    snapshot.answers.push({
      apartmentId,
      criterionId: snapshot.criteria.find((c) => c.key === key).id,
      scenarioId,
      state: "answered",
      value,
    });
  const values = (ids) =>
    comparisonSummaryRows(snapshot, ids).map((row) => [
      row.kind === "cost" ? row.label : row.scenario.id,
      row.values,
    ]);
  assert.deepEqual(values(["a", "b"]), [["deposits", [null, 0]]]);
  assert.deepEqual(values(["a", "c"]), [
    ["monthlyHousing", [null, 45000]],
    ["upfront", [null, 45000]],
    ["total24", [null, 0]],
    ["work", [null, 0]],
  ]);
  assert.deepEqual(values(["a"]), []);
});
