# Kidify production deployment

Prepared 2026-10-14. Deployment has NOT been performed. Read PRODUCTION_READINESS.md before approving a public release: critical dependency advisories remain.

## Latest review (2026-10-14T17:26:56+00:00)

Both projects passed fresh local type/lint, regression and production build checks on Node 24.19.0. Backend: 143 retained tests + 8 external production checks + 1 HTTP e2e test. Frontend: 13 retained regression files + external production URL/locale checks. Native WebSockets were verified; this app does not serve Socket.IO protocol. See PRODUCTION_READINESS.md for fixture boundaries, current audit counts and coordinated migration steps.

**These are prepared hosting configurations, not a security clearance to launch.** Backend still reports 9 high/11 moderate package rollups; frontend reports 2 critical/1 high/1 moderate distinct packages. No compatible remaining critical/high patch was found on the current major lines. Resolve the documented migrations/upstream blockers before public release. No push, deployment, Git remote change or production data write was performed.

## Projects and runtime

- Backend: `Kidify`, NestJS API + optional batch process. Node.js 24 (verified with 24.19.0), npm and package-lock.json.
- Frontend: `Kidify-next`, Next.js Pages Router. Node.js 24, Yarn Classic 1.22 and yarn.lock. Vercel explicitly uses Yarn; do not replace its install command with npm.
- Database: MongoDB Atlas replica set, database `kidify`.
- Public GraphQL and image URLs remain `/graphql` and `/uploads/...`; chat uses native WebSocket on the API HTTP port, not a Socket.IO client.

No paid resource, secret, production database write, Git push or live deployment was executed by this preparation task. The draft Render plan and persistent disk cost money and require review/approval before creation.

## 1. Review and approve

1. Resolve or explicitly review the security release blockers in PRODUCTION_READINESS.md.
2. Review working-tree changes. Existing lockfile changes were present before this task; snapshots were saved before dependency edits.
3. Keep `.env`, `.git`, node_modules, local model weights, caches, test fixtures and Mac build output out of the uploaded source package.
4. Use separate staging data and accounts for the live acceptance flows below. Do not run migrations, seed scripts or administrator creation as a routine deployment step.

## 2. MongoDB Atlas

1. Select the intended existing Atlas cluster and confirm the target database is `kidify`, not an empty database with a similar name. Atlas provides the replica-set support required by checkout/seller registration transactions.
2. Review a backup/snapshot before changing production data or indexes. This task did not query or migrate the production database.
3. Create/reuse a database user scoped to the required Kidify database; store the URI only in the backend host's secret settings.
4. Add the hosting service's documented outbound IPs to the Atlas access list. Avoid opening the database to the entire internet as a permanent workaround. URL-encode special password characters in the URI.
5. Set backend `MONGO_PROD` to the intended Atlas connection URI with `/kidify` and the appropriate connection options. `MONGO_DEV` is used only when NODE_ENV is not production.
6. Production disables automatic index creation. On a controlled operator machine with the reviewed environment and backend dev tools, run the REVIEW-ONLY command `npx ts-node scripts/ensure-indexes.ts`. It lists declared/existing index counts and makes no changes by default. After a separate review/approval, backup and duplicate check, `--apply` creates declared indexes without dropping indexes or editing records. Do not run apply blindly; unique-index conflicts require data review. This script was typechecked but not run against a live database.

## 3. Backend on Render

Create a persistent Node web service from the backend repository only after approval. Use `render.yaml` as a reviewed draft; automatic deploys are off. The draft selects a paid `0.5c-512mb` service and 10 GB persistent disk. Capacity and cost must be reviewed; this is not an AI-model hosting plan.

- Runtime: Node.js 24.
- Build: `npm ci --include=dev && npm run build`.
- Start: `npm run start:prod` (runs `dist/apps/kidify-api/main`).
- Render's PORT is honored before PORT_API. Bind address is `0.0.0.0`.
- Health path: `/health/ready`. `/health` is liveness; readiness checks Mongo and returns 503 when unavailable without disclosing connection details.
- Optional image/DB-independent build cleanup: `npm prune --omit=dev` after build. Keep tools installed while performing separately approved index review/setup.

Required backend environment:

| Variable | Value / purpose |
| --- | --- |
| NODE_ENV | production |
| PORT | Hosting-provided; Render supplies it. Legacy local PORT_API remains supported. |
| MONGO_PROD | Secret Atlas URI targeting kidify |
| SECRET_TOKEN | Existing strong signing secret, at least 32 random characters; preserve it to retain sessions. Generate a new secret only for a fresh deployment or an approved rotation. |
| CORS_ORIGINS | Exact HTTPS frontend origin(s), comma-separated, no wildcard or paths. Add staging/preview origins individually when intended. |
| AUTH_COOKIE_SAME_SITE | none for vercel.app -> onrender.com; lax for same-site HTTPS custom domains |
| UPLOAD_DIR | /var/data/uploads on the mounted durable disk |
| DELIVERY_FEE | Intended fee in the same currency as stored prices; default 0 |
| BATCH_TIMEZONE | Asia/Tashkent or the intended explicit timezone |

The Blueprint can generate a secret for a fresh service. If retaining existing users' sessions, supply the existing strong secret instead. Never paste credentials into Git or frontend environment values.

### Durable images

Mount persistent storage at `/var/data` and set UPLOAD_DIR=/var/data/uploads. Copy the **existing uploads directory contents** into that uploads directory, retaining member/product/brand/event/article/review subdirectories. The separate `kidify-uploads.tar.gz` contains a top-level uploads/ directory and can be extracted into `/var/data` after verifying the mount and archive. Do not extract it into `/var/data/uploads/uploads`.

Returned database paths remain `uploads/product/...`; no database URL/schema rewrite is required for relative paths. Verify any historical absolute image URLs separately before an approved data migration. Back up images separately from MongoDB. A free/ephemeral Render filesystem is not suitable for this current upload implementation. Persistent disks constrain horizontal scaling and can cause deployment downtime; use one API instance until shared storage/chat fan-out are designed and tested.

### Optional batch process

The API does not run scheduled ranking jobs automatically. For an approved separate scheduler process, build `npm run build:batch`, start `npm run start:prod:batch`, and configure NODE_ENV, MONGO_PROD, SECRET_TOKEN, BATCH_TIMEZONE and a distinct local PORT_BATCH when sharing a host. Host-provided PORT also takes precedence for batch. Avoid multiple simultaneous scheduler replicas. No batch service is provisioned by render.yaml.

### AI

Keep CHAT_AI_PROVIDER=ollama and OLLAMA_CHAT_MODEL=qwen2.5:3b only when a persistent Ollama process is reachable from the backend. OLLAMA_BASE_URL must point to that private service. The laptop's localhost is not reachable from Render. Do not expose an unauthenticated Ollama port publicly. The draft API plan does not have enough resources to run this model in the same process/container; review a suitable separate private AI host before launch if AI is required.

On a suitable VPS with Ollama installed, `npm run ai:serve` starts the local runtime and `npm run ai:pull` downloads the configured model. Local weights/runtime are excluded from source archives. OpenAI remains an optional provider requiring separately approved credentials/credit; no paid fallback is automatic.

## 4. Frontend on Vercel

1. After approval, import the **frontend** repository/project directory. Use Framework Preset Next.js, Node.js 24.
2. Keep the committed Vercel settings: install `yarn install --frozen-lockfile`, build `yarn build`, output `.next`.
3. Set public variables BEFORE building:

```env
REACT_APP_API_URL=https://YOUR-BACKEND.onrender.com
REACT_APP_API_GRAPHQL_URL=https://YOUR-BACKEND.onrender.com/graphql
REACT_APP_API_WS=wss://YOUR-BACKEND.onrender.com
KIDIFY_CANONICAL_CURRENCY=USD
```

GraphQL/WS variables can be omitted to derive them from the API base, but explicit deployment values are easiest to review. Never set backend Mongo/JWT/AI secrets in Vercel's public environment. Preserve these actual project variable names; the app does not read replacement NEXT_PUBLIC_API_URL examples.

4. Leave KIDIFY_BUILD_DIR unset on Vercel. That variable is only for isolated local verification. URL changes require a NEW frontend build; changing a runtime shell variable does not rewrite an existing browser bundle.
5. Production builds reject missing, localhost, HTTP or WS endpoints. The verification build used `https://api.kidify.example` as a configuration fixture, not a deployed API. Build again with real endpoints.
6. Copy Vercel's stable HTTPS project origin into backend CORS_ORIGINS. Both providers supply HTTPS subdomains, so buying a domain is not mandatory for staging. Prefer same-site custom domains for reliable cookie sessions when available.
7. Test sign-in, refresh after reload and logout in each supported browser. Cross-site third-party-cookie restrictions can block refresh cookies even with SameSite=None/Secure; no source-only test proves those browsers accept them. Same-site hosting or a separately designed same-origin auth proxy may be needed.
8. Frontend renders the client; the persistent WebSocket server stays on the backend. The exchange-rate disk cache uses /tmp on Vercel and is disposable public cache data, never product-image storage.

The historical, pre-existing frontend package-lock.json was preserved in the working copy but is not the deployment lockfile and is excluded from the clean frontend archive. Plain npm install currently rejects Toast UI's React 17 peer requirement against this React 18 app. No --force/--legacy-peer-deps override was used. Yarn install succeeds with that existing peer warning; rich-text rendering still needs browser acceptance.

## 5. Pre-release acceptance checklist

- [ ] Critical Next/Swiper advisories resolved or explicitly risk-reviewed; remaining backend advisories reviewed.
- [ ] Real project origins, TLS certificates, Atlas access list and restricted DB user configured.
- [ ] Correct kidify data and declared indexes verified; backups available.
- [ ] Durable image volume mounted; existing images copied and sampled over HTTPS.
- [ ] /health and /health/ready return 200; disconnected DB produces 503 readiness.
- [ ] USER/SELLER/ADMIN/CS login, signup permissions, refresh and logout tested in supported browsers.
- [ ] Seller creates product with real image/variants; filters and image URLs work.
- [ ] Cart, multi-seller checkout, stock/concurrent orders, delivery transitions and reviews tested with staging data.
- [ ] Wishlist, follows, notifications, community/events, admin and CS workflows accepted.
- [ ] Authenticated private/global WebSocket chat, reconnect, read receipts and restart behavior verified at the deployed WSS URL.
- [ ] Optional AI host reachable, model present and real shopping/order questions tested.
- [ ] EN/KO/UZ routes and labels reviewed on desktop/mobile; no design regression.
- [ ] Logs contain no credentials/user record dumps; edge rate limits and alerting configured.
- [ ] Restart/redeploy preserves uploaded files and gracefully reconnects chat clients.
- [ ] Payment/courier integrations reviewed: current payment/refund operations are DEMO, not a real payment processor.

## 6. Verification commands (full development checkout)

Backend: `npm ci --include=dev`, `npx tsc --noEmit --incremental false -p tsconfig.json`, `npm run lint`, `npm test -- --runInBand`, `npm run build`, `npm run build:batch`, `npm run test:e2e -- --runInBand`. Schema verification uses `npx ts-node scripts/verify-schema.ts` and disconnected models.

Frontend: `yarn install --frozen-lockfile`, `yarn typecheck`, `REACT_APP_API_URL=https://api.kidify.example yarn lint`, `env -u REACT_APP_API_URL -u REACT_APP_API_GRAPHQL_URL -u REACT_APP_API_WS NODE_ENV=test yarn test`, then a production build with the REAL public endpoints. Do not disable lint or TypeScript to build. Clean deployment archives intentionally omit tests and test-only scripts; run verification in the full development checkout or retained test snapshot.

## References

- [Render Node web services / port binding](https://render.com/docs/web-services)
- [Render persistent disks and their constraints](https://render.com/docs/disks)
- [Render WebSockets](https://render.com/docs/websocket)
- [Render Blueprint schema](https://render.com/docs/blueprint-spec)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Atlas network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [MongoDB transaction requirements](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
