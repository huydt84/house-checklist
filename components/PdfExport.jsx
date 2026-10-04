"use client";
import { useRef, useState } from "react";
import { FilePdf } from "@phosphor-icons/react";
import { useHouse } from "./context";
import { Button } from "./ui";
import { t } from "../lib/i18n.mjs";

export default function PdfExport({
  kind,
  apartmentIds,
  filters = {},
  disabled = false,
}) {
  const { locale, snapshot, pending, conflicts, online, uploads } = useHouse();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <div className="pdf-export">
      <Button
        variant="secondary"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError(false);
          try {
            const captured = structuredClone({
              snapshot,
              apartmentIds,
              kind,
              filters,
              locale,
              pending,
              conflicts,
              online,
              uploads: uploads.map(({ name, apartmentId, status }) => ({
                name,
                apartmentId,
                status,
              })),
              generatedAt: new Date().toISOString(),
            });
            const [{ buildPdfReport }, { downloadPdf }] = await Promise.all([
              import("../lib/pdf-report.mjs"),
              import("../lib/pdf-download.mjs"),
            ]);
            await downloadPdf(buildPdfReport(captured));
          } catch {
            setError(true);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <FilePdf size={18} />
        {t(locale, busy ? "generatingPdf" : "exportPdf")}
      </Button>
      {busy && (
        <span className="sr-only" role="status">
          {t(locale, "generatingPdf")}
        </span>
      )}
      {error && (
        <p className="pdf-export-error" role="alert">
          {t(locale, "pdfExportError")}
        </p>
      )}
    </div>
  );
}
