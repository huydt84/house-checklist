import test from "node:test";
import assert from "node:assert/strict";
import { buildPdfReport } from "../../lib/pdf-report.mjs";
import { criterionTemplates } from "../../lib/seed.mjs";

function fixture() {
  return {
    collection: { name: "Search", revision: 2, settings: {} },
    sections: [
      {
        id: "section",
        key: "A",
        order: 0,
        enabled: true,
        labels: { en: "Facts" },
      },
    ],
    criteria: [
      {
        id: "zero",
        key: "A01",
        sectionId: "section",
        type: "number",
        importance: "requirement",
        order: 0,
        stages: ["V"],
        labels: { en: "Zero field" },
      },
      {
        id: "no",
        key: "A02",
        sectionId: "section",
        type: "boolean",
        order: 1,
        stages: ["V"],
        labels: { en: "No field" },
      },
      {
        id: "missing",
        key: "A03",
        sectionId: "section",
        type: "text",
        order: 2,
        stages: ["L"],
        labels: { en: "Empty field" },
      },
      {
        id: "notes",
        key: "A04",
        sectionId: "section",
        type: "text",
        order: 3,
        stages: ["V"],
        labels: { en: "Evidence only" },
      },
      {
        id: "na",
        key: "A05",
        sectionId: "section",
        type: "number",
        order: 4,
        stages: ["V"],
        labels: { en: "Exempt field" },
      },
      {
        id: "blank",
        key: "A06",
        sectionId: "section",
        type: "text",
        order: 5,
        stages: ["V"],
        labels: { en: "Whitespace field" },
      },
    ],
    apartments: [
      {
        id: "a",
        name: "東京 Tiếng Việt",
        room: " ",
        agentName: "",
        expense24: null,
      },
      { id: "b", name: "Second property" },
    ],
    answers: [
      {
        apartmentId: "a",
        criterionId: "zero",
        state: "answered",
        value: 0,
        suitability: "meets",
        settingsRevision: 1,
        source: "estimate",
        sourceUrl: "https://example.com/global-export-source",
        observedAt: "2026-10-12",
        documentType: "quote",
        documentReference: "Global document reference",
      },
      {
        apartmentId: "a",
        criterionId: "missing",
        state: "not_checked",
        source: "listing",
        documentReference: "Metadata without an answer",
      },
      { apartmentId: "a", criterionId: "no", state: "answered", value: false },
      {
        apartmentId: "a",
        criterionId: "notes",
        state: "not_checked",
        notes: "Measured locally",
        source: "observation",
        support: {},
      },
      { apartmentId: "a", criterionId: "na", state: "not_applicable" },
      {
        apartmentId: "a",
        criterionId: "blank",
        state: "not_checked",
        notes: "   ",
      },
    ],
    records: [],
    scenarios: [],
  };
}
function reportText(node) {
  if (Array.isArray(node)) return node.map(reportText).join("\n");
  if (!node || typeof node !== "object") return "";
  return [
    typeof node.text === "string" ? node.text : "",
    ...Object.entries(node)
      .filter(([k]) => k !== "text")
      .map(([, v]) => reportText(v)),
  ].join("\n");
}
test("PDFs include saved loft facts for layouts", () => {
  const snapshot = fixture();
  snapshot.criteria = [
    {
      ...criterionTemplates.find((c) => c.key === "A03"),
      id: "layout",
      sectionId: "section",
    },
  ];
  snapshot.answers = [true, false].map((hasLoft, i) => ({
    apartmentId: i ? "b" : "a",
    criterionId: "layout",
    state: "answered",
    value: "1K",
    hasLoft,
  }));
  const report = buildPdfReport({
    snapshot,
    apartmentIds: ["a", "b"],
    kind: "comparison",
    locale: "vi",
  });
  const output = reportText(report.document.content);
  assert.ok(output.includes("Có loft"));
  assert.ok(output.includes("Không có loft"));
});
test("property PDFs omit empty data while retaining zero, No, exemptions, evidence and draft state", () => {
  const snapshot = fixture();
  snapshot.records.push({
    kind: "cost",
    apartmentId: "a",
    name: "Unconfirmed quote",
    amount: null,
    taxTreatment: "unknown",
  });
  const report = buildPdfReport({
    snapshot,
    apartmentIds: ["a"],
    kind: "property",
    pending: 1,
    conflicts: true,
    online: false,
    generatedAt: "2026-10-12T16:00:00.123Z",
  });
  const output = reportText(report.document.content);
  for (const phrase of [
    "Zero field",
    "\n0\n",
    "No",
    "Not applicable",
    "Measured locally",
    "Review after preference changes",
    "conflicts",
    "offline copy",
    "Unconfirmed quote",
  ])
    assert.ok(output.includes(phrase), phrase);
  for (const phrase of [
    "Unknown",
    "Not checked",
    "Empty field",
    "Whitespace field",
    "Room number",
    "Agent name",
    "24-month expense",
    "No files",
    "No questions",
    "Source:",
    "Observed / confirmed on",
    "Document type:",
    "Document name / reference",
    "Global document reference",
    "Metadata without an answer",
    "https://example.com/global-export-source",
  ])
    assert.ok(!output.includes(phrase), phrase);
  assert.equal(report.document.pageOrientation, "portrait");
  assert.equal(
    report.filename,
    "house-checklist-東京-Tiếng-Việt-2026-10-13_01-00-00-123.pdf",
  );
  const next = buildPdfReport({
    snapshot,
    apartmentIds: ["a"],
    kind: "property",
    generatedAt: "2026-10-12T16:00:00.124Z",
  });
  assert.equal(
    next.filename,
    "house-checklist-東京-Tiếng-Việt-2026-10-13_01-00-00-124.pdf",
  );
});
test("PDF entries preserve old descriptions and show assessments without inventing facts", () => {
  const snapshot = fixture();
  snapshot.sections = [
    { id: "e", key: "E", enabled: true, labels: { en: "Kitchen" } },
  ];
  snapshot.sections.push({
    id: "f",
    key: "F",
    enabled: true,
    labels: { en: "Utilities" },
  });
  snapshot.sections.push({
    id: "c",
    key: "C",
    enabled: true,
    labels: { en: "Layout" },
  });
  snapshot.criteria = [
    "E01",
    "E02",
    "E03",
    "E04",
    "E07",
    "E10",
    "F02",
    "F05",
    "C02",
  ].map((key) => ({
    ...criterionTemplates.find((c) => c.key === key),
    id: key,
    sectionId: key[0].toLowerCase(),
  }));
  snapshot.answers = [
    { apartmentId: "a", criterionId: "E04", support: { available: true } },
    { apartmentId: "a", criterionId: "E07", support: { available: false } },
    {
      apartmentId: "a",
      criterionId: "E10",
      value: "propane",
      other: "Old other type",
    },
    {
      apartmentId: "a",
      criterionId: "E01",
      suitability: "meets",
      value: null,
      settingsRevision: 2,
    },
    {
      apartmentId: "a",
      criterionId: "E02",
      suitability: "unmet",
      value: null,
      settingsRevision: 2,
    },
    {
      apartmentId: "a",
      criterionId: "E03",
      state: "answered",
      value: "Old preparation measurement",
      notes: "New viewing note",
    },
  ];
  snapshot.answers.push(
    ...["F02", "F05", "C02"].map((key) => ({
      apartmentId: "a",
      criterionId: key,
      state: "not_checked",
      value: null,
      suitability: "meets",
      settingsRevision: 2,
    })),
  );
  const output = reportText(
    buildPdfReport({ snapshot, apartmentIds: ["a"], kind: "property" }).document
      .content,
  );
  for (const phrase of [
    "Meets my needs",
    "Does not meet",
    "Old preparation measurement",
    "New viewing note",
    "Refrigerator: Available",
    "Washing machine: Not available",
    "Propane",
  ])
    assert.ok(output.includes(phrase), phrase);
  assert.ok(!output.includes("0 burners"));
  assert.ok(!output.includes("0 ¥"));
  assert.ok(!output.includes("0 JPY"));
  assert.ok(!output.includes("null"));
  assert.ok(!output.includes("\nNo\n"));
  assert.ok(!output.includes("Old other type"));
});
test("comparison PDFs export selected properties and honor filters while preserving visible gaps", () => {
  const snapshot = fixture();
  snapshot.apartments[0].expense24 = 0;
  const report = buildPdfReport({
    snapshot,
    apartmentIds: ["b", "a"],
    kind: "comparison",
    filters: { stage: "V", required: true },
    pending: 1,
  });
  const output = reportText(report.document.content);
  for (const phrase of [
    "Second property",
    "東京 Tiếng Việt",
    "Zero field",
    "Not checked",
    "Unknown",
    "Applied checklist filters",
    "awaiting synchronization",
  ])
    assert.ok(output.includes(phrase), phrase);
  assert.ok(!output.includes("No field"));
  assert.ok(!output.includes("Empty field"));
  for (const phrase of [
    "Source:",
    "Observed / confirmed on",
    "Document type:",
    "Document name / reference",
    "Global document reference",
    "https://example.com/global-export-source",
  ])
    assert.ok(!output.includes(phrase), phrase);
  const firstTable = report.document.content.find((n) => n.table);
  assert.ok(firstTable.table.body[1][1].text.startsWith("Second property"));
  assert.equal(report.document.pageOrientation, "landscape");
  const empty = buildPdfReport({
    snapshot,
    apartmentIds: ["a", "b"],
    kind: "comparison",
    filters: { section: "absent" },
  });
  assert.ok(reportText(empty.document.content).includes("No checks match"));
  assert.ok(reportText(empty.document.content).includes("24-month expense"));
  assert.ok(!reportText(empty.document.content).includes("Monthly housing"));
});
