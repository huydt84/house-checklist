"use client";
import { useEffect, useRef, useState } from "react";
import { orderedApartments } from "../lib/domain.mjs";
import { errorText, t } from "../lib/i18n.mjs";

export function usePropertyReorder({ list, snapshot, save, locale }) {
  const root = useRef(null);
  const session = useRef(null);
  const frame = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const ids = list.map((a) => a.id);
  const signature = ids.join(":");
  const displayed =
    preview?.signature === signature
      ? preview.ids.map((id) => list.find((a) => a.id === id)).filter(Boolean)
      : list;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function announce(state, key) {
    const property = list.find((a) => a.id === state.id);
    setAnnouncement(
      `${property?.name}: ${t(locale, key)} · ${state.ids.indexOf(state.id) + 1} / ${state.ids.length}`,
    );
  }
  function start(id, mode, pointer) {
    if (busy || session.current) return false;
    const state = {
      id,
      mode,
      ids: [...ids],
      original: [...ids],
      signature,
      ...pointer,
    };
    session.current = state;
    setPreview(state);
    setError(null);
    announce(state, "reorderPickedUp");
    return true;
  }
  function move(index) {
    const state = session.current;
    if (!state || state.signature !== signature) return;
    const next = state.ids.filter((id) => id !== state.id);
    next.splice(Math.max(0, Math.min(index, next.length)), 0, state.id);
    if (next.join(":") === state.ids.join(":")) return;
    state.ids = next;
    setPreview({ ...state });
    announce(state, "reorderMoved");
  }
  async function finish(cancel = false) {
    const state = session.current;
    session.current = null;
    cancelAnimationFrame(frame.current);
    if (!state) return;
    if (
      cancel ||
      state.signature !== signature ||
      state.ids.join(":") === state.original.join(":")
    ) {
      setPreview(null);
      announce({ ...state, ids: state.original }, "reorderCancelled");
      return;
    }
    setBusy(true);
    // Replace only visible slots so search/status/archive filters keep hidden rows in place.
    const visible = new Set(state.original);
    let index = 0;
    const apartmentOrder = orderedApartments(snapshot).map((a) =>
      visible.has(a.id) ? state.ids[index++] : a.id,
    );
    try {
      await save(
        "apartments.reorder",
        snapshot.collection,
        { apartmentOrder },
        {
          expectedRevision: snapshot.collection.apartmentOrderRevision || 0,
        },
      );
      announce(state, "reorderSaved");
    } catch (e) {
      setError(errorText(locale, e));
    } finally {
      setPreview(null);
      setBusy(false);
    }
  }
  function trackPointer() {
    const state = session.current;
    if (!state || state.mode !== "pointer") return;
    if (Math.hypot(state.x - state.startX, state.y - state.startY) >= 5) {
      const edge = 64;
      if (state.y < edge) window.scrollBy(0, -12);
      else if (state.y > innerHeight - edge) window.scrollBy(0, 12);
      const rows = [
        ...root.current.querySelectorAll("[data-property-id]"),
      ].filter((row) => row.dataset.propertyId !== state.id);
      const bounds = root.current.getBoundingClientRect();
      if (state.x >= bounds.left && state.x <= bounds.right) {
        const index = rows.filter((row) => {
          const rect = row.getBoundingClientRect();
          return state.y > rect.top + rect.height / 2;
        }).length;
        move(index);
      }
    }
    frame.current = requestAnimationFrame(trackPointer);
  }
  function bind(id) {
    return {
      disabled: busy || list.length < 2,
      "aria-pressed": preview?.id === id,
      "aria-describedby": "property-reorder-help",
      onPointerDown(e) {
        if (e.button !== 0 || !e.isPrimary) return;
        if (
          !start(id, "pointer", {
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
          })
        )
          return;
        e.currentTarget.focus();
        // Capture on the stable list: moving the keyed row can release capture on its handle.
        root.current.setPointerCapture(e.pointerId);
        frame.current = requestAnimationFrame(trackPointer);
      },
      onKeyDown(e) {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          if (session.current?.id === id) void finish();
          else start(id, "keyboard");
        } else if (
          session.current?.id === id &&
          session.current.mode === "keyboard"
        ) {
          const position = session.current.ids.indexOf(id);
          if (e.key === "Escape") {
            e.preventDefault();
            void finish(true);
          } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            move(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? list.length - 1
                  : position + (e.key === "ArrowUp" ? -1 : 1),
            );
          } else if (e.key === "Tab") void finish(true);
        }
      },
    };
  }
  return {
    root,
    displayed,
    activeId: preview?.signature === signature ? preview.id : null,
    bind,
    error,
    announcement,
    pointerHandlers: {
      onPointerMove(e) {
        if (session.current?.mode !== "pointer") return;
        session.current.x = e.clientX;
        session.current.y = e.clientY;
      },
      onPointerUp() {
        if (session.current?.mode === "pointer") void finish();
      },
      onPointerCancel() {
        void finish(true);
      },
      onLostPointerCapture() {
        if (session.current?.mode === "pointer") void finish(true);
      },
    },
  };
}
