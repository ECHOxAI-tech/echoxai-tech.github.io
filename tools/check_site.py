#!/usr/bin/env python3
"""Static checks for the public site. Run from the repo root: python3 tools/check_site.py"""
import glob, os, re, subprocess, sys

errors = []
read = lambda p: open(p, encoding="utf-8").read()

# 1. Wordmark rules (BRAND_MARK_STYLE_GUIDE.md)
bm = read("brand-mark.js")
if "createElementNS" in bm or "<svg" in bm:
    errors.append("brand-mark.js must not draw the x with SVG")
if not re.search(r"\.echox-name\{[^}]*font-style:normal", bm):
    errors.append("brand-mark.js must wrap the whole name in an upright .echox-name span")
if "Inconsolata" not in bm or "--gold-dim" not in bm or "!important" not in bm:
    errors.append("brand-mark.js must keep the shielded dim-gold Inconsolata multiplication sign")
if "\\u00d7" not in bm:
    errors.append("brand-mark.js must render compounds with U+00D7")
for page in glob.glob("*.html"):
    html = read(page)
    if re.search(r"echox-mark|echox-plain", html):
        errors.append(f"{page}: reimplements the mark")
    if re.search(r"ECHOX[A-Za-z]", html):
        errors.append(f"{page}: uppercase-X compound")
    if "ECHOx" in html and "brand-mark.js" not in html and 'http-equiv="refresh"' not in html:
        errors.append(f"{page}: shows ECHOx without brand-mark.js")

for page in glob.glob("*.html") + glob.glob("tdh/*.html"):
    if 'http-equiv="refresh"' in read(page):
        continue  # redirect stubs
    if "brand-signature.js" not in read(page):
        errors.append(f"{page}: missing the ECHOx signature script")

for page in glob.glob("*.html") + glob.glob("tdh/*.html"):
    for m in re.finditer(r"<(h[1-3])[^>]*>(.*?)</\1>", read(page), re.S):
        plain = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        if plain.endswith(".") and not plain.endswith("..."):
            errors.append(f"{page}: heading ends with a full stop: {plain[:50]}")

# 2. Echo-System hardening
for tool in sorted(glob.glob("tdh/tool-*.html")):
    src = read(tool)
    stripped = re.sub(r"const j = Math\.floor\(Math\.random\(\) \* \(i \+ 1\)\);", "", src)
    if "Math.random" in stripped:
        errors.append(f"{tool}: Math.random used outside the shuffle")
    if "crypto.getRandomValues" not in src:
        errors.append(f"{tool}: retrieval codes must use crypto.getRandomValues")
    if 'href="privacy-choice.css' not in src or "a11y.js" not in src or "a11y.css" not in src:
        errors.append(f"{tool}: missing privacy stylesheet or accessibility layer")

# 3. Local links and assets resolve
for page in glob.glob("*.html") + glob.glob("tdh/*.html"):
    base = os.path.dirname(page)
    for ref in re.findall(r'(?:href|src)="([^"#?:]+\.(?:html|js|css|pdf|png|jpe?g|svg))', read(page)):
        target = os.path.normpath(os.path.join(base, ref.lstrip("/"))) if not ref.startswith("/") else ref.lstrip("/")
        if not os.path.exists(target):
            errors.append(f"{page}: broken local reference {ref}")
        else:
            # GitHub Pages is case-sensitive; macOS is not. Compare each path segment exactly.
            walk = ""
            for part in target.split("/"):
                if part and part not in os.listdir(walk or "."):
                    errors.append(f"{page}: case mismatch in reference {ref}")
                    break
                walk = os.path.join(walk, part) if walk else part

# 4. JavaScript syntax
for script in ["brand-mark.js", "site-nav.js", "site-footer.js"] + glob.glob("tdh/*.js"):
    if os.path.exists(script) and subprocess.run(["node", "--check", script], capture_output=True).returncode:
        errors.append(f"{script}: JavaScript syntax error")

# 5. Research channel stays gated; workers pass their tests; sample and pages exist
pc = read("tdh/privacy-choice.js")
endpoint = re.search(r"var RESEARCH_ENDPOINT = '([^']*)'", pc)
ref = re.search(r"var ETHICS_APPROVAL_REF = '([^']*)'", pc)
if not endpoint or not ref:
    errors.append("privacy-choice.js lost its research gate constants")
elif bool(endpoint.group(1)) != bool(ref.group(1)):
    errors.append("research endpoint and ethics approval reference must be set together")
elif endpoint.group(1) and not os.path.exists("docs/RESEARCH_PROTOCOL.md"):
    errors.append("research enabled without a protocol")
if subprocess.run(["node", "worker/test/workers.test.mjs"], capture_output=True).returncode:
    errors.append("worker tests fail")
for required in ["tdh/research.html", "tdh/system.html", "tdh/info-sheet.html", "docs/DPIA.md", "docs/RESEARCH_PROTOCOL.md",
                 ".well-known/security.txt", "assets/pdfs/The_Dark_Hierarchy_v122_sample.pdf", "assets/pdfs/TDH_Acquisitions_Info_Sheet.pdf", "aniara-the-doors-to-the-stars.html", "assets/pdfs/Aniara_The_Doors_to_the_Stars_sample.pdf", "assets/brand/aniara-emblem.png", "assets/brand/echox-artist-mark.svg", "assets/brand/echox-artist-mark-onblack.svg", "about-echoxstudios.html"]:
    if not os.path.exists(required):
        errors.append(f"missing {required}")
if not endpoint or not endpoint.group(1):
    if re.search(r"currently collecting|is collecting|now collecting", read("tdh/research.html"), re.I):
        errors.append("research page claims collection while the channel is off")

# 6. Anonymity: no legal name, street address or phone on public pages (until selling under German law).
# Generic patterns live here; name-specific patterns live in a local, untracked file (.anonymity-patterns,
# one regular expression per line) so that this public script never contains them.
patterns = [r"stra(\u00df|ss)e [0-9]", r"\+46 ?[0-9]"]
if os.path.exists(".anonymity-patterns"):
    patterns += [ln.strip() for ln in open(".anonymity-patterns", encoding="utf-8") if ln.strip() and not ln.startswith("#")]
LEGAL = re.compile("|".join(patterns), re.I)
for path in glob.glob("*.html") + glob.glob("tdh/*.html") + glob.glob("*.md") + glob.glob("docs/*.md"):
    if LEGAL.search(read(path)):
        errors.append(f"{path}: contains a legal name or personal contact detail")

print("\n".join(f"FAIL {e}" for e in errors) if errors else "All site checks passed.")
sys.exit(1 if errors else 0)
