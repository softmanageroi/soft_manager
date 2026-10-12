#!/usr/bin/env python3
"""
relink.py - project ki saari HTML/CSS/JS files ko aapas mein connect karta hai.

Chalane ka tareeka (project root mein, jahan html/ css/ js/ folders hain):
    python3 relink.py

Kya karta hai:
  1. Pehle backup banata hai (../<project>-relink-backup)
  2. Galat jagah padi files ko sahi folder mein daalta hai:
        *.html  -> html/
        *.css   -> css/   (sub-folder jaise css/inventory/ waise hi rehte hain)
        *.js    -> js/    (sub-folder jaise js/item-master/ waise hi rehte hain)
     (sirf wahi files jo html/css/js folder ke bahar ya galat folder mein hain)
  3. Har HTML mein <link href> aur <script src> ko file ke naam se dhoondh kar sahi relative path banata hai
  4. Har CSS mein url(...) ko aise hi theek karta hai
  5. Har JS mein "xyz.html" wale page links ko theek karta hai
  6. Last mein report: jo links abhi bhi nahi mile
"""
import os
import re
import shutil
import sys

ROOT = os.getcwd()
SKIP_DIRS = {"_to_delete", "node_modules", ".git", "__pycache__"}
EXT_HOME = {".html": "html", ".css": "css", ".js": "js", ".htm": "html"}
EXTERNAL = re.compile(r'^(https?:|//|#|data:|mailto:|tel:|javascript:|\{|<)', re.I)


def walk_files():
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS and not d.startswith(".")]
        for f in fn:
            yield os.path.join(dp, f)


if not os.path.isdir(os.path.join(ROOT, "html")):
    sys.exit("Error: 'html' folder nahi mila. Project ke root folder mein chalao.")

# ---- 1. Backup ----
backup = os.path.join(os.path.dirname(ROOT), os.path.basename(ROOT) + "-relink-backup")
if not os.path.exists(backup):
    shutil.copytree(ROOT, backup)
    print(f"[ok] Backup: {backup}")

# ---- 2. Galat jagah ki files ko sahi folder mein ----
moved = 0
for p in list(walk_files()):
    ext = os.path.splitext(p)[1].lower()
    if ext not in EXT_HOME:
        continue
    rel = os.path.relpath(p, ROOT)
    parts = rel.split(os.sep)
    home = EXT_HOME[ext]
    if parts[0].lower() == home:
        continue  # pehle se sahi folder mein
    # sub-folder structure bacha kar rakho (agar wo sahi folder ke andar nahi hai to sirf file ka naam)
    dest = os.path.join(ROOT, home, parts[-1])
    if os.path.exists(dest):
        print(f"[skip] {rel} (html/css/js mein is naam ki file pehle se hai)")
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.move(p, dest)
    moved += 1
    print(f"[moved] {rel} -> {home}/{parts[-1]}")
print(f"{moved} file(s) sahi folder mein gayi.\n")

# ---- Index: naam -> sab locations ----
index = {}
for p in walk_files():
    index.setdefault(os.path.basename(p).lower(), []).append(p)


def pick(name, ext):
    cands = index.get(name.lower())
    if not cands:
        return None
    home = EXT_HOME.get(ext)
    preferred = [c for c in cands if os.path.relpath(c, ROOT).split(os.sep)[0].lower() == home]
    return (preferred or cands)[0]


def relink(url, from_dir):
    if not url.strip() or EXTERNAL.match(url.strip()):
        return url, True
    clean = re.split(r'[?#]', url, 1)[0]
    suffix = url[len(clean):]
    ext = os.path.splitext(clean)[1].lower()
    if ext not in (".html", ".htm", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf"):
        return url, True
    # pehle check karo ki path pehle se sahi hai
    if os.path.exists(os.path.normpath(os.path.join(from_dir, clean))):
        return url, True
    target = pick(os.path.basename(clean), ext)
    if not target:
        return url, False
    new = os.path.relpath(target, from_dir).replace(os.sep, "/")
    return new + suffix, True


problems = []
fixed_files = 0

ATTR = re.compile(r'(\b(?:href|src)\s*=\s*)(["\'])([^"\']+)\2', re.I)
CSS_URL = re.compile(r'url\(\s*(["\']?)([^)"\']+)\1\s*\)', re.I)
JS_HTML = re.compile(r'(["\'`])([^"\'`\s]*?[\w\-\.]+\.html?)(\?[^"\'`]*)?\1', re.I)

for p in list(walk_files()):
    ext = os.path.splitext(p)[1].lower()
    rel = os.path.relpath(p, ROOT)
    here = os.path.dirname(p)
    try:
        with open(p, "r", encoding="utf-8") as f:
            text = f.read()
    except (UnicodeDecodeError, OSError):
        continue
    new_text = text

    if ext in (".html", ".htm"):
        def sub_attr(m):
            new, ok = relink(m.group(3), here)
            if not ok:
                problems.append((rel, m.group(3)))
            return f"{m.group(1)}{m.group(2)}{new}{m.group(2)}"
        new_text = ATTR.sub(sub_attr, text)

    elif ext == ".css":
        def sub_url(m):
            new, ok = relink(m.group(2), here)
            if not ok:
                problems.append((rel, m.group(2)))
            return f"url({m.group(1)}{new}{m.group(1)})"
        new_text = CSS_URL.sub(sub_url, text)

    elif ext == ".js":
        # JS mein page links us page ke folder (html/) ke hisaab se chalte hain
        html_dir = os.path.join(ROOT, "html")

        def sub_js(m):
            url = m.group(2)
            if EXTERNAL.match(url):
                return m.group(0)
            name = os.path.basename(url)
            target = pick(name, ".html")
            if not target:
                return m.group(0)
            new = os.path.relpath(target, html_dir).replace(os.sep, "/")
            return f"{m.group(1)}{new}{m.group(3) or ''}{m.group(1)}"
        new_text = JS_HTML.sub(sub_js, text)

    if new_text != text:
        with open(p, "w", encoding="utf-8") as f:
            f.write(new_text)
        fixed_files += 1
        print(f"[fixed] {rel}")

print(f"\n{fixed_files} file(s) update hui.\n")

if problems:
    print("Ye files project mein mili hi nahi (naam galat hai ya file missing hai):")
    for rel, url in sorted(set(problems)):
        print(f"  {rel}  ->  {url}")
else:
    print("Saare links connect ho gaye.")
