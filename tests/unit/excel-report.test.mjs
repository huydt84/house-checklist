import test from "node:test";
import assert from "node:assert/strict";
import { readSheet } from "read-excel-file/node";
import { createComparisonExcel } from "../../lib/excel-report.mjs";

function fixture() {
  const snapshot = {
    collection: { name: "Tokyo / 東京", revision: 2, settings: {} },
    sections: [
      {
        id: "facts",
        key: "A",
        enabled: true,
        order: 0,
        labels: { en: "Facts" },
      },
      {
        id: "costs",
        key: "H",
        enabled: true,
        order: 1,
        labels: { en: "Costs" },
      },
    ],
    criteria: [
      ["A02", "Area", "number", "m²"],
      ["A03", "Layout", "select"],
      ["A04", "Pets", "boolean"],
      ["A05", "Building year", "number", "year"],
      ["A06", "Move-in date", "date"],
      ["A07", "Recorded text", "text"],
      ["H01", "Rent", "number", "JPY/month"],
      ["H02", "Management", "number", "JPY/month"],
    ].map(([key, name, type, unit], order) => ({
      id: key,
      key,
      type,
      unit,
      order,
      sectionId: key.startsWith("H") ? "costs" : "facts",
      stages: ["V"],
      labels: { en: name },
      choices: [{ id: "other", labels: { en: "Other" } }],
      supportFields: [
        { id: "available", type: "boolean", labels: { en: "Equipment" } },
      ],
    })),
    apartments: [
      {
        id: "a",
        name: "東京 Tiếng Việt",
        rentStart: "2026-11-01",
        expense24: 1200000,
      },
      { id: "b", name: "Other apartment" },
    ],
    answers: [
      {
        apartmentId: "a",
        criterionId: "A02",
        state: "answered",
        value: 0,
        notes: '=HYPERLINK("https://example.com")',
        suitability: "meets",
        settingsRevision: 1,
        support: { available: false },
        source: "observation",
        observedAt: "2026-10-12",
        sourceUrl: "https://example.com/global-export-source",
        documentType: "quote",
        documentReference: "Global document reference",
      },
      {
        apartmentId: "a",
        criterionId: "A03",
        state: "answered",
        value: "other",
        other: "2DK",
        hasLoft: false,
      },
      { apartmentId: "a", criterionId: "A04", state: "answered", value: false },
      { apartmentId: "b", criterionId: "A04", state: "answered", value: true },
      { apartmentId: "a", criterionId: "A05", state: "not_applicable" },
      { apartmentId: "b", criterionId: "A05", state: "answered", value: 1992 },
      {
        apartmentId: "b",
        criterionId: "A06",
        state: "answered",
        value: "2026-11",
      },
      {
        apartmentId: "a",
        criterionId: "A06",
        state: "answered",
        value: "2026-11-01",
      },
      {
        apartmentId: "a",
        criterionId: "A07",
        state: "answered",
        value: "東京 < & Tiếng Việt\nSecond line",
      },
      { apartmentId: "a", criterionId: "H01", state: "answered", value: 45000 },
      { apartmentId: "a", criterionId: "H02", state: "answered", value: 5000 },
    ],
    records: [],
    scenarios: [],
  };
  return {
    snapshot,
    apartmentIds: ["a", "b"],
    generatedAt: "2026-10-12T16:00:00.123Z",
  };
}

test("Excel files preserve numeric costs, missing answers, evidence, dates and literal text", async () => {
  const input = fixture();
  const longNote =
    "東京 Tiếng Việt. Recorded detail.\n".repeat(100) +
    "Final recorded detail.";
  input.snapshot.answers.find((a) => a.criterionId === "A07").notes = longNote;
  const before = structuredClone(input);
  const { blob, filename } = await createComparisonExcel({
    ...input,
    pending: 1,
    online: false,
  });
  const rows = await readSheet(blob, { trim: false });
  const find = (label) => rows.find(([value]) => value === label);
  assert.equal(
    filename,
    "house-checklist-comparison-Tokyo---東京-2026-10-13_01-00-00-123.xlsx",
  );
  assert.deepEqual(find("Shared checklist"), [
    "Shared checklist",
    "東京 Tiếng Việt",
    "Other apartment",
  ]);
  assert.deepEqual(find("Monthly housing"), [
    "Monthly housing",
    50000,
    "Unknown",
  ]);
  assert.deepEqual(find("24-month expense"), [
    "24-month expense",
    1200000,
    "Unknown",
  ]);
  assert.deepEqual(find("A02 · Area (m²)"), [
    "A02 · Area (m²)",
    0,
    "Not checked",
  ]);
  assert.deepEqual(find("A04 · Pets"), ["A04 · Pets", "No", "Yes"]);
  assert.deepEqual(find("A05 · Building year"), [
    "A05 · Building year",
    "Not applicable",
    1992,
  ]);
  assert.equal(find("H01 · Rent (¥)")[1], 45000);
  assert.equal(find("A06 · Move-in date")[2], "11/2026");
  assert.equal(find("A03 · Layout")[1], "Other · 2DK · No loft");
  assert.equal(
    find("A06 · Move-in date")[1].toISOString(),
    "2026-11-01T00:00:00.000Z",
  );
  for (const label of [
    "  Source",
    "  Source link",
    "  Observed / confirmed on",
    "  Document type",
    "  Document name / reference",
  ])
    assert.equal(find(label), undefined, label);
  for (const value of [
    "Global document reference",
    "https://example.com/global-export-source",
  ])
    assert.ok(!rows.flat().includes(value), value);
  assert.equal(find("  Notes")[1], '=HYPERLINK("https://example.com")');
  const noteIndex = rows.findLastIndex(([label]) => label === "  Notes");
  let exportedNote = rows[noteIndex][1];
  for (const [label, value] of rows.slice(noteIndex + 1)) {
    if (label !== "Continued") break;
    exportedNote += value;
  }
  assert.equal(exportedNote, longNote);
  assert.equal(
    find("A07 · Recorded text")[1],
    "東京 < & Tiếng Việt\nSecond line",
  );
  assert.equal(find("  Equipment")[1], "Not available");
  assert.match(
    find("  Suitability assessment")[1],
    /Meets my needs.*Review after preference changes/,
  );
  assert.ok(
    rows
      .flat()
      .includes("Includes locally saved changes awaiting synchronization."),
  );
  assert.ok(rows.flat().includes("Exported from the offline copy."));
  assert.equal(find("Upfront personal cash · Basis")[1], "Known charges");
  assert.deepEqual(input, before);
  const next = await createComparisonExcel({
    ...input,
    generatedAt: "2026-10-12T16:00:00.124Z",
  });
  assert.equal(
    next.filename,
    "house-checklist-comparison-Tokyo---東京-2026-10-13_01-00-00-124.xlsx",
  );
});

test("Excel reports use the active Japanese or Vietnamese labels and explain empty filters", async () => {
  for (const [locale, title, unknown, empty] of [
    ["ja", "物件比較", "不明", "条件に合う項目はありません。"],
    ["vi", "So sánh căn hộ", "Chưa rõ", "Không có mục phù hợp bộ lọc."],
  ]) {
    const { blob } = await createComparisonExcel({
      ...fixture(),
      locale,
      filters: { section: "missing" },
      conflicts: true,
    });
    const rows = await readSheet(blob);
    assert.equal(rows[0][0], title);
    assert.ok(rows.flat().includes(unknown));
    assert.ok(rows.flat().includes(empty));
    assert.equal(
      rows.some(([label]) => label?.startsWith("A02")),
      false,
    );
  }
});

test("Excel export requires two to four distinct active apartments", async () => {
  const data = fixture();
  for (const apartmentIds of [[], ["a"], ["a", "a"], ["a", "missing"]])
    await assert.rejects(
      createComparisonExcel({ ...data, apartmentIds }),
      /Invalid Excel comparison selection/,
    );
  data.snapshot.apartments.push(
    ...["c", "d", "e"].map((id) => ({ id, name: id })),
  );
  await assert.rejects(
    createComparisonExcel({ ...data, apartmentIds: ["a", "b", "c", "d", "e"] }),
    /Invalid Excel comparison selection/,
  );
  data.snapshot.apartments[1].archived = true;
  await assert.rejects(
    createComparisonExcel(data),
    /Invalid Excel comparison selection/,
  );
});
