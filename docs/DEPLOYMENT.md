# Kidify API and batch deployment

Use Node.js 20. The clean source archive contains both applications, the npm lockfile and tests. It excludes local `.env`, Git history, dependencies, compiled output, logs and user uploads.

## Preserve existing data

The database and uploaded files were not changed. Copy or mount the existing `uploads/` directory separately at the backend working directory. Without it, database image URLs will fail. Do not run migrations or administrator bootstrap scripts as routine deployment steps.

Create `.env` on the server using `.env.example`. Configure:

- `NODE_ENV=production`
- `PORT_API=3007` or the chosen internal API port
- `MONGO_PROD`: the intended MongoDB replica set/Atlas URI
- `SECRET_TOKEN`: the intended strong server-only signing secret; keep the existing one to preserve current sessions
- `CORS_ORIGINS`: the exact HTTPS frontend origin
- `AUTH_COOKIE_SAME_SITE=lax` for same-site hosting; `none` only for cross-site HTTPS cookies
- `DELIVERY_FEE`: the intended fee in USD
- `BATCH_TIMEZONE`: the intended timezone

Optional OpenAI configuration stays backend-only.

```sh
npm ci
npm run build
npm run build:batch
npm run start:prod
```

Run with a persistent process manager/service and this directory as working directory. Proxy `/graphql` and `/uploads` over HTTPS and enable WebSocket upgrade forwarding. Enable scheduled jobs separately only when desired:

```sh
npm run start:prod:batch
```

Do not wipe MongoDB or uploaded files. Local checks do not verify the target server/domain/HTTPS configuration; no remote deployment was performed.
