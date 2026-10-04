"use client";
import { useState, useEffect } from "react";
import {
  UploadSimple,
  Link,
  FilePdf,
  ArrowSquareOut,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useHouse, Form, Fields } from "../context";
import { Button, Dialog, Empty, Chip, ErrorNotice } from "../ui";
import { t, errorText } from "../../lib/i18n.mjs";
import { textFor } from "../../lib/domain.mjs";
import {
  queueFile,
  getCachedFile,
  downloadBlob,
  retryUpload,
} from "../../lib/client-store.mjs";
export default function Files({ apartmentId }) {
  const { locale, snapshot, editable, session, save, uploads, sync } =
    useHouse();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(null);
  const records = snapshot.records.filter(
    (r) =>
      r.kind === "attachment" && r.apartmentId === apartmentId && !r.archived,
  );
  return (
    <>
      <div className="files-toolbar">
        <p>{t(locale, "fileHelp")}</p>
        <div className="button-row">
          <Button
            variant="secondary"
            disabled={!editable}
            onClick={() => setOpen(true)}
          >
            <Link />
            {t(locale, "addLink")}
          </Button>
          <label
            className={`button primary file-button ${!editable ? "disabled" : ""}`}
          >
            <UploadSimple />
            {t(locale, "upload")}
            <input
              type="file"
              disabled={!editable}
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={async (e) => {
                for (const file of e.target.files)
                  try {
                    await queueFile(
                      session.user.id,
                      snapshot.collection.id,
                      apartmentId,
                      null,
                      file,
                      session.local,
                    );
                  } catch (err) {
                    setError(errorText(locale, err));
                  }
                e.target.value = "";
                await sync();
              }}
            />
          </label>
        </div>
      </div>
      <ErrorNotice>{error}</ErrorNotice>
      {uploads
        .filter((u) => u.apartmentId === apartmentId)
        .map((u) => (
          <div className="record-row" key={u.id}>
            <span>{u.name}</span>
            <Chip>
              {t(locale, u.status === "failed" ? "retryNeeded" : "queued")}
            </Chip>
            <Button
              variant="secondary"
              onClick={async () => {
                await retryUpload(u.id);
                await sync();
              }}
            >
              {t(locale, "retry")}
            </Button>
          </div>
        ))}
      {!records.length ? (
        <Empty
          title={t(locale, "noFiles")}
          description={t(locale, "noFilesText")}
        />
      ) : (
        <div className="file-grid">
          {records.map((file) => (
            <FileTile key={file.id} file={file} />
          ))}
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, "addLink")}
        locale={locale}
      >
        <Form
          showFieldStatus
          initial={{ name: "", url: "" }}
          onSubmit={async (v) => {
            await save(
              "record.put",
              null,
              { ...v, kind: "attachment", storage: "link" },
              { apartmentId },
            );
            setOpen(false);
          }}
        >
          {(v, u) => (
            <Fields
              keys={["name", "url"]}
              value={v}
              update={u}
              types={{ url: "url" }}
            />
          )}
        </Form>
      </Dialog>
    </>
  );
}
function FileTile({ file }) {
  const { locale, snapshot, session, online, editable, save } = useHouse();
  const [cached, setCached] = useState(null),
    [src, setSrc] = useState("");
  useEffect(() => {
    let url,
      cancelled = false;
    void getCachedFile(session.user.id, file.id).then((blob) => {
      if (blob && !cancelled) {
        setCached(blob);
        url = URL.createObjectURL(blob);
        setSrc(url);
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, session.user.id]);
  const url =
    file.url ||
    src ||
    `/api/collections/${snapshot.collection.id}/files/${file.id}`;
  return (
    <article className="file-tile">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={file.name}
        className="file-preview"
        onClick={(e) => {
          if (!online && !cached) e.preventDefault();
        }}
      >
        {file.mime?.startsWith("image/") && (online || cached) ? (
          <img src={url} alt={file.name} />
        ) : file.storage === "link" ? (
          <Link size={42} />
        ) : (
          <FilePdf size={42} />
        )}
      </a>
      <div>
        <strong>{file.name}</strong>
        {file.criterionId && (
          <small>
            {textFor(
              snapshot.criteria.find((c) => c.id === file.criterionId),
              locale,
            )}
            {file.scenarioId
              ? ` · ${snapshot.scenarios.find((s) => s.id === file.scenarioId)?.name || ""}`
              : ""}
          </small>
        )}
        <small>
          {file.mime || t(locale, "url")}
          {file.size ? ` · ${(file.size / 1048576).toFixed(1)} MB` : ""}
        </small>
        <small>{t(locale, cached ? "prepared" : "notOffline")}</small>
        <div className="button-row">
          <a
            className="text-button"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ArrowSquareOut />
            {t(locale, "open")}
          </a>
          {cached && (
            <button
              className="text-button"
              onClick={() => downloadBlob(cached, file.name)}
            >
              <DownloadSimple />
              {t(locale, "save")}
            </button>
          )}
          {editable && (
            <button
              className="text-button"
              onClick={() =>
                save(
                  "record.put",
                  file,
                  { archived: true },
                  { apartmentId: file.apartmentId },
                )
              }
            >
              {t(locale, "archive")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
