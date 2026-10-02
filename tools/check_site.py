#!/usr/bin/env python3
"""Static checks for the public site. Run from the repo root: python3 tools/check_site.py"""
import glob, os, re, subprocess, sys

errors = []
read = lambda p: open(p, encoding="utf-8").read()

# 1. Wordmark rules (BRAND_MARK_STYLE_GUIDE.md)
bm = read("brand-mark.js")
if "createElementNS" in bm or "<svg" in bm:
    errors.append("brand-mark.js must not draw the x with SVG")
if "\\u00d7" not in bm:
    errors.append("brand-mark.js must render compounds with U+00D7")
for page in glob.glob("*.html"):
    html = read(page)
    if re.search(r"echox-mark|echox-plain", html):
        errors.append(f"{page}: reimplements the mark")
    if re.search(r"ECHOX[A-Za-z]", html):
        errors.append(f"{page}: uppercase-X compound")
    if "ECHOx" in html and "brand-mark.js" not in html:
        errors.append(f"{page}: shows ECHOx without brand-mark.js")

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

# 4. JavaScript syntax
for script in ["brand-mark.js", "site-nav.js", "site-footer.js"] + glob.glob("tdh/*.js"):
    if os.path.exists(script) and subprocess.run(["node", "--check", script], capture_output=True).returncode:
        errors.append(f"{script}: JavaScript syntax error")

print("\n".join(f"FAIL {e}" for e in errors) if errors else "All site checks passed.")
sys.exit(1 if errors else 0)
