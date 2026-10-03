# ECHOx Website Standards

This is the working design, layout, and implementation standard for `echoxstudios.art`. It exists so that a local improvement never creates a site-wide inconsistency.

## Required workflow for every edit

Before changing any public-facing page, read this file and `BRANDING.md`.

1. Identify the component family being changed: card, page header, navigation, footer, call to action, link, product presentation, manuscript presentation, exhibition presentation, or brand mark.
2. Search the whole site for every occurrence of that family before editing. Do not treat the first visible instance as a one-off unless it is intentionally unique.
3. Make the change in the shared stylesheet or shared script whenever one exists. If no shared implementation exists, apply the same rule to every matching instance in the same change.
4. Check desktop and mobile rendering, including inherited colour, font weight, text transform, line height, spacing, wrapping, hover state, and dark-background contrast.
5. Search again after the change to confirm that no old implementation remains.
6. Update this document whenever a durable visual, naming, or interaction rule changes.

### Propagation rule

If X is changed on one Y, identify every equivalent Y across the site and apply X to all of them. Examples:

- A card-title weight change applies to every card-title family.
- A call-to-action link treatment applies to all equivalent calls to action.
- A footer or navigation correction applies to every footer or navigation instance.
- A brand-mark change applies through the shared brand-mark implementation everywhere it is loaded.

Check every instance before committing.

### Rhythm and spacing rule

Repeated visual sequences must preserve a deliberate rhythm at every breakpoint. When a heading, ornament, label, rule, lead paragraph, or call to action is adjusted, inspect the full sequence around it rather than only the changed element. Equal elements need equal spacing; intentional differences must communicate hierarchy. Audit every equivalent sequence across the site and correct the whole family in the same change.

## Visual system

### Character

The site is restrained, literary, editorial, and deliberate. It should feel authored, not template-driven or generic. Use hierarchy, whitespace, rules, and precise type rather than decorative clutter.

- Background: near-black.
- Primary text: warm off-white / bone.
- Secondary text: muted warm grey.
- Accent: subdued gold, always readable against black.
- Links: use the site gold or muted-gold treatment; browser-default blue is never acceptable.
- Decorative bullets are not used unless they communicate an actual list or meaningful separation.

### Typography

- **Headings never end with a full stop.** This applies to every h1, h2, and h3 on the site. If a heading holds two thoughts, join them with a semicolon or an em dash rather than ending sentences with periods.

- **IM Fell English** is the display face for authored headings and card titles.
- **Cormorant Garamond** is the reading face for prose.
- **Inconsolata** is used for labels, metadata, navigation, and compact calls to action.
- Display and card headings use `font-weight: 400`, never browser-default bold.
- Shared heading sizing and weight are governed by `site-type.css`; do not introduce isolated size or weight overrides without a clear reason.
- Text must remain comfortably readable on mobile. Avoid oversized headings, dense tracking, and cramped leading.

### Layout and cards

- Cards use the same near-black field, fine warm rule, intentional padding, and restrained hover treatment.
- Equivalent card grids must use a consistent heading hierarchy, label placement, body-text scale, and action treatment.
- Product cards use the product logo where a product identity is being presented; do not repeat a text title beside the lockup without a purpose.
- Every page must have deliberate top and bottom breathing room. No accidental blank pages, empty visual zones, or unexplained duplicated content.

### Navigation and footer

- The top navigation is the primary orientation system; page cards should support it rather than compete with it.
- The footer is a consistent utility close, not a second competing navigation architecture.
- Footer and inquiry links must inherit the site palette in normal, visited, and hover states.
- Mobile navigation must fully cover page content while open and must not leave underlying copy visibly competing with the menu.

## ECHOx writing and marks

### Plain identity

`ECHOx` is written with a lowercase baseline `x`.

- Never allow uppercase text transforms to turn it into `ECHOX`.
- The shared `brand-mark.js` protects the baseline lowercase x in transformed contexts.

### Compound identities

Compounded names are written without spaces: `ECHOxPRODUCTION`, `ECHOxINSTANT`, `ECHOxLUMINA`, `ECHOxVAULT`, `ECHOxSTUDIOS`, and collaboration labels of the same form.

- The connector x is smaller, thin, and centred on the writing line—not superscript and not a multiplication sign.
- Use `brand-mark.js`; do not substitute unicode x-like characters or manually styled alternatives.
- Its geometry is optically clamped in the shared implementation so it remains the same restrained mark in labels, body copy, and display text rather than becoming oversized or heavy with the parent font.
- It must remain visible on the black site background, including small tags and metadata.
- `Tofinns Journey` is the explicit exception and is not prefixed.

### Identity and legal wording

- ECHOx is the public artistic identity.
- Eko Svenningsson is the book byline, except for *The Dark Hierarchy*, which is written as Echo Kronborg, its distinct authorial construct and carrier of Decho.
- Do not include the legal name, its spelling variants, or home-address details in public artistic copy, metadata, deployment files, or public repository history.
- ECHOxSTUDIOS is a studio identity / business in formation until registered; never present it as an already registered company.

## Content and information architecture

- Each page has one clear job: orient, pitch, present, invite contact, or provide protected professional material.
- Avoid duplicate text and duplicate routes. A visitor should not reach the same synopsis or pitch twice through different labels.
- Catalogue pages remain concise and intriguing. Full synopses carry a spoiler warning.
- Withheld work stays withheld: do not expose a title, files, searchable copy, metadata, or links before publication or submission rules permit it.
- Exhibition and press copy must present every venue-ready project named in the relevant section with equal seriousness.

## Assets and deployment

- Logo masters live only in the private business repository, as defined in `BRANDING.md`.
- Website assets are exported deployment copies. Do not treat them as masters or make unsynchronised local redesigns in this repository.
- When a shared runtime script or stylesheet changes, update its version query on every page that references it so visitors receive the current version.
- Before pushing: run a whitespace/diff check, search for obsolete implementations, and confirm the working tree contains only intended changes.

## Maintenance log

Keep the durable rules above current. Add concise dated entries only when a rule itself changes.

- 2026-07-16: Established the site-wide propagation rule; normalised card-heading weight; protected baseline `ECHOx` and the shared compound connector mark.
- 2026-07-16: Clamped compound-connector geometry and stroke weight for consistent rendering across label, body, and display contexts.
- 2026-07-16: Recorded the distinct Echo Kronborg byline for *The Dark Hierarchy*; do not collapse it into the Eko Svenningsson book credit.
- 2026-07-17: Public-name privacy rule added: exclude legal-name variants and home-address details from deployable files and public history; keep legal-page indexing disabled.
- 2026-07-20: Replaced the compound connector’s fractional CSS strokes with a shared inline SVG mark so its thin geometry renders consistently in every card, label, and metadata context.
- 2026-07-20: Transparent logo exports keep their outer canvas clear while retaining opaque graphic interiors; overlapping symbols must never show through one another.
- 2026-10-03: Added the rhythm-and-spacing rule after normalising the tool-header ornament sequence across the Echo-System.

## Brand name rendering

The ECHOx "x" (lowercase standalone, `×` U+00D7 in compounds) is governed by `BRAND_MARK_STYLE_GUIDE.md`. Never draw it with SVG, never uppercase it, and never reimplement it outside `brand-mark.js`.
