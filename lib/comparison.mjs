import { answerRows, answerState, findAnswer } from "./domain.mjs";

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
