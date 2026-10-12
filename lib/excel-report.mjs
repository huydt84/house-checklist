import writeExcelFile from "write-excel-file/universal";
import {
  answerState,
  answerNotes,
  characteristicAnswer,
  completion,
  findAnswer,
  layoutAnswer,
  meaningful,
  simplifiedChecklist,
  textFor,
} from "./domain.mjs";
import { comparisonRows, comparisonSummaryRows } from "./comparison.mjs";
import {
  dateLabel,
  t,
  unitLabel,
  exportTimestamp,
  checklistValueLabel,
} from "./i18n.mjs";

const present = (value) =>
  value !== null &&
  value !== undefined &&
  (typeof value !== "string" || Boolean(value.trim()));
const cell = (value, style = {}) => ({
  value,
  type:
    value instanceof Date ? Date : typeof value === "number" ? Number : String,
  format:
    value instanceof Date
      ? "yyyy-mm-dd"
      : typeof value === "number"
        ? Number.isInteger(value)
          ? "#,##0"
          : "#,##0.##########"
        : "@",
  align: typeof value === "number" ? "right" : "left",
  alignVertical: "top",
  indent: 1,
  wrap: true,
  ...style,
});
const currency = (value, locale) =>
  value == null
    ? cell(t(locale, "unknown"))
    : cell(value, { format: '"¥"#,##0' });
const dateValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
    ? date
    : value;
};

function textParts(value, width) {
  if (typeof value !== "string") return [{ value, lines: 1 }];
  const parts = [{ value: "", lines: 1 }];
  let column = 0;
  for (const char of value) {
    const size = char.codePointAt(0) > 255 ? 2 : 1;
    let part = parts.at(-1);
    if (char === "\n" || column + size > width) {
      part.lines++;
      column = 0;
    }
    if (part.lines > 20) {
      part = { value: "", lines: 1 };
      parts.push(part);
    }
    part.value += char;
    if (char !== "\n") column += size;
  }
  return parts;
}

function answerValue(answer, criterion, locale) {
  const state = answerState(answer, criterion);
  if (
    (simplifiedChecklist(criterion) && !characteristicAnswer(criterion)) ||
    !meaningful(answer?.value, criterion.type) ||
    (!simplifiedChecklist(criterion) && state !== "answered")
  )
    return t(locale, state);
  if (criterion.type === "boolean")
    return t(locale, answer.value ? "yes" : "no");
  if (criterion.type === "select")
    return [
      textFor(
        criterion.choices.find((c) => c.id === answer.value),
        locale,
      ) || answer.value,
      answer.value === "other" && answer.other,
      layoutAnswer(criterion) &&
        typeof answer.hasLoft === "boolean" &&
        t(locale, answer.hasLoft ? "hasLoft" : "noLoft"),
    ]
      .filter(Boolean)
      .join(" · ");
  if (criterion.type === "date")
    return answer.value.length === 7
      ? checklistValueLabel(answer.value, criterion, locale)
      : dateValue(answer.value);
  return answer.value;
}

function filterLabel(snapshot, filters, locale) {
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
  return labels.join("\n") || t(locale, "pdfNoFilters");
}

export async function createComparisonExcel({
  snapshot,
  apartmentIds,
  filters = {},
  locale = "en",
  generatedAt = new Date().toISOString(),
  pending = 0,
  conflicts = false,
  online = true,
}) {
  const apartments = [...new Set(apartmentIds)]
    .map((id) => snapshot.apartments.find((a) => a.id === id && !a.archived))
    .filter(Boolean);
  if (apartments.length < 2 || apartments.length > 4)
    throw new Error("Invalid Excel comparison selection");
  const data = [];
  const widths = [44, ...apartments.map(() => 36)];
  const append = (cells) => {
    const parts = cells.map((c, i) => textParts(c.value, widths[i] - 4));
    for (
      let index = 0;
      index < Math.max(...parts.map((p) => p.length));
      index++
    ) {
      const next = cells.map((c, i) =>
        parts[i][index] ? { ...c, value: parts[i][index].value } : null,
      );
      if (!next[0]) next[0] = cell(t(locale, "exportContinued"));
      next[0].height = Math.max(
        24,
        ...parts.map((p) => 16 * (p[index]?.lines || 1) + 8),
      );
      data.push(next);
    }
  };
  const row = (label, values) => append([cell(label), ...values]);
  const band = (label) =>
    append(
      [label, ...apartments.map(() => "")].map((value) =>
        cell(value, {
          backgroundColor: "#e6f1ed",
          fontWeight: "bold",
        }),
      ),
    );

  append([
    cell(t(locale, "comparisonReport"), { fontSize: 16, fontWeight: "bold" }),
  ]);
  append([cell(snapshot.collection.name)]);
  row(t(locale, "exportedAt"), [
    cell(`${dateLabel(generatedAt, locale, true)} · Asia/Tokyo`),
  ]);
  row(t(locale, "pdfFilters"), [cell(filterLabel(snapshot, filters, locale))]);
  for (const key of [
    conflicts && "pdfConflict",
    !conflicts && pending > 0 && "pdfLocalDraft",
    !online && "pdfOffline",
  ].filter(Boolean))
    append([cell(t(locale, key), { textColor: "#80541c" })]);
  append(
    [t(locale, "checklist"), ...apartments.map((a) => a.name)].map((value) =>
      cell(value, {
        fontWeight: "bold",
        backgroundColor: "#244d48",
        textColor: "#ffffff",
        align: "center",
        indent: 0,
      }),
    ),
  );
  const stickyRowsCount = data.length;
  row(
    t(locale, "answered"),
    apartments.map((a) => {
      const c = completion(snapshot, a.id);
      return cell(
        `${c.answered}/${c.total}${c.journeysMissing ? `\n${t(locale, "journeysMissing")}` : ""}`,
      );
    }),
  );

  const summaries = comparisonSummaryRows(
    snapshot,
    apartments.map((a) => a.id),
  );
  if (summaries.length) band(`${t(locale, "costs")} (JPY)`);
  for (const summary of summaries) {
    const label =
      summary.kind === "cost"
        ? t(locale, summary.label)
        : `${t(locale, "travel")} · ${summary.scenario.person} · ${summary.scenario.name}\n${summary.scenario.frequency} / ${t(locale, summary.scenario.frequencyUnit)} (JPY)`;
    row(
      label,
      summary.values.map((value) => currency(value, locale)),
    );
    row(
      `${label} · ${t(locale, "exportBasis")}`,
      summary.basis.map((basis) => cell(t(locale, basis))),
    );
  }

  const rows = comparisonRows(
    snapshot,
    apartments.map((a) => a.id),
    filters,
  );
  for (const s of snapshot.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)) {
    const items = rows.filter((r) => r.criterion.sectionId === s.id);
    if (!items.length) continue;
    band(`${s.key} · ${textFor(s, locale)}`);
    for (const { criterion: c, scenarioId, scenario } of items) {
      const answers = apartments.map((a) =>
        findAnswer(snapshot, a.id, c.id, scenarioId),
      );
      row(
        `${c.key} · ${textFor(c, locale)}${unitLabel(c.unit, locale) ? ` (${unitLabel(c.unit, locale)})` : ""}${scenario ? `\n${scenario.person} · ${scenario.name}` : ""}`,
        answers.map((a) =>
          cell(
            answerValue(a, c, locale),
            c.unit === "year" && typeof a?.value === "number"
              ? { format: "0" }
              : {},
          ),
        ),
      );
      const detail = (label, values) => {
        if (values.some(present))
          row(
            `  ${label}`,
            values.map((value) => cell(value ?? "")),
          );
      };
      for (const field of c.supportFields || [])
        detail(
          `${textFor(field, locale)}${field.unit ? ` (${unitLabel(field.unit, locale)})` : ""}`,
          answers.map((a) => {
            const v = a?.support?.[field.id];
            return typeof v === "boolean"
              ? t(locale, v ? "applianceAvailable" : "applianceUnavailable")
              : v;
          }),
        );
      detail(
        t(locale, "suitability"),
        answers.map((a) =>
          a?.suitability && a.suitability !== "unassessed"
            ? `${t(locale, a.suitability)}${a.settingsRevision !== snapshot.collection.revision ? ` · ${t(locale, "reviewNeeded")}` : ""}`
            : "",
        ),
      );
      detail(
        t(locale, "notes"),
        answers.map((a) => answerNotes(a, c)),
      );
    }
  }
  if (!rows.length) append([cell(t(locale, "noMatchingChecks"))]);

  const blob = await writeExcelFile(
    data,
    {
      sheet: t(locale, "compare"),
      columns: widths.map((width) => ({ width })),
      stickyRowsCount,
      stickyColumnsCount: 1,
      showGridLines: false,
      orientation: "landscape",
    },
    { fontFamily: "Arial", fontSize: 11 },
  ).toBlob();
  const slug =
    snapshot.collection.name
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80)
      .replace(/[. -]+$/g, "") || "collection";
  return {
    blob,
    filename: `house-checklist-comparison-${slug}-${exportTimestamp(generatedAt)}.xlsx`,
  };
}
