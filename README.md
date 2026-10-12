# House Checklist

A private rental-search workspace for shortlists, in-person viewing notes, shared questions, and apartment comparisons. Next.js App Router, React, JavaScript modules, Auth.js, Postgres, Dexie, Radix, Phosphor, and Workbox. English, Japanese, and Vietnamese; JPY and Asia/Tokyo.

Live application: [House Checklist](https://house-checklist-three.vercel.app/). Google sign-in, the dedicated Neon database, and private Blob storage are connected. See [deployment status](docs/deployment/status.md) for live checks and the separate Gmail permission state.

## Excel exports

On Compare, select two to four apartments and click **Export Excel**. The `.xlsx`
file includes all selected apartments, the active checklist filters, cost and
journey summaries, recorded answers, notes, and evidence. The mobile pair selector
does not limit the export. Numbers and recognized dates remain typed cells, and
missing answers and incomplete totals keep their labels.

Exports use the active English, Japanese, or Vietnamese language. Owners,
editors, and viewers can export locally saved changes. Pending synchronization
and conflicts are labeled. After the offline shell is installed, Excel export
works offline. The file is generated on the device.

## PDF exports

Use **Export PDF** in a property header or on Compare. Property reports include
filled details, recorded checklist answers/evidence, costs, journeys, questions,
and a file list. Unknown fields, unanswered items, and empty sections are omitted;
explicit No, zero, and Not applicable are retained. Attachments are listed without
embedding their contents.

Comparison reports include every selected property (up to four), the current
checklist filters, and cost/journey summaries. The mobile pair selector does not
limit the export. Reports use the active EN/JA/VI language and preserve missing
values and partial-total labels in comparisons.

PDFs are generated on the device from the displayed workspace, including locally
saved changes. Pending synchronization/conflicts are labeled; unsaved form input
is excluded. Owners, editors, and viewers can export. After the offline shell is
installed, the renderer and bundled fonts are available offline. Export does not
upload the report or create a public link.

## Run locally

Requires Node 22+, pnpm 11, and Docker. The database is isolated from `travel-plan` and other projects: container project `house-checklist`, port **55433**, database `house_local`. The web app binds to loopback on **3001**.

```sh
pnpm install
pnpm db:up:local
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev:local
```

Open <http://127.0.0.1:3001>. “Open local workspace” signs in as a synthetic local owner. The account menu switches between local owner, editor, viewer, and outsider. The three example apartments and their quotes are synthetic, not listings. Local invitations are marked Local; no email is sent. Local uploads remain in the ignored `.local-files` directory.

The local authentication switch refuses to run when `VERCEL` is set or `APP_ENV=production`. Do not expose a local-auth server outside loopback. Local data can be stopped without deletion with `pnpm db:down:local`. No command here removes the database volume.

`pnpm dev:admin` is a compatibility alias for `pnpm dev:local`; it opens the local owner/persona workflow. `pnpm dev:cleanup` terminates only orphaned development helpers associated with this checkout. The Docker commands use the same Docker/Rancher Desktop fallback as `travel-plan`, without loading an environment file.

## Production build and offline tests

```sh
pnpm build
LOCAL_AUTH=true pnpm start
pnpm test:unit
pnpm test:db
pnpm exec playwright install chromium webkit
pnpm test:e2e
pnpm lint
```

Browser tests use a production build, real Postgres, and real IndexedDB. The local sample seed is required. Tests archive only the disposable apartments/files they create. Database integration tests create separate identities and collections, then clean up their own rows. Physical iOS Safari verification is a separate release check; Playwright's mobile WebKit profile is not a physical iPhone.

The shared command names follow `travel-plan`, using House Checklist's existing checks:

| Command                        | Checks                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `pnpm test:quick`              | Lint and domain unit tests                                                                     |
| `pnpm test:full`               | The full `pnpm test` suite: lint, unit, database, and browser tests                            |
| `pnpm test:browser:smoke`      | Apartment creation, phone checklist/cost editing, and sign-in recovery                         |
| `pnpm test:permissions`        | Database permissions, invitation/revocation contracts, and private browser uploads             |
| `pnpm test:permissions:repeat` | Run the permission checks twice to check repeatability                                         |
| `pnpm test:visual`             | Screenshot/overflow review at 320, 390, 435, 1440, and 1920 pixels across languages and themes |

`test:visual` requires a running local-auth production server (`LOCAL_AUTH=true pnpm start` after `pnpm build`) and the local sample seed. Screenshots and the review matrix are saved under `.impeccable/review`; an optional output directory can be passed as an argument. The other browser commands use the Playwright server configuration.

Generated review screenshots, traces, and matrices are ignored by Git. Old review output was removed on 2026-10-04; the written verification records remain. Keep the design configuration in `.impeccable/config.json`, `.impeccable/design.json`, and `.impeccable/surfaces/`.

Create a forward-only SQL migration with `pnpm db:migration:new add-apartment-status`, fill in the generated `.sql` file, and apply it with `pnpm db:migrate:local`. House Checklist retains its SQL migration runner and local-only sample seeding. Travel import, assistant, and separate persona-suite commands are specific to `travel-plan`.

`pnpm build` generates the service worker and copies the installed Workbox runtimes. Static scripts, fonts, and the application shell are precached; authenticated API responses are never put in the service-worker cache. Build artifacts under `public/offline-lib` and `public/sw.js` are generated, not source. An already-open tab keeps its active offline shell until all app tabs close; reopen the app to activate a newly downloaded version. Unsynchronized edits stay in IndexedDB across this update.

## Configure a separate cloud application

Copy `.env.template` to an ignored local environment file and configure the same names in a **new** Vercel project. Never copy the neighboring application's secrets or database. No cloud resources are created by local setup.

- Create a dedicated Neon Postgres database. Set `POSTGRES_URI` to its connection string. `pg` uses interactive transactions and collection row locks. Set up backups for this database.
- Generate distinct `AUTH_SECRET` and `OAUTH_ENCRYPTION_KEY` values. The latter encrypts Gmail credentials at rest; retain it across deployments or reconnect Gmail after rotation.
- Create a Google OAuth web application. Configure `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`; register `https://YOUR_HOST/api/auth/callback/google` as a redirect URI. Set `AUTH_URL` and `APP_URL` to the final HTTPS origin.
- Enable Gmail API for that Google project. Ordinary sign-in requests only `openid email profile`. The owner connects Gmail explicitly from Members when sending an invitation requires mail permission. Configure the OAuth consent screen and test users/verification as required for your deployment.
- Create a **private** Vercel Blob store dedicated to this application and connect its `BLOB_READ_WRITE_TOKEN`. Upload tokens require current editor/owner permission. Downloads pass through `/api/collections/:id/files/:id`, with a new membership check every time. External links are never downloaded by the server.
- Keep `LOCAL_AUTH` unset/false and set `APP_ENV=production`. Set the project's package manager to pnpm; build command `pnpm build`. Apply `pnpm db:migrate` with the dedicated database environment before release.
- Validate Google sign-in, Gmail delivery/failure, private Blob callback/finalization, and offline navigation on the deployment's final HTTPS origin. These require live provider configuration and are not verified by the local personas.

`vercel.json` supplies the build configuration. This checkout is linked to the separate `house-checklist` Vercel project. The ignored `.env` is the source of truth for authentication and provider credentials. An authorized `pnpm deploy:prod` validates and syncs that configuration, applies pending database migrations, then publishes the application. Review pending migrations before running it. `pnpm vercel:env` and `pnpm db:migrate` are available as individual steps. Do not run these commands against `travel-plan`.

The ignored `.env` keeps local callback URLs; `PRODUCTION_APP_URL` records the HTTPS deployment address. `.vercelignore` also excludes local environment files and test artifacts from the deployment upload; Vercel CLI does not use `.gitignore` for this. `node scripts/configure-vercel.mjs` uploads the six provider/security keys as Production Secrets and the hosted URLs/environment as Config values. Values go through standard input and are never printed. Preserve the encryption key to retain existing Gmail connections. The local persona commands always use the isolated loopback database.

## Product behavior

Opening `/` shows the collections list and keeps the URL at `/`, including after
returning from an opened collection. Click **House Checklist** to open the same
list. Explicit collection URLs open that collection's properties; the legacy
`?page=apartments` entry remains supported. Accepting an invitation opens an
explicit route to the invited collection. Each collection name opens its
properties, and the active collection name in the top bar returns to
that collection's properties list from any collection screen. The collections list offers
**Create a collection** and, for owners/editors, **Edit collection** to update
the name and search preferences. Creating a collection requires a connection;
existing collection edits retain the local draft and synchronization flow.
Collections navigation survives reload and browser Back/Forward, and respects
unsaved form warnings. On phones, the brand link sits beside save status and
the collection switcher has its own button beside the collection name.

Owners can **Archive** a collection beside **Edit collection** in the main list.
Archived collections disappear from the active list and collection switcher.
**Show archived** opens their separate list, with an Archived label and an
owner-only **Restore** action. Archiving preserves the collection's apartments,
checklist, settings, and members; restoring returns it to the active list and
switcher. Archive and restore require a connection and check the collection's
revision. Controls disable while saving or offline; failures remain visible,
and a revision conflict refreshes collection data before a retry. These actions
use EN/JA/VI labels, shared 44px controls, and wrapping phone layouts.

Owners and editors can rename the current collection from the Collection menu,
or rename an apartment using **Rename property** in its header. Names are trimmed
and must be nonempty (up to 120 characters for collections, 200 for properties).
Renames use the same local draft, synchronization, and conflict flow as other
edits, preserving property details, answers, and collection settings. Viewers
cannot rename. Cancel discards the name draft.

Each collection owns one shared checklist; an answer references a stable criterion, apartment, and optional journey. Creating criteria never creates empty answer rows. The default seed contains 113 source checks as 115 definitions, with J/K disabled. Section H monetary checks use whole-yen numeric inputs, with timing, payment arrangements and confirmation details kept as text. Listing availability and the duplicate agency/broker fee check (H06) are omitted, and A05 records only the building year. E04/E07 include mutually exclusive appliance availability checkboxes; an unanswered choice stays unknown. E10 records the gas provider type (Toshi, Propane, Other), with a free-text field for Other. Template changes reach existing collections through explicit migrations that preserve apartment answers and publish updated definitions to cached workspaces. The supplied brief is preserved in `docs/original-brief.md`.

Canonical property facts are answers identified by stable template keys. Overview, viewing, costs, and travel use the same answer operation. Cost/benefit records can bind an amount to a canonical criterion, while text checks retain their explanation and can link to structured charges. Property decisions and viewing progress remain independent.

Writes require a mutation UUID and expected record revision. Definition-sensitive writes also carry the checklist revision. Authorization, revision checks, writes, immutable history, events, and mutation receipts share a transaction. Accounts can own multiple collections and join others; each collection keeps its checklist, apartments, settings, and members separate. Owners alone manage invitations/members and delete collections; there is no administrator bypass.

Drafts are written to account/collection-scoped IndexedDB before the UI says they are saved on the device. The outbox retries with the same UUID, processes in order, and pauses conflicting records. A conflict shows the saved answer and editable local draft. Reconnecting/focusing refreshes events; visible pages poll every 20 seconds. The browser need not support background synchronization. Revocation is effective immediately on the server; cached content is removed when the device reconnects. A device already offline cannot learn about revocation immediately.

Prepare for viewing downloads currently ready apartment files and confirms their offline availability. It does not scrape external links. Supported uploads are JPEG, PNG, WebP, and PDF, at most 20 MB each. Draft export and explicit retry are available if storage or synchronization fails. Signing out clears local account data after warning about unsynchronized work.

Cost projections separate nonrefundable expenses, deposits, holds, benefits, and payments. Unknown/disputed inputs stay visible; an incomplete result is labeled Known charges. Payments settle obligations rather than add expenses. Only confirmed applicable benefits reduce the primary net projection. Dates use 24 calendar months; endpoint renewals are shown separately. Travel uses independent outbound/return fares and actual calendar days / 7 for weekly frequencies. No scoring, ranking, tax-savings calculation, eligibility inference, scraping, route API, OCR, or public sharing is implemented.

## Repository map

- `app/`: app shell routes, Auth.js endpoints, authenticated API handlers, semantic themes.
- `components/`: workspace, reusable controls, answer/conflict interfaces, primary screens.
- `lib/repository.mjs`: transactional permissions and mutations.
- `lib/domain.mjs`, `lib/calculations.mjs`: shared answer semantics and deterministic projections.
- `lib/client-store.mjs`: IndexedDB snapshots, mutation queue, synchronization, private file cache.
- `lib/uploads.mjs`, `lib/mail.mjs`: private file and Gmail boundaries.
- `data/`, `lib/seed.mjs`: source checklist, authored translations, template metadata.
- `migrations/`: versioned SQL, applied under an advisory lock.
- `tests/`: domain contracts, Postgres integration, production-browser workflows.

See `PRODUCT.md` for scope and `DESIGN.md` for the built visual system. See `docs/verification.md` for the final verification record and remaining provider/device checks.
