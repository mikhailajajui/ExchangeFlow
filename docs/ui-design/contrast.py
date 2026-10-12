#!/usr/bin/env python3
"""Reads tokens.css (light block, dark media block) and checks WCAG 2.1 pairs. Exit 1 on an unexpected failure.
Run: python3 docs/ui-design/contrast.py"""
import re, sys, pathlib
css = pathlib.Path(__file__).with_name("tokens.css").read_text()
def block(start):
    i = css.index(start); j = css.index("}", i)
    return dict(re.findall(r"--([a-z-]+):\s*(#[0-9A-Fa-f]{6})", css[i:j]))
light = block(':root, :root[data-theme="light"] {')
dark = block(':root:not([data-theme="light"]) {')
assert dark == block(':root[data-theme="dark"] {'), "forced-dark block differs from the media block"
def lum(h):
    c = [int(h[i:i+2], 16)/255 for i in (1, 3, 5)]
    f = lambda v: v/12.92 if v <= 0.03928 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2])
def cr(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True); return (x+0.05)/(y+0.05)
T = ["paper", "slip"]; TINT = ["good-tint", "bad-tint", "warn-tint", "review-tint", "brand-tint"]
checks = []
for fg in ["ink", "ink-muted", "link", "review", "good", "bad", "warn"]:
    for bg in T: checks.append((fg, bg, 4.5))
for fg in ["ink", "ink-muted"]:
    for bg in TINT: checks.append((fg, bg, 4.5))
checks += [("on-btn", "btn", 4.5), ("on-brand", "brand", 4.5), ("slip", "good", 4.5), ("slip", "bad", 4.5), ("slip", "review", 4.5),
           ("good", "good-tint", 4.5), ("bad", "bad-tint", 4.5), ("warn", "warn-tint", 4.5), ("review", "review-tint", 4.5), ("brand", "slip", 4.5)]
for bg in T + TINT: checks += [("focus", bg, 3.0)]
for bg in T + ["bad-tint"]: checks += [("edge", bg, 3.0)]
for fg in ["brand", "good", "bad", "review", "warn"]: checks += [(fg, "paper", 3.0)]
banned = {("brand", "paper", 4.5), ("brand", "brand-tint", 4.5)}  # known fails in light, banned for text by rule
bad = 0
for fg, bg, need in checks + sorted(banned):
    for name, th in (("light", light), ("dark", dark)):
        r = cr(th[fg], th[bg]); ok = r >= need
        flag = "ok" if ok else ("BANNED-PAIR" if (fg, bg, need) in banned else "FAIL")
        if not ok and (fg, bg, need) not in banned: bad += 1
        if not ok or "-v" in sys.argv: print(f"{name:5} {fg:11} on {bg:11} need {need} got {r:5.2f} {flag}")
print("unexpected failures:", bad); sys.exit(1 if bad else 0)
