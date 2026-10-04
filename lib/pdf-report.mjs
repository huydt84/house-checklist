import {
  answerRows,
  answerState,
  completion,
  findAnswer,
  journeyFor,
  textFor,
  simplifiedChecklist,
  characteristicAnswer,
  meaningful,
  answerNotes,
  layoutAnswer,
} from "./domain.mjs";
import {
  apartmentCosts,
  calculateTravel,
  resolveAmount,
} from "./calculations.mjs";
import { comparisonRows } from "./comparison.mjs";
import { t, money, dateLabel, unitLabel } from "./i18n.mjs";

const present = (value) =>
  value !== null &&
  value !== undefined &&
  (typeof value !== "string" || Boolean(value.trim()));
const text = (value) => ({ text: String(value ?? ""), lineHeight: 1.25 });
const heading = (label) => ({
  text: label,
  style: "section",
  margin: [0, 16, 0, 7],
});
const table = (headers, rows, widths, caption = "") => ({
  table: {
    headerRows: caption ? 2 : 1,
    keepWithHeaderRows: 1,
    widths,
    body: [
      ...(caption
        ? [
            [
              {
                text: caption,
                colSpan: headers.length,
                style: "section",
                margin: [0, 6, 0, 6],
              },
              ...headers.slice(1).map(() => ({})),
            ],
          ]
        : []),
      headers.map((label) => ({ text: label, style: "tableHeader" })),
      ...rows,
    ],
  },
  layout: "lightHorizontalLines",
  margin: [0, 0, 0, 8],
});
const pairs = (rows, caption = "") => ({
  table: {
    widths: [145, "*"],
    headerRows: caption ? 1 : 0,
    keepWithHeaderRows: caption ? 1 : 0,
    body: [
      ...(caption
        ? [
            [
              {
                text: caption,
                colSpan: 2,
                style: "section",
                margin: [0, 6, 0, 6],
              },
              {},
            ],
          ]
        : []),
      ...rows.map(([key, value]) => [text(key), text(value)]),
    ],
  },
  layout: "lightHorizontalLines",
  margin: [0, 0, 0, 8],
});
const safeLink = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol) ? value : "";
  } catch {
    return "";
  }
};
function linked(value) {
  const link = safeLink(value);
  return { ...text(value), ...(link ? { link, color: "#17675f" } : {}) };
}

function valueText(answer, criterion, locale) {
  const state = answerState(answer, criterion);
  if (simplifiedChecklist(criterion) && !characteristicAnswer(criterion))
    return t(locale, state);
  if (
    !meaningful(answer?.value, criterion.type) ||
    (!simplifiedChecklist(criterion) && state !== "answered")
  )
    return t(locale, state);
  if (criterion.type === "boolean")
    return t(locale, answer.value ? "yes" : "no");
  if (criterion.type === "select")
    return `${
      textFor(
        criterion.choices.find((c) => c.id === answer.value),
        locale,
      ) || answer.value
    }${answer.value === "other" && answer.other ? ` · ${answer.other}` : ""}`;
  const value =
    criterion.type === "number"
      ? new Intl.NumberFormat(locale).format(answer.value)
      : answer.value;
  return `${value}${criterion.unit ? ` ${unitLabel(criterion.unit, locale)}` : ""}`;
}
function hasAnswerInformation(a, criterion) {
  return (
    answerState(a, criterion) !== "not_checked" ||
    present(answerNotes(a, criterion)) ||
    (simplifiedChecklist(criterion) &&
      characteristicAnswer(criterion) &&
      meaningful(a?.value, criterion.type)) ||
    [
      "notes",
      "source",
      "sourceUrl",
      "observedAt",
      "documentType",
      "documentReference",
    ].some((k) => present(a?.[k])) ||
    Object.values(a?.support || {}).some(present) ||
    (layoutAnswer(criterion) && typeof a?.hasLoft === "boolean") ||
    (a?.suitability && a.suitability !== "unassessed")
  );
}
function answerCell(snapshot, apartmentId, row, locale, omitMissing = false) {
  const a = findAnswer(snapshot, apartmentId, row.criterion.id, row.scenarioId);
  const lines =
    omitMissing &&
    (simplifiedChecklist(row.criterion)
      ? !characteristicAnswer(row.criterion) ||
        !meaningful(a?.value, row.criterion.type)
      : answerState(a, row.criterion) === "not_checked")
      ? []
      : [text(valueText(a, row.criterion, locale))];
  if (
    layoutAnswer(row.criterion) &&
    answerState(a, row.criterion) !== "not_applicable" &&
    typeof a?.hasLoft === "boolean"
  )
    lines.push(text(t(locale, a.hasLoft ? "hasLoft" : "noLoft")));
  if (a?.suitability && a.suitability !== "unassessed")
    lines.push(
      text(
        `${t(locale, a.suitability)}${a.settingsRevision !== snapshot.collection.revision ? ` · ${t(locale, "reviewNeeded")}` : ""}`,
      ),
    );
  for (const field of row.criterion.supportFields || []) {
    if (present(a?.support?.[field.id]))
      lines.push(
        text(
          `${textFor(field, locale)}: ${field.type === "boolean" ? t(locale, a.support[field.id] ? "applianceAvailable" : "applianceUnavailable") : a.support[field.id]}${field.unit ? ` ${unitLabel(field.unit, locale)}` : ""}`,
        ),
      );
  }
  for (const key of [
    "notes",
    "source",
    "observedAt",
    "documentType",
    "documentReference",
  ]) {
    const raw = key === "notes" ? answerNotes(a, row.criterion) : a?.[key];
    if (!present(raw)) continue;
    const value =
      key === "source" || key === "documentType"
        ? t(locale, a[key])
        : key === "observedAt"
          ? dateLabel(a[key], locale)
          : raw;
    lines.push(text(`${t(locale, key)}: ${value}`));
  }
  if (a?.sourceUrl) lines.push(linked(a.sourceUrl));
  return { stack: lines, margin: [0, 3, 0, 3] };
}
function rowLabel(row, locale) {
  return `${row.criterion.key} · ${textFor(row.criterion, locale)}${row.scenario ? `\n${row.scenario.person} · ${row.scenario.name}` : ""}`;
}
function costSummary(snapshot, apt, locale, omitMissing = false) {
  const c = apartmentCosts(snapshot, apt.id);
  const rows = [
    [
      t(locale, "monthlyHousing"),
      `${money(c.monthly, locale)} · ${t(locale, "rentPlusManagement")}`,
    ],
    [
      t(locale, "upfront"),
      `${money(c.upfront, locale)} · ${t(locale, !c.startDate ? "enterRentStart" : c.complete ? "completeTotal" : "knownCharges")}`,
    ],
    [
      t(locale, "total24"),
      `${money(c.expense, locale)} · ${t(locale, "manualEstimate")}`,
    ],
    [
      t(locale, "deposits"),
      `${money(c.deposits, locale)} · ${t(locale, "knownCharges")}`,
    ],
  ];
  if (!omitMissing) return rows;
  const knownCharges = [
    "H01",
    "H02",
    "H03",
    "H04",
    "H10",
    "F05",
    "F06",
    "G06",
  ].some((key) => {
    const criterion = snapshot.criteria.find((c) => c.key === key);
    return (
      criterion &&
      answerState(findAnswer(snapshot, apt.id, criterion.id), criterion) !==
        "not_checked"
    );
  });
  const deposit = snapshot.criteria.find((c) => c.key === "H03");
  return rows.filter((_, i) =>
    i === 0
      ? c.monthly != null
      : i === 1
        ? c.upfront != null && knownCharges
        : i === 2
          ? c.expense != null
          : deposit &&
            answerState(findAnswer(snapshot, apt.id, deposit.id), deposit) !==
              "not_checked",
  );
}
function travelResult(snapshot, apt, scenario) {
  return calculateTravel({
    scenario,
    journey: journeyFor(snapshot, apt.id, scenario),
    startDate: apt.rentStart || snapshot.collection.settings.moveInDate,
  });
}
function travelSummary(snapshot, apt, locale) {
  const scenarios = snapshot.scenarios.filter((s) => !s.archived);
  if (!scenarios.length) return [];
  return scenarios.flatMap((s) => {
    const j = journeyFor(snapshot, apt.id, s),
      result = travelResult(snapshot, apt, s);
    const values = [
      [t(locale, "origin"), s.origin],
      [t(locale, "destination"), s.destination],
      [t(locale, "returnDestination"), s.returnDestination],
      [
        t(locale, "frequency"),
        present(s.frequency)
          ? `${s.frequency} / ${t(locale, s.frequencyUnit)}`
          : null,
      ],
      [
        t(locale, "monthly"),
        !result.missing.length && result.monthly != null
          ? `${money(result.monthly, locale)} · ${t(locale, "completeTotal")}`
          : null,
      ],
      [
        t(locale, "total24"),
        !result.missing.length && result.total != null
          ? `${money(result.total, locale)} · ${t(locale, "completeTotal")}`
          : null,
      ],
      [
        t(locale, "net24"),
        !result.missing.length && result.net != null
          ? `${money(result.net, locale)} · ${t(locale, "completeTotal")}`
          : null,
      ],
      ...[
        "outboundRoute",
        "returnRoute",
        "outboundMinutes",
        "returnMinutes",
        "transfers",
        "reimbursed",
        "notes",
      ]
        .filter((k) => present(j[k]))
        .map((k) => [
          t(locale, k),
          k === "reimbursed" ? money(j[k], locale) : j[k],
        ]),
      [
        t(locale, "reimbursementConfirmed"),
        typeof j.reimbursementConfirmed === "boolean"
          ? t(locale, j.reimbursementConfirmed ? "yes" : "no")
          : null,
      ],
    ];
    const filled = values.filter(([, v]) => present(v));
    return filled.length
      ? [pairs(filled, `${t(locale, "travel")} · ${s.person} · ${s.name}`)]
      : [];
  });
}
function referenceRecords(snapshot, apt, locale) {
  const records = snapshot.records.filter(
    (r) =>
      r.apartmentId === apt.id &&
      !r.archived &&
      ["cost", "benefit", "payment", "adjustment"].includes(r.kind),
  );
  if (!records.length) return [];
  return [
    heading(t(locale, "pdfReferenceRecords")),
    ...records.flatMap((r) => {
      const detail = [
        [
          t(locale, "amount"),
          r.amountSource
            ? `${t(locale, "amountSource")}: ${
                textFor(
                  snapshot.criteria.find((c) => c.key === r.amountSource),
                  locale,
                ) || r.amountSource
              }`
            : resolveAmount(r) !== null
              ? money(resolveAmount(r).toNumber(), locale)
              : null,
        ],
        ...[
          "phase",
          "frequencyUnit",
          "treatment",
          "taxTreatment",
          "payer",
          "paymentType",
        ]
          .filter(
            (k) => present(r[k]) && r[k] !== "unknown" && r[k] !== "unassessed",
          )
          .map((k) => [t(locale, k), t(locale, r[k])]),
        ...["startDate", "endDate", "dueDate", "coverageDate", "paidAt"]
          .filter((k) => r[k])
          .map((k) => [t(locale, k), dateLabel(r[k], locale)]),
        ...["taxRate", "renewalMonths"]
          .filter((k) => present(r[k]))
          .map((k) => [t(locale, k), r[k]]),
        ...["full", "compatible"]
          .filter((k) => typeof r[k] === "boolean")
          .map((k) => [t(locale, k), t(locale, r[k] ? "yes" : "no")]),
        ...(r.costId
          ? [
              [
                t(locale, "costId"),
                snapshot.records.find((record) => record.id === r.costId)
                  ?.name ||
                  textFor(
                    snapshot.criteria.find((c) => c.key === r.costId),
                    locale,
                  ) ||
                  r.costId,
              ],
            ]
          : []),
        ...["payee", "evidence", "notes"]
          .filter((k) => r[k])
          .map((k) => [t(locale, k === "evidence" ? "costEvidence" : k), r[k]]),
        [
          t(locale, "confirmed"),
          typeof r.confirmed === "boolean"
            ? t(locale, r.confirmed ? "yes" : "no")
            : null,
        ],
      ];
      if (r.formula)
        detail.push([
          t(locale, "formula"),
          `${t(locale, r.formula.type)}${present(r.formula.factor) ? ` · ${r.formula.factor}` : ""}${present(r.formula.percent) ? ` · ${r.formula.percent}% (${(r.formula.bases || []).join(", ")})` : ""}`,
        ]);
      return [
        {
          text: `${r.name || t(locale, r.kind)} · ${t(locale, r.kind)}`,
          bold: true,
          margin: [0, 8, 0, 5],
        },
        pairs(detail.filter(([, v]) => present(v))),
      ];
    }),
  ];
}
function propertyContent(snapshot, apt, locale) {
  const metadata = [
    "status",
    "room",
    "address",
    "viewingAt",
    "rentStart",
    "handoverDate",
    "moveOutDate",
    "agentName",
    "agentEmail",
    "agentPhone",
    "quoteTotal",
    "advantages",
    "disadvantages",
    "rejectionReason",
  ];
  const overview = metadata
    .filter((key) => present(apt[key]))
    .map((key) => [
      t(locale, key),
      key === "quoteTotal"
        ? money(apt[key], locale)
        : key === "status"
          ? t(locale, apt[key])
          : ["viewingAt", "rentStart", "handoverDate", "moveOutDate"].includes(
                key,
              )
            ? dateLabel(apt[key], locale, key === "viewingAt")
            : apt[key],
    ]);
  const content = overview.length
    ? [pairs(overview, t(locale, "overview"))]
    : [];
  for (const url of [apt.mapUrl, ...(apt.listingUrls || [])].filter(Boolean))
    content.push(linked(url));
  const costs = costSummary(snapshot, apt, locale, true);
  if (costs.length) content.push(pairs(costs, t(locale, "costs")));
  content.push(...referenceRecords(snapshot, apt, locale));
  const travel = travelSummary(snapshot, apt, locale);
  if (travel.length) content.push(...travel);
  const rows = answerRows(snapshot).filter((row) =>
    hasAnswerInformation(
      findAnswer(snapshot, apt.id, row.criterion.id, row.scenarioId),
      row.criterion,
    ),
  );
  for (const section of snapshot.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)) {
    const sectionRows = rows.filter(
      (r) => r.criterion.sectionId === section.id,
    );
    if (!sectionRows.length) continue;
    content.push(
      table(
        [t(locale, "checklist"), t(locale, "answer")],
        sectionRows.map((r) => [
          text(rowLabel(r, locale)),
          answerCell(snapshot, apt.id, r, locale, true),
        ]),
        [160, "*"],
        `${section.key} · ${textFor(section, locale)}`,
      ),
    );
  }

  const questions = snapshot.records.filter(
    (r) => r.kind === "question" && r.apartmentId === apt.id && !r.archived,
  );
  if (questions.length) content.push(heading(t(locale, "questions")));
  for (const q of questions) {
    content.push(text(`${t(locale, q.status)} · ${q.text}`));
    const criterion = snapshot.criteria.find((c) => c.id === q.criterionId);
    if (criterion) content.push(text(textFor(criterion, locale)));
    for (const k of ["responsible", "resolution"])
      if (q[k]) content.push(text(`${t(locale, k)}: ${q[k]}`));
    if (q.sourceUrl) content.push(linked(q.sourceUrl));
  }

  const files = snapshot.records.filter(
    (r) => r.kind === "attachment" && r.apartmentId === apt.id && !r.archived,
  );
  if (files.length) content.push(heading(t(locale, "pdfFiles")));
  for (const f of files) {
    content.push(
      text(
        `${f.name}${f.mime ? ` · ${f.mime}` : ""}${f.size ? ` · ${(f.size / 1048576).toFixed(1)} MB` : ""}`,
      ),
    );
    const criterion = snapshot.criteria.find((c) => c.id === f.criterionId);
    if (criterion) content.push(text(textFor(criterion, locale)));
    if (f.storage === "link" && f.url) content.push(linked(f.url));
  }
  return content;
}
function filterLabels(snapshot, filters, locale) {
  const labels = [];
  if (filters.section)
    labels.push(
      `${t(locale, "section")}: ${textFor(
        snapshot.sections.find((s) => s.id === filters.section),
        locale,
      )}`,
    );
  if (filters.stage)
    labels.push(`${t(locale, "stages")}: ${t(locale, filters.stage)}`);
  for (const [key, label] of [
    ["required", "requirements"],
    ["unanswered", "unanswered"],
    ["questions", "unresolved"],
  ])
    if (filters[key]) labels.push(t(locale, label));
  return labels.length ? labels.join(" · ") : t(locale, "pdfNoFilters");
}
function comparisonContent(snapshot, apartments, filters, locale) {
  const ids = apartments.map((a) => a.id),
    rows = comparisonRows(snapshot, ids, filters);
  const headers = [
    t(locale, "checklist"),
    ...apartments.map((a) => {
      const c = completion(snapshot, a.id);
      return `${a.name}\n${c.answered}/${c.total} ${t(locale, "answered")}${c.journeysMissing ? `\n${t(locale, "journeysMissing")}` : ""}`;
    }),
  ];
  const widths = [160, ...apartments.map(() => "*")];
  const metrics = costSummary(snapshot, apartments[0], locale).map(
    ([label], i) => [
      text(label),
      ...apartments.map((a) => text(costSummary(snapshot, a, locale)[i][1])),
    ],
  );
  for (const s of snapshot.scenarios.filter((s) => !s.archived))
    metrics.push([
      text(
        `${s.person} · ${s.name}\n${s.frequency ?? t(locale, "unknown")} / ${t(locale, s.frequencyUnit)}`,
      ),
      ...apartments.map((a) => {
        const result = travelResult(snapshot, a, s);
        return text(
          `${money(result.monthly, locale)}\n${t(locale, result.missing.length ? "knownCharges" : "monthly")}`,
        );
      }),
    ]);
  const content = [
    text(
      `${t(locale, "pdfFilters")}: ${filterLabels(snapshot, filters, locale)}`,
    ),
    table(
      headers,
      metrics,
      widths,
      `${t(locale, "costs")} / ${t(locale, "travel")}`,
    ),
  ];
  for (const section of snapshot.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)) {
    const sectionRows = rows.filter(
      (r) => r.criterion.sectionId === section.id,
    );
    if (sectionRows.length)
      content.push(
        table(
          headers,
          sectionRows.map((r) => [
            text(rowLabel(r, locale)),
            ...apartments.map((a) => answerCell(snapshot, a.id, r, locale)),
          ]),
          widths,
          `${section.key} · ${textFor(section, locale)}`,
        ),
      );
  }
  if (!rows.length) content.push(text(t(locale, "noMatchingChecks")));
  return content;
}

/** Build a report from the captured workspace, without reading remote data. */
export function buildPdfReport({
  snapshot,
  apartmentIds,
  kind,
  filters = {},
  locale = "en",
  generatedAt = new Date().toISOString(),
  pending = 0,
  conflicts = false,
  online = true,
  uploads = [],
}) {
  const apartments = [...new Set(apartmentIds)]
    .map((id) => snapshot.apartments.find((a) => a.id === id))
    .filter(Boolean);
  if (
    !["property", "comparison"].includes(kind) ||
    (kind === "property"
      ? apartments.length !== 1
      : apartments.length < 2 || apartments.length > 4)
  )
    throw new Error("Invalid PDF selection");
  const title =
    kind === "property" ? apartments[0].name : t(locale, "comparisonReport");
  const c = kind === "property" ? completion(snapshot, apartments[0].id) : null;
  const content = [
    { text: title, style: "title" },
    text(snapshot.collection.name),
    text(
      `${t(locale, "exportedAt")}: ${dateLabel(generatedAt, locale, true)} · Asia/Tokyo`,
    ),
  ];
  if (c)
    content.push(text(`${c.answered}/${c.total} ${t(locale, "answered")}`));
  for (const key of [
    conflicts && "pdfConflict",
    !conflicts && pending > 0 && "pdfLocalDraft",
    !online && "pdfOffline",
  ].filter(Boolean))
    content.push({
      text: t(locale, key),
      color: "#80541c",
      margin: [0, 7, 0, 0],
    });
  content.push(
    ...(kind === "property"
      ? propertyContent(snapshot, apartments[0], locale)
      : comparisonContent(snapshot, apartments, filters, locale)),
  );
  if (kind === "property")
    for (const u of uploads.filter((u) => u.apartmentId === apartments[0].id))
      content.push(
        text(
          `${u.name} · ${t(locale, u.status === "failed" ? "retryNeeded" : "queued")}`,
        ),
      );
  const slug =
    (kind === "property"
      ? apartments[0].name
      : `comparison-${apartments.map((a) => a.name).join("-")}`
    )
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 120)
      .replace(/[. -]+$/g, "") || "property";
  return {
    filename: `house-checklist-${slug}-${generatedAt.slice(0, 10)}.pdf`,
    document: {
      pageSize: "A4",
      pageOrientation: kind === "property" ? "portrait" : "landscape",
      pageMargins: [36, 40, 36, 40],
      info: {
        title,
        subject: t(
          locale,
          kind === "property" ? "propertyReport" : "comparisonReport",
        ),
        creator: "House Checklist",
      },
      defaultStyle: { font: "NotoSansJP", fontSize: 9, color: "#242e31" },
      styles: {
        title: {
          fontSize: 20,
          bold: true,
          color: "#17675f",
          margin: [0, 0, 0, 8],
        },
        section: { fontSize: 12, bold: true, color: "#17675f" },
        tableHeader: { bold: true, fillColor: "#e6f1ed", margin: [0, 4, 0, 4] },
      },
      footer: (page, count) => ({
        text: `House Checklist · ${t(locale, "pdfPage")} ${page} / ${count}`,
        alignment: "center",
        fontSize: 8,
        color: "#667477",
        margin: [0, 12, 0, 0],
      }),
      pageBreakBefore: (node, container) =>
        node.style === "section" &&
        container
          .getFollowingNodesOnPage()
          .every((next) => next.style === "section"),
      content,
    },
  };
}
