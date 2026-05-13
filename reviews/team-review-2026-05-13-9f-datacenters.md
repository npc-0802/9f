# Team review — 9 Foundations Data Centers landing page

**Date:** 2026-05-13
**Target slug:** 9f-datacenters
**Personas:** ux_agency_lead, ui_brand_systems_lead, apollo_product_design_lead, solo_bd_director
**Dispatch:** persona-injection (parallel)

## Brief

A pre-launch review of the single-page static site built for `9fheaal.com/datacenters` — 9 Foundations' marketing surface for its data-center practice. The page introduces three offerings (FilterStudio, MATRIX, H.E.A.A.L.) and a proprietary 412-site Virginia data center inventory, anchored by Joe Allen's Healthy Buildings credentials. Reviewed across four lenses: senior UX, senior UI, a potential customer (Apollo PM), and 9F's revenue-owning BD Director.

**Files / surfaces reviewed:**
- `/Users/noahcott/9f/index.html` — page structure, copy, semantic HTML
- `/Users/noahcott/9f/styles.css` — design system, typography, color, spacing, motion
- `/Users/noahcott/9f/app.js` — D3 VA map, FilterStudio charts, MATRIX heatmap, H.E.A.A.L. dashboard, scroll reveals, particle animations
- `/Users/noahcott/9f/data.js` — 412 VA data center records (skimmed for shape)
- `/Users/noahcott/9f/9f_datacenters_execution_brief.md` — original product brief
- `/Users/noahcott/9f/sr_ux_ui_data_viz_review_brief.md` — design review brief (UX + UI reviewers only)

**Known context / deferrals:**
- Page is pre-launch; team-bio section ships with a placeholder noting bios will be added prior to deployment.
- No real client logos, named case studies, or pricing on the page (per intent — the brief asked for a marketing surface, not a product portal).
- Live page served locally at `http://localhost:8765/`; reviewers worked from source files (could not open the live URL from their environment).

---

## ux_agency_lead — UX (flow / friction / motion)

### 1. Overall verdict

This reads like an ambitious v0.9 of a marketing-meets-data-experience page: the bones of a credible Deloitte-tier story are here — hero proof points, a proprietary VA inventory, a building archetype, three product surfaces, and a CoBE payoff — and the dark/technical visual language holds together. But the experience is doing more *presenting* than *teaching*. Several "interactive" surfaces are decoration, the FilterStudio story (the most important one) buries its own conclusion under five equal pillars and two charts that need a takeaway, and the MATRIX heatmap is the page's most prominent example of "looks analytical, communicates nothing." It's polished enough to ship for a sales conversation; it's not yet at the bar where dense information feels worth exploring on its own.

### 2. Top strengths

- **The hero earns its real estate.** Three proof numbers (`10%`, `~$40M`, `412`) bridge market stakes, value, and proprietary asset in one read. The eyebrow → headline → sub → CTA → proof rhythm is calm and the count-ups have a justifiable role (not just sparkle).
- **Section eyebrows are working hard.** The numbered `01 · Why it matters` / `02 · Proprietary Inventory` pattern gives the page a spine and tells a user where they are in the narrative — exactly the kind of "disciplined grouping" the brief calls out as a Deloitte virtue.
- **The inventory toolbar grouping is right.** Legend on the left, status/system filters on the right, ranges below the map, site detail panel beside it — the *spatial* logic mirrors the *cognitive* logic. The aria-live panel + flagship pre-selection is a thoughtful empty-state replacement; the user lands on data, not on "Hover or tap a site."
- **Reduced motion is actually honored.** Count-ups jump to final, hero canvas renders static, particle loops are gated, scroll behavior reverts to auto. That's rare and it matters.
- **The closing CTA isn't an afterthought.** The grid-backed gradient panel, the specific headline (`leaving savings on the table`), and the mailto with a preloaded subject are concrete enough that someone could actually click them.

### 3. Top issues

- **FilterStudio's primary takeaway is buried under symmetric pillars.** The five `pillar` tiles (Energy / Health / Performance / Society / Dollars) are visually near-equal weight, with `pillar--accent` doing only a soft tint on Dollars. The headline finding of this entire page — `$39.9M / year across VA` — competes with `A wins` / `B wins` deltas in tiny mono-cap labels on every other pillar. A senior user trying to extract "what does this product do for me" in one glance has to assemble it. **Why it matters:** this is *the* product the brief asks you to lead with. Its primary signal needs to be 2–3× louder than its supporting metrics.
- **The Filter A/B/Compare toggle is dishonest motion.** Clicking `Filter A` only fades the Health pillar to `opacity: 0.55`. Clicking `Filter B` fades three pillars. The charts don't change. The pillar numbers don't change. The toggle is advertising "compare two filters" but performs cosmetic emphasis. **Why it matters:** an interactive control that doesn't actually transform the data trains users — within seconds — to distrust the rest of the interactivity on the page. Either make the toggle change the charts/values, or replace it with a static "winners" badge.
- **The MATRIX heatmap is the worst kind of dashboard aesthetic.** The axes read `HVAC efficiency →` and `← Envelope U-value (W/m²K)` with only `Low/High` and `2.7/0.8` at the corners. No legend for color. No annotation of the "best cell." Scenario chips multiply every cell uniformly by `0.985 / 0.992 / 0.975` so toggling between Baseline / Envelope / Setpoints / All barely shifts the field — and the readouts below (`0%`, `1.2%`, `0.6%`, `2.0%`) are the *only* things that actually change. **Why it matters:** the visual is the centerpiece of MATRIX and it teaches nothing. The reader can't tell where the win is, what shape the tradeoff has, or what changing setpoints actually *does* to the surface. This is "beautiful but unhelpful" from the brief's anti-pattern list.
- **H.E.A.A.L. sensor grid randomizes on every floor toggle.** Switching Floor 1 / 2 / 3 calls `paintGrid()` which re-rolls every cell from a stateless `rand()`. The Building IEQ score below it then `Math.random()`s between 78–92. **Why it matters:** the implicit contract of a "sensor grid" + a building score is *this is real data about this building*. Watching the heatmap and score reshuffle randomly when you tap floors immediately reveals the dashboard as theater. For a credibility play (the team section literally argues "answers that hold up to a peer review and to a CFO"), this is the most damaging interaction on the page.
- **The archetype "before/after filtration" idea isn't legible.** Outside has 80 amber particles drifting; inside has 14 cyan particles bouncing in a small box behind the front face. There's no visual moment of *filtration* — no flow, no funnel, no narrowing. Particles deflect *up and away* from the building rather than entering through INTAKE and emerging fewer through EXHAUST. **Why it matters:** the section's only job is "outdoor particles in greater quantity → fewer make it inside after filtration." A reader who didn't read the panel copy would just see ambient sparkle around a building. The motion isn't doing comprehension work.
- **Topnav has no scroll spy and no progress indicator.** Six section links, smooth scroll, no active state, no scroll progress, no way to know you're 40% through the story on a long page. On a static long-scroll experience this is the cheap-but-load-bearing affordance for orientation. **Why it matters:** without it, users carry the page's structure in their head — exactly what your persona's "carry state in their head" trigger flags.
- **The hero's `data-countup="10"` produces `10%` but the proof label reads `of US electricity projected for data centers by 2030`.** The number is approximate, the framing isn't. Combined with the unsourced `40%` of global energy & emissions stat below, a careful reader (the CFO this page is implicitly addressing) starts wondering about citation. **Why it matters:** small, easy to fix, but the brief explicitly calls these "approved public claims" — present them with the precision they were approved at, and consider a footnote or source pill.

### 4. Highest-leverage recommendations

- **Promote the $39.9M pillar to a hero-tier moment inside FilterStudio.** Pull it out of the 5-up pillar row and make it a full-width banded result above or below the chart row, with the four supporting breakdowns (`206,419 MWh`, `$36.7M energy`, `$2.83M climate`, `$369k health`) attached as captioned children. The four-up `fs__callout-stats` block later in the section is already doing this work — fold the pillar grid into the callout and stop saying it twice.
- **Make the FilterStudio toggle actually swap the data.** Filter A vs Filter B should redraw both curves (or at minimum bold/dim the line stroke and update the numeric readouts in the pillars). `Compare` should be the default and the only state with both curves visible at full strength. Right now the chart legend already shows both endpoint values — let the toggle drive that, not opacity tricks on pillars.
- **Rebuild the MATRIX heatmap as a decision surface, not a colored grid.** Three concrete moves: (1) annotate the "best cell" under each scenario with a callout (e.g., `−2.0% energy · $40k/y` pointing at a specific cell); (2) add a small color scale legend that reads `worse ← energy use → better`; (3) make scenarios do something visually obvious — shift the gradient's center of mass, light up the affected row/column band, or animate the optimum-cell pointer. The flow diagram (`Real building → Digital sister → Rapid simulations → Decision matrix`) is fine but it's promising a level of analytical depth the heatmap doesn't deliver.
- **Seed the H.E.A.A.L. sensor grid and score with a deterministic per-floor profile.** Three floors, three fixed patterns, with realistic spatial structure (a hot corner near a window, a cool zone near a vent). Score should sit at e.g. 86 / 82 / 91 — believable, stable, recognizable. The 3.5s repaint loop is fine; what kills credibility is *floor toggles* reshuffling everything.
- **Add a scroll-spy progress rail and active section state to the topnav.** Either a thin progress bar across the top of `.topnav` or `is-active` on the matching `topnav__links a`. With eight numbered sections and a long page, this is the cheapest win for "calm and directed" on the page.

### 5. What I would watch next

- After the FilterStudio toggle becomes real: does someone landing in the section understand "Filter A saves more energy, Filter B captures more PM2.5" within two seconds, without reading the pillars? If not, the chart annotations aren't doing enough.
- After the MATRIX rebuild: can a non-engineer point to the best operating regime on the heatmap and say *why* in plain language? If they can't, the visualization is still chart junk.
- After the H.E.A.A.L. seed: does the floor toggle feel like *inspecting a building* instead of *refreshing a screensaver*? The user's gut reaction here is the only signal that matters.
- On a phone: how does the inventory map perform at 360px wide with 412 dots, and does the archetype isometric stay readable when the right-side panel stacks beneath it? I'd specifically watch whether the `map-ranges` 6-column → 2-column flip preserves any sense of statistical breadth, and whether the FilterStudio pillars stacking 1-up makes the section feel like an endless scroll.

### 6. Scorecard

- **Usability: 6/10** — primary path is legible and the inventory section is well-grouped, but the MATRIX and H.E.A.A.L. interactions actively mislead, and the FilterStudio toggle is theater. A user trying to *do something* with this page (extract a takeaway, compare filters, understand savings) has to compensate for the interface.
- **Clarity: 5/10** — section spine is strong, but the central analytical moments don't surface their conclusions. The page tells you what it is; it doesn't yet teach you what it knows. The archetype section in particular is decorative where it needs to be didactic.
- **Trust: 5/10** — the hero, team section, and CoBE callout build real credibility, but the randomized H.E.A.A.L. grid, the cosmetic FilterStudio toggle, and the static-feeling MATRIX scenarios undercut it the moment a curious user pokes at them. For an audience that includes CFOs and engineers, the bar here is "every interaction confirms the substance" — and right now, several do the opposite.

---

## ui_brand_systems_lead — UI (typography / spacing / brand)

### 1. Overall verdict

This is well above template-grade — there's a real type system (Space Grotesk display + Inter body + JetBrains Mono for instrument copy), a disciplined navy stack, and the FilterStudio / MATRIX panels actually feel like product UI. But it isn't yet at a Deloitte Cloud Insights bar. The cyan gradient is doing too much heavy lifting (it's the hero `em`, the headline finish, the stat numbers, the impact numbers, the IEQ score, the dollars pillar — six different "this is important" treatments compete), numerics aren't running on tabular figures so every metric subtly drifts, and the chart language varies between the three products instead of cohering. Read as one system, the surface feels intentional but slightly assembled — the molecules are right, the rules across molecules are not.

### 2. Top strengths

- **Type stack is well-chosen and consistently applied.** Space Grotesk on `h1/h2/h3` plus eyebrow text in JetBrains Mono with `letter-spacing: 0.14em uppercase` (styles.css:130–135) is the right move for a science-forward consultancy. The eyebrow numbering (`01 · Why it matters`, etc.) is doing genuine wayfinding work and reads like a paper TOC, not decoration.
- **The pillar component (styles.css:595–627) is the strongest atom on the page.** Left 2px accent bar, accented variant for "Dollars," consistent header/metric/footnote rhythm — it has a point of view and could carry the whole product UI if applied more widely.
- **The kv list (styles.css:505–522) is genuinely premium.** Mono right-aligned values, dashed bottom rules, `align-items: baseline` — this is exactly the typographic register the Deloitte case study traffics in. It earns trust.
- **Restraint on color is real where it shows up.** The map's existing/planned split (`--accent` cyan vs `--planned` violet) is a defensible two-color encoding, and the `legend__chip b` already has `font-variant-numeric: tabular-nums` (styles.css:428) — proof that someone knew the rule and applied it locally.
- **Motion taste is good.** Pulse on the lit eyebrow, dashoffset chart reveals, staged map dot reveal with cubic-out easing — none of it is gratuitous, all of it has a `prefers-reduced-motion` escape hatch (styles.css:929–933).

### 3. Top issues

- **Tabular numerics are missing on every metric except the map legend.** `.proof__num`, `.stat__num`, `.pillar__metric b`, `.counter`, `.hl__score-num span`, `.card--imp b`, `.fs__callout-stats b`, `#mx-savings-pct/usd/co2`, `.tile__val b` — none of these set `font-variant-numeric: tabular-nums`. Space Grotesk's default figures are proportional, so during count-up animation (`countUp()` in app.js:64–82) and on hover-driven readouts, digits literally wobble width. On a Deloitte-bar data interface this is the single most visible craft tell. System-level.
- **The cyan gradient (`--grad-1`) is being asked to mean six different things.** It's the hero word "healthy" (index.html:56), the `.why .stat__num` (78%/30%/40%/5), the `pillar--accent` Dollars metric, the FilterStudio `$40M` callout headline, every `.card--imp b`, and the H.E.A.A.L. score number. When every "important number" wears the same gradient, the eye stops treating it as emphasis and starts treating it as decorative. The Dollars pillar should be the loudest treatment; right now it's tied for first with five other things. System-level.
- **The map legend's IT-load size scale is brand-decoupled from the actual encoding.** `.legend__dot` uses `rgba(255,255,255,0.7)` (styles.css:437) — white — but the dots on the map are cyan or violet (styles.css:489–490). The legend swatches teach a color the map doesn't speak. One-off but visible.
- **Heading scale lacks a true h4.** Section h2 is `clamp(1.9–2.7rem)`, h3 is a flat `1.18rem`, and then panel sub-titles like "Two high-performance filters, same MERV rating." (index.html:271) sit at h3 size right next to a pillar `<b>` rendered at `1.7rem` — so the panel's own metric is louder than the panel's own headline. Within `fs__panel-head`, the metric-to-title hierarchy is inverted. System-level.
- **Spacing between section eyebrow → h2 is inconsistent with what the brief implies.** `.section__head h2 { margin-top: 14px }` (styles.css:117) is tight, but `.lede { margin-top: 18px }` is barely larger — eyebrow→h2 and h2→lede read as the same gap, so the eyebrow doesn't visually belong to the h2 the way it does on Tony Pham/Deloitte. Should be ~8px eyebrow-to-h2 and ~24px h2-to-lede. One-off but pattern-wide.
- **The two FilterStudio charts use the same chart vocabulary but the MATRIX heatmap and H.E.A.A.L. sparklines invent their own.** Pressure curve and PM₂.₅ chart share Inter axis-titles, JetBrains Mono tick labels, `#5d6778` tick color, dashed mean lines, dash-offset reveal — that's a system. Then the MATRIX heatmap (app.js:809–880) has zero axis ticks beyond two endpoint labels ("2.7"/"0.8", "Low"/"High"), uses a 4-stop teal→sky→indigo→violet color ramp with no inline legend, and the H.E.A.A.L. sparklines have no axis at all and a 12% cyan area fill. Three different chart dialects in one product trio. System-level.
- **Pillar metric units are typographically inconsistent.** `.pillar__metric span` (styles.css:620) is `0.85rem ink-3` next to the `b`, but the `.u` global (styles.css:86) is `0.78em ink-3` with `letter-spacing: 0.04em`, used inline inside the same metric (`$3.2<span class="u">M</span>`, index.html:305). So "kWh/y" and "M" are styled differently while doing the same job. One-off but visible across every metric row.
- **`.card:hover` border turns cyan (styles.css:231) on every card type — `card--stat`, `card--imp`, `card--role`, `card--imp` in `.imp__cobe`** — which means hover stops being a signal. On a benchmark surface, hover affordance is reserved for *interactive* surfaces; here, static stat cards light up the same as actually-clickable map points.

### 4. Highest-leverage recommendations

- **Add `font-variant-numeric: tabular-nums` to the display font itself.** Single rule: `.proof__num, .stat__num, .counter, .pillar__metric b, .hl__score-num span, .card--imp b, .fs__callout-stats b, .tile__val b, .mx__readout b, .kv dd, .map-ranges span { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "lnum" 1; }`. This is the single highest-leverage 8-line change on the page.
- **Demote the gradient. Reserve `--grad-1` for exactly one thing per section.** Strip it from `.stat__num` (these are context stats, not the headline finding — use plain `--ink-1` with `--accent` only on the `%` glyph), strip it from `.hl__score-num span` (the score is already in a panel with its own bar; the gradient is double-emphasis), and keep it on `pillar--accent`, the `fs__callout h3`, and the `card--imp b`. Hero `em` should arguably stay; the rest dilutes it.
- **Fix the section_head rhythm.** Change `.section__head h2 { margin-top: 8px }` (down from 14px) and `.lede { margin-top: 22px }` (up from 18px). The eyebrow→h2 gap should be ~½ the h2→lede gap. This is a 6-character tweak that will make every section feel more typeset.
- **Build one chart shell and inherit.** Extract a `.chart-axis { font-family: var(--font-mono); font-size: 9px; fill: var(--ink-4); }` rule and a single `--chart-grid: rgba(255,255,255,0.06)` token, then re-render the MATRIX heatmap with the same axis vocabulary as FilterStudio (Inter title rotated, mono ticks, faint horizontal lines between rows). Add inline legend strips under heatmap and sparklines. The three product charts should read as siblings.
- **Make the legend dots match the dots they describe.** In `.legend__dot--sm/md/lg`, swap `rgba(255,255,255,0.7)` for `var(--accent)` (or split into two rows so existing/planned each get their own size legend). Two-line change.
- **Reserve `.card:hover` border-cyan for interactive cards.** Move the hover-glow rule off `.card` and onto `.card--interactive`, then apply that modifier to map dots and chart cards only. Static stat cards (`.card--stat`, `.card--imp`, `.card--role`) should hover with `border-color: var(--line-strong)` and no gradient bloom.

### 5. What I would watch next

- Pull up the FilterStudio panel and watch the pillar metrics during count-up. If the digits shift width, the tabular-nums fix didn't land or didn't reach Space Grotesk's feature set (some weights don't ship `tnum`). If it lands, the page jumps a half-tier in perceived craft.
- Scroll the eight section heads in sequence. After the rhythm change, the eyebrow should feel attached to the h2 and the lede should feel like a separate paragraph. If they still feel like three equal-spaced lines, the margins need another pass.
- Look at the FilterStudio chart pair next to the MATRIX heatmap next to a tile sparkline at the same zoom. They should read as three chart types from one studio, not three studios. If the MATRIX heatmap still feels like a different product, axis/legend treatment didn't reach it.
- Hover-test every card type with the new `--interactive` modifier rule. Stat cards should feel inert; only the truly-clickable surfaces should bloom. If everything still lights up, the gradient `::before` rule is still attached to `.card` base.

### 6. Optional scorecard

- **Clarity: 7.5/10.** Section structure is legible, eyebrows wayfind well, kv panels are excellent. Loses points on inverted hierarchy inside product panels (metric louder than its own section title), and on the over-applied gradient flattening which-thing-matters-most.
- **Polish: 6.5/10.** Type stack and motion are tasteful; numerics, hover semantics, and cross-chart cohesion drag this down to "good static site" rather than "Deloitte-bar product surface." The fixes above are mostly tokens and selectors, not redesign — the ceiling is high.

Skipping Strategic Value and Operator Leverage per persona scope.

---

## apollo_product_design_lead — Strategic / product

### 1. Overall verdict

This page looks expensive but reads as a science narrative, not a product I can buy on Tuesday. In 60 seconds I learn 9F applies "healthy buildings" thinking to data centers, has a 412-site VA inventory, and three tools — but I do not learn what I'd actually procure, what it costs me, what I get in week one, or whether this is software I license or a study they sell me. Maturity stage: credible thought-leadership site for a Harvard-anchored advisory practice, dressed up as a product page. I would forward it to my sustainability lead. I would not forward it to my COO.

### 2. Top strengths

- **The Virginia inventory is the only real wedge on the page.** 412 parameterized sites with PUE, IT load, filter counts, eGRID region — if that data is real and current, it's something McKinsey, JLL, and CBRE do not have in this shape. That's a meeting on its own, and it's the one place the page demonstrates *work done*, not opinions.
- **Joe Allen's name is a door-opener.** Harvard Healthy Buildings, Lancet COVID Commission, JAMA/Science/Lancet — that's a credibility stack that gets me to take the call even if I think the product is half-baked. Hard to overstate this for a buyer in a regulated, ESG-scrutinized category.
- **The five-pillar lens (Energy / Health / Performance / Society / Dollars) is differentiated framing.** Every competitor I see — nVent, Vertiv, Schneider EcoStruxure, Camfil — sells me on energy and PUE. Nobody is putting public-health damages and climate damages in dollars next to my fan-energy line. For anyone with an ESG report or a state-level community-impact filing, this is genuinely new ammunition.
- **The numbers have specificity.** 206,419 MWh, $36.7M energy / $2.83M climate / $369k health, $0.18/kWh assumption stated. That's better than the usual "up to 30% savings" hand-wave. I can argue with these numbers, which means I can believe them.
- **CoBE attribution is a trust move.** Naming Harvard's Co-Benefits of the Environment tool — rather than inventing a proprietary "9F Impact Score™" — tells me the methodology is auditable. That matters when I take this to legal or to a utility commission.

### 3. Top issues

- **I cannot tell what I am buying.** Is FilterStudio software I log into? A report 9F delivers? A subscription? A one-time analysis? Same question for MATRIX and H.E.A.A.L. The page describes capabilities, not SKUs. "Talk to an expert" is the only CTA, which signals consulting hours. If this is a SaaS, say so. If it's a study, say so. If it's three different commercial motions, say *that* — but pick.
- **The flagship $39.9M number is portfolio-wide and counterfactual against a filter swap I cannot identify.** "Two high-performance filters, same MERV rating" with vendor-neutral A/B — okay, but as a buyer I cannot act on this without knowing which filters, in what configuration, against what baseline. The $40M is the headline; the methodology behind it is a black box on this page. If I'm a Digital Realty or QTS ops lead, I need to know: is 9F telling me my current filter spec is leaving $97k/site/year on the table, or is this an idealized swap against a strawman?
- **MATRIX's "up to 2% annual energy savings · ~$40k" undersells the page.** Two percent is below the noise floor of most data center optimization pitches (Vertiv claims 5–10%, ETI/Phaidra pitch double-digit chiller savings). At ~$40k/site/year, the math says even at 412 sites it's $16M — not enough to justify a procurement motion against incumbent BMS vendors. Either the 2% is sandbagged and there's a real ceiling number you're hiding, or MATRIX is the weakest of the three and should not be the middle act.
- **The three products blur into one consulting offering.** FilterStudio (modeling filters), MATRIX (modeling buildings), H.E.A.A.L. (monitoring buildings) — from a buyer's seat these feel like three workstreams of the same engagement, not three separately purchasable products. The page never tells me they can be bought independently, never tells me which one to start with, never tells me what each one costs or takes to deploy. A buyer reading this thinks "scope of work," not "product line."
- **H.E.A.A.L. is described in IAQ-monitoring language that doesn't match data center pain.** TVOC, CO₂ thresholds, occupant comfort setpoints — those are office-building metrics. In a server hall, the operator cares about particulate ingress to electronics, humidity-driven corrosion, hot-spot detection, and ASHRAE TC 9.9 envelope compliance. The dashboard mockup shows me an office IAQ tool wearing a data center jersey. If H.E.A.A.L. is actually the right hardware for this use case, the page does not prove it.
- **No customer logos, no pilot quotes, no named deployments.** Joe Allen's CV is the only third-party validation. For a category where I'm going to put sensors in my live colo or hand over my HVAC parameters for modeling, I need to know who else has done this and what they got. The team-bio section explicitly says "Individual bios for the full project team will be added prior to deployment" — that's a tell that this is pre-launch, not pre-revenue-proven.
- **The "Talk to an expert" mailto: is a friction trap.** As a buyer with 60–90 seconds I am not opening Mail.app to send a cold email to hello@. A calendly link, a short qualifying form ("portfolio size / region / which capability"), or even "Request the Virginia inventory data sample" would convert me. Right now the page presumes I'm warm enough to email — but if I were warm I wouldn't be on this page.

### 4. Highest-leverage recommendations

- **Lead with the inventory as a product, not a proof point.** Sell access (or co-analysis) of the 412-site VA inventory as a discrete, named SKU — "Virginia Data Center Intelligence Brief" or similar — with a price band and a 2-week delivery. That gets the consulting-hours objection off the table, gives buyers a $25–75k entry door, and lets you walk every customer through FilterStudio/MATRIX/H.E.A.A.L. after they're already paying. The data is the wedge; treat it like one.
- **Replace "Talk to an expert" with three offer-specific CTAs.** "Get the inventory sample (10 sites, free)" / "Run a FilterStudio comparison on my spec" / "Pilot H.E.A.A.L. on one building." Each one matches a different buyer intent and budget authority. The current single-CTA model is what consultancies do when they don't know what they're selling — Apollo, Outreach, Gong all learned this the hard way.
- **Reframe MATRIX around a number an operator actually feels.** 2% / $40k is too small to move a procurement committee. Either (a) lead with the portfolio-scale number ($16M+ across VA), or (b) lead with a specific intervention class — "envelope retrofits paid back in X years" — or (c) demote MATRIX to a methodology footnote inside FilterStudio. A middle-of-funnel product with the weakest headline number is a structural problem, not a copy problem.
- **Add one named pilot or anonymized case study with before/after.** "Operator X, 80MW NOVA campus, modeled filter swap delivered $Y over 18 months, validated by Z" — even anonymized — converts this page from a thought-piece into a product page. Without it, the $39.9M is just modeling against modeling.
- **Cut the IAQ-as-occupant-comfort framing from H.E.A.A.L. and rebuild it around equipment risk.** Reframe the metrics around particulate ingress on electronics (ASHRAE TC 9.9 envelope deviation, ISO 14644 cleanliness drift), humidity-driven corrosion risk, hot-aisle/cold-aisle anomaly detection. That's the language a data center operator pays for. CO₂ and TVOC tiles look like you wandered in from the K-12 schools deck.

### 5. What I would watch next

- **Whether 9F's next iteration shows pricing, packaging, or even a "starts at" anchor.** If the next version of this page still has one mailto: CTA, this is a consulting practice with a website, not a product company. That changes the deal structure and the valuation.
- **Whether the inventory gets a self-serve preview.** Letting me filter, hover, and pull a 10-site sample (gated by email) would be the single biggest signal that 9F is building a product, not a study. The page has the map; it doesn't yet have the data product behind it.
- **Whether MATRIX and H.E.A.A.L. ever publish a real deployment with a named or anonymized operator.** Until then, the page is asking me to trust Joe Allen's credentials as a substitute for product-market fit evidence. That works once. It does not survive a second meeting with my procurement team.
- **Whether the company decides who its primary buyer is — hyperscaler, colo operator, REIT-owner, or state regulator.** The page currently flirts with all four (energy bills for operators, ESG/health damages for regulators/communities, portfolio-scale for investors). That's a positioning problem masquerading as a feature problem.

### 6. Scorecard

- **Operator leverage: 4/10.** I cannot tell what I'd deploy on Monday or what number it moves by Friday. The inventory is the only artifact that gives me usable leverage today.
- **Strategic value: 7/10.** The healthy-buildings-in-data-centers thesis is genuinely differentiated, the Harvard CoBE methodology hook is sticky for ESG/regulatory buyers, and the 412-site dataset is a defensible wedge. The strategy is good; the productization isn't there yet.
- **Trust: 6/10.** Joe Allen + Harvard + CoBE attribution + specific numbers earns trust. No customer evidence, "bios coming soon," and the consulting-shaped CTA take it back down. I'd take the meeting. I would not sign a PO from this page.

Skipping Polish — the page is visually polished enough; that is not where this lives or dies.

---

## solo_bd_director — Buyer / operator

### 1. Overall verdict

Would I link to this in cold outbound? Cautiously yes, but only as a credibility prop, not as a pre-qualifier. This is a beautiful science-consultancy brochure with one genuinely differentiated asset (the 412-site Virginia inventory) and a credible Harvard-anchored bio. It does not, however, do the BD work I need it to do. There is no leave-behind, no self-serve estimator, no portfolio-screening offer, no calendar link, no logos, no named clients, no sample report. A prospect's COO clicks through, says "interesting science, what does this cost me and what do they actually deliver?" — and pings me. Which means I'm still in the room for every call. The page elevates 9F's perceived rigor; it does not shorten my sales cycle.

### 2. Top strengths

- **The Virginia inventory is a legitimate door-opener.** 412 sites, 202 existing / 210 planned, parameterized at the building-physics level — that is a proprietary asset I can lead a cold email with. "We've already modeled your Ashburn campus" is a hook. Nobody else in my outbound stack is sending that.
- **Joe Allen's bio is procurement-grade trust.** Harvard Chan, *Healthy Buildings* author, Lancet Commission, *60 Minutes*. That's the signal a COO needs before they take a 30-minute discovery call. It carries the whole credibility section even with the rest of the team unnamed.
- **The five-pillar frame (Energy / Health / Performance / Society / Dollars) is sticky and quotable.** I can repeat it verbatim in calls and decks. It gives the prospect a language to internally describe what 9F does, which helps the champion-forward case.
- **The $39.9M / $40M statewide co-benefits headline is the kind of number that survives a forward.** It's specific, methodologically anchored (CoBE), and big enough to wake up a CFO. Pairs well with the granular breakdown ($36.7M energy, $2.83M climate, $369k health).
- **Three products read as a coherent stack, not a confusing menu.** Model statewide (inventory) → model the building (MATRIX) → model the filter decision (FilterStudio) → monitor the result (H.E.A.A.L.). I can sell that as one capability and pitch any single product as an entry wedge.

### 3. Top issues (prioritized by adoption impact)

1. **There is exactly one CTA and it's the highest-friction one.** "Talk to an expert" = "give us a meeting." Every visitor who isn't ready to take a call bounces with no fingerprint. No gated PDF, no "send me the Virginia inventory summary," no "screen my portfolio," no calendar link, no email capture. I am leaking 90%+ of the people my outbound is actually paying to attract.
2. **Zero client trust signals.** No customer logos. No named case-study client (the $39.9M is "modeled statewide," not "we did this for Equinix/Iron Mountain/QTS"). No testimonials. A COO's procurement officer's first question is "who else have you done this for?" — and this page can't answer it. That's a meeting-killer at the second-stakeholder layer.
3. **The case-study numbers read as modeled headlines, not engagements.** $39.9M is a statewide modeling exercise, not a delivered savings figure for a named client. The "Up to 2% / ~$40k" MATRIX figure is the only thing that smells like a real engagement, and it's a throwaway line. Procurement will ask for SOWs, deliverables, references. None exist on this page.
4. **No proof of what I actually sell them.** What's the engagement model? Fixed-fee study? Subscription? Licensed software? Custom modeling? Hardware deployment for H.E.A.A.L.? Pricing range? Timeline? Typical scope? The prospect cannot self-qualify on budget or fit, so I'm pre-qualifying on every call myself. That defeats the point of having a landing page.
5. **The team section actively undercuts credibility.** "Individual bios for the full project team will be added prior to deployment" — that's a TODO note shipped to production. A forwarded link that lands on placeholder copy makes the champion look careless. The discipline cards without names read like a generic agency template after Joe's standout bio.
6. **The Virginia inventory does interactive-curiosity work, not BD work.** Hover-to-see-PUE is cool. But there is no "find your own site," no "we identified $X for this specific site," no "request a screening for your portfolio." It's a demo of capability, not a hook that asks for the prospect's data. Huge missed conversion surface.
7. **Geographic scope is a leak.** This is *the Virginia inventory*. Hyperscaler infra teams operate Phoenix, Hillsboro, Dublin, Singapore. If I send this to an AWS or Meta sustainability lead outside the LoudounCo footprint, the implicit question is "do you do this anywhere else?" — and the page never answers. Should explicitly say "Virginia today, your portfolio next" or similar.
8. **The brief asked me to anonymize the archetype, and the result is generic enough that nobody will recognize themselves.** "743,224 m³, 280 MW, DLC" — fine, but a prospect's archetype-recognition response ("oh, that's basically our DLC fleet") needs more breadcrumbs. Right now it reads as a textbook case.

### 4. Highest-leverage recommendations

- **Add a second CTA and an email-capture surface.** Minimum: "Get the Virginia data center inventory brief (PDF)" gated by email. Better: "Request a no-obligation portfolio screening — send us your site list, we'll return a modeled co-benefits estimate in 10 business days." That's the leave-behind that closes the loop between the page and my CRM. Add a Calendly link to "Talk to an expert" so motivated prospects can self-book without the email volley.
- **Get one named case study on the page, even if anonymized to "a top-5 colocation operator."** Better: get a logo wall, even if it's "research partners" or advisors. Without it, every procurement conversation stalls. If client logos don't exist yet, lead with the *Harvard / Healthy Buildings / Lancet* institutional logos as proxy trust — Joe's affiliations are bankable.
- **Make the inventory section do BD work.** Add an "Is your site in our model?" lookup, or "Drop your portfolio address list — see which of your sites we've already parameterized." Even a static "request your sites" form converts the visual centerpiece from theater into a pipeline-generation surface.
- **Ship a one-page leave-behind PDF.** Brief, headline numbers, three products, Joe's bio, contact. This is what my champion forwards to their COO. The website is too long for an exec to read in the 90 seconds they'll give it. The PDF is the actual internal-forwarding asset; the page is the deeper backup.
- **Name the team or pull the section.** Either ship the bios or remove the placeholder. The current state ("bios coming soon") is worse than no team section at all. If bios aren't ready, replace with a tighter "Team led by Dr. Joseph Allen and a team of building scientists from Harvard and partner institutions" line and move on.

### 5. What I would watch next

- **Are inbound replies citing the page or just the outbound copy?** If prospects reference "the Virginia inventory" or "the $40M statewide finding" unprompted, the page is doing real warming work. If every reply is generic ("interested, let's chat"), the page is a credibility prop, nothing more.
- **What's the second-question rate on discovery calls?** If I find myself answering "who are your other clients?" / "what does this actually cost?" / "do you work outside Virginia?" on every call, the page is leaking at exactly the points it should be plugging. Track and fix the top three.
- **Does the champion actually forward it?** Ask explicitly: "Did you share the link internally? What did your COO/sustainability lead say?" If champions are screenshotting Joe's bio and skipping the rest, the page is overweight on inventory and underweight on the human-readable executive summary.
- **Does adding a gated portfolio-screening offer fill the pipeline?** If we add it and get even 5–10 portfolio submissions a quarter from cold traffic, the page becomes a real BD tool. If it gets zero, the asks are wrong and I'm back to manual outbound being the only channel.

### 6. Scorecard

| Dimension | Score (1–5) | Note |
|---|---|---|
| Usability (as a BD asset) | 2.5 | One CTA, no self-serve, no leave-behind. Pretty, but operationally thin. |
| Clarity | 4 | Three products read coherently; five-pillar frame is sticky; narrative arc works. |
| Trust | 2.5 | Joe's bio is bankable; everything else (logos, named clients, full team) is missing or placeholdered. |
| Polish | 4.5 | Visually premium, brand-aligned, on-brief. This is where the build over-delivered. |
| Operator leverage (does it shorten my calls?) | 2 | Doesn't pre-qualify on budget, scope, geography, or engagement model. I'm still doing all the explaining. |
| Strategic value (does it open doors?) | 3.5 | The inventory + Joe's bio is a real wedge. But without portfolio-screening or named clients, it stalls at the second meeting. |

**Net:** I'd put this in my outbound stack tomorrow because it elevates 9F's perceived rigor and because Joe + 412 sites is a real hook. But I'd fight for a leave-behind PDF, a portfolio-screening offer, and at least one named-or-anonymized client engagement before Q2 — otherwise the page is a brochure, not a tool.

---

## Cross-reviewer rollup

All four reviewers independently flag that the page is visually credible but operationally thin: it elevates 9F's perceived rigor without surfacing the proof or the path to engagement that a buyer needs. The four converge most loudly on three things — (1) the central interactive surfaces (FilterStudio toggle, MATRIX heatmap, H.E.A.A.L. dashboard) decorate more than they teach, undercutting the very credibility the page is built to establish; (2) there is no client evidence, named or anonymized, anywhere on the page; and (3) "Talk to an expert" is the wrong single CTA for a buyer with 60–90 seconds and unclear budget authority.

- **Strong agreement:** randomized H.E.A.A.L. interactions and the cosmetic FilterStudio A/B toggle (UX + BD); no logos / named cases / pricing (Apollo + BD); single high-friction CTA (Apollo + BD + UX); the 412-site inventory is the page's strongest asset (all four).
- **Tension / disagreement:** UX wants the MATRIX heatmap rebuilt to teach; Apollo wants MATRIX *demoted or repositioned* around a stronger headline number ($16M+ at portfolio scale) because 2% / $40k is below the buyer's noise floor. Different prescriptions for the same section — fix the surface vs change the message.
- **Unique signals:** Apollo flags H.E.A.A.L. as wearing the wrong jersey (office-building IAQ language vs data-center pain like ASHRAE TC 9.9 / corrosion / particulate ingress) — a positioning issue no other reviewer caught and the highest-leverage product-level reframing on the page. UI flags that Space Grotesk numerics aren't running on tabular figures — a single 8-line CSS change that lifts perceived craft a half-tier.

## How to use this file

Hand the entire file to a meta-reviewer:

> Read this team review. Tell me which findings to prioritize for the next sprint, where reviewers genuinely disagree (vs just having different lenses), and what's missing from the review.

Or use it as the "what we know" doc going into a planning session.
