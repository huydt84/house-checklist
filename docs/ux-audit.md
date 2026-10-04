# UX audit — 2 October 2026

Scope: apartment list; Overview, Viewing, Costs, Travel and Files; Compare;
Questions; shared checklist, preferences and members; loading, synchronization,
permissions, offline edits, keyboard interaction and responsive presentation.
The supplied screenshot was reviewed against the current implementation.

## What “Unknown” meant

The figure was monthly housing: canonical rent (H01) plus management/common-area
fees (H02). A missing input deliberately makes the total unknown; explicit zero
and Not applicable remain meaningful. Its caption incorrectly used completeness
of the entire cost projection, including unrelated charges and dates. This
produced the contradictory “Unknown / Known charges” in the screenshot.

The card now always names Monthly housing, lists the missing inputs, and offers
Enter costs (View costs for viewers). That link opens Costs directly. Rent and
management inputs now come before the longer dates/estimate form. No missing
amounts were invented or converted to zero.

## Findings and repairs

| Area                   | Finding                                                                          | Repair                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation             | Screens and tabs existed only in React state                                     | Collection, screen, apartment, tab, filters and comparison selection are URL state; reload, deep links and browser history restore them |
| Native links           | Apartment and primary navigation controls could not open in another tab          | Real anchor destinations with immediate local navigation; active-page semantics                                                         |
| Navigation position    | Opening a property far down a list could retain the old scroll position          | Property and primary navigation links start at the top                                                                                  |
| Search                 | Filters disappeared after opening a property; empty results offered no reset     | Persistent filters and Clear filters action                                                                                             |
| Comparison             | Selection disappeared on refresh and had no clear action                         | URL-backed selection, Clear selection, and a prompt when a second apartment is needed                                                   |
| Mobile comparison      | Both columns could show the same apartment; desktop travel summaries were absent | Stable apartment identities, swap behavior and distinct fallbacks; mobile travel summaries                                              |
| Uncertainty            | Missing address/viewing status appeared as an unexplained dash or “Not checked”  | Address not entered and Not scheduled labels                                                                                            |
| Mobile hierarchy       | Cost value was deeply indented; oversized empty photo slots crowded long names   | Compact thumbnails, full-width cost column, readable captions, wrapping names and consistent internal arrows                            |
| Contrast               | Muted text on the light shaded surface measured 4.30:1                           | Darkened the muted token to exceed 4.5:1                                                                                                |
| Accessibility          | Detail tabs lacked keyboard navigation and panel relationships                   | Arrow/Home/End navigation, one tab stop, labelled tabpanel; route heading focus                                                         |
| Forms                  | Explicit-save drafts could disappear on navigation or modal close                | Unsaved status and leave confirmation; browser unload protection                                                                        |
| Initial API failure    | Skeleton could remain indefinitely without an effective retry                    | Error/empty state with Retry while preserving locally saved drafts                                                                      |
| Background API failure | Refresh errors were swallowed and status could say Saved                         | Errors propagate, Retry status/action, and recovery after a successful refresh                                                          |
| Slow connections       | Timeout/network errors had only generic feedback                                 | Localized connection/timeout explanations that say drafts are retained                                                                  |
| Collection switching   | Global sync promise and stale async callbacks could cross collection boundaries  | Per-account/collection synchronization and active-collection guards                                                                     |
| Database latency       | Snapshot performed sequential entity reads                                       | One aggregated entity query inside the existing authorized repeatable-read transaction                                                  |
| Rendering              | Comparison recomputed the same costs repeatedly; list images eagerly loaded      | One cost result per selected property, lazy images with fixed slots                                                                     |
| Appearance             | Startup effects could overwrite stored theme before initialization finished      | Persist preferences only after their initial read                                                                                       |

## Performance evidence

Before the change, eight local HTTP snapshot reads measured 17–24 ms; changes
reads measured 7–9 ms. These do not establish production latency.

Using the real local database with a controlled 20 ms delay per query, snapshot
loading fell from 12 calls / 306 ms to 5 calls / 132 ms. This isolates the network
round-trip cost; it is not a claim about measured production improvement. Existing
permission and transactional integration tests verify the new snapshot path.

## Verification and boundaries

The original URL and caption regressions failed before repair and passed after.
Browser coverage includes missing-cost entry, filter/selection restoration, API
failure/retry and unsaved-form/keyboard behavior. Existing domain, database,
PDF, conflict, storage, upload and offline tests remain part of verification.
The final production visual matrix covers 67 sampled screen/locale/theme
combinations at 320, 390, 435, 1440 and 1920 px, with zero page-wide overflows
and zero runtime errors. Captures and the matrix are in
`.impeccable/review/ux-audit/`. This samples EN/JA/VI and light/dark; it is not
an exhaustive Cartesian product. The first visual pass found mobile comparison
overflow, corrected and confirmed in the final pass.

Build, lint, 10 domain/PDF unit tests and all 6 database integration tests passed.
The complete production browser suite passed: **38/38** across Chromium and
mobile WebKit, including offline edits, PDF exports and the audit regressions.

Production provider timing, real listing values and physical-device Safari are
outside this local verification. This task does not deploy or alter hosted data.
The mechanical design scan reported existing typography-ramp advisories; the
established visual identity was retained rather than replaced.


## Live deployment verification — 2026-10-02

Deployed to https://house-checklist-three.vercel.app/ and exercised the signed-in production workspace in Chrome. Final deployment: `dpl_9zVu7sH6ooGhyPyoX87GVWLS3ypK`.

Live findings and repairs:

- Cancelling Back used pushState, destroying existing Forward history. Indexed history restoration now returns to the original entry without publishing the rejected route or unmounting the draft. The browser regression failed before repair and passes in Chromium and mobile WebKit. Live verification retained the synthetic draft and navigated Forward to Travel afterward.
- Returning a previously empty field to empty still counted as dirty because missing/null and empty input values differed. Form updates now restore the stored baseline. The existing unsaved-form browser test was extended; it failed before repair and passes afterward. Live verification reports zero dirty forms after restoring the empty estimate.
- Costs and comparison summaries used vague Unknown labels. They now identify missing inputs and expose direct cost links. The misleading Recurring heading above deposits and key money is now Other housing costs.
- The Travel empty-state action required another click after reaching preferences. It now opens the journey form directly; the form URL supports Back/Forward. No scenario was saved during production verification.
- Background reads displayed Saving without a pending write. They now display Checking updates.
- Refresh performed five sequential database round trips for an owner (six for a member). One SQL statement now reads authorized membership, sequence and filtered events under one PostgreSQL statement snapshot. Integration tests verify revocation, collection isolation, invitation visibility and cursor semantics.
- The pool's 10-second idle timeout expired between 20-second refreshes. A 60-second timeout permits reuse across polls; the existing pool size stays five.

### Real browser measurements

An explicit `?diagnostics=1` view reads the browser Performance timeline, with sanitized API paths. It sends no telemetry and is absent from ordinary URLs. Navigation timings include the next painted frame; no browser-automation round-trip timings are substituted.

| Measurement | Before live repairs | Final release |
| --- | --- | --- |
| API refresh, observed samples | 584, 1245, 995, 989, 918 ms; another reload: 490, 1018, 954, 955, 930, 928, 928 ms | 195, 1212, 216, 232 ms |
| Warm reload, document TTFB / usable cached workspace | 26 / 265 ms | 52 / 343 ms |
| Client navigation | 10–44 ms | 11–42 ms |
| First load after release, document TTFB / workspace | 472 / 2694 ms | 764 / 1458 ms |

These are a small sample from one real signed-in browser, not a load test or service-level guarantee. The 1212 ms refresh outlier remains visible; connection/function/network startup still varies. Steady refreshes were about 0.2 seconds after the query and connection-reuse changes. Cached-workspace readiness does not mean the background refresh has finished.

### Production UX checks

- Apartment → Costs/Travel, cross-page preferences, URL reload, Back/Forward, cancel-Back with retained draft and preserved Forward, search restoration, comparison selection, direct cost link, journey form Back/Forward.
- Chrome viewports: 320, 390, 1440, 1920 px. Document width equals viewport width at each size. Mobile shortlist and comparison, Costs and desktop list inspected. Final browser error/warning log empty.
- Anonymous `/api/session` confirms `user:null`, `local:false`, `configured:true`.
- No production rental values were saved or deleted. Synthetic values were never submitted; the final verification draft was restored to empty and selection was cleared. Final deliverable tab is the normal root URL with the viewport override reset.
- Screenshots: `.impeccable/review/live-ux/mobile-390.jpg` and `apartments-320.jpg`, `apartments-1440.jpg`, `apartments-1920.jpg`.
- Build, lint, 10 unit tests, 6 Postgres integration tests pass. Final focused Chromium/WebKit suite: 8/8. Final full Chromium/mobile-WebKit suite: 40/40 passed (1.7 minutes).


## Native browser history follow-up — 2026-10-02

Deployment `dpl_9rHjtk7J3T8DP3hy9AKUnviwEMAt` addresses browser Back/Forward, rather than adding an internal application history UI.

- The first workspace entry is canonicalized with `collection` and `page` using replaceState. A new real-DB browser test reproduced the old failure: after switching collections, native Back returned to `/` while leaving the second collection visible. This regression now passes in Chromium and mobile WebKit.
- Property navigation explicitly includes `apartment` and `tab=overview`. All five property tabs, collection menu entries, the apartment breadcrumb, the brand link and mobile settings navigation are real href links. They support copy-link/new-tab behavior, while ordinary clicks add native history entries without a page reload.
- Switching collection clears only that destination's collection-specific filters and selection; earlier history entries retain their exact properties, tabs and filters. Checklist archive visibility is also URL-backed.
- The property-history regression now traverses all five tabs and two properties, reloads the last Costs URL, walks the full chain backward, and then walks it forward. The two-collection regression also returns from another collection to the previous property's Costs tab.
- Live Chrome verification used the browser back()/forward() operations: Corpo Costs → Travel → browser Back/Forward; Corpo Travel → shortlist → Joyful Overview → Photos → reload → browser Back through Joyful Overview and shortlist to Corpo Travel; Forward restored Joyful. A copied Costs link opened the exact property and tab in a new browser tab. The production collection menu exposes a real href; multi-collection switching was tested with isolated local database fixtures because production has only one collection.
- Final local validation: build, lint, 10 domain tests, 6 database tests, 42 Chromium/mobile-WebKit browser tests pass. Live 320/390/1440/1920 px checks have no document overflow; Chrome's error/warning log is empty. Screenshots: `.impeccable/review/live-ux/browser-history-{width}.jpg`.
