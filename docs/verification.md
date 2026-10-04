# Verification record

Generated captures, traces, matrices, and duplicate review notes were removed on 2026-10-04. Artifact paths below identify historical checks; the written results remain.

## Property entry order and drag reordering — October 2, 2026

The shortlist now uses `created_at` ascending instead of alphabetic names.
Legacy timestamps are recovered from the first property history record, with
collection creation as a fallback when history is absent. A second migration
publishes timestamps through the event feed for existing device caches.
Properties with equal timestamps use a stable ID tie-breaker.

Owner/editor drag handles support pointer capture on the stable list, touch,
viewport-edge scrolling, keyboard movement, cancellation and position
announcements. Collection order has its own revision; property revisions,
settings and checklist suitability are unchanged. Filtered moves preserve
hidden slots, and later entries append. Offline orders synchronize through the
existing queue, and concurrent-device conflicts show both ordered name lists.

The original alphabetical bug failed the new browser test before the fix.
Build/lint and all 10 domain / 12 isolated database tests pass. Database tests
cover immutable timestamps, duplicate/foreign IDs, viewer denial, order
conflicts, idempotent retries, event visibility and both legacy migrations in
temporary tables. Chromium/mobile WebKit pass reorder persistence, offline
movement, cancellation, filters, later entries and conflict recovery; Chromium
also exercises trusted touch input. Existing collection/rename workflows pass
on the production build. An earlier development-server rename run was blocked
by the Next.js development indicator over the mobile navigation; it passed
against the matching build without changing product navigation.

UI captures are produced by `tests/e2e/property-order.spec.mjs` at
320/390/1440/1920px, with locale/theme captures in its role-control test.
The new migrations first passed against the isolated local database. Following
the explicit deployment request, `pnpm deploy:prod` synced this application's
environment through standard input, applied both pending migrations to its
production database, and deployed `dpl_5v2SyWkDyiua9jDDqNwuFFZq4sv7` to the
existing production alias. Vercel reports Ready; the remote build used
pnpm 11.25.0. Production authentication reports `local: false`, and the Google
callback uses the production origin.

Post-migration verification retains all 7 properties, 38 answers and 1 active
collection. Property data and revision checksums match the pre-migration
baseline, and every property has a timestamp. The signed-in production browser
shows the same five active property IDs in database entry-time order, with
enabled 44px reorder handles and no document overflow at 320/390/1440/1920px.
No production property values or custom ordering were edited during browser
verification. Live evidence: `docs/deployment/property-order-live.png`.

## Property controls and deployment — October 2, 2026

The list and every detail tab now share three decision options (Considering,
Disqualified, Shortlisted), an independent Viewed / Not Viewed field, and
Archive / Restore actions. New apartments default to Considering and Not Viewed.
Add apartment and Overview editing both include Address and Google Maps URL.
The forward migration preserves legacy decisions in `legacyStatus`, maps explicit
Viewed records into the separate field, retains metadata and archive state, and
publishes revisioned events for existing caches. It was applied to local Postgres
and the dedicated production Neon database during the requested deployment.
Production verification retains five apartments, two archived apartments, and
24 answers. A checksum of property metadata excluding the migrated state fields
matches the pre-migration baseline.

Build and lint pass, with 10 domain and 9 database tests. The status-only change
passed all 54 production-browser checks. After the address form extension, 51
checks passed in the full run; the remaining creation/search checks passed on
focused rerun after fixing the new test's save wait and fixture isolation.
Chromium and mobile WebKit cover creation/edit persistence, offline decisions,
viewing, archive/restore from both surfaces, and viewer/editor permissions.
The list and detail matrix covers EN/JA/VI, both themes, and 320/390/1440/1920px;
the creation form is checked at all four widths. Screenshots are saved under
`test-results/property-state-*` by `tests/e2e/property-state.spec.mjs`.

Deployment `dpl_4o4h9qvbRUF25BcT7uSWZDX3mPag` is Ready on
[the existing production origin](https://house-checklist-three.vercel.app/).
The remote build passes using pnpm 11.25.0. The signed-in owner workspace displays
the three status options, separate viewing options, Archive, archived Restore,
and Address / Google Maps URL in both creation and editing. List, creation dialog,
and detail were captured at 320, 390, 1440, and 1920 pixels without page overflow;
evidence is in `docs/deployment/property-controls-*.jpg` and
`property-controls-matrix.json`. Forms and menus were opened without changing
production property values.

The ignored `.env` already contained all six application credential keys. They
were synced through standard input to Vercel Production Secrets without printing
their values or rotating the encryption key. `pnpm deploy:prod` now follows the
Travel Plan release sequence: validate/sync this project's environment, migrate
its database, then deploy its linked project. Missing credentials abort before
any hosted configuration changes. Production session verification reports local
authentication disabled and an unauthenticated anonymous request; the Google
provider exposes the production callback. The existing signed-in owner session
remains usable after deployment.

## Previous deployment verification

The app is deployed at [House Checklist](https://house-checklist-three.vercel.app/) with separate Google, Neon, Vercel, and private Blob resources. The isolated local Postgres 17 database remains available for automated verification. Production never enables local personas. Provider identifiers and current permission state are recorded in [deployment status](deployment/status.md), without credential values.

## Automated evidence

- Production build and lint pass.
- Six Node domain tests cover all 114 source checks / 116 definitions, translated seed/interface keys, answer semantics, the required cost fixture, unknown/disputed inputs, benefits, annual charges, renewal boundaries, and calendar-based travel calculations and shared journey bindings.
- Six real-Postgres integration tests cover concurrent one-owner collection creation, roles, collection-scoped references and files, same-answer conflicts, independent writes, idempotency/history/restore, checklist change rules, invitations, actual missing-mail-permission delivery failure, and revocation of queued writes.
- Twelve production-browser workflows run in Chromium and a mobile WebKit profile. They cover creation, canonical area editing, fixture totals, comparison layout, language/identity, focus, offline drafts across page closure/reopening, synchronization, conflict merging, authenticated files, viewing preparation, and storage-full draft recovery/export. The storage-full regression first failed against the earlier build because its global status incorrectly said Saved; the fix reports Retry needed until the affected write is retried.

All 24 tests, production build, and lint passed again on 2026-10-01 after cloud setup and batched checklist seeding.

The cost fixture yields **¥3,330,000** in 24-month nonrefundable expense and **¥370,000** in upfront personal cash. The **¥130,000** deposit stays separate and first-month prepayment is counted once.

## Offline test methods

Chromium uses browser offline mode. WebKit uses a stopped loopback proxy for the reopen/navigation check, because Playwright's offline flag incorrectly rejects requests that a service worker fulfills without network access. The upstream reproduction and triage are recorded in [Playwright issue 42775](https://github.com/microsoft/playwright/issues/42775). This connection-loss check is deliberately described as origin unavailability; it is not a claim of physical mobile radio testing. Both browser projects also exercise local IndexedDB drafts and conflict resolution.

WebKit testing found that response-backed Blob objects could fail IndexedDB storage. Cached downloads and queued files now persist as ArrayBuffers and reconstruct Blobs only when needed.

## Visual evidence

The matrix script covers 11 primary screens in EN/JA/VI, light/dark, at 320, 390, 1440, and 1920 px, plus the in-app browser's 435 px viewport. It checks page-wide overflow and runtime errors and saves full-page captures, with additional viewport captures for long viewing, comparison, and preferences pages. The final confirmation matrix contains 67 screen captures with no page-wide overflow or runtime errors. Results and captures are under `.impeccable/review`; that generated evidence is ignored by Git.

The first pass caught Latin font variables scoped to the body instead of the root. Font classes now apply at the root, so Geist and Noto Sans load as intended. The one detector finding—an accented edge on error notices—was changed to a uniform border. The detector was not rerun.

The independent finish review requested four corrections: full-width member identities on phones, wider preference/date fields, type-aware exemption summaries, and removal of decorative heading eyebrows. These were applied as one batch, followed by the same 67-screen matrix, two signed-out captures, and a scrolled date-field capture at 320 px. Build/lint, six domain tests, and the affected browser workflow in both engines passed after the correction; the full 24-test suite had passed immediately before that presentation-only batch. The reviewer’s verdict is **ship at the scope of those four fixes**, each scored resolved; this is not a claim of exhaustive product or cloud certification. The review and verdict are saved alongside the captures.

Documentation extraction then exposed one question-link height override below the explicit 44 px minimum. The same reviewer requested a scoped correction; after changing it to 44 px, all 12 measured links across six locale/theme captures meet that minimum. Build and lint pass. The reviewer scored this additional fix resolved with a separate scoped **ship** verdict in `verdict-touch-target.md`.

## Live provider verification

- Google ordinary identity sign-in succeeds on the production origin.
- The owner collection contains all 116 criteria across 11 sections. Cloud creation exposed a timeout from sequential seed inserts; two batched inserts now retain the same transactional seed data and complete within the browser wait period. Integration tests passed after the correction.
- Two clearly labeled sample apartments saved canonical areas of 25 and 27 m². Reload and comparison showed the same saved values. Both samples were then archived, preserving recovery/history while clearing the active shortlist.
- A synthetic one-page PDF uploaded to private Blob, finalized, and rendered through the authenticated application route. The same route returned HTTP 401 without a session.
- Live comparison was visually inspected at 320, 390, 1440, and 1920 px with no page-wide overflow. Captures are in `docs/deployment/compare-*.jpg`; authenticated PDF retrieval and Vercel Secret configuration have separate captures.
- Public privacy and terms pages are available in EN/JA/VI. Ordinary sign-in requests identity scopes; Gmail sending remains an independent owner consent step.

## Remaining verification boundaries

1. Optional Gmail sending permission and one real test invitation await the owner's action-time approval. No email has been sent and no additional membership granted. Ordinary sign-in, personal search, and file storage work without this permission.
2. Physical iPhone Safari viewing preparation, airplane-mode close/reopen, reconnect, photo capture/upload, and storage-pressure checks are not verified. Mobile WebKit automation is useful evidence but does not replace this device check.
3. Japanese/Vietnamese translations have not had a renter-authored language review beyond automated identity/key coverage and visual inspection.

## Sign-in recovery, 2026-10-02

The reported production `Configuration` error was an Auth.js `InvalidCheck`: the OAuth callback could not read its PKCE verification cookie. Auth.js expires these flow cookies after 15 minutes, and a later sign-in can replace them. A fresh identity-only Google sign-in succeeded with the same production credentials and existing collection.

The app now directs failed authentication to `/auth-error`, with EN/JA/VI recovery instructions, a return link, and a specific instruction to restart optional Gmail connection from Members. Server logs retain the error detail; the public screen does not display callback parameters or secrets. Existing apartments and drafts are unchanged by the recovery page.

A regression drives the actual Google callback handler with a synthetic code and issuer but no verification cookie. It first failed with the same `InvalidCheck` and the default server-error destination; after the change, Chromium and mobile WebKit show recovery, return to the existing local workspace, and retain the same collection identities. The local test uses `localhost` consistently because Next.js's loopback OAuth callback normalizes to that host; mixing it with `127.0.0.1` would send the synthetic session cookie to a different host.

Build, lint, six domain tests, six database tests, and all fourteen browser workflows pass. The live recovery page was inspected in EN/JA/VI at 320, 390, 1440, and 1920 px with no page-wide overflow. Both the synthetic failed callback and the user's old error URL redirect to `/auth-error` on production. A fresh Google sign-out/sign-in cycle also succeeds on the final deployment `dpl_8YxKhB4nBEvqnFQQ5vAr8WeQgLeP`, with the original collection available afterward.

## Rental data entry and cache recovery, 2026-10-02

Three supplied candidates were entered through the production browser UI into the existing owner collection. Area and layout use the shared canonical checks; monthly aggregates use unconfirmed cost records. Five translated custom checks preserve the original comparison figures and notes separately from calculated expense. No lease start, deposit breakdown, payment, allowance, route duration, or confirmation was invented. Exact decimal values survive server synchronization and reload.

The missing favicon was caused by the precached root HTML matching navigation before the network-first route. A production-build regression changes the origin's favicon metadata after the page is cached: it failed with the old icon URL, then passed after navigation routing was reordered. Newly installed workers activate and claim clients, with no forced page reload. Existing offline draft close/reopen/reconnect checks still pass in Chromium and mobile WebKit.

Entry also exposed decimal-rate rejection, standalone charges hidden in the apartment list, custom criteria interleaved into other sections, technical custom IDs shown as labels, and failed-save dialogs without apartment context or accurate failure wording. The decimal, ordering, list-display, and conflict-context regressions each failed for the intended symptom before their fixes. Whole-yen restrictions remain for actual yen obligations; derived `JPY/m²` rates retain decimals. Costs still come from the common calculation layer.

Final verification: build, lint, seven domain tests, six real-Postgres tests, and sixteen browser workflows pass (29 tests). The populated live comparison was inspected in one batch at 320, 390, 1440, and 1920 px, then confirmed after deployment on the ordinary production URL. All widths have no page-wide overflow. Screenshots: `docs/deployment/rental-data-*.jpg`, `rental-list-final.jpg`. The final deployment is `dpl_DizQbn2LhUhRS8dyRE2HvzPtCcm9`.

Ownership transfer, public sharing, automated ranking, scraping, AI extraction, route APIs, OCR, and tax/eligibility inference are outside v1.

The apartment list now uses the same translated answer renderer as comparison, preserving Other explanations such as Studio instead of showing internal choice IDs. The existing canonical-value browser workflow reproduces this defect before the fix and verifies the translated label plus explanation afterward. Corpo Eiko retains Studio as its supplied layout without assuming a Japanese 1R designation.

## Checklist and cost corrections, 2026-10-02

Checklist badges were hidden at narrower widths. They now remain visible, with icons and text, distinct answered/not-applicable surfaces, and per-section progress in desktop navigation, the phone selector, and the section heading. The building-year support input no longer repeats the year unit.

Monthly housing is derived exclusively from rent plus management, and stays unknown until both are supplied or explicitly not applicable. Every record in the final optional Costs section is excluded from all automatic totals, without name matching. A domain regression includes arbitrary charges, a linked rent record, a discount, a benefit, and an employer payment; none changes the housing sum or automatic upfront amount.

The 24-month expense is a manually entered estimate with its own translated input. It remains unknown until entered, persists after reload, and does not require a rent start date. No 24-month rent multiplier is applied by the app. The domain regression failed against the old automatic estimate before the fix and covers manual values, zero, and clearing. The general explicit calculation utility retains its independent fixture coverage; the apartment summary no longer uses it for a two-year estimate.

Costs removes benefit creation, the allowance input, and the separate benefit summary. Additional records offer Delete and Undo. Full record data and links are retained through these updates, including an unsynchronized record. The browser workflow verifies mobile answer states, the building-year label, the derived housing sum, a saved manual estimate that remains unchanged by optional charges, Undo, deletion after reload, and preserved rent.

Final verification: production build, lint, eight domain tests, six real-Postgres tests, and eighteen browser workflows pass (32 tests). The browser suite includes Chromium and mobile WebKit. Viewing and Costs screens were checked in EN/JA/VI, light/dark, at 320, 390, 1440, and 1920 px without page-wide overflow, hidden status badges, undersized Delete controls, or runtime errors. The reproducible visual matrix is in `.impeccable/review/checklist-costs/`.

Deployed to the existing production alias on deployment `dpl_2ykryKvP4SdjBi8K5vXw3nyvH3LJ`. Anonymous homepage and session requests return 200 with `local: false` and no authenticated user. The existing signed-in workspace was reloaded and verified: the manual estimate input, optional-record exclusion notice, original reference amount, Edit, and Delete are visible. No production rental data was edited during verification. Screenshot: `docs/deployment/checklist-costs-live.jpg`. Physical-device and renter-authored translation review boundaries still apply.

## Field visibility across apartment tabs, 2026-10-02

Filled status is shown on each individual data field inside cards, rather than on whole tabs or summary figures. The shared field treatment uses check/open-circle text markers and teal input styling. Overview facts and edit fields, checklist answer/support/evidence fields, Costs inputs and record editors, Travel inputs, and external-link fields use the same treatment. Zero is filled; whitespace and cleared values are empty. Not-applicable checklist answers preserve their separate state. Filters and navigation are unaffected.

The existing browser workflow was extended through the actual Overview, Costs, Travel, and Photos & files interfaces. It failed against the prior build because fields had no completion description. It verifies immediate status changes, visually distinct filled input surfaces, unchanged accessible field names, zero/clearing/whitespace behavior, and the previous cost deletion/Undo/persistence behavior. Production data is not edited for verification. Validation: build and lint pass; eight domain tests and six real-Postgres tests pass. The full eighteen-workflow Chromium/mobile-WebKit suite passes. A subsequent visual check found the new empty marker collided with the existing empty-screen CSS class; the marker uses a scoped class now. The browser workflow reproduces its excessive 340 px height before the fix and passes after it in both engines. The final five-tab visual matrix has forty cases across EN/JA/VI, light/dark, and 320, 390, 1440, and 1920 px, with no page-wide overflow, runtime errors, hidden markers, or oversized marker heights. Evidence: `.impeccable/review/checklist-costs/matrix.json`; representative Costs field screenshots are `costs-*-fields.png`. Deployed as `dpl_9vHX85o4eWTkpVofEHBytcrGDbrD` to the existing production alias. Remote build succeeds using pnpm 11.25.0. Anonymous homepage/session routes return 200 with `local: false` and no authenticated user. The signed-in workspace visibly shows individual Filled/Empty markers in Overview and Costs, with the original 7/87 checklist count and original optional reference amounts. Production data was not edited. Proof: `docs/deployment/field-visibility-live.jpg`.

## Checklist and Costs request audit, 2026-10-02

The requested behavior was audited against the source, the isolated local app, and the signed-in live workspace. Three verified gaps were closed: saved optional-cost name/amount fields lacked completion markers, legacy benefit records could still appear in Costs, and light-mode secondary text/status badges lacked sufficient contrast. The first two regressions failed before their fixes in the existing browser workflow. Legacy benefit data stays preserved while its Costs entry is hidden. The final responsive matrix measures actual foreground/background contrast for checklist helpers, field markers, and state badges.

Build and lint pass. Ten domain and six real-Postgres tests pass. All twenty-four Chromium/mobile-WebKit workflows passed before the final contrast-only CSS correction; the affected workflow passed again in both engines on the final build. The final forty-case matrix passes at 320, 390, 1440, and 1920 px across EN/JA/VI and light/dark with no overflow/runtime errors and readable status text. Deployment `dpl_o6STrabmAnJ1eLJVqcjJY8MYamXV` is Ready on the existing production alias. Anonymous session verification shows local authentication disabled. Live reload confirms original 7/87 progress, the preserved ¥50,000 optional reference with two Filled markers, and Empty canonical fields. No production rental data was edited. Proof: `docs/deployment/checklist-cost-audit-live.jpg`. The request-by-request behavior and remaining verification boundaries are recorded in `docs/checklist-cost-audit.md`.

## Separate header controls, 2026-10-02

Language, appearance, and profile now have independent controls at the top right on desktop and mobile. The collection selector contains collection actions only. The language dropdown retains EN/JA/VI and the active-language indicator. The sun/moon button switches directly between light and dark and persists the selection; an existing system preference follows OS changes until the user clicks the toggle. The profile menu shows the user’s name, email, and Sign out. Local-only persona switching remains available only in local mode. Mobile uses language codes and an avatar, with full account identity in the menu, and puts save status on a second header row. The comparison pair selector respects the new 88 px sticky mobile header.

Validation: production build and lint pass; eight domain tests, six local Postgres tests, and the six relevant Chromium/mobile-WebKit workflows pass (language/canonical identity and keyboard focus, storage exhaustion and retry/export, creation and responsive comparison). A 24-case header matrix covers all three locales and both themes at 320, 390, 1440, and 1920 px with no document overflow or runtime errors. It verifies independent menus, 44 px controls, OS-theme changes before an explicit selection, theme persistence after reload, Escape focus restoration, and actual local sign out. Screenshots and measurements are in `.impeccable/review/header-controls/`. This change was verified locally and was not deployed.

## Property and comparison PDF export, 2026-10-02

Property headers and Compare now offer direct PDF downloads in EN/JA/VI.
Property reports omit unknown/unfilled fields, unanswered checks without evidence,
and empty sections. Explicit zero, No, Not applicable, recorded evidence, and
notes remain. Costs reuse the domain calculations and label partial totals and
manual estimates. Optional records remain reference only. Files are listed;
images and attached PDF contents are not embedded.

Comparison reports export all two to four selected properties, including those
outside the mobile pair, and use the same checklist filter function as the UI.
Applied filters, completion, cost/journey summaries, missing-data labels, and
repeated property-column headers remain visible. Reports capture the displayed
workspace at click time and label unsynchronized/conflicted/offline data.
Generation runs in the browser without uploading reports or creating public
links. Licensed static Noto Sans JP fonts cover mixed Japanese/Vietnamese/English
content and are precached with the renderer for offline export.

Validation: build and lint pass; ten unit tests and six isolated Postgres tests
pass. All twenty-four production-browser tests pass in Chromium/mobile WebKit.
The six new PDF browser cases parse actual downloads, verify property omission,
local offline data, four-property selection, active filters, independently known
housing/manual totals, pagination, viewer export, and failed-font retry. Long
notes and mixed-script names survive PDF extraction. The two report unit cases
cover zero/No/exemptions, evidence-only answers, whitespace, stale suitability,
draft/conflict labels, selection order, and empty comparison results.

The final UI matrix covers both affected pages in all three locales and both
themes at 320, 390, 1440, and 1920 pixels: 48 captures with no document overflow,
no runtime errors, and export controls at least 44 pixels high. Generated review
evidence is in `.impeccable/review/pdf-export/`. Exported representative PDFs
were rendered and inspected for glyphs, wrapping, pagination, repeating headers,
and omitted empty fields. Concurrent rebuilds initially invalidated offline
shell checks; the suite passed after rebuilding and restarting a matching local
server. No production deployment or production data changes were performed.
## Collections navigation — October 3, 2026

The active collection name links to its properties list and clears property
detail/filter state. The House Checklist brand links to `/?page=collections`.
This screen lists accessible collections, offers online creation, and links
owners/editors to each collection's existing name and preferences form. Viewers
have no edit action. Reload and browser Back/Forward preserve the list route;
unsaved form navigation still uses the existing guard.

Build and lint passed, along with 12 domain tests, 12 local Postgres integration
tests and 32 relevant Chromium/mobile WebKit browser cases. The extended
collection workflow creates two disposable collections, edits the first while
the second was selected, waits for server persistence, reloads and switches
collections at 320, 390, 1440 and 1920px. It cleans up only its local fixtures.

The 11 captures in `.impeccable/review/collections-navigation/matrix.json` cover
the list in sampled EN/JA/VI and light/dark combinations at the required widths,
plus creation and editing at 320 and 1440px. Each was visually inspected; no
page overflow or browser runtime errors were detected. Additional read-only
local browser checks confirmed editor/viewer actions and the empty collection
state. Language preferences were overridden only in those test browser
responses, leaving server preferences unchanged. This is local verification;
no production deployment or provider changes were performed.

Following the explicit deployment request, `pnpm deploy:prod` validated and
synced this application's production configuration. All six migrations were
already applied, so no schema change was pending. Vercel built with pnpm
11.25.0 and marked `dpl_8rjU6Z6Z9Xdb3vUSjmwopQTHha39` Ready on October 3, 2026,
with the production alias `https://house-checklist-three.vercel.app`.
Post-deployment checks returned HTTP 200 for the home page, collections route,
session API and service worker. The unauthenticated production session reported
configured sign-in and `local: false`. Signed-in collection interactions remain
covered by the local browser evidence above; no production data was changed
during these smoke checks.
# Collection archive and home entry — October 3, 2026

Bare `/` now stays at `/` and displays Collections, including after a previous
collection visit. Explicit collection links and browser history still restore
their collection scope. Owners can archive and restore from the Collections
screen; archived collections are hidden from the active list and switcher.
The archive flag preserves apartments, checklist definitions, answers, settings,
and memberships. Archive/restore require a connection and an expected revision.
Migration `1790997824600_collection-archive.sql` was applied to the isolated local
database only. No production deployment was performed.

Validation: production build and lint passed, as did all 13 domain tests and 13
database tests. The 80-scenario Chromium/WebKit suite passed 79 scenarios on its
full run; the remaining date-picker scenario read the server before startup
synchronization finished. After retaining its persistence assertion and waiting
for the server value, both browser cases passed on the focused rerun. The
archive/root cases passed in both engines, including offline disabling, server
failure retry, revision conflict retry, permissions, reloads, and Back/Forward.
The visual reviewer inspected 16 active/archive captures at 320, 390, 1440, and
1920px with sampled EN/JA/VI and light/dark combinations and returned **ship**
for this extension. Evidence lives in `.impeccable/collection-archive-review/`.

## Collection archive production deployment — October 3, 2026

After explicit user authorization, `pnpm deploy:prod` validated and synchronized
this app's credentials through standard input, applied only the reviewed
`1790997824600_collection-archive.sql` migration, and deployed the linked House
Checklist project. Vercel reported READY and assigned the production alias
https://house-checklist-three.vercel.app to deployment
`dpl_33YRg6s3UXJ2T8Vra5Edy6FZccQD`.

The user's signed-in Chrome session confirms that bare `/` stays at `/`, shows
Danh sách bộ sưu tập, and exposes Lưu trữ on both owned collection rows and
Hiện mục lưu trữ. The read-only verification did not archive actual collections.
The public home and session endpoints returned HTTP 200. The session reports
local authentication disabled and rejects a synthetic local persona cookie.
Screenshot: `docs/deployment/collection-archive-live.png`.
