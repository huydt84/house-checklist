"use client";
import { useState, useEffect, useRef } from "react";
import {
  ClockCounterClockwise,
  ChatCircle,
  Paperclip,
  CaretDown,
  CheckCircle,
  Circle,
  MinusCircle,
} from "@phosphor-icons/react";
import { useHouse } from "./context";
import {
  Button,
  Field,
  BooleanField,
  SelectField,
  Toggle,
  Chip,
  Dialog,
  ErrorNotice,
  FieldStatusScope,
} from "./ui";
import {
  textFor,
  findAnswer,
  answerState,
  SOURCES,
  simplifiedChecklist,
  characteristicAnswer,
  answerNotes,
  meaningful,
  layoutAnswer,
} from "../lib/domain.mjs";
import { t, errorText, dateLabel, unitLabel } from "../lib/i18n.mjs";
import { request, queueFile, downloadBlob } from "../lib/client-store.mjs";
export function Value({ answer, criterion, locale }) {
  const state = answerState(answer, criterion);
  if (simplifiedChecklist(criterion) && !characteristicAnswer(criterion))
    return <span className={`answer-value ${state}`}>{t(locale, state)}</span>;
  if (
    !meaningful(answer?.value, criterion.type) ||
    (!simplifiedChecklist(criterion) && state !== "answered")
  )
    return <span className={`answer-value ${state}`}>{t(locale, state)}</span>;
  if (criterion.type === "boolean")
    return <span>{t(locale, answer.value ? "yes" : "no")}</span>;
  if (criterion.type === "select")
    return (
      <span>
        {textFor(
          criterion.choices.find((c) => c.id === answer.value),
          locale,
        )}
        {answer.value === "other" && answer.other && ` · ${answer.other}`}
        {layoutAnswer(criterion) &&
          typeof answer.hasLoft === "boolean" &&
          ` · ${t(locale, answer.hasLoft ? "hasLoft" : "noLoft")}`}
      </span>
    );
  return (
    <span className="answer-value">
      {criterion.type === "number"
        ? new Intl.NumberFormat(locale).format(answer.value)
        : answer.value}
      {criterion.unit && ` ${unitLabel(criterion.unit, locale)}`}
    </span>
  );
}
export default function AnswerControl({
  apartmentId,
  criterion: definition,
  scenarioId = null,
  compact = false,
}) {
  const {
    locale,
    snapshot,
    editable,
    answer,
    save,
    direct,
    session,
    online,
    sync,
    setNotice,
  } = useHouse();
  const criterion = {
    ...definition,
    section:
      snapshot.sections.find((s) => s.id === definition.sectionId)?.key ||
      definition.section,
  };
  const existing = findAnswer(snapshot, apartmentId, criterion.id, scenarioId);
  const simplified = simplifiedChecklist(criterion);
  // Date answers stay strings so existing collections and offline drafts remain compatible.
  const moveInDate =
    criterion.type === "text" &&
    (criterion.sourceKey || criterion.key) === "A06";
  const [draft, setDraft] = useState(
      existing || {
        state: "not_checked",
        value: null,
        suitability: "unassessed",
      },
    ),
    [error, setError] = useState(null),
    [history, setHistory] = useState(null),
    [question, setQuestion] = useState(false),
    [q, setQ] = useState("");
  const focused = useRef(false),
    composing = useRef(false),
    pendingSaves = useRef(0),
    latest = useRef(draft);
  latest.current = draft;
  const previousDateText =
    moveInDate && draft.value && !/^\d{4}-\d{2}-\d{2}$/.test(draft.value)
      ? draft.value
      : "";
  useEffect(() => {
    // Leaving an input does not acknowledge its asynchronous local save.
    // An older snapshot can arrive while that save is still in flight.
    if (!focused.current && !pendingSaves.current && existing)
      setDraft(existing);
  }, [existing]);
  const change = async (patch) => {
    const next = { ...latest.current, ...patch };
    if (Object.hasOwn(patch, "suitability"))
      next.settingsRevision = snapshot.collection.revision;
    latest.current = next;
    setDraft(next);
    setError(null);
    if (composing.current) return;
    pendingSaves.current += 1;
    try {
      await answer(apartmentId, criterion, next, scenarioId);
    } catch (e) {
      setError(errorText(locale, e));
    } finally {
      pendingSaves.current -= 1;
    }
  };
  const inputEvents = {
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: () => {
      composing.current = false;
      void change({});
    },
  };
  const state = answerState(draft, criterion),
    sourceChoices = [
      { value: "", label: t(locale, "not_checked") },
      ...SOURCES.map((value) => ({ value, label: t(locale, value) })),
    ];
  return (
    <article
      className={`check-item ${compact ? "compact" : ""} ${simplified ? "simplified" : ""}`}
      data-answer-state={state}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) focused.current = false;
      }}
      data-testid={`check-${criterion.key}`}
    >
      <FieldStatusScope locale={state === "not_applicable" ? null : locale}>
        <div className="check-heading">
          <div>
            <div className="check-meta">
              {!compact && (
                <span>
                  {criterion.sourceKey ||
                    (criterion.key.startsWith("custom.")
                      ? "＋"
                      : criterion.key)}
                </span>
              )}
              {criterion.importance !== "information" && (
                <Chip
                  tone={criterion.importance === "requirement" ? "amber" : ""}
                >
                  {t(locale, criterion.importance)}
                </Chip>
              )}
            </div>
            <h3>{textFor(criterion, locale)}</h3>
            {!compact && <p>{textFor(criterion, locale, "guidance")}</p>}
          </div>
          <Chip tone={state === "answered" ? "teal" : ""}>
            {state === "answered" ? (
              <CheckCircle size={16} aria-hidden="true" />
            ) : state === "not_applicable" ? (
              <MinusCircle size={16} aria-hidden="true" />
            ) : (
              <Circle size={16} aria-hidden="true" />
            )}
            {t(locale, state)}
          </Chip>
        </div>
        <fieldset disabled={!editable}>
          {characteristicAnswer(criterion) && (
            <div className="answer-input">
              {criterion.type === "boolean" ? (
                <div
                  className="segmented"
                  aria-label={textFor(criterion, locale)}
                >
                  {[
                    { value: true, key: "yes" },
                    { value: false, key: "no" },
                    { value: null, key: "not_checked" },
                  ].map((o) => (
                    <button
                      type="button"
                      key={o.key}
                      aria-pressed={
                        draft.value === o.value &&
                        state ===
                          (o.value === null ? "not_checked" : "answered")
                      }
                      onClick={() =>
                        change({
                          value: o.value,
                          state: o.value === null ? "not_checked" : "answered",
                        })
                      }
                    >
                      {t(locale, o.key)}
                    </button>
                  ))}
                </div>
              ) : criterion.type === "select" ? (
                <SelectField
                  label={
                    simplified
                      ? textFor(criterion, locale)
                      : t(locale, "answer")
                  }
                  value={
                    simplified || state === "answered" ? draft.value || "" : ""
                  }
                  onChange={(value) =>
                    change({
                      value: value || null,
                      state: value ? "answered" : "not_checked",
                    })
                  }
                  options={[
                    { value: "", label: t(locale, "not_checked") },
                    ...criterion.choices
                      .filter((c) => !c.retired || c.id === draft.value)
                      .map((c) => ({ value: c.id, label: textFor(c, locale) })),
                  ]}
                />
              ) : (
                <Field
                  label={
                    simplified || criterion.unit === "year"
                      ? textFor(criterion, locale)
                      : criterion.unit
                        ? `${t(locale, "answer")} · ${unitLabel(criterion.unit, locale)}`
                        : t(locale, "answer")
                  }
                  type={
                    moveInDate
                      ? "date"
                      : criterion.type === "number"
                        ? "number"
                        : "textarea"
                  }
                  value={previousDateText ? "" : draft.value}
                  hint={
                    previousDateText
                      ? `${t(locale, "previousDateAnswer")}: ${previousDateText}`
                      : undefined
                  }
                  onChange={(value) =>
                    change({
                      value,
                      state: value === "" ? "not_checked" : "answered",
                      ...(previousDateText && {
                        notes: [draft.notes, previousDateText]
                          .filter(Boolean)
                          .join("\n\n"),
                      }),
                    })
                  }
                  min={criterion.type === "number" ? 0 : undefined}
                  step={criterion.type === "number" ? "any" : undefined}
                  rows={compact ? 2 : 3}
                  {...inputEvents}
                />
              )}
              {draft.value === "other" && (
                <Field
                  label={t(locale, "other")}
                  value={draft.other}
                  onChange={(other) => change({ other })}
                />
              )}
              {layoutAnswer(criterion) && (
                <div className="layout-loft">
                  <Toggle
                    label={t(locale, "hasLoft")}
                    checked={draft.hasLoft}
                    disabled={state === "not_applicable"}
                    onChange={(hasLoft) => change({ hasLoft })}
                  />
                </div>
              )}
              {!simplified && (
                <Toggle
                  label={t(locale, "not_applicable")}
                  checkboxOnly
                  checked={state === "not_applicable"}
                  onChange={(checked) =>
                    change({
                      state: checked ? "not_applicable" : "not_checked",
                      value: null,
                    })
                  }
                />
              )}
            </div>
          )}
          <div className="support-fields">
            {criterion.supportFields?.map((f) =>
              f.type === "boolean" ? (
                <BooleanField
                  key={f.id}
                  label={textFor(f, locale)}
                  value={draft.support?.[f.id]}
                  onChange={(v) =>
                    change({ support: { ...draft.support, [f.id]: v } })
                  }
                  options={[
                    { value: true, label: t(locale, "applianceAvailable") },
                    { value: false, label: t(locale, "applianceUnavailable") },
                  ]}
                />
              ) : (
                <Field
                  key={f.id}
                  label={`${textFor(f, locale)}${f.unit && f.unit !== "year" ? " · " + unitLabel(f.unit, locale) : ""}`}
                  type={f.type === "number" ? "number" : "text"}
                  value={draft.support?.[f.id]}
                  onChange={(v) =>
                    change({ support: { ...draft.support, [f.id]: v } })
                  }
                  min={0}
                  step="any"
                />
              ),
            )}
          </div>
          {!compact && (
            <>
              {!simplified && (
                <details className="evidence" open={undefined}>
                  <summary>
                    {t(locale, "notes")} & {t(locale, "source")}
                    <CaretDown size={16} />
                  </summary>
                  <div className="evidence-body">
                    <Field
                      label={t(locale, "notes")}
                      type="textarea"
                      value={draft.notes}
                      onChange={(notes) => change({ notes })}
                      {...inputEvents}
                    />
                    <div className="form-grid">
                      <SelectField
                        label={t(locale, "source")}
                        value={draft.source}
                        onChange={(source) => change({ source })}
                        options={sourceChoices}
                      />
                      <Field
                        label={t(locale, "observedAt")}
                        type="date"
                        value={draft.observedAt}
                        onChange={(observedAt) => change({ observedAt })}
                      />
                      <Field
                        label={t(locale, "sourceUrl")}
                        type="url"
                        value={draft.sourceUrl}
                        onChange={(sourceUrl) => change({ sourceUrl })}
                      />
                      {draft.source === "document" && (
                        <>
                          <SelectField
                            label={t(locale, "documentType")}
                            value={draft.documentType}
                            onChange={(documentType) =>
                              change({ documentType })
                            }
                            options={["", "quote", "contract", "other"].map(
                              (value) => ({
                                value,
                                label: t(locale, value || "none"),
                              }),
                            )}
                          />
                          <Field
                            label={t(locale, "documentReference")}
                            value={draft.documentReference}
                            onChange={(documentReference) =>
                              change({ documentReference })
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>
                </details>
              )}
              <div className="assessment">
                <span>{t(locale, "suitability")}</span>
                <div
                  className="segmented small"
                  role="group"
                  aria-label={t(locale, "suitability")}
                >
                  {["unassessed", "meets", "unmet"].map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={
                        (draft.suitability || "unassessed") === value
                      }
                      onClick={() => change({ suitability: value })}
                    >
                      {t(locale, value)}
                    </button>
                  ))}
                </div>
                {draft.suitability !== "unassessed" &&
                  draft.settingsRevision !== snapshot.collection.revision && (
                    <Chip tone="amber">{t(locale, "reviewNeeded")}</Chip>
                  )}
              </div>
              {simplified && (
                <Field
                  label={t(locale, "notes")}
                  type="textarea"
                  rows={2}
                  value={answerNotes(draft, criterion)}
                  onChange={(notes) =>
                    change({
                      notes,
                      ...(criterion.type === "text" ? { value: null } : {}),
                    })
                  }
                  {...inputEvents}
                />
              )}
              {!simplified && (
                <div className="check-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setQuestion(true)}
                  >
                    <ChatCircle />
                    {t(locale, "addQuestion")}
                  </button>
                  <label className="text-button file-button">
                    <Paperclip />
                    {t(locale, "upload")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          try {
                            await queueFile(
                              session.user.id,
                              snapshot.collection.id,
                              apartmentId,
                              criterion.id,
                              f,
                              session.local,
                              scenarioId,
                            );
                            await sync();
                            setNotice(t(locale, "queued"));
                          } catch (err) {
                            setError(errorText(locale, err));
                          }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </>
          )}
        </fieldset>
        {!compact && !simplified && existing?.id && (
          <button
            className="text-button history-button"
            disabled={!online}
            onClick={async () => {
              try {
                setHistory(
                  await request(
                    `/api/collections/${snapshot.collection.id}/history/${existing.id}`,
                  ),
                );
              } catch (e) {
                setError(errorText(locale, e));
              }
            }}
          >
            <ClockCounterClockwise />
            {t(locale, "history")}
          </button>
        )}
        <ErrorNotice>
          {error}
          {error && (
            <div className="button-row">
              <Button variant="secondary" onClick={() => change({})}>
                {t(locale, "retry")}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadBlob(
                    new Blob(
                      [
                        JSON.stringify(
                          { criterion: textFor(criterion, locale), ...draft },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    ),
                    "viewing-draft.json",
                  )
                }
              >
                {t(locale, "exportDrafts")}
              </Button>
            </div>
          )}
        </ErrorNotice>
        <Dialog
          open={history !== null}
          onClose={() => setHistory(null)}
          title={t(locale, "history")}
          locale={locale}
        >
          {history?.length ? (
            history.map((h) => (
              <div className="history-row" key={h.id}>
                <p>
                  <strong>{h.actor}</strong> ·{" "}
                  {dateLabel(h.created_at, locale, true)}
                </p>
                <Value
                  answer={h.after_value}
                  criterion={criterion}
                  locale={locale}
                />
                {h.after_value?.notes && <p>{h.after_value.notes}</p>}
                {h.after_value?.source && (
                  <p>
                    {t(locale, h.after_value.source)} ·{" "}
                    {h.after_value.documentReference}
                  </p>
                )}
                {editable && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await direct(
                          "answer.restore",
                          existing,
                          { historyId: h.id },
                          {
                            apartmentId,
                            criterionId: criterion.id,
                            scenarioId,
                          },
                        );
                        setHistory(null);
                      } catch (e) {
                        setError(errorText(locale, e));
                      }
                    }}
                  >
                    {t(locale, "restore")}
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p>{t(locale, "noHistory")}</p>
          )}
        </Dialog>
        <Dialog
          open={question}
          onClose={() => setQuestion(false)}
          title={t(locale, "addQuestion")}
          locale={locale}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await save(
                "record.put",
                null,
                { kind: "question", text: q, status: "open" },
                { apartmentId, criterionId: criterion.id },
              );
              setQ("");
              setQuestion(false);
            }}
          >
            <Field
              label={t(locale, "question")}
              type="textarea"
              value={q}
              onChange={setQ}
              required
            />
            <div className="form-actions">
              <Button>{t(locale, "add")}</Button>
            </div>
          </form>
        </Dialog>
      </FieldStatusScope>
    </article>
  );
}
