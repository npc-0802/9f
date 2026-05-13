# 9 Foundations Data Centers page — execution brief

**Source review:** team-review-2026-05-13-9f-datacenters.md
**Detailed report:** team-review-2026-05-13-9f-datacenters--detailed.md

## Core framing

This sprint takes the 9 Foundations Data Centers landing page from credible-pre-launch to launch-ready. The governing principle is *every interaction must confirm the substance, and every visitor must have a path forward that matches their intent*. The work is split into seven Parts, each driven by a reviewer's "What this reviewer most wants" list. Every reviewer's list must be addressed concretely; if a specific item must be staged or deferred, it must be called out as such — no silent drops. The page does not need a redesign; it needs an honesty pass on interactivity, a conversion pass on architecture, and a product-narrative pass on H.E.A.A.L. and MATRIX.

## Execution order

1. **Part 1 — Interaction honesty.** Fix the credibility-undermining interactions first; everything downstream depends on the page being trustworthy under inspection.
2. **Part 2 — Conversion architecture.** Add the CTAs, leave-behind, and capture surfaces. Unlocks BD use.
3. **Part 3 — Product narrative (H.E.A.A.L. + MATRIX).** Reposition the two products that currently fail at buyer-language fit.
4. **Part 4 — Trust artifacts.** Land the named/anonymized case study, logos, and team-bio resolution.
5. **Part 5 — Inventory as conversion surface.** Convert the map from theater into a pipeline-generation tool.
6. **Part 6 — Craft pass.** Tabular-nums, gradient discipline, chart vocabulary, section rhythm, hover semantics. CSS-heavy.
7. **Part 7 — Orientation + geography.** Scroll spy, active nav, geographic-intent line.

Parts 1 + 6 can run in parallel (one engineer on interactions, one on tokens). Part 3 has a narrative-decision dependency that should land in the first three days. Parts 2, 4, 5 chain together as the BD conversion stack and should ship in sequence.

---

## Part 1 — Interaction honesty

### Problem

UX flags three of the page's centerpiece interactive surfaces as actively misleading: the FilterStudio A/B/Compare toggle fades pillar opacity but doesn't redraw charts or change readouts ("dishonest motion"); the MATRIX heatmap multiplies all cells by 0.985 / 0.992 / 0.975 so scenarios barely shift the gradient ("beautiful but unhelpful"); the H.E.A.A.L. sensor grid re-rolls from a stateless RNG on every floor toggle and the building score `Math.random()`s itself ("the most damaging interaction on the page" for a credibility-led brand). BD reinforces this: "the page elevates 9F's perceived rigor; it does not survive interaction." For an audience the page explicitly invokes — peer-review rigor, engineers, CFOs — the first interactive prod cannot reveal the dashboards as theater.

### Goal

Every interactive surface on the page is at least as credible as the static copy around it. A curious visitor who clicks, hovers, or toggles anything sees the data respond in a way that *confirms* 9F's analytical claim, not a way that betrays it.

### Required changes

- **FilterStudio A/B/Compare toggle:** wire to redraw both curves (pressure / PM₂.₅) and update the five pillar readouts. "Filter A" emphasizes Filter A's curve at full stroke + dims Filter B; "Filter B" reverses; "Compare" is the default state with both curves at full strength. Pillar metric values reflect the active state — when "Filter A" is selected, the displayed numbers are A's numbers; when "B," B's; when "Compare," show A primary with the delta to B inline.
- **MATRIX heatmap scenario:** scenarios must visibly reshape the gradient — not just shift cell values uniformly. Move the gradient's center of mass, light up the affected row/column band, and animate a "best cell" pointer to the new optimum under each scenario.
- **MATRIX heatmap legend + annotation:** add an inline color-scale legend reading `worse ← energy use → better`, and a callout box annotating the best cell with its kWh/m² value and the savings vs baseline for the active scenario.
- **H.E.A.A.L. sensor grid:** replace the stateless `rand()` paint with three deterministic per-floor profiles (3 fixed 4×18 patterns with realistic spatial structure — a hot corner, a cool zone near a vent). Optionally keep the 3.5s ambient repaint loop but it must only perturb values within ±5% of the seeded baseline, never reshuffle the field.
- **H.E.A.A.L. building score:** replace `Math.random()` with a fixed per-floor value (Fl 1 = 82, Fl 2 = 86, Fl 3 = 91 or similar). Score bar fill animates between floors smoothly; the number does not roulette-wheel.
- **Archetype particle motion (optional in this Part, falls into Part 6 if cut):** redirect outdoor particles to enter via INTAKE and exit fewer through EXHAUST, instead of deflecting up and away from the building. The section's only didactic job is "more particles outside, fewer inside after filtration."

### Acceptance criteria

- Clicking Filter A vs Filter B redraws curve strokes and updates all five pillar `<b>` numbers.
- Cycling MATRIX scenarios visibly shifts the gradient — not just the readout text.
- A best-cell annotation is present under each scenario, with the active scenario's savings vs baseline.
- A color-scale legend appears under or beside the heatmap, in the same chart-axis vocabulary as the FilterStudio charts.
- H.E.A.A.L. floor toggles produce three distinct, stable, recognizable sensor patterns. Toggling Fl 1 → Fl 2 → Fl 1 reproduces the same pattern each time.
- H.E.A.A.L. building score number is deterministic per floor and does not change on re-render.
- (If shipped) archetype particles visibly flow through INTAKE and out EXHAUST; the indoor box receives them at a visibly reduced rate.

---

## Part 2 — Conversion architecture

### Problem

Apollo and BD independently arrive at the same operational verdict: there is exactly one CTA — a mailto to "Talk to an expert" — and zero leave-behind, no email capture, no portfolio-screening offer, no calendar link. A buyer with 60–90 seconds is not opening Mail.app. BD: "every visitor who isn't ready to take a call bounces with no fingerprint." Apollo: "the current single-CTA model is what consultancies do when they don't know what they're selling." The page also doesn't tell the buyer what they're buying — software, study, subscription, hardware deployment — which means BD pre-qualifies on every call.

### Goal

The page offers three distinct, offer-shaped paths forward that match different buyer intents and budget authorities, and every visitor — warm or cold — leaves with something or can self-book.

### Required changes

- **Replace the single CTA pattern with three offer-shaped paths.** Recommended set: (a) "Get the Virginia data center inventory brief (PDF)" — gated by email, no further qualifying ask; (b) "Screen my portfolio — send us your site list, we'll return a modeled co-benefits estimate in 10 business days" — short form with portfolio size, region, capability of interest; (c) "Talk to an expert" — link to a Calendly (or equivalent) calendar booking, not a mailto.
- **Add a sticky or in-section CTA bar** to the inventory section specifically — the page's strongest moment should not require scrolling to the closing CTA to convert.
- **Ship the leave-behind PDF.** One page: headline, three products, Joe's bio summary, three CTAs, methodology footnote, contact. This is the artifact champions forward internally. The website is the deeper backup; the PDF is what reaches the COO.
- **Add engagement-model clarity to each product section.** One sentence per product: "FilterStudio is a fixed-fee modeling engagement; typical scope X; typical delivery Y." Same for MATRIX and H.E.A.A.L. If commercial motions differ across the three (study vs subscription vs hardware-plus-platform), say so.
- **Replace the mailto with a Calendly link** on the primary CTA. Mailto is preserved as a tertiary fallback for users with email-only workflows.

### Acceptance criteria

- The hero CTA row offers two distinct paths (inventory brief + calendar), not one.
- The closing CTA section offers all three paths.
- The inventory section has its own in-section CTA ("Is your site in our model?" or equivalent — see Part 5).
- A leave-behind PDF exists and is reachable from at least the primary CTA on every section.
- Each product section (FilterStudio, MATRIX, H.E.A.A.L.) carries one sentence on engagement model.
- "Talk to an expert" opens a calendar widget, not Mail.app.

---

## Part 3 — Product narrative (H.E.A.A.L. + MATRIX)

### Problem

Apollo flags two product-narrative problems the other reviewers don't surface. First, H.E.A.A.L. is described in office-building IAQ language — TVOC, CO₂ thresholds, occupant comfort setpoints — when the data-center buyer cares about ASHRAE TC 9.9 envelope drift, particulate ingress to electronics, humidity-driven corrosion, hot-aisle/cold-aisle anomaly detection. "If H.E.A.A.L. is actually the right hardware for this use case, the page does not prove it." Second, MATRIX's "up to 2% annual energy savings · ~$40k" is below the noise floor of competing optimization pitches (Vertiv 5–10%, Phaidra double-digit chiller savings). Either the headline is sandbagged and there's a real ceiling number being hidden, or MATRIX is the weakest of the three and should not be the middle act.

### Goal

H.E.A.A.L. speaks the data-center buyer's language. MATRIX leads with a number that justifies its placement as the middle act, *or* MATRIX is repositioned as a methodology footnote inside FilterStudio.

### Required changes

- **H.E.A.A.L. metric tiles:** swap from {TVOC, PM₂.₅, T·RH, CO₂} to {ASHRAE TC 9.9 envelope deviation, Particulate ingress (electronics-relevant), Humidity / corrosion risk index, Hot-aisle anomaly count}. The H.E.A.A.L. core message stays the same — low-cost real-time monitoring of environmental conditions that affect equipment — but the surfaced metrics align with what an operator pays for.
- **H.E.A.A.L. body copy:** rewrite the lede paragraph and the "Watch the air. Score the building." headline to lead with equipment risk, not occupant comfort. Suggested headline direction: "Watch the air. Protect the iron." or "Real-time IAQ for the hardware that runs your business."
- **MATRIX narrative weight decision.** Two paths:
  - **Path A — Keep MATRIX as the middle act, lift the headline.** Replace "up to 2% annual energy savings · ~$40k" with a portfolio-scale number ($16M+ at 412 sites, or whatever the modeled portfolio number is per the 9F team), or replace with a specific intervention-class number ("envelope retrofits modeled to pay back in X years across the VA portfolio"). Keep the 2% / $40k as a per-site supporting footnote.
  - **Path B — Demote MATRIX inside FilterStudio.** Move the simulation-engine framing into a "Methodology" subsection of FilterStudio. The standalone MATRIX section is removed; the four-step pipeline (Real building → Digital sister → Rapid simulations → Decision matrix) becomes the methodology backbone for FilterStudio.
  - **Recommendation:** Path A if the portfolio-scale number is real and approved; Path B if not. Decision must land in the first three days of the sprint — the rest of Part 3 depends on it.

### Acceptance criteria

- H.E.A.A.L. metric tiles reflect equipment-risk metrics, not occupant-comfort metrics.
- H.E.A.A.L. body copy leads with hardware / equipment language, not occupant / health language.
- MATRIX narrative weight decision is made and committed; the page reflects either Path A (with a justifiable lead number ≥ $1M operator-relevant scale, or a credible intervention-class claim) or Path B (MATRIX absorbed into FilterStudio's methodology).
- The five-pillar lens is preserved across all three products — that framing is praised by all four reviewers and is sticky.

---

## Part 4 — Trust artifacts

### Problem

Both Apollo and BD flag the absence of named or anonymized client engagements as the second-meeting killer. "$39.9M is statewide modeling, not a delivered savings figure for a named client." BD: "every procurement conversation stalls" without it. The team-bio placeholder ("Individual bios for the full project team will be added prior to deployment") is shipped TODO copy — BD: "a forwarded link that lands on placeholder copy makes the champion look careless." Apollo: "that's a tell that this is pre-launch, not pre-revenue-proven."

### Goal

The page survives a procurement officer's first three questions: "who else have you done this for?", "show me a similar engagement," "who else on the team is doing this work?"

### Required changes

- **Ship one named or anonymized client case study.** Format: "A top-5 colocation operator · 80MW Northern Virginia campus · modeled filter swap → $Y projected over 18 months · validated against [methodology]." If a real engagement exists, name it (with client approval). If not, an anonymized engagement at this level of specificity converts the page from thought-piece to product page.
- **Add an institutional logo bar.** Even without paying clients, Harvard / Healthy Buildings Program / Chan School / Lancet Commission / partner research bodies create a credibility row that procurement officers can verify. Place near or below the closing CTA, or in the team section.
- **Resolve the team-bio placeholder.** Two paths: (a) ship the bios — the right answer if the team is real, named, and willing; or (b) remove the placeholder and replace with a single line: "Team led by Dr. Joseph G. Allen and a group of building scientists from Harvard and partner institutions." The current state — placeholder copy shipped to production — is the worst option.
- **Add a methodology footer or page link.** A short note: "FilterStudio findings modeled using Harvard's Co-Benefits of the Environment (CoBE) framework. Full methodology available on request." Apollo and BD both signal that the next procurement question after "named clients" is "show me the methodology paper."

### Acceptance criteria

- At least one named or anonymized client engagement appears on the page, with quantifiable before/after numbers tied to a named methodology.
- An institutional or partner logo bar exists.
- The team section either has full bios or a tight one-line summary — placeholder copy is gone.
- A methodology pointer (footer link, downloadable paper, or "available on request" line) exists.

---

## Part 5 — Inventory as conversion surface

### Problem

BD's strongest single point: "the Virginia inventory does interactive-curiosity work, not BD work. Hover-to-see-PUE is cool. But there is no 'find your own site,' no 'we identified $X for this specific site,' no 'request a screening for your portfolio.' It's a demo of capability, not a hook that asks for the prospect's data. Huge missed conversion surface." Apollo reinforces: "the page has the map; it doesn't yet have the data product behind it."

### Goal

The inventory section is the page's highest-converting moment. Visitors who land on the map can self-identify (find their site) and self-qualify (request a screening for their portfolio).

### Required changes

- **Add a "Find your site" lookup.** Search by address, ZIP, or operator name. On match, the site detail panel pre-populates with that site's modeled attributes and a "Request the full report on this site" CTA. On no-match, a "We may not have parameterized this site yet — drop your portfolio list, we'll add it" prompt.
- **Add a "Screen my portfolio" form** in the inventory section's right-side panel or below the map. Inputs: portfolio size, region, primary cooling type, contact email. On submit, a confirmation page with expected turnaround and a calendar link.
- **Add an "Is your site in our model?" inline prompt** above or alongside the legend. Reduces friction for users who don't realize they can interact.
- **Capture the cluster narrative.** Add a "Northern Virginia represents 74% of the modeled portfolio — Ashburn alone holds N sites" call-out so the geographic concentration is named, not just visualized.

### Acceptance criteria

- A search input exists in the inventory section and successfully matches at least addresses within the 412-site dataset.
- A portfolio-screening form exists, captures structured input, and confirms submission with expected turnaround.
- The inventory section produces at least one form-submission per qualified inbound (measured by analytics; placeholder until Part 7's instrumentation lands).
- Cluster-level narrative call-out is present.

---

## Part 6 — Craft pass

### Problem

UI flags three system-level craft issues that drag the page a half-tier below the Deloitte Cloud Insights bar referenced in the design brief: (1) numerics aren't running on tabular figures so digits wobble during count-up animation; (2) the cyan gradient is doing six different "this is important" jobs simultaneously and has stopped functioning as emphasis; (3) the three product charts speak three different chart dialects rather than reading as siblings from one studio. UX adds: hover-state on `.card` lights up every card type including static ones, and the section_head eyebrow→h2→lede rhythm is too uniform.

### Goal

The page reads as one disciplined design system, not as well-assembled molecules.

### Required changes

- **Add `font-variant-numeric: tabular-nums` to all display numerics.** Single CSS rule covering `.proof__num, .stat__num, .counter, .pillar__metric b, .hl__score-num span, .card--imp b, .fs__callout-stats b, .tile__val b, .mx__readout b, .kv dd, .map-ranges span`. Include `font-feature-settings: "tnum" 1, "lnum" 1` as a fallback. Verify Space Grotesk weights ship `tnum`; switch to a known-good variant if not.
- **Reserve `--grad-1` for exactly one element per section.** Strip from `.stat__num` (Why section) and `.hl__score-num span`. Keep on `pillar--accent`, `.fs__callout h3`, `.card--imp b`, and the hero `em`.
- **Build one chart-axis vocabulary.** Add `.chart-axis { font-family: var(--font-mono); font-size: 9px; fill: var(--ink-4); }` and a `--chart-grid: rgba(255,255,255,0.06)` token. Re-render the MATRIX heatmap and H.E.A.A.L. sparklines using this vocabulary. Add inline legend strips under heatmap and sparklines.
- **Reserve `.card:hover` border-cyan for `.card--interactive`.** Move the `::before` gradient bloom and border-color change off `.card` base and onto `.card--interactive`. Apply the modifier to map dots and clickable chart cards only. Static stat cards hover with `border-color: var(--line-strong)`, no bloom.
- **Fix the section_head rhythm.** Eyebrow → h2 margin to ~8px (from 14px). h2 → lede margin to ~22px (from 18px). Eyebrow should feel attached to h2.
- **Match legend dot color to map encoding.** `.legend__dot--sm/md/lg` should use `var(--accent)` for existing or be split into two rows so existing/planned each get their own size scale.
- **Unify pillar metric unit typography.** Pick one of `.pillar__metric span` or `.u` and apply consistently; the current state has "kWh/y" and "M" styled differently while doing the same job.

### Acceptance criteria

- During count-up animation, digit width is stable (no horizontal drift).
- `--grad-1` appears on no more than one element per major section.
- MATRIX heatmap and H.E.A.A.L. sparklines share axis vocabulary with FilterStudio charts.
- Hover on a static stat card shows no cyan bloom; hover on an interactive map dot or chart card does.
- Section eyebrow → h2 looks tighter than h2 → lede when viewed at standard zoom.
- Map legend size-scale dots are the same color as actual map dots.
- All pillar metric units share one typographic treatment.

---

## Part 7 — Orientation + geography

### Problem

UX flags the absence of scroll-spy and active topnav state on an eight-section long-scroll page as the cheapest single orientation win available. BD flags geographic scope as a leak: "this is *the Virginia inventory* — hyperscaler infra teams operate Phoenix, Hillsboro, Dublin. If I send this to an AWS or Meta sustainability lead outside the LoudounCo footprint, the implicit question is 'do you do this anywhere else?' — and the page never answers."

### Goal

Visitors always know where they are on the page and whether 9F applies to their geographic footprint.

### Required changes

- **Add scroll-spy active state** to `.topnav__links a`. As each section enters the viewport, the matching link gets `is-active` with `color: var(--ink-1)` (or a cyan underline accent).
- **Add a scroll progress rail** — a thin (2px) `--accent` bar across the top of `.topnav` whose width tracks `window.scrollY / document.scrollHeight`. Replace cheap topnav clutter at small breakpoints.
- **Add a geographic-intent line** to the inventory section header or just above the closing CTA. Suggested copy: "Virginia today, your portfolio next — 9F's modeling approach applies anywhere in the world; the Virginia inventory is our proof of work."
- **Add basic page analytics instrumentation** (since Part 5's portfolio-screening conversions need to be measurable). Use whatever 9F already runs — Plausible, GA4, or similar. Track: scroll depth, CTA clicks per type, form submissions, inventory section interaction events.

### Acceptance criteria

- Scrolling through the page lights up the correct topnav link as each section enters view.
- A progress rail shows scroll position visibly at the top of the page.
- Geographic intent is stated explicitly somewhere visible (inventory or closing CTA).
- Page analytics fire on CTA clicks, scroll depth thresholds, and inventory form submissions.

---

## Cross-cutting principles

- **No silent deferrals.** If a Part item must be staged or skipped, the report-back must say so explicitly. The brief was built from the full union of reviewer asks; partial implementations are acceptable but must be visible.
- **Honesty over polish.** Where a craft fix and an interaction fix conflict for engineering time, interaction honesty wins. The page's biggest credibility leak is interactive theater, not visual craft.
- **Preserve the five-pillar lens.** All four reviewers credit it; do not flatten or simplify Energy / Health / Performance / Society / Dollars during the H.E.A.A.L. and MATRIX repositioning.
- **Reduced-motion is non-negotiable.** Every animation added in this sprint must have a reduced-motion fallback. The current page passes this bar; don't regress.
- **Approved public claims are sacred.** 10% by 2030, ~$40M co-benefits, up to 2% MATRIX savings — present them with the precision they were approved at, including citation pills if added.
- **Anonymization rules from the original brief still apply.** No real Manassas address in the archetype; no vendor names in the FilterStudio comparison.

## Testing / verification

- **Typecheck / lint:** N/A — vanilla JS + static HTML. Run `node -c app.js` and `node -c data.js` for syntax sanity.
- **Smoke flow 1 — interaction honesty:** scroll to FilterStudio, click A, B, Compare; verify curves redraw and pillar numbers swap. Scroll to MATRIX, cycle all four scenarios; verify gradient visibly shifts and best-cell annotation moves. Scroll to H.E.A.A.L., cycle floors 1/2/3 several times; verify the sensor grid pattern returns to the same state per floor and the building score is stable.
- **Smoke flow 2 — conversion architecture:** click each CTA on the page; verify the inventory brief downloads, the screening form submits cleanly, and "Talk to an expert" opens a calendar widget (not Mail.app).
- **Smoke flow 3 — craft pass:** open the FilterStudio panel and pillar count-ups; verify digit width is stable. Hover every card type; verify static cards do not bloom cyan.
- **Smoke flow 4 — orientation:** scroll the page top to bottom; verify topnav active state updates per section and the progress rail advances.
- **Cross-browser:** verify in Chrome stable + Safari current + Firefox current. Mobile: iOS Safari + Android Chrome at 360px and 414px widths.
- **Reduced-motion sanity:** toggle `prefers-reduced-motion: reduce` in DevTools and re-walk every interactive surface. Verify static-frame fallbacks; no looped animations; no missing visuals.
- **Accessibility sanity check** (Part 7 dependency, even before a full a11y audit): keyboard-tab through the page top to bottom; verify all CTAs and chips are reachable; verify the map dot focus order is bounded (e.g., the 412 dots aren't all tab-stops).

## Deliverable expectations

At end of sprint, the report-back should include:

- A summary by Part of what shipped fully vs partially vs staged vs deferred, with a one-sentence reason for any non-full ship.
- The list of files changed.
- A note on the MATRIX narrative weight decision (Path A or Path B) and the rationale.
- Confirmation that every reviewer's "What this reviewer most wants" list is addressed somewhere in the sprint (or staged with explicit reason). The four lists:
  - **UX:** 5 items — FilterStudio takeaway promotion, A/B toggle wired, MATRIX rebuilt, H.E.A.A.L. seeded, scroll spy.
  - **UI:** 6 items — tabular-nums, gradient discipline, section_head rhythm, chart-axis vocabulary, hover semantics, legend dot color.
  - **Apollo:** 5 items — inventory as SKU, three offer-shaped CTAs, MATRIX repositioning, named case study, H.E.A.A.L. equipment-language reframe.
  - **BD:** 6 items — leave-behind PDF + email capture, calendar link, named/anonymized case study, inventory as conversion surface, team-bio resolution, geographic intent line.
- Screenshots or screencaps of the three biggest interaction changes: FilterStudio toggle in action, MATRIX scenarios cycling, H.E.A.A.L. floor toggle producing distinct patterns.
- A list of anything the sprint surfaced that wasn't in the review pack and needs follow-up.
