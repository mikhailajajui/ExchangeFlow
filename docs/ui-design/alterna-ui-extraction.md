# Alterna Savings UI extraction: the email-us form page

Page: <https://www.alterna.ca/en/about-us/contact-us/email-us> (HTTP 200, fetched 2026-10-02 with `curl -A 'Mozilla/5.0'`).
Status: **provisional.** The client assumption is DL-N09 and any use of Alterna's colours, name or marks needs Alterna's sign-off (DL-N37). This file records a *system* (rules, values, patterns). No logo, photograph, icon or page copy is reproduced. Quotes of error strings are limited to the few words needed as evidence.

Scope kept to the page and its linked CSS (robots.txt: `User-agent: *`, no Disallow lines; only a Sitemap line). No other pages were crawled, no JS was executed, and the form was **not submitted**.

**Nothing was verified visually.** No browser was available in this session (WebFetch returns text only). Every value below is read from static HTML/CSS. Computed styles, cascade results and rendering are **inferred** and labelled so. Raw downloads live in the session scratchpad, not the repo. Contrast ratios are reproducible with `docs/ui-design/alterna-contrast.py`.

## 1. Sources

| Short name | URL | What it is | Brand or framework |
|---|---|---|---|
| `page` | `/en/about-us/contact-us/email-us` | Server-rendered HTML, Umbraco Forms 13.3 (`/App_Plugins/UmbracoForms/...?v=13.3.0`), no iframe | n/a |
| `frameworks` | `/sb/css-frameworks-bundle.css.v124765` | Bootstrap 4 (`:root{--blue:#007bff;...}`, `a{color:#007bff}`, `.btn:focus{box-shadow:0 0 0 .2rem rgba(0,123,255,.25)}`) plus `.container{max-width:1180px}` | **framework noise** except the container and breakpoints |
| `preload` | `/sb/css-preload-bundle-savings.css.v124765` | `:root` brand tokens, Inter `@font-face`, `.btn-*`, header, footer, `form ...` rules | **brand layer** |
| `sc` | `/sc/988e7158.a7cb776d.875990fe.css.v124765` | Hero/heading carousel only. No form rules | brand, not relevant to forms |
| `rte` | `/media/css/RTE.css` | CMS rich-text | brand, not relevant to forms |
| scripts (named, not fetched) | `aspnet-validation.min.js`, `umbracoforms.min.js`, `https://www.google.com/recaptcha/api.js`, GTM, a Salesforce live-agent deployment script, a Typekit `@import` at the top of `preload` | validation, conditions, captcha, analytics, chat, legacy fonts | third-party |

Method note: `preload` sets `:root{font-size:62.5%}`, so **1rem = 10px** in all Alterna rules below; values are converted to px.

## 2. Evidence table

Confidence: **seen** = literal declaration or markup; **inferred** = cascade or UA default resolved by hand.

### 2.1 Colour

| Value | Role | Selector or file | Framework or brand | Conf. |
|---|---|---|---|---|
| `#bd5a00` | primary brand/action: button fill, nav link text, hyperlink, footer column title, select chevron, radio dot, loader | `preload :root --color-primary-accent-1`; `.btn-primary-orange`, `form .btn`, `header .h-cont ol>li a`, `footer .title`, `form select`, `form input[type=radio]:checked:after` | brand | seen. 33 `var()` uses in `preload` |
| `#974800` | hover/active of orange | `--color-primary-dark-orange`; `.btn-primary-orange:hover`, `form .btn:hover` | brand | seen. 16 uses |
| `#f2decc` | disabled orange, hover tint | `--color-primary-light-orange`; `.btn-*.disable` | brand | seen. 7 uses |
| `#f7931e` | bright orange: mobile-nav selected bar | `--color-primary-accent-2`; `header .m-menu #m-nav .h-card.selected .card-header{border-left}` | brand | seen. 1 use |
| `#3f3f3f` | body/nav/label/footer text | `--color-t-primary` and `--color-tertiary-ash-gray`; `form label.umbraco-forms-label`, `footer`, `header .sub-nav-item` | brand | seen. 29 uses combined |
| `#2a2a3e` | headings | `--color-optimalblack`; `.widget .widget-title` | brand | seen. 6 uses |
| `#212529` | fallback text | Bootstrap `body{color}`; no brand rule overrides `body`, so rich text outside styled widgets (the intro here) uses it | framework, but it is what renders | inferred (cascade) |
| `#f3f1f0` | declared "white3" (our `--paper`) | `--color-white3` | brand | seen **declared, 0 uses** in `preload` |
| `#f4f4f4` | footer background | `--color-background`; `footer{background-color}` | brand | seen |
| `#f9f9f9` | declared app background | `--color-app-background` | brand | seen **declared, 0 uses** |
| `#898989` | form control border | `--color-grey-dark`; `form input.text, form textarea, form select{border:.1rem solid}` | brand | seen |
| `#d8d8d8` | header hairline | `--color-t-line-2`; `header hr{border-top:.1rem solid}` | brand | seen |
| `#d1d4d7`, `#abb5ba`, `#6a7981`, `#68737a` | line, hint, secondary text, muted | `--color-t-line`, `--color-t-hint`, `--color-t-secondary`, `--color-primary-dark-grey` | brand | seen **declared, not used by the form** |
| `#d64033` | field error text | `--color-error`; `form .umbraco-forms-field-wrapper span.field-validation-error` | brand | seen |
| `#2c881b`, `#f2a930` | success, warning (declared) | `--color-success`, `--color-warning` | brand | seen **declared; no success or warning UI on this page** |
| `#000` | focus outline on `.btn-*` variants | `.btn-primary-orange:focus{outline:.3rem solid var(--color-black)}`, others `.25rem` | brand | seen |
| `rgba(0,123,255,.25)` | **focus glow on the form submit** | `frameworks .btn:focus,.btn.focus{outline:0;box-shadow:0 0 0 .2rem rgba(0,123,255,.25)}` | **framework** | seen. Applies because the submit is `input.btn.primary`, not `.btn-primary-orange` (inferred cascade) |
| `#0000b3`, `#4d4dc9`, `#6e6e95`, ... | a second blue/violet set | `preload :root --color-primary`, `-hover`, `--color-secondary` (this later declaration overrides the earlier `#69737a`) | looks like an unused design-system default | seen declared; 2 `var(--color-primary)` uses, none on this page |
| `#007bff`, `#0056b3`, `#dc3545`, `#28a745` ... | Bootstrap defaults | `frameworks :root`, `a`, `a:hover` | **framework noise, not brand** | seen |
| `rgba(0,0,0,.05)`, `rgba(0,0,0,.1)` | shadows | `--shadow-1: 0 10px 30px 0 rgba(0,0,0,.05)`; `--shadow-2` | brand | seen; no shadow is applied to the form |

### 2.2 Typography

| Value | Selector or file | Framework or brand | Conf. |
|---|---|---|---|
| `Inter`, self-hosted TTF in 8 weights (200 to 900), `--font-1:"Inter",sans-serif`; files at `/Content/Styles/Fonts/Inter-*.ttf` | `preload @font-face`, `:root` | brand. Inter is SIL OFL | seen |
| `body` has **no brand font rule**. Bootstrap's stack (`-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,...`) applies to `body` and to anything not inside a rule that names Inter. Controls inherit (`font-family:inherit`). Whether form controls render Inter is therefore **inferred**, not seen | `frameworks body`; `preload` has only 9 explicit `font-family:"Inter"` and 2 `var(--font-1)` uses | framework fallback | inferred |
| Label and legend: 18px, line-height 18px, weight 700, `#3f3f3f`, padding `30px 0 15px` | `preload form label.umbraco-forms-label, form legend.umbraco-forms-legend` | brand | seen |
| Radio option label: 18px/18px, 700, `display:inline`, margin `5px 30px 0 8px` | `form .umbraco-forms-field div label`, `form .umbraco-forms-field-wrapper div label` | brand | seen |
| Control text: 20px desktop, 16px at <=991px; line-height 1.5; weight normal | `form input.text, form select, form textarea{font-size:var(--font-size-xl)...}`, then the `@media screen and (max-width:991px)` rule sets `--font-size-m` | brand | seen |
| Error text: 16px, line-height 1.5, weight 500, `padding-top:10px !important` | `span.field-validation-error` | brand | seen |
| Submit: 18px, 700, line-height 19px, no text-transform ("Submit") | `form .btn{font-size:1.8rem}` over `.btn{font-size:1.6rem;line-height:1.9rem;font-weight:700}` | brand | seen |
| Heading scale (site-wide tokens): h72, h60, h48, h40, **h36** (widget title, 700, `#2a2a3e`), h30, h28, **h24**, h22, h20, lead 18, body 16, caption 14, footnote 12; all line-height 1.5 | `preload :root --font-size-*`, `.widget .widget-title` | brand | seen |
| Bootstrap heading scale (h1 25px ... h6 10px at this root) is **not** reachable in practice because RTE and widget rules override it | `frameworks h1..h6` | framework | seen; effect inferred |
| `<h1 class="accessibilityH1">Email Us</h1>` sits in the banner heading widget; the `.heading--title` rule wins on size/weight/colour | page HTML; `sc .heading-widget` | brand | seen markup; cascade inferred |
| Bold is the default emphasis: nav, footer links, buttons, labels are all 700 | `preload` | brand | seen |

### 2.3 Spacing, layout, shape

| Value | Selector or file | Framework or brand | Conf. |
|---|---|---|---|
| Container `max-width:1180px`, padding 0 16px; `.container{min-width:1024px !important}` (a rule outside any @media block, so the page is desktop-first; whether it is a print-only rule is not determinable here) | `frameworks .container` | framework tuned by Alterna | seen |
| Breakpoints (media queries used, by count in `preload`): `max-width:767px` x26, `991px` x20, `1023px` x6, `1439px` x4, `1199px` x3, `min-width:992px` x1, `min-width:1440px` x1; `--breakpoint-xxl:1440px` | `preload` | brand + Bootstrap grid | seen |
| Form column: `.row.justify-content-center > .col-12.col-md-10`; each field in `.umbraco-forms-container.col-md-12`; controls `width:100% !important`. Effective control width is about 900px at 1440px wide (inferred arithmetic) | page HTML; `form input.text,form textarea,form select{max-width:100%!important;width:100%!important}` | Bootstrap grid | seen markup; width inferred |
| Single column, one field per row; first and last name are stacked, not paired | page HTML | brand | seen |
| Control height 50px (`height:5rem`), textarea 168px (`height:16.8rem`) | `form input.text,form select,form textarea{height:5rem}`, `form textarea{height:16.8rem}` | brand | seen |
| Control border `1px solid #898989`, radius **5px** | `form input.text,form input.title,form textarea,form select` | brand | seen |
| Control padding: none declared for inputs (UA default, inferred ~1px 2px); select `padding` is not declared either in the rule I read | no `padding` in the input rules | n/a | inferred |
| Select: native arrow removed, two orange gradient triangles (7px) as the chevron, white 2.5em patch at the right edge | `form select{background:linear-gradient(45deg,...),...}` | brand | seen |
| Radio: `appearance:none`, 25x25px, `::before` draws `/Content/Styles/Images/radio_checked.svg` (not fetched), checked `::after` is a 15px `#bd5a00` dot, `border-radius:50%`. Options render as `inline-flex`, so a "vertical" list renders side by side (inferred) | `form input[type=radio]`, `:checked:after`, `form .umbraco-forms-field-wrapper div{display:inline-flex!important}` | brand | seen; layout inferred |
| Vertical rhythm per text field: 30 (label top) + 18 + 15 + 5 + 50 = about 118px (inferred sum) | label rules | brand | inferred |
| Submit: pill `border-radius:25px`, padding `10px 24px` (<=991px: `10px 18px`), `margin-top:50px`, fill `#bd5a00`, text white, `border:0`, left aligned, auto width | `preload .btn`, `form .btn` | brand | seen |
| Hover: bg `#974800`. Active: no brand rule. Focus: see 2.5. Disabled: none on this form | `form .btn:hover` | brand | seen |
| Buttons elsewhere: `.btn-primary-orange` (fill), `.btn-secondary-orange` (1px outline, transparent), `.btn-hyperlink` (text + arrow), white variants on photos; disabled = `#f2decc`; **no destructive variant** | `preload .btn-*` | brand | seen |
| Header: white, min-height 72px (70 at <=991), `position:relative`, `z-index:999`; top utility bar 43px with search, language, Find us, Contact us; collapses when `body.scrolled` (JS) so stickiness is **not determinable** | `preload header`, `header .top-bar`, `body.scrolled .top-bar` | brand | seen; behaviour unknown |
| Nav: links 16px (14 at <=991) 700 `#bd5a00`; hover/focus/selected = `#3f3f3f` text with a **4px `#bd5a00` bottom border**; sub-nav row under an `hr` | `header .h-cont ol>li>a`, `a.selected`, `.sub-nav-item` | brand | seen |
| Header CTAs: "Join Alterna" (`btn-secondary-orange`) and "Log In" (`btn-primary-orange`), pills | page HTML | brand | seen |
| Footer: `#f4f4f4`, padding `60px 0 50px`, 14px text `#3f3f3f`; column titles 22px 700 `#bd5a00`; links 14px 700 with 24px gap, underline on hover; a bottom strip (12px) with copyright and legal-type links; social icons and app badges | `preload footer`, `footer .title`, `footer .link-block .footer-link` | brand | seen |
| Radii seen: 25px pill buttons, 17.5px search, 5px controls, Bootstrap `.25rem` = 2.5px cards. Shadows: tokens only (`0 10px 30px rgba(0,0,0,.05)`); the form uses none | `preload` | brand | seen |
| A full-page spinner (`.loader-container`) is inline-styled on every page; `:root{scroll-behavior:smooth}`; `prefers-reduced-motion` appears in `frameworks` (Bootstrap) and **nowhere in `preload`** | `preload :root`; page inline `<style>` | brand | seen |

### 2.4 Dividers and surfaces

White page and white header; footer `#f4f4f4`; header separated from the body by a 1px `#d8d8d8` rule; no card chrome around the form (fields sit directly on white); field groups are separated only by the label's 30px top padding (no rules or panels). Seen.

### 2.5 Focus indicators (observed)

| Element | Indicator | Evidence |
|---|---|---|
| Text input, textarea, select, radio | **No author rule.** Browser default ring (Chrome draws a 2px auto outline) | no `:focus` selector under `form ...` in `preload`; inferred UA behaviour |
| Form submit (`input.btn.primary`) | Bootstrap 2px pale-blue glow, `rgba(0,123,255,.25)`, outline removed. Blended on white = `#bfdeff`, **1.39:1** | `frameworks .btn:focus`. **Fails WCAG 1.4.11** (non-text 3:1) |
| `.btn-primary-orange`, `.btn-secondary-orange`, `.btn-hyperlink`, hero links | `outline: .25 to .3rem solid #000` (2.5 to 3px, no offset), 21:1 on white | `preload .btn-*:focus` |
| Header nav | Underline only (`border-bottom:.4rem solid #bd5a00` on `:focus`) | `preload header .h-cont ol>li>a:focus` |
| Header `button` | `button:focus:not(:focus-visible){outline:0;box-shadow:none}` and `button:focus-visible{outline-offset:.1rem}` | `preload` |

### 2.6 Accessibility observations

| Observation | Evidence | Verdict |
|---|---|---|
| `<html lang="en">`, one `<h1>` (class `accessibilityH1`), `<main id="skip-nav">`, `<footer id="skip-main">` | page HTML | good |
| Skip links "Main Content" and "Footer Navigation" exist in the markup. They are off-screen until JS adds `.skiplinks-focus`, and **removed (`display:none`) at <=1023px** | `preload .skiplinks`, and the `@media screen and (max-width:1023px)` blocks | partial: desktop only (inferred JS toggle) |
| Every input has a `<label for>`; radio groups use `fieldset` + `legend` (6 fieldsets, 3 legends); required inputs carry `aria-required="true"` (6) | page HTML | good |
| Required marker is a literal `*` in `span.umbraco-forms-indicator`, **no rule styles it** (inherits 18px bold `#3f3f3f`), not `aria-hidden`, and there is **no "* required" legend** anywhere on the form | page HTML; grep of CSS: 0 rules | weak: a screen reader says "star"; the key to the symbol is missing |
| Error pattern: 11 empty `span.field-validation-valid[role="alert"]` placeholders, one per field and one per radio group; message is injected on validation. **No `aria-describedby` or `aria-invalid` anywhere in the form**, no error summary | page HTML (0 hits for both attributes) | weak: each message is announced, but not tied to its control; no overview |
| Invalid control styling: `aspnet-validation` adds `.input-validation-error`, but **no CSS targets it** (0 hits), so the border stays grey. Error is red text under the field, no icon | CSS grep | colour-only plus text; borderline |
| Radio custom drawing: `appearance:none` with an SVG `::before` and a 15px dot | `preload` | target 25px is good; the drawing is unverified (SVG not fetched) |
| No `autocomplete` attributes (0), email and phone are `type="text"` (not `email` / `tel`), no `inputmode` | page HTML | weak (WCAG 1.3.5 identify input purpose for name/email/phone) |
| No placeholders, no helper or hint text on any field | page HTML (0 `placeholder` in the form) | neutral |
| Honeypot: hidden `input type="text"` inside `div.umbraco-forms-hidden[aria-hidden="true"]` | page HTML | spam control |
| Captcha: Google reCAPTCHA v2 checkbox, labelled "Before submit please complete the Captcha", marked required | page HTML | third-party; a known accessibility burden |
| Language toggle link: `<a class="contents btn-culture" data-culture="fr" href="/fr/a-propos/nous-joindre/envoyez-nous-un-courriel" aria-label="Change to Français language">` with visible text "FR" and a second label "Français" that is `width:0` until `:hover` (no `:focus` reveal rule) | page HTML; `preload header .top-icons .wrapper-icon:hover .contents .label` | the visible text "FR" is not contained in the accessible name (WCAG 2.5.3 Label in Name risk); the label is not keyboard-revealed; no `lang="fr"` on the link text |
| Decorative icons are `aria-hidden="true"`; footer social images use `alt=""` inside links that have **no accessible name** other than the URL | page HTML | footer social links fail "link purpose" (inferred from empty alt and no aria-label) |
| Contrast: see section 3 | `alterna-contrast.py` | label, body, button text, error and control border pass; submit focus glow, orange on `#f4f4f4`/`#f9f9f9`, `#abb5ba` hint and amber warning fail |

### 2.7 Bilingual behaviour (EN/FR)

- Language is chosen by **a separate URL per language with translated slugs**: EN `/en/about-us/contact-us/email-us`, FR `/fr/a-propos/nous-joindre/envoyez-nous-un-courriel` (from the toggle's `href`). The `<html>` carries `lang="en"`; no `hreflang` alternates were found in the head, only `<link rel="canonical">`.
- The toggle sits in the top utility bar (desktop only; `d-none d-md-flex`). It shows the **target** language: "FR" in a small badge, expanded to "Français" on hover. The accessible name is in English.
- Form strings are CMS content per language ("Contact form EN" is the form name, with a separate captcha field named `captchaen`), so validation messages come from `data-val-*` attributes rendered per language. The FR page was **not fetched** (scope), so its labels, error wording and spacing are unknown.
- Layout implication seen in CSS: nothing fixed-width in the form (all `100%`), which is what makes French text length safe.

### 2.8 Form pattern, field by field (what it does)

1. Intro paragraph (centred, 18px base with author spans enlarged to 22 to 25px) says a reply comes within 2 business days, then a plain-text "Reminder" not to send personal or account information by email and to log in to Online Banking first. No box, no icon.
2. Fields in order: Do you require a response? (radio, Yes preselected) -> First Name* -> Last Name* -> [conditional group: Business/Organization Name, Preferred Contact Method* (radio), Email* or Phone* shown by the radio, Do you bank with Alterna today? (radio)] -> Subject* (select, empty first option, 8 options) -> Message* (textarea) -> captcha* -> Submit. Fieldset conditions are serialized in `data-serialized-fieldset-conditions` / `data-serialized-field-conditions` (progressive disclosure; hidden items get `.umbraco-forms-hidden{display:none}`).
3. Labels always above controls; required = trailing `*`; optional fields have no marker (so the default is "optional unless starred").
4. Validation is client-side (`aspnet-client-validation`) on submit, with per-field messages written as a polite request ("Please enter your first name.", "Please enter a valid email address."). The message set contains a typo on the live page, which suggests no copy QA.
5. Submit: one button, generic word "Submit", 50px below the last field; no secondary or cancel action.
6. Confirmation: **not observed** (form not submitted). Umbraco Forms normally swaps in `.umbraco-forms-submitmessage` or redirects; there is no CSS for it (0 hits), so it would render as plain body text (inferred).

## 3. Contrast results (WCAG 2.1, computed)

Full list: `python3 docs/ui-design/alterna-contrast.py`. Highlights:

| Pair | Ratio | Result |
|---|---|---|
| `#3f3f3f` on `#fff` (labels, body) | 10.53 | AA |
| `#2a2a3e` on `#fff` (headings) | 14.01 | AA |
| White on `#bd5a00` (submit and all primary buttons) | 4.54 | AA by 0.04 |
| `#bd5a00` text on `#fff` (nav, hyperlinks) | 4.54 | AA by 0.04 |
| `#bd5a00` on `#f4f4f4` (footer titles) | 4.13 | AA for large text only (22px bold) |
| `#bd5a00` on `#f9f9f9` | 4.31 | **fails** for small text |
| `#d64033` error on `#fff` | 4.53 | AA by 0.03; **3.71 on a pink tint, 4.30 on `#f9f9f9`** |
| `#898989` control border on `#fff` / `#f4f4f4` | 3.50 / 3.18 | passes 3:1 (non-text) |
| `#bd5a00` chevron and radio dot on `#fff` | 4.54 | passes 3:1 |
| `#000` focus outline on white / on orange | 21.00 / 4.63 | passes |
| Submit focus glow `#bfdeff` on `#fff` | **1.39** | **fails** 3:1 (WCAG 2.4.7, 1.4.11) |
| `#abb5ba` hint on white (declared, unused) | 2.09 | fails |
| `#f2a930` warning on white (declared, unused here) | 2.00 | fails |
| `#6a7981` secondary on `#f4f4f4` | 4.09 | fails (on white 4.50 passes) |
| Disabled `#fff` on `#f2decc` | 1.30 | exempt (disabled), but shows the pattern is purely tonal |

Alterna problems found on this page, in order of severity: (1) form submit focus indicator 1.39:1 (framework default leaking through because the class is `btn primary`, not `btn-primary-orange`); (2) inputs and radios rely on the UA focus ring; (3) errors are not programmatically tied to controls and no summary exists; (4) "FR" toggle's accessible name omits the visible text; (5) skip links disabled at <=1023px; (6) orange text is on the AA line (4.54) on white and fails on their own footer and app greys.

## 4. Adopt / adapt / reject

Our constraints: WCAG 2.1 AA via `contrast.py`; status never colour-only; orange is accent-only and never a status; self-hosted fonts; no inline styles; no third-party requests; restricted-topic copy rules; "slip and ledger" (square-ish, flat, ruled, mono figures).

| Item | Alterna | ExchangeFlow decision | Reason |
|---|---|---|---|
| Typeface | Inter, self-hosted | **Adopt** (already) | Same family, OFL; keep `@fontsource`, not their TTF files |
| Base unit | 62.5% root, 1rem = 10px | **Reject** | Breaks user font-size scaling expectations in a tool; we keep 16px root and rem math |
| Body size | 16px, labels 18px | **Adapt**: body 15px, labels 14px/600 | Density for desks; both exceed the 12px floor. Letter-count budget for French holds |
| Heading style | 36px/700 `#2a2a3e`, line-height 1.5 | **Adapt**: 24px/600/1.2 navy | Same navy and sentence-case; smaller, tighter for an app |
| Text colour | `#3f3f3f` body, `#2a2a3e` headings | **Adapt**: one ink `#2A2A3E` for both | 14.01 on white (vs 10.53) and 12.44 on paper; fewer values. Corrects our earlier wording, "navy as body ink" |
| Primary button | orange pill, 25px radius, white text 4.54 | **Reject** (shape and colour) | Orange is accent-only, and a 0.04 margin is brittle; square 2px navy button keeps hues free for status. Brand fill stays an optional decorative variant (existing `.btn.brand`) |
| Button label | Title-ish, generic "Submit" | **Reject** | Verb-specific "Submit request" (copy rules) |
| Button padding/weight | `10px 24px`, 700 | **Adapt**: 0 16px, 40px tall, 600 | Density. Weight 600 is a Inter static step already shipped |
| Button hover | defined darker shade (`#974800`) | **Adopt the principle** | Hover changes colour deterministically; ours is `brightness(1.15)` on navy, secondary gets `--rule` fill |
| Button focus | black 2.5 to 3px outline, no offset (`btn-*`), but blue 1.39:1 glow on form submit | **Keep ours**: 3px `--focus` outline, 2px offset, on every control | Theirs is inconsistent and one variant fails. Width (3px) already matches theirs |
| Input border | 1px `#898989` (3.50:1 on white, 3.18 on `#f4f4f4`) | **Adapt**: `--edge` `#7A7470` | Ours is darker, passes 3:1 on paper, slip and the error tint (3.0 checked in `contrast.py`) |
| Input radius | 5px | **Reject**; keep 2px | Slip/ledger squareness; radius is not an accessibility issue |
| Input height | 50px, 20px text (16px mobile) | **Adapt**: 40px, 15px | Dense desk use; 40px is above the 24px target minimum |
| Label position | above the control | **Adopt** (already) | Same reason: French length, no fixed widths |
| Label spacing | 30px above, 15px below | **Reject** | Too airy for a ledger; ours is 16px between fields, 4px label-to-control |
| Required marker | trailing `*`, unstyled, no key | **Reject** | Our rule is the reverse (required is default, optional says "(optional)"), which needs no symbol and no legend |
| Helper text | none | **Keep ours** | Hints at 13px `--ink-muted` (checked) are useful on a slip |
| Error text | 16px/500 `#d64033`, plain text below | **Adapt** | Keep position and plain wording; use `--bad` `#B3261E` (6.54 on white, passes on `--bad-tint`) with "!" mark, 2px border and tint, `aria-describedby`, `aria-invalid`, plus an error summary. Theirs is 3.71:1 on a tint and has no summary |
| Error wording | polite request, "Please enter a valid email address." | **Adapt** | Say what and how, sentence case, no "Please" (our copy section 6), no field-name guessing |
| Per-field `role="alert"` | on 11 empty spans | **Reject** | Many announcements. Use one summary that takes focus, plus `aria-describedby` |
| Radio | 25px, orange 15px dot, inline | **Adapt**: 24px, `--edge` border, **ink** dot, vertical list in `fieldset`/`legend` | Orange for a selected state would break "accent only"; dot shape (not colour) shows selection; fieldset/legend semantics adopted |
| Select | 50px, orange gradient chevron | **Adapt**: 40px, chevron in ink (CSS gradient with `currentColor`) | Same technique, ink colour, no image request |
| Textarea | 168px, vertical resize | **Adapt**: min 96px, vertical resize | Density |
| Form width | about 900px fields (col-md-10) | **Reject** | Slip is 36rem (576px): shorter scan path, sits beside the rail on wide screens |
| Field order / conditional reveal | radio drives show/hide of fields | **Adopt the pattern** | Conditional field appears directly after its trigger; hidden fields are not validated and are `display:none`, not off-screen |
| Captcha | Google reCAPTCHA v2 | **Reject** | Third-party request; the app is authenticated, internal. Rate limiting and session handle abuse |
| Honeypot | hidden text input | **Reject** | Not needed behind sign-in |
| Consent | none on the form; a plain "Reminder" paragraph before it | **Adapt** | We already put "Do not type names or account numbers" as a hint under free-text fields; no extra consent control |
| Submit confirmation | not observed | **Keep ours** | Outcome docket and stamp |
| Header | white, 72px, utility bar, orange nav text with 4px underline | **Adapt**: 48px white bar, ink nav text, 3px orange underline on the current page only | Orange text fails on paper; underline is non-text (4.54 on white) and carries no status |
| Header CTAs | "Join" and "Log In" pills | **Reject** | Not an app pattern |
| Language toggle | top bar, "FR" badge plus "Français" on hover; separate URLs | **Adapt** | Always-visible word "Français" (no hover reveal), `lang="fr"` and `hreflang` on the control, accessible name contains the visible text; one URL with a per-user setting (SPA, DL: fr-CA open) |
| Footer | `#f4f4f4`, 60px padding, orange 22px titles, social, apps | **Adapt** (only the legal strip) | One 13px muted line on paper with "Accessibility" and "Privacy" (targets `[TBD-Stakeholder]`) and the app version; no social, no orange titles (4.13 on grey) |
| Shadows | card shadows, soft 10/30 tokens | **Reject** | Slip/ledger is flat; only dialogs get a lift |
| Page loader and smooth scroll | spinner, `scroll-behavior:smooth`, no reduced-motion rule in `preload` | **Reject** | Our only motion is the stamp, and `prefers-reduced-motion` is honoured |
| Skip links | present, desktop only, JS toggled | **Adopt, improve** | CSS-only `:focus` reveal at all widths (already in 8) |
| Third-party scripts and styles | Typekit `@import`, GTM, reCAPTCHA, chat | **Reject** | No third-party requests, CSP `'self'` |

## 5. Reconciliation with `visual_design/`

The product owner's earlier extraction is `visual_design/alterna.md` and `alterna.tokens.json` (dated 2026-09-23, same page among others) and an app design for a *different* product (the COB calculator) in `app-ui.md` and `app-ui.tokens.css`. I treated these files as data, did not edit them, and re-checked every value I could against the live CSS and HTML.

### 5.1 Agree (re-verified live)

All of these match: `#bd5a00`, `#974800`, `#f2decc`, `#f7931e`, `#3f3f3f`, `#2a2a3e`, `#898989`, `#d64033`, `#f4f4f4`, `#f9f9f9` (declared, unused), `#d8d8d8`; `html` 62.5%; Inter self-hosted with 8 weights; label 18px/700 `#3f3f3f` with `30px 0 15px`; input 50px, 1px `#898989`, 5px radius, 20px text (16px at <=991); textarea 168px; select with two orange gradient triangles; radio 25px with a 15px orange dot; error 16px/500 `#d64033` with 10px top padding; submit pill, `10px 24px`, 18px/700, `margin-top:50px`, hover `#974800`; container 1180px; focus on `.btn-primary-orange` is a 3px black outline; header 72px; footer `#f4f4f4`, `60px 0 50px`; no helper text or placeholders; no CSS for `.input-validation-error` or `.umbraco-forms-submitmessage`; the form submit's focus is Bootstrap's 2px blue glow (1.39:1). Their correction of the earlier checkbox claim (cookie modal, not Umbraco Forms) also stands: I found no checkbox on this form.

### 5.2 Differ or added (this extraction)

| Topic | `visual_design/` | Here (live, 2026-10-02) | Adopted |
|---|---|---|---|
| Skip links | not mentioned | present in markup, JS-toggled, `display:none` at <=1023px; `<main id="skip-nav">`, `<footer id="skip-main">` | mine (added) |
| ARIA on the form | not recorded | `aria-required="true"` x6; no `aria-describedby`, `aria-invalid`, summary; 11 `role="alert"` spans; 6 fieldsets, 3 legends | mine (added) |
| `autocomplete`, `type=email/tel` | email and phone `type="text"` noted | also 0 `autocomplete` attributes and no `inputmode` | mine (extends) |
| Language toggle | listed as a header item only | link text "FR", hover-revealed "Français", English `aria-label`, separate translated URL, no `hreflang` | mine (added; section 2.7) |
| Footer | "accessibility links separated by `|`", "font-size changer (A A A)" | bottom strip is Legal, Deposit Insurance, Privacy & Security, Accessibility, Alterna Bank; **no font-size changer was found in this page's HTML** (it may exist on other pages) | mine for this page; theirs not re-verifiable here |
| Third parties | reCAPTCHA, Typekit noted | also GTM, a Salesforce live-agent script | mine (extends) |
| Page banner and h1 white-on-image | recorded, contrast unverified | confirmed markup (`h1.accessibilityH1` in the heading widget); contrast still unverified (image not fetched, policy) | same |
| Control input font | 20px desktop, Inter | 20px desktop confirmed; the **family is inferred**: `body` falls back to Bootstrap's system stack, and Inter is named in only 9 `font-family` declarations, so controls may render in the system font. They state Inter; I could not verify it | open |
| `.container{min-width:1024px !important}` | not mentioned | outside any @media block in `frameworks` (my parse); likely a legacy desktop-only rule. Uncertain | noted |

No value conflicted outright. Where wording differs ("Inter on inputs"), I kept their claim as plausible and flagged mine as the stricter reading.

### 5.3 Does `app-ui.md` / `app-ui.tokens.css` already define a theme we should reuse?

It defines a coherent theme, but for the COB calculator (a stateless public-style tool), not for ExchangeFlow, and its choices deliberately mirror Alterna rather than adapt it:

| Aspect | `app-ui.tokens.css` | `docs/ui-design/tokens.css` |
|---|---|---|
| Page and surface | `--paper #ffffff`, `--paper-raised #f9f9f9` | `--paper #F3F1F0` (warm grey ground), `--slip #FFFFFF` (sheet) |
| Text | `--ink #3f3f3f`, `--heading #2a2a3e` | one `--ink #2A2A3E` |
| Accent | `--accent #bd5a00` as button fill, links and focus border | `--brand #BD5A00` accent only; navy button; indigo link |
| Buttons | pill, 25px (`--radius-pill`) | square, 2px |
| Controls | 5px radius, 44px, `#898989` border | 2px, 40px, `#7A7470` |
| Focus | 3px black, 2px offset | 3px navy, 2px offset |
| Status | `--invalid #d64033` (text only on white), `--success #2c881b` | `--bad #B3261E`, `--good #1B6B3D`, plus warn and review; each with a shape |
| Dark | own design (`#17191c` base, `#f7931e` accent) | own design (`#1C1C28` base, `#F7931E` brand) |

Decision: **do not share a token file.** The names collide (`--paper`, `--ink`, `--ink-muted`, `--rule`, `--focus`, `--accent` vs `--brand`) but values and meaning differ, so importing both would silently restyle one app. Align by *source*, not by file: both apps cite the same Alterna values (`#bd5a00`, `#f2decc`, `#f7931e`, Inter, a 3px/2px focus ring, 16px field gap logic), and both reject the same failures (orange text on `#f9f9f9`, `#abb5ba` hints, the 1.39:1 glow). If both ever ship in one shell, namespace one set (for example `--ef-*`) or keep them as separate bundles. Two things from `app-ui.md` are worth keeping in mind for us and are already consistent: a labelled error summary at the top with field links (their K9, our 5.2) and a rule that orange text sits on pure white only (their K11, our 3.2).

## 6. What could not be determined

- **Any visual check.** No browser; no computed styles, rendering, hover/focus screenshots, or real field widths.
- **The success/confirmation message** and **live validation timing** (the form was not submitted; no CSS exists for the submit message).
- **The French page** (out of scope): FR labels, error text, and FR layout.
- **Whether controls render in Inter** or Bootstrap's system stack (inferred, see 5.2).
- **`radio_checked.svg`** drawing and colour (referenced, not fetched), and the banner image behind the h1 (white-on-image contrast).
- **Header stickiness** (JS sets `body.scrolled`; CSS is `position:relative`).
- **Input padding and text colour** (not declared; UA defaults).
- **Whether `.container{min-width:1024px}` applies at all widths.**
- **Brand sign-off and whether Alterna is the client** (DL-N09, DL-N37). Colours and patterns here are public-site observations, not a brand guide.
