"use client";
import { useRef } from "react";
import { Form, useHouse } from "./context";
import { Dialog, Field } from "./ui";
import { t } from "../lib/i18n.mjs";

export default function RenameDialog({ open, onClose, record, kind }) {
  const { locale, save } = useHouse();
  const nameInput = useRef(null);
  const collection = kind === "collection";
  const maxLength = collection ? 120 : 200;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, collection ? "renameCollection" : "renameProperty")}
      locale={locale}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        nameInput.current?.focus();
      }}
    >
      <Form
        initial={{ name: record.name }}
        onCancel={onClose}
        onSubmit={async ({ name }) => {
          if (!name.trim() || name.length > maxLength)
            throw { error: "NAME_REQUIRED" };
          if (name.trim() !== record.name)
            await save(`${kind}.put`, record, { name: name.trim() });
          onClose();
        }}
      >
        {(value, update) => (
          <Field
            ref={nameInput}
            label={t(locale, collection ? "collectionName" : "propertyName")}
            value={value.name}
            onChange={(name) => update("name", name)}
            required
            maxLength={maxLength}
            autoFocus
            onFocus={(event) => event.target.select()}
          />
        )}
      </Form>
    </Dialog>
  );
}
