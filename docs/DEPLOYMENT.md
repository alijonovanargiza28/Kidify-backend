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

## Database selection

Use a MongoDB URI targeting the `kidify` database. Changing the database path selects a different database; it does not rename or copy the previous database. Existing users, products and orders will not appear unless present in the selected database. Preserve credentials and connection options. No database migration was executed during source cleanup.

## Local AI with Ollama

Install Ollama on the backend host, then run `ollama pull qwen2.5:3b` and keep `ollama serve` running. Configure backend-only `CHAT_AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, and `OLLAMA_CHAT_MODEL=qwen2.5:3b`, then restart the API. No OpenAI key or paid API calls are used in this mode. Model downloads and local CPU/RAM are required. Keep Ollama bound to loopback; do not expose port 11434 publicly. AI requests have a 120-second server timeout for local inference. Existing quotas, tool validation and owner-only order access apply.

To restore OpenAI, set `CHAT_AI_PROVIDER=openai` with valid OpenAI credentials and credit.

From the backend folder, `npm run ai:serve` starts the local runtime and `npm run ai:pull` downloads the configured model. These commands use the bundled `.local/ollama/ollama` when present, otherwise the system `ollama`. Keep the AI process running alongside the API.
