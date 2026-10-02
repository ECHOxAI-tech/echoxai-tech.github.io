# Data Protection Impact Assessment: The Dark Hierarchy Echo-System (draft)

**Controller:** ECHOxSTUDIOS, Berlin (inbox@echoxstudios.art). **Date:** 2 October 2026. **Status:** draft for independent review. Phase 1 anonymous counters are live since 2026-10-03; item-level (Phase 2) research is not collected and needs a separate consented study under ethics approval. Source of truth for every data claim: `docs/DATA_FACTS.md`.

## 1. Processing described

| Mode | Data | Where | Legal basis | Default |
| :-- | :-- | :-- | :-- | :-- |
| Local only | Answers and results | The visitor's browser | None needed (no transmission) | **Yes** |
| Cross-device storage | Result, tool id, random retrieval code, consent metadata | Cloudflare KV via `worker/profile.mjs` | Explicit consent, Art. 6(1)(a), 9(2)(a) | No |
| E-mail delivery | Address and message, for transmission only | Profile service | Request of the visitor | No |
| Anonymous research contribution | Bucketed counters (tool, dimension, bucket, month) | Cloudflare D1 via `worker/research.mjs` | None needed: anonymous at source (Recital 26), stated as a term of use | **On: live since 2026-10-03** (kill switch `RESEARCH_ENABLED`) |

Special-category data (sexual life) is plausible in results. Adults only (18+ confirmation).

## 2. Necessity and proportionality

- Local-first by default; remote storage is a separate opt-in; the anonymous research counters are a stated condition of use (not personal data; see RESEARCH_PROTOCOL §5).
- Research stores no row per person and no identifier, so it cannot be linked back to an individual or to a stored profile.
- Tools 5 and 7 (free text) are excluded from research.
- Retention: remote profiles expire automatically 24 months after the last save (`worker/profile.mjs`, privacy page § 6) and can be deleted earlier with the retrieval code. Research counters are aggregate and cannot be withdrawn individually (disclosed).

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

## 4. Open items (research is already live; these remain recommended)

1. Independent data-protection review of this document.
2. Ethics approval (required before any Phase 2 item-level collection; its reference is then recorded in `ETHICS_APPROVAL_REF`).
3. Done: `worker/` deployed with rate-limit bindings; `RESEARCH_ENABLED=1`. Run the end-to-end suite (`npm test`) after any change.
4. Done: web fonts are self-hosted.
5. Confirm the live e-mail service does not retain message content.
6. Name the research ethics contact and complaint route on the privacy page.
