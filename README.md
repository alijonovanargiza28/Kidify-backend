# Kidify backend

Multi-seller baby and kids marketplace with the existing authentication and social features. NestJS, TypeScript, GraphQL/Apollo, MongoDB/Mongoose and JWT remain in place. Frontend code is outside this repository's scope.

## Applications

- `apps/kidify-api`: GraphQL API, shared member/social modules, marketplace commerce and the existing WebSocket gateway.
- `apps/kidify-batch`: scheduled product and seller ranking calculations.

## Run

Use the existing npm lockfile and dependencies. Configure `.env` using `.env.example`; never commit real credentials. MongoDB must support transactions (a replica set or Atlas). Multi-document operations fail with `MONGODB_REPLICA_SET_REQUIRED` on a standalone server; no unsafe checkout fallback runs.

```bash
npm install
npm run start:dev
npm run start:dev:batch
```

GraphQL is served at `/graphql`; uploaded images are served at `/uploads`. API defaults to port 3000; configure `PORT_BATCH=3001` when running both applications.

```bash
npm run build
npx nest build kidify-batch
npm run start:prod
npm run start:prod:batch
```

`DELIVERY_FEE` defaults to 0 and uses the same currency as product prices. Prices are rounded to two decimal places. No currency conversion or real payment/courier provider is included. Set `BATCH_TIMEZONE` explicitly for deployment; its default is `Asia/Tashkent`.

## Accounts

Public `signup` uses `memberNick`, `memberPhone` and `memberPassword`. Login keeps the existing nickname identifier. Sending `memberType` never grants privileges. A valid one-use `sellerCode` creates SELLER; otherwise signup creates USER.

ADMIN creates seller codes and may assign CS through `updateMemberByAdmin`. To bootstrap an initial administrator, set `ADMIN_NICK`, `ADMIN_PHONE`, `ADMIN_PASSWORD` in your shell environment and run the server-side script. It hashes the password, refuses duplicate accounts, and never prints credentials.

```bash
npx ts-node scripts/bootstrap-admin.ts
# After reviewing the dry-run:
npx ts-node scripts/bootstrap-admin.ts --apply
```

Access tokens expire after 15 minutes. Refresh sessions rotate through an HttpOnly cookie with an absolute 30-day lifetime. `logout` revokes the refresh family and clears its cookie. Protected requests reload the current member's role and status from MongoDB, so blocking/demotion takes effect for previously issued tokens.

## Migration

Unused Property source has been removed after reachability and schema verification; historical Property documents and persisted enum values remain untouched. Property resolvers are not registered in the live marketplace API. Products use a separate `products` collection. Real-estate properties are not silently converted into clothing products.

The explicit, idempotent migration changes legacy AGENT accounts to SELLER, initializes new member statistics, and maps legacy article categories. It preserves passwords, documents and historical references. Back up/review the intended database before applying it.

```bash
npx ts-node scripts/migrate-dianora.ts
# After reviewing the dry-run and database backup:
npx ts-node scripts/migrate-dianora.ts --apply
```

These scripts were not run against the existing remote database.

## Verification

```bash
npm test -- --runInBand
npx tsc --noEmit --incremental false -p tsconfig.json
npx ts-node scripts/verify-schema.ts
npm run test:e2e
npx jest --config apps/kidify-batch/test/jest-e2e.json --runInBand
```

Unit/security tests and the complete application/schema smoke test use disconnected models and explicit mocks. They do not contact the `.env` database. The schema script also exports GraphQL operations and declared indexes to `docs/`.

See [implementation report](docs/backend-implementation.md), [GraphQL schema](docs/graphql-schema.graphql), [operations](docs/graphql-operations.md), and [declared indexes](docs/database-indexes.json). Real MongoDB transaction/concurrency tests and HTTP/WebSocket network e2e still require an unrestricted local test environment.

Production setup: [DEPLOYMENT.md](docs/DEPLOYMENT.md).
