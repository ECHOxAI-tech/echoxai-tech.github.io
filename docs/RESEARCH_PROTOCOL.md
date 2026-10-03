# The Dark Hierarchy: Research Protocol (draft for ethics review)

**Status:** Phase 1 (anonymous aggregate counters) is **live since 2026-10-03** as a stated condition of using the free tools. Only anonymous, bucketed counters are stored; nothing in them is personal data. Item-level or linked data (Phase 2) is **not** collected and requires a separate consented study under an ethics approval. Kill switch: unset `RESEARCH_ENABLED` in the worker.

**Principal investigator (author):** Echo Kronborg (carrier of Decho), ECHOxSTUDIOS, Berlin.
**Scientific partner:** open. See "Institutional co-projects".

## 1. Why this exists

*The Dark Hierarchy* is a work of theory that states its core claims in a form that can be wrong. The book says desire is recognition-dependent, that it arrives through four channels (visual, emotional, tactile, intellectual), that these channels describe a gradient and not "types of person", and that, in the cases it could examine, the structure does not vary with the gender of the object. A theory that says this should be open to testing by people who are not its author. This protocol describes the safest route by which that can happen, in three phases.

## 2. Hypotheses and how each could fail

| ID | Claim in the book | Operationalisation | Weakened if | Phase |
| :-- | :-- | :-- | :-- | :-- |
| H1 | Arousal route is organised in **four distinguishable channels** (Book II, "The Four Expressions") | Confirmatory factor analysis of Tool 1 item responses against a one-factor and a two-factor alternative | A single factor, or a different structure, fits better | 2 |
| H2 | Channels form a **gradient**, not categories ("not types of person") | Compare dimensional and latent-class/taxometric models of channel profiles | Discrete profile classes fit clearly better than a continuum | 1 (descriptive), 2 (models) |
| H3 | An individual's gradient is **stable** over time | Test-retest reliability (ICC) at 4 and 12 weeks | ICC below a pre-registered threshold | 2 |
| H4 | The structure is **not gendered**: channel profile is not explained by the gender of the object of desire or orientation | Equivalence tests (TOST) on channel profiles across gender and orientation groups | A preregistered effect size beyond the equivalence bound | 2 |
| H5 | Attachment styles are **reports of whether the aspirational self was historically confirmed** (Tool 3) | Convergent validity with an established adult-attachment scale; incremental validity of the confirmation items | No distinct variance beyond the established scale | 2 |
| H6 | A **dark night** of the practitioner can be distinguished from **system failure** (Tool 4) | Prospective follow-up of Tool 4 classification against reported outcome after a pre-registered interval | Classification does not predict outcome | 2 |

Each hypothesis is registered before data are analysed. Null and contrary results are published.

## 3. Phases

**Phase 0: now.** Seven reflective instruments with face validity. No research claim is made. Results are local-first by default.

**Phase 1: anonymous aggregate counters (live).** As a condition of use, stated before first use, each result contributes **only** a bucketed summary of a result from tools 1, 2, 3, 4 or 6. Tools 5 and 7 (free-text protocols) never contribute. The full anonymous aggregate counter table may be used, published or shared for research, cultural-science work, publication or media. This yields descriptive distributions and a feasibility signal for H2. It cannot test H1, H3–H6 because it holds no item-level or linked data. That limitation is deliberate and is the price of anonymity.

**Phase 2: institutional co-project.** With a university or research-institute partner, under that institution's ethics approval, a separately consented, pre-registered study with item-level data and, where needed, pseudonymised retest linkage. The author contributes the theory, instruments and item bank; the partner contributes ethics sponsorship, methodology, and analysis. Data governance, authorship and open-data terms are agreed in writing before launch.

**Phase 3: publication and replication.** Pre-registered results, open materials, and a replication invitation.

## 4. Phase 1 data minimisation (what the system physically can hold)

- **Stored:** counters keyed by (tool, dimension, 10-point bucket, calendar month), plus a per-tool monthly total.
- **Not stored:** retrieval codes, e-mail addresses, IP addresses, device or browser identifiers, user agents, cookies, precise timestamps, free text, demographics, or any per-submission row. Individual response vectors cannot be reconstructed.
- **Transient processing:** Cloudflare handles IP addresses at its edge to deliver the request. The service does not store them. Rate limiting uses Cloudflare's rate-limit binding, which keeps no log of visitors.
- **Rejected at the door:** any payload with fields beyond `v`, `tool`, `scores` or `label`; scores outside 0–100; more than 12 dimensions; payloads over 1 KB.
- **On-site display floor:** the public on-site summary waits until a tool has **30** contributions. This prevents over-interpretation on the site; it does not limit research use, publication or sharing of the full anonymous aggregate counter table.
- **One contribution per tool per device per month**, enforced client-side to limit skew.

## 5. Consent and rights

- Stated as a term of use, accepted together with the adult confirmation, shown in plain language before first use and re-asked when the terms version changes (`tdh_research_optin`). Declining means not using the tools.
- Retention: the counters have no expiry, by design, so a study years from now can use them. Before first use a separate required checkbox records the participant's agreement that they may be stored without a time limit and used for research, cultural-science work, publication and sharing (version `2026-10-03-full-aggregate` of the gate). That agreement is for transparency and for the participant's own decision; it is not the legal basis (see below), which is that the counters are anonymous.
- Legal position: the stored counters are anonymous (no identifier or per-person row), so they are not personal data (GDPR Recital 26) and no consent basis is needed for them. Because the position depends on the anonymisation holding, it is documented in `docs/DPIA.md` and should be confirmed by an independent data-protection adviser. Consent is **not** relied on for the research, since consent cannot be a condition of service (Art. 7(4)); any item-level study will use separate, freely given, explicit consent (Art. 6(1)(a), 9(2)(a)).
- **Disclosed limit:** because contributions are stored only as anonymous counters, a contribution already made cannot be located or withdrawn.
- Adults only (18+).

## 6. Sampling honesty

Contributors are self-selected readers and visitors. Phase 1 results will always be labelled "self-selected, non-representative", must not be presented as prevalence estimates, and must not be used for clinical claims.

## 7. Phase 1 use, publication and sharing

- The full anonymous aggregate counter table may be used, published or shared for research, cultural-science work, publication or media.
- It contains only tool, dimension, bucket, calendar month and count. There is no individual-level dataset, identity, code, address, IP address, device identifier, free text or demographic to release.
- Every presentation carries the self-selected, non-representative and non-clinical warning.
- The on-site public summary waits until a tool has 30 contributions; that display rule does not limit use or sharing of the full anonymous table.
- A collaborator needing item-level or linked data must use the separate Phase 2 study route, with ethics approval and its own consent.

## 8. Governance before switch-on

1. Data protection impact assessment completed (see `docs/DPIA.md`); independent data-protection review is pending and recommended.
2. Ethics review by an appropriate body (a university ethics committee through a partner, or an independent research-ethics service) is **required before any Phase 2 item-level or linked collection**; the approval reference is then recorded in `ETHICS_APPROVAL_REF`.
3. Public data dictionary and this protocol published.
4. Annual public report of contribution counts and any incidents.
5. Kill switch: unset `RESEARCH_ENABLED`; the endpoint returns 503 and the client stops offering the choice.

## 9. Institutional co-projects: what is offered and asked

**Offered:** the theory and a 381-page text with a full apparatus; seven instruments with documented item logic; a working, privacy-hardened data pipeline; a ready participant route among readers; open credit and co-authorship on terms agreed in advance.
**Asked:** an ethics sponsor, a methodological lead, access to established comparison measures, and a commitment to pre-registration and open reporting.

Contact: inbox@echoxstudios.art
