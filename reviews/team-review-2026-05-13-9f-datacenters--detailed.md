# Team review — 9 Foundations Data Centers landing page — Detailed report

**Date:** 2026-05-13
**Slug:** 9f-datacenters
**Source:** team-review-2026-05-13-9f-datacenters.md

## Detailed report

## Summary pages

### Summary page 1: overall picture

The 9 Foundations Data Centers landing page is a pre-launch single-page static site whose stated purpose is to introduce three offerings — FilterStudio, MATRIX, H.E.A.A.L. — alongside a proprietary 412-site Virginia data center inventory, all anchored by Dr. Joseph Allen's Healthy Buildings credentials. Four reviewers — senior UX, senior UI, an Apollo PM evaluating the page as a potential customer, and 9F's solo BD Director evaluating it as a sales tool — converge on a remarkably consistent verdict despite working in different lenses: the page successfully establishes 9F's analytical and scientific credibility, but it does not yet deliver the operational substance that an engineer, CFO, or procurement officer would need to advance the conversation. It is, in the BD Director's framing, "a beautiful science-consultancy brochure with one genuinely differentiated asset and a credible Harvard-anchored bio" that nevertheless leaks at every point where an actual buyer would need a hook, a path, a leave-behind, or a number tied to an engagement they could believe in.

The page reads as v0.9 in product maturity. The structural spine is right — numbered section eyebrows, an inventory section that earns its real estate, a five-pillar value framing (Energy / Health / Performance / Society / Dollars) that is sticky and differentiated, a hero that bridges market stakes with the proprietary asset in one read — and the typography, motion taste, and dark-technical brand register are all defensible. The collapse happens at the points where the page is supposed to *demonstrate* analytical rigor: the FilterStudio A/B toggle is cosmetic, the MATRIX heatmap is "beautiful but unhelpful," the H.E.A.A.L. dashboard reshuffles on every floor toggle and the building score `Math.random()`s itself. For an audience that the page itself invokes — peer-review-grade rigor for engineers and CFOs — the first interactive prod reveals the dashboards as theater. The static copy on this page is more credible than the interactive surfaces are.

The second structural problem is conversion architecture. One CTA — a mailto to "Talk to an expert" — exists across a long page that introduces a proprietary inventory, three products at different commercial motions, a methodology hook (Harvard CoBE), and a headline finding ($39.9M annual co-benefits across Virginia). There are no logos, no named or anonymized case studies, no pricing or "starts at" anchor, no leave-behind PDF, no portfolio-screening offer, no calendar link. From Apollo's seat, this signals consulting hours rather than productized offerings. From BD's seat, every motivated visitor who isn't already pre-qualified bounces with no fingerprint left behind. Both reviewers describe this as the single most important architectural change available.

### Summary page 2: core themes

The first cross-cutting theme is **interaction-credibility inversion**. UX and BD independently flag that the page's interactivity actively *undermines* the credibility the static copy works hard to establish. The FilterStudio A/B/Compare toggle fades pillar opacity but doesn't redraw the charts or change the numeric readouts. The MATRIX scenarios multiply all heatmap cells by 0.985 / 0.992 / 0.975 — the eye can barely see the shift, and the only thing that actually updates is the readout text below. The H.E.A.A.L. sensor grid re-rolls cell colors from a stateless RNG on every floor toggle, and the building IEQ score `Math.random()`s between 78 and 92. A curious visitor reaches into the page expecting *this is real* and immediately encounters *this is decoration*. For a peer-review-grade rigor pitch, that is the most damaging single class of issue on the page. UX puts it sharply: "the bar here is 'every interaction confirms the substance' — and right now, several do the opposite."

The second theme is **the page is a brochure, not a tool**. Apollo and BD independently arrive at the same operational verdict: this page elevates 9F's perceived rigor but does no BD work. No logos, no named clients, no pricing transparency, no engagement-model clarity (is FilterStudio software, a study, a subscription, a deliverable?), no leave-behind, and exactly one high-friction CTA mailto. Both reviewers say it is "good enough to put in outbound tomorrow" as a credibility prop but inadequate for advancing the second conversation. The Virginia inventory — the strongest single asset on the page — currently performs interactive curiosity (hover-to-see-PUE) rather than conversion ("is your site in our model? drop your portfolio list"). That conversion surface is staring everyone in the face.

The third theme is **product narrative weight and positioning**. Apollo and BD both call out that the three products read as a coherent stack from the outside but blur into a single consulting engagement from a buyer's seat — and that the middle act (MATRIX) is structurally underweight at "up to 2% / ~$40k." Apollo is sharpest here: MATRIX's headline number is below the noise floor of competing optimization pitches and should either be replaced with a portfolio-scale figure ($16M+) or demoted inside FilterStudio. H.E.A.A.L., per Apollo, is wearing office-building IAQ language (TVOC, CO₂, occupant comfort) when the data-center buyer cares about ASHRAE TC 9.9 envelope drift, particulate ingress on electronics, corrosion risk, and hot-aisle anomalies. These are product-narrative problems, not copy problems, and they cap how much the page can advance even with the interaction-credibility and conversion-architecture fixes.

The fourth theme is **craft is close, not arrived**. UI identifies the page as well above template-grade but a half-tier below Deloitte Cloud Insights: the cyan gradient is over-applied (six different "this matters" treatments compete), numerics aren't running on tabular figures (so digits wobble width during count-up), and the three product charts speak three different chart dialects — FilterStudio has a real system, MATRIX invents its own minimalism, H.E.A.A.L. sparklines have no axis at all. UX flags hover/active states absent on the topnav and the lack of scroll-spy on a long-scroll page. UI's proposed fixes are mostly tokens and selectors, not redesign — meaning a focused craft pass could move the page meaningfully in two or three days of work.

## Reviewer page: ux_agency_lead

### Main judgment

The UX lead reads this as an ambitious v0.9 — the page's structure, hero, inventory grouping, and reduced-motion discipline are real strengths, but the interactive surfaces that should be the page's strongest moments are its weakest. Three of the page's centerpiece interactions are flagged as actively misleading: the FilterStudio A/B toggle is opacity theater, the MATRIX heatmap teaches nothing (no color legend, no annotated best cell, scenarios barely shift the field), and the H.E.A.A.L. sensor grid plus building score randomize on every floor toggle. The verdict is "polished enough to ship for a sales conversation; not yet at the bar where dense information feels worth exploring on its own." The page presents more than it teaches, and several of its analytical moments fall directly into the design brief's anti-pattern list ("beautiful but unhelpful," "dashboard aesthetics without true analytical clarity").

### Biggest praise

- Hero earns its real estate — three proof numbers (10%, $40M, 412) span market stakes, value, and proprietary asset in one read.
- Section eyebrows do real wayfinding work; numbered TOC pattern reads like a paper, not decoration.
- Inventory toolbar spatial logic (legend left, filters right, ranges below, panel beside) mirrors cognitive logic.
- Reduced-motion is genuinely honored across count-ups, hero canvas, particles, and scroll.
- The closing CTA panel is specific enough to actually click.

### Biggest concerns

- **FilterStudio's $39.9M takeaway is buried under five visually-equal pillars.** The single most important finding on the page competes with "A wins / B wins" mono-cap labels and isn't visually 2–3× louder than its supporting metrics.
- **The FilterStudio A/B/Compare toggle is dishonest motion.** It fades pillar opacity but doesn't redraw charts or change readouts — training visitors within seconds to distrust the rest of the page's interactivity.
- **The MATRIX heatmap is the page's worst chart-junk moment.** No color legend, no best-cell annotation, no axis ticks beyond two endpoint labels, scenarios multiply cells uniformly so the field barely changes between Baseline / Envelope / Setpoints / All.
- **H.E.A.A.L. randomizes sensor grid AND building score on every floor toggle.** The implicit contract of "real data about this building" is broken the moment a curious user taps Floor 1 / 2 / 3.
- **The archetype particle animation doesn't show filtration.** Outdoor particles deflect *up and away* from the building rather than entering through INTAKE and emerging fewer through EXHAUST — so the section's core teaching ("more particles outside, fewer inside after filtration") is decoration, not didactic.
- **Topnav has no scroll spy, no active state, no progress indicator.** On an eight-section long-scroll page, visitors have to carry the structure in their head.
- **Some hero stats lack source/citation precision** (the 40% global energy & emissions stat in particular) — small but consequential for the CFO/engineer reader.

### What this reviewer most wants

1. **Promote the $39.9M to a hero-tier moment inside FilterStudio.** Pull it out of the five-up pillar grid and make it a full-width banded result with the four breakdowns (206,419 MWh, $36.7M, $2.83M, $369k) as captioned children. Stop saying it twice (pillar + later callout block).
2. **Make the FilterStudio toggle actually swap the data.** A vs B should redraw both curves and update pillar readouts; Compare should be the default state with both at full strength.
3. **Rebuild the MATRIX heatmap as a decision surface.** Annotate the best cell per scenario; add a color scale legend ("worse ← energy use → better"); make scenarios visibly reshape the gradient — not just multiply uniformly.
4. **Seed the H.E.A.A.L. sensor grid and building score with three deterministic per-floor profiles.** Stable, recognizable, spatially structured (hot corner near a window, cool zone near a vent). Score sits at e.g. 86 / 82 / 91 across floors.
5. **Add a scroll-spy progress rail and `is-active` topnav state.** Cheapest single win for orientation on a long page.

## Reviewer page: ui_brand_systems_lead

### Main judgment

The UI lead reads the page as well above template-grade but a half-tier below the Deloitte Cloud Insights bar referenced in the brief. The type stack (Space Grotesk + Inter + JetBrains Mono) is right, the pillar component has a genuine point of view, the kv list is genuinely premium, and the motion taste is restrained. But three system-level issues drag the page down: numerics aren't running on tabular figures (so they wobble during count-up animation), the cyan gradient is doing six different "this is important" jobs simultaneously and has stopped functioning as emphasis, and the three product charts speak three different chart dialects rather than reading as siblings. The fixes are mostly tokens and selectors, not redesign — the ceiling is high if the right pass lands.

### Biggest praise

- Type system is consistently applied; eyebrow numbering reads like a paper TOC, doing real wayfinding work.
- Pillar atom (left accent bar, accented variant for Dollars, consistent rhythm) is the strongest component on the page.
- kv list is genuinely premium — mono right-aligned values, dashed rules, baseline alignment.
- Color restraint shows in the right places (map's two-color existing/planned encoding; tabular-nums applied locally on the legend).
- Motion has taste — pulse eyebrow, dashoffset reveals, staged dot reveals, all with reduced-motion fallbacks.

### Biggest concerns

- **Numerics aren't tabular across the entire page.** During count-up animation and on hover-driven readouts, digits literally shift width. On a Deloitte-bar data interface this is the single most visible craft tell.
- **The cyan gradient is overused.** It's the hero `em`, the stat numbers, the Dollars pillar, the FilterStudio callout, the impact metric numbers, the H.E.A.A.L. score — six different "important" treatments. When everything wears the same gradient, nothing reads as emphasis.
- **Three different chart dialects across the three products.** FilterStudio has a real chart system; MATRIX invents its own minimalism (no axis ticks, no legend); H.E.A.A.L. sparklines have no axis at all. The product trio should read as one studio.
- **Inverted hierarchy inside product panels.** Panel sub-titles render at h3 size next to pillar metrics at 1.7rem — the panel's own headline is quieter than its supporting metric.
- **Section eyebrow → h2 spacing is too loose.** Eyebrow-to-h2 reads as the same gap as h2-to-lede, so the eyebrow doesn't visually belong to the h2.
- **Pillar metric units are typographically inconsistent.** `.pillar__metric span` (kWh/y) and `.u` (M) are styled differently while doing the same job.
- **`.card:hover` border-cyan applies to every card type.** Static stat cards light up the same as interactive map dots — hover stops being a signal.
- **Map legend size-scale dots are white but actual map dots are cyan or violet.** The legend teaches a color the map doesn't speak.

### What this reviewer most wants

1. **Add `font-variant-numeric: tabular-nums` to all display numerics.** Single 8-line CSS rule covering `.proof__num, .stat__num, .counter, .pillar__metric b, .hl__score-num span, .card--imp b, .fs__callout-stats b, .tile__val b, .mx__readout b, .kv dd, .map-ranges span`. Highest-leverage single change on the page.
2. **Reserve `--grad-1` for exactly one element per section.** Strip it from `.stat__num` and `.hl__score-num span`; keep it on `pillar--accent`, `.fs__callout h3`, `.card--imp b`, and the hero `em`.
3. **Fix the section_head rhythm.** Eyebrow-to-h2 margin ~8px; h2-to-lede ~22px. Eyebrow should feel attached to h2.
4. **Build a single chart-axis vocabulary and re-render MATRIX + H.E.A.A.L. against it.** Add `.chart-axis` class and a `--chart-grid` token; inline legend strips under heatmap and sparklines.
5. **Restrict `.card:hover` border-cyan to a `.card--interactive` modifier.** Map dots and clickable cards bloom; stat cards stay inert.
6. **Match legend dot color to the map encoding** (cyan + violet split, not white).

## Reviewer page: apollo_product_design_lead

### Main judgment

The Apollo PM, evaluating as a potential customer with a 60–90 second decision window, reads the page as a credible thought-leadership site for a Harvard-anchored advisory practice dressed up as a product page. The thesis is differentiated (healthy-buildings logic applied to data centers, with public-health and climate damages monetized via Harvard CoBE), the Virginia inventory is a genuine wedge, and Joe Allen's credentials buy the meeting — but the page does not answer the buyer's most basic questions: what am I buying, what does it cost, what do I get in week one, who else has done this, and what number does it move on my P&L. The verdict: "I would forward it to my sustainability lead. I would not forward it to my COO." The page is one positioning iteration and one packaging iteration away from being a product page; today, it advances a meeting but not a purchase decision.

### Biggest praise

- **Virginia inventory is a genuine wedge.** 412 parameterized sites is something McKinsey/JLL/CBRE don't have in this shape — meeting-worthy on its own.
- **Joe Allen's bio is a door-opener.** Harvard, Healthy Buildings book, Lancet Commission, JAMA/Science/Lancet papers — that's procurement-grade trust.
- **The five-pillar lens is differentiated framing.** Energy + Health + Performance + Society + Dollars is the only competitor in this category putting public-health and climate damages in dollars alongside fan-energy savings.
- **Numbers have specificity.** 206,419 MWh, $36.7M / $2.83M / $369k, $0.18/kWh assumption stated — argueable means believable.
- **CoBE attribution is a trust move.** Naming Harvard's tool rather than inventing a proprietary "Impact Score™" signals auditable methodology.

### Biggest concerns

- **I cannot tell what I'm buying.** FilterStudio: software? Study? Subscription? Same question for MATRIX and H.E.A.A.L. "Talk to an expert" = consulting hours.
- **The flagship $39.9M is statewide and counterfactual against an unidentified filter swap.** As a buyer I can't act on it — which filters, against what baseline, in what config?
- **MATRIX's "up to 2% / ~$40k" is below the noise floor of competing pitches.** Either the headline is sandbagged or MATRIX is the weakest product and should not be the middle act.
- **The three products blur into one consulting engagement.** No indication they can be bought independently, no entry-point guidance, no pricing or deployment timeline per product.
- **H.E.A.A.L. is wearing office-building IAQ language.** TVOC, CO₂, occupant comfort don't match data-center pain (ASHRAE TC 9.9, particulate ingress on electronics, corrosion, hot-aisle anomaly). Wrong jersey.
- **No customer logos, no pilot quotes, no named deployments.** Joe's CV is the only third-party validation. Team-bio placeholder ("bios coming soon") reads as pre-launch, not pre-revenue-proven.
- **mailto: CTA is a friction trap.** A buyer with 60–90 seconds doesn't open Mail.app to send a cold email — calendly link, qualifying form, or "request the inventory sample" would convert.

### What this reviewer most wants

1. **Sell the Virginia inventory as a discrete SKU.** Name it ("Virginia Data Center Intelligence Brief" or similar), price-band it, give it a 2-week delivery promise. That's a $25–75k entry door that gets the consulting-hours objection off the table.
2. **Replace one CTA with three offer-specific CTAs.** "Get the inventory sample (10 sites, free)" / "Run a FilterStudio comparison on my spec" / "Pilot H.E.A.A.L. on one building" — each matches a different buyer intent and budget authority.
3. **Reframe MATRIX around a number an operator actually feels.** Either lead with portfolio-scale ($16M+), lead with a specific intervention class (envelope retrofit payback), or demote MATRIX inside FilterStudio.
4. **Add one named or anonymized pilot with before/after numbers.** "A top-5 colocation operator, 80MW NOVA campus, modeled filter swap → $Y over 18 months, validated by Z" — converts the page from thought-piece to product.
5. **Rebuild H.E.A.A.L. around equipment risk, not occupant comfort.** ASHRAE TC 9.9 envelope drift, particulate ingress on electronics, corrosion risk, hot-aisle anomaly detection — the language a data-center operator pays for.

## Reviewer page: solo_bd_director

### Main judgment

The BD Director, evaluating whether this page is actually useful as a sales tool, reaches a sharp verdict: "I'd put this in my outbound stack tomorrow because it elevates 9F's perceived rigor and because Joe + 412 sites is a real hook. But I'd fight for a leave-behind PDF, a portfolio-screening offer, and at least one named-or-anonymized client engagement before Q2 — otherwise the page is a brochure, not a tool." The page is currently a credibility prop, not a pre-qualifier. Every motivated visitor who isn't already warm bounces with no fingerprint — no email capture, no gated PDF, no portfolio-screening offer, no calendar link, no logos, no engagement-model clarity. The Virginia inventory does interactive curiosity (hover-to-see-PUE) where it should do conversion ("is your site in our model? drop your portfolio list").

### Biggest praise

- **The Virginia inventory is a legitimate door-opener.** "We've already modeled your Ashburn campus" is a hook nothing else in the outbound stack matches.
- **Joe Allen's bio is procurement-grade trust.** Carries the whole credibility section even with the rest of the team unnamed.
- **The five-pillar framing is sticky and quotable.** Champions can use it internally to describe what 9F does.
- **$39.9M headline survives a forward.** Specific, methodologically anchored, big enough to wake a CFO; granular breakdown supports it.
- **Three products read as a coherent stack.** Inventory → MATRIX → FilterStudio → H.E.A.A.L. — sellable as one capability or pitched as any single entry wedge.

### Biggest concerns

- **One CTA, and it's the highest-friction one.** mailto to "Talk to an expert" — leaks 90%+ of visitors with no fingerprint.
- **Zero client trust signals.** No logos, no named or anonymized case studies, no testimonials. Procurement's first question ("who else have you done this for?") has no answer here.
- **Case-study numbers read as modeled headlines, not engagements.** $39.9M is statewide modeling; the 2% / $40k MATRIX figure is the only thing that smells like a real engagement, and it's a throwaway.
- **No proof of what I sell them.** No engagement model, no pricing range, no deployment timeline, no scope clarity — so I pre-qualify on every call myself.
- **Team-bio placeholder ("bios coming soon") undercuts credibility.** A TODO shipped to production makes the champion look careless.
- **Virginia inventory does theater, not BD work.** No "find your site," no "we identified $X for your portfolio," no email capture, no portfolio-screening form.
- **Geographic scope is a leak.** Hyperscaler infra teams operate Phoenix, Dublin, Singapore — page never says whether 9F works outside Virginia.
- **The anonymized archetype is generic enough that nobody recognizes themselves.** "743,224 m³, 280 MW, DLC" reads textbook — needs archetype-recognition breadcrumbs.

### What this reviewer most wants

1. **Add a leave-behind PDF and an email-capture surface.** Minimum: "Get the Virginia data center inventory brief (PDF)" gated by email. Better: "Request a no-obligation portfolio screening — drop your site list, we'll return a modeled co-benefits estimate in 10 business days."
2. **Add a calendar link to "Talk to an expert"** so motivated prospects can self-book without the email volley.
3. **Get one named or anonymized client case study on the page.** Better: an institutional logo bar — Harvard, partner research bodies — even if real client logos don't exist yet.
4. **Make the inventory section do BD work.** "Is your site in our model?" lookup or "Drop your portfolio address list — see which sites we've parameterized." Convert the visual centerpiece into a pipeline-generation surface.
5. **Name the team or pull the section.** Placeholder is worse than no section. Replace with a one-line "Team led by Dr. Joseph Allen and a team of building scientists from Harvard and partner institutions" if real bios aren't ready.
6. **State geographic intent explicitly.** "Virginia today, your portfolio next" or similar — neutralize the implicit "this only applies to Loudoun" question.

## Which findings to prioritize next sprint

1. **Wire the FilterStudio toggle to actually swap the data.** UX + UI both flag this; from a credibility standpoint this is the most damaging single interaction. Make A vs B redraw the curves and swap pillar readouts; make Compare the default and only state with both at full strength.
2. **Seed H.E.A.A.L. floor profiles deterministically and stop `Math.random()`ing the building score.** UX + BD both call this credibility theater. Three fixed per-floor profiles with realistic spatial structure; building score sits at stable believable numbers per floor.
3. **Rebuild MATRIX as a decision surface** with color-scale legend, annotated best cell, and scenarios that visibly reshape the gradient — and *resolve the narrative weight question* (is MATRIX the middle act with a portfolio-scale number, or is it a methodology footnote inside FilterStudio?). UX wants the visualization rebuilt; Apollo wants the narrative repositioned. Both changes can ship together.
4. **Add a leave-behind PDF, an email-capture surface, and a calendar link.** BD + Apollo both call this out as the single largest conversion gap. Replace the one mailto CTA with at least two offer-shaped paths (inventory brief PDF + calendar booking).
5. **Get one named or anonymized client engagement on the page.** Apollo + BD both flag this as the second-meeting killer. Even "a top-5 colocation operator, 80MW NOVA campus" with one real before/after number converts the page.
6. **Run the craft-token pass.** UI's tabular-nums, gradient discipline, hover-state semantics, shared chart-axis vocabulary, and section_head rhythm fixes. ~30 lines of CSS, half-tier perceived-craft lift.
7. **Reframe H.E.A.A.L. metric language around equipment risk** (ASHRAE TC 9.9, particulate ingress on electronics, corrosion, hot-aisle anomalies) rather than office IAQ (TVOC, CO₂, occupant comfort). Apollo's unique product-positioning find.
8. **Name the team or replace the placeholder.** BD's tactical call — the "bios coming soon" line is shipping unfinished work.
9. **State geographic intent explicitly.** Single line, fixes BD's leak on hyperscaler outbound.
10. **Add scroll-spy + active topnav state.** UX's cheapest orientation win.

## Where reviewers genuinely disagree

The most substantive disagreement is on **MATRIX**. The UX lead wants the heatmap rebuilt as a decision surface (better axis treatment, color legend, best-cell annotation, scenarios that visibly reshape the gradient) — i.e., the design problem is *the visualization doesn't teach*. Apollo wants MATRIX's narrative weight reconsidered entirely — "up to 2% / ~$40k" is below the noise floor of competing optimization pitches, and either the headline needs to be replaced with a portfolio-scale number ($16M+) or the product should be demoted inside FilterStudio. The disagreement is about *what the section is*: a chart that fails to teach (UX) versus a product that is structurally underweight as the middle act (Apollo). Both can be acted on simultaneously, but if forced to choose: Apollo's diagnosis is upstream of UX's — if the narrative is being repositioned, the visualization should follow, not lead.

A secondary disagreement is on **the H.E.A.A.L. dashboard's metrics**. UX flags the randomization-on-floor-toggle as the credibility bug; the prescription is "seed deterministic per-floor profiles." Apollo flags the metric *choice itself* (TVOC, CO₂, occupant comfort) as wrong for the data-center buyer; the prescription is "rebuild around equipment risk language." If the team only seeds the existing TVOC/CO₂ tiles deterministically per UX, Apollo's product-positioning find is unaddressed. The right move is both: seed the dashboard, *and* swap the metric set to ASHRAE TC 9.9 envelope drift, particulate ingress, corrosion risk, hot-aisle anomalies.

A third, smaller disagreement: UX advocates promoting the FilterStudio $39.9M from a pillar tile to a hero-tier banded result; UI advocates demoting the cyan gradient that currently makes the Dollars pillar (and five other things) read as equally emphasized. Both want the same outcome — the headline finding should be visibly louder than its supporting metrics — but they describe the fix in opposite vocabulary (promote one / demote the other five). Resolved by doing both.

## What's missing from the review

The four-reviewer pack runs UX + UI + Strategic Customer + Buyer-Operator. Several disciplines are not meaningfully represented and should be considered for the next cycle:

- **Analytics rigor / data science / methodology audit.** The page makes specific modeled claims ($39.9M, 206,419 MWh, $2.83M, $369k) anchored to Harvard CoBE. None of the four reviewers is qualified to assess whether the methodology is defensible against a procurement-grade audit, what assumptions are load-bearing, or where the modeling would be challenged by a competitor's CTO. **Why it matters:** Apollo and BD both flag the absence of named engagements; the *next* objection after that is "I want to see your methodology paper." **Suggested persona:** building-physics modeling / data science lead with experience in energy modeling certification (ASHRAE 90.1, DOE Asset Score, or similar).
- **Performance / load behavior of the inventory section.** The page renders 412 SVG dots, two D3 charts, a heatmap, four sparklines, a hero canvas particle field, and an isometric archetype scene. None of the four reviewers tested page-weight, time-to-interactive, or mobile-CPU behavior on a mid-range Android. **Why it matters:** the inventory is the strongest asset and the highest-cost render path. If it stutters at 360px wide on a 3G connection, the BD outbound use case suffers most. **Suggested persona:** staff performance engineer / web-vitals specialist.
- **Accessibility audit beyond reduced-motion.** UI noted tabular-nums; UX noted reduced-motion is honored. Neither audited keyboard-only navigation across the map dots (which use `tabindex=0` and are 412 of them), color-blind safety of the cyan-vs-violet status encoding, screen-reader labeling of the data-card panel, or focus-order through the chips and scenario toggles. **Why it matters:** for a science-credible brand pitching to enterprise buyers, WCAG-conformant interaction is increasingly a procurement gate. **Suggested persona:** a11y specialist.
- **Competitive intelligence on Vertiv, Phaidra, ETI, Camfil, nVent, Schneider EcoStruxure.** Apollo gestured at this but didn't run a real positioning audit. Is "healthy-buildings logic applied to data centers" actually defensible, or is somebody else within 12 months of shipping a similar pitch? Where does 9F's pricing need to land relative to incumbent BMS / DCIM offerings? **Why it matters:** the differentiation thesis is the entire wedge. **Suggested persona:** competitive-intelligence lead with experience in data-center infra category.
- **Legal / compliance / data privacy.** The BD recommendation includes "drop your portfolio address list" as a portfolio-screening offer. That moves customer site-level data into 9F's hands — which has implications around NDA, data residency, security review, and (depending on the buyer) regulatory exposure. None of the four reviewers raised this. **Why it matters:** the proposed BD upgrade introduces a real legal surface that needs to be designed before launch, not after first inbound. **Suggested persona:** GC equivalent with security/data-handling experience.
- **Sales enablement / outbound playbook.** BD identified the page as a credibility prop but did not assess whether 9F has the rest of the outbound stack (sequences, intent data, ABM target lists, partner-channel motions) to convert this page into pipeline. **Why it matters:** even with all six BD upgrades shipped, a landing page does not pipeline by itself. **Suggested persona:** sales enablement lead with B2B technical-product GTM experience.

## Bottom line

The page successfully establishes that 9 Foundations has something genuinely differentiated — a proprietary 412-site inventory, a Harvard-anchored team, a five-pillar lens nobody else in the category uses — but the interactive surfaces meant to *prove* that rigor currently undercut it, and the conversion architecture leaks every visitor who isn't already pre-qualified. The next sprint's job is to make the page credible *under interaction* and operationally useful *under conversion* — both achievable inside a 2–3 week window with the right scoping.
