#!/usr/bin/env python3
"""Contrast of values OBSERVED on alterna.ca (email-us page, CSS bundles /sb/css-preload-bundle-savings.css.v124765 and
/sb/css-frameworks-bundle.css.v124765, fetched 2026-10-02). Informational: these are Alterna's pairs, not ours; ours are in contrast.py.
Run: python3 docs/ui-design/alterna-contrast.py"""
def lum(h):
    h = h.lstrip('#'); h = ''.join(c*2 for c in h) if len(h) == 3 else h
    c = [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
    f = lambda v: v/12.92 if v <= 0.03928 else ((v+0.055)/1.055)**2.4
    return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2])
def cr(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True); return (x+.05)/(y+.05)
P = [  # name, fg, bg, need, where
 ("label/body text #3f3f3f on white", "3f3f3f", "fff", 4.5, "form label.umbraco-forms-label; --color-t-primary"),
 ("fallback body #212529 on white", "212529", "fff", 4.5, "Bootstrap body"),
 ("heading #2a2a3e on white", "2a2a3e", "fff", 4.5, ".widget-title"),
 ("button text white on #bd5a00", "fff", "bd5a00", 4.5, "form .btn, .btn-primary-orange"),
 ("button hover white on #974800", "fff", "974800", 4.5, ".btn:hover"),
 ("orange link text on white", "bd5a00", "fff", 4.5, "header nav a, a.hyperlink"),
 ("orange link text on #f4f4f4", "bd5a00", "f4f4f4", 4.5, "footer .title is 22px bold = large text (3.0)"),
 ("orange on #f9f9f9 (app bg)", "bd5a00", "f9f9f9", 4.5, "--color-app-background"),
 ("error text #d64033 on white", "d64033", "fff", 4.5, "span.field-validation-error"),
 ("error text #d64033 on a pink tint #f9e4e1 (ours)", "d64033", "f9e4e1", 4.5, "hypothetical: would fail"),
 ("error text #d64033 on #f9f9f9", "d64033", "f9f9f9", 4.5, "hypothetical"),
 ("success #2c881b on white", "2c881b", "fff", 4.5, "--color-success (declared, unused on this page)"),
 ("warning #f2a930 on white", "f2a930", "fff", 4.5, "--color-warning (declared)"),
 ("hint #abb5ba on white", "abb5ba", "fff", 4.5, "--color-t-hint (declared, unused on form)"),
 ("secondary text #6a7981 on white", "6a7981", "fff", 4.5, "--color-t-secondary"),
 ("secondary text #6a7981 on #f4f4f4", "6a7981", "f4f4f4", 4.5, "hypothetical"),
 ("control border #898989 on white", "898989", "fff", 3.0, "form input.text border (non-text)"),
 ("control border #898989 on #f4f4f4", "898989", "f4f4f4", 3.0, "hypothetical"),
 ("select chevron / radio dot #bd5a00 on white", "bd5a00", "fff", 3.0, "form select, radio:checked:after (non-text)"),
 ("black focus outline on white", "000", "fff", 3.0, ".btn-primary-orange:focus"),
 ("black focus outline vs orange button", "000", "bd5a00", 3.0, ".btn-primary-orange:focus"),
 ("form submit focus glow #bfdeff vs white", "bfdeff", "fff", 3.0, "frameworks .btn:focus (rgba(0,123,255,.25) blended on white)"),
 ("disabled: white on #f2decc", "fff", "f2decc", 4.5, ".btn-primary-orange.disable (exempt, but shows intent)"),
 ("Bootstrap default link #007bff on white", "007bff", "fff", 4.5, "frameworks a (framework noise)"),
]
for n, f, b, need, w in P:
    r = cr(f, b); print(f"{r:5.2f}  need {need}  {'ok  ' if r >= need else 'FAIL'}  {n}   [{w}]")
