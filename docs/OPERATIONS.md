# Operations runbook: Echo-System workers

Three Cloudflare Workers back the tools. Nothing in this file is a secret, and no secret may ever be written into this
repository or its documents. Secrets are set only by the owner, in their own terminal.

| Worker | Config | Storage | Purpose |
| :-- | :-- | :-- | :-- |
| `tdh-profile` | `worker/wrangler.toml` | KV `PROFILES` | Optional cross-device storage by retrieval code, 24-month expiry |
| `tdh-research` | `worker/wrangler.research.toml` | D1 `tdh-research` | Anonymous aggregate counters only |
| `tdh-mail` | `worker/wrangler.email.toml` | KV (rate and daily cap) | Result e-mails through Brevo from `tdh@echoxstudios.art` |

Authentication: `wrangler login` opens a browser approval. Log out when finished: `wrangler logout`.

## 1. Break-glass: stop research contributions now

1. Edit `worker/wrangler.research.toml`: `RESEARCH_ENABLED = "0"`.
2. `wrangler deploy -c worker/wrangler.research.toml`.
3. Check: `POST /research` now answers 503. The result screen shows "Anonymous research counters are paused at the moment. Your result is unaffected." Nothing else breaks.
4. Before the next deploy that turns it back on, update `tdh/research.html`, `privacy.html` and `docs/DATA_FACTS.md` to say research is paused (`npm test` fails on wording that claims "live" while the flag is off).
5. To resume: set `"1"`, deploy, restore the wording, run `npm test`.

## 2. Rotate the mail-provider key

1. In the Brevo dashboard create a new API key. Do not delete the old one yet.
2. In your own terminal: `wrangler secret put BREVO_API_KEY -c worker/wrangler.email.toml` and paste the new key at the prompt (it is not echoed and is never stored in a file).
3. Send one result e-mail to yourself from the live site. Confirm it arrives from `tdh@echoxstudios.art`.
4. Delete the old key in the Brevo dashboard.
5. If a key was ever pasted into a chat or a file, treat it as exposed: rotate it at once.

## 3. Deploy and roll back

- Deploy: `wrangler deploy -c worker/<config>.toml`. A new worker may answer error 1042 for a short time; wait and retest.
- Check before deploying: `npm test` (all suites must pass).
- Roll back: `wrangler deployments list -c <config>`, then `wrangler rollback <version-id> -c <config>`.
- The site itself is static (GitHub Pages): revert the commit on `main` to roll back the pages.

## 4. Check the counters

Needs a fresh `wrangler login`; log out afterwards.

```
wrangler d1 execute tdh-research --remote -c worker/wrangler.research.toml \
  --command "SELECT tool, month, n FROM totals ORDER BY tool, month"
```

- One genuine completion of tool 1, 2, 3, 4 or 6 on the live site, in a normal browser, adds exactly 1 to that tool's `totals` row for the month. Automated browsers are acknowledged and discarded by design, so a scripted run proves nothing.
- The public endpoint stays suppressed below 30 contributions per tool: `GET /research/summary?tool=1` answers `{"suppressed":true,...}`.
- Never publish a figure for a tool or cell below 30.

## 5. Redacted export of profile storage

Retrieval codes are credentials, so an export must never contain them. This lists only counts per tool and an age/expiry spread, with codes one-way hashed:

```
wrangler kv key list --binding PROFILES -c worker/wrangler.toml --remote | node worker/redacted-export.mjs
```

The output is safe to keep. It is for capacity and retention checks, not for restoring data. Records are deliberately not backed up in readable form.

## 6. Incident checklist

1. Contain: break-glass above for research; for profile or mail, deploy a version that answers 503 (or `wrangler delete` the worker if needed).
2. Preserve: note the time, what was seen, which worker. Do not log personal data while investigating.
3. Assess: could any retrieval code, e-mail address or result have been exposed? Counters hold none of these.
4. Notify: if personal data may have been exposed, the owner decides on notification to affected people and the supervisory authority (GDPR Art. 33, within 72 hours of becoming aware). This runbook is not legal advice.
5. Fix, run `npm test`, redeploy, and record what changed in the preflight log.

## 7. Routine checks

- After any change to `tdh/` or `worker/`: `npm test`.
- Monthly: counter check (section 4), confirm the research page still matches `docs/DATA_FACTS.md`.
- Yearly: publish the contribution counts and incidents, as the research protocol promises.
