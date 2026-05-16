# Team review — 9F Data Centers website rebuild (UI + UX)

**Date:** 2026-05-15
**Target slug:** website-rebuild-ui-ux
**Personas:** ui_brand_systems_lead, ux_agency_lead
**Dispatch:** persona-injection (parallel)

## Brief

Two-persona (UI + UX) review of the rebuilt 9F Data Centers website after executing `9f_website_feedback_execution_brief.md` end-to-end in one session. The brief was driven by `WEBSITE PAGE FEEDBACK.docx` from the stakeholder and the brand standards in `9F_BRAND_STANDARDS.md`.

**Files / surfaces reviewed:**
- `/Users/noahcott/9f/index.html`
- `/Users/noahcott/9f/styles.css`
- `/Users/noahcott/9f/app.js`
- Served at `http://localhost:8765/index.html`

**Known context / deferrals:**
- Cut sections (gone): WHY IT MATTERS, FROM STATE TO SITE (archetype), IMPACTS, SCIENCE BEHIND 9F (team).
- Kept + renumbered: 01 Inventory · 02 FilterStudio · 03 MATRIX · 04 H.E.A.A.L.
- Global brand pass replaced teal/cyan/violet/lime accents with the 9F palette (`#004174` / `#0A74D6` / `#6BA6F1` / `#B2CCEE` / `#122035` / `#FFFFFF`); H2s shifted to uppercase per brand spec; threshold bin colors from §6 tokenized.
- FilterStudio rebuilt: case study (Iron Mountain · Microsoft) × filter (Camfil · H&V · Compare) × operating-year scrubber, simpler building archetype, three stacked charts, six-tile delta zone, statewide $39.9M finding retained.
- MATRIX rebuilt: 4-step pipeline + bottom example readout cut, replaced with two-up real-building figure + decision-matrix grid ticking on a 500 ms cadence.
- H.E.A.A.L. rebuilt: platform-fidelity composition (building plot left, time series + space-time map right, floor + parameter toggles).
- CTA replaced with three brand-URL buttons (Contact us · Our experts · Read about our work).
- Scrollspy rewritten from visibility-based IntersectionObserver to position-based scroll handler (symmetric up/down).
- Performance + cross-browser screenshot QA NOT performed in this pass.

---

## ui_brand_systems_lead — UI (typography / spacing / brand)

### 1. Overall verdict

The brand swap mostly landed: the page now reads as a coherent dark-blue 9F surface, the chip/intent/eyebrow vocabulary is genuinely consistent across all four sections, and the cut to four numbered sections gives the page real spine. But the typography system has two unresolved fights — (a) the brand wants Avenir for logo/UI and Century Gothic for body, but the page mounts Inter/Space Grotesk/JetBrains Mono fonts via Google Fonts and never actually downloads Avenir or Century Gothic, so on any machine without those locally installed the page renders in Inter, not 9F; (b) the H2 uppercase rule is fine for short titles but breaks readability on the long ones ("VIRGINIA DATA CENTER INVENTORY", "WATCH THE AIR. SCORE THE BUILDING.") because letter-spacing is set to `0.005em` — uppercase needs positive tracking. Color discipline is mostly clean; the residue of "tech-graph" aesthetic survives in three places worth fixing.

### 2. Top strengths

- **Chip vocabulary is genuinely unified.** Same chip primitive (`styles.css:314`) drives map filters, FilterStudio case/filter, H.E.A.A.L. floor/parameter. Active state is a single rule (`styles.css:339-343`): transparent bg, accent text, accent border. No three-flavor mess.
- **Intent Block is doing real system work.** Used identically on inventory map (`index.html:138`), FilterStudio (`index.html:271`), and H.E.A.A.L. (`index.html:412`). Two-column "prompt | live state" reads consistently across all three.
- **Tabular numerics are enforced as a single token.** `styles.css:108-114` whitelists every metric site-wide (`.proof__num`, `.counter`, `.fs__delta-v`, `.kv dd`, `[data-countup]`) — digits will not wobble during count-up. This is the kind of system-level discipline most brand passes never bother to make.
- **Threshold bin colors are tokenized cleanly.** `--bin-optimized` through `--bin-limit` (`styles.css:17-21`) match brand §6 exactly and get used in both `BIN_COLORS` (`app.js:1528`) and the H.E.A.A.L. plot/heat/time-series — same bins, same colors, three different views.
- **Radii pulled to 2-4px.** `--r-sm: 2px` through `--r-xl: 4px` (`styles.css:72-75`). The page reads as an instrument, not a consumer SaaS app. Matches the engineering register the brand wants.

### 3. Top issues

1. **The brand fonts never load.** `index.html:12` only requests Inter / Space Grotesk / JetBrains Mono. `styles.css:66-67` stacks `"Century Gothic", CenturyGothic, "URW Gothic", "Apple Gothic", "Avenir Next", "Inter"...` — but Century Gothic and Avenir are not Google Fonts and are not bundled. On any machine without those system-installed (most Linux servers, many Windows installs, some macOS), the page renders in Inter while the comments and tokens claim Avenir/Century Gothic. The brand standards §2 explicitly call this out: "Do not use 'Century Gothic Pro' as a substitute. Ensure systems (like Adobe or CSS defaults) do not override standard Century Gothic." Right now CSS defaults *are* overriding it. Either (a) self-host Avenir Next + Century Gothic via `@font-face`, or (b) substitute Nunito Sans / Jost (open-source approximations) explicitly and document the swap. Today the brand-fidelity story is a fiction on most machines.

2. **Uppercase H2s with letter-spacing of 0.005em.** `styles.css:129` sets `text-transform: uppercase` with `letter-spacing: 0.005em`. Uppercase Latin needs at minimum 0.04-0.08em tracking to stay scannable; without it, "VIRGINIA DATA CENTER INVENTORY" (`index.html:121`) and "SELECT FILTERS THAT ARE RIGHT FOR YOUR BUILDING." (`index.html:231`) read as a tight crammed wall. The brand spec asks for "Bold, All Caps, 9F Blue" — it does not say tight tracking. Set `letter-spacing: 0.04em` on H2 (or 0.06em at smaller sizes) and the H2 system breathes.

3. **H1 and closing H2 still gradient-clip to silver, not brand blue.** `styles.css:467-470` paints the hero headline with `linear-gradient(180deg, #fff 0%, #c4d2e2 100%)` and clips it to text — silver-on-dark, not a 9F color. Same treatment on the closing CTA H2 (`styles.css:1217-1219`, `#fff → #b9c5d4`). The brand standards say headers are 9F Blue (#004174). On dark backgrounds that rule typically translates to "render in white or in `--brand-light` (#B2CCEE)", but the silver gradient introduces a *fifth* hue that is not in the palette. Either commit to flat white, or use `linear-gradient(180deg, #fff 0%, var(--brand-light) 100%)` so the gradient resolves to a brand color. Today the most prominent two pieces of type on the page are using an off-palette grey.

4. **Primary button contrast on royal blue is borderline.** `.btn--primary` (`styles.css:284-287`) is `background: var(--accent)` (#0A74D6) with `color: var(--brand-white)`. WCAG contrast for #FFFFFF on #0A74D6 is ~4.27:1 — passes AA for large text, *fails* AA for the `.btn--sm` topnav CTA at 0.85rem (`styles.css:282`, "Talk to 9 Foundations") which is below 18pt. The corner brackets (`styles.css:292-297`) make this worse — they steal the eye and the white-on-royal label has nothing additional to stand on. Either deepen to `var(--brand-blue)` #004174 (contrast ~9:1, safe at any size) or boost the small-button label to weight 700 + tighten to fewer pixels of letter-spacing.

5. **The hero/FilterStudio "tech grid" aesthetic still leaks.** `styles.css:454-462` (hero grid) and `styles.css:621-628` (map-canvas grid) layer `repeating-linear-gradient` rules that read as a cyberpunk circuit board rather than a building-physics instrument. The `--bg-2` blue is fine; what makes it feel "AI/tech demo" is the white-on-dark grid lines at 32px and 56px. The brand is healthy buildings × data centers — the visual register should be drafting-paper or instrument-panel, not Tron. Either reduce the grid opacity (currently `rgba(255,255,255,0.04)` and `0.025` — push to 0.015 / 0.012), or replace with a single hairline horizon rule.

6. **`.frame__lbl` letter-spacing is 0.14em on a 0.74rem mono label.** `styles.css:496-502` — uppercase + 0.14em tracking at 11.8px on a Century-Gothic-stack body means the four "EQUIPMENT HEALTH / ENERGY USE / PUBLIC HEALTH / CLIMATE DAMAGES" labels read as separate words rather than a list. At realistic widths each item word-wraps unpredictably because the strip uses flex-wrap (`styles.css:483`). On 1280px viewports this is a single line; on 1100px (which the brand standards §7 explicitly require testing) it wraps into a jagged two-line block.

7. **Delta tiles dialect doesn't match the FilterStudio statewide stats below.** `.fs__delta-v` (`styles.css:921-929`) is `font-size: 1.35rem; font-weight: 700; letter-spacing: -0.012em`. Six tiles in. Twenty pixels below, `.fs__headline-stats b` (`styles.css:996-1003`) is `font-size: 1.2rem; letter-spacing: -0.008em`. Two adjacent metric strips, two different sizes, two different tracking values. The eye notices. Pick one: 1.25rem / -0.01em — and use it for any "supporting-tier metric on a strip."

### 4. Highest-leverage recommendations

- **Add real font files** or pick an explicit free substitute. Recommended: self-host `Avenir Next` and `Century Gothic` via `@font-face` (license-permitting) and drop Inter, Space Grotesk from `index.html:12`. If license blocks Avenir, swap to **Jost** (Avenir-shaped, open) for `--font-display` and **Quicksand** or **Mulish** for `--font-sans`, then update the comment in `styles.css:60-65` to say "intentional Avenir substitute" — but stop claiming Avenir if Avenir isn't loaded.
- **Fix H2 tracking.** Change `styles.css:129` from `letter-spacing: 0.005em` to `letter-spacing: 0.04em`. One-line change, single largest readability win on the page.
- **Retire the silver gradient on hero and closing.** `styles.css:467-470` and `styles.css:1217-1219`. Replace with either flat `color: var(--ink-1)` or a gradient bounded by palette colors (`#fff → var(--brand-light)`).
- **Deepen `.btn--primary` background or guard small-button contrast.** Either change `--accent` button background to `var(--brand-blue)` (#004174) for buttons specifically (keep `--accent` for chart strokes), or remove `.btn--sm` from the primary CTA in the topnav and use `.btn--ghost btn--sm` instead — ghost has higher local contrast on dark.
- **Reconcile metric-strip typography.** Pick one feature-numeric size token for "tile-tier" metrics. Apply to `.fs__delta-v`, `.fs__headline-stats b`, `.hl2__time-val`. Recommended: `font-size: 1.25rem; letter-spacing: -0.01em; font-weight: 700`. Same rule, three call sites, removes the "assembled" feeling in the FilterStudio panel especially.

### 5. What I would watch next

- **Take a screenshot at 1920×1080 with no system fonts installed** (e.g. a clean Linux Chrome). If the page renders in Inter, the brand fidelity claim is on paper only. This is the single most important diagnostic for whether this pass actually landed the typography work.
- **Zoom to 200% on the FilterStudio delta tiles and the headline stats simultaneously.** If `−83 Pa` and `$36.7M` use visibly different font sizes or tracking, the metric-strip system isn't unified yet.
- **Test at 1100px width.** The brief calls out hero `.hero__frame` and the topnav (`@media (max-width: 900px)` hides links at `styles.css:430`) — there's a window between 900-1100px where the topnav still shows links but the hero frame wraps awkwardly and the inventory counters (`styles.css:546-552`) grid-auto-flow column will overflow.
- **Cycle MATRIX through all five scenarios with a stopwatch.** 500ms cadence + 360ms transitions (`app.js:1334, 1416`) means the next tick starts before the prior one settled. The grid will read as "always animating, never resting" — visually noisy. Consider 700-800ms cadence so the eye gets a beat of stillness between scenarios.

### 6. Scorecard

- **Clarity:** 7/10. The four-section spine, the chip vocabulary, and the intent blocks all clarify what the user is supposed to do. Held back primarily by uppercase H2 tracking and the silver gradient on the two largest type elements.
- **Polish:** 6.5/10. Token discipline is excellent (radii, tabular nums, threshold bins, intent block). Polish is dragged down by: brand fonts not loading, two unreconciled metric-strip type styles in adjacent rows, button contrast at small sizes, tech-grid residue in hero/map backgrounds. None are fatal; all are diagnosable token-level changes rather than structural redesigns.

---

## ux_agency_lead — UX (flow / friction / motion)

### 1. Overall verdict

This is a substantially stronger page than what the brief was working with. The four-product spine (Inventory → FilterStudio → MATRIX → H.E.A.A.L.) reads as a single coherent argument — *find the building, pick the filter, simulate the building, verify the building* — and dropping the bridge sections was the right call. The intent blocks are genuinely useful editorial scaffolding. But three of the four sections have specific friction in their control surfaces (FilterStudio timer state, MATRIX cadence, H.E.A.A.L. control density), and the page has a near-universal accessibility hole: chips have no focus state. Feels like a polished v2 with a punch list to clear.

### 2. Top strengths

- **Section spine is clean.** The renumbered 01–04 with eyebrow + lede + visual reads as one product line, not four. Cutting WHY / FROM STATE TO SITE / IMPACTS / SCIENCE BEHIND 9F was correct — the demos *are* the argument now.
- **Intent blocks are doing real work.** At `index.html:138-147`, `271-280`, `412-421`, the "Interaction / Selected · Viewing" annotation gives the user a way to verify "did my click do what I thought" without scanning every chart. This is unusually thoughtful for a marketing page.
- **Inventory hover-vs-commit is correctly tiered** (`app.js:264-285`). Preview on hover, commit on click, side panel reflects both states with different copy ("Previewing on hover · click to select" vs "Selected"). The intent state-v stays bound to the committed record. Most marketing teams would have collapsed both into one event and lost the distinction.
- **FilterStudio's six-tile delta zone is honest about what it's claiming.** The "Building co-benefits" total row spells out "Sum of three avoided cost lines," and the headline `$39.9M` block is explicitly labelled "Statewide finding · 412 modeled sites · Methodology · Harvard CoBE." The relationship between per-building and statewide is legible.
- **The scrollspy rewrite works.** Position-based anchor at 120px (`app.js:81-95`) does what it's supposed to — every Y coordinate maps to exactly one active section, no dead zone. Good fix.

### 3. Top issues

1. **Chips have no focus state.** This is the biggest issue on the page. Every interactive control in FilterStudio, H.E.A.A.L., and Inventory is a `.chip` button (`styles.css:314-343`), and the rule defines `:hover` and `.is-active` but **no `:focus-visible`**. Tab through the page with a keyboard and you cannot see where you are. This affects roughly 15 controls — case study, filter, timer toggle, status filters, system filters, floor, parameter. Same problem on the FilterStudio timer track if you ever make it focusable (you should). Compare to `.skiplink:focus` at `styles.css:145`, which is the only focus rule in the whole stylesheet.

2. **FilterStudio timer behavior is disorienting on the second pass.** Auto-start logic (`app.js:1183-1195`) fires exactly once via `io.disconnect()`. So: scroll in, year plays from month 0 to 12 over 12s, button reads "Restart." Scroll away. Scroll back. Nothing happens — the section is frozen at month 12. The intent block says "Month 12 / 12" which doesn't tell the user *whether they missed something* or whether it's just at rest. Either auto-restart on re-entry (with a slower cadence on subsequent visits) or change the resting copy to something like "Year complete · click Restart to replay." Right now an operator who looks away for 8 seconds returns to a frozen visual and has to figure out what happened.

3. **The H.E.A.A.L. surface asks the operator to track too much in one viewport.** Three chip groups (floor, parameter, score readout) + intent block + building plot + time series + space-time heat map + threshold legend = at least seven competing eyes-on regions, plus the score number floats free with no clear connection to either the chips or the charts beneath. The "Building IEQ 86 / 100" sits at `index.html:402-409` literally inside the same row as the controls, but it's a *consequence* of the controls, not a control. It reads as a fourth chipset on first scan. Pull the score out into its own band above the chart layout, or make it part of the intent block.

4. **Compare ↔ single-filter switch silently leaves the deltas pane populated with the same six numbers.** The deltas are computed off both filters regardless of `state.filter` (`app.js:933-1020`). So when a user clicks "Filter 1 · Camfil," the chips switch, the lines on three charts collapse to one, but the six-tile zone underneath keeps showing the same comparison. There's a comment at `app.js:940-942` acknowledging this ("flagged as 'vs the other filter' so the user knows what they're trading") but the UI does not flag it — the heading is still "Pressure drop −83 Pa" with no "vs Filter 2" annotation. Either gray the zone when a single filter is selected, or visibly retitle it ("If you switch to H&V: …").

5. **MATRIX 500ms tick is too fast for what it's trying to convince me of.** At `app.js:1456`, scenarios cycle every 500ms. That's 2 Hz. The figure caption changes ("Configuration · + Envelope retrofit" → "+ Setpoint tune" → "+ HVAC efficiency upgrade") faster than I can read the label, let alone register the building's color shift and the matrix highlight's move. The pair only *reads* as a coupled simulation if I have time to look from figure to grid and verify they're saying the same thing. Try 1200–1500ms. Or stay at 500ms for the figure cell ripple but hold the scenario for ~1500ms before stepping. (The `cubic-bezier(.2,.8,.2,1)` transitions on `app.js:1314,1334,1416,1427,1433` are 320–360ms each, so two-thirds of every tick is mid-transition — the eye never sees a stable frame.)

6. **The "−" sign on FilterStudio deltas is misleading.** `app.js:970` renders `v: \`−${pressureDelta.toFixed(0)}\`` — hardcoded minus prefix. The numeric value `pressureDelta = p2 - p1` is positive (H&V draws more pressure than Camfil), so a user sees "Pressure drop **−83 Pa**" with sub "Camfil 135 · H&V 218" and has to do the math themselves to figure out the minus is "Camfil saves you 83 Pa vs H&V." Same on PM and energy. A reasonable operator looking at "−83 Pa" alone misreads it as "Camfil is at -83." Replace the hardcoded prefix with a directional label ("Camfil saves 83 Pa") or drop the minus entirely.

7. **Three intent blocks are `aria-live="polite"` and the FilterStudio one updates ~24 times during auto-play.** `index.html:271` and `412` are `aria-live="polite"`. The FilterStudio one rebinds via `redraw()` on every timer tick that produces a 0.05+ month step, so screen-reader users get a flood: "Iron Mountain · Compare · Month 1 / 12 … Month 2 / 12 …" Same problem on `#fs-deltas` at `index.html:315`. Set those to `aria-live="off"` and only announce on a user-initiated change (case / filter / explicit play-pause). Inventory's intent block at `index.html:138` is correctly `aria-live="off"`.

### 4. Highest-leverage recommendations

- **Add a single global `:focus-visible` rule to `.chip`** (and `.btn`, `.topnav__links a`, `#fs-timer-toggle`) in `styles.css`. One block — a 2px accent outline with 2px offset — fixes the entire keyboard-navigation gap.
- **Change FilterStudio timer copy at rest and add re-entry behavior.** When `state.month >= 12 && !state.playing`, the timer label should read "Year 1 complete" not "Month 12 / 12," and the button "Replay year." On re-entering the section after a scroll-away, either auto-replay or surface a clearer rest state. The IO at `app.js:1184-1194` already has the hook — just don't `disconnect()`.
- **Slow MATRIX to ~1200ms per scenario** at `app.js:1456` and give the user a "pause / step" affordance. Even one chip ("⏸ Pause cycle") that maps to the existing `stop()` function would let an operator who wants to read a label actually read it.
- **Gate the FilterStudio delta panel on `state.filter === "compare"`.** When a single filter is selected, either hide the six tiles, or replace them with a single-filter readout ("Camfil at month 7 · 95 Pa · 0.17 µg/m³ · 119 MWh cumulative"). Right now the panel claims to show a comparison while the rest of the section claims to show one filter.
- **Pull `hl2__score` out of the controls row.** It's a result, not a control. Move it onto its own band between the chip row and the chart layout (`index.html:402-409`), styled as a small banner with the same accent. Three controls + one summary read more honestly than four controls of differing function jammed into one grid.

### 5. What I'd watch next

- **Re-test the FilterStudio section with a stopwatch.** First-visit: did the year-scrub auto-play register as "the system is showing me something"? Return-visit after 30 seconds: does the user understand what state the section is in?
- **Keyboard-only sweep through the whole page.** Tab from "Skip to content" all the way to the bottom CTA. Watch where the focus indicator disappears. (Today it disappears the moment you reach Inventory's filter chips.)
- **MATRIX after cadence change.** Does the figure → matrix coupling actually read as one product now? Or does the eye still bounce too much because the two surfaces are spatially far apart (`mx2__figure` left, `mx2__matrix` right)? A faint connecting rule or a synchronized accent flash on commit might help once the speed is right.
- **H.E.A.A.L. score behavior across floors.** Right now switching Floor 1 → Floor 2 → Floor 3 changes the score from 82 → 86 → 91 with a width transition (`app.js:1899`). On a fast switch the bar animates from old to new but the *number* swaps instantly. Whether that reads as authoritative ("the score is 91") or jittery ("the bar disagrees with the number for 900ms") is worth checking on the live site.

### 6. Scorecard

- **Usability: 6/10.** Primary path is legible. Chip focus state missing across the board; FilterStudio timer rest state and delta-panel-in-single-filter both leave the operator unsure what they're looking at.
- **Clarity: 7/10.** Section structure and intent blocks earn the points. Lost on the hardcoded delta signs, the floating H.E.A.A.L. score, and the MATRIX captions changing faster than they can be read.
- **Trust: 7/10.** The page is unusually honest about what's modeled vs measured (the `Sites are modeled as parameterized archetypes` note at `index.html:218-220`, the "Methodology · Harvard CoBE" caption, the per-building vs statewide separation). What costs it points is the delta-sign issue — when a number is presented confusingly, an operator's first read is "do these people know what they're doing," and the answer should never be in doubt.

---

## Cross-reviewer rollup

Both reviewers landed on the same shape: the structural rebuild is right and the system-level scaffolding (chips, intent blocks, threshold tokens, four-section spine) is unusually disciplined for a marketing site — what's blocking a 9/10 is a punch list of token-level details, not a rethink.

- **Strong agreement:**
  - **MATRIX 500ms cadence is too fast.** UI flags it because transitions (320-360ms) consume two-thirds of the tick so no frame is ever stable; UX flags it because captions change faster than they can be read. Single fix: 1200-1500ms cadence + a pause affordance.
  - **The page's typography system over-claims.** UI: Avenir / Century Gothic are stacked but never loaded, so the brand-fidelity story is a fiction on most machines. UX flags the visible side-effect: uppercase H2s read as crammed walls at 0.005em tracking.
  - **FilterStudio's delta zone is structurally wrong in single-filter mode.** UI flags it as inconsistent metric-strip typography between deltas and statewide; UX flags it as a UI/state mismatch (deltas keep showing comparisons when only one filter is selected) plus the misleading hard-coded "−" prefix. Both point at the same panel.

- **Tension / disagreement:** None substantive. UI is most worried about brand-fidelity-as-paper-truth (fonts, gradient, contrast); UX is most worried about user-state-truth (timer rest state, delta-panel state, focus visibility, screen-reader flood). The two lenses are complementary, not contradictory.

- **Unique signals:**
  - UI: the white→silver gradient on the hero H1 and closing H2 introduces a fifth, off-palette hue on the two largest type elements on the page (`styles.css:467-470, 1217-1219`). Single-rule fix.
  - UI: primary button white-on-royal fails AA contrast at `.btn--sm` in the topnav. WCAG-blocking.
  - UX: chips have no `:focus-visible` rule anywhere. ~15 controls invisible on keyboard nav. Single-rule fix.
  - UX: `aria-live="polite"` on the FilterStudio intent block + deltas panel during 12-second auto-play floods screen readers with month-by-month updates. Set to `"off"` and announce only on user-initiated state change.

## How to use this file

Hand the entire file to a meta-reviewer:

> Read this team review. Tell me which findings to prioritize for the next sprint, where reviewers genuinely disagree (vs just having different lenses), and what's missing from the review.

Or feed straight into a follow-up execution brief — the issue list reads as a single-day cleanup punch list (font load, H2 tracking, button contrast, gradient colors, chip focus state, MATRIX cadence, FilterStudio delta state, aria-live).
