"use client";
import { createContext, useContext, useState } from "react";
import { t, errorText } from "../lib/i18n.mjs";
import { Field, Button, ErrorNotice, FieldStatusScope } from "./ui";
export const HouseContext = createContext(null);
export const useHouse = () => useContext(HouseContext);
export function Form({
  initial = {},
  onSubmit,
  children,
  submitLabel,
  onCancel,
  showFieldStatus = false,
}) {
  const { locale, editable } = useHouse();
  const [value, setValue] = useState(initial),
    [savedValue, setSavedValue] = useState(initial),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const update = (key, v) =>
    setValue((x) => {
      // Inputs render missing/null values as empty strings. Returning to that
      // displayed baseline must also return to the original stored value.
      const baseline = savedValue[key];
      if ((v == null || v === "") && (baseline == null || baseline === "")) {
        const next = { ...x };
        if (Object.hasOwn(savedValue, key)) next[key] = baseline;
        else delete next[key];
        return next;
      }
      return { ...x, [key]: v };
    });
  return (
    <FieldStatusScope locale={showFieldStatus ? locale : null}>
      <form
        data-saving={busy}
        data-unsaved={JSON.stringify(value) !== JSON.stringify(savedValue)}
        data-leave-message={t(locale, "unsavedFormWarning")}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onSubmit(value);
            setSavedValue(value);
          } catch (e) {
            setError(errorText(locale, e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !editable}>
          {children(value, update)}
          <ErrorNotice>{error}</ErrorNotice>
          {JSON.stringify(value) !== JSON.stringify(savedValue) && (
            <p className="form-draft-status" role="status">
              {t(locale, "unsavedFormChanges")}
            </p>
          )}
          <div className="form-actions">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {t(locale, "cancel")}
              </Button>
            )}
            <Button disabled={busy} type="submit">
              {t(locale, busy ? "saving" : submitLabel || "save")}
            </Button>
          </div>
        </fieldset>
      </form>
    </FieldStatusScope>
  );
}
export function Fields({ keys, value, update, types = {} }) {
  const { locale } = useHouse();
  return keys.map((key) => (
    <Field
      key={key}
      label={t(locale, key)}
      type={types[key] || "text"}
      value={value[key]}
      onChange={(v) => update(key, v)}
    />
  ));
}
export function PageTitle({ eyebrow, title, description, children }) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="title-actions">{children}</div>}
    </header>
  );
}
