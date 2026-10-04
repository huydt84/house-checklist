"use client";
import { MagnifyingGlass, X, ArrowRight } from "@phosphor-icons/react";
import { useHouse } from "./context";
import { Button, Empty } from "./ui";
import { RouteLink, updateLocation } from "./navigation";
import AnswerControl from "./AnswerControl";
import { activeCriteria, answerRows, textFor } from "../lib/domain.mjs";
import { LOCALES, t } from "../lib/i18n.mjs";

const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("đ", "d");
const translations = (record, field = "labels") =>
  Object.values(record?.[field] || {});

export function CriteriaSearchField({ query, onChange }) {
  const { locale } = useHouse();
  return (
    <div className="property-criteria-search">
      <label className="field-label" htmlFor="property-criteria-query">
        {t(locale, "searchCriteria")}
      </label>
      <div className="search-field">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <input
          id="property-criteria-query"
          type="search"
          value={query}
          placeholder={t(locale, "searchCriteriaPlaceholder")}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onChange("");
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="criteria-search-clear"
            aria-label={t(locale, "clearSearch")}
            onClick={() => {
              onChange("");
              document.getElementById("property-criteria-query")?.focus();
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export function CriteriaSearchResults({ apartmentId, query, onClear }) {
  const { locale, snapshot, editable } = useHouse();
  const terms = normalize(query).trim().split(/\s+/);
  const matches = (...values) => {
    const haystack = normalize(values.filter(Boolean).join(" "));
    return terms.every((term) => haystack.includes(term));
  };
  const sections = new Map(snapshot.sections.map((s) => [s.id, s]));
  const matchCriterion = (criterion, scenario) =>
    matches(
      criterion.key,
      criterion.sourceKey,
      ...translations(criterion),
      ...translations(criterion, "guidance"),
      ...(criterion.supportFields || []).flatMap((f) => translations(f)),
      ...translations(sections.get(criterion.sectionId)),
      scenario?.name,
      scenario?.person,
      scenario?.origin,
      scenario?.destination,
      scenario?.returnDestination,
    );
  const rows = answerRows(snapshot).filter(({ criterion, scenario }) =>
    matchCriterion(criterion, scenario),
  );
  const records = snapshot.records.filter(
    (r) =>
      r.apartmentId === apartmentId &&
      !r.archived &&
      ["cost", "payment", "adjustment"].includes(r.kind) &&
      matches(
        r.name,
        r.notes,
        ...LOCALES.map((language) => t(language, "costs")),
      ),
  );
  const groups = { viewing: [], costs: [], travel: [] };
  for (const row of rows) {
    const c = row.criterion;
    const group =
      c.scope === "journey"
        ? "travel"
        : c.section === "H" || /^JPY(?:\/|$)/.test(c.unit || "")
          ? "costs"
          : "viewing";
    groups[group].push(row);
  }
  const missingJourney =
    !snapshot.scenarios.some((s) => !s.archived) &&
    activeCriteria(snapshot).some(
      (c) => c.scope === "journey" && matchCriterion(c),
    );
  const count = rows.length + records.length;
  return (
    <div className="criteria-search-results">
      <div className="section-heading">
        <h2 id="criteria-search-heading">{t(locale, "searchResults")}</h2>
        <span className="muted" role="status">
          {count} {t(locale, count === 1 ? "result" : "results")}
        </span>
      </div>
      {!count && !missingJourney && (
        <Empty
          title={t(locale, "noMatchingChecks")}
          description={t(locale, "searchCriteriaHelp")}
        />
      )}
      {Object.entries(groups).map(([group, matches]) =>
        matches.length || (group === "costs" && records.length) ? (
          <section
            className="criteria-search-group"
            key={group}
            aria-labelledby={`search-group-${group}`}
          >
            <h3 id={`search-group-${group}`}>{t(locale, group)}</h3>
            {matches.map(({ criterion, scenarioId, scenario }) => (
              <div
                className="criteria-search-match"
                key={`${criterion.id}:${scenarioId || ""}`}
              >
                <p className="muted criteria-search-context">
                  {textFor(sections.get(criterion.sectionId), locale)}
                  {scenario && ` · ${scenario.person} · ${scenario.name}`}
                </p>
                <AnswerControl
                  apartmentId={apartmentId}
                  criterion={criterion}
                  scenarioId={scenarioId}
                />
              </div>
            ))}
            {group === "costs" &&
              records.map((record) => (
                <RouteLink
                  className="criteria-search-record"
                  key={record.id}
                  patch={{ tab: "costs" }}
                  onNavigate={onClear}
                >
                  <span>
                    <strong>
                      {record.name ||
                        t(
                          locale,
                          record.kind === "payment"
                            ? "addPayment"
                            : record.kind === "adjustment"
                              ? "addAdjustment"
                              : "costs",
                        )}
                    </strong>
                    <span className="muted">{record.notes}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </RouteLink>
              ))}
          </section>
        ) : null,
      )}
      {missingJourney && (
        <Empty
          title={t(locale, "journeysMissing")}
          description={t(locale, "noScenariosText")}
        >
          <Button
            disabled={!editable}
            onClick={() => {
              updateLocation({ tab: "travel", scenarioEditor: "new" });
              onClear();
            }}
          >
            {t(locale, "newScenario")}
          </Button>
        </Empty>
      )}
    </div>
  );
}
