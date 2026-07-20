#!/bin/bash
# Run from inside ~/Desktop/echoxai-tech.github.io/
# Usage: bash reorganize.sh

set -e
REPO="$HOME/Desktop/echoxai-tech.github.io"
cd "$REPO"

echo "Creating asset folders..."
mkdir -p assets/images assets/audio assets/pdfs

echo "Moving images..."
for f in Image*.jpeg heropic.jpeg; do
  [ -f "$f" ] && mv "$f" assets/images/
done

echo "Moving audio..."
for f in *.mp3; do
  [ -f "$f" ] && mv "$f" assets/audio/
done

echo "Moving PDFs..."
for f in *.pdf; do
  [ -f "$f" ] && mv "$f" assets/pdfs/
done

echo "Updating references in HTML files..."
python3 - << 'EOF'
import os, glob

REPO = os.path.expanduser("~/Desktop/echoxai-tech.github.io")

# Build replacement map
replacements = {}

for f in glob.glob(os.path.join(REPO, "assets/images/*")):
    name = os.path.basename(f)
    replacements[f'"{name}"']        = f'"assets/images/{name}"'
    replacements[f"'{name}'"]        = f"'assets/images/{name}'"
    replacements[f'src={name}']      = f'src=assets/images/{name}'

for f in glob.glob(os.path.join(REPO, "assets/audio/*")):
    name = os.path.basename(f)
    replacements[f'"{name}"']        = f'"assets/audio/{name}"'
    replacements[f"'{name}'"]        = f"'assets/audio/{name}'"

for f in glob.glob(os.path.join(REPO, "assets/pdfs/*")):
    name = os.path.basename(f)
    replacements[f'"{name}"']        = f'"assets/pdfs/{name}"'
    replacements[f"'{name}'"]        = f"'assets/pdfs/{name}'"

# Apply to all root HTML files
html_files = glob.glob(os.path.join(REPO, "*.html"))
for path in html_files:
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read()
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
    if content != original:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        print(f"  Updated: {os.path.basename(path)}")
    else:
        print(f"  No changes: {os.path.basename(path)}")

print("Done.")
EOF

echo "Committing..."
git add -A
git commit -m "Reorganise repo: assets into assets/images, audio, pdfs"
git push origin main

echo ""
echo "All done. Live at https://echoxstudios.art"
