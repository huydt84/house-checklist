"use client";
import { RouteLink, useRouteState } from "../navigation";
import { useState } from "react";
import { Plus, ChatCircle, ArrowUpRight, Check } from "@phosphor-icons/react";
import { useHouse, PageTitle, Form, Fields } from "../context";
import { Button, Dialog, SelectField, Field, Chip, Empty } from "../ui";
import { t } from "../../lib/i18n.mjs";
import { textFor } from "../../lib/domain.mjs";
export default function Questions() {
  const { locale, snapshot, editable, save, navigate, navigationPatch } =
    useHouse();
  const [status, setStatus] = useRouteState("questionStatus", "open"),
    [modal, setModal] = useState(null);
  const questions = snapshot.records.filter(
    (r) =>
      r.kind === "question" && !r.archived && (!status || r.status === status),
  );
  return (
    <>
      <PageTitle
        title={t(locale, "questions")}
        description={t(locale, "noQuestionsText")}
      >
        <Button
          disabled={!editable || !snapshot.apartments.length}
          onClick={() =>
            setModal({
              text: "",
              status: "open",
              apartmentId:
                snapshot.apartments.find((a) => !a.archived)?.id || "",
              criterionId: "",
            })
          }
        >
          <Plus />
          {t(locale, "addQuestion")}
        </Button>
      </PageTitle>
      <div className="segmented inline">
        {["open", "resolved", ""].map((key) => (
          <button
            key={key}
            aria-pressed={status === key}
            onClick={() => setStatus(key)}
          >
            {t(locale, key || "all")}
          </button>
        ))}
      </div>
      {questions.length ? (
        <div className="question-list">
          {questions.map((q) => {
            const apt = snapshot.apartments.find((a) => a.id === q.apartmentId),
              criterion = snapshot.criteria.find((c) => c.id === q.criterionId);
            return (
              <article key={q.id} className="question-row">
                <div
                  className={`question-icon ${q.status === "resolved" ? "resolved" : ""}`}
                >
                  {q.status === "resolved" ? <Check /> : <ChatCircle />}
                </div>
                <div>
                  <RouteLink
                    className="text-button"
                    patch={navigationPatch("apartments", q.apartmentId)}
                  >
                    {apt?.name}
                    <ArrowUpRight />
                  </RouteLink>
                  <h2>{q.text}</h2>
                  <p>
                    {criterion && `${textFor(criterion, locale)} · `}
                    {q.responsible || t(locale, "unassessed")}
                  </p>
                  {q.resolution && <p>{q.resolution}</p>}
                </div>
                <Chip>{t(locale, q.status)}</Chip>
                <Button
                  variant="secondary"
                  disabled={!editable}
                  onClick={() => setModal(q)}
                >
                  {t(locale, "edit")}
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={t(locale, "noQuestions")}
          description={t(locale, "noQuestionsText")}
        />
      )}
      <Dialog
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={t(locale, modal?.id ? "edit" : "addQuestion")}
        locale={locale}
      >
        {modal && (
          <Form
            initial={modal}
            onSubmit={async (v) => {
              await save(
                "record.put",
                modal.id ? modal : null,
                { ...v, kind: "question" },
                {
                  apartmentId: v.apartmentId,
                  criterionId: v.criterionId || null,
                },
              );
              setModal(null);
            }}
          >
            {(v, u) => (
              <>
                <SelectField
                  label={t(locale, "chooseApartment")}
                  value={v.apartmentId}
                  disabled={Boolean(v.id)}
                  onChange={(x) => u("apartmentId", x)}
                  options={snapshot.apartments
                    .filter((a) => !a.archived)
                    .map((a) => ({ value: a.id, label: a.name }))}
                />
                <SelectField
                  label={t(locale, "linkedCriterion")}
                  value={v.criterionId || ""}
                  disabled={Boolean(v.id)}
                  onChange={(x) => u("criterionId", x)}
                  options={[
                    { value: "", label: t(locale, "none") },
                    ...snapshot.criteria
                      .filter((c) => !c.archived)
                      .map((c) => ({ value: c.id, label: textFor(c, locale) })),
                  ]}
                />
                <SelectField
                  label={t(locale, "costId")}
                  value={v.costId || ""}
                  onChange={(x) => u("costId", x)}
                  options={[
                    { value: "", label: t(locale, "none") },
                    ...snapshot.records
                      .filter(
                        (r) =>
                          r.kind === "cost" &&
                          r.apartmentId === v.apartmentId &&
                          !r.archived,
                      )
                      .map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
                <Field
                  label={t(locale, "question")}
                  type="textarea"
                  value={v.text}
                  onChange={(x) => u("text", x)}
                  required
                />
                <Fields keys={["responsible"]} value={v} update={u} />
                <SelectField
                  label={t(locale, "status")}
                  value={v.status}
                  onChange={(x) => u("status", x)}
                  options={["open", "resolved"].map((value) => ({
                    value,
                    label: t(locale, value),
                  }))}
                />
                {v.status === "resolved" && (
                  <Fields
                    keys={["resolution", "sourceUrl"]}
                    value={v}
                    update={u}
                    types={{ resolution: "textarea", sourceUrl: "url" }}
                  />
                )}
              </>
            )}
          </Form>
        )}
      </Dialog>
    </>
  );
}
