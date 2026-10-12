import { ensure } from "./errors.mjs";
import { DateTime } from "luxon";
import { checklistValueLabel } from "./i18n.mjs";
export const STATUSES = ["considering", "disqualified", "shortlisted"];
// Cached workspaces can still contain records from before the status migration.
export function apartmentState(apartment) {
  const legacy = {
    contacted: "considering",
    viewing_scheduled: "considering",
    viewed: "considering",
    applied: "shortlisted",
    selected: "shortlisted",
    rejected: "disqualified",
    unavailable: "disqualified",
  };
  return {
    ...apartment,
    status: legacy[apartment.status] || apartment.status || "considering",
    viewed: apartment.viewed ?? apartment.status === "viewed",
    archived: apartment.archived ?? false,
  };
}
export const STAGES = ["L", "A", "V", "S"];
export function orderedApartments(snapshot) {
  const positions = new Map(
    (snapshot.collection.apartmentOrder || []).map((id, i) => [id, i]),
  );
  return [...snapshot.apartments].sort(
    (a, b) =>
      (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity) ||
      (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) ||
      a.id.localeCompare(b.id),
  );
}
export const IMPORTANCE = ["information", "preference", "requirement"];
export const SOURCES = [
  "listing",
  "agent",
  "observation",
  "document",
  "estimate",
];
export function textFor(record, locale, field = "labels") {
  return (
    record?.[field]?.[locale] ??
    record?.[field]?.[record.sourceLocale || "en"] ??
    record?.[field]?.en ??
    ""
  );
}
export function meaningful(value, type) {
  if (type === "date") return validCalendarDate(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number")
    return typeof value === "number" && Number.isFinite(value);
  if (type === "text" || type === "select")
    return typeof value === "string" && Boolean(value.trim());
  return false;
}
export function validCalendarDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value) &&
    DateTime.fromISO(value.length === 7 ? `${value}-01` : value).isValid
  );
}
export function simplifiedChecklist(criterion) {
  return ["D", "E"].includes(criterion.section);
}
export function layoutAnswer(criterion) {
  return (
    criterion.type === "select" &&
    (criterion.sourceKey || criterion.key) === "A03"
  );
}
export function characteristicAnswer(criterion) {
  return (
    !simplifiedChecklist(criterion) ||
    ["number", "select"].includes(criterion.type)
  );
}
export function answerNotes(answer, criterion) {
  const legacy =
    simplifiedChecklist(criterion) && criterion.type === "text"
      ? answer?.value
      : null;
  if (!legacy?.trim()) return answer?.notes || "";
  return [
    ...new Set(
      [legacy, answer?.notes].filter((v) => typeof v === "string" && v.trim()),
    ),
  ].join("\n\n");
}
export function answerState(answer, criterion) {
  if (!simplifiedChecklist(criterion) && answer?.state === "not_applicable")
    return "not_applicable";
  // An assessment completes the check; its supporting facts remain optional.
  if (["meets", "unmet"].includes(answer?.suitability)) return "answered";
  if (simplifiedChecklist(criterion)) return "not_checked";
  return answer?.state === "answered" &&
    meaningful(answer.value, criterion.type)
    ? "answered"
    : "not_checked";
}
export function normalizeAnswer(input, criterion, previous, settingsRevision) {
  const simplified = simplifiedChecklist(criterion);
  ensure(
    ["not_checked", "answered", "not_applicable"].includes(input.state),
    "INVALID_ANSWER",
  );
  const answer = {
    state: input.state,
    value: input.value ?? null,
    notes: String(input.notes || "").slice(0, 20000),
    source: input.source || "",
    sourceUrl: input.sourceUrl || "",
    observedAt: input.observedAt || "",
    documentType: input.documentType || "",
    documentReference: input.documentReference || "",
    other: input.other || "",
    support: input.support || {},
    suitability: input.suitability || "unassessed",
    settingsRevision,
  };
  if (layoutAnswer(criterion) && input.hasLoft != null) {
    ensure(typeof input.hasLoft === "boolean", "INVALID_ANSWER");
    answer.hasLoft = input.hasLoft;
  }
  ensure(!answer.source || SOURCES.includes(answer.source), "INVALID_SOURCE");
  ensure(
    ["unassessed", "meets", "unmet"].includes(answer.suitability),
    "INVALID_SUITABILITY",
  );
  if (answer.sourceUrl) validateUrl(answer.sourceUrl);
  ensure(
    !answer.observedAt || /^\d{4}-\d{2}-\d{2}$/.test(answer.observedAt),
    "INVALID_DATE",
  );
  if (answer.documentType === "contract")
    ensure(
      answer.source === "document" &&
        Boolean(answer.documentReference.trim() || answer.sourceUrl),
      "CONTRACT_REFERENCE_REQUIRED",
    );
  if (answer.state === "answered" || simplified) {
    if (answer.value != null && answer.value !== "")
      ensure(
        typeof answer.value ===
          {
            boolean: "boolean",
            number: "number",
            text: "string",
            date: "string",
            select: "string",
          }[criterion.type] &&
          (criterion.type !== "number" || Number.isFinite(answer.value)),
        "INVALID_ANSWER",
      );
    if (
      criterion.type === "date" &&
      answer.value != null &&
      answer.value !== ""
    )
      ensure(validCalendarDate(answer.value), "INVALID_DATE");
    if (!meaningful(answer.value, criterion.type) && !simplified)
      answer.state = "not_checked";
    else if (criterion.type === "select")
      ensure(
        (simplified && !meaningful(answer.value, criterion.type)) ||
          criterion.choices.some(
            (c) =>
              c.id === answer.value && (!c.retired || previous?.value === c.id),
          ),
        "INVALID_CHOICE",
      );
    if (criterion.type === "number" && meaningful(answer.value, criterion.type))
      ensure(
        answer.value >= 0 &&
          (!/^JPY(?:\/(?:month|year|week|day|trip))?$/.test(
            criterion.unit || "",
          ) ||
            Number.isInteger(answer.value)),
        "INVALID_AMOUNT",
      );
    if (criterion.unit === "year" && meaningful(answer.value, "number"))
      ensure(
        Number.isInteger(answer.value) &&
          answer.value >= 1000 &&
          answer.value <= 9999,
        "INVALID_YEAR",
      );
  }
  if (!simplified && answer.state !== "answered") answer.value = null;
  for (const [key, value] of Object.entries(answer.support)) {
    const field = criterion.supportFields?.find((f) => f.id === key);
    ensure(field, "INVALID_SUPPORT_FIELD");
    ensure(
      value == null ||
        value === "" ||
        (field.type === "number"
          ? typeof value === "number" && Number.isFinite(value) && value >= 0
          : field.type === "boolean"
            ? typeof value === "boolean"
            : typeof value === "string"),
      "INVALID_SUPPORT_VALUE",
    );
  }
  if (simplified) answer.state = answerState(answer, criterion);
  return answer;
}
export function validateUrl(value) {
  try {
    ensure(
      ["http:", "https:"].includes(new URL(value).protocol),
      "INVALID_URL",
    );
  } catch {
    ensure(false, "INVALID_URL");
  }
  return value;
}
export function activeCriteria(snapshot) {
  const sections = new Map(snapshot.sections.map((s) => [s.id, s]));
  return snapshot.criteria
    .filter((c) => !c.archived && sections.get(c.sectionId)?.enabled)
    .map((c) => ({
      ...c,
      section: sections.get(c.sectionId)?.key || c.section,
    }))
    .sort(
      (a, b) =>
        (sections.get(a.sectionId)?.order || 0) -
          (sections.get(b.sectionId)?.order || 0) || a.order - b.order,
    );
}
export function scenarioApplies(criterion, scenario) {
  if (scenario.archived) return false;
  if (criterion.sourceKey === "B03") return scenario.purpose === "work";
  if (criterion.sourceKey === "B08") return scenario.purpose === "partner_home";
  if (criterion.sourceKey === "B09") return scenario.purpose === "partner_work";
  if (criterion.sourceKey === "B10")
    return ["partner_home", "partner_work"].includes(scenario.purpose);
  return true;
}
export function answerRows(snapshot) {
  return activeCriteria(snapshot).flatMap((criterion) =>
    criterion.scope === "journey"
      ? snapshot.scenarios
          .filter((s) => scenarioApplies(criterion, s))
          .map((scenario) => ({ criterion, scenarioId: scenario.id, scenario }))
      : [{ criterion, scenarioId: null }],
  );
}
export function findAnswer(
  snapshot,
  apartmentId,
  criterionId,
  scenarioId = null,
) {
  return snapshot.answers.find(
    (a) =>
      a.apartmentId === apartmentId &&
      a.criterionId === criterionId &&
      (a.scenarioId || null) === scenarioId,
  );
}
export function fieldAnswer(snapshot, apartmentId, key) {
  const c = snapshot.criteria.find((c) => c.key === key);
  return c ? findAnswer(snapshot, apartmentId, c.id) : undefined;
}
export function fieldValue(snapshot, apartmentId, key) {
  const a = fieldAnswer(snapshot, apartmentId, key);
  return a?.state === "answered" ? a.value : null;
}
export function completion(snapshot, apartmentId) {
  let answered = 0,
    total = 0,
    requirements = 0;
  for (const { criterion, scenarioId } of answerRows(snapshot)) {
    const a = findAnswer(snapshot, apartmentId, criterion.id, scenarioId);
    const state = answerState(a, criterion);
    if (state === "not_applicable") continue;
    total++;
    if (state === "answered") answered++;
    if (
      criterion.importance === "requirement" &&
      (state !== "answered" ||
        a.suitability !== "meets" ||
        a.settingsRevision !== snapshot.collection.revision)
    )
      requirements++;
  }
  return {
    answered,
    total,
    requirements,
    percent: total ? Math.round((answered / total) * 100) : null,
    journeysMissing: !snapshot.scenarios.some((s) => !s.archived),
  };
}
export function formatValue(answer, criterion, locale = "en") {
  const state = answerState(answer, criterion);
  if (simplifiedChecklist(criterion) && !characteristicAnswer(criterion))
    return state;
  if (
    !meaningful(answer?.value, criterion.type) ||
    (!simplifiedChecklist(criterion) && state !== "answered")
  )
    return state;
  if (criterion.type === "boolean") return answer.value ? "yes" : "no";
  if (criterion.type === "select")
    return (
      textFor(
        criterion.choices.find((c) => c.id === answer.value),
        locale,
      ) || answer.value
    );
  return checklistValueLabel(answer.value, criterion, locale);
}
export function emptySnapshot() {
  return {
    collection: null,
    role: null,
    sections: [],
    criteria: [],
    apartments: [],
    answers: [],
    records: [],
    scenarios: [],
    members: [],
    invitations: [],
  };
}

export function journeyFor(snapshot, apartmentId, scenario) {
  const record =
    snapshot.records.find(
      (r) =>
        r.kind === "journey" &&
        r.apartmentId === apartmentId &&
        r.scenarioId === scenario.id &&
        !r.archived,
    ) || {};
  const value = (key) => {
    const c = snapshot.criteria.find((c) => c.key === key);
    const a = c && findAnswer(snapshot, apartmentId, c.id, scenario.id);
    return a?.state === "answered" ? a.value : null;
  };
  return {
    ...record,
    outboundFare: value("B07.one_way"),
    returnFare: value("B07.return"),
    outboundMinutes:
      scenario.purpose === "work" ? value("B03") : record.outboundMinutes,
    transfers: value("B04"),
    outboundRoute:
      scenario.purpose === "partner_home"
        ? value("B08")
        : scenario.purpose === "partner_work"
          ? value("B09")
          : record.outboundRoute,
    returnRoute: ["partner_home", "partner_work"].includes(scenario.purpose)
      ? value("B10")
      : record.returnRoute,
    taxiFare: record.includeTaxi ? value("B11") : 0,
    bookingSurcharge: 0,
  };
}
