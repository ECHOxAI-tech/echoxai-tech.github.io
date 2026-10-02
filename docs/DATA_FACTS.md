# Data facts: the single source of truth

Every public statement about data, on the site, in the documents and in the sales material, must match this table.
`tests/wording.test.mjs` checks the public repository against it (stale wording, required statements). The private
repository's audit checks the sales material against the same table. Change this table first, then the wording.

| Topic | Required public truth | Status |
| :-- | :-- | :-- |
| Result storage | The visitor chooses at the gate, with no pre-ticked box: either the result is saved under a random 12-character code so the code works on any device (recommended; saving is the visitor's explicit consent), or it stays in the browser on this device only and the code works only there. | Live |
| Research data | Anonymous aggregate counters only: tool, dimension, 10-point bucket, calendar month. No profile, e-mail, IP address, device identifier, free text, demographic or per-person record. | Live since 2026-10-03 |
| Which tools contribute | Tools 1, 2, 3, 4 and 6. Tools 5 and 7 (free-text protocols) never contribute. A result opened from a link or a code never contributes. | Live |
| Contribution rule | At most once per tool per device per month, as a stated term of use, shown before first use, with a separate required checkbox agreeing that the anonymous counters may be stored without a time limit and used for scientific research and publication. Automated browsers never contribute. | Live |
| Public output | Suppressed for any tool with fewer than 30 contributions (k = 30). | Live |
| Retention | Cross-device profiles expire automatically after 24 months without use (a save or an open restarts the clock; an unused code simply stops working, and since no e-mail is stored there is no reminder) and can be deleted earlier by whoever holds the code. Research counters are a separate matter: they are anonymous aggregates, kept without a time limit for science and publication, agreed in their own checkbox before first use, and cannot be withdrawn individually (disclosed). | Live. **24 months without use confirmed by the owner on 2026-10-04.** |
| E-mail | Sent only when the visitor asks; the address is used for that one delivery and is not stored. | Live |
| Research status | "Active" is stated only while the live research worker is active (`RESEARCH_ENABLED=1`). If it is switched off, every page must say so on the same day. | Active |
| Limits | Self-selected, non-representative contributions. Not clinical, not diagnostic, not a prevalence estimate. | Always |
| Legal position | The counters are anonymous and therefore not personal data (GDPR Recital 26); this is the author's analysis, not an independent legal review. Item-level or linked data would need a separate consented study under ethics approval and is not collected. | Always |
| Ratings | No ratings, reader scores or review scores are published anywhere. | Always |

## Scoring note (tool 1)
From 2026-10-02 tool 1 offers an optional box on 13 statements ("what matters is what it means"). A ticked statement counts toward Intellectual. Unticked scoring is unchanged. The research counters carry the resulting channel percentages; the test row recorded on 2026-10-02 predates the box and used plain scoring.

## Receipt shown on the result screen

After a contribution attempt the result screen shows one of these lines and nothing else (never the submitted values,
an identifier or a count):

- "Anonymous aggregate contribution recorded."
- "Anonymous contribution for this month is already recorded from this device."
- "Anonymous research counters are paused at the moment. Your result is unaffected."
- "Your result is still available; the anonymous contribution could not be sent and will retry next time."

## Decisions that belong to the owner

1. ~~Final public retention period for profile-code records~~ Decided 2026-10-04: 24 months without use. Research counters have no expiry by design.
2. Whether aggregate data may ever be shared outside the site, and on what terms.
3. When an imprint with legal identity details becomes necessary.
