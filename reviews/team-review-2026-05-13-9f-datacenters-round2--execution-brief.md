# 9 Foundations Data Centers page — Round 3 execution brief

**Source review:** team-review-2026-05-13-9f-datacenters-round2.md
**Detailed report:** team-review-2026-05-13-9f-datacenters-round2--detailed.md

## Core framing

Round 2 closed the credibility gaps from Round 1 and satisfied the definitive execution brief. Round 3 is the *launch-readiness sprint*: the last 15% of in-scope work the four reviewers identified, none of which is structural but each of which closes a specific remaining gap a careful reviewer would notice. The governing principle: *every Round 2 reviewer "most wants" item must be addressed concretely; if any item is staged or deferred, the reason must be visible*. Scope guardrails remain unchanged from the Round 2 definitive brief — no invented logos, no fabricated case studies, no pricing, no backend forms, no productized SKU page. The biggest in-scope conversion lift available (a static Calendly link on the primary CTA) is Part 1; the cleanups and craft refinements run alongside it.

## Execution order

1. **Part 1 — Conversion path (primary CTA → static calendar link).** Highest-leverage in-scope change available; both BD and Apollo flag this as the single most important Round 3 addition.
2. **Part 2 — FilterStudio hierarchy + headline polish.** UI's biggest find; demote the supporting stat tiles and fix the headline `M` suffix register. Together these make the `$39.9M` finally read 3× louder than its breakdowns.
3. **Part 3 — Eliminate the last interactive theater.** UX-flagged residue: wire-or-remove the 7d/30d range chips, strip the hardcoded `.hl__status` markup, drive the Society pillar from the FilterStudio data model. Closes the last "is this real?" doubts.
4. **Part 4 — Static-only conversion architecture additions.** BD's remaining in-scope asks: flagship pre-selected site in the inventory side-panel, in-section CTA inside the inventory, geographic intent line.
5. **Part 5 — Apollo product-narrative micro-fixes.** Demote MATRIX 2%/$40k pull-quote; add engagement-model sentences per product header.
6. **Part 6 — Craft cleanup + numeric consistency.** Pillar unit consolidation, `.card::before` scope tightening, H.E.A.A.L. sparkline axis vocab decision, archetype filtration-face moment, `~$40M`/`~$39.9M` reconciliation.

Parts 1, 4, and 5 unlock buyer-experience improvements and can ship in sequence. Parts 2, 3, 6 are mostly CSS/JS cleanups and can run in parallel by a separate sub-task.

---

## Part 1 — Conversion path: primary CTA → static calendar link

### Problem

BD and Apollo independently identify the same single highest-leverage in-scope remaining BD/buyer gap: both CTAs are mailtos, but the brief's no-backend prohibition was aimed at multi-step lead-gen funnels requiring server logic, not at third-party-hosted calendar links. BD: "a motivated prospect at 11pm doesn't open Mail.app. They tab away and forget." Apollo: "clicking either path opens Mail.app and presumes I'm warm enough to compose a message. A static Calendly URL would convert the warmer subset of this audience without violating the constraint." UX agrees the mailto has friction (corporate webmail, mobile webview, system "choose your default mail app" dialogs) but didn't push the substitution. The implementation's mailto-only stance is a conservative reading of the brief; both buyer-side reviewers explicitly treat the Calendly substitute as in-scope.

### Goal

The primary CTA captures warm prospects without forcing them through a mail client they may not have configured. The secondary CTA (the inventory brief mailto) is preserved as the warm-but-not-ready path. Friction at the moment of peak prospect intent drops materially.

### Required changes

- **Replace the primary CTA's mailto with a static calendar link** in both the hero (`index.html`) and the closing CTA section. Specifically: change `<a class="btn btn--primary" href="mailto:hello@9fheaal.com?...">Talk to an expert →</a>` to `<a class="btn btn--primary" href="https://cal.com/9foundations/data-centers" target="_blank" rel="noopener">Book a discovery call →</a>` (or whichever calendar service 9F chooses). If 9F hasn't picked a calendar service yet, use a placeholder `href` and note it as launch-blocker.
- **Keep the secondary CTA as the inventory-brief mailto.** This is the right path for warm-but-not-ready prospects who want ammo for an internal deck.
- **Update the topnav CTA** (currently `<a class="btn btn--primary btn--sm" href="#cta">Talk to an expert</a>`) to either point to the new calendar URL directly or scroll to `#cta`. Either is defensible; calendar-direct is the higher-conversion option.
- **Consider a third CTA inside the inventory section** (BD's #4 recommendation; see Part 4) pointing to the inventory-brief mailto.

### Acceptance criteria

- Clicking "Talk to an expert" (or its renamed equivalent) on hero, topnav, and closing CTA opens a calendar booking interface, not Mail.app.
- The secondary "Request the inventory brief" mailto with preloaded subject + body is preserved.
- No new backend dependency, no form-handler endpoint, no CRM integration introduced.
- Reduced-motion + a11y states preserved on the new button (target=_blank with rel=noopener; visible focus state).

---

## Part 2 — FilterStudio hierarchy + headline polish

### Problem

UI flags two specific hierarchy issues remaining inside the `fs__headline` banner. First, the four `.fs__headline-stats` supporting tiles ($36.7M / $2.83M / $369k / 206,419 MWh) sit at `font-size: 1.55rem` in `--ink-1` inside their own bordered cards, and together carry more visual mass than the single `$39.9M` headline number — the headline is at most ~2.3× louder when the brief asked for 2–3×. Second, the "M" suffix on `.fs__headline-num` renders at full digit weight inside the gradient-clipped element instead of being demoted to the page's standard `.u` unit register (~0.4–0.5em). Both reduce the visual peak of the FilterStudio section.

### Goal

The `$39.9M` reads as the unmistakable single peak inside the FilterStudio panel; the four breakdowns read as captioned children of that result, not as a competing 2×2 tile grid.

### Required changes

- **Demote `.fs__headline-stats` to a caption strip.** Specifically: drop `b font-size: 1.55rem` to `1.2rem`; set `.fs__headline-stats li { background: transparent; border: 0; padding: 12px 0; }`; add `border-top: 1px solid var(--line-1); padding-top: 14px;` to `.fs__headline-stats` so they sit visually under the number rather than next to it; set `gap: 28px` for breathing room.
- **Wrap the headline `M` suffix in `<span class="u">`.** Change `<span data-countup="39.9" data-suffix="M">0M</span>` to a digit-only countup with the unit in a sibling `.u` span: `<span data-countup="39.9">0</span><span class="u">M</span>`. Adjust `countUp()` if needed so the suffix isn't double-applied.
- **Optional: tighten `.fs__headline-result h3` width.** UI flagged this caption wraps to two lines at 1240px container width. Either bump `max-width` to ~36ch or trim "annual co-benefits across the Virginia data center portfolio" by two words.

### Acceptance criteria

- The `$39.9M` is visually 3×+ louder than any single supporting stat number.
- The four breakdowns read as a caption strip, not as a 2×2 grid of equal-weight tiles.
- During count-up, "M" holds the `.u` register from frame 1; digits grow under it.
- Tabular-nums still applies to the new digit-only span.

---

## Part 3 — Eliminate the last interactive theater

### Problem

UX flagged three small but real residues from the Round 2 work that, collectively, are the last "is this real?" doubts a careful reviewer would land on. (1) The H.E.A.A.L. 7d/30d range chips are inert — `app.js` literally contains the comment "the chip just records user intent" — reintroducing the smallest version of the Round 1 anti-pattern in an otherwise honest section. (2) The hardcoded `.hl__status` `<li>`s in `index.html:464–468` get rewritten by `updateStatus` on first paint; works by coincidence (default Floor 2 matches), but markup-vs-state divergence will flicker between "PM₂.₅, RH" (comma) and "PM₂.₅ · RH" (middle dot) during JS load on slow connections. (3) The Society pillar in FilterStudio is the one pillar that doesn't respond to the A/B toggle — after Energy/Health/Performance were all wired to swap from `FS_VALUES`, the static Society tile is a visible asymmetry.

### Goal

Zero remaining inert interactive controls. Zero markup-vs-state divergence. Every pillar in the FilterStudio comparison responds consistently to the toggle (or is explicitly labeled as scenario-invariant).

### Required changes

- **Wire the 7d/30d range chips OR remove them.** Easiest honest path: give each tile two stored sparkline series (7d and 30d) and swap by `data-hl-range`. Tile threshold values can stay the same. Alternative: delete the chips entirely (`index.html` button block + `app.js` handler).
- **Strip the hardcoded `.hl__status` `<li>`s.** Remove the three static `<li>` elements from `index.html`; let `updateStatus` populate the list on first paint. Add a `<noscript>` fallback if needed for JS-disabled rendering.
- **Drive the Society pillar from `FS_VALUES`.** Two options: (a) add `society: { A: 3.2, B: 2.1 }` to the data model and have `updatePillars` swap a real comparison; (b) update the pillar copy to explicitly say "Portfolio rollup · scenario-invariant" so the user understands why it doesn't change. Option (a) preserves toggle parity; option (b) is faster but documents the asymmetry.

### Acceptance criteria

- Toggling 7d/30d either swaps tile data visibly OR the chips don't exist.
- The `.hl__status` list renders identically on cold load vs steady state — no comma/middle-dot flicker.
- Toggling Filter A → Filter B → Compare visibly changes all four pillars (Energy, Health, Performance, Society) OR the Society pillar carries explicit scenario-invariant labeling.

---

## Part 4 — Static-only conversion architecture additions

### Problem

BD identifies three remaining in-scope conversion gaps that the Round 2 implementation didn't pick up: (1) the inventory side-panel default state ("Hover or tap a site") wastes the page's highest-attention moment when a flagship pre-selected site (Ashburn, real PUE/IT load) would demonstrate capability instead; (2) the inventory section has no in-section CTA at the moment of peak prospect intent ("Want your portfolio modeled?"); (3) geographic scope is framed as Virginia-only with no "your portfolio next" bridge, creating an implicit limiter for hyperscaler buyers operating outside Virginia.

### Goal

The inventory section converts at the moment a prospect understands what they're looking at, and any geo of buyer feels addressed by the page.

### Required changes

- **Pre-select a flagship site on inventory load.** Wire the inventory panel to default to a specific real site from `data.js` — e.g., the largest Loudoun site, or a recognizable Ashburn campus. The side panel shows real attributes (PUE, IT load, system type, filters) on first paint instead of the "Hover or tap a site" empty state.
- **Add an in-section CTA inside the inventory panel.** One line in the `map-panel__note` or below the legend: `Want your portfolio modeled? <a href="mailto:hello@9fheaal.com?subject=...">Request the inventory brief →</a>`. Same mailto target as the closing CTA's secondary path; just exposed at the moment of peak intent.
- **Add a geographic intent line.** One sentence under the inventory section lede or near the closing CTA: "Virginia today. The same parameterization works for any market with public site data." (Or 9F's preferred phrasing.) Eight to twelve words; closes the implicit "you only do Virginia" question.

### Acceptance criteria

- On initial load (no user interaction), the inventory side-panel shows a real site's full attribute set, not "Hover or tap a site."
- A visible in-section CTA in the inventory section links to the inventory-brief mailto.
- One sentence on the page explicitly addresses whether 9F's method applies outside Virginia.

---

## Part 5 — Apollo product-narrative micro-fixes

### Problem

Apollo flagged two product-narrative micro-issues left by Round 2. (1) The MATRIX panel reframe correctly positions 2%/$40k as a "modeled example finding," but the section's *pull-quote* at the bottom still surfaces "up to 2% annual energy savings and ~$40k annual cost savings" as the section's takeaway — when the takeaway should be that operators can compare interventions on the same decision surface that returns health and climate co-benefits. (2) No section names the engagement model in plain English — a buyer can't tell whether FilterStudio is a delivered modeling report, MATRIX is an ongoing engagement, or H.E.A.A.L. is a sensor deployment. The brief excluded pricing and SKUs; it did *not* exclude naming the *form* of the deliverable.

### Goal

The MATRIX pull-quote celebrates the capability, not the small number. Every product section names the form of the deliverable in plain English without naming pricing or scope.

### Required changes

- **Demote the MATRIX 2%/$40k pull-quote.** Replace `index.html`'s closing `mx__pull` paragraph with capability-celebrating copy. Example direction: "MATRIX gives operators a decision surface where envelope, setpoint, and HVAC choices can be compared *before* capex commits — on the same surface that returns health and climate co-benefits." Tuck 2%/$40k into a small footnote or kv-row inside the panel.
- **Add one engagement-model sentence per product section.** Suggested directions (9F to confirm exact wording): FilterStudio "Delivered as a modeled comparison report tailored to each operator's filter inventory." MATRIX: "Delivered as a modeling engagement with a custom decision surface for the operator's portfolio." H.E.A.A.L.: "Delivered as a sensor deployment plus an operating dashboard." Six to twelve words per section; no pricing, no scope, no fabricated claims.

### Acceptance criteria

- The MATRIX section's closing pull-quote leads with the capability, not the per-archetype small number.
- Each product section carries one sentence explicitly naming the form of the deliverable (report / engagement / sensor deployment).

---

## Part 6 — Craft cleanup + numeric consistency + archetype filtration moment

### Problem

UI and UX flagged a set of smaller, lower-stakes residues that collectively add up to the last ~10% of craft work. (1) Pillar metric units split between `.pillar__metric span` (0.85rem ink-3) and global `.u` (0.78em ink-3 with letter-spacing) — two different unit treatments in the same row. (2) `.card::before` overlay is still attached to every static card (impact, stat, role) even though hover discipline correctly fires only on `.card--interactive` — dormant pseudo-elements per render. (3) H.E.A.A.L. sparklines remain a fourth chart dialect with no axis, no threshold line, no caption — while the other three product charts now share Inter title + mono ticks + `#5d6778` vocabulary. (4) The hero uses `~$40M` while FilterStudio uses `~$39.9M` for the same finding. (5) UX's archetype find: the state machine for particle filtration is correct but particles fade silently rather than visibly compressing or stopping at the INTAKE filter face — a reader without the panel copy sees ambient motion, not filtration.

### Goal

The page reads as one fully-coherent design system with zero residual inconsistencies a careful reviewer would catch.

### Required changes

- **Collapse pillar unit treatment to one rule.** Delete `.pillar__metric span` styling; wrap all unit text inside pillars in `<span class="u">`. Every metric in the page routes through one unit token.
- **Move `.card::before` onto `.card--interactive`.** Either via selector change or by adding `.card::before { display: none; } .card--interactive::before { display: block; opacity: 0; ... }`. Eliminates dormant pseudo-elements on every static card.
- **Decide H.E.A.A.L. sparkline treatment.** Option A: give them minimum-viable axis vocabulary — a horizontal dashed threshold line (matching FilterStudio's mean-line dialect), a "7d" or "30d" caption in mono bottom-right, removed glow `drop-shadow`. Option B: accept they're ambient and visually demote them — drop opacity to 0.4, remove area fill and glow. Either ends the fourth-dialect drift.
- **Reconcile `~$40M` and `~$39.9M`.** Pick one number and use it consistently across hero and FilterStudio. Cleanest: keep both at `~$40M` (the rounded approved public claim) OR both at `$39.9M` with `~` qualifier. The methodology pill can absorb the precision difference.
- **Make filtration visible at the filter face.** Two options: (a) replace the silent fade of the 85% filtered population with a brief moment of compression at the INTAKE rectangle — particles collapse into a thin band against the filter face, hold, then fade; (b) add a permanent "loaded with X g" indicator on the INTAKE bay's face that visibly grows as the section dwells. UX's archetype find — larger touch than the other Part 6 items but the only remaining honest-interaction gap.

### Acceptance criteria

- All pillar metric units share one typographic register.
- Static cards (`.card--imp`, `.card--stat`, `.card--role`, `.team__featured`, `.imp__cobe`) have no hover bloom — only legitimately interactive surfaces do.
- H.E.A.A.L. sparklines either share the FilterStudio chart vocabulary or are quietly recessed.
- Hero and FilterStudio refer to the headline finding with one number, consistently.
- A reader watching the archetype motion *without* reading the panel copy walks away with "outdoor particles → filter → fewer inside" as the obvious narrative.

---

## Cross-cutting principles

- **No silent deferrals.** If a Part item is staged or skipped, the report-back must say so explicitly with a reason. Every Round 2 reviewer "most wants" item is represented in this brief; every one must be touched.
- **Honesty over polish.** Where a Part 6 craft cleanup conflicts with a Part 1 or Part 3 honesty fix for engineering time, honesty wins. The page's hard-won credibility comes from honest interactions.
- **Preserve all Round 2 wins.** Tabular-nums, gradient discipline, scroll-spy, deterministic H.E.A.A.L., honest FilterStudio toggle, MATRIX best-cell annotation, `$39.9M` headline banner. Don't regress these.
- **Reduced-motion non-negotiable.** Every new animation or transition must have a `prefers-reduced-motion: reduce` fallback.
- **Brief envelope holds.** Round 3 stays within the same scope as the Round 2 definitive brief — no invented client logos, no fabricated case studies, no pricing, no productized SKUs, no multi-step backend funnels. The Part 1 calendar link is the only new conversion architecture; it's static and brief-compliant.
- **Approved public claims at approved precision.** 10% by 2030, ~$40M / ~$39.9M, up to 2%. Use them consistently across the page.

## Testing / verification

- **Typecheck / lint:** vanilla JS + static HTML. Run `node -c app.js` and `node -c data.js` for syntax sanity.
- **Smoke flow 1 — Part 1 (calendar link):** click "Talk to an expert" from hero, topnav, and closing CTA. Each opens a calendar booking interface in a new tab, not Mail.app. Verify on Chrome / Safari / mobile Safari.
- **Smoke flow 2 — Part 2 (headline hierarchy):** scroll to the FilterStudio panel. Confirm `$39.9M` reads as the unmistakable single visual peak; the four supporting numbers feel like captions, not competing tiles. During the count-up animation, "M" stays at unit-register weight from frame 1.
- **Smoke flow 3 — Part 3 (theater elimination):** toggle 7d/30d on H.E.A.A.L. — either tile data swaps OR the chips don't exist. Cold-load the page with throttled network — `.hl__status` list renders identically to steady state. Toggle Filter A → B → Compare — Society pillar either swaps values OR is explicitly labeled scenario-invariant.
- **Smoke flow 4 — Part 4 (inventory conversions):** load the page fresh. Inventory side-panel shows real site data on first paint. An in-section CTA in the inventory section links to the inventory-brief mailto. A geographic intent line is visible somewhere on the page.
- **Smoke flow 5 — Part 5 (product narratives):** read the MATRIX section's closing pull-quote — capability-led, not number-led. Read each product section's header — one sentence names the form of the deliverable.
- **Smoke flow 6 — Part 6 (craft):** hover every card type — only interactive surfaces bloom. Pillar units share one register. Hero and FilterStudio agree on the headline number. Watch archetype motion without reading copy — filtration is visible.
- **Reduced-motion sanity:** toggle `prefers-reduced-motion: reduce` in DevTools and re-walk every interactive surface. No looped animations regressed; static-frame fallbacks intact.
- **Cross-browser:** Chrome stable + Safari current + Firefox current; iOS Safari + Android Chrome at 360px and 414px widths.

## Deliverable expectations

At end of Round 3, the report-back should include:

- A summary by Part of what shipped fully vs partially vs deferred, with a one-sentence reason for any non-full ship.
- The list of files changed.
- Confirmation that every Round 2 reviewer "most wants" item is addressed somewhere in Round 3 (or staged with explicit reason). The four lists:
  - **UX:** 5 items — archetype filtration moment, Society pillar parity, 7d/30d wire-or-remove, `.hl__status` markup strip, `~$40M`/`~$39.9M` reconciliation.
  - **UI:** 5 items — `fs__headline-stats` demotion, headline `M` suffix into `.u`, pillar unit consolidation, `.card::before` scope tightening, H.E.A.A.L. sparkline axis decision.
  - **Apollo:** 5 items — anonymized engagement card *(deferred — asset-supply problem, not implementation problem)*, MATRIX pull-quote demotion, Calendly CTA swap (Part 1), engagement-model sentences per product, geographic intent line.
  - **BD:** 5 items — Calendly CTA swap (Part 1), inventory in-section CTA, geographic intent line, flagship pre-selected inventory site, scroll-spy *(already shipped in Round 2 — BD didn't notice, worth confirming visible)*.
- Screenshots or screencaps of the three biggest changes: new Calendly CTA flow, demoted `fs__headline-stats` hierarchy, inventory side-panel showing a real flagship site on load.
- Confirmation that the one Apollo "most wants" item that isn't an implementation task — the anonymized engagement card — is explicitly logged for 9F's next business-development cycle, not silently dropped.
