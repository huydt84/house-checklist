"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { signIn, signOut } from "next-auth/react";
import {
  HouseLine,
  SquaresFour,
  Columns,
  ChatCircle,
  CheckSquare,
  SlidersHorizontal,
  Users,
  Plus,
  ArrowRight,
  CloudCheck,
  CloudSlash,
  WarningCircle,
  Check,
  Sun,
  Moon,
  Translate,
  SignOut,
  PencilSimple,
} from "@phosphor-icons/react";
import { HouseContext, PageTitle } from "./context";
import {
  Button,
  IconButton,
  Field,
  Dialog,
  Menu,
  Loading,
  ErrorNotice,
  Chip,
  SelectField,
  Empty,
} from "./ui";
import { localeNames, LOCALES, t, errorText } from "../lib/i18n.mjs";
import { findAnswer } from "../lib/domain.mjs";
import * as storage from "../lib/client-store.mjs";
import Apartments from "./screens/Apartments";
import Collections from "./screens/Collections";
import Apartment from "./screens/Apartment";
import Compare from "./screens/Compare";
import Questions from "./screens/Questions";
import Settings from "./screens/Settings";
import ConflictResolver from "./ConflictResolver";
import PerformanceDiagnostics from "./PerformanceDiagnostics";
import RenameDialog from "./RenameDialog";
import ScenarioEditor from "./ScenarioEditor";
import {
  useLocation,
  locationParams,
  updateLocation,
  RouteLink,
} from "./navigation";
export default function Workspace() {
  const [locale, setLocale] = useState("en"),
    [theme, setTheme] = useState("system"),
    [preferencesReady, setPreferencesReady] = useState(false),
    [resolvedTheme, setResolvedTheme] = useState("light"),
    [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [cid, setCid] = useState(""),
    [workspace, setWorkspace] = useState(null),
    [online, setOnline] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [modal, setModal] = useState(null),
    [name, setName] = useState(""),
    [full, setFull] = useState(false),
    [invite, setInvite] = useState(""),
    [notice, setNotice] = useState(""),
    [accountRecovery, setAccountRecovery] = useState(null),
    [accessLost, setAccessLost] = useState(false),
    [localFailures, setLocalFailures] = useState([]);
  const route = useLocation();
  const pages = [
    "collections",
    "apartments",
    "compare",
    "questions",
    "checklist",
    "preferences",
    "members",
  ];
  const page = pages.includes(route.get("page"))
    ? route.get("page")
    : route.get("collection")
      ? "apartments"
      : "collections";
  const apartmentId = page === "apartments" ? route.get("apartment") : null;
  const selected = [
    ...new Set((route.get("selected") || "").split(",").filter(Boolean)),
  ].slice(0, 4);
  const [loadFailed, setLoadFailed] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const current = useRef(null),
    timer = useRef(null);
  current.current = { session, cid, workspace };
  const refreshLocal = useCallback(async () => {
    const { session, cid } = current.current;
    if (session?.user && cid) {
      const data = await storage.loadWorkspace(session.user.id, cid);
      if (
        current.current.cid === cid &&
        current.current.session?.user?.id === session.user.id
      )
        setWorkspace(data);
    }
  }, []);
  const sync = useCallback(async () => {
    const { session, cid } = current.current;
    if (!session?.user || !cid || !navigator.onLine) return;
    setBusy(true);
    setError(null);
    try {
      await storage.synchronize(session.user.id, cid);
      await refreshLocal();
      if (current.current.cid === cid) setSyncFailed(false);
    } catch (e) {
      if (current.current.cid !== cid) return;
      setSyncFailed(true);
      if ([403, 404].includes(e.status)) setAccessLost(true);
      setError(errorText(locale, e));
    } finally {
      setBusy(false);
    }
  }, [locale, refreshLocal]);
  const refreshRemote = useCallback(
    async (id = cid) => {
      if (!session?.user || !id) return;
      const data = await storage.request(`/api/collections/${id}`);
      await storage.cacheSnapshot(session.user.id, data);
      const local = await storage.loadWorkspace(session.user.id, id);
      if (current.current.cid === id) setWorkspace(local);
      return data;
    },
    [cid, session],
  );
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      const language =
        localStorage.getItem("house-language") ||
        navigator.language.slice(0, 2);
      setLocale(LOCALES.includes(language) ? language : "en");
      setTheme(localStorage.getItem("house-theme") || "system");
      setPreferencesReady(true);
      setOnline(navigator.onLine);
      const token = window.location.pathname.match(/^\/invite\/([^/]+)/)?.[1];
      if (token) setInvite(token);
      try {
        let s;
        try {
          s = await storage.request("/api/session");
          const old = await storage.cachedSession();
          if (
            old?.user &&
            s.user &&
            old.user.id !== s.user.id &&
            (await storage.pendingCount(old.user.id))
          ) {
            setAccountRecovery({ old, next: s });
            return;
          }
          if (s.user) await storage.rememberSession(s);
        } catch (e) {
          s = await storage.cachedSession();
          if (!s) throw e;
        }
        if (disposed) return;
        setSession(s);
        if (s.user?.locale) setLocale(s.user.locale);
        const requested = locationParams().get("collection");
        const saved = localStorage.getItem("house-collection");
        const initialCollection =
          requested ||
          (s.collections?.some((c) => c.id === saved && !c.archived)
            ? saved
            : s.collections?.find((c) => !c.archived)?.id || "");
        // Pin the first history entry to its collection before any switches.
        // Back must not reinterpret a bare / using the most recently used one.
        if (
          initialCollection &&
          location.pathname === "/" &&
          (requested || locationParams().has("page")) &&
          locationParams().get("page") !== "collections"
        )
          updateLocation(
            {
              collection: initialCollection,
              page: locationParams().get("page") || "apartments",
            },
            { replace: true },
          );
        setCid(initialCollection);
      } catch (e) {
        setError(errorText(language, e));
      } finally {
        setLoading(false);
      }
    };
    void init();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.lang = locale;
    localStorage.setItem("house-language", locale);
  }, [locale, preferencesReady]);
  useEffect(() => {
    if (!preferencesReady) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      setResolvedTheme(resolved);
    };
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem("house-theme", theme);
    return () => media.removeEventListener("change", apply);
  }, [theme, preferencesReady]);
  useEffect(() => {
    if (!cid || !session?.user) return;
    let cancelled = false;
    setWorkspace(null);
    setAccessLost(false);
    setLoadFailed(false);
    setError(null);
    localStorage.setItem("house-collection", cid);
    void (async () => {
      try {
        const local = await storage.loadWorkspace(session.user.id, cid);
        if (!cancelled && local) setWorkspace(local);
        if (navigator.onLine) {
          if (local) await sync();
          else await refreshRemote(cid);
        } else if (!local) {
          setLoadFailed(true);
          setError(t(locale, "offlineWorkspaceMissing"));
        }
      } catch (e) {
        if (cancelled) return;
        setLoadFailed(true);
        if ([403, 404].includes(e.status)) setAccessLost(true);
        setError(errorText(locale, e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => storage.subscribe(() => void refreshLocal()), [refreshLocal]);
  useEffect(() => {
    const collection = workspace?.snapshot.collection;
    if (
      !collection ||
      !session?.collections?.some(
        (c) => c.id === collection.id && c.name !== collection.name,
      )
    )
      return;
    const next = {
      ...session,
      collections: session.collections.map((c) =>
        c.id === collection.id ? { ...c, name: collection.name } : c,
      ),
    };
    setSession(next);
    void storage
      .rememberSession(next)
      .catch((e) => setError(errorText(locale, e)));
  }, [workspace?.snapshot.collection, session, locale]);
  useEffect(() => {
    const reconnect = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    const focus = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    window.addEventListener("focus", focus);
    const interval = setInterval(focus, 20000);
    return () => {
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
      window.removeEventListener("focus", focus);
      clearInterval(interval);
      clearTimeout(timer.current);
    };
  }, [sync]);
  const setLanguage = async (lang) => {
    setLocale(lang);
    if (session?.user && navigator.onLine)
      await storage
        .request("/api/profile", {
          method: "POST",
          body: JSON.stringify({ locale: lang }),
        })
        .catch(() => {});
  };
  const save = async (type, record, payload, refs = {}) => {
    const s = current.current.workspace?.snapshot;
    const command = {
      id: crypto.randomUUID(),
      targetId: record?.id || crypto.randomUUID(),
      type,
      expectedRevision: record?.revision || 0,
      checklistRevision: s.collection.checklistRevision,
      payload,
      ...refs,
    };
    const failureKey = [
      type,
      refs.apartmentId,
      refs.criterionId,
      refs.scenarioId,
      record?.id || payload.name || "",
    ].join(":");
    try {
      await storage.enqueue(session.user.id, cid, command);
      setLocalFailures((v) => v.filter((k) => k !== failureKey));
      await refreshLocal();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void sync(), 700);
      return command.targetId;
    } catch (e) {
      const failure = {
        error: e.name === "QuotaExceededError" ? "STORAGE_FULL" : e.error,
      };
      setLocalFailures((v) => [...new Set([...v, failureKey])]);
      setError(errorText(locale, failure));
      throw failure;
    }
  };
  const direct = async (type, record, payload, refs = {}) => {
    const s = current.current.workspace.snapshot;
    const result = await storage.request(`/api/collections/${cid}/mutations`, {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        targetId: record?.id || crypto.randomUUID(),
        type,
        expectedRevision: record?.revision || 0,
        checklistRevision: s.collection.checklistRevision,
        payload,
        ...refs,
      }),
    });
    await refreshRemote();
    return result;
  };
  const answer = async (apt, criterion, payload, scenarioId = null) => {
    const s = current.current.workspace.snapshot;
    const previous = findAnswer(s, apt, criterion.id, scenarioId);
    return save(
      "answer.put",
      previous,
      { state: "not_checked", value: null, ...previous, ...payload },
      { apartmentId: apt, criterionId: criterion.id, scenarioId },
    );
  };
  const navigationPatch = (next, id = null, extra = {}) => ({
    collection: cid,
    page: next,
    apartment: id,
    tab: id ? "overview" : null,
    scenarioEditor: null,
    ...extra,
  });
  const navigate = (next, id = null, extra = {}) => {
    if (updateLocation(navigationPatch(next, id, extra)) === false) return;
    setFull(false);
    window.scrollTo({ top: 0 });
  };
  const collectionPatch = (id, next = "apartments") => ({
    // Collection-scoped filters and property IDs cannot follow into another one.
    ...Object.fromEntries(
      [...route.keys()]
        .filter((key) => key !== "diagnostics")
        .map((key) => [key, null]),
    ),
    collection: id,
    page: next,
  });
  const switchCollection = (id) => {
    if (updateLocation(collectionPatch(id)) === false) return;
    setCid(id);
    setFull(false);
  };
  const toggleCompare = (id) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : selected.length < 4
        ? [...selected, id]
        : selected;
    updateLocation({ selected: next.join(",") }, { replace: true });
  };
  useEffect(() => {
    const id = route.get("collection");
    if (id && session?.user && id !== cid) setCid(id);
  }, [route.toString(), session, cid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFull(false);
    setModal(null);
    const heading = document.querySelector("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      document.title = `${heading.textContent} · ${t(locale, "app")}`;
    }
  }, [page, apartmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const logout = async (persona) => {
    if (
      (await storage.pendingCount(session.user.id)) &&
      !window.confirm(t(locale, "unsavedWarning"))
    )
      return;
    await storage.clearAccount(session.user.id);
    if (session.local) {
      await storage.request("/api/persona", {
        method: "POST",
        body: JSON.stringify({ key: persona || "anonymous" }),
      });
      window.location.assign("/");
    } else await signOut({ callbackUrl: "/" });
  };
  const createCollection = async () => {
    setBusy(true);
    try {
      const c = await storage.request("/api/collections", {
        method: "POST",
        body: JSON.stringify({ name, id: crypto.randomUUID() }),
      });
      const s = {
        ...session,
        collections: [...(session.collections || []), c],
      };
      setSession(s);
      await storage.rememberSession(s);
      switchCollection(c.id);
      setModal(null);
      setName("");
    } catch (e) {
      setError(errorText(locale, e));
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    try {
      const { collection } = await storage.request("/api/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token: invite }),
      });
      const s = await storage.request("/api/session");
      await storage.rememberSession(s);
      setSession(s);
      setCid(collection.id);
      setInvite("");
      updateLocation(collectionPatch(collection.id), { replace: true });
    } catch (e) {
      setError(errorText(locale, e));
    }
  };
  if (loading) return <Loading locale={locale} />;
  if (accountRecovery)
    return (
      <div className="welcome">
        <h1>{t(locale, "account")}</h1>
        <p>{t(locale, "accountRecovery")}</p>
        <div className="button-row">
          <Button
            variant="secondary"
            onClick={() => storage.exportDrafts(accountRecovery.old.user.id)}
          >
            {t(locale, "exportDrafts")}
          </Button>
          <Button
            onClick={async () => {
              await storage.clearAccount(accountRecovery.old.user.id);
              await storage.rememberSession(accountRecovery.next);
              location.reload();
            }}
          >
            {t(locale, "continueAccount")}
          </Button>
        </div>
      </div>
    );
  if (!session?.user)
    return (
      <div className="welcome">
        <div className="brand">
          <HouseLine size={30} />
          {t(locale, "app")}
        </div>
        <div className="welcome-content">
          <h1>{t(locale, "welcome")}</h1>
          <p>{t(locale, "welcomeText")}</p>
          <ErrorNotice>{error}</ErrorNotice>
          {error && !session && (
            <Button variant="secondary" onClick={() => location.reload()}>
              {t(locale, "retry")}
            </Button>
          )}
          {session?.configured ? (
            <Button
              onClick={() =>
                session.local
                  ? storage
                      .request("/api/persona", {
                        method: "POST",
                        body: JSON.stringify({ key: "owner" }),
                      })
                      .then(() => location.reload())
                  : signIn("google")
              }
            >
              {t(locale, session.local ? "localDemo" : "google")}
              <ArrowRight size={18} />
            </Button>
          ) : (
            <p>{t(locale, "setup")}</p>
          )}
          {session?.local && <small>{t(locale, "localNotice")}</small>}
          <SelectField
            label={t(locale, "language")}
            value={locale}
            onChange={setLanguage}
            options={LOCALES.map((value) => ({
              value,
              label: localeNames[value],
            }))}
          />
          <nav
            className="policy-links"
            aria-label={t(locale, "serviceInformation")}
          >
            <a href={`/privacy?lang=${locale}`}>{t(locale, "privacyPolicy")}</a>
            <a href={`/terms?lang=${locale}`}>{t(locale, "termsOfUse")}</a>
          </nav>
        </div>
      </div>
    );
  const s = workspace?.snapshot,
    activeCollection =
      s?.collection || session.collections?.find((c) => c.id === cid),
    editable = s?.role !== "viewer",
    failed = workspace?.jobs.filter((j) => j.status !== "pending") || [],
    pending = workspace?.jobs.length || 0;
  const status = localFailures.length
    ? "retryNeeded"
    : syncFailed
      ? "retryNeeded"
      : failed.length
        ? failed.some((j) => j.status === "conflict")
          ? "conflict"
          : "retryNeeded"
        : pending
          ? busy
            ? "saving"
            : "localSaved"
          : busy
            ? "checkingUpdates"
            : "saved";
  const ctx = {
    locale,
    session,
    snapshot: s,
    pending,
    conflicts: failed.length > 0 || localFailures.length > 0,
    editable,
    online,
    save,
    direct,
    answer,
    refreshRemote,
    sync,
    navigate,
    selected,
    toggleCompare,
    clearCompare: () => updateLocation({ selected: null }, { replace: true }),
    navigationPatch,
    uploads: workspace?.uploads || [],
    setNotice,
    full,
    setFull,
  };
  const navigation = [
      ["apartments", SquaresFour],
      ["compare", Columns],
      ["questions", ChatCircle],
    ],
    settings = [
      ["checklist", CheckSquare],
      ["preferences", SlidersHorizontal],
      ["members", Users],
    ];
  const collectionMenuItems = [
    {
      label: t(locale, "collections"),
      patch: collectionPatch(null, "collections"),
    },
    { separator: true },
    ...(session.collections || [])
      .filter((c) => !c.archived)
      .map((c) => ({
        label: c.id === s?.collection.id ? s.collection.name : c.name,
        patch: collectionPatch(c.id),
      })),
    { separator: true },
    ...(s && editable
      ? [
          {
            label: t(locale, "editChecklist"),
            icon: <CheckSquare size={18} aria-hidden="true" />,
            patch: navigationPatch("checklist"),
          },
          {
            label: t(locale, "renameCollection"),
            opensDialog: true,
            icon: <PencilSimple size={18} aria-hidden="true" />,
            onClick: () => setModal("renameCollection"),
          },
        ]
      : []),
    {
      label: t(locale, "newCollection"),
      opensDialog: true,
      onClick: () => setModal("collection"),
    },
  ];
  return (
    <HouseContext.Provider value={ctx}>
      <div className={`app-shell ${full ? "viewing-shell" : ""}`}>
        <aside className="sidebar">
          <RouteLink
            className="brand"
            patch={collectionPatch(null, "collections")}
            aria-current={page === "collections" ? "page" : undefined}
          >
            <HouseLine size={27} weight="duotone" />
            {t(locale, "app")}
          </RouteLink>
          <Menu
            label={t(locale, "collection")}
            trigger={
              <div>
                <span className="eyebrow">{t(locale, "collection")}</span>
                <strong>
                  {activeCollection?.name || t(locale, "collection")}
                </strong>
                <small>{t(locale, s?.role || "owner")}</small>
              </div>
            }
            items={collectionMenuItems}
          />
          <nav aria-label={t(locale, "app")}>
            {navigation.map(([key, Icon]) => (
              <RouteLink
                patch={navigationPatch(key)}
                aria-current={page === key ? "page" : undefined}
                key={key}
                className={page === key ? "active" : ""}
                onNavigate={() => {
                  setFull(false);
                  window.scrollTo({ top: 0 });
                }}
              >
                <Icon size={21} />
                {t(locale, key)}
                {key === "apartments" && s && (
                  <span>{s.apartments.filter((a) => !a.archived).length}</span>
                )}
              </RouteLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <nav aria-label={t(locale, "preferences")}>
              {settings.map(([key, Icon]) => (
                <RouteLink
                  patch={navigationPatch(key)}
                  aria-current={page === key ? "page" : undefined}
                  className={page === key ? "active" : ""}
                  key={key}
                  onNavigate={() => {
                    setFull(false);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <Icon size={20} />
                  {t(locale, key)}
                </RouteLink>
              ))}
            </nav>
          </div>
        </aside>
        <div className="workspace">
          <div className="workspace-bar">
            <RouteLink
              className="desktop-collection-name collection-home-link"
              patch={collectionPatch(cid, cid ? "apartments" : "collections")}
            >
              {activeCollection?.name || t(locale, "app")}
            </RouteLink>
            <div className="mobile-tools">
              <RouteLink
                className="collection-home-link"
                patch={collectionPatch(cid, cid ? "apartments" : "collections")}
              >
                {activeCollection?.name || t(locale, "app")}
              </RouteLink>
              <Menu
                label={t(locale, "collection")}
                trigger={<SquaresFour size={18} aria-hidden="true" />}
                items={collectionMenuItems}
              />
            </div>
            <RouteLink
              className="mobile-brand"
              patch={collectionPatch(null, "collections")}
              aria-current={page === "collections" ? "page" : undefined}
            >
              <HouseLine size={18} aria-hidden="true" />
              {t(locale, "app")}
            </RouteLink>
            <div className="save-status" role="status">
              {online ? <CloudCheck size={17} /> : <CloudSlash size={17} />}
              <span>
                {t(
                  locale,
                  online ? status : pending ? "localSaved" : "offline",
                )}
              </span>
              {(pending > 0 || syncFailed) &&
                failed.length === 0 &&
                !busy &&
                online && (
                  <button onClick={() => void sync()}>
                    {t(locale, "retry")}
                  </button>
                )}
              {failed.length > 0 && (
                <button onClick={() => setModal("conflicts")}>
                  {failed.length} · {t(locale, "retryNeeded")}
                </button>
              )}
            </div>
            <div className="account-tools">
              <Menu
                label={t(locale, "language")}
                className="language-menu"
                trigger={
                  <>
                    <Translate size={19} aria-hidden="true" />
                    <span className="language-name">{localeNames[locale]}</span>
                    <span className="language-code" aria-hidden="true">
                      {locale.toUpperCase()}
                    </span>
                  </>
                }
                items={LOCALES.map((l) => ({
                  label: localeNames[l],
                  icon:
                    locale === l ? (
                      <Check size={16} aria-hidden="true" />
                    ) : null,
                  onClick: () => setLanguage(l),
                }))}
              />
              <IconButton
                label={t(
                  locale,
                  resolvedTheme === "dark" ? "switchToLight" : "switchToDark",
                )}
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={21} aria-hidden="true" />
                ) : (
                  <Moon size={21} aria-hidden="true" />
                )}
              </IconButton>
              <Menu
                label={t(locale, "account")}
                className="profile-menu"
                heading={
                  <>
                    <strong>{session.user.name}</strong>
                    <small>{session.user.email}</small>
                  </>
                }
                trigger={
                  <>
                    <span className="avatar" aria-hidden="true">
                      {session.user.name?.slice(0, 1)}
                    </span>
                    <strong className="profile-name">
                      {session.user.name}
                    </strong>
                  </>
                }
                items={[
                  ...(session.local
                    ? ["owner", "editor", "viewer", "outsider"].map((v) => ({
                        label: `${t(locale, "local")} · ${t(locale, v)}`,
                        onClick: () => logout(v),
                      }))
                    : []),
                  {
                    label: t(locale, "signOut"),
                    icon: <SignOut size={18} aria-hidden="true" />,
                    onClick: () => logout(),
                  },
                ]}
              />
            </div>
          </div>
          <main id="main-content">
            {route.get("diagnostics") === "1" && (
              <PerformanceDiagnostics
                routeKey={route.toString()}
                ready={Boolean(s)}
              />
            )}
            <ErrorNotice>
              {error && (
                <>
                  {error}
                  <button
                    className="text-button"
                    onClick={() => setError(null)}
                  >
                    {t(locale, "close")}
                  </button>
                </>
              )}
            </ErrorNotice>
            {notice && (
              <div className="notice" role="status">
                <Check size={18} />
                {notice}
                <button onClick={() => setNotice("")} className="text-button">
                  {t(locale, "close")}
                </button>
              </div>
            )}
            {invite ? (
              <Empty
                title={t(locale, "acceptInvite")}
                description={t(locale, "inviteDescription")}
              >
                <Button onClick={accept}>{t(locale, "acceptInvite")}</Button>
              </Empty>
            ) : page === "collections" || !cid ? (
              <Collections
                collectionPatch={collectionPatch}
                onCreate={() => setModal("collection")}
                onArchive={async (collection, archived) => {
                  const result = await storage.request(
                    `/api/collections/${collection.id}/mutations`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        id: crypto.randomUUID(),
                        type: "collection.archive",
                        targetId: collection.id,
                        expectedRevision: collection.revision,
                        payload: { archived },
                      }),
                    },
                  );
                  const next = {
                    ...session,
                    collections: session.collections.map((c) =>
                      c.id === collection.id ? { ...c, ...result.record } : c,
                    ),
                  };
                  setSession(next);
                  await storage.rememberSession(next);
                  if (cid === collection.id) await refreshRemote(cid);
                }}
                onRefresh={async () => {
                  const next = await storage.request("/api/session");
                  setSession(next);
                  await storage.rememberSession(next);
                }}
              />
            ) : accessLost ? (
              <Empty title={t(locale, "notFound")}>
                <Button
                  variant="secondary"
                  onClick={() => storage.exportDrafts(session.user.id)}
                >
                  {t(locale, "exportDrafts")}
                </Button>
              </Empty>
            ) : !s ? (
              loadFailed ? (
                <Empty
                  title={t(locale, "loadFailed")}
                  description={t(locale, "retryWorkspace")}
                >
                  <Button
                    disabled={busy || !online}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await refreshRemote();
                        setLoadFailed(false);
                        setError(null);
                      } catch (e) {
                        setError(errorText(locale, e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t(locale, busy ? "loading" : "retry")}
                  </Button>
                </Empty>
              ) : (
                <Loading locale={locale} />
              )
            ) : (
              <>
                {s.role === "viewer" && (
                  <p className="view-only">{t(locale, "viewOnly")}</p>
                )}
                {page === "apartments" ? (
                  apartmentId ? (
                    <Apartment key={apartmentId} id={apartmentId} />
                  ) : (
                    <Apartments />
                  )
                ) : page === "compare" ? (
                  <Compare />
                ) : page === "questions" ? (
                  <Questions />
                ) : (
                  <Settings page={page} />
                )}
                <ScenarioEditor key={cid} />
              </>
            )}
          </main>
        </div>
        <nav className="mobile-nav" aria-label={t(locale, "app")}>
          {[...navigation, ["preferences", SlidersHorizontal]].map(
            ([key, Icon]) => (
              <RouteLink
                patch={navigationPatch(key)}
                aria-current={page === key ? "page" : undefined}
                className={page === key ? "active" : ""}
                key={key}
                onNavigate={() => {
                  setFull(false);
                  window.scrollTo({ top: 0 });
                }}
              >
                <Icon size={22} />
                <span>{t(locale, key)}</span>
              </RouteLink>
            ),
          )}
        </nav>
      </div>
      {s && (
        <RenameDialog
          open={modal === "renameCollection"}
          onClose={() => setModal(null)}
          record={s.collection}
          kind="collection"
        />
      )}
      <Dialog
        open={modal === "collection"}
        onClose={() => setModal(null)}
        title={t(locale, "newCollection")}
        locale={locale}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createCollection();
          }}
        >
          <Field
            label={t(locale, "collectionName")}
            value={name}
            onChange={setName}
            required
            autoFocus
            maxLength={120}
          />
          <ErrorNotice>{error}</ErrorNotice>
          <div className="form-actions">
            <Button disabled={busy} type="submit">
              {t(locale, "create")}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={modal === "conflicts"}
        onClose={() => setModal(null)}
        title={t(
          locale,
          failed.some((job) => job.status === "conflict")
            ? "conflict"
            : "syncIssues",
        )}
        description={t(
          locale,
          failed.some((job) => job.status === "conflict")
            ? "conflictHelp"
            : "syncIssuesHelp",
        )}
        locale={locale}
        wide
      >
        {failed.map((job) => (
          <ConflictResolver key={job.id} job={job} />
        ))}
        <Button
          variant="secondary"
          onClick={() => storage.exportDrafts(session.user.id)}
        >
          {t(locale, "exportDrafts")}
        </Button>
      </Dialog>
    </HouseContext.Provider>
  );
}
