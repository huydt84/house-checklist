"use client";
import { useRouteState, updateLocation } from "../navigation";
import { Train, ArrowRight } from "@phosphor-icons/react";
import { useHouse, Form, Fields } from "../context";
import { SelectField, Empty, Button, Toggle } from "../ui";
import { t, money } from "../../lib/i18n.mjs";
import { calculateTravel } from "../../lib/calculations.mjs";
import {
  activeCriteria,
  journeyFor,
  scenarioApplies,
} from "../../lib/domain.mjs";
import AnswerControl from "../AnswerControl";
export default function Travel({ apartmentId }) {
  const { locale, snapshot, save, editable } = useHouse();
  const scenarios = snapshot.scenarios.filter((s) => !s.archived),
    [id, setId] = useRouteState("travelScenario", scenarios[0]?.id || "");
  const scenario = scenarios.find((s) => s.id === id) || scenarios[0],
    apartment = snapshot.apartments.find((a) => a.id === apartmentId);
  if (!scenario)
    return (
      <Empty
        title={t(locale, "journeysMissing")}
        description={t(locale, "noScenariosText")}
        icon={<Train size={40} />}
      >
        <Button
          disabled={!editable}
          onClick={() => updateLocation({ scenarioEditor: "new" })}
        >
          {t(locale, "newScenario")}
        </Button>
      </Empty>
    );
  const journey = journeyFor(snapshot, apartmentId, scenario),
    calc = calculateTravel({
      scenario,
      journey,
      startDate: apartment.rentStart || snapshot.collection.settings.moveInDate,
    });
  return (
    <>
      <div className="travel-heading">
        <SelectField
          label={t(locale, "scenario")}
          value={scenario.id}
          onChange={setId}
          options={scenarios.map((s) => ({
            value: s.id,
            label: `${s.person} · ${s.name}`,
          }))}
        />
        <p>{t(locale, "travelHelp")}</p>
      </div>
      <div className="journey-map">
        <div>
          <span>{t(locale, "origin")}</span>
          <strong>{scenario.origin}</strong>
        </div>
        <ArrowRight />
        <div>
          <span>{t(locale, "destination")}</span>
          <strong>{scenario.destination}</strong>
        </div>
        <ArrowRight />
        <div>
          <span>{t(locale, "returnDestination")}</span>
          <strong>{scenario.returnDestination}</strong>
        </div>
      </div>
      <div className="cost-summary">
        <div>
          <span>{t(locale, "frequency")}</span>
          <strong>
            {scenario.frequency ?? "—"} / {t(locale, scenario.frequencyUnit)}
          </strong>
          <small>{scenario.person}</small>
        </div>
        <div>
          <span>{t(locale, "monthly")}</span>
          <strong>{money(calc.monthly, locale)}</strong>
          <small>
            {t(locale, calc.missing.length ? "knownCharges" : "completeTotal")}
          </small>
        </div>
        <div>
          <span>{t(locale, "total24")}</span>
          <strong>{money(calc.total, locale)}</strong>
          <small>
            {calc.days || "—"}{" "}
            {locale === "ja" ? "日" : locale === "vi" ? "ngày" : "days"}
          </small>
        </div>
        <div>
          <span>{t(locale, "net24")}</span>
          <strong>{money(calc.net, locale)}</strong>
        </div>
      </div>
      <div className="canonical-grid">
        {activeCriteria(snapshot)
          .filter((c) => c.scope === "journey" && scenarioApplies(c, scenario))
          .map((c) => (
            <AnswerControl
              key={`${c.id}:${scenario.id}`}
              apartmentId={apartmentId}
              criterion={c}
              scenarioId={scenario.id}
            />
          ))}
      </div>
      <div className="panel">
        <Form
          showFieldStatus
          key={scenario.id}
          initial={journey}
          onSubmit={(v) =>
            save(
              "record.put",
              journey.id ? journey : null,
              { ...v, kind: "journey" },
              { apartmentId, scenarioId: scenario.id },
            )
          }
        >
          {(v, u) => (
            <>
              <div className="form-grid">
                <Fields
                  keys={[
                    ...(["partner_home", "partner_work"].includes(
                      scenario.purpose,
                    )
                      ? []
                      : ["outboundRoute", "returnRoute"]),
                    ...(scenario.purpose === "work" ? [] : ["outboundMinutes"]),
                    "returnMinutes",
                    "reimbursed",
                  ]}
                  value={v}
                  update={u}
                  types={{
                    outboundRoute: "textarea",
                    returnRoute: "textarea",
                    outboundMinutes: "number",
                    returnMinutes: "number",
                    taxiFare: "number",
                    bookingSurcharge: "number",
                    reimbursed: "number",
                  }}
                />
              </div>
              <Toggle
                label={t(locale, "includeTaxi")}
                checked={v.includeTaxi}
                onChange={(x) => u("includeTaxi", x)}
              />
              <p className="muted">{t(locale, "taxiTotalHelp")}</p>
              <Toggle
                label={t(locale, "reimbursementConfirmed")}
                checked={v.reimbursementConfirmed}
                onChange={(x) => u("reimbursementConfirmed", x)}
              />
              <Fields
                keys={["notes"]}
                value={v}
                update={u}
                types={{ notes: "textarea" }}
              />
            </>
          )}
        </Form>
      </div>
    </>
  );
}
