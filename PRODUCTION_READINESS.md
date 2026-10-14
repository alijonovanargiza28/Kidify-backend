# Kidify production readiness — 2026-10-14

## Decision

**Deployment preparation is implemented and builds pass. Public production release is NOT cleared.** Critical dependency advisories, real hosting credentials/resources and live acceptance tests remain. No live service was deployed or verified. Follow DEPLOYMENT.md after reviewing blockers.

## Revalidation (2026-10-14T17:26:56+00:00)

Reviewed both working trees, existing source/configuration changes, lockfiles, untracked production files and previous reports before making this review's documentation changes. No additional dependency updates were applied: registry checks confirmed the installed latest releases in Nest 10, Nest GraphQL/Apollo 12, Apollo Server 4, Next 14 and Swiper 8; braces 3.0.3 is still the latest published release. Remaining critical/high fixes require major migrations or an upstream fix. Existing features and frontend stylesheet/design sources were preserved.

| Target | Configuration/build | Public production release |
| --- | --- | --- |
| Kidify-next on Vercel | Prepared; production build passed | **Blocked**: critical Next/Swiper advisories, browser/session acceptance |
| Kidify API on Render | Prepared; API/batch builds passed | **Blocked**: high dependency findings, live Atlas/storage/WSS acceptance |

Chat uses native `ws` with Nest's `WsAdapter`. The installed platform-socket.io package does not mean the application exposes a Socket.IO protocol endpoint. Native transport authentication, origin rejection, private-message isolation and reconnect tests passed; no Socket.IO protocol compatibility is claimed.

## Backend

- Existing NestJS 10 / Apollo 4 architecture retained; all USER, SELLER, ADMIN and CS roles retained.
- Hosting PORT takes precedence over legacy PORT_API/PORT_BATCH; API and batch bind 0.0.0.0. Node.js 24 is selected and actually tested (24.19.0).
- Production requires an environment Mongo URI and strong signing secret. Mongo selection timeout/retries are bounded. Production autoIndex/autoCreate are disabled; a review-only-by-default index operator script is prepared, not executed against a database.
- /health liveness and /health/ready Mongo readiness added, including 503 behavior. Startup failure messages do not print secret values.
- Shutdown hooks enabled; active WebSocket clients receive a restart close and a bounded termination timer. Existing origin/JWT authentication, per-event revalidation and payload caps remain.
- Production playground, introspection and stacktrace disclosure disabled. Business error/auth codes retained; unexpected internal error messages redacted.
- Removed request/result/user-nickname dumps; operation timing remains. Existing bcrypt hashing, 15-minute JWT expiry, rotating HttpOnly refresh sessions and current-role DB checks preserved.
- Persistent UPLOAD_DIR configured without changing stored relative image URLs. JPEG/PNG signature checks, byte limits, role checks and failed-file cleanup added/preserved. Uploaded filenames remain server-generated UUIDs.
- graphql-upload 13 -> 15.0.2 migration reviewed: CJS deep imports updated, busboy v1 removes dicer; same Upload scalar and multipart mapping retained. A real HTTP test verified repeated file references and rereading the same stream-backed file. A drop-in-looking alternative with different repeated-file semantics was deliberately not used.
- Printed GraphQL schema is unchanged after lexicographic normalization: **59 queries / 74 mutations**. No database schema migration or live data mutation was run during this task.

## Frontend

- Existing Pages Router, React 18, MUI/SCSS, routes, API operations and Stitch layout preserved. No stylesheet source, layout redesign or fake catalog data was introduced.
- Next.js updated 14.2.0 -> 14.2.35 and matching lint config; TypeScript 4.9.5/ESLint 8.57.1. i18next/react-i18next aligned with the already installed next-i18next 14 peers.
- Public HTTPS/WSS endpoint validation fails a misconfigured production build. Actual REACT_APP_API_* names preserved; GraphQL and WS defaults derive from the configured base. Backend secrets are not browser variables.
- UZ UI/chat resources restored from the user's own Git history; 3 newer UI keys translated. EN/KO retained. All 354 English UI keys have Uzbek values, and the language selector includes UZ. Translation key coverage passed; linguistic/browser review is still manual.
- Sale countdown effect now depends on stable sale/refetch values; frontend lint has no warnings or errors.
- Added response headers and disabled X-Powered-By. Vercel's regenerable exchange-rate cache uses /tmp.
- Compiled CSS comparison before/after the PostCSS security patch is identical after ignoring one UTF-8 BOM. No browser screenshot/visual acceptance session was performed, so this is not a claim of full visual QA.
- Vercel uses the existing Yarn lockfile explicitly. npm install was attempted but rejected the pre-existing Toast UI React 17 peer mismatch; it was not forced. The user's pre-existing untracked npm lockfile was retained locally and is excluded from the deployment archive.

## Security audit

See docs/security-audit.json for exact package/advisory data.

- Backend npm production audit: **29 -> 20 affected package rollups**, now 9 high / 11 moderate / 0 critical / 0 low.
- Safe updates include ws 8.22.0, lodash 4.18.1, qs 6.16.0, multer 2.4.0, body-parser 1.20.6, uuid 11.1.1 where already on major 11, and graphql-upload 15.0.2. No forced major ws/uuid substitution was made across older dependency branches.
- Frontend authoritative Yarn production audit: **4 distinct affected packages**: Next 14.2.35 (critical), Swiper 8.4.7 (critical), braces 3.0.3 (high), DOMPurify 2.5.9 (moderate). Yarn's raw counts include repeated paths/advisory severities; do not compare them directly to npm's package rollups.
- Frontend patched same-major Babel runtime, i18next-fs-backend, immutable, nanoid, picomatch, prosemirror-view, source-map-js, YAML, SweetAlert2, PostCSS and DOMPurify. The intentional PostCSS override stays on public API major 8 despite Next pinning an older exact version; build, tests and equivalent compiled CSS were checked.
- Remaining backend roots: Apollo/browser XS-search prevention advisory, GraphQL Tools mergeDeep prototype pollution, Nest core injection advisory, braces pattern DoS, file-type parsers and older uuid buffer APIs. Some libraries are used only for trusted schema/filesystem metadata, but absence of exploitability was not proven. They remain reported, not dismissed.

### Major migration investigation / release blockers

1. Next 14.2.35 remains affected by current advisories; a patch within 14 does not clear them. Registry candidate Next 16.4.0 supports Node >=20.9 and React 18.2 or 19, but upgrading requires a separate Pages Router/Next config/build/lint migration and full runtime review (next lint is removed in current releases). That migration was not silently forced into this preparation.
2. Swiper 8.4.7 remains critical. A maintained fixed line requires major migration, including module imports and loop/navigation/slider visual behavior review. The slider was not removed or replaced.
3. Patched current @nestjs/graphql/@nestjs/apollo 14 require Nest core/common 12 and TypeScript >=5.5, plus Apollo Server 5 / corresponding GraphQL versions. These cannot be installed into Nest 10 as isolated overrides. Plan a coordinated Nest/GraphQL/Apollo/Express and integration-package migration with schema and upload/auth regression testing.
4. DOMPurify 2.5.9 still has moderate/low advisories; Toast UI depends on major 2. Moving to a supported major or updating the rich-text integration requires sanitization/browser regression review, not a blanket major override. Swiper and rich-text content are browser-facing and need application-specific exploitability review.
5. braces 3.0.3 still has a high advisory affecting all published versions in the audited range. Avoid untrusted glob patterns and track an upstream fix; this is not marked resolved.

### Migration sequence and acceptance gates

- Backend: use an isolated branch/check-out and staging database; upgrade Nest 10 through the supported 11/12 migration steps together with its adapters, config/schedule/mongoose/testing packages. The current Nest 12 migration includes ESM packaging, CLI/compiler changes and Express 5 behavior. Upgrade Nest GraphQL/Apollo to 14, Apollo Server to a patched 5.x and GraphQL to a supported peer version. Review multipart CommonJS/ESM imports and Express integration; replace deprecated playground options. Re-run schema equivalence, upload byte/limit/role tests, refresh rotation/CSRF, HTTP health and authenticated native WebSockets before accepting the migration. Audit the resulting lockfile again rather than assuming all transitive findings disappear.
- Frontend: choose a currently patched supported Next release (the audit's critical finding lists >=15.5.24; investigate the supported 15/16 path rather than assuming an arbitrary major is safe), preserve Pages Router and React 18 where peers permit, migrate lint/config/build tooling, and verify SSR/API routes, i18n, authentication and uploads. Migrate Swiper to a patched supported major (advisory minimum 12.1.2), update module imports, and compare slider navigation/loop/spacing on mobile and desktop. Do not accept visual regressions as a security fix.
- Rich text/glob dependencies: update or replace the Toast UI integration with a supported sanitizer and React peer range, test hostile HTML and stored content; do not force DOMPurify 3 under a dependency expecting 2. Track braces upstream or migrate its parent dependency away from the vulnerable implementation. No patched braces release was available during this review; avoiding untrusted patterns reduces exposure but does not clear the audit.
- Release only after repeated production audits, regression/build checks, staging acceptance and a rollback plan for the previous compatible deployment. Preserve database backups, upload backups and the existing signing secret. No live data migration is implied by a dependency upgrade.

Sources: [Nest migration guide](https://docs.nestjs.com/migration-guide), [Swiper maintainer advisory](https://github.com/nolimits4web/swiper/security/advisories/GHSA-hmx5-qpq5-p643); exact advisory URLs and affected ranges are in docs/security-audit.json.

## What actually ran

| Check | Result |
| --- | --- |
| Backend clean npm ci --include=dev | Passed on Node 24 |
| Backend TypeScript and lint | Passed |
| Backend Jest retained full suite | 14 suites / 143 tests passed in this review |
| External production verification snapshot | 1 suite / 8 tests passed using a temporary in-repository copy; copy removed |
| Backend API and batch production builds | Passed |
| API root HTTP smoke | 1 e2e test passed again in this review |
| Batch root HTTP smoke | Passed |
| Real HTTP multipart Upload + image bytes + duplicate references | Passed with temporary test files, no live DB |
| Health HTTP status/readiness behavior | Passed with isolated Mongo fixtures |
| GraphQL schema/operations | Unchanged, valid 59 queries / 74 mutations |
| Frontend frozen Yarn install | Passed, existing Toast UI peer warning retained |
| Frontend TypeScript | Passed |
| Frontend lint | Passed, zero warnings/errors |
| Frontend regression runner | 13 retained files passed with NODE_ENV=test and endpoint variables unset |
| External frontend production configuration snapshot | Passed from temporary in-repository copy; copy removed |
| Frontend production build | Passed with documented non-live HTTPS endpoint fixture |
| UZ locale/key and chat dictionary checks | Passed |
| Render YAML | Validated against the published Render JSON schema locally |
| Vercel JSON | Used fields validated against published schema definitions; full upstream schema has mixed-draft metadata issues |
| Public host/Atlas/SSL/cookie behavior | Not deployed; not verified |

Requested cleanup remains preserved: the two production test files stay in an external snapshot; temporary copies used for this review were removed. Clean deployment archives exclude ALL tests/test fixtures, local secrets, node_modules, Git history, model binaries/weights, caches and compiled Mac output. Existing regression suites remain in the development checkouts. Their source-only verification commands are not deployment steps.

The first frontend regression invocation inherited the HTTPS production fixture and failed a localhost URL expectation. Rerunning with its intended isolated test environment passed; the production build used HTTPS/WSS separately. An attempted direct invocation of the external config snapshot failed because of relative imports; its temporary in-project rerun passed. No assertions were weakened. Fresh audit totals match the previous report. The generated isolated verification build and TypeScript cache were removed after checks. Previous source archives predate this documentation refresh; use the current repository reports for the latest audit evidence.

## End-to-end coverage limits

All persisted business-flow tests below use isolated/disconnected database models. No end-to-end staging browser session or real Atlas checkout/concurrency run was executed.

| Flow | Evidence available | Still required live |
| --- | --- | --- |
| USER signup/login, seller code and role escalation prevention | Auth service/GraphQL guard/refresh tests | Browser signup/login with staging accounts |
| SELLER/ADMIN/CS permissions | Role and ownership guard tests; schema retained | Each role's dashboard/CS workflows |
| Product creation/images/variants | Ownership, variant validation, real multipart/temp-disk tests | Real seller creation and durable image retrieval |
| Product listing/filtering | Compound/age/color/stock/price unit tests; image UI fixtures | Deployed real catalog and filters |
| Cart | Apollo/UI selection/quantity fixtures | Persisted cart with staging account |
| Multi-seller orders | Checkout/fulfillment/session rules with mocked transaction boundaries | Real Atlas atomicity and concurrent stock updates |
| Wishlist/likes, follow/unfollow | Idempotence, ownership and Apollo cache tests | Persisted browser actions across reload |
| Reviews | Delivered/paid purchase authorization and UI fixtures | Real delivered-order review flow |
| Messaging | Real local WebSocket transport with isolated auth/message models, privacy/reconnect tests | Deployed WSS/origin/cookie/restart behavior |
| Notifications | Follow/chat notification boundaries and schema checks | Deployed badge/list/read behavior |
| Community/events | Resolver/schema/authorization/creation validation preserved | Rich-text browser safety and full event CRUD |
| Admin management | GraphQL role guard and navigation tests | Staging admin CRUD |
| CS functionality | Role/schema presence; no full CS ticket e2e | Full ticket assignment/reply/close workflow |
| Logout/expiry | Cookie rotation/revocation, JWT and frontend race tests | Each supported browser under deployed origins |

## Manual / operational blockers

- Approval and credentials for actual Vercel/Render/Atlas configuration; none were used here.
- Security migrations/risk review above, browser third-party-cookie behavior, persistent volume and index provisioning, Atlas transactions/concurrency.
- Separate persistent Ollama host/model for AI; laptop localhost is not Render. No paid resource was provisioned.
- Payments/refunds remain demo implementations and no courier provider is configured. A marketplace accepting real money needs separately reviewed integrations.
- Capacity, abuse/rate limiting/WAF, backup restore, monitoring/alerts, provider health checks and full mobile/browser acceptance remain unverified.

## Working-tree safety

Backend branch: modification. Frontend branch: develop. Pre-existing backend package-lock and frontend yarn.lock/untracked package-lock changes were detected; original dependency-file snapshots were saved under /private/tmp/kidify-production-before-6lublw_p before edits. Git remotes were not changed. No commit, push or merge was performed. .env files were not copied into deliverables, and database records/uploads were not deleted.

## Changed files

Paths below are relative to each project. The backend lockfile and frontend Yarn lockfile already had local changes; the task extended dependency updates from that initial state. The pre-existing frontend npm lockfile was not changed.

### Kidify

- `.env.example`
- `.gitignore`
- `.nvmrc`
- `DEPLOYMENT.md`
- `PRODUCTION_READINESS.md`
- `README.md`
- `apps/kidify-api/src/app.module.ts`
- `apps/kidify-api/src/components/auth/guards/without.guard.ts`
- `apps/kidify-api/src/components/board-article/board-article.service.ts`
- `apps/kidify-api/src/components/follow/follow.service.ts`
- `apps/kidify-api/src/components/like/like.service.ts`
- `apps/kidify-api/src/components/member/member.resolver.ts`
- `apps/kidify-api/src/components/member/member.service.ts`
- `apps/kidify-api/src/database/database.module.ts`
- `apps/kidify-api/src/health.controller.ts`
- `apps/kidify-api/src/libs/graphql-error.ts`
- `apps/kidify-api/src/libs/runtime.ts`
- `apps/kidify-api/src/libs/types/graphql-upload.d.ts`
- `apps/kidify-api/src/libs/upload.ts`
- `apps/kidify-api/src/main.ts`
- `apps/kidify-api/src/socket/socket.gateway.ts`
- `apps/kidify-batch/src/database/database.module.ts`
- `apps/kidify-batch/src/main.ts`
- `docs/DEPLOYMENT.md`
- `docs/security-audit.json`
- `package-lock.json`
- `package.json`
- `render.yaml`
- `scripts/ensure-indexes.ts`

### Kidify-next

- `.env.example`
- `.gitignore`
- `.nvmrc`
- `DEPLOYMENT.md`
- `PRODUCTION_READINESS.md`
- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/security-audit.json`
- `libs/chat/translations.ts`
- `libs/components/Top.tsx`
- `libs/config.ts`
- `libs/server/exchangeRates.ts`
- `next-i18next.config.js`
- `next.config.js`
- `package.json`
- `pages/products/detail.tsx`
- `public/locales/uz/common.json`
- `vercel.json`
- `yarn.lock`

## Clean archive validation

Both source archives were extracted into an isolated temporary directory after excluding all test directories and test-only scripts. Backend API/batch and frontend production builds passed from those extracted sources using symlinks to the previously verified dependency installs. This proves source archive completeness, not a fresh network install or live-host acceptance. Backend clean npm ci and frontend frozen Yarn installs were verified separately. Archive hashes were verified with Python SHA-256. The isolated verification directory and generated builds were removed afterwards.
