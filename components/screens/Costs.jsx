"use client";
import { useState } from "react";
import {
  Plus,
  PencilSimple,
  Trash,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { useHouse, Form, Fields } from "../context";
import {
  Button,
  Field,
  SelectField,
  Toggle,
  Dialog,
  ErrorNotice,
  FieldStatus,
} from "../ui";
import { t, money, dateLabel, errorText } from "../../lib/i18n.mjs";
import { textFor, fieldValue, fieldAnswer } from "../../lib/domain.mjs";
import { apartmentCosts, resolveAmount } from "../../lib/calculations.mjs";
import AnswerControl from "../AnswerControl";
const costKeys = ["H01", "H02", "H03", "H04", "H10", "F05", "F06", "G06"];
export function CostSummary({ apartmentId }) {
  const { locale, snapshot } = useHouse(),
    c = apartmentCosts(snapshot, apartmentId);
  return (
    <div className="cost-summary">
      {[
        ["upfront", c.upfront],
        ["monthlyHousing", c.monthly],
        ["total24", c.expense],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{t(locale, label)}</span>
          <strong>
            {value == null ? t(locale, "costNotEntered") : money(value, locale)}
          </strong>
          <small>
            {label === "monthlyHousing" && value == null
              ? `${t(locale, "missing")}: ${["H01", "H02"]
                  .filter(
                    (key) =>
                      fieldValue(snapshot, apartmentId, key) == null &&
                      fieldAnswer(snapshot, apartmentId, key)?.state !==
                        "not_applicable",
                  )
                  .map((key) =>
                    t(locale, key === "H01" ? "rent" : "management"),
                  )
                  .join(" + ")}`
              : t(
                  locale,
                  label === "monthlyHousing"
                    ? "rentPlusManagement"
                    : label === "total24"
                      ? value == null
                        ? "enterExpenseEstimate"
                        : "manualEstimate"
                      : !c.startDate
                        ? "enterRentStart"
                        : c.complete
                          ? "completeTotal"
                          : "knownCharges",
                )}
          </small>
        </div>
      ))}
    </div>
  );
}
export default function Costs({ apartmentId }) {
  const { locale, snapshot, editable, save } = useHouse();
  const [modal, setModal] = useState(null);
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [deleted, setDeleted] = useState(null);
  const apartment = snapshot.apartments.find((a) => a.id === apartmentId),
    c = apartmentCosts(snapshot, apartmentId),
    records = snapshot.records.filter(
      (r) =>
        r.apartmentId === apartmentId &&
        !r.archived &&
        ["cost", "payment", "adjustment"].includes(r.kind),
    );
  const options = (values) =>
    values.map((value) => ({ value, label: t(locale, value) }));
  const costOptions = [
    ...costKeys.map((key) => ({
      value: key,
      label: t(
        locale,
        {
          H01: "rent",
          H02: "management",
          H03: "deposit",
          H04: "keyMoney",
          H10: "lock",
          F05: "internet",
          F06: "internetSetup",
          G06: "bicycleParking",
        }[key],
      ),
    })),
    ...records
      .filter((r) => r.kind === "cost")
      .map((r) => ({ value: r.id, label: r.name })),
  ];
  const costLabel = (id) => {
    const [key, reason] = id.split(":");
    const name =
      costOptions.find((o) => o.value === key)?.label ||
      records.find((r) => r.id === key)?.name ||
      textFor(
        snapshot.criteria.find((c) => c.key === key),
        locale,
      ) ||
      t(locale, key === "startDate" ? "rentStart" : key);
    return reason
      ? `${name} · ${t(locale, reason === "tax" ? "unknownFormula" : reason)}`
      : name;
  };
  const recordAmount = (record) => {
    const amount = record.amountSource
      ? fieldValue(snapshot, apartmentId, record.amountSource)
      : record.amount;
    if (record.kind !== "cost") return amount;
    return (
      resolveAmount(
        { ...record, amount },
        {
          rent: fieldValue(snapshot, apartmentId, "H01"),
          management: fieldValue(snapshot, apartmentId, "H02"),
        },
      )?.toNumber() ?? null
    );
  };
  return (
    <>
      <CostSummary apartmentId={apartmentId} />
      <h2 className="section-title">{t(locale, "monthlyHousing")}</h2>
      <div className="canonical-grid">
        {["H01", "H02"].map((key) => {
          const criterion = snapshot.criteria.find((c) => c.key === key);
          return (
            criterion && (
              <AnswerControl
                key={key}
                criterion={criterion}
                apartmentId={apartmentId}
                compact
              />
            )
          );
        })}
      </div>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="cost-context">
        <span>
          {c.startDate
            ? `${t(locale, "rentStart")}: ${dateLabel(c.startDate, locale)}`
            : t(locale, "rentStart")}
        </span>
        <span>
          {t(locale, "deposits")}: {money(c.deposits, locale)}
        </span>
        <span>
          {t(locale, "holds")}: {money(c.holds, locale)}
        </span>
      </div>
      <div className="panel">
        <h2>{t(locale, "costCalculation")}</h2>
        <p className="cost-calculation-help">
          {t(locale, "costCalculationHelp")}
        </p>
        <Form
          showFieldStatus
          key={apartment.id}
          initial={apartment}
          onSubmit={(v) => save("apartment.put", apartment, v)}
        >
          {(v, u) => (
            <>
              <div className="form-grid four">
                <Fields
                  keys={[
                    "rentStart",
                    "handoverDate",
                    "moveOutDate",
                    "quoteTotal",
                    "expense24",
                  ]}
                  value={v}
                  update={u}
                  types={{
                    rentStart: "date",
                    handoverDate: "date",
                    moveOutDate: "date",
                    quoteTotal: "number",
                    expense24: "number",
                  }}
                />
              </div>
              <Toggle
                label={t(locale, "costsReviewed")}
                checked={v.costsReviewed}
                onChange={(x) => u("costsReviewed", x)}
              />
            </>
          )}
        </Form>
      </div>
      {(c.missing.length > 0 ||
        c.disputed.length > 0 ||
        c.assumptions.length > 0) && (
        <div className="calculation-notes">
          {[
            [c.missing, "missingCharges"],
            [c.disputed.map((i) => i.name), "disputedCharges"],
            [c.assumptions, "assumptions"],
          ]
            .filter(([list]) => list.length)
            .map(([list, label]) => (
              <div key={label}>
                <h3>{t(locale, label)}</h3>
                <p>{list.map((x) => costLabel(x)).join(" · ")}</p>
              </div>
            ))}
        </div>
      )}
      <h2 className="section-title">{t(locale, "otherHousingCosts")}</h2>
      <div className="canonical-grid">
        {costKeys
          .filter((key) => !["H01", "H02", "F06"].includes(key))
          .map((key) => {
            const criterion = snapshot.criteria.find((c) => c.key === key);
            return (
              criterion && (
                <AnswerControl
                  key={key}
                  criterion={criterion}
                  apartmentId={apartmentId}
                  compact
                />
              )
            );
          })}
      </div>
      <div className="section-heading">
        <div>
          <h2>{t(locale, "optionalCosts")}</h2>
          <p className="optional-cost-note">{t(locale, "optionalCostsHelp")}</p>
        </div>
        <div className="button-row">
          {["cost", "adjustment", "payment"].map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              disabled={!editable}
              onClick={() =>
                setModal({
                  kind,
                  name: "",
                  amount: null,
                  frequencyUnit: "once",
                  treatment: "expense",
                  phase: "upfront",
                  payer: "personal",
                  taxTreatment: "inclusive",
                  formula: { type: "fixed" },
                })
              }
            >
              <Plus size={16} />
              {t(
                locale,
                {
                  cost: "addCost",
                  adjustment: "addAdjustment",
                  payment: "addPayment",
                }[kind],
              )}
            </Button>
          ))}
        </div>
      </div>
      {deleted && (
        <div className="notice cost-delete-notice" role="status">
          <span>
            {t(locale, "deletedCost")}: {deleted.name}
          </span>
          <Button
            variant="ghost"
            disabled={busy || !editable}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const current = snapshot.records.find(
                  (r) => r.id === deleted.id,
                );
                await save(
                  "record.put",
                  current || deleted,
                  { ...deleted, ...current, archived: false },
                  {
                    apartmentId,
                    criterionId: deleted.criterionId || null,
                    scenarioId: deleted.scenarioId || null,
                  },
                );
                setDeleted(null);
              } catch (e) {
                setError(errorText(locale, e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <ArrowCounterClockwise />
            {t(locale, "undo")}
          </Button>
        </div>
      )}
      <div className="record-list">
        {records.map((r) => (
          <div className="record-row cost-record-row" key={r.id}>
            <div>
              <div className="field-label cost-record-name">
                <strong>{r.name}</strong>
                <FieldStatus value={r.name} locale={locale} />
              </div>
              <p>
                {t(
                  locale,
                  r.kind === "cost"
                    ? r.frequencyUnit
                    : r.kind === "payment"
                      ? "addPayment"
                      : "addAdjustment",
                )}{" "}
                ·{" "}
                {r.confirmed
                  ? t(locale, "confirmed")
                  : t(locale, "assumptions")}
              </p>
              {r.kind === "adjustment" && (
                <p>
                  {t(locale, "costId")}:{" "}
                  {r.costId ? costLabel(r.costId) : t(locale, "unknown")}
                  {" · "}
                  {dateLabel(r.startDate, locale)} →{" "}
                  {dateLabel(r.endDate, locale)}
                  {" · "}
                  {t(locale, "endExclusive")}
                </p>
              )}
              {r.kind === "payment" && r.coverageDate && (
                <p>
                  {t(locale, "coverageDate")}:{" "}
                  {dateLabel(r.coverageDate, locale)}
                </p>
              )}
            </div>
            <div className="cost-record-amount">
              <span className="field-label">
                {t(locale, "amount")}
                <FieldStatus
                  value={
                    r.kind === "adjustment" && r.full ? true : recordAmount(r)
                  }
                  locale={locale}
                />
              </span>
              <strong className="record-value">
                {r.kind === "adjustment" && r.full
                  ? t(locale, "fullExemption")
                  : money(recordAmount(r), locale)}
              </strong>
            </div>
            <div className="button-row cost-record-actions">
              <Button
                variant="ghost"
                disabled={!editable}
                onClick={() => setModal(r)}
              >
                <PencilSimple />
                {t(locale, "edit")}
              </Button>
              <Button
                variant="ghost"
                className="cost-delete"
                disabled={!editable || busy}
                aria-label={`${t(locale, "delete")}: ${r.name}`}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await save(
                      "record.put",
                      r,
                      { ...r, archived: true },
                      {
                        apartmentId,
                        criterionId: r.criterionId || null,
                        scenarioId: r.scenarioId || null,
                      },
                    );
                    setDeleted(r);
                  } catch (e) {
                    setError(errorText(locale, e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash />
                {t(locale, "delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={t(
          locale,
          modal?.id
            ? "edit"
            : {
                cost: "addCost",
                adjustment: "addAdjustment",
                payment: "addPayment",
              }[modal?.kind] || "addCost",
        )}
        locale={locale}
        wide
      >
        {modal && (
          <Form
            showFieldStatus
            initial={{
              ...modal,
              formulaType: modal.formula?.type || "fixed",
              factor: modal.formula?.factor,
              percent: modal.formula?.percent,
              bases: modal.formula?.bases || [],
            }}
            onSubmit={async (v) => {
              await save(
                "record.put",
                modal.id ? modal : null,
                {
                  ...v,
                  formula: {
                    type: v.formulaType,
                    factor: v.factor,
                    percent: v.percent,
                    bases: v.bases,
                  },
                },
                { apartmentId, criterionId: v.criterionId || null },
              );
              setModal(null);
            }}
          >
            {(v, u) => (
              <>
                <div className="form-grid">
                  <Field
                    label={t(locale, "name")}
                    value={v.name}
                    onChange={(x) => u("name", x)}
                    required
                  />
                  <Field
                    label={t(locale, "amount")}
                    type="number"
                    min={0}
                    step={1}
                    disabled={Boolean(v.amountSource)}
                    value={v.amount}
                    onChange={(x) => u("amount", x)}
                  />
                  {v.kind === "cost" && (
                    <>
                      <SelectField
                        label={t(locale, "amountSource")}
                        value={v.amountSource || ""}
                        onChange={(x) => u("amountSource", x)}
                        options={[
                          { value: "", label: t(locale, "none") },
                          ...snapshot.criteria
                            .filter((c) => costKeys.includes(c.key))
                            .map((c) => ({
                              value: c.key,
                              label: textFor(c, locale),
                            })),
                        ]}
                      />
                      <SelectField
                        label={t(locale, "linkedCriterion")}
                        value={v.criterionId || ""}
                        disabled={Boolean(v.id)}
                        onChange={(x) => u("criterionId", x)}
                        options={[
                          { value: "", label: t(locale, "none") },
                          ...snapshot.criteria
                            .filter(
                              (c) => c.section === "H" || c.section === "J",
                            )
                            .map((c) => ({
                              value: c.id,
                              label: textFor(c, locale),
                            })),
                        ]}
                      />
                    </>
                  )}
                  {v.kind === "cost" && (
                    <>
                      <SelectField
                        label={t(locale, "formula")}
                        value={v.formulaType}
                        onChange={(x) => u("formulaType", x)}
                        options={options([
                          "fixed",
                          "rent_multiple",
                          "percentage",
                        ])}
                      />
                      {v.formulaType === "rent_multiple" && (
                        <Field
                          label={t(locale, "factor")}
                          type="number"
                          step="any"
                          min={0}
                          value={v.factor}
                          onChange={(x) => u("factor", x)}
                        />
                      )}
                      {v.formulaType === "percentage" && (
                        <>
                          <Field
                            label="%"
                            type="number"
                            min={0}
                            step="any"
                            value={v.percent}
                            onChange={(x) => u("percent", x)}
                          />
                          <div>
                            <p>{t(locale, "bases")}</p>
                            {["rent", "management"].map((key) => (
                              <Toggle
                                key={key}
                                label={t(locale, key)}
                                checked={v.bases.includes(key)}
                                onChange={(checked) =>
                                  u(
                                    "bases",
                                    checked
                                      ? [...v.bases, key]
                                      : v.bases.filter((x) => x !== key),
                                  )
                                }
                              />
                            ))}
                          </div>
                        </>
                      )}
                      <SelectField
                        label={t(locale, "treatment")}
                        value={v.treatment}
                        onChange={(x) => u("treatment", x)}
                        options={options(["expense", "deposit", "hold"])}
                      />
                      <SelectField
                        label={t(locale, "phase")}
                        value={v.phase}
                        onChange={(x) => u("phase", x)}
                        options={options(["upfront", "recurring", "move_out"])}
                      />
                      <SelectField
                        label={t(locale, "taxTreatment")}
                        value={v.taxTreatment}
                        onChange={(x) => u("taxTreatment", x)}
                        options={options(["inclusive", "exclusive", "unknown"])}
                      />
                      {v.taxTreatment === "exclusive" && (
                        <Field
                          label={`${t(locale, "taxRate")} %`}
                          type="number"
                          value={v.taxRate}
                          onChange={(x) => u("taxRate", x)}
                        />
                      )}
                      <Field
                        label={t(locale, "duplicateGroup")}
                        value={v.duplicateGroup}
                        onChange={(x) => u("duplicateGroup", x)}
                      />
                      {v.duplicateGroup && (
                        <Toggle
                          label={t(locale, "duplicateResolved")}
                          checked={v.duplicateResolved}
                          onChange={(x) => u("duplicateResolved", x)}
                        />
                      )}
                    </>
                  )}
                  {v.kind === "cost" && (
                    <SelectField
                      label={t(locale, "frequencyUnit")}
                      value={v.frequencyUnit}
                      onChange={(x) => u("frequencyUnit", x)}
                      options={options([
                        "once",
                        "monthly",
                        "annual",
                        "renewal",
                      ])}
                    />
                  )}
                  {["adjustment", "payment"].includes(v.kind) && (
                    <SelectField
                      label={t(locale, "costId")}
                      value={v.costId}
                      onChange={(x) => u("costId", x)}
                      options={[
                        { value: "", label: t(locale, "none") },
                        ...costOptions,
                      ]}
                    />
                  )}
                  {v.kind === "payment" && (
                    <SelectField
                      label={t(locale, "paymentType")}
                      value={v.paymentType || "payment"}
                      onChange={(x) => u("paymentType", x)}
                      options={options(["payment", "payroll", "refund"])}
                    />
                  )}
                  {v.kind === "payment" ? (
                    <Fields
                      keys={["coverageDate", "paidAt"]}
                      value={v}
                      update={u}
                      types={{ coverageDate: "date", paidAt: "date" }}
                    />
                  ) : (
                    <Fields
                      keys={["startDate", "endDate", "dueDate"]}
                      value={v}
                      update={u}
                      types={{
                        startDate: "date",
                        endDate: "date",
                        dueDate: "date",
                      }}
                    />
                  )}
                  <SelectField
                    label={t(locale, "payer")}
                    value={v.payer || "personal"}
                    onChange={(x) => u("payer", x)}
                    options={options(["personal", "employer"])}
                  />
                  <Field
                    label={t(locale, "payee")}
                    value={v.payee}
                    onChange={(x) => u("payee", x)}
                  />
                </div>
                <Field
                  label={t(locale, "costEvidence")}
                  type="textarea"
                  value={v.evidence}
                  onChange={(x) => u("evidence", x)}
                />
                <Field
                  label={t(locale, "notes")}
                  type="textarea"
                  value={v.notes}
                  onChange={(x) => u("notes", x)}
                />
                <Toggle
                  label={t(locale, "confirmed")}
                  checked={v.confirmed}
                  onChange={(x) => u("confirmed", x)}
                />
                {v.kind === "adjustment" && (
                  <Toggle
                    label={t(locale, "full")}
                    checked={v.full}
                    onChange={(x) => u("full", x)}
                  />
                )}
                {modal.id && (
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
    </>
  );
}
