#!/usr/bin/env python3
"""
Soft-manager project path fixer.

Usage:
  cd ~/Downloads/Soft-manager-main
  python3 fix_paths.py
"""

import os
import re
import shutil
import sys

ROOT = os.getcwd()
HTML_DIR = os.path.join(ROOT, "html")

if not os.path.isdir(HTML_DIR):
    sys.exit("Error: 'html' folder not found. Run this from the Soft-manager-main project root.")

# 1) Backup
backup = os.path.join(os.path.dirname(ROOT), os.path.basename(ROOT) + "-backup")
if not os.path.exists(backup):
    shutil.copytree(ROOT, backup)
    print(f"[ok] Backup created: {backup}")
else:
    print(f"[skip] Backup already exists: {backup}")

# 2) Move duplicate js/HTML folder to _to_delete (do not delete immediately)
js_dir = os.path.join(ROOT, "js")
dup = os.path.join(js_dir, "HTML") if js_dir else None
if dup and os.path.isdir(dup):
    trash = os.path.join(ROOT, "_to_delete")
    os.makedirs(trash, exist_ok=True)
    target = os.path.join(trash, "js_HTML")
    if os.path.exists(target):
        shutil.rmtree(target)
    shutil.move(dup, target)
    print("[ok] Duplicate js/HTML moved to _to_delete/js_HTML")

# 3) Rename INDEX.HTML to index.html
upper = os.path.join(HTML_DIR, "INDEX.HTML")
lower = os.path.join(HTML_DIR, "index.html")
if os.path.exists(upper) and not os.path.exists(lower):
    tmp = os.path.join(HTML_DIR, "index-temp.html")
    os.rename(upper, tmp)
    os.rename(tmp, lower)
    print("[ok] INDEX.HTML renamed to index.html")

# 4) Fix relative asset references in HTML files
ATTR = re.compile(r'(href|src)\s*=\s*"([^"]+)"', re.IGNORECASE)

def fix_url(url):
    if re.match(r'^(https?:|//|#|data:|mailto:|javascript:)', url):
        return url
    new = url.strip()
    new = re.sub(r'^(\.\./)+?(css|js|images)/', r'../\2/', new)
    new = re.sub(r'^\.?\.?/?(css|js|images)/', r'../\1/', new)
    new = re.sub(r'^(css|js|images)/', r'../\1/', new)
    new = new.replace('../js/HTML/', '')
    new = re.sub(r'^INDEX\.HTML$', 'index.html', new)
    new = re.sub(r'/INDEX\.HTML$', '/index.html', new)
    return new

changed_files = 0
for name in sorted(os.listdir(HTML_DIR)):
    if not name.lower().endswith(".html"):
        continue
    path = os.path.join(HTML_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    new_text = ATTR.sub(lambda m: f'{m.group(1)}="{fix_url(m.group(2))}"', text)
    if new_text != text:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_text)
        changed_files += 1
        print(f"[fixed] {name}")

print(f"\n{changed_files} HTML file(s) updated.\n")

# 5) Detect any remaining broken local asset links
broken = []
for name in sorted(os.listdir(HTML_DIR)):
    if not name.lower().endswith(".html"):
        continue
    path = os.path.join(HTML_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    for match in ATTR.finditer(text):
        url = match.group(2)
        if re.match(r'^(https?:|//|#|data:|mailto:|javascript:)', url) or not url.strip():
            continue
        clean = url.split("?")[0].split("#")[0]
        target = os.path.normpath(os.path.join(HTML_DIR, clean))
        if not os.path.exists(target):
            broken.append((name, url))

if broken:
    print("Remaining broken local links:")
    for name, url in broken:
        print(f"  html/{name} -> {url}")
else:
    print("All local links resolve successfully.")
