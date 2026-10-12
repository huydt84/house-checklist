"use client";
import { useRef, useState } from "react";
import { FileXls } from "@phosphor-icons/react";
import { useHouse } from "./context";
import { Button } from "./ui";
import { t } from "../lib/i18n.mjs";
import { downloadBlob } from "../lib/client-store.mjs";

export default function ExcelExport({ apartmentIds, filters, disabled }) {
  const { snapshot, locale, pending, conflicts, online } = useHouse();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  async function download() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const captured = structuredClone({
        snapshot,
        apartmentIds,
        filters,
        locale,
        pending,
        conflicts,
        online,
        generatedAt: new Date().toISOString(),
      });
      const { createComparisonExcel } = await import("../lib/excel-report.mjs");
      const { blob, filename } = await createComparisonExcel(captured);
      downloadBlob(blob, filename);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="excel-export">
      <Button
        variant="secondary"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={download}
      >
        <FileXls size={18} />
        {t(locale, busy ? "generatingExcel" : "exportExcel")}
      </Button>
      {busy && (
        <span className="sr-only" role="status">
          {t(locale, "generatingExcel")}
        </span>
      )}
      {error && (
        <p className="excel-export-error" role="alert">
          {t(locale, "excelExportError")}
        </p>
      )}
    </div>
  );
}
