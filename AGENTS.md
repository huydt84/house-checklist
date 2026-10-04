# Project instructions

Read `/Users/huydinhtrong/.codex/RTK.md`; prefix shell commands with `rtk`.
Use pnpm 11.25.0. Treat the ignored `.env` as the source of truth for this app's authentication and provider credentials; setup uses `.env.template`. Never print, commit, or upload the file or its secret values. Repository scripts consume credentials internally and sync them to Vercel Secrets through standard input. Preserve this app's distinct keys and never copy another project's credentials.
Read the installed Next.js documentation in `node_modules/next/dist/docs` before framework changes.
Local development runs on port 3001 with the isolated Docker Postgres database on port 55433.
Local personas require LOCAL_AUTH=true and a loopback database. Production must never enable LOCAL_AUTH.
Run relevant domain, database, and browser tests. UI verification includes 320, 390, 1440, and 1920 pixel widths.
Do not deploy, send invitations, or alter another project's services as a side effect of local development.
For an explicitly requested production deployment, use `pnpm deploy:prod`: validate and sync `.env`, apply reviewed pending migrations, then deploy the linked House Checklist project. Production must never enable LOCAL_AUTH.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
