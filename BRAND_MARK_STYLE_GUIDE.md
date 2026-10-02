# ECHOx Wordmark Style Guide: the "x"

This is the single authority for how the "x" in ECHOx is written and rendered on echoxstudios.art. Read it before touching any text, stylesheet, or script that contains the brand name. It supplements `BRANDING.md` (where the logo masters live) and `SITE_STANDARDS.md` (propagation rule).

## The rule in one table

| Context | Written in source | Renders as | Notes |
|---|---|---|---|
| Standalone brand | `ECHOx` | ECHO + lowercase **x** | Never `ECHOX`, never `ECHO×` on its own. |
| Compound (product, studio, label) | `ECHOxSTUDIOS`, `ECHOxLUMINA`, `ECHOxVAULT`, `ECHOxINSTANT` | ECHO**×**STUDIOS, using the multiplication sign U+00D7 | The glyph is a real character in the page font. |
| Email addresses, URLs, hostnames, file names, code identifiers | `inbox@echoxstudios.art`, `echoxstudios.art`, `echoxai-tech` | Unchanged, all lowercase, plain letters | The mark script never touches these (its pattern is case-sensitive `ECHOx`). |
| Logo images | Use the masters from the private business repo | As designed | See `BRANDING.md`. |

The compound form always has the multiplication sign. The standalone form always has the lowercase letter.

## How it is implemented (and the only way it should be)

1. Write the name in the HTML as plain text, `ECHOx` followed directly by the compound word: `ECHOxSTUDIOS`. Do **not** hand-type `×` or wrap the x in a span.
2. `brand-mark.js` (loaded on every page) finds `ECHOx`, and:
   - if an alphanumeric character follows, replaces the `x` with `<span class="echox-mark-x">×</span>`;
   - otherwise wraps it as `<span class="echox-plain-x">x</span>` so it stays lowercase even inside `text-transform: uppercase`.
3. The glyph styling lives only in `brand-mark.js`: `text-transform:none; letter-spacing:0; font-weight:inherit; font-size:.92em; vertical-align:.02em`. It inherits the surrounding font, so it matches IM Fell English, Cormorant Garamond, and Inconsolata automatically.
4. Every page that shows the brand loads `brand-mark.js`. When the script changes, bump its `?v=` query on all pages in the same commit.

## Never do this

- **No drawn or SVG crosses.** An earlier version drew the x as two stroked SVG lines. It rendered as a heavy, oversized bold "X" that clashed with the wordmark (visible in `ECHO✕STUDIOS` footers on mobile). Removed on 2026-10-02.
- **No uppercase `X` in the brand.** `ECHOXSTUDIOS` is wrong. CSS `text-transform: uppercase` must not turn the mark into `X`; the spans above set `text-transform: none` for this reason.
- **No letter `x` in compounds** (`ECHOxSTUDIOS` rendered with a plain letter, `ECHOXSTUDIOS`, `ECHO-STUDIOS`).
- **No emoji or look-alike glyphs:** not `✕`, `✖`, `❌`, `⨉`, `Ⅹ`. Only U+00D7 `×`.
- **No bold, enlarged, coloured, or letter-spaced x.** The mark is the same weight, colour, and size family as its neighbours (0.92em).
- **No second implementation.** Do not copy the mark logic into page `<style>` blocks or other scripts; fix `brand-mark.js` and every page inherits it (propagation rule).
- **No `mailto:` link built from marked-up text.** Email addresses stay plain lowercase text.

## Typography context

- Heading and logo contexts: IM Fell English. Body: Cormorant Garamond. Labels, navigation, footers: Inconsolata. The `×` is inherited from whichever applies.
- Footer line pattern: `ECHO×STUDIOS · Berlin · inbox@echoxstudios.art`.

## Checklist before committing any change that mentions the brand

1. `grep -rn "ECHOX" --include="*.html" .` finds no uppercase-X brand names (excluding unrelated words).
2. `grep -rn "echox-mark" . | grep -v brand-mark.js` finds nothing: no page defines its own mark.
3. `grep -rLn "brand-mark.js" --include="*.html" .` lists only pages that intentionally show no brand text.
4. Open the footer of `tdh/system.html` on a 375px viewport: the mark must read as a small, light `×` between ECHO and STUDIOS, not a bold cross.
5. The automated check (`tests/test_tdh_echosystem.py` in the writing repo) fails if `brand-mark.js` reintroduces SVG marks.

## History

- 2026-10-02: replaced the drawn SVG cross with the `×` glyph after the heavy cross was reported on mobile; wrote this guide.
