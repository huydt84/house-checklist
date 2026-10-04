"use client";
import { useState } from "react";
import { useHouse } from "./context";
import { Value } from "./AnswerControl";
import { Button, Field, SelectField, Toggle, ErrorNotice } from "./ui";
import { textFor, orderedApartments, layoutAnswer } from "../lib/domain.mjs";
import { t, errorText } from "../lib/i18n.mjs";
import { resolveJob } from "../lib/client-store.mjs";
export default function ConflictResolver({ job }) {
  const { locale, snapshot, sync, refreshRemote } = useHouse();
  const [draft, setDraft] = useState(job.command.payload),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const c = snapshot.criteria.find((c) => c.id === job.command.criterionId);
  const apartment = snapshot.apartments.find(
    (a) => a.id === job.command.apartmentId,
  );
  const saved = job.error?.current;
  const reordering = job.command.type === "apartments.reorder";
  const orderNames = (order) =>
    orderedApartments({
      ...snapshot,
      collection: { ...snapshot.collection, apartmentOrder: order },
    }).map((a) => <li key={a.id}>{a.name}</li>);
  const update = async (choice) => {
    setBusy(true);
    try {
      const fresh = await refreshRemote();
      const entity = {
        "answer.put": "answers",
        "apartment.put": "apartments",
        "criterion.put": "criteria",
        "section.put": "sections",
        "scenario.put": "scenarios",
        "record.put": "records",
      }[job.command.type];
      const current = entity
        ? fresh[entity].find((r) =>
            entity === "answers"
              ? r.apartmentId === job.command.apartmentId &&
                r.criterionId === job.command.criterionId &&
                (r.scenarioId || null) === (job.command.scenarioId || null)
              : r.id === job.command.targetId,
          )
        : fresh.collection;
      await resolveJob(
        { ...job, command: { ...job.command, payload: draft } },
        choice,
        current,
        fresh.collection.checklistRevision,
      );
      await sync();
    } catch (e) {
      setError(errorText(locale, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="conflict-item">
      {apartment && <p className="eyebrow">{apartment.name}</p>}
      <h3>
        {reordering
          ? t(locale, "reorder")
          : c
            ? textFor(c, locale)
            : draft.name || t(locale, "conflict")}
      </h3>
      <ErrorNotice>{errorText(locale, job.error)}</ErrorNotice>
      <div className="conflict-versions">
        <div>
          <h3>{t(locale, "serverVersion")}</h3>
          {reordering ? (
            <ol>{orderNames(saved?.apartmentOrder)}</ol>
          ) : c ? (
            <>
              <Value criterion={c} answer={saved} locale={locale} />
              {saved?.notes && <p>{saved.notes}</p>}
            </>
          ) : (
            <p>{saved?.name || saved?.text || t(locale, "not_checked")}</p>
          )}
        </div>
        <div>
          <h3>{t(locale, "localVersion")}</h3>
          {reordering ? (
            <ol>{orderNames(draft.apartmentOrder)}</ol>
          ) : c ? (
            c.type === "boolean" ? (
              <SelectField
                label={t(locale, "answer")}
                value={
                  draft.state === "answered" ? String(draft.value) : draft.state
                }
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    state: ["true", "false"].includes(v) ? "answered" : v,
                    value: v === "true" ? true : v === "false" ? false : null,
                  })
                }
                options={["true", "false", "not_checked", "not_applicable"].map(
                  (value) => ({
                    value,
                    label: t(
                      locale,
                      value === "true"
                        ? "yes"
                        : value === "false"
                          ? "no"
                          : value,
                    ),
                  }),
                )}
              />
            ) : c.type === "select" ? (
              <SelectField
                label={t(locale, "answer")}
                value={draft.value || ""}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    value,
                    state: value ? "answered" : "not_checked",
                  })
                }
                options={[
                  { value: "", label: t(locale, "not_checked") },
                  ...c.choices.map((c) => ({
                    value: c.id,
                    label: textFor(c, locale),
                  })),
                ]}
              />
            ) : (
              <Field
                label={t(locale, "answer")}
                type={c.type === "number" ? "number" : "textarea"}
                value={draft.value}
                onChange={(value) =>
                  setDraft({ ...draft, value, state: "answered" })
                }
              />
            )
          ) : (
            Object.entries(draft)
              .filter(
                ([key, v]) =>
                  [
                    "name",
                    "text",
                    "resolution",
                    "amount",
                    "address",
                    "status",
                  ].includes(key) && ["number", "string"].includes(typeof v),
              )
              .map(([key, v]) => (
                <Field
                  key={key}
                  label={t(locale, key === "text" ? "question" : key)}
                  type={typeof v === "number" ? "number" : "text"}
                  value={v}
                  onChange={(x) => setDraft({ ...draft, [key]: x })}
                />
              ))
          )}
          {c && layoutAnswer(c) && (
            <Toggle
              label={t(locale, "hasLoft")}
              checked={draft.hasLoft}
              disabled={draft.state === "not_applicable"}
              onChange={(hasLoft) => setDraft({ ...draft, hasLoft })}
            />
          )}
          {!reordering && (
            <Field
              label={t(locale, "notes")}
              type="textarea"
              value={draft.notes}
              onChange={(notes) => setDraft({ ...draft, notes })}
            />
          )}
        </div>
      </div>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="button-row">
        <Button
          disabled={busy}
          variant="secondary"
          onClick={() => update("server")}
        >
          {t(locale, "keepServer")}
        </Button>
        <Button disabled={busy} onClick={() => update("mine")}>
          {t(locale, "keepMine")}
        </Button>
      </div>
    </div>
  );
}
