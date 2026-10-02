# Data Protection Impact Assessment: The Dark Hierarchy Echo-System (draft)

**Controller:** ECHOxSTUDIOS, Berlin (inbox@echoxstudios.art). **Date:** 2 October 2026. **Status:** draft for independent review; required before research collection is enabled.

## 1. Processing described

| Mode | Data | Where | Legal basis | Default |
| :-- | :-- | :-- | :-- | :-- |
| Local only | Answers and results | The visitor's browser | None needed (no transmission) | **Yes** |
| Cross-device storage | Result, tool id, random retrieval code, consent metadata | Cloudflare KV via `worker/profile.mjs` | Explicit consent, Art. 6(1)(a), 9(2)(a) | No |
| E-mail delivery | Address and message, for transmission only | Profile service | Request of the visitor | No |
| Anonymous research contribution | Bucketed counters (tool, dimension, bucket, month) | Cloudflare D1 via `worker/research.mjs` | Explicit consent, Art. 6(1)(a), 9(2)(a); anonymous at source | **Off, and not deployed** |

Special-category data (sexual life) is plausible in results. Adults only (18+ confirmation).

## 2. Necessity and proportionality

- Local-first by default; remote storage and research are separate opt-ins.
- Research stores no row per person and no identifier, so it cannot be linked back to an individual or to a stored profile.
- Tools 5 and 7 (free text) are excluded from research.
- Retention: today, remote profiles are kept until deletion is requested (privacy page § 6). `worker/profile.mjs` adds automatic expiry 24 months after last save; the privacy page is updated when it is deployed. Research counters are aggregate.

## 3. Risks and mitigations

| Risk | Likelihood / severity | Mitigation | Residual |
| :-- | :-- | :-- | :-- |
| Guessing a retrieval code to read someone's result | Medium / high | 12-character codes from a crypto RNG (deployed 2026-10-02); rate limiting on reads; legacy 6-char codes expire; ambiguous characters excluded | Low once 12-char codes are live |
| Re-identification from research counters | Very low / high | No per-submission rows; 10-point buckets; month granularity; suppression below 30 | Very low |
| Skewed or self-selected sample misread as prevalence | High / medium | Mandatory "non-representative" labelling; no prevalence claims | Low |
| Contributor cannot withdraw a past contribution | Certain / low | Disclosed in the consent text before ticking | Accepted, disclosed |
| Cloudflare processes IPs transiently | Certain / low | Disclosed; rate limiting via binding stores nothing | Accepted, disclosed |
| E-mail content contains sensitive results | Medium / medium | Sent only on explicit request; not stored beyond transmission (to be verified in the live worker) | Verify |
| Third-party fonts leaking visitor IP | Was certain / low | Fonts self-hosted (`assets/fonts`); CSP allows only `self`; enforced by `tools/check_site.py` | Closed |
| Misuse on third parties | Low / high | Terms of reading; notice on every tool | Low |

## 4. Open items before enabling research

1. Independent data-protection review of this document.
2. Ethics approval and its reference recorded in `ETHICS_APPROVAL_REF`.
3. Deploy `worker/` with rate-limit bindings; set `RESEARCH_ENABLED=1`.
4. Self-host web fonts so no third-party requests occur on tool pages.
5. Confirm the live e-mail service does not retain message content.
6. Name the research ethics contact and complaint route on the privacy page.
