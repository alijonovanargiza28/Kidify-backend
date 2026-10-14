# Kidify cleanup audit — backend

Source entry points: all Next.js routes/configs/tests for frontend, both NestJS main modules plus operational scripts/tests for backend. Imports, re-exports, literal dynamic imports and CommonJS requires were traversed. No unresolved dynamic module expressions were found. SCSS removals additionally required every compiled selector to be guarded by a legacy DOM ID absent from reachable components.

Removed files are listed in `cleanup-manifest.json`, with pre-change Git revisions and local rollback snapshot. Backend source apps are now `apps/kidify-api` and `apps/kidify-batch`; frontend package is `kidify-frontend` and its active product card is under `libs/components/product`.

## Deliberately retained

- Every public/static asset and every uploaded file: database URL usage cannot be proven absent from source analysis alone.
- Every database/collection name, persisted PROPERTY enum member, historical notification `propertyId` reference, and data migration script. No data migration was executed.
- Existing `/property`, `/agent`, `/_admin` routes and old query-key aliases: they currently route to Kidify pages and may have external bookmarks.
- Frontend REACT_APP_API_* environment names and all real .env files: deployment compatibility and secrets are preserved.
- Git remotes, historical CHANGELOG commit URLs and repository checkout directory names: these are external/local workspace identities, not application branding.
- Shared global SCSS containing potentially active selectors and backend framework/peer dependencies, including the Socket.IO platform used by Nest test initialization.
- All registered marketplace GraphQL operations: runtime registries, schema reflection and external clients prevent assuming an export is unused from a simple text search.
- Existing peer dependency versions and unrelated frontend lint warnings: upgrading these is outside a safe legacy cleanup. The executable ESLint configurations were repaired using installed dependencies.

## Operational note

Existing backend launch commands/watchers started before the app-directory rename must be restarted with the new Nest project IDs. Current package scripts and Nest configuration use the new names. The checkout folders themselves have not been moved so saved workspace paths remain valid.

## Verification — 2026-10-14

- Frontend: TypeScript, all 7 test files, lint (11 existing warnings), frozen offline Yarn install and production build passed.
- Backend: TypeScript, lint, API build, batch build and all 13 suites / 129 tests passed.
- Full GraphQL schema is byte-identical to the pre-cleanup schema (59 queries, 74 mutations).
- Final source graph: 120 reachable frontend files, 179 reachable backend files; no unresolved imports, unreachable source files or nonliteral dynamic imports in the audited roots.
- Public Home, Sellers, Products and Product Detail were checked against the live backend; mobile Sellers fits a 390px viewport without horizontal overflow. Public loaded images were checked for failures.
- Browser was signed out. Authenticated actions were verified with isolated tests, not a live user login. No orders, uploads or database migration scripts were executed.
- Frontend warnings: 9 existing Next Link passHref warnings and 2 existing product-detail hook dependency warnings. Existing i18next/Toast UI peer-version warnings were retained instead of changing dependency versions during cleanup.

## Logout follow-up

The visible label is now Logout. Explicit logout blocks token refresh, waits for an existing rotation before revoking the cookie, rejects stale profile results and deduplicates clicks. Cookie requests have a 10-second timeout. Failed revocation shows a retryable error instead of navigating into an automatic cookie-based login. Regression tests cover these cases. Existing backend cookie/session revocation behavior was preserved.

Eight unreferenced legacy alert exports and their unused Messages constants were also removed after checking all source and test references. Final frontend build directory: `.next-cleanup-delivery`.

## Server-preparation cleanup — 2026-10-14

- User confirmed scope: temporary files, caches and unused code only. No database records, products, accounts, orders or uploaded files were deleted.
- Removed 60 stale Next.js build directories, the old TypeScript incremental cache and cached public exchange-rate response (approximately 9.90 GB total). Only the fresh, verified standard `.next` build is running locally.
- Removed the disabled Uzbek public translation resource and chat dictionary; EN/KO behavior is retained. The CBU provider URL and historical locale guards remain intentional compatibility/runtime references.
- Fresh import traversal: frontend 126/126 and backend 180/180 source files reachable; no unresolved imports or nonliteral dynamic module expressions detected. No further whole source modules were proven unused.
- Public assets and uploads were retained because database URLs can reference them indirectly. Registered GraphQL operations, compatibility routes, tests, migration tools and Nest injection dependencies were retained.
- Frontend: all 14 regression test files and clean production build passed. Backend: all 14 suites / 140 tests, API build and batch build passed. Existing unrelated lint warnings remain.
- Current project folders: `Kidify-next` and `Kidify`. Updated startup instructions are in `DEPLOYMENT.md`. Clean source archives exclude local secrets, dependencies, generated builds, Git metadata and user uploads.
- No remote deployment or data migration was run.
