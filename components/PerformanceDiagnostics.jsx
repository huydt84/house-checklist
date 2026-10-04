"use client";
import { useEffect, useRef, useState } from "react";

// Explicitly requested support view. Measurements stay in this tab; no telemetry
// is sent, and neither response bodies nor account identifiers are displayed.
export default function PerformanceDiagnostics({ routeKey, ready }) {
  const [metrics, setMetrics] = useState(null);
  const readyAt = useRef(null);
  const [transitions, setTransitions] = useState([]);
  useEffect(() => {
    if (ready && readyAt.current == null) readyAt.current = performance.now();
    const sample = () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const requests = performance
        .getEntriesByType("resource")
        .filter(
          (r) =>
            new URL(r.name).origin === location.origin &&
            new URL(r.name).pathname.startsWith("/api/"),
        )
        .slice(-12)
        .map((r) => ({
          path: new URL(r.name).pathname.replace(
            /[0-9a-f]{8}-[0-9a-f-]{27,}/gi,
            ":id",
          ),
          ms: Math.round(r.duration),
          status: r.responseStatus || "—",
          bytes: r.transferSize,
        }));
      setMetrics({
        ttfb: Math.round(nav?.responseStart || 0),
        ready: readyAt.current == null ? null : Math.round(readyAt.current),
        requests,
      });
    };
    sample();
    const interval = setInterval(sample, 1000);
    return () => clearInterval(interval);
  }, [ready]);
  useEffect(() => {
    const start = performance
      .getEntriesByName("house-navigation-start")
      .at(-1)?.startTime;
    if (start == null) return;
    let second;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const label =
          new URLSearchParams(routeKey).get("tab") ||
          new URLSearchParams(routeKey).get("page") ||
          "apartments";
        setTransitions((previous) => [
          ...previous.slice(-7),
          { label, ms: Math.round(performance.now() - start) },
        ]);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [routeKey]);
  return (
    <details className="performance-diagnostics" open>
      <summary>Performance diagnostics</summary>
      <p>
        Local measurements only · milliseconds · navigation includes the next
        painted frame.
      </p>
      <p>
        Document TTFB: {metrics?.ttfb ?? "…"} ms · Workspace ready:{" "}
        {metrics?.ready ?? "…"} ms
      </p>
      <table>
        <caption>Recent API requests</caption>
        <thead>
          <tr>
            <th>Request</th>
            <th>Time (ms)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {metrics?.requests.map((r, i) => (
            <tr key={i}>
              <td>{r.path}</td>
              <td>{r.ms}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Recent navigation:{" "}
        {transitions.map((r) => `${r.label}: ${r.ms} ms`).join(" · ") ||
          "No navigation yet"}
      </p>
    </details>
  );
}
