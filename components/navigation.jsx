"use client";
import { useSyncExternalStore } from "react";
const event = "house-navigation";
export function allowNavigation(root = document) {
  const dirty = root.querySelector(
    'form[data-unsaved="true"]:not([data-saving="true"])',
  );
  return !dirty || window.confirm(dirty.dataset.leaveMessage);
}
let installed = false;
const indexKey = "houseHistoryIndex";
let currentIndex = 0;
function installGuard() {
  if (installed) return;
  installed = true;
  currentIndex = window.history.state?.[indexKey] ?? 0;
  window.history.replaceState(
    { ...window.history.state, [indexKey]: currentIndex },
    "",
  );
  let restoring = false;
  window.addEventListener("beforeunload", (e) => {
    if (!document.querySelector('form[data-unsaved="true"]')) return;
    e.preventDefault();
    e.returnValue = "";
  });
  window.addEventListener("popstate", (e) => {
    if (restoring) {
      restoring = false;
      return;
    }
    const nextIndex = e.state?.[indexKey];
    // Restore the existing entry rather than pushing a duplicate and erasing
    // Forward history. Do not publish the rejected route: keep the draft mounted.
    if (
      Number.isInteger(nextIndex) &&
      nextIndex !== currentIndex &&
      !allowNavigation()
    ) {
      restoring = true;
      window.history.go(currentIndex - nextIndex);
      return;
    }
    currentIndex = nextIndex ?? 0;
    if (!Number.isInteger(nextIndex))
      window.history.replaceState(
        { ...window.history.state, [indexKey]: currentIndex },
        "",
      );
    if (locationParams().get("diagnostics") === "1")
      performance.mark("house-navigation-start");
    window.dispatchEvent(new Event(event));
  });
}
function subscribe(callback) {
  installGuard();
  window.addEventListener(event, callback);
  return () => window.removeEventListener(event, callback);
}
export function locationParams() {
  return new URLSearchParams(window.location.search);
}
export function routeHref(patch) {
  const params = locationParams();
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "" || value === false) params.delete(key);
    else params.set(key, String(value));
  }
  return `/?${params}`;
}
export function updateLocation(patch, { replace = false } = {}) {
  const href = routeHref(patch);
  if (`${location.pathname}${location.search}` === href) return;
  if (!replace && !allowNavigation()) return false;
  if (locationParams().get("diagnostics") === "1")
    performance.mark("house-navigation-start");
  installGuard();
  if (!replace) currentIndex += 1;
  window.history[replace ? "replaceState" : "pushState"](
    { ...window.history.state, [indexKey]: currentIndex },
    "",
    href,
  );
  window.dispatchEvent(new Event(event));
  return true;
}
export function useLocation() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search);
}
export function useRouteState(key, fallback = "", { replace = false } = {}) {
  const params = useLocation();
  const raw = params.get(key);
  const value =
    raw == null
      ? fallback
      : typeof fallback === "boolean"
        ? raw === "true"
        : raw;
  return [
    value,
    (next) =>
      updateLocation(
        { [key]: typeof next === "function" ? next(value) : next },
        { replace },
      ),
  ];
}
export function RouteLink({ patch, children, onNavigate, onClick, ...props }) {
  useLocation();
  const href = typeof window === "undefined" ? "/" : routeHref(patch);
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        e.preventDefault();
        if (updateLocation(patch) !== false) {
          if ("page" in patch || "apartment" in patch)
            window.scrollTo({ top: 0 });
          onNavigate?.();
        }
      }}
    >
      {children}
    </a>
  );
}
