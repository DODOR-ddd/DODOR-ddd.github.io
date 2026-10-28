#!/usr/bin/env python3
"""Localize remote image-host URLs in posts before deployment.

Rewrites jsDelivr/gcore references to DODOR-ddd/image into local /imgs/ paths,
downloading the file into source/imgs/ first when it is not there yet.
Run automatically as part of `npm run build` / `npm run deploy`."""
import os
import re
import sys
import urllib.request
import urllib.parse

POSTS = os.path.join(os.path.dirname(__file__), "..", "source", "_posts")
IMGS = os.path.join(os.path.dirname(__file__), "..", "source", "imgs")
CDN_RE = re.compile(
    r"https://(?:cdn|fastly|testingcf|gcore)\.jsdelivr\.net/gh/DODOR-ddd/[Ii]mage@main/([^\s\)\"]+)"
)

os.makedirs(IMGS, exist_ok=True)
total = downloaded = 0
for md in sorted(os.listdir(POSTS)):
    if not md.endswith(".md"):
        continue
    p = os.path.join(POSTS, md)
    text = open(p, encoding="utf-8").read()

    def repl(m):
        global total, downloaded
        total += 1
        name = urllib.parse.unquote(m.group(1))
        local = os.path.join(IMGS, name)
        if not os.path.exists(local):
            url = "https://raw.githubusercontent.com/DODOR-ddd/image/main/" + m.group(1)
            try:
                urllib.request.urlretrieve(url, local)
                downloaded += 1
                print(f"downloaded: {name}")
            except Exception as e:
                print(f"WARNING: keep remote ({e}): {m.group(0)}")
                return m.group(0)
        return "/imgs/" + urllib.parse.quote(name)

    new = CDN_RE.sub(repl, text)
    if new != text:
        open(p, "w", encoding="utf-8").write(new)
        print(f"rewrote: {md}")

print(f"localize done: {total} refs checked, {downloaded} downloaded")
