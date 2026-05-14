# 9F Data Centers — Round 4 Execution Brief

## Purpose

This brief translates the Round 3 review into the next implementation pass for Claude Code.

Round 3 meaningfully improved the page. The site is now broadly on-brand, credible, and much closer to the original intent. But it still does **not fully ship the original north-star request** because the most important narrative transition remains unbuilt:

- the page was supposed to move from the Virginia portfolio map
- into a specific data center
- into a corresponding archetype
- and then into the three tools that act on that building reality

Right now, the page does:

- Virginia inventory
- then a generic archetype section
- then tools

That means the biggest remaining gap is **product-shaped**, not cosmetic.

The most important instruction in this brief is:

**Build the map → selected site → archetype handoff as a real shared interaction path.**

Everything else in this brief is secondary to that.

---

## Source Of Truth

Claude should prioritize these in order:

1. The user’s original natural-language intent from the wife’s request
2. The wife’s clarifications and intake answers
3. The four source materials
4. The Round 3 review in `/Users/noahcott/9f/reviews/team-review-2026-05-13-9f-datacenters-round3.md`

Do not optimize for prior implementation habits if they conflict with the original story.

---

## North-Star Intent

The page should clearly tell this story:

Small building decisions have high-stakes consequences in data centers. Those choices affect direct outcomes like equipment health and energy use, and indirect outcomes like public health and climate, all with economic implications. 9F can model and monitor those effects with low-touch tools.

The intended narrative arc is:

1. Virginia portfolio-scale variation matters
2. One selected data center becomes concrete
3. That selected site becomes an archetype/building model
4. FilterStudio, MATRIX, and H.E.A.A.L. show how 9F quantifies and acts on that reality

If a change does not help that arc, it is lower priority.

---

## What Round 3 Proved

Keep these gains:

- the `$39.9M` statewide finding as the rhetorical peak
- the inventory histograms tied to the active filter state
- the technical hero scale-rule language instead of generic particle shimmer
- the improved MATRIX heatmap clarity
- the more differentiated editorial/data-card vocabulary

Do not regress any of those.

---

## Round 4 Priorities

## Priority 1 — Build The Missing Map → Archetype Handoff

This is the single highest-priority change.

### Required outcome

When a user clicks or keyboard-selects a Virginia data-center point on the map, the archetype section below must become a representation of that selected site rather than remaining a generic hardcoded block.

### What this means concretely

- Maintain a single selected-site state shared between the inventory section and the archetype section.
- The selected site should already drive the site-detail panel in inventory.
- Extend that same calculation/state path so the archetype panel and archetype SVG are populated from the selected site.
- Add an explicit affordance in the inventory/site-detail area that moves the user into the archetype section.
  - Recommended copy: `View This Site As An Archetype`
  - It should smooth-scroll to `#archetype`
  - It should feel like a continuation of the same analysis, not a separate page jump

### Archetype data that should derive from the selected site

Use the real selected record where possible, and derive display values honestly from the available dataset and existing logic.

The archetype should update, at minimum:

- floor area
- ceiling height
- inferred building volume
- IT load / IT capacity
- HVAC system type
- filter count
- any available outdoor or region-linked environmental context already supported by the current data model

If some current archetype fields cannot be site-specific from the existing dataset, either:

- derive them from the selected-site attributes using explicit logic, or
- label them as representative/inferred rather than presenting them as exact per-site truths

Do not leave obviously hardcoded values in place once a site is selected.

### Fallback behavior

- If no site has been selected yet, the archetype may show a representative default state.
- But once a site is selected, the archetype must visibly and meaningfully change.

### Acceptance criteria

- Selecting a map point updates the archetype section below
- The site-detail panel and archetype panel reconcile to the same selected site
- The archetype no longer feels generic after a site is chosen
- The page now genuinely tells: `portfolio variation → this site → this building`

---

## Priority 2 — Make The Archetype Visualization Teach More Clearly

The current particle system is mathematically defensible but not didactic enough. It still reads too much like ambient motion and not enough like filtration logic.

### Required outcome

A first-time viewer should be able to glance at the archetype visualization and understand:

- more pollution exists outside
- less makes it inside
- filtration happens at a specific boundary

### Direction

Keep the existing concept of outside particles and fewer inside particles, but make the filtration moment spatially explicit.

Claude may choose one of these approaches:

1. Show visible buildup/compression at the intake/filter face
2. Add live outside-vs-inside flow counters
3. Make the filter boundary visibly intercept the majority of incoming particles

Best option:

- combine a visible filter-boundary moment with a simple labeled flux comparison

### Important

Do not turn this into decorative animation.
It should explain, not just move.

### Acceptance criteria

- A viewer can infer “fewer particles make it inside” without reading the side copy
- The filter boundary is visually legible as the place where particles are stopped
- Reduced-motion mode still preserves the teaching value with a static snapshot

---

## Priority 3 — Surface The Four-Part Story Shape Earlier

One important UX note from Round 3: the page still does not frame the full north-star bundle clearly enough above the fold.

That bundle is:

- equipment health
- energy
- public health
- climate
- all with economic implications

### Required outcome

The first screen or immediate first-scroll should make the story shape obvious, not just the numbers.

### Direction

Refine the hero or immediate post-hero structure so the page more clearly communicates:

building decisions affect operational performance and societal outcomes, and those impacts all show up economically.

Possible implementation directions:

- a compact four-theme strip beneath the hero copy
- a tighter claim-plus-substructure in the hero supporting block
- a very restrained editorial explainer line that bundles the four outcome domains

### Important

Do not bloat the hero.
This should clarify the conceptual frame, not add a wall of copy.

---

## Priority 4 — Remove Remaining Claude-Like Visual Residue

Once Priority 1 is done, perform the token-level cleanup that the UI reviewer identified.

These are real issues, but they are second-order compared with the missing narrative handoff.

### Remove glow residue

Delete remaining glow/halo treatments that contradict the brief’s restrained 9F system.

Specifically target the surviving box-shadow glow declarations identified in review:

- pillar accent/active glow residue
- H.E.A.A.L. pip glow residue

The page should rely on:

- border
- rule
- contrast
- color

not halo bloom.

### Remove surviving ambient radial washes

Cut the remaining ambient radial-gradient backgrounds called out in review, especially:

- `.map-canvas`
- `.closing__bg`

If either area needs more presence afterward, solve it with a technical substrate treatment, not a cyan atmospheric glow.

### Restrict `--grad-1`

The gradient emphasis should be rare.

Recommended rule:

- preserve `--grad-1` only for the `$39.9M` hero-tier finding
- convert other uses to flat brand color or solid ink

That means likely removing gradient usage from:

- hero headline emphasis
- FilterStudio accent numeric
- any other non-peak decorative usage

### Remove internal archetype glow

The archetype SVG still contains internal glow residue even after surrounding container cleanup.

Remove the internal cyan glow ellipse / glow-def treatment so the archetype reads as technical and crisp rather than atmospherically lit.

---

## Priority 5 — Tighten Type/System Consistency

After the above, tighten the remaining design-system inconsistencies the review called out.

### Feature numeric consolidation

There are still too many near-duplicate “large numeric” styles.

Consolidate a single shared token/style for mid-tier feature numerics across:

- section stat cards
- proof-strip numerics
- impact cards / similar supporting metrics

Reserve the very large gradient display style for the single hero finding.

### Unit treatment consistency

Unify the page’s `number + unit` atom wherever possible.

Prefer one coherent instrument-style treatment across:

- FilterStudio pillars
- H.E.A.A.L. tiles
- supporting proof metrics

Avoid one section stacking units while another keeps them inline unless the difference is truly intentional.

### Radius cleanup

Enforce the sharp 9F radius token system everywhere, including minor/accessibility elements.

---

## Priority 6 — Minor Clarity Cleanup

These are smaller but worth addressing if they still exist after the main pass.

### HVAC abbreviations

Do not make users decode unexplained chips.

If `DLC` / `DEC` are still shown in compact form, expand them or provide immediate helper language.

### Repeated `10%` point

Avoid burning two early slots on the same statistic with slightly different wording.

If the duplicate `10% by 2030` framing is still present in both the hero proof and Why section, replace one with a more 9F-specific supporting fact.

---

## Non-Negotiable Data-Viz Rule

Carry forward this implementation standard:

**Any numeric value shown inside or adjacent to an interactive visualization must be mathematically accurate and must respond to the same underlying interaction state as the visualization itself.**

That means:

- no decorative placeholder values in data-viz surfaces
- no hardcoded archetype metrics once a site is selected
- no interaction that changes the picture without changing the associated numbers
- one calculation path where possible

The map/archetype handoff should follow this rule strictly.

---

## Copy And Tone Constraints

Keep the approved copy direction:

- technical but crisp
- premium and analytical
- academic rigor / Harvard-PhD ethos
- not uncanny
- not meta-UI narration

Avoid copy like:

- “as you scroll”
- “this visualization shows”
- “here you can explore”
- any phrasing that sounds like an AI explaining the website instead of being the website

Every major section should still lead with a declarative claim before supporting data.

---

## Architecture Constraints

Keep the approved page structure:

- one-page experience
- sticky global nav
- anchor navigation
- static HTML / CSS / vanilla JS
- D3 via CDN as needed

Do not pivot this into:

- a carousel
- a multi-page architecture
- a backend-dependent product experience

---

## Recommended Execution Order

Claude should implement in this order:

1. Build shared selected-site state between inventory and archetype
2. Add the inventory-to-archetype CTA / smooth handoff
3. Make archetype panel values derive from selected site
4. Make archetype particle behavior more legible/didactic
5. Re-check reduced-motion/static fallbacks for the updated archetype
6. Pull the four-part story shape higher in the hero / first-scroll
7. Remove glow residue and ambient radial washes
8. Restrict gradient usage to the single peak finding
9. Consolidate numeric/type tokens and small-system inconsistencies
10. Clean up minor abbreviation / duplicate-stat issues

---

## Definition Of Done For Round 4

Round 4 is successful if:

- the page now truly tells the requested map → selected facility → archetype → tools story
- selecting a Virginia site meaningfully changes the archetype below
- the archetype visualization clearly teaches outside vs inside filtration
- the first screen better communicates the four-part consequence framework
- the remaining Claude-like glow/gradient residue is removed
- the page feels even more like an authored 9F instrument and less like a refined AI-generated landing page

If Claude must choose between a narrative/product fix and a CSS-polish fix, choose the narrative/product fix.
