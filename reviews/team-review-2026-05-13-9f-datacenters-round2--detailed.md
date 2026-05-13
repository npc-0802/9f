# Team review — 9 Foundations Data Centers landing page — Round 2 — Detailed report

**Date:** 2026-05-13
**Slug:** 9f-datacenters-round2
**Source:** team-review-2026-05-13-9f-datacenters-round2.md

## Detailed report

## Summary pages

### Summary page 1: overall picture

Round 2 was an explicit remediation pass driven by `9f_datacenters_definitive_execution_brief.md` — a brief that consolidated Round 1's findings, drew explicit scope lines (no invented client logos, no fabricated case studies, no pricing, no backend forms, no productized SKU page), and prioritized fidelity to those constraints over chasing every reviewer suggestion. The audit's central question: did the implementation actually satisfy the brief? The four reviewers — UX, UI, Apollo PM (potential customer), Solo BD Director — converge on the same answer: yes, materially. Every primary remediation requested by the brief shipped honestly. The three credibility-undermining interactive surfaces are now source-driven and meaningful. The $39.9M finding is no longer one of five equal pillars; it's a hero-tier banner with the four CoBE breakdowns attached. The team section reads as an intentional capability narrative instead of a TODO. Tabular numerics, gradient discipline, hover semantics, and section rhythm all landed at the system level the brief implied. Trust scores moved 2–3 points across reviewers; UX moved from 5/10 trust to 8/10, BD moved from 2.5/5 trust to 4/5, Apollo moved from 6/10 trust to 7.5/10. Within the brief's explicit envelope, the page is ready to ship.

The remaining residue is small, fixable, and divides into three categories with clear ownership. The first is a small set of *implementation-level cleanups in this sprint's natural scope*: UI flags that the four `fs__headline-stats` supporting tiles are still tile-shaped and visually compete with the $39.9M headline rather than caption it; UX flags that the H.E.A.A.L. 7d/30d range chips remain inert (the JS code itself says "the chip just records user intent") and that the hardcoded `.hl__status` `<li>`s create a markup-vs-state divergence with `updateStatus`; UX also notes the Society pillar in FilterStudio is now the one pillar that doesn't respond to the A/B toggle. The page also uses `~$40M` in the hero and `~$39.9M` in the FilterStudio section for what should be the same number. All of these are token-and-selector size, not redesign — collectively under a half-sprint of work.

The second category is *one in-scope improvement the implementation chose not to take*: BD and Apollo independently flag that the primary CTA is still a mailto when a static Calendly (or Cal.com, SavvyCal) link would qualify under the brief's "static-friendly secondary path" allowance — the brief's no-backend prohibition was aimed at multi-step funnels requiring server logic, not at third-party-hosted calendar links. BD names this as the highest-leverage remaining BD gap. Apollo says it's in-scope. Whether to act on it is a deliberate call: was the implementation's mailto-only stance a strict reading of the brief or a conservative one?

The third category is *out-of-scope for this page and brief*: one anonymized customer engagement card with quantifiable before/after numbers. Apollo names this as the meeting-earner-vs-meeting-closer ceiling. The brief intentionally excluded fabricating one; if a real engagement exists that can be described abstractly without naming the client, it's the next deliverable 9F should ship — but as an asset for this page, not as an implementation task.

### Summary page 2: core themes

**Theme 1 — Honesty restored to every primary interactive surface.** This is the most cross-cutting Round 2 outcome and the most important. UX, Apollo, and BD all independently credit the same three rebuilds: the FilterStudio A/B/Compare toggle now redraws both charts and swaps pillar values (`setFsMode` + `updatePillars` in app.js), the MATRIX scenarios actually reshape the gradient via per-scenario `uWeight`/`hWeight`/`offset` weights plus a color legend and a leader-line best-cell annotation, and the H.E.A.A.L. floor toggles ship three hand-tuned deterministic patterns (scores 82/86/91, fixed tile values, fixed alert counts, no `Math.random`). UX puts the trust shift bluntly: "every primary interaction now does what it advertises." Apollo's framing: "the earlier version trained me to distrust every other control on the page within five seconds. This one trains me to trust them." BD's: "the page now survives a curious-prospect poke." The single biggest credibility movement of the page is this set of three rebuilds — and the brief's Phase 1 priority list got executed exactly.

**Theme 2 — Hierarchy now matches narrative weight.** All four reviewers credit the `$39.9M` promotion to a hero-tier `.fs__headline` banner as the single most important visual change. UI traces the gradient discipline that supports it: `--grad-1` is gone from `.stat__num` and `.hl__score-num span` and is now reserved for the hero `em`, the new headline number, the impact cards, and the pillar accent — six "this is important" treatments collapsed to one-per-section. The pillar grid was simultaneously demoted to a four-up neutral comparison row, removing the parity that previously made the Dollars finding compete with itself. BD's framing: "the $39.9M is finally a forwarded-email hook, not a buried tile." Apollo's: "the buyer's brain now has one number to remember and a methodology stamp that tells me I can audit it." UI scores Polish at 8/10 (up from 6.5) on the strength of this hierarchy work plus tabular-nums adoption.

**Theme 3 — Brief-faithful discipline on what *not* to ship.** Apollo and BD both score the implementation generously precisely because it held the line on scope. Apollo: "the Round 2 brief's discipline about not shipping things 9F doesn't actually have (named clients, pricing, productized SKUs) is the right call, and the implementation lives up to that discipline." BD: "within scope, the page is now safe to send." Both reviewers explicitly evaluate the implementation against the brief's intentional envelope rather than against their Round 1 wish lists. That's the right framing — and the team's decision to reframe rather than fabricate (e.g., "Disciplines on the engagement" instead of fake teammate bios; "modeled example finding" instead of fake case study) is what made the discipline visible to reviewers.

**Theme 4 — One in-scope BD push the implementation didn't take.** The clearest remaining tension. BD and Apollo independently flag the same gap: the primary CTA is mailto-only when a static Calendly link is brief-compliant and would convert materially better. UX agrees the mailto has friction (corporate webmail, mobile webview, "choose your default mail app" dialogs) but doesn't push the Calendly substitute. The disagreement isn't between reviewers — it's between the reviewers and the implementation's reading of the brief. BD's framing: "the brief's prohibition was on 'complex multi-step sales funnels requiring backend logic' — a calendar link is the static-friendly opposite of that."

**Theme 5 — Last theater traces and small craft cleanup.** UX caught two pieces of small-but-real residue: the 7d/30d range chips on H.E.A.A.L. are explicitly no-op (with a comment in app.js admitting it), reintroducing the smallest version of the Round 1 anti-pattern in an otherwise honest section; and the hardcoded `.hl__status` markup gets rewritten by `updateStatus` on first paint, working by coincidence (default Floor 2 happens to match the markup) but creating markup-vs-state fragility. UI caught residue in three places: the `fs__headline-stats` tiles are still loud enough to compete with the headline they're supposed to caption, the "M" suffix on the count-up renders inside the gradient text at full digit weight (no `.u` unit demotion), and pillar units split inconsistently between `.pillar__metric span` and global `.u` styling. None of these are major; collectively they're the last 15% of craft work and a single in-scope BD addition away from a launch-ready ship.

## Reviewer page: ux_agency_lead

### Main judgment

The UX lead reads Round 2 as a real correction, not a polish pass — every Round 1 trust hit that came from interactive theater has been rebuilt with source-driven behavior. The FilterStudio A/B toggle actually swaps the comparison, the MATRIX heatmap actually reshapes under scenarios with a best-cell call-out, and the H.E.A.A.L. dashboard ships three deterministic floor profiles. Tabular numerics, scroll-spy with a progress rail, and disciplined hover semantics all landed. Trust score moved from 5/10 to 8/10. The remaining UX issues are small and concentrated in two areas: the archetype particle motion still doesn't clearly *show* filtration despite an honest state machine driving it (most of the filtered particles fade silently rather than visibly stop at the filter face), and a few small inconsistencies — the Society pillar not responding to the FilterStudio toggle, dead 7d/30d chips on H.E.A.A.L., a markup-vs-state divergence in `.hl__status`, and the `~$40M`/`~$39.9M` numeric drift across sections.

### Biggest praise

- FilterStudio's `setFsMode` actually redraws charts AND swaps pillar values via `updatePillars` — the single biggest credibility recovery on the page.
- MATRIX scenarios reshape the gradient via per-scenario `uWeight`/`hWeight`/`offset`, with a color legend, white-ring best-cell, and `−X.X% vs baseline` leader-line callout. The visual now teaches.
- H.E.A.A.L. ships three hand-tuned per-floor profiles (4×18 pattern strings + fixed scores 82/86/91 + fixed alert counts + fixed tile values). No `Math.random`. Toggling floors reproduces the same building state.
- `$39.9M` is now the hero-tier banner inside FilterStudio with four CoBE breakdowns as captioned children. Pillar grid demoted to four-up.
- Tabular-nums + `tnum`/`lnum` features wired across every numeric class. Digits don't wobble during count-up.
- Scroll-spy + 2px cyan progress rail land tastefully; reduced-motion still honored.

### Biggest concerns

- **Archetype particles still don't visually show filtration.** The state machine is correct (outside → 85% filtered → 15% interior → exhaust) but particles fade silently rather than visibly compress or stop at the INTAKE filter face. A reader who skips the panel copy sees ambient motion, not didactic motion.
- **The Society pillar in FilterStudio doesn't respond to the A/B toggle.** After Energy/Health/Performance were all wired to swap from `FS_VALUES`, Society is the one pillar that stays static. Either drive it from the same data model or label it explicitly as scenario-invariant.
- **The 7d/30d range chips on H.E.A.A.L. are dead.** The JS comment admits "the chip just records user intent." The smallest Round 1 anti-pattern survived into Round 2.
- **`.hl__status` has hardcoded `<li>`s that `updateStatus` rewrites on load.** Works because the default matches; fragile because any default-state shift would cause a flicker between comma-vs-middle-dot separators.
- **`~$40M` (hero) and `~$39.9M` (FilterStudio) refer to the same finding at different precisions.** Trivial copy fix; should be one number consistently.

### What this reviewer most wants

1. **Make filtration visible at the filter face.** Replace the silent fade of the 85% filtered population with a brief compression at the INTAKE rectangle — particles collapse into a thin band at the filter face, hold, then fade. Or add a permanent "loaded with X g" indicator on the INTAKE bay that grows over time.
2. **Drive the Society pillar from `FS_VALUES`.** Add `society` per filter and have `updatePillars` swap a real comparison, or label it explicitly as "Portfolio rollup · scenario-invariant" so the reader understands the asymmetry.
3. **Either wire 7d/30d to real data or remove the chips.** Give the sparkline tiles two stored series and swap by `data-hl-range`, or strip the controls entirely.
4. **Strip the hardcoded `.hl__status` `<li>`s.** Render the list entirely from `updateStatus` on first paint.
5. **Reconcile `~$40M` and `~$39.9M`.** Use one consistently across hero and FilterStudio.

## Reviewer page: ui_brand_systems_lead

### Main judgment

UI reads Round 2 as a confident half-tier jump in craft: tabular numerics shipped system-wide, the gradient is finally disciplined (one place per section), MATRIX has been pulled into FilterStudio's chart vocabulary, and the `$39.9M` is genuinely hero-tier. Clarity moved from 7.5 to 8.5 and Polish from 6.5 to 8. The page now reads as one system, not three. The Deloitte Cloud Insights bar is closer but not yet cleared — the remaining gaps are token-and-selector size, not redesign. The two most visible craft issues left: the four `fs__headline-stats` supporting tiles are too loud and read as competing with the headline rather than captioning it, and the "M" suffix on the headline count-up renders inside the gradient at full digit weight instead of as a demoted `.u` unit. There's also a few smaller residual asymmetries: pillar metric units split between `.pillar__metric span` and global `.u` styling, dormant `.card::before` pseudo-elements still attached to non-interactive cards, and H.E.A.A.L. sparklines as a fourth chart dialect with no axis vocabulary.

### Biggest praise

- Tabular numerics shipped exactly to spec: `font-variant-numeric: tabular-nums` + `tnum`/`lnum` features across all numeric classes in one CSS block.
- Gradient discipline landed: `--grad-1` removed from `.stat__num` and `.hl__score-num span`; reserved for hero `em`, `.fs__headline-num`, `pillar--accent`, `.card--imp b`, and the bar fill. Six "this is important" treatments collapsed to one per section.
- `.fs__headline` is genuinely hero-tier: `clamp(3.8rem, 8vw, 6.2rem)` numeric inside a banded panel with radial-glow and cyan border; pillar grid simultaneously demoted to neutral four-up.
- MATRIX heatmap now speaks FilterStudio's chart dialect (Inter title, mono ticks, `#5d6778` tick color), with a color-scale legend strip and best-cell annotation.
- Topnav progress rail and active-link underline reuse the existing accent token instead of inventing a new emphasis register — restraint, not gauge-cluster cosplay.

### Biggest concerns

- **`.fs__headline-stats b` reads as four competing tiles, not as captioned children.** 1.55rem `--ink-1` numbers in their own bordered cards collectively carry more visual mass than the single `$39.9M`. The headline is at most ~2.3× louder; the brief asked for 2–3×. Fix is demotion via CSS tokens.
- **The "M" suffix on `.fs__headline-num` rides at digit weight.** `data-suffix="M"` renders inside the gradient-clipped numeric element without `.u` unit demotion. Should be wrapped in a `<span class="u">` like the hero proof block does, sitting at ~0.4–0.5em.
- **Pillar metric units are still split between two styles.** `.pillar__metric span` (0.85rem, ink-3) vs global `.u` (0.78em, ink-3, letter-spacing 0.04em) — two different unit treatments in the same row.
- **`.card::before` overlay is still attached to every static card.** The hover discipline correctly fires only on `.card--interactive:hover`, but the underlying pseudo-elements with `opacity: 0` are still wasted overhead on impact/role/stat cards.
- **H.E.A.A.L. sparklines remain a fourth chart dialect.** No axis, no tick, no legend, no domain min/max. Either give them minimum-viable axis vocabulary (threshold dashed line + mono caption) or visually demote them further.

### What this reviewer most wants

1. **Demote `.fs__headline-stats` into a caption strip.** `font-size: 1.2rem` (from 1.55), `background: transparent; border: 0; padding: 12px 0`, gap 28px with a top border. The `$39.9M` becomes 3× louder by subtraction.
2. **Wrap the headline `M` suffix in `<span class="u">`.** Split `data-countup="39.9" data-suffix="M"` into a digit span + a unit span; let the unit ride at the demoted `.u` register.
3. **Collapse pillar unit treatment to one rule.** Delete `.pillar__metric span`; wrap all unit text in `<span class="u">`; pillar metrics route through one token.
4. **Move `.card::before` onto `.card--interactive`.** Eliminate 12 dormant pseudo-elements per page render.
5. **Give H.E.A.A.L. sparklines axis vocabulary or visually demote them.** Threshold dashed line + mono "7d" caption, OR drop the glow and area fill and lower opacity to 0.4.

## Reviewer page: apollo_product_design_lead

### Main judgment

Apollo, evaluating as a potential customer with a 60–90 second decision window, reads Round 2 as a substantial shift: from "expensive science brochure" to "credible thought-leadership surface that earns the meeting." Within the brief's intended envelope — Harvard-anchored capability page, not productized SaaS portal — Apollo would now forward this to a sustainability lead *and* mention it to a COO, because the interactive surfaces no longer collapse under inspection and the $39.9M finding finally reads as the headline it always wanted to be. Operator leverage moved from 4/10 to 6.5; strategic value from 7 to 8; trust from 6 to 7.5. The remaining ceiling — the page is still asking buyers to trust modeling against modeling — is correctly outside this implementation's scope and belongs to a next-deliverable (one anonymized engagement) rather than to this page.

### Biggest praise

- The `$39.9M` banner with attached CoBE methodology and four breakdown stats is "the proof point that earns the meeting." Buyer brain has one number to remember plus an auditable methodology stamp.
- FilterStudio's honest A/B toggle delivers the credibility shift Round 1 most needed.
- MATRIX is no longer pretending to be a decision surface — it now *is* one, with scenarios that genuinely reshape weights, a best-cell call-out, and a legend that explains the color.
- H.E.A.A.L.'s "every metric matters twice" lede is the right bridge for a data-center buyer who still cares about the healthy-buildings story — it reframes TVOC/CO₂/RH coherently rather than swapping the tiles for office-IAQ-shaming metrics.
- Archetype particles now visibly show "many in → most filtered → few out" without requiring a reader to read the panel copy.
- The "Request the inventory brief" mailto secondary CTA is the right low-friction add within the brief's no-backend envelope.

### Biggest concerns

- **The wedge is still modeling-against-modeling.** Correctly out of scope this round, but it caps the ceiling. The first procurement conversation will still ask "show me one operator who paid you and got Y."
- **The three products still read as workstreams of one consulting engagement, not three independently purchasable things.** Brief-respectful (no productized SKUs), but a buyer still can't tell their procurement team "we want to buy X."
- **H.E.A.A.L. tiles speak office-IAQ language.** Lede does heavy lifting; for ESG/sustainability audiences this works. For a hands-on data-center ops lead it's the section most likely to draw "but where's my ASHRAE envelope?"
- **The MATRIX pull-quote still surfaces 2%/$40k as the takeaway.** The panel framing is now correct ("modeled example finding · representative archetype"), but the closing line reasserts the small number where the page should celebrate the capability.
- **Both CTAs are mailtos.** Brief-respectful, but a static Calendly URL is in-scope and would convert the warmest visitor segment without forcing them through Mail.app.

### What this reviewer most wants

1. **Add one anonymized engagement card to the FilterStudio section if a real engagement exists.** "A 280-MW Northern Virginia operator · 18-month modeled filter swap · $Y validated against utility data." Highest-leverage addition possible — converts page from meeting-earner to meeting-closer.
2. **Demote the MATRIX 2%/$40k pull-quote to a worked-example caption.** Let the pull-quote celebrate the *capability*; let the small number live inside the panel as a kv-table footnote.
3. **Swap the primary CTA from mailto to a static Calendly URL.** No backend, no CRM, no scope creep — a single `href` change.
4. **Add one sentence per product naming the engagement model.** "Delivered as a modeling report" / "as a modeling engagement and decision surface" / "as a sensor deployment and operating dashboard." Brief stayed out of pricing; it didn't exclude naming the *form* of the deliverable.
5. **Add a one-line geographic framing: "Virginia today; your portfolio next."** Eight words. Free conversion lift.

## Reviewer page: solo_bd_director

### Main judgment

BD reads Round 2 as the page that the brief said the team was building, executed honestly. The three things BD would have had to apologize for in a forwarded link — random H.E.A.A.L., cosmetic FilterStudio toggle, "bios coming soon" team placeholder — are all gone. The page is now safe to send. Trust score moved from 2.5/5 to 4/5 — the biggest single-round jump across any reviewer's dimensions. The $39.9M is finally a forwarded-email hook with the methodology breakdown attached so a champion's CFO can interrogate it. Within the brief's scope, the most important remaining BD gap is the conversion path: a static Calendly link in the hero would do more for BD's pipeline than any other in-scope change. Geographic scope leak and the still-empty inventory side-panel default state are smaller in-scope misses.

### Biggest praise

- The `$39.9M` `fs__headline` band is a forwarded-email hook: one big number, methodology pill, four named sub-components. Survives a forward and answers "how did you get there?" in the same glance.
- Interactivity now confirms substance instead of undermining it. v1 was actively losing trust at exactly the points the page was trying to build it.
- H.E.A.A.L.'s "every metric matters twice" lede answers the Apollo PM critique without abandoning the healthy-buildings framing. A data-center ops lead reads their own pain (drift before downtime) before the public-health framing kicks in.
- "Disciplines on the engagement" reframe sounds intentional. Capability cards now read as a staffing model, not as placeholders waiting for headshots.
- MATRIX reframe ("modeled example finding · representative archetype" + the "the point isn't the per-site number" pull-quote) takes a number below the noise floor and reframes it as methodology demonstration. Sellable on a call.
- The "Request the inventory brief" secondary CTA with preloaded subject + body is the right low-friction add within the no-backend constraint.

### Biggest concerns

- **Both CTAs are mailtos.** A motivated prospect at 11pm doesn't open Mail.app. The brief allows static-friendly approaches; the implementation went mailto-only when third-party calendar links and form-iframes qualify under the brief's prohibition (which was aimed at multi-step backend funnels). Highest-leverage remaining BD gap.
- **No flagship pre-selected site in the inventory side-panel.** "Site detail · Hover or tap a site" empty state wastes the highest-attention moment. A real default (Ashburn campus, named eGRID region) would demonstrate capability instead of prompting interaction.
- **Geographic scope is Virginia-only with no "your portfolio next" bridge.** Hyperscaler infra teams operate Phoenix, Hillsboro, Dublin. One sentence in the inventory would close this.
- **The inventory section still does interactive curiosity, not BD work.** Brief excluded a portfolio-screening form; that's fine. But a single in-section "Want your portfolio modeled?" CTA pointing to the same mailto would catch high-intent visitors at peak realization.

### What this reviewer most wants

1. **Replace the primary CTA's mailto with a Calendly/Cal.com/SavvyCal link.** Static, brief-compliant, zero scope creep — and the single highest-leverage BD change available.
2. **Add a third static CTA in the inventory section.** One line in the `map-panel__note`: "Want your portfolio modeled? Request the inventory brief →".
3. **Add a "Virginia today; portfolio-ready elsewhere" framing line** to the inventory section.
4. **Pre-select a flagship site in the inventory side-panel on load.** Real defaults; demonstrate capability instead of showing empty state.
5. **Add scroll-spy / active-section state to the topnav.** (Note: this *did* land in Round 2 — BD didn't see it. Worth confirming visually that the active state is firing as expected.)

## Which findings to prioritize next sprint

1. **Swap the primary CTA from mailto to a static Calendly link.** BD names this as the single highest-leverage in-scope remaining change; Apollo agrees. The brief's prohibition was on multi-step backend funnels — a third-party calendar link is the static-friendly opposite. One `href` change unlocks materially better warm-prospect conversion.
2. **Demote `.fs__headline-stats` into a caption strip.** UI's single biggest hierarchy find. Drop tile chrome, demote `b` size, gap 28px with a top border. The `$39.9M` becomes 3× louder by subtraction. ~15 lines of CSS.
3. **Eliminate the last three pieces of theater on the page.** Wire (or remove) H.E.A.A.L. 7d/30d range chips. Strip hardcoded `.hl__status` `<li>`s. Drive the Society pillar from `FS_VALUES` (or label as scenario-invariant). Three small fixes, collectively close the last "is this real?" doubt.
4. **Wrap the headline `M` suffix in `<span class="u">`.** Stops the gradient from being applied to a proportional-weight unit. Splits markup + `countUp()` adjustment.
5. **Pre-select a flagship site in the inventory side-panel on load.** Real default site card; demonstrates capability instead of showing empty-state copy.
6. **Add a geographic intent line and a third inline inventory CTA.** Both are in-scope and under an hour each. Closes BD's geographic-scope leak and adds a conversion surface at peak prospect intent.
7. **Reconcile `~$40M` (hero) and `~$39.9M` (FilterStudio).** One number consistently across the page.
8. **Make filtration visible at the filter face.** Compress the 85% filtered population into a brief moment of accumulation at the INTAKE rectangle. UX's archetype find. Larger touch than the others but the only remaining honest-interaction gap.
9. **Demote the MATRIX 2%/$40k pull-quote to a worked-example caption.** Let the pull-quote celebrate the capability; keep the small number as a kv-row footnote. Apollo's product-narrative find. Copy edit.
10. **Add engagement-model language under each product header.** "Delivered as a modeling report" / "as a modeling engagement and decision surface" / "as a sensor deployment and operating dashboard." Six extra words per section; no SKUs, no pricing, no fabrication.

## Where reviewers genuinely disagree

The most substantive disagreement isn't between reviewers — it's between the reviewers and the implementation's reading of the brief. **The mailto-only CTA stance.** BD and Apollo both treat a static Calendly link as in-scope under the brief's "static-friendly secondary path" allowance (the no-backend prohibition was aimed at multi-step funnels with server logic). UX agrees the mailto has friction but doesn't push the substitution. The implementation interpreted the brief's CTA strategy more conservatively — keeping "Talk to an expert" as a mailto and adding a second mailto for the inventory brief. Whether to act on the Calendly recommendation in Round 3 is a strategic call: was the implementation's choice strict-but-defensible or unnecessarily conservative? Worth resolving explicitly before Round 3, since BD names it as the single highest-leverage in-scope BD gap.

A smaller disagreement is on **how to fix the MATRIX section's remaining narrative weight problem**. UX reads the heatmap rebuild as having mostly addressed the visualization-quality concern; the residual issue is just the inconsistent `~$40M`/`~$39.9M` and the empty Society pillar. Apollo, however, says the section's *pull-quote* still surfaces 2%/$40k as the takeaway when MATRIX's narrative weight comes from the decision-surface *capability*, not from the per-archetype number. The disagreement is essentially: did the MATRIX reframe go far enough (UX) or did it stop at panel-level reframing without rewriting the section's last paragraph (Apollo)? The right answer is to do both: ship UX's small fixes *and* take Apollo's pull-quote demotion. Cheap to do; closes both lenses.

A third smaller disagreement is on **the H.E.A.A.L. tile content question**. Apollo reads the new "every metric matters twice" lede as good framing but still flags that the actual tiles speak office-IAQ language and a data-center ops lead will read "wrong jersey" before the lede catches them up. UX, UI, and BD all read the lede + deterministic profiles as sufficient. Apollo's framing of this as a brief-respectful tradeoff ("the brief did not ask the team to change tiles; they chose framing over content") is the right way to read the disagreement: not a defect, a deliberate scope choice. If 9F wants to address it later, the brief will need to allow tile changes.

## What's missing from the review

The four-reviewer pack covers UX + UI + customer-as-buyer + revenue-owner perspectives well, but several disciplines are still not meaningfully represented in this Round 2 audit. The following disciplines would meaningfully inform Round 3:

- **Performance / web-vitals testing.** Round 2 added scroll-spy, ResizeObservers on three charts, an animated archetype particle loop, and increased the deterministic H.E.A.A.L. work. Nobody in this review measured time-to-interactive, scroll-jank on mid-range Android, or memory growth from the long-running rAF loops. **Why it matters:** the page's hero asset (the 412-dot map) is also its heaviest render path; degraded mobile performance hits the BD outbound use case hardest. **Suggested persona:** staff performance engineer.
- **Accessibility audit beyond reduced-motion.** UI noted tabular-nums, UX noted reduced-motion holds. Nobody audited keyboard-only navigation across the 412 map dots (all `tabindex=0`), screen-reader labeling of the new `fs__headline` banner, focus order through the FilterStudio toggle + pillar accent border-state, or color-contrast on the cyan-vs-violet status encoding. **Why it matters:** procurement-grade buyers increasingly gate vendors on WCAG conformance. **Suggested persona:** a11y specialist.
- **Methodology defensibility audit.** Round 2 made Harvard CoBE attribution more prominent; the page now leads with auditable methodology as a trust signal. Nobody on the review pack is qualified to assess whether the CoBE application is defensible against a procurement-grade audit, what assumptions are load-bearing, or where a competitor's CTO would push back. **Why it matters:** the moment the page works (i.e., earns first meetings), this is the second question that gets asked. **Suggested persona:** building-physics / energy-modeling specialist with ASHRAE 90.1 or DOE Asset Score experience.
- **Legal / NDA / data-handling.** No reviewer raised this. If the next Round 3 addition is portfolio-screening (BD's #4 ask), the implementation moves operator site-level data into 9F's hands — with implications around NDAs, data residency, and security review. **Why it matters:** the proposed BD upgrade introduces a real legal surface that must be designed before launch, not after first inbound. **Suggested persona:** GC equivalent with security/data-handling experience.
- **Outbound playbook + sales enablement.** BD identified the page as now safe to ship, but didn't assess whether 9F has the rest of the outbound stack (sequences, intent data, ABM target lists) to actually convert this page into pipeline. **Why it matters:** even a launch-ready page does not generate pipeline alone. **Suggested persona:** B2B sales enablement lead with technical-product GTM experience.

## Bottom line

Round 2 satisfied the definitive execution brief. Every primary remediation requested — honest interactivity, hero-tier hierarchy on the $39.9M finding, intentional team framing, design-system discipline — landed. Trust scores moved 2–3 points across reviewers; the page is safe to ship and safe to put into outbound. The single most surgical Round 3 change available is swapping the primary CTA's mailto for a static Calendly link, which all three buyer-adjacent reviewers (Apollo + BD + UX implicitly) treat as in-scope and high-leverage. The next-most-important Round 3 changes are the small craft cleanups UI and UX identified — they're token-and-selector size and collectively under a half-sprint. The ceiling above all of that — one anonymized customer engagement — is correctly outside this page's brief and belongs to 9F's broader business-development roadmap, not to the next implementation sprint.
