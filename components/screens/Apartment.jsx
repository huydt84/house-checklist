"use client";
import { useState } from "react";
import { RouteLink, useRouteState } from "../navigation";
import {
  ArrowLeft,
  ArrowRight,
  DownloadSimple,
  ArrowsOut,
  ArrowsIn,
  MapPin,
  Phone,
  ArrowSquareOut,
  PencilSimple,
} from "@phosphor-icons/react";
import { useHouse, PageTitle, Form, Fields } from "../context";
import {
  Button,
  Dialog,
  Field,
  SelectField,
  Toggle,
  Empty,
  ErrorNotice,
  FieldStatus,
} from "../ui";
import {
  completion,
  textFor,
  activeCriteria,
  findAnswer,
  answerState,
  answerRows,
  meaningful,
} from "../../lib/domain.mjs";
import { t, dateLabel, errorText } from "../../lib/i18n.mjs";
import { prepareViewing } from "../../lib/client-store.mjs";
import PdfExport from "../PdfExport";
import AnswerControl from "../AnswerControl";
import RenameDialog from "../RenameDialog";
import ApartmentStateControls from "../ApartmentStateControls";
import Costs from "./Costs";
import Travel, { TravelOverview } from "./Travel";
import Files from "./Files";
import { CriteriaSearchField, CriteriaSearchResults } from "../CriteriaSearch";
const canonical = ["A02", "A03", "A05", "H01", "H02"];
export default function Apartment({ id }) {
  const {
    locale,
    snapshot,
    editable,
    save,
    navigationPatch,
    online,
    session,
    setNotice,
    full,
    setFull,
  } = useHouse();
  const [routeTab, setTab] = useRouteState("tab", "overview"),
    [edit, setEdit] = useState(false),
    [editAddress, setEditAddress] = useState(false),
    [rename, setRename] = useState(false),
    [error, setError] = useState(null),
    [preparing, setPreparing] = useState(false);
  const [query, setQuery] = useState("");
  const tab = ["overview", "viewing", "costs", "travel", "photos"].includes(
    routeTab,
  )
    ? routeTab
    : "overview";
  const apt = snapshot.apartments.find((a) => a.id === id);
  if (!apt)
    return (
      <Empty title={t(locale, "notFound")}>
        <RouteLink
          className="button primary"
          patch={navigationPatch("apartments")}
        >
          {t(locale, "apartments")}
        </RouteLink>
      </Empty>
    );
  const c = completion(
    {
      ...snapshot,
      criteria: snapshot.criteria.filter((c) => c.scope !== "journey"),
    },
    id,
  );
  return (
    <>
      <div className="detail-back">
        <RouteLink
          className="text-button"
          patch={navigationPatch("apartments")}
        >
          <ArrowLeft />
          {t(locale, "apartments")}
        </RouteLink>
      </div>
      <PageTitle title={apt.name} description={apt.address}>
        {editable && (
          <>
            <Button variant="secondary" onClick={() => setRename(true)}>
              <PencilSimple size={18} aria-hidden="true" />
              {t(locale, "renameProperty")}
            </Button>
            <Button variant="secondary" onClick={() => setEditAddress(true)}>
              <MapPin size={18} aria-hidden="true" />
              {t(locale, "editAddress")}
            </Button>
          </>
        )}
        <PdfExport kind="property" apartmentIds={[id]} />
        {tab === "viewing" && (
          <Button variant="secondary" onClick={() => setFull(!full)}>
            {full ? <ArrowsIn /> : <ArrowsOut />}
            {t(locale, full ? "exitViewing" : "viewingMode")}
          </Button>
        )}
        <Button
          disabled={!online || preparing}
          variant="secondary"
          onClick={async () => {
            setPreparing(true);
            try {
              await prepareViewing(session.user.id, snapshot, id);
              setNotice(t(locale, "prepared"));
              setTab("viewing");
            } catch (e) {
              console.warn("Viewing preparation failed", e?.name, e?.message);
              setError(errorText(locale, e));
            } finally {
              setPreparing(false);
            }
          }}
        >
          <DownloadSimple size={18} />
          {t(locale, preparing ? "saving" : "prepare")}
        </Button>
      </PageTitle>
      <ApartmentStateControls apartment={apt}>
        <CriteriaSearchField query={query} onChange={setQuery} />
      </ApartmentStateControls>
      <ErrorNotice>{error}</ErrorNotice>
      <div
        className="detail-tabs"
        role="tablist"
        aria-label={apt.name}
        onKeyDown={(e) => {
          const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
          const index = tabs.indexOf(document.activeElement);
          const next =
            e.key === "ArrowRight"
              ? (index + 1) % tabs.length
              : e.key === "ArrowLeft"
                ? (index + tabs.length - 1) % tabs.length
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? tabs.length - 1
                    : -1;
          if (next < 0) return;
          e.preventDefault();
          tabs[next].focus();
          tabs[next].click();
        }}
      >
        {["overview", "viewing", "costs", "travel", "photos"].map((key) => (
          <RouteLink
            role="tab"
            id={`tab-${key}`}
            aria-controls="property-panel"
            tabIndex={tab === key ? 0 : -1}
            aria-selected={tab === key}
            key={key}
            patch={{ tab: key }}
            onNavigate={() => setQuery("")}
          >
            {t(locale, key)}
            {key === "viewing" && (
              <span>
                {c.answered}/{c.total}
              </span>
            )}
          </RouteLink>
        ))}
      </div>
      <div
        id="property-panel"
        role={query.trim() ? "region" : "tabpanel"}
        aria-labelledby={
          query.trim() ? "criteria-search-heading" : `tab-${tab}`
        }
      >
        {query.trim() ? (
          <CriteriaSearchResults
            apartmentId={id}
            query={query}
            onClear={() => setQuery("")}
          />
        ) : tab === "overview" ? (
          <>
            <div className="overview-top">
              <div className="panel overview-summary">
                <div className="section-heading">
                  <h2>{t(locale, "overview")}</h2>
                  {editable && (
                    <button
                      className="text-button"
                      onClick={() => setEdit(true)}
                    >
                      <PencilSimple />
                      {t(locale, "edit")}
                    </button>
                  )}
                </div>
                <dl className="facts-grid">
                  {[
                    "room",
                    "viewingAt",
                    "rentStart",
                    "agentName",
                    "agentEmail",
                    "agentPhone",
                  ].map((key) => (
                    <div key={key}>
                      <dt className="field-label">
                        {t(locale, key)}
                        {meaningful(apt[key], "text") && (
                          <FieldStatus value={apt[key]} locale={locale} />
                        )}
                      </dt>
                      <dd>
                        {apt[key]
                          ? key === "status"
                            ? t(locale, apt[key])
                            : key === "viewingAt"
                              ? dateLabel(apt[key], locale, true)
                              : apt[key]
                          : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="button-row">
                  {apt.mapUrl && (
                    <a
                      className="button secondary"
                      href={apt.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin />
                      {t(locale, "mapUrl")}
                    </a>
                  )}
                  {apt.listingUrls?.map((url, i) => (
                    <a
                      className="button secondary"
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowSquareOut />
                      {t(locale, "listing")} {i + 1}
                    </a>
                  ))}
                  {apt.agentPhone && (
                    <a
                      className="button secondary"
                      href={`tel:${apt.agentPhone}`}
                    >
                      <Phone />
                      {t(locale, "agentPhone")}
                    </a>
                  )}
                </div>
              </div>
              <div className="viewing-summary">
                <p className="eyebrow">{t(locale, "viewing")}</p>
                <strong>
                  {c.answered}
                  <span> / {c.total}</span>
                </strong>
                <p>
                  {c.total ? t(locale, "answered") : t(locale, "noApplicable")}
                </p>
                {c.journeysMissing && (
                  <p className="muted">{t(locale, "journeysMissing")}</p>
                )}
                <Button onClick={() => setTab("viewing")}>
                  {t(locale, "viewing")}
                  <ArrowRight />
                </Button>
              </div>
            </div>
            <div className="canonical-grid">
              {canonical.map((key) => {
                const criterion = snapshot.criteria.find((c) => c.key === key);
                return (
                  criterion && (
                    <AnswerControl
                      key={key}
                      apartmentId={id}
                      criterion={criterion}
                      compact
                    />
                  )
                );
              })}
            </div>
            <TravelOverview apartmentId={id} />
            <div className="summary-notes">
              {["advantages", "disadvantages", "rejectionReason"]
                .filter((key) => apt[key])
                .map((key) => (
                  <div key={key}>
                    <h2>{t(locale, key)}</h2>
                    <p>{apt[key]}</p>
                  </div>
                ))}
            </div>
          </>
        ) : tab === "viewing" ? (
          <Checklist apartmentId={id} />
        ) : tab === "costs" ? (
          <Costs apartmentId={id} />
        ) : tab === "travel" ? (
          <Travel apartmentId={id} />
        ) : (
          <Files apartmentId={id} />
        )}
      </div>
      <Dialog
        open={editAddress}
        onClose={() => setEditAddress(false)}
        title={t(locale, "editAddress")}
        locale={locale}
      >
        <Form
          showFieldStatus
          initial={{ address: apt.address || "", mapUrl: apt.mapUrl || "" }}
          onCancel={() => setEditAddress(false)}
          onSubmit={async (v) => {
            await save("apartment.put", apt, {
              address: v.address.trim(),
              mapUrl: v.mapUrl.trim(),
            });
            setEditAddress(false);
          }}
        >
          {(v, u) => (
            <>
              <Field
                label={t(locale, "address")}
                value={v.address}
                onChange={(x) => u("address", x)}
                autoComplete="street-address"
                autoFocus
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
      <RenameDialog
        open={rename}
        onClose={() => setRename(false)}
        record={apt}
        kind="apartment"
      />
      <Dialog
        open={edit}
        onClose={() => setEdit(false)}
        title={t(locale, "edit")}
        locale={locale}
        wide
      >
        <Form
          showFieldStatus
          initial={{
            ...apt,
            listingUrls: (apt.listingUrls || []).join("\n"),
            viewingAt: apt.viewingAt
              ? new Date(new Date(apt.viewingAt).getTime() + 9 * 3600000)
                  .toISOString()
                  .slice(0, 16)
              : "",
          }}
          onSubmit={async (v) => {
            await save("apartment.put", apt, {
              ...v,
              listingUrls: v.listingUrls
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              viewingAt: v.viewingAt ? `${v.viewingAt}:00+09:00` : "",
            });
            setEdit(false);
          }}
        >
          {(v, u) => (
            <>
              <div className="form-grid">
                <Fields
                  keys={[
                    "name",
                    "room",
                    "address",
                    "agentName",
                    "agentEmail",
                    "agentPhone",
                    "mapUrl",
                  ]}
                  value={v}
                  update={u}
                  types={{
                    agentEmail: "email",
                    agentPhone: "tel",
                    mapUrl: "url",
                  }}
                />
                <Field
                  label={`${t(locale, "viewingAt")} · Asia/Tokyo`}
                  type="datetime-local"
                  value={v.viewingAt}
                  onChange={(x) => u("viewingAt", x)}
                />
                <Fields
                  keys={["rentStart", "handoverDate", "moveOutDate"]}
                  value={v}
                  update={u}
                  types={{
                    rentStart: "date",
                    handoverDate: "date",
                    moveOutDate: "date",
                  }}
                />
              </div>
              <Fields
                keys={[
                  "listingUrls",
                  "advantages",
                  "disadvantages",
                  "rejectionReason",
                ]}
                value={v}
                update={u}
                types={{
                  listingUrls: "textarea",
                  advantages: "textarea",
                  disadvantages: "textarea",
                  rejectionReason: "textarea",
                }}
              />
            </>
          )}
        </Form>
      </Dialog>
    </>
  );
}
function Checklist({ apartmentId }) {
  const { locale, snapshot } = useHouse();
  const sections = snapshot.sections
    .filter((s) => s.enabled && s.key !== "B")
    .sort((a, b) => a.order - b.order);
  const [section, setSection] = useRouteState(
      "viewSection",
      sections[0]?.id || "",
    ),
    [stage, setStage] = useRouteState("viewStage"),
    [unanswered, setUnanswered] = useRouteState("viewUnanswered", false),
    [required, setRequired] = useRouteState("viewRequired", false);
  const currentSection = sections.find((s) => s.id === section) || sections[0];
  const progress = new Map(
    sections.map((s) => [s.id, { answered: 0, total: 0 }]),
  );
  for (const { criterion, scenarioId } of answerRows(snapshot)) {
    const state = answerState(
      findAnswer(snapshot, apartmentId, criterion.id, scenarioId),
      criterion,
    );
    if (state === "not_applicable") continue;
    const count = progress.get(criterion.sectionId);
    if (count) {
      count.total++;
      if (state === "answered") count.answered++;
    }
  }
  const progressLabel = (s) => {
    const count = progress.get(s.id);
    return `${count.answered}/${count.total} ${t(locale, "answered")}`;
  };
  const list = activeCriteria(snapshot).filter(
    (c) =>
      c.sectionId === currentSection?.id &&
      c.scope !== "journey" &&
      (!stage || c.stages.includes(stage)) &&
      (!required || c.importance === "requirement") &&
      (!unanswered ||
        answerState(findAnswer(snapshot, apartmentId, c.id), c) ===
          "not_checked"),
  );
  return (
    <div className="checklist-layout">
      <aside className="section-nav">
        <p className="eyebrow">{t(locale, "section")}</p>
        {sections.map((s) => (
          <button
            key={s.id}
            className={s.id === currentSection?.id ? "active" : ""}
            onClick={() => setSection(s.id)}
          >
            <span>{s.key}</span>
            <span className="section-name">{textFor(s, locale)}</span>
            <span className="section-progress">
              {progress.get(s.id).answered}/{progress.get(s.id).total}
            </span>
          </button>
        ))}
      </aside>
      <div className="checklist-main">
        <div className="section-select">
          <SelectField
            label={t(locale, "section")}
            value={currentSection?.id || ""}
            onChange={setSection}
            options={sections.map((s) => ({
              value: s.id,
              label: `${s.key}. ${textFor(s, locale)} · ${progressLabel(s)}`,
            }))}
          />
        </div>
        <div className="checklist-filter">
          <SelectField
            label={t(locale, "stages")}
            value={stage}
            onChange={setStage}
            options={[
              { value: "", label: t(locale, "allStages") },
              ...["L", "A", "V", "S"].map((value) => ({
                value,
                label: t(locale, value),
              })),
            ]}
          />
          <Toggle
            label={t(locale, "unanswered")}
            checked={unanswered}
            onChange={setUnanswered}
          />
          <Toggle
            label={t(locale, "requirements")}
            checked={required}
            onChange={setRequired}
          />
        </div>
        <div className="section-intro">
          <p className="eyebrow">{currentSection?.key}</p>
          <h2>{textFor(currentSection, locale)}</h2>
          <span>{currentSection && progressLabel(currentSection)}</span>
        </div>
        {list.map((c) => (
          <AnswerControl key={c.id} apartmentId={apartmentId} criterion={c} />
        ))}
        {!list.length && (
          <p className="empty-filter">{t(locale, "noMatchingChecks")}</p>
        )}
      </div>
    </div>
  );
}
