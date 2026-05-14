/* ==========================================================================
   9 Foundations — Data Centers page interactivity
   d3 + topojson loaded via CDN (defer). data.js exposes window.NINEF_DATA.
   ========================================================================== */

(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------- utilities */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmt = {
    num:   n => Number(n).toLocaleString(),
    int:   n => Math.round(n).toLocaleString(),
    flt:   (n, d = 1) => Number(n).toFixed(d),
    money: n => "$" + Math.round(n).toLocaleString(),
  };

  function once(el, ev, fn) {
    el.addEventListener(ev, fn, { once: true });
  }

  // Seeded RNG (Mulberry32) — keeps animations reproducible.
  function rng(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ----------------------------------------------------------- topnav elevation + scroll progress */

  const nav = $(".topnav");
  const progressBar = (() => {
    if (!nav) return null;
    const el = document.createElement("div");
    el.className = "topnav__progress";
    nav.appendChild(el);
    return el;
  })();

  function onScroll() {
    if (!nav) return;
    nav.setAttribute("data-elev", window.scrollY > 12 ? "1" : "0");
    if (progressBar) {
      const doc = document.documentElement;
      const max = Math.max(1, (doc.scrollHeight || document.body.scrollHeight) - window.innerHeight);
      const pct = Math.min(1, Math.max(0, window.scrollY / max));
      progressBar.style.transform = `scaleX(${pct.toFixed(4)})`;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------- scroll-spy: active topnav link */

  (function scrollSpy() {
    const links = $$('.topnav__links a');
    if (!links.length) return;
    const linkByHash = new Map(links.map((a) => [a.getAttribute("href"), a]));
    // Observe sections whose ID matches a nav link
    const visible = new Set();
    const targets = links
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter(Boolean);
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        });
        // Pick the visible section with the smallest top above the viewport.
        // Sort by document position to be deterministic.
        const arr = Array.from(visible).sort(
          (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
        );
        // Prefer the first section whose top is above ~140px (cleared the topnav)
        const active = arr.find((el) => el.getBoundingClientRect().top < 140) || arr[0];
        links.forEach((a) => a.classList.toggle("is-active", false));
        if (active) {
          const link = linkByHash.get("#" + active.id);
          if (link) link.classList.add("is-active");
        }
      },
      { rootMargin: "-80px 0px -50% 0px", threshold: [0, 0.15, 0.5, 1] }
    );
    targets.forEach((t) => io.observe(t));
  })();

  /* ----------------------------------------------------------- scroll reveals + count-ups */

  // Decorate sections + cards with reveal hook.
  $$(".section__head, .card, .pillar, .chart, .fs__callout, .imp__cobe, .team__featured, .hl__sensors, .hl__tiles, .hl__score, .mx__flow, .mx__panel, .map-shell, .arch__row, .hero__proof").forEach(el => el.setAttribute("data-reveal", ""));

  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          revealIO.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  $$("[data-reveal]").forEach((el) => revealIO.observe(el));

  function countUp(el) {
    const target = parseFloat(el.dataset.countup);
    const suffix = el.dataset.suffix || "";
    const isNum = el.dataset.format === "num";
    const dur = 1500;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = target * ease(t);
      el.textContent = (isNum ? fmt.int(v) : (target >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, ""))) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    if (REDUCED) {
      el.textContent = (isNum ? fmt.int(target) : (target >= 100 ? Math.round(target) : target.toString())) + suffix;
    } else {
      requestAnimationFrame(tick);
    }
  }

  const countIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          countUp(e.target);
          countIO.unobserve(e.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  $$("[data-countup]").forEach((el) => countIO.observe(el));

  /* Hero ambient canvas was removed during the branding visual-system pass.
     Drifting particles + connecting lines read as default AI polish; the
     hero now leans on a static technical grid + scale rule (SVG in HTML)
     to express building-science / measurement language without animation. */

  /* ============================================================ VIRGINIA MAP */

  (function vaMap() {
    if (typeof d3 === "undefined" || typeof topojson === "undefined") {
      console.warn("[9F] d3/topojson missing; map skipped");
      return;
    }
    const data = window.NINEF_DATA;
    if (!data) return;

    const svg = d3.select("#va-map");
    const canvas = $("#map-canvas");
    const loading = $("#map-loading");

    const W = 800, H = 500;
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    // State of filters
    const filterState = { status: "all", system: "all" };
    let pointSel = null;

    // Fetch VA outline (FIPS 51) from us-atlas (primary), with a unpkg mirror
    // as a fallback if the primary CDN is blocked in production.
    function loadVA() {
      const urls = [
        "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json",
        "https://unpkg.com/us-atlas@3.0.1/states-10m.json",
      ];
      return urls.reduce(
        (chain, url) => chain.catch(() => d3.json(url)),
        Promise.reject()
      );
    }
    loadVA()
      .then((us) => {
        const states = topojson.feature(us, us.objects.states);
        const va = states.features.find((f) => f.id === "51");
        if (!va) throw new Error("Virginia geometry not found in us-atlas");
        renderMap(va);
        loading && loading.classList.add("is-hidden");
      })
      .catch((err) => {
        console.error("[9F] map load failed", err);
        // Render points alone with a Mercator projection bounded to Virginia,
        // so the inventory stays meaningful even without the outline polygon.
        renderMap(null);
        if (loading) {
          loading.classList.add("is-hidden");
        }
        canvas && canvas.classList.add("is-degraded");
      });

    function renderMap(va) {
      // Project on Virginia bounds with padding. When the state outline is
      // unavailable (degraded fallback), use a hardcoded VA bounding box so
      // the points still register on the right physical geometry.
      let projection;
      if (va) {
        projection = d3.geoMercator().fitExtent([[24, 30], [W - 24, H - 30]], va);
      } else {
        const VA_BBOX = {
          type: "Polygon",
          coordinates: [[[-83.7, 36.5], [-75.2, 36.5], [-75.2, 39.5], [-83.7, 39.5], [-83.7, 36.5]]],
        };
        projection = d3.geoMercator().fitExtent([[24, 30], [W - 24, H - 30]], VA_BBOX);
      }
      const path = d3.geoPath(projection);

      // soft grid
      const grid = svg.append("g").attr("class", "va-grid");
      for (let i = 1; i < 16; i++) {
        grid.append("line").attr("x1", i * (W / 16)).attr("y1", 0).attr("x2", i * (W / 16)).attr("y2", H);
      }
      for (let i = 1; i < 10; i++) {
        grid.append("line").attr("x1", 0).attr("y1", i * (H / 10)).attr("x2", W).attr("y2", i * (H / 10));
      }

      // outline (only when geometry is available)
      if (va) {
        svg.append("path").datum(va).attr("class", "va-outline").attr("d", path);
      } else {
        // Degraded-state notice rendered into the map canvas
        const note = svg.append("g").attr("transform", `translate(${W - 18}, ${H - 14})`);
        note.append("text")
          .attr("text-anchor", "end")
          .attr("fill", "#5d6778")
          .style("font", "10px JetBrains Mono, monospace")
          .style("letter-spacing", "0.06em")
          .text("State outline unavailable · points geo-accurate");
      }

      // Point radius from IT load (log scale)
      const itExtent = d3.extent(data.sites, (d) => d.it_mw);
      const rScale = d3.scaleLog().domain([Math.max(0.05, itExtent[0]), itExtent[1]]).range([1.6, 5.2]).clamp(true);

      const points = svg.append("g").attr("class", "dc-dots");

      pointSel = points.selectAll("circle")
        .data(data.sites)
        .enter()
        .append("circle")
        .attr("class", (d) => `dc-dot dc-dot--${d.status}`)
        .attr("cx", (d) => projection([d.lng, d.lat])[0])
        .attr("cy", (d) => projection([d.lng, d.lat])[1])
        .attr("r", 0)
        .attr("opacity", 0)
        .style("filter", "none")
        .on("mouseenter", (event, d) => activate(d, event.currentTarget))
        .on("mouseleave", () => deactivate())
        .on("click", (event, d) => activate(d, event.currentTarget, true))
        .on("focus", (event, d) => activate(d, event.currentTarget))
        .on("blur", () => deactivate())
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (d) => `${d.county} ${d.status} data center, ${d.it_mw} MW IT load`);

      // staged reveal
      if (REDUCED) {
        pointSel.attr("r", (d) => rScale(Math.max(0.05, d.it_mw))).attr("opacity", 0.9);
      } else {
        pointSel.transition()
          .delay((_d, i) => 8 + (i * 4) % 1800)
          .duration(700)
          .ease(d3.easeCubicOut)
          .attr("r", (d) => rScale(Math.max(0.05, d.it_mw)))
          .attr("opacity", 0.92);
      }

      // initial site detail = an iconic large site (highest IT load)
      const flagship = data.sites.slice().sort((a, b) => b.it_mw - a.it_mw)[0];
      updatePanel(flagship);
      // seed legend counts + "showing N of N" caption on first paint
      applyFilters();
    }

    // Single calculation path — applies the active filter state and
    // updates every readout that depends on it (legend counts, totals,
    // inventory distribution histograms).
    function applyFilters() {
      if (!pointSel) return;
      let existingVisible = 0, plannedVisible = 0;
      const visibleSites = [];
      pointSel.classed("is-faded", (d) => {
        const faded =
          (filterState.status !== "all" && d.status !== filterState.status) ||
          (filterState.system !== "all" && d.system !== filterState.system);
        if (!faded) {
          if (d.status === "existing") existingVisible++;
          else if (d.status === "planned") plannedVisible++;
          visibleSites.push(d);
        }
        return faded;
      });
      const totalVisible = existingVisible + plannedVisible;
      const totalAll = data.sites.length;

      const $le = document.getElementById("legend-existing");
      const $lp = document.getElementById("legend-planned");
      if ($le) $le.textContent = existingVisible.toLocaleString();
      if ($lp) $lp.textContent = plannedVisible.toLocaleString();

      const $showing = document.getElementById("map-showing");
      if ($showing) {
        $showing.textContent = totalVisible === totalAll
          ? `Showing all ${totalAll.toLocaleString()} sites`
          : `Showing ${totalVisible.toLocaleString()} of ${totalAll.toLocaleString()} sites`;
      }

      // Update inventory distribution histograms with the same active set.
      renderHistograms(visibleSites);
    }

    // Inventory distribution histograms — show the SHAPE of the variation
    // across the active subset (cyan bars) against the full inventory
    // (faint ghost outline). Replaces the static range strip.
    function bins(arr, accessor, n, isLog) {
      const vals = arr.map(accessor).filter((v) => Number.isFinite(v));
      const allVals = data.sites.map(accessor).filter((v) => Number.isFinite(v));
      const dom = [Math.min(...allVals), Math.max(...allVals)];
      const scale = isLog
        ? (v) => (Math.log(Math.max(0.001, v)) - Math.log(Math.max(0.001, dom[0]))) / (Math.log(dom[1]) - Math.log(Math.max(0.001, dom[0])))
        : (v) => (v - dom[0]) / (dom[1] - dom[0]);
      const out = new Array(n).fill(0);
      vals.forEach((v) => {
        const t = Math.min(0.9999, Math.max(0, scale(v)));
        out[Math.floor(t * n)] += 1;
      });
      return out;
    }
    function drawHist(svgId, subset, accessor, isLog) {
      const svgNode = document.getElementById(svgId);
      if (!svgNode) return;
      while (svgNode.firstChild) svgNode.removeChild(svgNode.firstChild);
      const N = 28;
      const bActive = bins(subset, accessor, N, isLog);
      const bAll = bins(data.sites, accessor, N, isLog);
      const max = Math.max(1, ...bAll);
      const W = 320, H = 56;
      const padL = 4, padR = 4, padT = 6, padB = 10;
      const bw = (W - padL - padR) / N;
      const ns = "http://www.w3.org/2000/svg";
      function elN(tag, attrs) {
        const e = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
        return e;
      }
      // baseline rule
      svgNode.appendChild(elN("line", {
        x1: padL, x2: W - padR, y1: H - padB, y2: H - padB, class: "bar-baseline"
      }));
      // ghost (full dataset)
      bAll.forEach((v, i) => {
        const h = (v / max) * (H - padT - padB);
        if (h <= 0) return;
        svgNode.appendChild(elN("rect", {
          class: "bar-ghost",
          x: (padL + i * bw + 0.5).toFixed(1),
          y: (H - padB - h).toFixed(1),
          width: Math.max(1, bw - 1).toFixed(1),
          height: h.toFixed(1),
        }));
      });
      // active subset
      bActive.forEach((v, i) => {
        const h = (v / max) * (H - padT - padB);
        if (h <= 0) return;
        svgNode.appendChild(elN("rect", {
          class: "bar-active",
          x: (padL + i * bw + 0.5).toFixed(1),
          y: (H - padB - h).toFixed(1),
          width: Math.max(1, bw - 1).toFixed(1),
          height: h.toFixed(1),
        }));
      });
    }
    function renderHistograms(subset) {
      const set = subset && subset.length ? subset : data.sites;
      drawHist("hist-floor",   set, (d) => d.floor_m2, true);
      drawHist("hist-it",      set, (d) => d.it_mw,    true);
      drawHist("hist-pue",     set, (d) => d.pue,      false);
      drawHist("hist-filters", set, (d) => d.filters,  true);
    }

    // wire filter chips
    $$('.filters .chip').forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.filter;
        const val = btn.dataset.value;
        // toggle active siblings within same data-filter group
        $$(`.filters .chip[data-filter="${key}"]`).forEach((b) => b.classList.toggle("is-active", b === btn));
        filterState[key] = val;
        applyFilters();
      });
    });

    function activate(d, node, locked) {
      if (!pointSel) return;
      pointSel.classed("is-active", false);
      d3.select(node).classed("is-active", true);
      updatePanel(d);
    }
    function deactivate() {
      // keep last selection visible; just clear hover highlight
      if (!pointSel) return;
      pointSel.classed("is-active", false);
    }

    function updatePanel(d) {
      const title = $("#site-title");
      const sub   = $("#site-sub");
      const kv    = $("#site-kv");
      if (!title || !kv) return;

      title.textContent = `${d.id} · ${d.county}`;
      sub.textContent = d.status === "existing"
        ? `Existing data center in ${d.county} County · eGRID ${d.egrid}`
        : `Planned data center in ${d.county} County · eGRID ${d.egrid}`;

      const m2 = fmt.num(d.floor_m2);
      const cap = `${fmt.flt(d.capacity_m3s)} m³/s`;
      const air = `${Math.round(d.air_frac * 100)}%`;
      const rows = [
        ["County", d.county],
        ["Status", d.status[0].toUpperCase() + d.status.slice(1)],
        ["Floor area", `${m2} m²`],
        ["Ceiling height", `${fmt.flt(d.ceiling_m)} m`],
        ["IT load", `${fmt.flt(d.it_mw, 2)} MW`],
        ["PUE", fmt.flt(d.pue, 2)],
        ["System type", d.system],
        ["Air fraction", air],
        ["System capacity", cap],
        ["Filters", fmt.num(d.filters)],
        ["eGRID region", d.egrid],
        ["Coordinates", `${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}`],
      ];
      kv.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    }
  })();

  /* ============================================================ ARCHETYPE BUILDING */

  (function archetype() {
    const svg = $("#arch-svg");
    if (!svg) return;
    const SVG_NS = "http://www.w3.org/2000/svg";
    const W = 520, H = 360;
    const rand = rng(31);

    // Isometric building (data center) — drawn in painter-ordered polygons
    // Defs
    svg.innerHTML = `
      <defs>
        <linearGradient id="bld-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1a2740"/>
          <stop offset="1" stop-color="#0a1322"/>
        </linearGradient>
        <linearGradient id="bld-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#10182a"/>
          <stop offset="1" stop-color="#070d18"/>
        </linearGradient>
        <linearGradient id="bld-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1b2a44"/>
          <stop offset="1" stop-color="#0e1626"/>
        </linearGradient>
        <radialGradient id="bld-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="rgba(94,234,212,0.5)"/>
          <stop offset="1" stop-color="rgba(94,234,212,0)"/>
        </radialGradient>
      </defs>

      <!-- ambient glow -->
      <ellipse cx="260" cy="290" rx="220" ry="40" fill="url(#bld-glow)" opacity="0.6"/>

      <!-- building body — isometric block -->
      <!-- right face -->
      <polygon points="380,140 460,180 460,260 380,220" fill="url(#bld-side)" stroke="rgba(94,234,212,0.32)" stroke-width="0.8"/>
      <!-- front face -->
      <polygon points="140,140 380,140 380,220 140,220" fill="url(#bld-front)" stroke="rgba(94,234,212,0.42)" stroke-width="0.9"/>
      <!-- top face -->
      <polygon points="140,140 220,100 460,100 380,140" fill="url(#bld-top)" stroke="rgba(94,234,212,0.32)" stroke-width="0.8"/>

      <!-- front face detailing: server hall louvers -->
      <g stroke="rgba(94,234,212,0.22)" stroke-width="0.6">
        <line x1="160" y1="158" x2="370" y2="158"/>
        <line x1="160" y1="172" x2="370" y2="172"/>
        <line x1="160" y1="186" x2="370" y2="186"/>
        <line x1="160" y1="200" x2="370" y2="200"/>
      </g>
      <!-- intake bay (cyan rect) -->
      <rect x="158" y="146" width="50" height="60" fill="rgba(94,234,212,0.10)" stroke="rgba(94,234,212,0.55)" stroke-width="0.8"/>
      <text x="183" y="180" text-anchor="middle" fill="rgba(94,234,212,0.7)" font-family="JetBrains Mono" font-size="7" letter-spacing="0.5">INTAKE</text>
      <!-- exhaust bay -->
      <rect x="318" y="146" width="50" height="60" fill="rgba(192,132,252,0.10)" stroke="rgba(192,132,252,0.55)" stroke-width="0.8"/>
      <text x="343" y="180" text-anchor="middle" fill="rgba(192,132,252,0.7)" font-family="JetBrains Mono" font-size="7" letter-spacing="0.5">EXHAUST</text>

      <!-- rooftop chillers -->
      <g stroke="rgba(94,234,212,0.5)" stroke-width="0.8" fill="rgba(255,255,255,0.04)">
        <rect x="240" y="110" width="40" height="14"/>
        <rect x="300" y="110" width="40" height="14"/>
        <rect x="360" y="110" width="40" height="14"/>
      </g>

      <!-- ground baseline -->
      <line x1="60" y1="220" x2="480" y2="220" stroke="rgba(255,255,255,0.06)" stroke-width="0.6"/>

      <!-- annotation labels -->
      <g font-family="JetBrains Mono" font-size="8.5" fill="rgba(140,151,168,0.75)" letter-spacing="0.4">
        <text x="60" y="100">OUTDOOR PM<tspan font-size="6.5">10/2.5</tspan></text>
        <text x="60" y="114">→ HVAC intake</text>
        <text x="280" y="92" text-anchor="middle" fill="rgba(94,234,212,0.85)">REPRESENTATIVE NV ARCHETYPE</text>
        <text x="460" y="100" text-anchor="end">FILTRATION</text>
        <text x="460" y="114" text-anchor="end">→ INDOOR IAQ</text>
      </g>

      <!-- particles will render in #arch-particles -->
      <g id="arch-particles"></g>
    `;

    const group = $("#arch-particles", svg);

    // Geometry constants — must match the SVG above.
    const INTAKE   = { x1: 158, x2: 208, y1: 146, y2: 206 };
    const EXHAUST  = { x1: 318, x2: 368, y1: 146, y2: 206 };
    const INTERIOR = { x1: 208, x2: 318, y1: 146, y2: 206 };
    const intakeMidY  = (INTAKE.y1  + INTAKE.y2)  / 2;
    const exhaustMidY = (EXHAUST.y1 + EXHAUST.y2) / 2;

    // Single particle pool. Each particle moves through a small state machine
    // (outside → inside → exhaust) so the visualization shows the filtration
    // logic: many particles arrive at INTAKE, most are filtered, few emerge.
    const N = REDUCED ? 50 : 110;
    const particles = [];

    function spawnOutside(p) {
      p.x = -8 - rand() * 30;
      p.y = 80 + rand() * 220;
      p.vx = 0.5 + rand() * 0.55;
      p.vy = (rand() - 0.5) * 0.18;
      p.r  = 0.55 + rand() * 1.2;
      p.state = "outside";
      p.opacity = 0.78 + rand() * 0.18;
      p.fillAmber();
    }

    function newParticle() {
      const p = {
        fillAmber() {
          if (!this.el) return;
          this.el.setAttribute("fill", "rgba(251,191,36,0.85)");
          this.el.setAttribute("filter", "none");
        },
        fillCyan() {
          if (!this.el) return;
          this.el.setAttribute("fill", "rgba(94,234,212,0.85)");
          this.el.setAttribute("filter", "none");
        },
      };
      const c = document.createElementNS(SVG_NS, "circle");
      group.appendChild(c);
      p.el = c;
      spawnOutside(p);
      // Stagger initial x so the field looks populated immediately
      p.x = -30 + rand() * (W + 30);
      // Initial cx/cy so reduced-motion shows the static field
      c.setAttribute("cx", p.x.toFixed(1));
      c.setAttribute("cy", p.y.toFixed(1));
      c.setAttribute("r", p.r);
      c.setAttribute("opacity", p.opacity);
      return p;
    }

    for (let i = 0; i < N; i++) particles.push(newParticle());

    function step() {
      for (const p of particles) {
        switch (p.state) {
          case "outside": {
            p.x += p.vx; p.y += p.vy;
            // Subtle pull toward intake height when approaching the building
            if (p.x > 70 && p.x < 158 && Math.abs(p.y - intakeMidY) < 90) {
              p.vy += (intakeMidY - p.y) * 0.0035;
            }
            // Particles arriving at the front face but outside the intake band
            // deflect over the top (visual: airflow finds the intake or bypasses)
            if (p.x > 138 && p.x < 158 && (p.y < INTAKE.y1 || p.y > INTAKE.y2)) {
              p.vy = -Math.abs(p.vy) - 0.2;
            }
            // Entering intake bay → filter event
            if (p.x >= INTAKE.x1 && p.x <= INTAKE.x2 && p.y >= INTAKE.y1 && p.y <= INTAKE.y2) {
              // ~85% filtered (fade and respawn from left); ~15% become interior
              if (rand() < 0.85) {
                p.state = "fading";
                p.fadeFrom = +p.el.getAttribute("opacity");
                p.fadeT = 0;
              } else {
                p.state = "inside";
                p.fillCyan();
                p.vx = 0.35 + rand() * 0.25;
                p.vy = (rand() - 0.5) * 0.12;
                p.r  = 0.6 + rand() * 0.7;
              }
            }
            // Wrap above/below — keep particles in scene
            if (p.y < 40)  p.y = H - 60;
            if (p.y > H - 20) p.y = 60;
            // Off right (passed by building without entering intake)
            if (p.x > W + 10) spawnOutside(p);
            break;
          }
          case "inside": {
            p.x += p.vx;
            p.y += p.vy;
            // Bounce off interior box ceilings/floor
            if (p.y < INTERIOR.y1 + 2) { p.y = INTERIOR.y1 + 2; p.vy *= -1; }
            if (p.y > INTERIOR.y2 - 2) { p.y = INTERIOR.y2 - 2; p.vy *= -1; }
            // Slight downstream drift; when reaching exhaust, decide fate
            if (p.x >= EXHAUST.x1) {
              if (rand() < 0.6) {
                p.state = "fading";
                p.fadeFrom = +p.el.getAttribute("opacity");
                p.fadeT = 0;
              } else {
                p.state = "exhaust";
                p.vx = 0.5 + rand() * 0.35;
                p.vy = (rand() - 0.5) * 0.15;
              }
            }
            break;
          }
          case "exhaust": {
            p.x += p.vx; p.y += p.vy;
            if (p.x > W + 10) spawnOutside(p);
            break;
          }
          case "fading": {
            p.fadeT += 0.05;
            const op = Math.max(0, p.fadeFrom * (1 - p.fadeT));
            p.el.setAttribute("opacity", op.toFixed(2));
            if (p.fadeT >= 1) {
              spawnOutside(p);
              p.el.setAttribute("opacity", p.opacity.toFixed(2));
            }
            break;
          }
        }
        p.el.setAttribute("cx", p.x.toFixed(1));
        p.el.setAttribute("cy", p.y.toFixed(1));
        p.el.setAttribute("r",  p.r.toFixed(2));
      }
      requestAnimationFrame(step);
    }
    if (!REDUCED) requestAnimationFrame(step);
  })();

  /* ============================================================ FILTERSTUDIO CHARTS */

  (function filterStudio() {
    const ps = $("#fs-pressure");
    const pm = $("#fs-pm");
    if (!ps || !pm) return;

    const ns = "http://www.w3.org/2000/svg";
    function el(tag, attrs = {}) {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    }

    // Helper: clear all children from an SVG, leaving the element itself.
    function clearSvg(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    // Helper: rAF-debounced ResizeObserver. Fires `fn` at most once per frame.
    function observeResize(node, fn) {
      if (typeof ResizeObserver === "undefined") return;
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = 0; fn(); });
      });
      ro.observe(node);
    }

    // -------- FilterStudio state model
    // Active comparison mode shapes both chart opacity and pillar values.
    // The two filters share the representative archetype; only the
    // filtration product differs (vendor-neutral; same MERV rating).
    let fsMode = "AB"; // "A" | "B" | "AB"
    const FS_VALUES = {
      A: { label: "Filter A", energy: 204096, pm25: 0.17, pressure: 135.3 },
      B: { label: "Filter B", energy: 318411, pm25: 0.12, pressure: 217.8 },
    };
    function opacityFor(filter) {
      if (fsMode === "AB") return filter === "A" ? 1 : 0.92;
      return filter === fsMode ? 1 : 0.22;
    }
    function strokeWidthFor(filter, base) {
      return fsMode !== "AB" && filter === fsMode ? base + 0.6 : base;
    }

    // -------- Pressure drop vs dust loading
    let pressureFirstDraw = true;
    function drawPressure() {
      clearSvg(ps);
      const rect = ps.getBoundingClientRect();
      const W = Math.max(380, Math.round(rect.width));
      const H = 240;
      ps.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const pad = { l: 38, r: 16, t: 16, b: 28 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

      const xScale = (g) => pad.l + (g / 200) * iw;
      const yScale = (p) => pad.t + (1 - p / 250) * ih;

      const ax = el("g", {});
      ps.appendChild(ax);
      for (let p = 0; p <= 250; p += 50) {
        const y = yScale(p);
        ax.appendChild(el("line", { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: "rgba(255,255,255,0.06)", "stroke-width": 0.6 }));
        ax.appendChild(el("text", { x: pad.l - 6, y: y + 3, "text-anchor": "end", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = p;
      }
      for (let g = 0; g <= 200; g += 50) {
        const x = xScale(g);
        ax.appendChild(el("line", { x1: x, x2: x, y1: H - pad.b, y2: H - pad.b + 4, stroke: "rgba(255,255,255,0.18)" }));
        ax.appendChild(el("text", { x: x, y: H - pad.b + 16, "text-anchor": "middle", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = g + "g";
      }
      ax.appendChild(el("text", { x: pad.l + iw / 2, y: H - 4, "text-anchor": "middle", fill: "#8c97a8", "font-size": 10, "font-family": "Inter" })).textContent = "Dust loading (g)";
      ax.appendChild(el("text", { x: 10, y: pad.t + ih / 2, "text-anchor": "middle", transform: `rotate(-90 10 ${pad.t + ih / 2})`, fill: "#8c97a8", "font-size": 10, "font-family": "Inter" })).textContent = "Pressure drop (Pa)";

      function curve(start, end, steps, shape) {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const tt = Math.pow(t, shape);
          pts.push([t * 200, start + (end - start) * tt]);
        }
        return pts;
      }
      function pathFor(points) {
        return points.map(([g, p], i) => (i ? "L" : "M") + xScale(g).toFixed(1) + "," + yScale(p).toFixed(1)).join(" ");
      }
      function areaPath(points) {
        const top = pathFor(points);
        return `${top} L${xScale(200)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`;
      }

      const aPts = curve(60, 135.3, 60, 1.4);
      const bPts = curve(75, 217.8, 60, 1.7);

      const defs = el("defs", {});
      defs.innerHTML = `
        <linearGradient id="grad-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(94,234,212,0.35)"/>
          <stop offset="1" stop-color="rgba(94,234,212,0)"/>
        </linearGradient>
        <linearGradient id="grad-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(192,132,252,0.28)"/>
          <stop offset="1" stop-color="rgba(192,132,252,0)"/>
        </linearGradient>`;
      ps.appendChild(defs);

      // B area + line only render when B is visible
      const bOpacity = opacityFor("B");
      if (bOpacity > 0.3) ps.appendChild(el("path", { d: areaPath(bPts), fill: "url(#grad-b)", opacity: bOpacity }));
      const animate = pressureFirstDraw && !REDUCED;
      const bLine = el("path", { d: pathFor(bPts), fill: "none", stroke: "#c084fc", "stroke-width": strokeWidthFor("B", 1.8), "stroke-linecap": "round", "stroke-dasharray": 600, "stroke-dashoffset": animate ? 600 : 0, opacity: bOpacity, filter: "none" });
      ps.appendChild(bLine);

      const aOpacity = opacityFor("A");
      if (aOpacity > 0.3) ps.appendChild(el("path", { d: areaPath(aPts), fill: "url(#grad-a)", opacity: aOpacity }));
      const aLine = el("path", { d: pathFor(aPts), fill: "none", stroke: "#5eead4", "stroke-width": strokeWidthFor("A", 2.2), "stroke-linecap": "round", "stroke-dasharray": 600, "stroke-dashoffset": animate ? 600 : 0, opacity: aOpacity, filter: "none" });
      ps.appendChild(aLine);

      function marker(pt, color, label, dy, filter) {
        const x = xScale(pt[0]), y = yScale(pt[1]);
        const op = opacityFor(filter);
        if (op < 0.3) return;
        ps.appendChild(el("circle", { cx: x, cy: y, r: 3.5, fill: color, "stroke": "#04070c", "stroke-width": 1.2, opacity: op }));
        const t = el("text", { x: x - 6, y: y + dy, "text-anchor": "end", fill: "#f4f7fb", "font-size": 10, "font-family": "JetBrains Mono", opacity: op });
        t.textContent = label;
        ps.appendChild(t);
      }
      marker(aPts[aPts.length - 1], "#5eead4", "A · 135 Pa", -8, "A");
      marker(bPts[bPts.length - 1], "#c084fc", "B · 218 Pa", 14, "B");

      if (animate) {
        const io = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            aLine.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.2,.8,.2,1)";
            bLine.style.transition = "stroke-dashoffset 1500ms cubic-bezier(.2,.8,.2,1) 150ms";
            requestAnimationFrame(() => {
              aLine.setAttribute("stroke-dashoffset", 0);
              bLine.setAttribute("stroke-dashoffset", 0);
            });
            io.disconnect();
          }
        }, { threshold: 0.3 });
        io.observe(ps);
      }
      pressureFirstDraw = false;
    }
    drawPressure();
    observeResize(ps, drawPressure);

    // -------- Indoor PM2.5 over time
    let pmFirstDraw = true;
    function drawPM() {
      clearSvg(pm);
      const rect = pm.getBoundingClientRect();
      const W = Math.max(380, Math.round(rect.width));
      const H = 240;
      pm.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const pad = { l: 38, r: 16, t: 16, b: 28 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const xScale = (t) => pad.l + (t / 30) * iw;
      const yScale = (v) => pad.t + (1 - v / 0.30) * ih;

      const ax = el("g", {});
      pm.appendChild(ax);
      for (let v = 0; v <= 0.3; v += 0.05) {
        const y = yScale(v);
        ax.appendChild(el("line", { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: "rgba(255,255,255,0.06)", "stroke-width": 0.6 }));
        ax.appendChild(el("text", { x: pad.l - 6, y: y + 3, "text-anchor": "end", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = v.toFixed(2);
      }
      for (let d = 0; d <= 30; d += 5) {
        const x = xScale(d);
        ax.appendChild(el("line", { x1: x, x2: x, y1: H - pad.b, y2: H - pad.b + 4, stroke: "rgba(255,255,255,0.18)" }));
        ax.appendChild(el("text", { x: x, y: H - pad.b + 16, "text-anchor": "middle", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = d + "d";
      }
      ax.appendChild(el("text", { x: pad.l + iw / 2, y: H - 4, "text-anchor": "middle", fill: "#8c97a8", "font-size": 10 })).textContent = "Days of operation";
      ax.appendChild(el("text", { x: 10, y: pad.t + ih / 2, "text-anchor": "middle", transform: `rotate(-90 10 ${pad.t + ih / 2})`, fill: "#8c97a8", "font-size": 10 })).textContent = "Indoor PM₂.₅ (µg/m³)";

      // Re-seed each draw with the same seed so the noise series is stable
      // across resizes — otherwise the curves jitter on every redraw.
      const rand = rng(91);
      function series(mean, jitter) {
        const pts = [];
        for (let d = 0; d <= 30; d += 0.5) {
          const noise = (rand() - 0.5) * jitter;
          const trend = (d - 15) * 0.0008;
          pts.push([d, Math.max(0, mean + noise + trend)]);
        }
        return pts;
      }
      function pathFor(points) {
        return points.map(([d, v], i) => (i ? "L" : "M") + xScale(d).toFixed(1) + "," + yScale(v).toFixed(1)).join(" ");
      }
      const aPts = series(0.17, 0.05);
      const bPts = series(0.12, 0.04);

      const animate = pmFirstDraw && !REDUCED;
      const aOp = opacityFor("A");
      const bOp = opacityFor("B");
      const bLine = el("path", { d: pathFor(bPts), fill: "none", stroke: "#c084fc", "stroke-width": strokeWidthFor("B", 1.4), opacity: bOp, filter: "none", "stroke-dasharray": 700, "stroke-dashoffset": animate ? 700 : 0 });
      const aLine = el("path", { d: pathFor(aPts), fill: "none", stroke: "#5eead4", "stroke-width": strokeWidthFor("A", 1.8), opacity: aOp, filter: "none", "stroke-dasharray": 700, "stroke-dashoffset": animate ? 700 : 0 });
      pm.appendChild(bLine);
      pm.appendChild(aLine);

      pm.appendChild(el("line", { x1: xScale(0), x2: xScale(30), y1: yScale(0.17), y2: yScale(0.17), stroke: "rgba(94,234,212,0.4)", "stroke-dasharray": "3 4", "stroke-width": 1, opacity: aOp }));
      pm.appendChild(el("line", { x1: xScale(0), x2: xScale(30), y1: yScale(0.12), y2: yScale(0.12), stroke: "rgba(192,132,252,0.4)", "stroke-dasharray": "3 4", "stroke-width": 1, opacity: bOp }));

      if (aOp > 0.3) {
        const tA = el("text", { x: xScale(30) - 6, y: yScale(0.17) - 4, "text-anchor": "end", fill: "#5eead4", "font-size": 10, "font-family": "JetBrains Mono", opacity: aOp });
        tA.textContent = "A · 0.17 avg";
        pm.appendChild(tA);
      }
      if (bOp > 0.3) {
        const tB = el("text", { x: xScale(30) - 6, y: yScale(0.12) - 4, "text-anchor": "end", fill: "#c084fc", "font-size": 10, "font-family": "JetBrains Mono", opacity: bOp });
        tB.textContent = "B · 0.12 avg";
        pm.appendChild(tB);
      }

      if (animate) {
        const io = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            aLine.style.transition = "stroke-dashoffset 1600ms cubic-bezier(.2,.8,.2,1)";
            bLine.style.transition = "stroke-dashoffset 1600ms cubic-bezier(.2,.8,.2,1) 200ms";
            requestAnimationFrame(() => {
              aLine.setAttribute("stroke-dashoffset", 0);
              bLine.setAttribute("stroke-dashoffset", 0);
            });
            io.disconnect();
          }
        }, { threshold: 0.3 });
        io.observe(pm);
      }
      pmFirstDraw = false;
    }
    drawPM();
    observeResize(pm, drawPM);

    // -------- Toggle wired to redraw charts AND swap pillar values
    const $viewing = $("#fs-viewing");
    function viewingCopy(mode) {
      if (mode === "A") return "Viewing Filter A on the representative archetype. Filter B shown faded for reference.";
      if (mode === "B") return "Viewing Filter B on the representative archetype. Filter A shown faded for reference.";
      return "Comparing both filters across the representative archetype.";
    }
    function updatePillars() {
      // In A or AB the primary number is A's; in B mode it swaps.
      const primary = fsMode === "B" ? "B" : "A";
      const secondary = primary === "A" ? "B" : "A";
      const p = FS_VALUES[primary];
      const s = FS_VALUES[secondary];

      const energyA = $("#fs-energy-a");
      const energyB = $("#fs-energy-b");
      if (energyA) energyA.textContent = fmt.int(p.energy);
      if (energyB) energyB.textContent = `vs ${fmt.int(s.energy)} (${secondary})`;

      const healthA = $("#fs-health-a");
      const healthB = $("#fs-health-b");
      if (healthA) healthA.textContent = p.pm25.toFixed(2);
      if (healthB) healthB.textContent = `vs ${s.pm25.toFixed(2)} (${secondary})`;

      const perfA = $("#fs-perf-a");
      const perfB = $("#fs-perf-b");
      if (perfA) perfA.textContent = p.pressure.toFixed(1);
      if (perfB) perfB.textContent = `vs ${s.pressure.toFixed(1)} (${secondary})`;

      // Mark pillars as primary/secondary for subtle border accent.
      $$('.pillar').forEach((pill) => {
        pill.classList.remove("pillar--A-active", "pillar--B-active");
        if (fsMode !== "AB") pill.classList.add(`pillar--${fsMode}-active`);
      });
    }
    function setFsMode(mode) {
      fsMode = mode;
      $viewing && ($viewing.textContent = viewingCopy(mode));
      updatePillars();
      drawPressure();
      drawPM();
    }
    $$('.fs__toggle .chip').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('.fs__toggle .chip').forEach((b) => b.classList.toggle("is-active", b === btn));
        setFsMode(btn.dataset.fs);
      });
    });
    // Initial sync (HTML defaults to Compare)
    updatePillars();
  })();

  /* ============================================================ MATRIX HEATMAP */

  (function matrix() {
    const svg = $("#mx-heat");
    if (!svg) return;
    const ns = "http://www.w3.org/2000/svg";
    function el(tag, attrs = {}) {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    }

    const COLS = 12, ROWS = 8;
    let cells = [];
    let currentScenario = "baseline";
    // Geometry kept module-scope so apply() can re-annotate best cell after redraws.
    let geom = { pad: { l: 48, r: 16, t: 16, b: 60 }, W: 0, H: 0, iw: 0, ih: 0, cellW: 0, cellH: 0 };
    let bestCellGroup = null;

    function clearSvg(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    // Each scenario reshapes the surface — not just a uniform multiplier.
    // The U-value/HVAC weights shift to reflect which design choice
    // becomes the dominant lever under that intervention, and the
    // ceiling/floor shift so the best-cell intensity actually moves.
    const SCENARIOS = {
      baseline:  { uWeight: 0.55, hWeight: 0.45, offset:   0, pctSavings: 0.0, usd: 0,     co2: 0,   note: "Reference operating envelope" },
      envelope:  { uWeight: 0.38, hWeight: 0.68, offset:  -3, pctSavings: 1.2, usd: 22000, co2: 110, note: "Envelope retrofit shifts the lever toward HVAC" },
      setpoints: { uWeight: 0.62, hWeight: 0.38, offset:  -1, pctSavings: 0.6, usd: 11000, co2: 55,  note: "Setpoint tune amplifies envelope sensitivity" },
      all:       { uWeight: 0.48, hWeight: 0.58, offset:  -6, pctSavings: 2.0, usd: 40000, co2: 200, note: "Combined envelope + setpoint optimum" },
    };

    function intensityFor(scenario, c, r) {
      const s = SCENARIOS[scenario];
      const u = 1 - c / (COLS - 1); // 0 = poor envelope, 1 = great envelope
      const h = 1 - r / (ROWS - 1); // 0 = poor HVAC, 1 = great HVAC
      return 220 + s.offset - 100 * (s.uWeight * u + s.hWeight * h);
    }

    function draw() {
      clearSvg(svg);
      cells = [];
      bestCellGroup = null;

      const rect = svg.getBoundingClientRect();
      const W = Math.max(520, Math.round(rect.width));
      const H = 380;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const pad = { l: 56, r: 16, t: 16, b: 72 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const cellW = iw / COLS, cellH = ih / ROWS;
      geom = { pad, W, H, iw, ih, cellW, cellH };

      // build cell grid
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = pad.l + c * cellW;
          const y = pad.t + r * cellH;
          const rectEl = el("rect", { x: x + 1, y: y + 1, width: cellW - 2, height: cellH - 2, rx: 2, ry: 2, fill: "#0a0f1a" });
          svg.appendChild(rectEl);
          cells.push({ rect: rectEl, c, r, x, y });
        }
      }

      // axis titles — convention: best operating regime in the top-left
      // (low U-value × high HVAC efficiency = low energy intensity).
      svg.appendChild(el("text", { x: pad.l - 12, y: pad.t + ih / 2, "text-anchor": "middle", transform: `rotate(-90 ${pad.l - 12} ${pad.t + ih / 2})`, fill: "#8c97a8", "font-size": 10, "font-family": "Inter" })).textContent = "HVAC efficiency (η)";
      svg.appendChild(el("text", { x: pad.l + iw / 2, y: pad.t + ih + 22, "text-anchor": "middle", fill: "#8c97a8", "font-size": 10, "font-family": "Inter" })).textContent = "Envelope U-value (W/m²K)";
      // axis ticks — flipped so left = best envelope (low U) and top = best HVAC eff.
      const uTicks = [
        { c: 0,  v: "0.80" },
        { c: 4,  v: "1.40" },
        { c: 8,  v: "2.10" },
        { c: 11, v: "2.70" },
      ];
      uTicks.forEach(({ c, v }) => {
        svg.appendChild(el("text", { x: pad.l + c * cellW + cellW / 2, y: pad.t + ih + 11, "text-anchor": "middle", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = v;
      });
      const hTicks = [
        { r: 0, v: "High" },
        { r: 3, v: "Mid" },
        { r: 7, v: "Low" },
      ];
      hTicks.forEach(({ r, v }) => {
        svg.appendChild(el("text", { x: pad.l - 10, y: pad.t + r * cellH + cellH / 2 + 3, "text-anchor": "end", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = v;
      });
      // Direction markers — make the gradient direction unambiguous on first read.
      svg.appendChild(el("text", { x: pad.l, y: pad.t + ih + 36, "text-anchor": "start", fill: "rgba(94,234,212,0.75)", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.16em" })).textContent = "← BETTER";
      svg.appendChild(el("text", { x: pad.l + iw, y: pad.t + ih + 36, "text-anchor": "end", fill: "rgba(140,151,168,0.55)", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.16em" })).textContent = "WORSE →";
      svg.appendChild(el("text", { x: 16, y: pad.t + 8, "text-anchor": "start", fill: "rgba(94,234,212,0.75)", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.16em", transform: `rotate(-90 16 ${pad.t + 8})` })).textContent = "BETTER ↑";

      // color-scale legend strip below the grid
      const legendY = pad.t + ih + 36;
      const legendW = Math.min(220, iw * 0.45);
      const legendX = pad.l + iw - legendW;
      const defs = el("defs", {});
      defs.innerHTML = `
        <linearGradient id="mx-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="rgb(94,234,212)"/>
          <stop offset="0.45" stop-color="rgb(56,189,248)"/>
          <stop offset="0.75" stop-color="rgb(129,140,248)"/>
          <stop offset="1" stop-color="rgb(192,132,252)"/>
        </linearGradient>`;
      svg.appendChild(defs);
      svg.appendChild(el("rect", { x: legendX, y: legendY, width: legendW, height: 6, rx: 3, fill: "url(#mx-grad)" }));
      svg.appendChild(el("text", { x: legendX, y: legendY - 4, fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = "lower energy use";
      svg.appendChild(el("text", { x: legendX + legendW, y: legendY - 4, "text-anchor": "end", fill: "#5d6778", "font-size": 9, "font-family": "JetBrains Mono" })).textContent = "higher";

      apply(currentScenario);
    }

    function color(v, min, max) {
      const t = (v - min) / Math.max(0.01, max - min); // 0 best, 1 worst
      const palette = [
        { p: 0.00, c: [94, 234, 212] }, // teal-cyan
        { p: 0.45, c: [56, 189, 248] }, // sky
        { p: 0.75, c: [129, 140, 248] }, // indigo
        { p: 1.00, c: [192, 132, 252] }, // violet
      ];
      let a = palette[0], b = palette[palette.length - 1];
      for (let i = 0; i < palette.length - 1; i++) {
        if (t >= palette[i].p && t <= palette[i + 1].p) { a = palette[i]; b = palette[i + 1]; break; }
      }
      const k = (t - a.p) / (b.p - a.p || 1);
      const rgb = a.c.map((cc, i) => Math.round(cc + (b.c[i] - cc) * k));
      return `rgb(${rgb.join(",")})`;
    }

    function apply(scenario) {
      currentScenario = scenario;
      const vals = cells.map(({ c, r }) => intensityFor(scenario, c, r));
      const min = Math.min(...vals), max = Math.max(...vals);
      let minIndex = 0;
      vals.forEach((v, i) => { if (v <= vals[minIndex]) minIndex = i; });
      cells.forEach(({ rect, c, r }, i) => {
        const v = vals[i];
        const t = (v - min) / Math.max(0.01, max - min);
        rect.setAttribute("fill", color(v, min, max));
        rect.setAttribute("opacity", (0.22 + (1 - t) * 0.78).toFixed(2));
      });

      // Best-cell annotation. Find baseline minimum too so we can express
      // the active scenario's delta against it.
      const baselineMin = Math.min(...cells.map(({ c, r }) => intensityFor("baseline", c, r)));
      const best = cells[minIndex];
      if (bestCellGroup) bestCellGroup.remove();
      bestCellGroup = el("g", { class: "mx-bestcell" });
      const bx = best.x + geom.cellW / 2;
      const by = best.y + geom.cellH / 2;
      bestCellGroup.appendChild(el("rect", {
        x: best.x + 1, y: best.y + 1, width: geom.cellW - 2, height: geom.cellH - 2,
        rx: 2, ry: 2, fill: "none", stroke: "#f4f7fb", "stroke-width": 1.6, opacity: 0.95,
      }));
      bestCellGroup.appendChild(el("circle", {
        cx: bx, cy: by, r: Math.min(geom.cellW, geom.cellH) * 0.18,
        fill: "none", stroke: "#5eead4", "stroke-width": 1.4, opacity: 0.85,
      }));
      // Annotation callout — leader line + text near top-right or top-left of grid
      const labelLeft = best.c > COLS / 2;
      const lx = labelLeft ? geom.pad.l + 10 : geom.pad.l + geom.iw - 10;
      const ly = geom.pad.t + 18;
      const tAnchor = labelLeft ? "start" : "end";
      const intensity = vals[minIndex].toFixed(0);
      const deltaPct = ((baselineMin - vals[minIndex]) / baselineMin * 100);
      const t1 = el("text", { x: lx, y: ly, "text-anchor": tAnchor, fill: "#f4f7fb", "font-size": 11, "font-family": "JetBrains Mono", "font-weight": 600 });
      t1.textContent = scenario === "baseline"
        ? `Best operating regime · ${intensity} kWh/m²`
        : `Best regime · ${intensity} kWh/m² · ${deltaPct > 0 ? "−" : "+"}${Math.abs(deltaPct).toFixed(1)}% vs baseline`;
      bestCellGroup.appendChild(t1);
      const t2 = el("text", { x: lx, y: ly + 14, "text-anchor": tAnchor, fill: "#8c97a8", "font-size": 9.5, "font-family": "Inter" });
      t2.textContent = SCENARIOS[scenario].note;
      bestCellGroup.appendChild(t2);
      // Leader line from text to best cell
      const t1Box = labelLeft
        ? { x: lx, y: ly + 4 }
        : { x: lx, y: ly + 4 };
      bestCellGroup.appendChild(el("line", {
        x1: t1Box.x + (labelLeft ? -6 : 6), y1: ly + 4,
        x2: bx, y2: by - Math.min(geom.cellW, geom.cellH) * 0.18 - 2,
        stroke: "rgba(255,255,255,0.35)", "stroke-width": 0.8, "stroke-dasharray": "3 3",
      }));
      svg.appendChild(bestCellGroup);

      // Readouts
      const s = SCENARIOS[scenario];
      const $pct = $("#mx-savings-pct"), $usd = $("#mx-savings-usd"), $co2 = $("#mx-co2");
      if ($pct) $pct.textContent = s.pctSavings.toFixed(1);
      if ($usd) $usd.textContent = fmt.num(s.usd);
      if ($co2) $co2.textContent = fmt.num(s.co2);
    }

    draw();

    // Re-measure and rebuild the heatmap when the panel's width changes
    // (window resize, breakpoint flip, device rotation). rAF-debounced.
    if (typeof ResizeObserver !== "undefined") {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = 0; draw(); });
      });
      ro.observe(svg);
    }

    $$('.mx__scenario .chip').forEach(btn => {
      btn.addEventListener("click", () => {
        $$('.mx__scenario .chip').forEach(b => b.classList.toggle("is-active", b === btn));
        apply(btn.dataset.scenario);
      });
    });
  })();

  /* ============================================================ H.E.A.A.L. DASHBOARD */

  (function heaal() {
    const grid = $("#hl-grid");
    if (!grid) return;

    // -------- Deterministic per-floor profiles
    // Each profile is 4 rows × 18 cols of severity codes:
    //   0 = stable (deep cyan), 1 = stable-lighter, 2 = warn (yellow), 3 = exceed (red).
    // Patterns are hand-tuned so each floor reads as a recognizable building
    // state, not as random data. Toggling floors must reproduce the same
    // pattern every time.
    const FLOORS = {
      "1": {
        score: 82,
        alerts: 5,
        exceeds: 1,
        statusNote: "5 alerts (PM₂.₅ R-side · RH)",
        tiles: { tvoc: 168, pm25: 14.2, t: 22.6, rh: 38, co2: 740, tvocPip: "warn", pm25Pip: "warn", trhPip: "ok", co2Pip: "ok" },
        pattern: [
          "110000000011000122",
          "110000011112000233",
          "000000000111000122",
          "000010000000000011",
        ],
      },
      "2": {
        score: 86,
        alerts: 2,
        exceeds: 0,
        statusNote: "2 alerts (PM₂.₅ · RH)",
        tiles: { tvoc: 142, pm25: 11.4, t: 21.4, rh: 42, co2: 612, tvocPip: "ok", pm25Pip: "warn", trhPip: "ok", co2Pip: "ok" },
        pattern: [
          "000000000000000000",
          "000011110000000000",
          "000112210000000000",
          "000001100000000000",
        ],
      },
      "3": {
        score: 91,
        alerts: 0,
        exceeds: 0,
        statusNote: "Actions clear",
        tiles: { tvoc: 96, pm25: 7.8, t: 21.1, rh: 45, co2: 488, tvocPip: "ok", pm25Pip: "ok", trhPip: "ok", co2Pip: "ok" },
        pattern: [
          "000000000000000000",
          "000000000000000000",
          "000000000000010000",
          "000000000000000000",
        ],
      },
    };

    const SEVERITY_BG = ["rgba(94,234,212,0.18)", "rgba(94,234,212,0.34)", "rgba(251,191,36,0.40)", "rgba(248,113,113,0.45)"];
    const SEVERITY_BORDER = ["rgba(94,234,212,0.16)", "rgba(94,234,212,0.30)", "rgba(251,191,36,0.55)", "rgba(248,113,113,0.70)"];

    // Sensor grid: 18 cols × 4 rows
    const COLS = 18, ROWS = 4;
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "hl__cell";
        cell.title = `Sensor ${r + 1}-${c + 1}`;
        grid.appendChild(cell);
        cells.push(cell);
      }
    }

    function paintFloor(f) {
      const profile = FLOORS[f] || FLOORS["2"];
      for (let r = 0; r < ROWS; r++) {
        const row = profile.pattern[r] || "";
        for (let c = 0; c < COLS; c++) {
          const sev = parseInt(row[c] || "0", 10);
          const cell = cells[r * COLS + c];
          if (!cell) continue;
          cell.style.background = SEVERITY_BG[sev];
          cell.style.boxShadow = `inset 0 0 0 1px ${SEVERITY_BORDER[sev]}`;
          cell.dataset.sev = String(sev);
        }
      }
    }

    function updateScore(f) {
      const p = FLOORS[f] || FLOORS["2"];
      const $score = $("#hl-score");
      const $bar = $("#hl-bar");
      if ($score) $score.textContent = String(p.score);
      if ($bar) $bar.style.width = p.score + "%";
    }

    function updateStatus(f) {
      const p = FLOORS[f] || FLOORS["2"];
      const $status = $(".hl__status");
      if (!$status) return;
      $status.innerHTML = `
        <li><span class="pip pip--ok"></span> ${p.alerts === 0 ? "All sensors stable" : `${p.alerts} alerts open`}</li>
        <li><span class="pip ${p.alerts > 0 ? "pip--warn" : "pip--ok"}"></span> ${p.statusNote}</li>
        <li><span class="pip ${p.exceeds > 0 ? "pip--bad" : "pip--ok"}"></span> ${p.exceeds} thresholds exceeded</li>
      `;
    }

    function updateTiles(f) {
      const p = FLOORS[f] || FLOORS["2"];
      const t = p.tiles;
      const set = (id, val) => { const el = $("#" + id); if (el) el.textContent = String(val); };
      set("tile-tvoc", t.tvoc);
      set("tile-pm25", t.pm25);
      set("tile-t", t.t);
      set("tile-rh", t.rh);
      set("tile-co2", t.co2);
      // Update tile pip color
      const pipFor = (metric) => {
        const tile = document.querySelector(`.tile[data-metric="${metric}"]`);
        if (!tile) return;
        const pip = tile.querySelector(".pip");
        if (!pip) return;
        pip.className = "pip pip--" + t[metric + "Pip"];
      };
      pipFor("tvoc"); pipFor("pm25"); pipFor("trh"); pipFor("co2");
    }

    function setFloor(f) {
      paintFloor(f);
      updateScore(f);
      updateStatus(f);
      updateTiles(f);
      const $floor = $("#hl-floor"), $floor2 = $("#hl-floor-2");
      if ($floor) $floor.textContent = f;
      if ($floor2) $floor2.textContent = f;
    }

    // Initial paint — Floor 2 default
    setFloor("2");

    // Sparklines per tile (seeded by tile index — stable across renders)
    $$('.tile').forEach((tile, idx) => {
      const svg = tile.querySelector("svg.tile__spark");
      if (!svg) return;
      const ns = "http://www.w3.org/2000/svg";
      const W = 140, H = 40;
      const r = rng(100 + idx * 37);
      const pts = [];
      for (let i = 0; i <= 28; i++) {
        const v = 0.3 + 0.5 * Math.sin((i + idx * 4) / 3) + (r() - 0.5) * 0.25;
        pts.push([i, Math.max(0.05, Math.min(0.95, v))]);
      }
      const d = pts.map(([x, y], i) => (i ? "L" : "M") + (x / 28 * W).toFixed(1) + "," + ((1 - y) * H).toFixed(1)).join(" ");
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#5eead4");
      path.setAttribute("stroke-width", "1.6");
      path.setAttribute("opacity", "0.9");
      path.setAttribute("filter", "none");
      svg.appendChild(path);
      const area = document.createElementNS(ns, "path");
      area.setAttribute("d", d + ` L${W},${H} L0,${H} Z`);
      area.setAttribute("fill", "rgba(94,234,212,0.12)");
      svg.insertBefore(area, path);
    });

    // Floor toggle — deterministic, no randomness.
    $$('[data-hl-floor]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-hl-floor]').forEach((b) => b.classList.toggle("is-active", b === btn));
        setFloor(btn.dataset.hlFloor);
      });
    });
    // Animate the bar fill on initial viewport entry (one-shot)
    const bar = $("#hl-bar");
    if (bar && !REDUCED) {
      const initialWidth = bar.style.width;
      bar.style.width = "0%";
      const scoreIO = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          bar.style.transition = "width 900ms cubic-bezier(.2,.8,.2,1)";
          requestAnimationFrame(() => { bar.style.width = initialWidth; });
          scoreIO.disconnect();
        }
      }, { threshold: 0.4 });
      scoreIO.observe(bar);
    }
  })();

  /* ============================================================ smooth anchor scroll */

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length <= 1) return;
      const target = $(id);
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 64;
        window.scrollTo({ top, behavior: REDUCED ? "auto" : "smooth" });
      }
    });
  });

})();
