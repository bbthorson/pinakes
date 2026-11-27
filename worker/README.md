# Pinakes Hosted MCP Server (Cloudflare Workers)

A Cloudflare Worker that exposes Pinakes over **Streamable HTTP MCP** with:
- **Two firewalled endpoints:**
  - `POST /mcp/scene` — Scene-Mode tools only (`pinakes_context` locked to `fullState: false`, `pinakes_brief`, `pinakes_sample`, `pinakes_compose`).
  - `POST /mcp/author` — Full Author-Mode suite (`pinakes_lint`, `pinakes_prose_check`, `pinakes_first_appearances`, `pinakes_review_slice`, `pinakes_review_prepass`, `pinakes_sync`).
- **GitHub as source of truth + R2 read cache** (`pinakes_sync` or `POST /webhook/github`).
- **Native Workers AI Clef binding** (`@cf/cloudflare/clef` & `@cf/cloudflare/clef-flash`) with a daily KV quota cap (`MAX_DAILY_CLEF_CALLS`).
- **Fail-closed Auth:** GitHub OAuth 2.1 + PKCE gated by `ALLOWED_GITHUB_USERS` (for Claude.ai / remote web clients) plus optional static Bearer token (`PINAKES_MCP_TOKEN`) for personal scripts.

## Setup & Deploy

1. Create the R2 bucket and KV namespace:
   ```sh
   npx wrangler r2 bucket create pinakes-snapshots
   npx wrangler kv namespace create AUTH_KV
   ```
   Put the returned KV namespace `id` and your `GITHUB_REPO` / `ALLOWED_GITHUB_USERS` into `wrangler.toml`.

2. Set secrets:
   ```sh
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put PINAKES_MCP_TOKEN       # optional: for Bearer auth
   npx wrangler secret put GITHUB_TOKEN            # optional: for private repo Bearer/webhook sync
   npx wrangler secret put GITHUB_WEBHOOK_SECRET   # optional: for push webhook
   ```

3. Deploy:
   ```sh
   npm install
   npm run deploy
   ```

4. Connect in Claude.ai (or any remote MCP client):
   - Scene-Mode drafting session: `https://<your-worker>.workers.dev/mcp/scene`
   - Author-Mode editorial session: `https://<your-worker>.workers.dev/mcp/author`
