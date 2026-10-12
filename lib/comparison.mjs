import {
  answerRows,
  answerState,
  characteristicAnswer,
  fieldAnswer,
  findAnswer,
  journeyFor,
  meaningful,
  simplifiedChecklist,
} from "./domain.mjs";
import { apartmentCosts, calculateTravel } from "./calculations.mjs";

export function comparisonSummaryRows(snapshot, apartmentIds) {
  const apartments = apartmentIds
    .map((id) => snapshot.apartments.find((a) => a.id === id))
    .filter(Boolean);
  const costs = apartments.map((apartment) => {
    const result = apartmentCosts(snapshot, apartment.id);
    const knownCharges =
      ["H01", "H02", "H03", "H04", "H10", "F05", "F06", "G06"].some((key) => {
        const answer = fieldAnswer(snapshot, apartment.id, key);
        return (
          answer?.state === "not_applicable" ||
          (answer?.state === "answered" && meaningful(answer.value, "number"))
        );
      }) ||
      meaningful(
        fieldAnswer(snapshot, apartment.id, "G06")?.support?.station,
        "number",
      );
    const deposit = fieldAnswer(snapshot, apartment.id, "H03");
    return {
      ...result,
      upfront: knownCharges ? result.upfront : null,
      deposits:
        deposit?.state === "not_applicable"
          ? 0
          : deposit?.state === "answered" && meaningful(deposit.value, "number")
            ? deposit.value
            : null,
    };
  });
  const rows = [
    ["monthlyHousing", "monthly", () => "rentPlusManagement"],
    [
      "upfront",
      "upfront",
      (c) =>
        !c.startDate
          ? "enterRentStart"
          : c.complete
            ? "completeTotal"
            : "knownCharges",
    ],
    ["total24", "expense", () => "manualEstimate"],
    ["deposits", "deposits", () => "knownCharges"],
  ].map(([label, field, basis]) => ({
    kind: "cost",
    label,
    values: costs.map((c) => c[field]),
    basis: costs.map(basis),
  }));
  for (const scenario of snapshot.scenarios.filter((s) => !s.archived)) {
    const results = apartments.map((apartment) => {
      const journey = journeyFor(snapshot, apartment.id, scenario);
      const result = calculateTravel({
        scenario,
        journey,
        startDate:
          apartment.rentStart || snapshot.collection.settings.moveInDate,
      });
      const knownFare =
        meaningful(journey.outboundFare, "number") ||
        meaningful(journey.returnFare, "number") ||
        (journey.includeTaxi && meaningful(journey.taxiFare, "number"));
      return { ...result, monthly: knownFare ? result.monthly : null };
    });
    rows.push({
      kind: "journey",
      scenario,
      values: results.map((r) => r.monthly),
      basis: results.map((r) =>
        r.missing.length ? "knownCharges" : "monthly",
      ),
    });
  }
  return rows.filter((row) => row.values.some((value) => value != null));
}

export function comparisonRows(snapshot, apartmentIds, filters = {}) {
  const {
    section = "",
    stage = "",
    required = false,
    unanswered = false,
    questions = false,
  } = filters;
  return answerRows(snapshot).filter(
    ({ criterion: c, scenarioId }) =>
      apartmentIds.some((id) => {
        const answer = findAnswer(snapshot, id, c.id, scenarioId);
        const state = answerState(answer, c);
        if (characteristicAnswer(c) && c.type === "boolean")
          return state === "answered" && answer?.value === true;
        return (
          state !== "not_checked" ||
          (simplifiedChecklist(c) &&
            characteristicAnswer(c) &&
            meaningful(answer?.value, c.type))
        );
      }) &&
      (!section || c.sectionId === section) &&
      (!stage || c.stages.includes(stage)) &&
      (!required || c.importance === "requirement") &&
      (!unanswered ||
        apartmentIds.some(
          (id) =>
            answerState(findAnswer(snapshot, id, c.id, scenarioId), c) ===
            "not_checked",
        )) &&
      (!questions ||
        snapshot.records.some(
          (r) =>
            r.kind === "question" &&
            r.status === "open" &&
            r.criterionId === c.id &&
            apartmentIds.includes(r.apartmentId) &&
            !r.archived,
        )),
  );
}
