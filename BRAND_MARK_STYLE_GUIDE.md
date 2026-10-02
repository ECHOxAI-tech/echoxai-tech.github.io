# ECHOx Wordmark Style Guide: the "x"

This is the single authority for how the "x" in ECHOx is written and rendered on echoxstudios.art. Read it before touching any text, stylesheet, or script that contains the brand name. It supplements `BRANDING.md` (where the logo masters live) and `SITE_STANDARDS.md` (propagation rule).

## The rule in one table

| Context | Written in source | Renders as | Notes |
|---|---|---|---|
| Standalone brand | `ECHOx` | ECHO + lowercase **x** | Never `ECHOX`, never `ECHO×` on its own. |
| Compound (product, studio, label) | `ECHOxSTUDIOS`, `ECHOxLUMINA`, `ECHOxVAULT`, `ECHOxINSTANT` | ECHO**×**STUDIOS, using the multiplication sign U+00D7 | The glyph is a real character in the page font. |
| Email addresses, URLs, hostnames, file names, code identifiers | `inbox@echoxstudios.art`, `echoxstudios.art`, `echoxstudios` | Unchanged, all lowercase, plain letters | The mark script never touches these (its pattern is case-sensitive `ECHOx`). |
| Logo images | Use the masters from the private business repo | As designed | See `BRANDING.md`. |

The compound form always has the multiplication sign. The standalone form always has the lowercase letter.

## How it is implemented (and the only way it should be)

1. Write the name in the HTML as plain text, `ECHOx` followed directly by the compound word: `ECHOxSTUDIOS`. Do **not** hand-type `×` or wrap the x in a span.
2. `brand-mark.js` (loaded on every page) finds each `ECHOx…` token and wraps the **whole name** in `<span class="echox-name">`, containing `ECHO`, the mark, and the rest of the word:
   - if an alphanumeric character follows, the mark is `<span class="echox-mark-x">×</span>`;
   - otherwise it is `<span class="echox-plain-x">x</span>`, which stays lowercase even inside `text-transform: uppercase`.
3. The styling lives only in `brand-mark.js`, and is shielded with `!important` so no page rule (for example `.entry-point span`) can restyle the name:
   - `.echox-name`: `font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; font-style: normal; white-space: nowrap`. The name keeps the typeface, size, colour and case of its surroundings, and **is never italic**, even inside `<em>`, `<i>`, quotes, or italic card descriptions.
   - the compound `×`: **Inconsolata** (the site's label face), `font-size: .9em`, `font-weight: 400`, `color: var(--gold-dim, #b8963e)`, `letter-spacing: 0`, `text-transform: none`. It is a deliberate dim-gold accent between ECHO and the product word. `--gold-dim` resolves to each section's own dim gold (homepage `#7a6128`, TDH `#b8963e`), so the accent follows the site palette.
   - the standalone lowercase `x` inherits everything from its surroundings.
   This look was chosen from the Development page "ECHO×LUMINA" card, which the author approved. Sizes tried and rejected: `.92em` in the surrounding serif (too small and low), 1.4em with added weight (reads as a bold cross).

## Never do this

- **No drawn or SVG crosses.** An earlier version drew the x as two stroked SVG lines. It rendered as a heavy, oversized bold "X" that clashed with the wordmark (visible in `ECHO✕STUDIOS` footers on mobile). Removed on 2026-10-02.
- **No uppercase `X` in the brand.** `ECHOXSTUDIOS` is wrong. CSS `text-transform: uppercase` must not turn the mark into `X`; the spans above set `text-transform: none` for this reason.
- **No letter `x` in compounds** (`ECHOxSTUDIOS` rendered with a plain letter, `ECHOXSTUDIOS`, `ECHO-STUDIOS`).
- **No emoji or look-alike glyphs:** not `✕`, `✖`, `❌`, `⨉`, `Ⅹ`. Only U+00D7 `×`.
- **No italics.** Never italicise the brand name or any compound (`ECHO×INSTANT`, `ECHO×STUDIOS`), and never rely on the surrounding text style. Do not add `font-style: italic` rules that target `.echox-name`.
- **No bold, bright, or letter-spaced ×.** It stays weight 400, in the dim-gold accent, with no letter-spacing. Do not recolour it per page.
- **No second implementation.** Do not copy the mark logic into page `<style>` blocks or other scripts; fix `brand-mark.js` and every page inherits it (propagation rule).
- **No `mailto:` link built from marked-up text.** Email addresses stay plain lowercase text.

## Typography context

- Heading and logo contexts: IM Fell English. Body: Cormorant Garamond. Labels, navigation, footers: Inconsolata. The `×` is inherited from whichever applies.
- Footer line pattern: `ECHO×STUDIOS · Berlin · inbox@echoxstudios.art`.

## Checklist before committing any change that mentions the brand

1. `grep -rn "ECHOX" --include="*.html" .` finds no uppercase-X brand names (excluding unrelated words).
2. `grep -rn "echox-mark" . | grep -v brand-mark.js` finds nothing: no page defines its own mark.
3. `grep -rLn "brand-mark.js" --include="*.html" .` lists only pages that intentionally show no brand text.
4. Open an italic context (for example the "Instant Film" card on the home page) and the footer of `tdh/system.html` on a 375px viewport: the whole name must be upright, and the mark must read as a small dim-gold `×` between ECHO and STUDIOS, not a bold cross.
5. The automated check (`tests/test_tdh_echosystem.py` in the writing repo) fails if `brand-mark.js` reintroduces SVG marks.

## History

- 2026-10-02: replaced the drawn SVG cross with the `×` glyph after the heavy cross was reported on mobile; wrote this guide.
- 2026-10-02: the whole brand name is now wrapped upright (compound words were italic inside italic text, with only the × upright); after the author approved the Development card look, the × became a deliberate dim-gold Inconsolata accent at .9em, and the name is shielded from page CSS (a page rule had been turning the whole name gold mono).

## Artist logotype on the site

- **Footer and signature:** where a footer shows the text logo (`.footer-logo`), `brand-signature.js` replaces it with the ECHOx artist logotype; on pages without one, the logotype closes the page as a quiet signature. It links to `about-echoxstudios.html`.
- **On dark pages** the bone-lettered vector `assets/brand/echox-artist-mark-onblack.svg` is used because the original charcoal vanishes on near-black. Light plates, as on the About ECHOxSTUDIOS page, use `echox-artist-mark.svg`. Both are clean SVG re-drawings of the logotype (traced, smoothed, edges snapped to the grid) so they stay crisp at any size; the turquoise echo is the more vivid `#17e9d0` so it reads on black, and sits at the measured offset behind the letters.
- The masters live only in the private business repository (see `BRANDING.md`); these files are deployment copies.
