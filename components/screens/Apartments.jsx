"use client";
import { useState } from "react";
import { RouteLink, useRouteState } from "../navigation";
import {
  Plus,
  ArrowRight as OpenArrow,
  MagnifyingGlass,
  Buildings,
  ArrowRight,
  Columns,
  DotsSixVertical,
  MapPin,
} from "@phosphor-icons/react";
import { useHouse, PageTitle, Form } from "../context";
import { Button, Dialog, Field, SelectField, Empty, ErrorNotice } from "../ui";
import ApartmentStateControls from "../ApartmentStateControls";
import { usePropertyReorder } from "../usePropertyReorder";
import {
  STATUSES,
  completion,
  fieldValue,
  fieldAnswer,
  orderedApartments,
} from "../../lib/domain.mjs";
import { Value } from "../AnswerControl";
import { apartmentCosts } from "../../lib/calculations.mjs";
import { money, t, dateLabel } from "../../lib/i18n.mjs";
export default function Apartments() {
  const {
    locale,
    snapshot,
    editable,
    save,
    navigate,
    selected,
    toggleCompare,
    clearCompare,
    navigationPatch,
  } = useHouse();
  const [search, setSearch] = useRouteState("q", "", { replace: true }),
    [status, setStatus] = useRouteState("status"),
    [open, setOpen] = useState(false),
    [archived, setArchived] = useRouteState("archived", false);
  const all = orderedApartments(snapshot).filter(
    (a) => Boolean(a.archived) === archived,
  );
  const layoutCriterion = snapshot.criteria.find((c) => c.key === "A03");
  const list = all.filter(
    (a) =>
      (!status || a.status === status) &&
      `${a.name} ${a.address || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const reorder = usePropertyReorder({ list, snapshot, save, locale });
  return (
    <>
      <PageTitle
        title={t(locale, "apartments")}
        description={t(locale, "welcomeText")}
      >
        {editable && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={18} />
            {t(locale, "addApartment")}
          </Button>
        )}
      </PageTitle>
      {(snapshot.apartments.length > 0 || archived) && (
        <div className="list-toolbar">
          <div className="search-field">
            <MagnifyingGlass size={19} />
            <input
              aria-label={t(locale, "search")}
              placeholder={t(locale, "search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <SelectField
            label={t(locale, "status")}
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: t(locale, "allStatuses") },
              ...STATUSES.map((value) => ({ value, label: t(locale, value) })),
            ]}
          />
          <button
            className="text-button"
            onClick={() => setArchived((v) => !v)}
          >
            {t(locale, archived ? "apartments" : "showArchived")}
          </button>
        </div>
      )}
      {editable && all.length > 1 && (
        <p className="property-reorder-help" id="property-reorder-help">
          {t(locale, "reorderHelp")}
        </p>
      )}
      <ErrorNotice>{reorder.error}</ErrorNotice>
      <span className="sr-only" role="status" aria-live="polite">
        {reorder.announcement}
      </span>
      {!all.length ? (
        <Empty
          title={t(locale, "emptyApartments")}
          description={t(locale, "emptyApartmentsText")}
        >
          <Button onClick={() => setOpen(true)} disabled={!editable}>
            <Plus />
            {t(locale, "addApartment")}
          </Button>
          {archived && (
            <Button variant="secondary" onClick={() => setArchived(false)}>
              {t(locale, "back")}
            </Button>
          )}
        </Empty>
      ) : (
        <div
          className="property-list"
          ref={reorder.root}
          {...reorder.pointerHandlers}
        >
          <div className="property-list-header">
            <span>
              {t(locale, "apartments")}{" "}
              <span className="count">{list.length}</span>
            </span>
            <span>{t(locale, "monthlyHousing")}</span>
            <span>{t(locale, "viewing")}</span>
            <span>{t(locale, "answered")}</span>
          </div>
          {reorder.displayed.map((a) => {
            const costs = apartmentCosts(snapshot, a.id);
            const c = completion(snapshot, a.id),
              area = fieldValue(snapshot, a.id, "A02"),
              photo = snapshot.records.find(
                (r) =>
                  r.kind === "attachment" &&
                  r.apartmentId === a.id &&
                  r.mime?.startsWith("image/") &&
                  r.uploadState === "ready" &&
                  !r.archived,
              );
            return (
              <article
                className={`property-row${reorder.activeId === a.id ? " is-reordering" : ""}`}
                key={a.id}
                data-property-id={a.id}
              >
                <div className="property-main">
                  <label className="selection-control">
                    <input
                      type="checkbox"
                      aria-label={`${t(locale, "selectCompare")}: ${a.name}`}
                      checked={selected.includes(a.id)}
                      disabled={
                        a.archived ||
                        (!selected.includes(a.id) && selected.length === 4)
                      }
                      onChange={() => toggleCompare(a.id)}
                    />
                  </label>
                  <RouteLink
                    className="property-image"
                    patch={navigationPatch("apartments", a.id)}
                    aria-label={a.name}
                  >
                    {photo ? (
                      <img
                        src={`/api/collections/${snapshot.collection.id}/files/${photo.id}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <Buildings size={42} weight="thin" />
                    )}
                  </RouteLink>
                  <div>
                    <RouteLink
                      className="property-name"
                      patch={navigationPatch("apartments", a.id)}
                    >
                      {a.name}
                      <OpenArrow size={17} aria-hidden="true" />
                    </RouteLink>
                    <p>{a.address || t(locale, "addressMissing")}</p>
                    <div className="property-tags">
                      <span>{area == null ? "—" : `${area} m²`}</span>
                      {layoutCriterion && fieldAnswer(snapshot, a.id, "A03") ? (
                        <Value
                          answer={fieldAnswer(snapshot, a.id, "A03")}
                          criterion={layoutCriterion}
                          locale={locale}
                        />
                      ) : (
                        <span>—</span>
                      )}
                      {a.mapUrl && (
                        <a
                          className="text-button property-map-link"
                          href={a.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin size={17} aria-hidden="true" />
                          {t(locale, "openGoogleMaps")}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="property-cost">
                  <small>{t(locale, "monthlyHousing")}</small>
                  <strong>
                    {costs.monthly == null
                      ? t(locale, "costNotEntered")
                      : money(costs.monthly, locale)}
                  </strong>
                  {costs.monthly == null ? (
                    <>
                      <small>
                        {t(locale, "missing")}:{" "}
                        {["H01", "H02"]
                          .filter(
                            (key) =>
                              fieldValue(snapshot, a.id, key) == null &&
                              fieldAnswer(snapshot, a.id, key)?.state !==
                                "not_applicable",
                          )
                          .map((key) =>
                            t(locale, key === "H01" ? "rent" : "management"),
                          )
                          .join(" + ")}
                      </small>
                      <RouteLink
                        className="text-button"
                        patch={navigationPatch("apartments", a.id, {
                          tab: "costs",
                        })}
                      >
                        {t(locale, editable ? "enterCosts" : "viewCosts")}
                        <ArrowRight size={16} />
                      </RouteLink>
                    </>
                  ) : (
                    <small>{t(locale, "rentPlusManagement")}</small>
                  )}
                </div>
                <div className="property-viewing">
                  {a.viewingAt ? (
                    <>
                      <span>{dateLabel(a.viewingAt, locale, true)}</span>
                      <small>Asia/Tokyo</small>
                    </>
                  ) : (
                    <span className="muted">
                      {t(locale, "viewingNotScheduled")}
                    </span>
                  )}
                </div>
                <div className="property-progress">
                  <strong>
                    {c.answered}
                    <span> / {c.total}</span>
                  </strong>
                  <small>
                    {c.requirements > 0
                      ? `${c.requirements} ${t(locale, "requirements")}`
                      : t(locale, "answered")}
                  </small>
                </div>
                <ApartmentStateControls apartment={a}>
                  {editable && all.length > 1 && (
                    <button
                      type="button"
                      className="property-reorder-handle"
                      aria-label={`${t(locale, "reorderProperty")}: ${a.name}`}
                      {...reorder.bind(a.id)}
                    >
                      <DotsSixVertical size={20} aria-hidden="true" />
                      {t(locale, "reorder")}
                    </button>
                  )}
                </ApartmentStateControls>
              </article>
            );
          })}
          {!list.length && (
            <div className="empty-filter">
              <p>{t(locale, "noResults")}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
              >
                {t(locale, "clearFilters")}
              </Button>
            </div>
          )}
        </div>
      )}
      {selected.length > 0 && (
        <div className="compare-tray">
          <Columns size={22} aria-hidden="true" />
          <span>
            {selected.length} / 4 · {t(locale, "selectedCount")}
          </span>
          <button className="text-button" onClick={clearCompare}>
            {t(locale, "clearSelection")}
          </button>
          {selected.length < 2 && <small>{t(locale, "selectOneMore")}</small>}
          <Button
            disabled={selected.length < 2}
            onClick={() => navigate("compare")}
          >
            {t(locale, "compare")}
            <ArrowRight size={18} />
          </Button>
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, "addApartment")}
        description={t(locale, "emptyApartmentsText")}
        locale={locale}
      >
        <Form
          onSubmit={async (v) => {
            const id = await save("apartment.put", null, {
              name: v.name,
              address: (v.address || "").trim(),
              mapUrl: (v.mapUrl || "").trim(),
              status: "considering",
            });
            setOpen(false);
            navigate("apartments", id);
          }}
          submitLabel="add"
        >
          {(v, u) => (
            <>
              <Field
                label={t(locale, "name")}
                value={v.name}
                onChange={(x) => u("name", x)}
                required
                autoFocus
                maxLength={200}
              />
              <Field
                label={t(locale, "address")}
                value={v.address}
                onChange={(x) => u("address", x)}
                autoComplete="street-address"
              />
              <Field
                label={t(locale, "mapUrl")}
                type="url"
                value={v.mapUrl}
                onChange={(x) => u("mapUrl", x)}
              />
            </>
          )}
        </Form>
      </Dialog>
    </>
  );
}
