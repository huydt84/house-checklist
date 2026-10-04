"use client";
import { RouteLink, useRouteState, updateLocation } from "../navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  Envelope,
  ArrowRight,
  Copy,
  CheckSquare,
} from "@phosphor-icons/react";
import { useHouse, PageTitle, Form, Fields } from "../context";
import {
  Button,
  Dialog,
  Field,
  SelectField,
  Toggle,
  Chip,
  ErrorNotice,
} from "../ui";
import {
  t,
  errorText,
  dateLabel,
  localeNames,
  LOCALES,
} from "../../lib/i18n.mjs";
import { textFor, IMPORTANCE, STAGES } from "../../lib/domain.mjs";
import { request } from "../../lib/client-store.mjs";
export default function Settings({ page }) {
  const { locale, navigationPatch } = useHouse();
  return (
    <>
      <div className="settings-mobile-tabs">
        {["checklist", "preferences", "members"].map((key) => (
          <RouteLink
            className={page === key ? "active" : ""}
            key={key}
            patch={navigationPatch(key)}
            aria-current={page === key ? "page" : undefined}
          >
            {t(locale, key)}
          </RouteLink>
        ))}
      </div>
      {page === "checklist" ? (
        <ChecklistSettings />
      ) : page === "members" ? (
        <Members />
      ) : (
        <Preferences />
      )}
    </>
  );
}
function Preferences() {
  const {
    locale,
    navigationPatch,
    snapshot,
    editable,
    save,
    direct,
    refreshRemote,
    online,
    setNotice,
  } = useHouse();
  const setScenario = (value) =>
    updateLocation({ scenarioEditor: value.id || "new" });
  const [error, setError] = useState(null);
  const settings = snapshot.collection.settings;
  return (
    <>
      <PageTitle title={t(locale, "preferences")} />
      <div className="settings-stack">
        <section className="panel">
          <h2>{t(locale, "collection")}</h2>
          <Form
            initial={{ name: snapshot.collection.name, ...settings }}
            onSubmit={(v) =>
              save("collection.put", snapshot.collection, {
                name: v.name,
                settings: v,
              })
            }
          >
            {(v, u) => (
              <>
                <div className="form-grid">
                  <Fields
                    keys={[
                      "name",
                      "budget",
                      "minArea",
                      "maxWalkMinutes",
                      "workDestination",
                      "moveInDate",
                      "futonWidth",
                      "futonLength",
                      "allowanceAmount",
                      "allowanceRadius",
                    ]}
                    value={v}
                    update={u}
                    types={{
                      budget: "number",
                      minArea: "number",
                      maxWalkMinutes: "number",
                      moveInDate: "date",
                      futonWidth: "number",
                      futonLength: "number",
                      allowanceAmount: "number",
                      allowanceRadius: "number",
                    }}
                  />
                </div>
                <div className="button-row">
                  <Toggle
                    label={t(locale, "permanentDesk")}
                    checked={v.permanentDesk}
                    onChange={(x) => u("permanentDesk", x)}
                  />
                  <Toggle
                    label={t(locale, "preferDirect")}
                    checked={v.preferDirect}
                    onChange={(x) => u("preferDirect", x)}
                  />
                </div>
              </>
            )}
          </Form>
          <div className="preset">
            <p>{t(locale, "presetHelp")}</p>
            <Button
              disabled={!online || !editable}
              variant="secondary"
              onClick={async () => {
                try {
                  await request(
                    `/api/collections/${snapshot.collection.id}/preset`,
                    { method: "POST", body: "{}" },
                  );
                  await refreshRemote();
                  setNotice(t(locale, "saved"));
                } catch (e) {
                  setError(errorText(locale, e));
                }
              }}
            >
              {t(locale, "applyPreset")}
            </Button>
          </div>
        </section>
        <section className="panel">
          <h2>{t(locale, "checklist")}</h2>
          <p className="muted">{t(locale, "checklistManageHelp")}</p>
          <RouteLink
            className="button secondary"
            patch={navigationPatch("checklist")}
          >
            <CheckSquare aria-hidden="true" />
            {t(locale, editable ? "editChecklist" : "checklist")}
          </RouteLink>
        </section>
        <section>
          <div className="section-heading">
            <h2>{t(locale, "travel")}</h2>
            <Button
              disabled={!editable}
              variant="secondary"
              onClick={() =>
                setScenario({
                  name: "",
                  person: "",
                  purpose: "custom",
                  frequency: null,
                  frequencyUnit: "week",
                })
              }
            >
              <Plus />
              {t(locale, "newScenario")}
            </Button>
          </div>
          <p className="muted">{t(locale, "travelHelp")}</p>
          {snapshot.scenarios
            .filter((s) => !s.archived)
            .map((s) => (
              <div className="record-row" key={s.id}>
                <div>
                  <strong>
                    {s.person} · {s.name}
                  </strong>
                  <p>
                    {s.origin} → {s.destination} → {s.returnDestination}
                  </p>
                  <small>
                    {s.frequency ?? "—"} / {t(locale, s.frequencyUnit)}
                  </small>
                </div>
                <Button
                  disabled={!editable}
                  variant="secondary"
                  onClick={() => setScenario(s)}
                >
                  {t(locale, "edit")}
                </Button>
              </div>
            ))}
        </section>
        <section className="panel">
          <h2>{t(locale, "section")}</h2>
          {snapshot.sections
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <Toggle
                key={s.id}
                label={`${s.key}. ${textFor(s, locale)}`}
                disabled={!editable || !online}
                checked={s.enabled}
                onChange={async (enabled) => {
                  try {
                    await direct("section.put", s, { enabled });
                  } catch (e) {
                    setError(errorText(locale, e));
                  }
                }}
              />
            ))}
        </section>
        {snapshot.role === "owner" && (
          <section className="danger-zone">
            <h2>{t(locale, "deleteCollection")}</h2>
            <p>{t(locale, "deleteWarning")}</p>
            <Button
              variant="danger"
              disabled={!online}
              onClick={async () => {
                if (window.confirm(t(locale, "deleteWarning")))
                  try {
                    await direct("collection.delete", snapshot.collection, {});
                    location.assign("/");
                  } catch (e) {
                    setError(errorText(locale, e));
                  }
              }}
            >
              {t(locale, "deleteCollection")}
            </Button>
          </section>
        )}
        <ErrorNotice>{error}</ErrorNotice>
      </div>
    </>
  );
}
function ChecklistSettings() {
  const { locale, snapshot, editable, direct, online } = useHouse();
  const [section, setSection] = useRouteState(
      "settingsSection",
      snapshot.sections[0]?.id || "",
    ),
    [archived, setArchived] = useRouteState("checklistArchived", false),
    [modal, setModal] = useState(null),
    [sectionModal, setSectionModal] = useState(null),
    [error, setError] = useState(null);
  const sectionRecord = snapshot.sections.find((s) => s.id === section);
  const list = snapshot.criteria
    .filter((c) => c.sectionId === section && Boolean(c.archived) === archived)
    .sort((a, b) => a.order - b.order);
  const reorder = async (c, direction) => {
    const index = list.findIndex((x) => x.id === c.id),
      neighbor = list[index + direction];
    if (!neighbor) return;
    const next = list[index + direction * 2];
    const order =
      direction < 0
        ? (neighbor.order + (next?.order ?? neighbor.order - 20)) / 2
        : (neighbor.order + (next?.order ?? neighbor.order + 20)) / 2;
    try {
      await direct("criterion.put", c, { order });
    } catch (e) {
      setError(errorText(locale, e));
    }
  };
  return (
    <>
      <PageTitle
        title={t(locale, "checklist")}
        description={`${snapshot.collection.name} · ${t(locale, "sharedWarning")}`}
      >
        <Button
          disabled={!editable || !online}
          onClick={() =>
            setModal({
              sectionId: section,
              key: `custom.${crypto.randomUUID()}`,
              type: "text",
              sourceLocale: locale,
              labels: { [locale]: "" },
              guidance: { [locale]: "" },
              unit: "",
              choices: [],
              supportFields: [],
              importance: "information",
              stages: ["V"],
              scope: "apartment",
              order:
                Math.max(
                  0,
                  ...snapshot.criteria
                    .filter((c) => c.sectionId === section)
                    .map((c) => c.order),
                ) + 10,
            })
          }
        >
          <Plus />
          {t(locale, "addCriterion")}
        </Button>
      </PageTitle>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="list-toolbar">
        <SelectField
          label={t(locale, "section")}
          value={section}
          onChange={setSection}
          options={snapshot.sections
            .sort((a, b) => a.order - b.order)
            .map((s) => ({
              value: s.id,
              label: `${s.key}. ${textFor(s, locale)}`,
            }))}
        />
        <Toggle
          label={t(locale, "showArchived")}
          checked={archived}
          onChange={setArchived}
        />
        <Button
          variant="secondary"
          disabled={!editable || !online}
          onClick={() => setSectionModal(sectionRecord)}
        >
          {t(locale, "edit")} · {t(locale, "section")}
        </Button>
        <Button
          variant="secondary"
          disabled={!editable || !online}
          onClick={() =>
            setSectionModal({
              key: "",
              labels: { [locale]: "" },
              enabled: true,
              order: snapshot.sections.length,
            })
          }
        >
          <Plus />
          {t(locale, "section")}
        </Button>
      </div>
      <div className="criteria-admin">
        {list.map((c, i) => (
          <div className="criteria-admin-row" key={c.id}>
            <span className="criterion-key">{c.sourceKey || "＋"}</span>
            <div>
              <h3>{textFor(c, locale)}</h3>
              <p>
                {t(locale, c.type)}
                {c.unit && ` · ${c.unit}`} · {t(locale, c.importance)} ·{" "}
                {c.stages.map((s) => t(locale, s)).join(" / ")}
              </p>
            </div>
            <div className="admin-actions">
              <button
                className="icon-button"
                aria-label={`${t(locale, "moveUp")}: ${textFor(c, locale)}`}
                disabled={!editable || !online || i === 0}
                onClick={() => reorder(c, -1)}
              >
                <ArrowUp />
              </button>
              <button
                className="icon-button"
                aria-label={`${t(locale, "moveDown")}: ${textFor(c, locale)}`}
                disabled={!editable || !online || i === list.length - 1}
                onClick={() => reorder(c, 1)}
              >
                <ArrowDown />
              </button>
              <Button
                variant="ghost"
                disabled={!editable || !online}
                onClick={() => setModal(c)}
              >
                <PencilSimple />
                {t(locale, "edit")}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={t(locale, modal?.id ? "edit" : "addCriterion")}
        description={t(locale, "sharedWarning")}
        locale={locale}
        wide
      >
        {modal && (
          <Form
            initial={modal}
            onSubmit={async (v) => {
              const result = await direct("criterion.put", v.id ? v : null, v);
              setModal(null);
              updateLocation({
                settingsSection: result.record.sectionId,
                checklistArchived: Boolean(result.record.archived),
              });
            }}
          >
            {(v, u) => (
              <>
                <SelectField
                  label={t(locale, "language")}
                  value={v.sourceLocale}
                  onChange={(x) => u("sourceLocale", x)}
                  options={LOCALES.map((value) => ({
                    value,
                    label: localeNames[value],
                  }))}
                />
                {LOCALES.map((lang) => (
                  <div className="translation-fields" key={lang}>
                    <Field
                      label={`${t(locale, "label")} · ${localeNames[lang]}`}
                      required={lang === v.sourceLocale}
                      value={v.labels?.[lang]}
                      onChange={(x) => u("labels", { ...v.labels, [lang]: x })}
                    />
                    <Field
                      label={`${t(locale, "guidance")} · ${localeNames[lang]}`}
                      type="textarea"
                      value={v.guidance?.[lang]}
                      onChange={(x) =>
                        u("guidance", { ...v.guidance, [lang]: x })
                      }
                    />
                  </div>
                ))}
                <div className="form-grid">
                  <SelectField
                    label={t(locale, "type")}
                    value={v.type}
                    onChange={(x) => u("type", x)}
                    options={["boolean", "text", "number", "select"].map(
                      (value) => ({ value, label: t(locale, value) }),
                    )}
                  />
                  <Field
                    label={t(locale, "unit")}
                    value={v.unit}
                    onChange={(x) => u("unit", x)}
                  />
                  <SelectField
                    label={t(locale, "importance")}
                    value={v.importance}
                    onChange={(x) => u("importance", x)}
                    options={IMPORTANCE.map((value) => ({
                      value,
                      label: t(locale, value),
                    }))}
                  />
                  <SelectField
                    label={t(locale, "section")}
                    value={v.sectionId}
                    onChange={(x) => u("sectionId", x)}
                    options={snapshot.sections.map((s) => ({
                      value: s.id,
                      label: textFor(s, locale),
                    }))}
                  />
                </div>
                <div className="button-row">
                  {STAGES.map((s) => (
                    <Toggle
                      key={s}
                      label={t(locale, s)}
                      checked={v.stages.includes(s)}
                      onChange={(checked) =>
                        u(
                          "stages",
                          checked
                            ? [...v.stages, s]
                            : v.stages.filter((x) => x !== s),
                        )
                      }
                    />
                  ))}
                </div>
                {v.type === "select" && (
                  <div>
                    <h3>{t(locale, "choices")}</h3>
                    {v.choices.map((choice, i) => (
                      <div className="choice-edit" key={choice.id}>
                        {LOCALES.map((lang) => (
                          <Field
                            key={lang}
                            label={localeNames[lang]}
                            value={choice.labels[lang]}
                            onChange={(value) =>
                              u(
                                "choices",
                                v.choices.map((c, n) =>
                                  n === i
                                    ? {
                                        ...c,
                                        labels: { ...c.labels, [lang]: value },
                                      }
                                    : c,
                                ),
                              )
                            }
                          />
                        ))}
                        <Toggle
                          label={t(locale, "archive")}
                          checked={choice.retired}
                          onChange={(retired) =>
                            u(
                              "choices",
                              v.choices.map((c, n) =>
                                n === i ? { ...c, retired } : c,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        u("choices", [
                          ...v.choices,
                          {
                            id: crypto.randomUUID(),
                            labels: { [v.sourceLocale]: "" },
                          },
                        ])
                      }
                    >
                      <Plus />
                      {t(locale, "add")}
                    </Button>
                  </div>
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
      <Dialog
        open={Boolean(sectionModal)}
        onClose={() => setSectionModal(null)}
        title={t(locale, "section")}
        locale={locale}
      >
        {sectionModal && (
          <Form
            initial={sectionModal}
            onSubmit={async (v) => {
              const result = await direct("section.put", v.id ? v : null, v);
              setSection(result.id);
              setSectionModal(null);
            }}
          >
            {(v, u) => (
              <>
                {LOCALES.map((lang) => (
                  <Field
                    key={lang}
                    label={`${t(locale, "label")} · ${localeNames[lang]}`}
                    value={v.labels[lang]}
                    onChange={(x) => u("labels", { ...v.labels, [lang]: x })}
                  />
                ))}
                <Field
                  label={t(locale, "section")}
                  value={v.key}
                  onChange={(x) => u("key", x)}
                />
                <Field
                  label={t(locale, "number")}
                  type="number"
                  value={v.order}
                  onChange={(x) => u("order", x)}
                />
                <Toggle
                  label={t(locale, "enabled")}
                  checked={v.enabled}
                  onChange={(x) => u("enabled", x)}
                />
              </>
            )}
          </Form>
        )}
      </Dialog>
    </>
  );
}
function Members() {
  const { locale, snapshot, direct, online, session } = useHouse();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(null),
    [links, setLinks] = useState({});
  const owner = snapshot.role === "owner";
  const mutation = async (type, item, payload = {}) => {
    try {
      const result = await direct(type, item, payload);
      if (result.invitationUrl)
        setLinks((x) => ({
          ...x,
          [result.id]: new URL(result.invitationUrl, location.origin).href,
        }));
      if (result.deliveryError)
        setError(errorText(locale, result.deliveryError));
      return result;
    } catch (e) {
      setError(errorText(locale, e));
    }
  };
  return (
    <>
      <PageTitle
        title={t(locale, "members")}
        description={t(locale, "inviteDescription")}
      >
        {owner && (
          <Button disabled={!online} onClick={() => setOpen(true)}>
            <Plus />
            {t(locale, "invite")}
          </Button>
        )}
      </PageTitle>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="members-list">
        <div className="record-row">
          <div>
            <strong>
              {snapshot.collection.ownerId === session.user.id
                ? session.user.name
                : t(locale, "owner")}
            </strong>
            <p>
              {snapshot.collection.ownerId === session.user.id
                ? session.user.email
                : ""}
            </p>
          </div>
          <Chip tone="teal">{t(locale, "owner")}</Chip>
        </div>
        {snapshot.members.map((m) => (
          <div key={m.id} className="record-row">
            <div>
              <strong>{m.name || m.email}</strong>
              <p>{m.email}</p>
            </div>
            {owner ? (
              <>
                <SelectField
                  label={t(locale, "role")}
                  value={m.role}
                  disabled={!online}
                  onChange={(role) => mutation("member.put", m, { role })}
                  options={["viewer", "editor"].map((value) => ({
                    value,
                    label: t(locale, value),
                  }))}
                />
                <Button
                  variant="ghost"
                  disabled={!online}
                  onClick={() => mutation("member.delete", m)}
                >
                  {t(locale, "revoke")}
                </Button>
              </>
            ) : (
              <Chip>{t(locale, m.role)}</Chip>
            )}
          </div>
        ))}
      </div>
      {owner && (
        <>
          <div className="section-heading">
            <h2>{t(locale, "invite")}</h2>
            {!session.local && (
              <Button
                variant="secondary"
                onClick={() =>
                  signIn(
                    "google",
                    { callbackUrl: location.href },
                    {
                      scope:
                        "openid email profile https://www.googleapis.com/auth/gmail.send",
                      include_granted_scopes: "true",
                      access_type: "offline",
                      prompt: "consent",
                    },
                  )
                }
              >
                <Envelope />
                {t(locale, "connectGmail")}
              </Button>
            )}
          </div>
          {snapshot.invitations.map((inv) => {
            const state = inv.revokedAt
              ? "revoked"
              : inv.acceptedBy
                ? "accepted"
                : new Date(inv.expiresAt) < new Date()
                  ? "expired"
                  : inv.delivery;
            return (
              <div className="invitation-row" key={inv.id}>
                <div>
                  <strong>{inv.email}</strong>
                  <p>
                    {t(locale, inv.role)} · {dateLabel(inv.expiresAt, locale)}
                  </p>
                </div>
                <Chip tone={state === "failed" ? "amber" : ""}>
                  {t(locale, state)}
                </Chip>
                <div className="button-row">
                  {links[inv.id] && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(links[inv.id])
                      }
                    >
                      <Copy />
                      {t(locale, "copyInvite")}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={!online}
                    onClick={() => mutation("invitation.resend", inv)}
                  >
                    {t(locale, "resend")}
                  </Button>
                  {!inv.revokedAt && !inv.acceptedBy && (
                    <Button
                      variant="ghost"
                      disabled={!online}
                      onClick={() => mutation("invitation.revoke", inv)}
                    >
                      {t(locale, "revoke")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {session.local && <p className="muted">{t(locale, "localNotice")}</p>}
        </>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, "invite")}
        description={t(locale, "inviteDescription")}
        locale={locale}
      >
        <Form
          initial={{ email: "", role: "viewer" }}
          onSubmit={async (v) => {
            const result = await direct("invitation.create", null, v);
            if (result.invitationUrl)
              setLinks((x) => ({
                ...x,
                [result.id]: new URL(result.invitationUrl, location.origin)
                  .href,
              }));
            setOpen(false);
            if (result.deliveryError)
              setError(errorText(locale, result.deliveryError));
          }}
          submitLabel="invite"
        >
          {(v, u) => (
            <>
              <Field
                label={t(locale, "email")}
                type="email"
                value={v.email}
                onChange={(x) => u("email", x)}
                required
              />
              <SelectField
                label={t(locale, "role")}
                value={v.role}
                onChange={(x) => u("role", x)}
                options={["viewer", "editor"].map((value) => ({
                  value,
                  label: t(locale, value),
                }))}
              />
            </>
          )}
        </Form>
      </Dialog>
    </>
  );
}
