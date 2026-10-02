# The Dark Hierarchy: Research Protocol (draft for ethics review)

**Status:** Phase 1 is built and switched **off**. No research data is being collected. Collection starts only after (a) a documented ethics review and (b) the operator sets `RESEARCH_ENABLED=1` and `ETHICS_APPROVAL_REF` in the worker, and the site sets the same reference in `privacy-choice.js`.

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

**Phase 1: anonymous aggregate contribution (built, off).** An optional, separate, default-unticked choice lets a visitor contribute **only** a bucketed summary of a result from tools 1, 2, 3, 4 or 6. Tools 5 and 7 (free-text protocols) never contribute. This yields descriptive distributions and a feasibility signal for H2. It cannot test H1, H3–H6 because it holds no item-level or linked data. That limitation is deliberate and is the price of anonymity.

**Phase 2: institutional co-project.** With a university or research-institute partner, under that institution's ethics approval, a separately consented, pre-registered study with item-level data and, where needed, pseudonymised retest linkage. The author contributes the theory, instruments and item bank; the partner contributes ethics sponsorship, methodology, and analysis. Data governance, authorship and open-data terms are agreed in writing before launch.

**Phase 3: publication and replication.** Pre-registered results, open materials, and a replication invitation.

## 4. Phase 1 data minimisation (what the system physically can hold)

- **Stored:** counters keyed by (tool, dimension, 10-point bucket, calendar month), plus a per-tool monthly total.
- **Not stored:** retrieval codes, e-mail addresses, IP addresses, device or browser identifiers, user agents, cookies, precise timestamps, free text, demographics, or any per-submission row. Individual response vectors cannot be reconstructed.
- **Transient processing:** Cloudflare handles IP addresses at its edge to deliver the request. The service does not store them. Rate limiting uses Cloudflare's rate-limit binding, which keeps no log of visitors.
- **Rejected at the door:** any payload with fields beyond `v`, `tool`, `scores` or `label`; scores outside 0–100; more than 12 dimensions; payloads over 1 KB.
- **Disclosure floor:** summaries are suppressed for any tool with fewer than **30** contributions (k-anonymity-style threshold).
- **One contribution per tool per device per month**, enforced client-side to limit skew.

## 5. Consent and rights

- Separate from the storage choice and from age confirmation; default off; versioned (`tdh_research_optin`); explained in plain language before it can be ticked.
- Legal basis: explicit consent, Art. 6(1)(a) and Art. 9(2)(a) GDPR. Withdrawal stops future contributions at once.
- **Disclosed limit:** because contributions are stored only as anonymous counters, a contribution already made cannot be located or withdrawn. The consent text says so.
- Adults only (18+).

## 6. Sampling honesty

Contributors are self-selected readers and visitors. Phase 1 results will always be labelled "self-selected, non-representative", must not be presented as prevalence estimates, and must not be used for clinical claims.

## 7. Governance before switch-on

1. Data protection impact assessment completed (see `docs/DPIA.md`) and reviewed by an independent data-protection adviser.
2. Ethics review by an appropriate body (a university ethics committee through a partner, or an independent research-ethics service). The approval reference is recorded in `ETHICS_APPROVAL_REF`.
3. Public data dictionary and this protocol published.
4. Annual public report of contribution counts and any incidents.
5. Kill switch: unset `RESEARCH_ENABLED`; the endpoint returns 503 and the client stops offering the choice.

## 8. Institutional co-projects: what is offered and asked

**Offered:** the theory and a 381-page text with a full apparatus; seven instruments with documented item logic; a working, privacy-hardened data pipeline; a ready participant route among readers; open credit and co-authorship on terms agreed in advance.
**Asked:** an ethics sponsor, a methodological lead, access to established comparison measures, and a commitment to pre-registration and open reporting.

Contact: inbox@echoxstudios.art
