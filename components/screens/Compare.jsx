"use client";
import { RouteLink, useRouteState } from "../navigation";
import { Columns, SlidersHorizontal } from "@phosphor-icons/react";
import { useHouse, PageTitle } from "../context";
import { Button, SelectField, Toggle, Empty, Chip } from "../ui";
import { t, money } from "../../lib/i18n.mjs";
import {
  findAnswer,
  textFor,
  completion,
  answerNotes,
} from "../../lib/domain.mjs";
import { apartmentCosts, calculateTravel } from "../../lib/calculations.mjs";
import { journeyFor } from "../../lib/domain.mjs";
import PdfExport from "../PdfExport";
import { comparisonRows } from "../../lib/comparison.mjs";
import { Value } from "../AnswerControl";
export default function Compare() {
  const {
    locale,
    snapshot,
    selected,
    toggleCompare,
    navigate,
    navigationPatch,
  } = useHouse();
  const [section, setSection] = useRouteState("compareSection"),
    [stage, setStage] = useRouteState("compareStage"),
    [required, setRequired] = useRouteState("compareRequired", false),
    [unanswered, setUnanswered] = useRouteState("compareUnanswered", false),
    [questions, setQuestions] = useRouteState("compareQuestions", false),
    [pairValue, setPairValue] = useRouteState("pair");
  const pairIds = pairValue.split(",");
  const apartments = selected
    .map((id) => snapshot.apartments.find((a) => a.id === id))
    .filter(Boolean);
  const firstId = apartments.some((a) => a.id === pairIds[0])
    ? pairIds[0]
    : apartments[0]?.id;
  const secondId = apartments.some(
    (a) => a.id === pairIds[1] && a.id !== firstId,
  )
    ? pairIds[1]
    : apartments.find((a) => a.id !== firstId)?.id;
  const pair = [firstId, secondId].map((id) =>
    apartments.findIndex((a) => a.id === id),
  );
  const costValue = (apartment, label, value) =>
    value != null ? (
      <strong>{money(value, locale)}</strong>
    ) : (
      <div className="missing-cost">
        <strong>{t(locale, "costNotEntered")}</strong>
        <small>
          {t(
            locale,
            label === "monthlyHousing"
              ? "rentPlusManagement"
              : label === "total24"
                ? "enterExpenseEstimate"
                : "enterRentStart",
          )}
        </small>
        <RouteLink
          className="text-button"
          patch={navigationPatch("apartments", apartment.id, { tab: "costs" })}
        >
          {t(locale, "viewCosts")}
        </RouteLink>
      </div>
    );
  const costsById = new Map(
    apartments.map((a) => [a.id, apartmentCosts(snapshot, a.id)]),
  );
  const filters = { section, stage, required, unanswered, questions };
  const rows = comparisonRows(
    snapshot,
    apartments.map((a) => a.id),
    filters,
  );
  const aptOptions = snapshot.apartments.filter((a) => !a.archived);
  const metrics = [
    ["monthlyHousing", (c) => c.monthly],
    ["upfront", (c) => c.upfront],
    ["total24", (c) => c.expense],
    ["deposits", (c) => c.deposits],
  ];
  const cell = (apt, row) => {
    const a = findAnswer(snapshot, apt.id, row.criterion.id, row.scenarioId);
    return (
      <>
        <Value answer={a} criterion={row.criterion} locale={locale} />
        {row.criterion.supportFields
          ?.filter(
            (field) =>
              field.type === "boolean" &&
              typeof a?.support?.[field.id] === "boolean",
          )
          .map((field) => (
            <small key={field.id}>
              {textFor(field, locale)}:{" "}
              {t(
                locale,
                a.support[field.id]
                  ? "applianceAvailable"
                  : "applianceUnavailable",
              )}
            </small>
          ))}
        {a?.suitability && a.suitability !== "unassessed" && (
          <small className="suitability-tag">
            {t(locale, a.suitability)}
            {a.settingsRevision !== snapshot.collection.revision &&
              ` · ${t(locale, "reviewNeeded")}`}
          </small>
        )}
        {answerNotes(a, row.criterion) && (
          <p className="comparison-note">{answerNotes(a, row.criterion)}</p>
        )}
      </>
    );
  };
  return (
    <>
      <PageTitle
        title={t(locale, "compare")}
        description={t(locale, "compareHelp")}
      >
        <PdfExport
          kind="comparison"
          apartmentIds={apartments.map((a) => a.id)}
          filters={filters}
          disabled={apartments.length < 2}
        />
      </PageTitle>
      <div className="compare-picker">
        {aptOptions.map((a) => (
          <Toggle
            key={a.id}
            label={a.name}
            checked={selected.includes(a.id)}
            disabled={!selected.includes(a.id) && selected.length === 4}
            onChange={() => toggleCompare(a.id)}
          />
        ))}
      </div>
      {apartments.length < 2 ? (
        <Empty
          title={t(locale, "emptyCompare")}
          description={t(locale, "emptyCompareText")}
          icon={<Columns size={44} />}
        >
          <Button onClick={() => navigate("apartments")}>
            {t(locale, "apartments")}
          </Button>
        </Empty>
      ) : (
        <>
          <div className="compare-filters">
            <SelectField
              label={t(locale, "section")}
              value={section}
              onChange={setSection}
              options={[
                { value: "", label: t(locale, "allSections") },
                ...snapshot.sections
                  .filter((s) => s.enabled)
                  .map((s) => ({ value: s.id, label: textFor(s, locale) })),
              ]}
            />
            <SelectField
              label={t(locale, "stages")}
              value={stage}
              onChange={setStage}
              options={[
                { value: "", label: t(locale, "allStages") },
                ...["L", "A", "V", "S"].map((value) => ({
                  value,
                  label: t(locale, value),
                })),
              ]}
            />
            <Toggle
              label={t(locale, "requirements")}
              checked={required}
              onChange={setRequired}
            />
            <Toggle
              label={t(locale, "unanswered")}
              checked={unanswered}
              onChange={setUnanswered}
            />
            <Toggle
              label={t(locale, "unresolved")}
              checked={questions}
              onChange={setQuestions}
            />
          </div>
          <div className="desktop-compare">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col">{t(locale, "checklist")}</th>
                  {apartments.map((a) => {
                    const c = completion(snapshot, a.id);
                    return (
                      <th scope="col" key={a.id}>
                        <RouteLink patch={navigationPatch("apartments", a.id)}>
                          {a.name}
                        </RouteLink>
                        <small>
                          {c.answered}/{c.total} {t(locale, "answered")}
                        </small>
                        {c.journeysMissing && (
                          <small>{t(locale, "journeysMissing")}</small>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="comparison-section">
                  <th colSpan={apartments.length + 1}>
                    {t(locale, "costs")} · {t(locale, "knownCharges")}
                  </th>
                </tr>
                {metrics.map(([label, fn]) => (
                  <tr key={label}>
                    <th scope="row">{t(locale, label)}</th>
                    {apartments.map((a) => (
                      <td key={a.id}>
                        {costValue(a, label, fn(costsById.get(a.id)))}
                      </td>
                    ))}
                  </tr>
                ))}
                {snapshot.scenarios
                  .filter((s) => !s.archived)
                  .map((s) => (
                    <tr key={s.id}>
                      <th scope="row">
                        {s.person} · {s.name}
                        <small>
                          {s.frequency ?? "—"} / {t(locale, s.frequencyUnit)}
                        </small>
                      </th>
                      {apartments.map((a) => {
                        const result = calculateTravel({
                          scenario: s,
                          journey: journeyFor(snapshot, a.id, s),
                          startDate:
                            a.rentStart ||
                            snapshot.collection.settings.moveInDate,
                        });
                        return (
                          <td key={a.id}>
                            {money(result.monthly, locale)}
                            <small>
                              {t(
                                locale,
                                result.missing.length
                                  ? "knownCharges"
                                  : "monthly",
                              )}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                <tr className="comparison-section">
                  <th colSpan={apartments.length + 1}>
                    {t(locale, "checklist")}
                  </th>
                </tr>
                {rows.map((row) => (
                  <tr key={`${row.criterion.id}:${row.scenarioId}`}>
                    <th scope="row">
                      {textFor(row.criterion, locale)}
                      {row.scenario && (
                        <small>
                          {row.scenario.person} · {row.scenario.name}
                        </small>
                      )}
                    </th>
                    {apartments.map((a) => (
                      <td key={a.id}>{cell(a, row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-compare">
            <div className="pair-picker">
              {[0, 1].map((index) => (
                <div key={index}>
                  <SelectField
                    label={`${t(locale, "apartments")} ${index + 1}`}
                    value={apartments[pair[index]]?.id || ""}
                    onChange={(value) => {
                      const next = [firstId, secondId];
                      if (next[1 - index] === value)
                        next[1 - index] = next[index];
                      next[index] = value;
                      setPairValue(next.join(","));
                    }}
                    options={apartments.map((a) => ({
                      value: a.id,
                      label: a.name,
                    }))}
                  />
                  <RouteLink
                    className="text-button"
                    patch={navigationPatch(
                      "apartments",
                      apartments[pair[index]]?.id,
                    )}
                  >
                    {apartments[pair[index]]?.name}
                  </RouteLink>
                </div>
              ))}
            </div>
            {metrics.map(([label, fn]) => (
              <article className="mobile-comparison-row" key={label}>
                <h3>
                  {t(locale, label)}{" "}
                  <small>
                    {t(
                      locale,
                      label === "total24"
                        ? "manualEstimate"
                        : label === "monthlyHousing"
                          ? "rentPlusManagement"
                          : "knownCharges",
                    )}
                  </small>
                </h3>
                {pair.map((idx, i) => {
                  const apt = apartments[Math.min(idx, apartments.length - 1)];
                  return (
                    <div key={i}>
                      <span>{apt.name}</span>
                      {costValue(apt, label, fn(costsById.get(apt.id)))}
                    </div>
                  );
                })}
              </article>
            ))}
            {snapshot.scenarios
              .filter((s) => !s.archived)
              .map((scenario) => (
                <article
                  className="mobile-comparison-row"
                  key={`travel-${scenario.id}`}
                >
                  <h3>
                    {scenario.person} · {scenario.name}
                    <small>
                      {t(locale, "travel")} · {t(locale, "monthly")}
                    </small>
                  </h3>
                  {pair.map((idx, i) => {
                    const apt = apartments[idx];
                    const result = calculateTravel({
                      scenario,
                      journey: journeyFor(snapshot, apt.id, scenario),
                      startDate:
                        apt.rentStart ||
                        snapshot.collection.settings.moveInDate,
                    });
                    return (
                      <div key={i}>
                        <span>{apt.name}</span>
                        <strong>{money(result.monthly, locale)}</strong>
                        <small>
                          {t(
                            locale,
                            result.missing.length ? "knownCharges" : "monthly",
                          )}
                        </small>
                      </div>
                    );
                  })}
                </article>
              ))}
            {rows.map((row) => (
              <article
                className="mobile-comparison-row"
                key={`${row.criterion.id}:${row.scenarioId}`}
              >
                <h3>
                  {textFor(row.criterion, locale)}
                  {row.scenario && (
                    <small>
                      {row.scenario.person} · {row.scenario.name}
                    </small>
                  )}
                </h3>
                {pair.map((idx, i) => {
                  const apt = apartments[Math.min(idx, apartments.length - 1)];
                  return (
                    <div key={i}>
                      <span>{apt.name}</span>
                      <div>{cell(apt, row)}</div>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
          {!rows.length && (
            <p className="empty-filter">{t(locale, "noMatchingChecks")}</p>
          )}
        </>
      )}
    </>
  );
}
