import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { criterionTemplates, instantiateTemplate } from "../../lib/seed.mjs";
import {
  normalizeAnswer,
  completion,
  emptySnapshot,
  journeyFor,
  activeCriteria,
  answerState,
  formatValue,
} from "../../lib/domain.mjs";
import {
  calculateCosts,
  apartmentCosts,
  calculateTravel,
  resolveAmount,
} from "../../lib/calculations.mjs";
import messages from "../../data/messages.json" with { type: "json" };
// These public contracts own calculation and seed proof; database tests own authorization and concurrency.
test("layout answers accept an optional boolean loft fact without changing the room type", () => {
  const criterion = criterionTemplates.find((c) => c.key === "A03");
  const legacy = normalizeAnswer(
    { state: "answered", value: "1K" },
    criterion,
    null,
    1,
  );
  assert.equal(Object.hasOwn(legacy, "hasLoft"), false);
  for (const hasLoft of [true, false]) {
    const saved = normalizeAnswer({ ...legacy, hasLoft }, criterion, legacy, 1);
    assert.equal(saved.hasLoft, hasLoft);
    assert.equal(saved.value, "1K");
  }
  assert.throws(
    () =>
      normalizeAnswer({ ...legacy, hasLoft: "false" }, criterion, legacy, 1),
    { code: "INVALID_ANSWER" },
  );
});
test("the default 113 checks produce 115 typed, translated definitions without enabling optional sections", () => {
  assert.equal(new Set(criterionTemplates.map((c) => c.sourceKey)).size, 113);
  assert.equal(criterionTemplates.length, 115);
  assert.deepEqual(
    criterionTemplates.reduce(
      (out, c) => ((out[c.type] = (out[c.type] || 0) + 1), out),
      {},
    ),
    { select: 4, number: 33, text: 63, boolean: 15 },
  );
  for (const c of criterionTemplates) {
    for (const locale of ["en", "ja", "vi"]) {
      assert.ok(c.labels[locale]?.trim(), `${c.key} ${locale} label`);
      assert.equal(
        typeof c.guidance[locale],
        "string",
        `${c.key} ${locale} guidance`,
      );
      if (c.guidance.en.trim()) assert.ok(c.guidance[locale].trim());
    }
    assert.ok(c.stages.length);
    if (c.type === "number") assert.ok(c.unit);
    for (const choice of c.choices)
      assert.equal(Object.keys(choice.labels).length, 3);
  }
  const s = instantiateTemplate(randomUUID);
  assert.equal(s.sections.filter((s) => s.enabled).length, 9);
  assert.equal(
    s.sections
      .filter((s) => !s.enabled)
      .map((s) => s.key)
      .join(""),
    "JK",
  );
  assert.deepEqual(criterionTemplates.find((c) => c.key === "A09").stages, [
    "L",
    "A",
    "V",
    "S",
  ]);
  assert.equal(
    criterionTemplates.find((c) => c.key === "B02.distance").unit,
    "m",
  );
  assert.equal(
    criterionTemplates.find((c) => c.key === "B07.return").unit,
    "JPY",
  );
  for (const [key, m] of Object.entries(messages))
    for (const lang of ["en", "ja", "vi"])
      assert.ok(m[lang]?.trim(), `${key}.${lang}`);
});
test("appliance availability distinguishes missing, available and unavailable and rejects non-boolean facts", () => {
  for (const key of ["E04", "E07"]) {
    const criterion = criterionTemplates.find((c) => c.key === key);
    const input = {
      state: "not_checked",
      support: { width: 0.65 },
      notes: "Keep dimensions",
    };
    const original = normalizeAnswer(input, criterion, null, 1);
    assert.equal(Object.hasOwn(original.support, "available"), false);
    for (const available of [true, false, null]) {
      const saved = normalizeAnswer(
        { ...input, support: { ...input.support, available } },
        criterion,
        original,
        1,
      );
      assert.equal(saved.support.available, available);
      assert.equal(saved.support.width, 0.65);
      assert.equal(saved.notes, "Keep dimensions");
      assert.equal(answerState(saved, criterion), "not_checked");
    }
    for (const available of ["false", 0, {}]) {
      assert.throws(
        () =>
          normalizeAnswer(
            { ...input, support: { available } },
            criterion,
            original,
            1,
          ),
        { code: "INVALID_SUPPORT_VALUE" },
      );
    }
  }
});
test("D/E assessments complete checks independently of optional facts and survive note edits", () => {
  const criterion = criterionTemplates.find((c) => c.key === "E02");
  const assessed = normalizeAnswer(
    { state: "not_checked", suitability: "meets" },
    criterion,
    null,
    1,
  );
  assert.equal(answerState(assessed, criterion), "answered");
  assert.equal(assessed.value, null);
  const updated = normalizeAnswer(
    { ...assessed, value: 0, notes: "Induction" },
    criterion,
    assessed,
    1,
  );
  assert.equal(updated.value, 0);
  assert.equal(updated.suitability, "meets");
  const reset = normalizeAnswer(
    { ...updated, suitability: "unassessed" },
    criterion,
    updated,
    1,
  );
  assert.equal(answerState(reset, criterion), "not_checked");
  assert.equal(reset.value, 0);
  const s = {
    ...emptySnapshot(),
    collection: { revision: 1 },
    sections: [{ id: "e", enabled: true }],
    criteria: [{ ...criterion, id: "c", sectionId: "e" }],
    answers: [{ ...updated, criterionId: "c", apartmentId: "a" }],
  };
  assert.equal(completion(s, "a").answered, 1);
  assert.equal(completion(s, "a").requirements, 0);
  for (const value of [-1, "2", Infinity])
    assert.throws(() =>
      normalizeAnswer({ ...assessed, value }, criterion, assessed, 1),
    );
});
test("suitability completes a check without inventing optional facts", () => {
  for (const criterion of criterionTemplates) {
    const key = criterion.key;
    for (const suitability of ["meets", "unmet"]) {
      const assessed = normalizeAnswer(
        { state: "not_checked", suitability },
        criterion,
        null,
        1,
      );
      assert.equal(answerState(assessed, criterion), "answered", key);
      assert.equal(assessed.value, null, key);
      assert.equal(formatValue(assessed, criterion), "answered", key);
      const snapshot = {
        ...emptySnapshot(),
        collection: { revision: 1 },
        sections: [{ id: "s", key: criterion.section, enabled: true }],
        criteria: [
          {
            ...criterion,
            id: "c",
            sectionId: "s",
            scope: "apartment",
            importance: "requirement",
          },
        ],
        answers: [{ ...assessed, criterionId: "c", apartmentId: "a" }],
      };
      assert.equal(completion(snapshot, "a").answered, 1, key);
      assert.equal(
        completion(snapshot, "a").requirements,
        suitability === "meets" ? 0 : 1,
        key,
      );
    }
  }
});
test("custom checks stay in their section when comparison rows are ordered", () => {
  const criteria = [
    { id: "source", sectionId: "source", order: 0 },
    { id: "area", sectionId: "A", order: 1 },
    { id: "availability", sectionId: "A", order: 0 },
  ];
  assert.deepEqual(
    activeCriteria({
      criteria,
      sections: [
        { id: "A", enabled: true, order: 0 },
        { id: "source", enabled: true, order: 11 },
      ],
    }).map((c) => c.id),
    ["availability", "area", "source"],
  );
});
test("No and zero answer checks, notes and whitespace do not; NA and archived items do not inflate completion", () => {
  const criteria = [
    { id: "b", type: "boolean" },
    { id: "n", type: "number" },
    { id: "t", type: "text" },
  ].map((c) => ({
    ...c,
    sectionId: "s",
    scope: "apartment",
    supportFields: [],
  }));
  const answers = [
    { criterionId: "b", state: "answered", value: false },
    { criterionId: "n", state: "answered", value: 0 },
    { criterionId: "t", state: "answered", value: "   ", notes: "A note" },
  ].map((a) => ({
    ...normalizeAnswer(
      a,
      criteria.find((c) => c.id === a.criterionId),
      null,
      1,
    ),
    criterionId: a.criterionId,
    apartmentId: "a",
  }));
  const s = {
    ...emptySnapshot(),
    collection: { revision: 1 },
    sections: [{ id: "s", enabled: true }],
    criteria,
    answers,
  };
  assert.equal(completion(s, "a").answered, 2);
  assert.equal(completion(s, "a").percent, 67);
  s.answers = answers.map((a) => ({ ...a, state: "not_applicable" }));
  assert.equal(completion(s, "a").percent, null);
  assert.equal(completion(s, "a").total, 0);
  s.criteria = s.criteria.map((c) => ({ ...c, archived: true }));
  assert.equal(completion(s, "a").total, 0);
  const prior = {
    state: "answered",
    value: 20,
    suitability: "meets",
    support: {},
  };
  assert.equal(
    normalizeAnswer({ ...prior, value: 21 }, criteria[1], prior, 1).suitability,
    "meets",
  );
  // Derived unit prices retain decimals; actual yen obligations remain whole yen.
  assert.equal(
    normalizeAnswer(
      { state: "answered", value: 67997.89806 },
      { ...criteria[1], unit: "JPY/m²" },
      null,
      1,
    ).value,
    67997.89806,
  );
  for (const unit of ["JPY", "JPY/month"]) {
    assert.throws(() =>
      normalizeAnswer(
        { state: "answered", value: 50.5 },
        { ...criteria[1], unit },
        null,
        1,
      ),
    );
  }
  assert.throws(
    () =>
      normalizeAnswer(
        {
          state: "answered",
          value: 0,
          source: "document",
          documentType: "contract",
        },
        criteria[1],
        null,
        1,
      ),
    { code: "CONTRACT_REFERENCE_REQUIRED" },
  );
});
const fixture = {
  startDate: "2026-11-01",
  reviewed: true,
  items: [
    { id: "rent", amount: 130000, frequencyUnit: "monthly" },
    { id: "management", amount: 10000, frequencyUnit: "monthly" },
    { id: "fee", amount: 100000, phase: "upfront" },
    { id: "deposit", amount: 130000, treatment: "deposit", phase: "upfront" },
  ],
  adjustments: [
    {
      costId: "rent",
      confirmed: true,
      full: true,
      startDate: "2026-12-01",
      endDate: "2027-01-01",
    },
  ],
  payments: [
    {
      costId: "rent",
      amount: 130000,
      coverageDate: "2026-11-01",
      paidAt: "2026-10-25",
    },
  ],
};
test("automatic housing summaries ignore optional records of every type, regardless of name", () => {
  const s = {
    ...emptySnapshot(),
    collection: { settings: {} },
    apartments: [{ id: "apt", rentStart: "2026-11-01", costsReviewed: true }],
    criteria: ["H01", "H02", "F05"].map((key) => ({ id: key, key })),
    answers: [
      {
        criterionId: "H01",
        apartmentId: "apt",
        state: "answered",
        value: 45000,
      },
      {
        criterionId: "H02",
        apartmentId: "apt",
        state: "answered",
        value: 5000,
      },
      {
        criterionId: "F05",
        apartmentId: "apt",
        state: "answered",
        value: 2000,
      },
    ],
    records: [
      {
        id: "source-total",
        apartmentId: "apt",
        kind: "cost",
        amount: 50000,
        name: "An arbitrary optional charge",
        frequencyUnit: "monthly",
        treatment: "expense",
      },
      {
        id: "linked-rent",
        apartmentId: "apt",
        kind: "cost",
        name: "A linked reference",
        amountSource: "H01",
        frequencyUnit: "annual",
        treatment: "expense",
      },
      {
        id: "discount",
        apartmentId: "apt",
        kind: "adjustment",
        name: "An optional discount",
        costId: "H01",
        confirmed: true,
        full: true,
        startDate: "2026-12-01",
        endDate: "2027-01-01",
      },
      {
        id: "reduction",
        apartmentId: "apt",
        kind: "benefit",
        name: "An optional reduction",
        amount: 10000,
        frequencyUnit: "monthly",
        confirmed: true,
        compatible: true,
      },
      {
        id: "payment",
        apartmentId: "apt",
        kind: "payment",
        name: "An optional payment",
        costId: "H01",
        amount: 45000,
        payer: "employer",
        coverageDate: "2026-11-01",
        paidAt: "2026-10-25",
      },
    ],
  };
  assert.equal(apartmentCosts(s, "apt").monthly, 50000);
  assert.equal(apartmentCosts(s, "apt").expense, null);
  assert.equal(apartmentCosts(s, "apt").net, null);
  assert.equal(apartmentCosts(s, "apt").upfront, 52000);
  assert.equal(apartmentCosts(s, "apt").complete, false);
  s.answers = s.answers.filter((a) => a.criterionId !== "H02");
  assert.equal(apartmentCosts(s, "apt").monthly, null);
  s.answers.push({
    criterionId: "H02",
    apartmentId: "apt",
    state: "not_applicable",
    value: null,
  });
  assert.equal(apartmentCosts(s, "apt").monthly, 45000);
  delete s.apartments[0].rentStart;
  assert.equal(apartmentCosts(s, "apt").monthly, 45000);
  assert.equal(apartmentCosts(s, "apt").expense, null);
  s.apartments[0].expense24 = 1150000;
  assert.equal(apartmentCosts(s, "apt").expense, 1150000);
  s.apartments[0].expense24 = 0;
  assert.equal(apartmentCosts(s, "apt").expense, 0);
  s.apartments[0].expense24 = "";
  assert.equal(apartmentCosts(s, "apt").expense, null);
});
test("24-month fixture counts prepaid rent once, excludes deposit expense and applies a rent-only second-month promotion", () => {
  const c = calculateCosts(fixture);
  assert.equal(c.expense, 3330000);
  assert.equal(c.upfront, 370000);
  assert.equal(c.deposits, 130000);
  assert.equal(c.monthly, 140000);
  assert.equal(c.complete, true);
});
test("unknown and disputed fees stay visible; annual charges, holds, benefits and endpoint renewals retain their meaning", () => {
  const c = calculateCosts({
    ...fixture,
    items: [
      ...fixture.items,
      { id: "unknown", amount: null },
      { id: "disputed", amount: 5000, duplicateGroup: "cleaning" },
      { id: "hold", amount: 20000, treatment: "hold" },
      { id: "annual", amount: 12000, frequencyUnit: "annual" },
      { id: "renewal", amount: 130000, frequencyUnit: "renewal" },
    ],
    benefits: [
      {
        id: "pending",
        amount: 30000,
        frequencyUnit: "monthly",
        confirmed: false,
      },
      {
        id: "confirmed",
        amount: 10000,
        frequencyUnit: "monthly",
        confirmed: true,
        compatible: true,
      },
    ],
  });
  assert.equal(c.expense, 3354000);
  assert.equal(c.net, 3114000);
  assert.equal(c.holds, 20000);
  assert.deepEqual(c.missing, ["unknown"]);
  assert.equal(c.disputed[0].id, "disputed");
  assert.equal(c.dueAfter.find((i) => i.id === "renewal").amount, 130000);
  assert.ok(c.assumptions.includes("pending:unconfirmedBenefit"));
  assert.equal(c.complete, false);
  assert.equal(
    resolveAmount(
      {
        formula: {
          type: "percentage",
          percent: 50,
          bases: ["rent", "management"],
        },
      },
      { rent: 130000, management: 10000 },
    ).toNumber(),
    70000,
  );
  assert.equal(
    resolveAmount(
      { formula: { type: "percentage", percent: 50, bases: ["missing"] } },
      {},
    ),
    null,
  );
});
test("travel uses independent fares, taxi surcharges, confirmed partial reimbursement and calendar-day weekly frequencies", () => {
  const args = {
    scenario: { frequency: 2, frequencyUnit: "week" },
    journey: {
      outboundFare: 300,
      returnFare: 450,
      taxiFare: 1000,
      bookingSurcharge: 200,
      reimbursed: 500,
      reimbursementConfirmed: true,
    },
    startDate: "2026-02-01",
    months: 1,
  };
  const c = calculateTravel(args);
  assert.equal(c.days, 28);
  assert.equal(c.total, 15600);
  assert.equal(c.net, 11600);
  assert.equal(c.monthly, 15600);
  const march = calculateTravel({ ...args, startDate: "2026-03-01" });
  assert.equal(march.days, 31);
  assert.equal(march.total, 17271);
  assert.equal(
    calculateTravel({ ...args, journey: { ...args.journey, returnFare: null } })
      .missing[0],
    "returnFare",
  );
});

test("journey summaries use checklist facts instead of stale independent copies", () => {
  const keys = [
    "B03",
    "B04",
    "B07.one_way",
    "B07.return",
    "B08",
    "B09",
    "B10",
    "B11",
  ];
  const values = [
    32,
    0,
    200,
    250,
    "Toyosu via Kiyosumi",
    "Higashi-Nakayama via Morishita",
    "Return via Monzen",
    1800,
  ];
  const snapshot = {
    criteria: keys.map((key) => ({ id: key, key })),
    answers: keys.map((key, i) => ({
      apartmentId: "a",
      criterionId: key,
      scenarioId: "s",
      state: "answered",
      value: values[i],
    })),
    records: [
      {
        kind: "journey",
        apartmentId: "a",
        scenarioId: "s",
        outboundMinutes: 999,
        outboundFare: 999,
        taxiFare: 999,
        bookingSurcharge: 999,
        outboundRoute: "stale",
        returnRoute: "stale",
        includeTaxi: true,
      },
    ],
  };
  const work = journeyFor(snapshot, "a", { id: "s", purpose: "work" });
  assert.equal(work.outboundMinutes, 32);
  assert.equal(work.outboundFare, 200);
  assert.equal(work.returnFare, 250);
  assert.equal(work.transfers, 0);
  assert.equal(work.taxiFare, 1800);
  assert.equal(work.bookingSurcharge, 0);
  const partner = journeyFor(snapshot, "a", {
    id: "s",
    purpose: "partner_home",
  });
  assert.equal(partner.outboundRoute, "Toyosu via Kiyosumi");
  assert.equal(partner.returnRoute, "Return via Monzen");
  snapshot.records[0].includeTaxi = false;
  assert.equal(
    journeyFor(snapshot, "a", { id: "s", purpose: "work" }).taxiFare,
    0,
  );
});
