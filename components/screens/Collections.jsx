"use client";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  PencilSimple,
  Archive,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { PageTitle, useHouse } from "../context";
import { Button, Chip, Empty, ErrorNotice } from "../ui";
import { RouteLink, useRouteState } from "../navigation";
import { t, errorText } from "../../lib/i18n.mjs";

export default function Collections({
  collectionPatch,
  onCreate,
  onArchive,
  onRefresh,
}) {
  const { locale, session, online, snapshot } = useHouse();
  const [archived, setArchived] = useRouteState("archivedCollections", false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const collections = (session.collections || [])
    .map((c) =>
      snapshot?.collection.id === c.id &&
      snapshot.collection.revision > c.revision
        ? { ...c, ...snapshot.collection }
        : c,
    )
    .filter((c) => Boolean(c.archived) === archived);
  const changeArchive = async (collection) => {
    setBusy(collection.id);
    setError(null);
    setNotice("");
    try {
      await onArchive(collection, !collection.archived);
      setNotice(
        `${collection.name}: ${t(locale, collection.archived ? "collectionRestored" : "collectionArchived")}`,
      );
    } catch (e) {
      setError(errorText(locale, e));
      if (e.status === 409) await onRefresh().catch(() => {});
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="collections-screen">
      <PageTitle
        title={t(locale, "collections")}
        description={t(locale, "collectionsDescription")}
      >
        <Button onClick={onCreate} disabled={!online}>
          <Plus size={18} aria-hidden="true" />
          {t(locale, "newCollection")}
        </Button>
        <Button
          variant="secondary"
          aria-pressed={archived}
          onClick={() => setArchived(!archived)}
        >
          <Archive size={18} aria-hidden="true" />
          {t(locale, archived ? "collections" : "showArchived")}
        </Button>
      </PageTitle>
      {!online && (
        <p className="muted">{t(locale, "collectionActionsOnline")}</p>
      )}
      <ErrorNotice>{error}</ErrorNotice>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {collections.length ? (
        <ul className="collection-list" aria-label={t(locale, "collections")}>
          {collections.map((collection) => (
            <li key={collection.id} className="collection-row">
              <div className="collection-identity">
                <RouteLink
                  className="collection-name"
                  patch={collectionPatch(collection.id)}
                >
                  {collection.name}
                  <ArrowRight size={18} aria-hidden="true" />
                </RouteLink>
                <Chip>{t(locale, collection.role)}</Chip>
                {collection.archived && <Chip>{t(locale, "archived")}</Chip>}
              </div>
              <div className="collection-actions">
                {collection.role !== "viewer" && !collection.archived && (
                  <RouteLink
                    className="button secondary"
                    patch={collectionPatch(collection.id, "preferences")}
                  >
                    <PencilSimple size={18} aria-hidden="true" />
                    {t(locale, "editCollection")}
                  </RouteLink>
                )}
                {collection.role === "owner" && (
                  <Button
                    variant="secondary"
                    disabled={!online || busy !== null}
                    onClick={() => void changeArchive(collection)}
                  >
                    {collection.archived ? (
                      <ArrowCounterClockwise size={18} aria-hidden="true" />
                    ) : (
                      <Archive size={18} aria-hidden="true" />
                    )}
                    {t(
                      locale,
                      busy === collection.id
                        ? "saving"
                        : collection.archived
                          ? "restore"
                          : "archive",
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title={t(
            locale,
            archived ? "noArchivedCollections" : "noCollections",
          )}
          description={t(
            locale,
            archived ? "noArchivedCollectionsText" : "noCollectionsText",
          )}
        />
      )}
    </div>
  );
}
