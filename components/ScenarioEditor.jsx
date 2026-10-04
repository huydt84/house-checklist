"use client";
import { useRouteState, updateLocation } from "./navigation";
import { useHouse, Form, Fields } from "./context";
import { Dialog, SelectField, Toggle } from "./ui";
import { t } from "../lib/i18n.mjs";

export default function ScenarioEditor() {
  const { locale, snapshot, direct } = useHouse();
  const [scenarioId] = useRouteState("scenarioEditor");
  const scenario =
    scenarioId === "new"
      ? {
          name: "",
          person: "",
          purpose: "custom",
          frequency: null,
          frequencyUnit: "week",
        }
      : snapshot.scenarios.find((s) => s.id === scenarioId);
  const close = () =>
    updateLocation({ scenarioEditor: null }, { replace: true });
  return (
    <Dialog
      open={Boolean(scenario)}
      onClose={close}
      title={t(locale, "scenario")}
      locale={locale}
      wide
    >
      {scenario && (
        <Form
          key={scenarioId}
          initial={scenario}
          onSubmit={async (v) => {
            await direct("scenario.put", scenario.id ? scenario : null, v);
            close();
          }}
        >
          {(v, u) => (
            <>
              <div className="form-grid">
                <Fields
                  keys={[
                    "name",
                    "person",
                    "origin",
                    "destination",
                    "returnDestination",
                    "frequency",
                  ]}
                  value={v}
                  update={u}
                  types={{ frequency: "number" }}
                />
                <SelectField
                  label={t(locale, "purpose")}
                  value={v.purpose}
                  onChange={(x) => u("purpose", x)}
                  options={[
                    "work",
                    "partner_home",
                    "partner_work",
                    "custom",
                  ].map((value) => ({ value, label: t(locale, value) }))}
                />
                <SelectField
                  label={t(locale, "frequencyUnit")}
                  value={v.frequencyUnit}
                  onChange={(x) => u("frequencyUnit", x)}
                  options={["week", "month"].map((value) => ({
                    value,
                    label: t(locale, value),
                  }))}
                />
              </div>
              {scenario.id && (
                <Toggle
                  label={t(locale, "archive")}
                  checked={v.archived}
                  onChange={(x) => u("archived", x)}
                />
              )}
            </>
          )}
        </Form>
      )}
    </Dialog>
  );
}
