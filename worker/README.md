# TDH workers (profile service deployed 2026-10-02; research service not deployed)

Two small Cloudflare Workers that replace and extend the current profile service.

| File | Purpose |
| :-- | :-- |
| `profile.mjs` | `POST/GET/DELETE /profile`. Same contract as today, plus 12-character codes, rate limits, consent required to store, 24-month expiry, deletion by code, strict CORS. |
| `research.mjs` | Optional anonymous research contribution: histogram counters only, k-anonymity floor of 30, disabled unless explicitly enabled. |
| `schema.sql` | D1 tables for the research counters (no per-submission table). |
| `test/workers.test.mjs` | `node worker/test/workers.test.mjs` |

The e-mail delivery endpoint (`POST /`) is **not** part of these files; it remains in the existing service.

## Deploy profile service

1. `wrangler kv namespace create PROFILES`; bind it as `PROFILES`.
2. Add two rate-limit bindings (`PROFILE_READ_LIMITER`: e.g. 20 per minute; `PROFILE_WRITE_LIMITER`: 10 per minute).
3. Deploy, then point `WORKER` in `privacy-choice.js` and the tools at it, **or** route `/profile` to it from the existing worker.
4. Set `CODE_LENGTH = 12` in `tdh/privacy-choice.js`. Existing 6-character codes continue to work and expire after 24 months from their last save.
5. Update privacy page § 6 to state the 24-month expiry.

## Deploy the research service (only after ethics approval)

1. `wrangler d1 create tdh-research`; `wrangler d1 execute tdh-research --file worker/schema.sql`.
2. Bind it as `RESEARCH_DB`; add a `RESEARCH_LIMITER` rate-limit binding.
3. Set secrets/vars `ETHICS_APPROVAL_REF` and `RESEARCH_ENABLED=1`.
4. In `tdh/privacy-choice.js` set `RESEARCH_ENDPOINT` and `ETHICS_APPROVAL_REF` to the same reference. The consent choice appears only when both are set.
5. Add the research endpoint's origin to the `connect-src` directive of the Content-Security-Policy meta tag in `tdh/*.html`, or the browser will block the contribution.
6. Update `tdh/research.html` and `privacy.html` from "switched off" to "active", and publish the data dictionary.

Kill switch: unset `RESEARCH_ENABLED`; the endpoint returns 503.

```toml
# wrangler.toml (profile)
name = "tdh-profile"
main = "profile.mjs"
compatibility_date = "2026-10-01"
kv_namespaces = [{ binding = "PROFILES", id = "<id>" }]
[[unsafe.bindings]]
name = "PROFILE_READ_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 20, period = 60 }
```
