# House Checklist deployment

Historical screenshots and generated matrices were removed on 2026-10-04. Their paths below identify the earlier checks; this cleanup did not recheck or change the deployment.

Last checked: 2026-10-03, Asia/Tokyo.

Production: [House Checklist](https://house-checklist-three.vercel.app/).

The live application is accessible and usable for Google sign-in, private rental collections, checklist answers, comparisons, and private file storage. Optional Gmail invitation consent is pending separately; no email has been sent.

## Isolated services

- Vercel project `house-checklist`, team `huydts-projects`, Node 24. Latest ready deployment: `dpl_CtDFfeCKBEQmPg3wHkCyqKcRitf5`.
- Google Cloud project `House Checklist`, ID `house-checklist-510313`. Web client `House Checklist Web`; audience In production. Gmail API enabled.
- Google callbacks: `https://house-checklist-three.vercel.app/api/auth/callback/google` and `http://127.0.0.1:3001/api/auth/callback/google`.
- Neon resource `neon-canary-tree`, ID `lively-river-58175623`, free plan, connected only to this Vercel project. Migrations `001_initial.sql`, `1790938090739_multiple-owned-collections.sql`, and `1790940000000_property_decisions_and_viewing.sql` applied; no local sample seed applied to production.
- Vercel Blob `house-checklist-blob`, Private, Tokyo HND1, connected only to this project.

## Credential storage

The six application keys are in the ignored `.env` with mode 0600 and in Vercel **Production Secrets**: `AUTH_SECRET`, `OAUTH_ENCRYPTION_KEY`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `POSTGRES_URI`, and `BLOB_READ_WRITE_TOKEN`. Credential values are not included in documentation, screenshots, or source code. `.env` is the source of truth: `pnpm deploy:prod` validates and syncs these keys, applies pending migrations, then deploys the linked project. All six were present and synced for this release; the existing encryption key was retained.

On 2026-10-02, deployment packaging inspection found that Vercel CLI ignores Git's rules and had included `.env` in private deployment source uploads. `.vercelignore` now excludes environment files, local uploads, generated offline assets, and test artifacts explicitly. The latest remote build downloaded 104 source files and has no `.env` file or warning; hosted credentials come from Vercel's environment configuration. There is no evidence of public credential exposure. Older private deployment snapshots retain their original upload contents.

Vercel uses HTTPS `APP_URL`/`AUTH_URL` and `APP_ENV=production` as Config values. `LOCAL_AUTH` is absent. The local environment uses loopback callback URLs and records `PRODUCTION_APP_URL`; the setup script maps hosted values separately and passes secrets through standard input.

## Verified

- Ordinary Google sign-in succeeds with the owner account.
- Private collection has 116 criteria and 11 sections. Canonical area edits persist after reload and appear in comparison.
- Private PDF upload/finalization and authenticated retrieval succeed. Anonymous retrieval returns 401.
- Live comparison inspected at 320, 390, 1440, and 1920 px without page-wide overflow.
- Build, lint, ten domain tests, six real-Postgres integration tests, and twenty-four Chromium/mobile-WebKit workflows pass (40 total). After the final contrast-only CSS correction, the affected checklist/Costs workflow passed again in both engines and the forty-case responsive/contrast matrix passed.
- Missing/expired OAuth verification cookies now lead to a localized recovery screen. A fresh Google identity sign-in succeeds; the old `/api/auth/error?error=Configuration` URL redirects to recovery.
- Both verification apartments are archived, leaving a clean active shortlist; their answers and synthetic attachment remain recoverable.
- Original house/check favicon, Apple home-screen icon, ordinary/maskable installation icons, and a 1200 × 630 sharing preview are deployed. Anonymous requests to all eight asset/manifest routes return 200. Production HTML declares HTTPS Open Graph and Twitter image URLs plus the favicon and Apple links. Build and lint pass; a live browser image inspection confirms the preview and the signed-in workspace still opens. Screenshot: `brand-preview-live.jpg`.
- Three user-supplied apartments are saved in the existing owner collection. The five custom source-table criteria preserve monthly figures, upfront cash estimates, supplied two-year totals, decimal cost-per-area values, and original route notes in a separate section. Canonical area/layout and room numbers are saved; Studio is recorded as Other with the exact explanation Studio; the Japanese layout code remains unconfirmed. Monthly cost records are explicitly unconfirmed aggregates, with rent/management breakdown, tax, and dates left unknown. Reload verification confirms every source value, including all decimal digits, and a Saved status with no failed drafts.
- The missing favicon was reproduced as an old root page returned by the service worker's precache before its network navigation route. Network-first navigation now registers first; new workers activate and claim clients without reloading or discarding input. The normal production URL now shows current icon/preview metadata. Browser tests reproduce a changing release's favicon URL and pass in Chromium and mobile WebKit while offline recovery still works.
- Data entry exposed and fixed a yen-per-area decimal validation error, hidden standalone monthly charges in the apartment list, interleaved custom comparison criteria, technical custom IDs shown in viewing cards, untranslated layout IDs hiding Other explanations in apartment rows, and missing apartment context/misleading conflict wording for failed saves. Relevant regressions failed before fixes and pass afterward. Live comparison has no page-wide overflow at 320, 390, 1440, and 1920 px. Final confirmation: `rental-data-final.jpg`.

Checklist progress badges remain visible at every width; answered checks and pending checks have distinct states and section counts. Building year no longer repeats its unit. Monthly housing is strictly rent + management. The 24-month expense is a saved manual input, not an inferred calculation. All records in Costs (optional) are excluded from automatic totals regardless of their names. Benefit creation and its separate summary are removed; optional records have Delete and Undo. The final release was inspected locally at all four required widths and in the existing signed-in production workspace. Manual estimate persistence, optional-record isolation, deletion, and Undo pass in both browser engines. Screenshot: `checklist-costs-live.jpg`.

Individual fields inside apartment cards now show Filled/Empty markers, check/open-circle icons, and teal styling for filled values. This includes Overview, Viewing checklist, Costs, Travel, and external-link dialogs. Zero is filled and blank/cleared text is empty; not-applicable answers keep their own state. Live verification confirms field markers in the existing owner workspace, unchanged 7/87 progress, preserved reference amounts, and an anonymous session with local authentication disabled. No production apartment data was edited. Final proof: `field-visibility-live.jpg`.

The request audit closed three gaps: saved optional-cost name/amount fields now show their own Filled/Empty markers, legacy benefit entries are excluded from Costs while stored data is preserved, and checklist helper text/status badges have readable contrast. The existing owner workspace was reloaded on the final release: 7/87 remains unchanged, the optional ¥50,000 reference is preserved, canonical empty fields are marked Empty, and the reference fields are marked Filled. No production rental data was edited. Proof: `checklist-cost-audit-live.jpg`. Detailed behavior and verification are in `../checklist-cost-audit.md`.

## Optional Gmail connection

Ordinary sign-in requests only `openid email profile`. Invitation sending asks incrementally for `gmail.send`, with no inbox-reading access. Google currently displays an unverified-app warning for this sensitive permission. Approval to connect the owner Gmail and send one Viewer invitation to the owner secondary account is pending. No Gmail user grant, email delivery, or new collection membership is claimed.

Google branding/sensitive-scope verification has not been completed. The app public homepage, privacy policy, terms, authorized domain, declared scopes, and production audience are configured.

### Google verification follow-up — 2026-10-02

Live Google Cloud inspection found Data Access had no declared scopes. Saved the three basic identity scopes (`openid`, `userinfo.email`, `userinfo.profile`) and the app's existing `gmail.send` permission, with an invitation-only justification. No Gmail user grant or invitation was sent. The required YouTube demonstration link is still missing.

The branding verifier initially rejected the homepage because ownership of `https://house-checklist-three.vercel.app/` had not been verified. After the user's explicit deployment authorization, `pnpm deploy:prod` completed as `dpl_HaTozDgTmiE3fxn86AFbJAFfvr2G` and updated the existing production alias. `public/google8a210a6219d52b30.html` returns HTTP 200 on production with the exact Google-provided content. Search Console confirmed ownership through the HTML file in the existing operator account on 2026-10-02, before 21:23 JST. Production anonymous session verification confirms local authentication is disabled. Proof: `google-search-console-verified.jpg`.

Next: wait the 24 hours requested by Google's branding verifier (retry after 2026-10-03 21:23 JST), then retry branding verification. Verification Center currently disables sensitive-scope submission until branding is verified and published. Prepare a real demonstration of the OAuth consent and invitation feature before submitting Gmail scope verification. Website ownership verification is complete; OAuth branding and Gmail scope verification remain incomplete.

Read-only comparison: travel-plan's OAuth client belongs to Google Cloud project `deep-atlas-427218-v4` (My First Project). Its Audience is External / Testing with one test user, and Verification Center explicitly says verification is not required because the app is in Testing. `gmail.send` is declared there. This is not evidence of Google production approval. No travel-plan settings or credentials were changed. Proof: `travel-plan-oauth-testing.jpg`.

Deployment concurrency note: the initial production migration audit found none pending. Before the deployment runner executed migrations, another workspace update added `1790943423409_simplify-building-year-and-remove-availability.sql`, which the runner applied. Post-run inspection confirms it archives availability rather than deleting answers, and preserves previous building details in `legacyBuildingDetails` and notes. The deployment also includes the contemporaneous building-year interface changes. The browser smoke suite passed five of six cases; mobile WebKit's quick-creation case was blocked by the local Next.js developer-tools portal intercepting navigation, and a focused retry reproduced it. The production build succeeds. This follow-up does not claim a completely passing local browser suite.

## Device boundary

### Checklist input and checkbox fixes — 2026-10-03

`pnpm deploy:prod` completed as `dpl_CtDFfeCKBEQmPg3wHkCyqKcRitf5`
and updated the existing production alias. Credentials were synced from the
ignored `.env` through standard input; no migrations were pending or applied.

Checklist drafts now resist older snapshots while local saves are in flight.
The Not applicable control changes only when the checkbox itself is clicked;
its text and the empty space along the row no longer toggle it or clear the
answer. Keyboard activation remains available.

Local validation passed build, lint, 13 domain tests, 12 database tests, and all
10 affected Chromium/mobile-WebKit browser checks. Visual review covered 320,
390, 1440, and 1920 px. Production homepage, anonymous session, and service
worker return 200; the live client contains the checkbox fix, Google sign-in
renders without browser errors, and local authentication remains disabled.
Verification did not edit production rental data.

Physical iPhone Safari testing is not complete. The mobile WebKit production-build suite passes, including offline recovery, but is not a physical-device test.


## Live UX and latency audit

The 2026-10-02 UX audit is deployed. Production browser testing found and fixed lost Forward history after cancelling Back, false dirty state after restoring an empty input, unclear missing-cost summaries, an indirect journey-creation action, and a misleading Saving indicator during background reads. Refresh now uses one authorized SQL statement and keeps pool connections across the 20-second poll interval. Final observed refresh samples were 195, 1212, 216 and 232 ms; warm workspace reload was 343 ms and client navigation 11–42 ms. Startup/network spikes remain possible. Details and measurement limits: `../ux-audit.md`.

All four required live viewport widths pass overflow checks; final Chrome error/warning log is empty. No production rental data was saved or deleted. Local authentication remains disabled. Screenshots are in `.impeccable/review/live-ux/`.

Final validation: build and lint pass; 10/10 domain, 6/6 database, and 40/40 Chromium/mobile-WebKit browser tests pass.


Native browser history follow-up is deployed: explicit initial collection URLs, native links for collection choices and property tabs, linked mobile settings and breadcrumbs, and collection-scoped destination cleanup. Browser Back/Forward and copied deep links were verified in live Chrome. The full local suite is now 42/42 browser tests, plus 10 domain and 6 database tests. The new collection regression reproduces the initial `/` history bug before the fix and passes afterward. Detailed evidence is in `../ux-audit.md`.

Collection and property renaming is deployed to the production alias. Owners and
editors have focused rename dialogs with validation, cancel, and offline saves;
queued renames preserve earlier pending property edits. Local validation passed
build, lint, 10 domain tests, 7 database tests, and all 48 browser workflows.
After the dialog focus correction, all 10 affected Chromium/mobile-WebKit checks
passed again. Visual review covered 320, 390, 1440, and 1920 px, with sampled
English/Japanese/Vietnamese and light/dark combinations. Production homepage,
session, and service worker return 200; the deployed client includes both rename
controls, and anonymous session verification confirms local authentication is
disabled. No production rental data was edited during deployment verification.

Multiple owned collections are deployed to the production alias. The production
Neon migration replaced the unique owner index with a nonunique lookup index and
recorded its application atomically under the migration advisory lock. Read-only
verification confirmed the old limit is removed, the new index is present, and
the existing collection is preserved. The SQL editor was restored to read-only.
The migration used Vercel's existing database query interface; production secrets
and environment settings were not changed.

Local validation passed build, lint, 10 domain tests, 7 database tests, and all 4
affected Chromium/mobile-WebKit creation/history checks, including 320, 390,
1440, and 1920 px. Live signed-in verification confirmed that **Create a
collection** is enabled for the existing owner and opens the creation dialog.
The dialog was closed without creating test collections. Homepage, session, and
service worker return 200, and anonymous verification confirms local
authentication remains disabled. Proof: `multiple-collections-live.jpg`.
