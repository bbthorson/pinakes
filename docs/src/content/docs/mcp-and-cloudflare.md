---
title: MCP & Cloudflare Workers
description: Run Pinakes as a local stdio MCP server or a hosted Cloudflare Worker with GitHub + R2 caching, OAuth 2.1 allowlist auth, and native Workers AI Clef.
---

Pinakes ships a shared **Model Context Protocol (MCP)** tool registry that enforces the Scene-Mode information firewall at the protocol boundary and runs identically over local stdio or hosted Cloudflare Workers.

## Two Firewall Modes

- **Scene Mode (`--mode scene` / `/mcp/scene`)** — safe for character and drafting agents. Exposes *only* backward-looking, POV-safe tools: `pinakes_context` (hard-locked to `fullState: false`), `pinakes_brief`, `pinakes_sample`, and `pinakes_compose`. Author-Mode tools are rejected by the server.
- **Author Mode (`--mode author` / `/mcp/author`)** — full editorial and canon suite: all Scene-Mode tools plus `pinakes_lint`, `pinakes_prose_check`, `pinakes_first_appearances`, `pinakes_review_slice`, `pinakes_review_prepass`, and (on Cloudflare Workers) `pinakes_sync`.

## Local MCP Server (`pinakes mcp`)

Run Pinakes over stdio against a local Git checkout (for Claude Code, Claude Desktop, or Cursor):

```sh
pinakes mcp --mode scene --root /path/to/universe
pinakes mcp --mode author --root /path/to/universe
```

## Hosted Cloudflare Worker (`worker/`)

For remote web clients (such as Claude.ai), the `worker/` package deploys the same MCP registry on Cloudflare Workers:

- **GitHub as source of truth + R2 read cache:** Universe `.md`/`.yaml` files are synced from GitHub into R2 via `pinakes_sync` or `POST /webhook/github` (HMAC-SHA256 verified) and hydrated into `MemoryFS` (`openMemoryUniverse`) on every request.
- **Native Workers AI Clef binding:** Calls `env.AI.run('@cf/cloudflare/clef', ...)` and `@cf/cloudflare/clef-flash` directly with a daily KV call cap (`MAX_DAILY_CLEF_CALLS`).
- **Fail-closed auth:** Supports GitHub OAuth 2.1 + PKCE gated by an explicit `ALLOWED_GITHUB_USERS` allowlist, plus an optional static Bearer token (`PINAKES_MCP_TOKEN`) for personal scripts.

See `worker/README.md` for `wrangler` setup and deployment steps.
