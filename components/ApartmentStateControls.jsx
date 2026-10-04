"use client";
import { useRef, useState } from "react";
import { Archive, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useHouse } from "./context";
import { Button, Chip, Dialog, ErrorNotice, SelectField } from "./ui";
import { STATUSES } from "../lib/domain.mjs";
import { t, errorText } from "../lib/i18n.mjs";

export default function ApartmentStateControls({ apartment, children }) {
  const { locale, editable, save } = useHouse();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const cancelRef = useRef(null);
  const update = async (patch) => {
    setSaving(true);
    setError(null);
    try {
      await save("apartment.put", apartment, patch);
      return true;
    } catch (e) {
      setError(errorText(locale, e));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="apartment-state"
      role="group"
      aria-label={apartment.name}
      aria-busy={saving}
    >
      <SelectField
        label={t(locale, "status")}
        value={apartment.status}
        disabled={!editable || saving}
        onChange={(status) => update({ status })}
        options={STATUSES.map((value) => ({ value, label: t(locale, value) }))}
      />
      <SelectField
        label={t(locale, "viewingStatus")}
        value={apartment.viewed ? "viewed" : "notViewed"}
        disabled={!editable || saving}
        onChange={(value) => update({ viewed: value === "viewed" })}
        options={["notViewed", "viewed"].map((value) => ({
          value,
          label: t(locale, value),
        }))}
      />
      {apartment.archived && <Chip>{t(locale, "archived")}</Chip>}
      {editable && (
        <Button
          variant={apartment.archived ? "secondary" : "danger"}
          disabled={saving}
          onClick={() => {
            if (apartment.archived) update({ archived: false });
            else {
              setError(null);
              setConfirmArchive(true);
            }
          }}
        >
          {apartment.archived ? (
            <ArrowCounterClockwise size={18} aria-hidden="true" />
          ) : (
            <Archive size={18} aria-hidden="true" />
          )}
          {t(locale, apartment.archived ? "restore" : "archive")}
        </Button>
      )}
      {!confirmArchive && <ErrorNotice>{error}</ErrorNotice>}
      {children}
      <Dialog
        open={confirmArchive}
        onClose={() => {
          if (!saving) setConfirmArchive(false);
        }}
        title={t(locale, "archiveApartmentTitle")}
        description={t(locale, "archiveApartmentDescription")}
        locale={locale}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <p className="archive-property-name">{apartment.name}</p>
        <ErrorNotice>{error}</ErrorNotice>
        <div className="form-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={saving}
            onClick={() => setConfirmArchive(false)}
          >
            {t(locale, "cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={saving}
            onClick={async () => {
              if (await update({ archived: true })) setConfirmArchive(false);
            }}
          >
            <Archive size={18} aria-hidden="true" />
            {t(locale, saving ? "saving" : "archive")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
