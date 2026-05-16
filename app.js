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

  /* ----------------------------------------------------------- scroll-spy: active topnav link

     Position-based, not visibility-based. On every scroll we pick the
     section whose top has just passed the topnav line — meaning the
     active link is symmetric scrolling up vs down, and there is no
     dead zone between sections where nothing is highlighted. */

  (function scrollSpy() {
    const links = $$('.topnav__links a');
    if (!links.length) return;
    const linkByHash = new Map(links.map((a) => [a.getAttribute("href"), a]));
    const targets = links
      .map((a) => {
        const el = document.querySelector(a.getAttribute("href"));
        return el ? { el, link: a } : null;
      })
      .filter(Boolean);
    if (!targets.length) return;

    let currentActive = null;
    function updateActive() {
      // Anchor line just below the topnav — section is "active" once its
      // top has scrolled above this line. ~120px keeps the active link in
      // sync with what the user is actually reading.
      const anchorY = 120;
      let active = targets[0];
      for (const t of targets) {
        const top = t.el.getBoundingClientRect().top;
        if (top - anchorY <= 0) active = t;
        else break;
      }
      if (active === currentActive) return;
      currentActive = active;
      links.forEach((a) => a.classList.toggle("is-active", a === active.link));
    }
    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
  })();

  /* ----------------------------------------------------------- scroll reveals + count-ups */

  // Decorate sections + cards with reveal hook.
  $$(".section__head, .card, .pillar, .chart, .hl__sensors, .hl__tiles, .hl__score, .mx__flow, .mx__panel, .map-shell, .hero__proof").forEach(el => el.setAttribute("data-reveal", ""));

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
        // Two-tier interaction:
        //   hover / focus → PREVIEW: highlight the dot + update the inventory
        //     side panel only. Ephemeral. Lets users browse.
        //   click / Enter / Space → COMMIT: dispatches site:select so the
        //     archetype panel and both intent blocks rebind to this site.
        // The intent-block language ("Selected" / "Derived from") implies an
        // intentional choice — only the commit path should produce that state.
        .on("mouseenter", (event, d) => previewSite(d, event.currentTarget))
        .on("mouseleave", () => deactivate())
        .on("click",      (event, d) => commitSite(d, event.currentTarget))
        .on("focus",      (event, d) => previewSite(d, event.currentTarget))
        .on("blur",       () => deactivate())
        .on("keydown",    function (event, d) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            commitSite(d, this);
          }
        })
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", (d) => `${d.county} ${d.status} data center, ${d.it_mw} MW IT load — press Enter to select`);

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

      // Initial side-panel state = the highest-IT-load site, presented as
      // a flagship preview (not a commit). The archetype + intent blocks
      // stay in their default state until the user explicitly selects.
      const flagship = data.sites.slice().sort((a, b) => b.it_mw - a.it_mw)[0];
      updatePanel(flagship, /* committed */ false);
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
        $$(`.filters .chip[data-filter="${key}"]`).forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        filterState[key] = val;
        applyFilters();
      });
    });

    // Module-level pointer to whatever site the side panel is currently
    // showing — used by the CTA so it can commit the right record even if
    // the user got here via hover-preview rather than click.
    let currentPanelSite = null;

    // Preview: light-touch hover state. Updates the inventory side panel
    // and the dot highlight only. The intent block stays bound to the
    // last COMMITTED selection (or the default flagship).
    function previewSite(d, node) {
      if (!pointSel) return;
      pointSel.classed("is-active", false);
      if (node) d3.select(node).classed("is-active", true);
      updatePanel(d, /* committed */ false);
    }
    // Commit: user explicitly selected this site. Updates the side panel
    // and the inventory intent block to reflect the chosen record. Node
    // is optional — if not supplied we find the matching dot ourselves.
    function commitSite(d, node) {
      if (!pointSel) return;
      const target = node || pointSel.filter((p) => p.id === d.id).node();
      pointSel.classed("is-committed", false);
      pointSel.classed("is-active", false);
      if (target) {
        d3.select(target).classed("is-active", true).classed("is-committed", true);
      }
      updatePanel(d, /* committed */ true);
    }
    function deactivate() {
      // Clear hover highlight only — the committed dot keeps its
      // .is-committed marker so the user can still see their selection.
      if (!pointSel) return;
      pointSel.classed("is-active", function () { return d3.select(this).classed("is-committed"); });
    }

    function updatePanel(d, committed) {
      const title = $("#site-title");
      const sub   = $("#site-sub");
      const kv    = $("#site-kv");
      if (!title || !kv) return;

      // Remember which site is currently showing in the panel so the
      // archetype-handoff CTA can commit the right record on click.
      currentPanelSite = d;

      title.textContent = `${d.id} · ${d.county}`;
      const stateNote = committed
        ? "Selected"
        : "Previewing on hover · click to select";
      sub.textContent = d.status === "existing"
        ? `Existing data center in ${d.county} County · eGRID ${d.egrid} — ${stateNote}`
        : `Planned data center in ${d.county} County · eGRID ${d.egrid} — ${stateNote}`;

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

      // Mirror the selected site identity into the inventory intent block.
      if (committed) {
        const statusLabel = d.status === "existing" ? "Existing" : "Planned";
        const summary = `<b>${d.id}</b> · ${d.county} · ${statusLabel} · ${d.system} · ${fmt.flt(d.it_mw, 1)} MW`;
        const intentMap = document.getElementById("intent-map");
        if (intentMap) intentMap.innerHTML = summary;
      }
    }
  })();

  /* ============================================================ FILTERSTUDIO
     Case study × filter × operating-year scrubber. The three stacked
     charts and the building archetype all derive from one state object:
     { case: "A"|"B", filter: "1"|"2"|"compare", month: 0..12 }.
     The compare/delta zone is the active surface when filter === compare —
     six tiles read out pressure delta, PM delta, energy, climate damages
     avoided, public-health damages avoided, total co-benefits.
     Statewide rollups (the $39.9M block) live in the headline below; the
     per-case-study deltas here scale those to one building.
     ================================================================ */

  (function filterStudio() {
    const ps = $("#fs-pressure");
    const pm = $("#fs-pm");
    const en = $("#fs-energy");
    const arch = $("#fs-arch");
    if (!ps || !pm || !en || !arch) return;

    const SVG_NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs = {}) {
      const e = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    // -------- Case + filter spec
    // Pressure drop in Pa at 12 months end-of-year; mean indoor PM in
    // µg/m³; cumulative fan energy in MWh/y. Values reflect the
    // FilterStudio reference materials (Iron Mountain · Microsoft).
    const CASES = {
      A: {
        label: "Data Center A · Iron Mountain",
        short: "Iron Mountain",
        IT: 180, // MW reference scale for this building
        filters: {
          "1": { name: "Filter 1 · Camfil",  short: "Camfil",  pressureEnd: 135.3, pmMean: 0.17, energyEnd: 204 },
          "2": { name: "Filter 2 · H&V",     short: "H&V",     pressureEnd: 217.8, pmMean: 0.12, energyEnd: 318 },
        },
      },
      B: {
        label: "Data Center B · Microsoft",
        short: "Microsoft",
        IT: 246,
        filters: {
          "1": { name: "Filter 1 · Camfil",  short: "Camfil",  pressureEnd: 142.0, pmMean: 0.20, energyEnd: 247 },
          "2": { name: "Filter 2 · H&V",     short: "H&V",     pressureEnd: 224.5, pmMean: 0.13, energyEnd: 372 },
        },
      },
    };

    // Co-benefit dollar scaling per filter-year for a single building, derived
    // from statewide totals (412 sites · $2.83M climate · $369k health) by
    // proportional share of fan energy delta. Per-building, this lands at
    // realistic ~$25–60k climate and ~$3–8k health damages avoided / yr.
    const COBENEFIT_PER_MWH = {
      climateDollars: (2.83e6 / 206419),  // ≈ $13.70 / MWh saved
      healthDollars:  (3.69e5 / 206419),  // ≈ $1.79 / MWh saved
    };

    // -------- State
    const state = {
      case: "A",
      filter: "compare",
      month: 12,        // 0..12
      playing: false,
    };

    // -------- Time series builders
    // Pressure drop vs dust loading — gentle convex curve from baseline.
    // Models ~12 months of dust accumulation. End value at month=12 is
    // the filter's reported pressureEnd.
    function pressureSeries(filter) {
      const startPa = 65;
      const out = [];
      for (let m = 0; m <= 12; m++) {
        const t = m / 12;
        const pa = startPa + (filter.pressureEnd - startPa) * Math.pow(t, 1.5);
        out.push({ m, v: pa });
      }
      return out;
    }
    // Indoor PM2.5 — oscillates around the filter's mean across the year.
    // Stable seed so the noise pattern is the same on every redraw.
    function pmSeries(filter, seed) {
      const r = rng(seed);
      const out = [];
      for (let m = 0; m <= 12; m++) {
        const seasonal = Math.sin((m / 12) * Math.PI * 2 - Math.PI / 3) * 0.025;
        const noise = (r() - 0.5) * 0.03;
        out.push({ m, v: Math.max(0, filter.pmMean + seasonal + noise) });
      }
      return out;
    }
    // Fan energy — cumulative MWh. Slightly concave (pressure drop rises
    // through the year so monthly draw rises too).
    function energySeries(filter) {
      const total = filter.energyEnd;
      const out = [];
      for (let m = 0; m <= 12; m++) {
        const t = m / 12;
        // Slightly more energy drawn later in the year due to dust loading
        const share = Math.pow(t, 0.88);
        out.push({ m, v: total * share });
      }
      return out;
    }

    function activeFilters() {
      if (state.filter === "compare") return ["1", "2"];
      return [state.filter];
    }

    // -------- Chart drawing
    const PAD = { l: 36, r: 12, t: 12, b: 22 };
    function drawLineChart(svg, opts) {
      clear(svg);
      const rect = svg.getBoundingClientRect();
      const W = Math.max(360, Math.round(rect.width));
      const H = 124;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const iw = W - PAD.l - PAD.r;
      const ih = H - PAD.t - PAD.b;
      const xMax = 12;
      const yMin = opts.yMin, yMax = opts.yMax;
      const xS = (m) => PAD.l + (m / xMax) * iw;
      const yS = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ih;

      // grid + axes
      const yTicks = opts.yTicks || 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = yMin + (yMax - yMin) * (i / yTicks);
        const y = yS(v);
        svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6 }));
        const t = el("text", { x: PAD.l - 6, y: y + 3, "text-anchor": "end", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        t.textContent = opts.fmtY ? opts.fmtY(v) : Math.round(v);
        svg.appendChild(t);
      }
      [0, 3, 6, 9, 12].forEach((m) => {
        const x = xS(m);
        svg.appendChild(el("line", { x1: x, x2: x, y1: H - PAD.b, y2: H - PAD.b + 3, stroke: "rgba(178,204,238,0.16)" }));
        const t = el("text", { x, y: H - 6, "text-anchor": "middle", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        t.textContent = `M${m}`;
        svg.appendChild(t);
      });

      // Active-time marker
      const mx = xS(state.month);
      svg.appendChild(el("line", {
        x1: mx, x2: mx, y1: PAD.t - 4, y2: H - PAD.b,
        stroke: "rgba(178,204,238,0.25)", "stroke-width": 1, "stroke-dasharray": "3 3",
      }));

      // Plot each filter's series
      opts.series.forEach((s) => {
        // Full-year series (faint)
        const fullPath = s.pts
          .map((p, i) => (i ? "L" : "M") + xS(p.m).toFixed(1) + "," + yS(p.v).toFixed(1))
          .join(" ");
        svg.appendChild(el("path", {
          d: fullPath, fill: "none",
          stroke: s.color, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.32,
        }));
        // Up-to-now series (solid)
        const upTo = s.pts.filter((p) => p.m <= state.month);
        if (upTo.length > 1) {
          const livePath = upTo
            .map((p, i) => (i ? "L" : "M") + xS(p.m).toFixed(1) + "," + yS(p.v).toFixed(1))
            .join(" ");
          svg.appendChild(el("path", {
            d: livePath, fill: "none",
            stroke: s.color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
          }));
        }
        // Marker at current point
        const last = upTo[upTo.length - 1] || s.pts[0];
        svg.appendChild(el("circle", {
          cx: xS(last.m), cy: yS(last.v), r: 3.2,
          fill: s.color, stroke: "#0a1422", "stroke-width": 1.2,
        }));
      });
    }

    // Energy chart uses bar columns per month, stacked side-by-side for compare.
    function drawEnergyBars(svg) {
      clear(svg);
      const rect = svg.getBoundingClientRect();
      const W = Math.max(360, Math.round(rect.width));
      const H = 124;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      const filters = activeFilters();
      const caseData = CASES[state.case];
      // Compute max for y-scale: use the largest filter's monthly increment
      const allMonthly = [];
      Object.values(caseData.filters).forEach((f) => {
        const s = energySeries(f);
        for (let i = 1; i <= 12; i++) allMonthly.push(s[i].v - s[i - 1].v);
      });
      const yMax = Math.max(...allMonthly) * 1.15;
      const yMin = 0;
      const yS = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
      const xS = (m) => PAD.l + ((m - 0.5) / 12) * iw;

      // axes
      [0, yMax / 2, yMax].forEach((v) => {
        const y = yS(v);
        svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6 }));
        const t = el("text", { x: PAD.l - 6, y: y + 3, "text-anchor": "end", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        t.textContent = v.toFixed(1);
        svg.appendChild(t);
      });
      [0, 3, 6, 9, 12].forEach((m) => {
        const x = PAD.l + (m / 12) * iw;
        svg.appendChild(el("line", { x1: x, x2: x, y1: H - PAD.b, y2: H - PAD.b + 3, stroke: "rgba(178,204,238,0.16)" }));
        const t = el("text", { x, y: H - 6, "text-anchor": "middle", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        t.textContent = `M${m}`;
        svg.appendChild(t);
      });
      const monthW = (iw / 12);
      const colors = { "1": "var(--accent)", "2": "var(--accent-2)" };
      const hexes  = { "1": "#0A74D6",        "2": "#6BA6F1" };
      filters.forEach((fKey, idx) => {
        const f = caseData.filters[fKey];
        const s = energySeries(f);
        const groupW = monthW * 0.72;
        const barW = filters.length === 1 ? groupW * 0.62 : groupW / 2 - 1;
        const offset = filters.length === 1 ? -barW / 2 : (idx === 0 ? -barW - 1 : 1);
        for (let m = 1; m <= 12; m++) {
          const monthly = s[m].v - s[m - 1].v;
          const xC = PAD.l + ((m - 0.5) / 12) * iw;
          const x = xC + offset;
          const y = yS(monthly);
          const past = m <= state.month;
          const r = el("rect", {
            x: x.toFixed(1), y: y.toFixed(1),
            width: Math.max(1, barW).toFixed(1),
            height: Math.max(0, (H - PAD.b) - y).toFixed(1),
            fill: hexes[fKey],
            opacity: past ? 0.95 : 0.25,
          });
          svg.appendChild(r);
        }
      });
      // Active-time marker
      const markX = PAD.l + (state.month / 12) * iw;
      svg.appendChild(el("line", {
        x1: markX, x2: markX, y1: PAD.t - 4, y2: H - PAD.b,
        stroke: "rgba(178,204,238,0.25)", "stroke-width": 1, "stroke-dasharray": "3 3",
      }));
    }

    // -------- Building archetype
    // Simple front-elevation figure: outdoor pollution column on the left,
    // building front with a labeled FILTER membrane, indoor air on the
    // right. Particle stream is amber outside / blue indoors so the
    // filtration step reads as the visual event.
    let archParticles = [];
    function buildArchetype() {
      clear(arch);
      arch.innerHTML = `
        <defs>
          <linearGradient id="fs-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1e3553"/>
            <stop offset="1" stop-color="#0f1c30"/>
          </linearGradient>
          <linearGradient id="fs-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#23426b"/>
            <stop offset="1" stop-color="#152946"/>
          </linearGradient>
        </defs>
        <!-- Outdoor PM column (left) -->
        <rect x="0" y="0" width="74" height="280" fill="rgba(252,188,126,0.04)"/>
        <text x="10" y="20" fill="rgba(252,188,126,0.9)" font-family="JetBrains Mono" font-size="9" letter-spacing="0.12em">OUTDOOR</text>
        <text x="10" y="32" fill="rgba(252,188,126,0.55)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.08em">PM₂.₅ INTAKE</text>
        <!-- Inflow arrow -->
        <g stroke="rgba(252,188,126,0.55)" stroke-width="1" fill="none">
          <line x1="10" y1="160" x2="60" y2="160"/>
          <polyline points="50,155 60,160 50,165"/>
        </g>

        <!-- Building front -->
        <rect x="74" y="68" width="216" height="172" fill="url(#fs-front)" stroke="rgba(178,204,238,0.3)" stroke-width="0.8"/>
        <!-- Roof slab -->
        <polygon points="74,68 290,68 280,52 84,52" fill="url(#fs-roof)" stroke="rgba(178,204,238,0.2)" stroke-width="0.6"/>
        <!-- Rooftop units -->
        <g stroke="rgba(178,204,238,0.4)" stroke-width="0.7" fill="rgba(178,204,238,0.08)">
          <rect x="110" y="42" width="32" height="10"/>
          <rect x="160" y="42" width="32" height="10"/>
          <rect x="210" y="42" width="32" height="10"/>
        </g>
        <!-- Server louvers -->
        <g stroke="rgba(178,204,238,0.16)" stroke-width="0.5">
          <line x1="160" y1="92" x2="284" y2="92"/>
          <line x1="160" y1="108" x2="284" y2="108"/>
          <line x1="160" y1="124" x2="284" y2="124"/>
          <line x1="160" y1="140" x2="284" y2="140"/>
          <line x1="160" y1="156" x2="284" y2="156"/>
          <line x1="160" y1="172" x2="284" y2="172"/>
          <line x1="160" y1="188" x2="284" y2="188"/>
          <line x1="160" y1="204" x2="284" y2="204"/>
          <line x1="160" y1="220" x2="284" y2="220"/>
        </g>
        <!-- Intake aperture -->
        <rect x="80" y="92" width="60" height="116" fill="rgba(252,188,126,0.08)" stroke="rgba(252,188,126,0.4)" stroke-width="0.8"/>
        <text x="110" y="86" text-anchor="middle" fill="rgba(252,188,126,0.7)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.12em">INTAKE</text>

        <!-- Filter membrane -->
        <g id="fs-filter-grp">
          <line x1="148" y1="92" x2="148" y2="208" stroke="rgba(10,116,214,0.9)" stroke-width="1.6"/>
          <line x1="151" y1="92" x2="151" y2="208" stroke="rgba(10,116,214,0.5)" stroke-width="0.7"/>
          <g stroke="rgba(10,116,214,0.5)" stroke-width="0.5">
            <line x1="147" y1="96" x2="152" y2="100"/>
            <line x1="147" y1="106" x2="152" y2="110"/>
            <line x1="147" y1="116" x2="152" y2="120"/>
            <line x1="147" y1="126" x2="152" y2="130"/>
            <line x1="147" y1="136" x2="152" y2="140"/>
            <line x1="147" y1="146" x2="152" y2="150"/>
            <line x1="147" y1="156" x2="152" y2="160"/>
            <line x1="147" y1="166" x2="152" y2="170"/>
            <line x1="147" y1="176" x2="152" y2="180"/>
            <line x1="147" y1="186" x2="152" y2="190"/>
            <line x1="147" y1="196" x2="152" y2="200"/>
          </g>
          <text id="fs-filter-label" x="149" y="84" text-anchor="middle" fill="rgba(10,116,214,0.95)" font-family="JetBrains Mono" font-size="8.5" letter-spacing="0.12em" font-weight="600">FILTER</text>
        </g>

        <!-- Indoor area label -->
        <text x="220" y="86" text-anchor="middle" fill="rgba(107,166,241,0.85)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.12em">INDOOR HALL</text>

        <!-- Ground line -->
        <line x1="0" y1="240" x2="360" y2="240" stroke="rgba(178,204,238,0.12)" stroke-width="0.6"/>

        <!-- Particles render here -->
        <g id="fs-arch-particles"></g>
      `;

      // Update filter label
      const label = arch.querySelector("#fs-filter-label");
      if (label) {
        const filters = activeFilters();
        label.textContent = filters.length === 1
          ? CASES[state.case].filters[filters[0]].short.toUpperCase()
          : "FILTER";
      }

      // Particle pool
      const group = arch.querySelector("#fs-arch-particles");
      archParticles = [];
      const N = REDUCED ? 14 : 28;
      for (let i = 0; i < N; i++) {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("r", "1.2");
        c.setAttribute("fill", "#FCBC7E");
        c.setAttribute("opacity", "0.85");
        group.appendChild(c);
        archParticles.push({
          el: c,
          x: Math.random() * 70,
          y: 92 + Math.random() * 116,
          vx: 0.4 + Math.random() * 0.45,
          state: "outside",
        });
      }
    }

    function archStep() {
      // PM removal efficiency = (1 - PM_indoor / PM_outdoor). Approximate:
      // Camfil holds indoor mean lower → higher pass-through; H&V higher
      // efficiency → lower indoor PM but more particles caught.
      const filters = activeFilters();
      const passRates = filters.map((fKey) => {
        const f = CASES[state.case].filters[fKey];
        // Higher pmMean = lower efficiency
        return Math.max(0.04, Math.min(0.4, f.pmMean / 0.5));
      });
      const passRate = passRates.reduce((a, b) => a + b, 0) / passRates.length;

      archParticles.forEach((p) => {
        if (p.state === "outside") {
          p.x += p.vx;
          if (p.x >= 148) {
            if (Math.random() < passRate) {
              p.state = "indoor";
              p.el.setAttribute("fill", "#6BA6F1");
            } else {
              p.state = "stopped";
              p.el.setAttribute("opacity", "0.2");
            }
          }
        } else if (p.state === "indoor") {
          p.x += p.vx * 0.7;
          if (p.x > 286) {
            // recycle
            p.x = -2 - Math.random() * 30;
            p.y = 92 + Math.random() * 116;
            p.state = "outside";
            p.el.setAttribute("fill", "#FCBC7E");
            p.el.setAttribute("opacity", "0.85");
          }
        } else if (p.state === "stopped") {
          // fade and respawn outside
          p.x += 0.1;
          let op = parseFloat(p.el.getAttribute("opacity")) - 0.012;
          if (op <= 0) {
            p.x = -2 - Math.random() * 30;
            p.y = 92 + Math.random() * 116;
            p.state = "outside";
            p.el.setAttribute("fill", "#FCBC7E");
            p.el.setAttribute("opacity", "0.85");
            return;
          }
          p.el.setAttribute("opacity", op.toFixed(2));
        }
        p.el.setAttribute("cx", p.x.toFixed(1));
        p.el.setAttribute("cy", p.y.toFixed(1));
      });
      if (!REDUCED) requestAnimationFrame(archStep);
    }

    // -------- Readout zone (deltas / single-filter view)
    // The visualization grammar switches with state.filter: Compare mode
    // shows 6 directional tiles ("Camfil saves 83 Pa · vs H&V 218") so
    // the user never has to read a signed delta; single-filter mode shows
    // 3 absolute tiles (pressure / PM / energy) for the active filter
    // and quietly references the other filter in the sub-row. Mode is
    // labeled explicitly in the readout header so the swap is obvious.
    const compactUSD = (v) => {
      const abs = Math.abs(v);
      const sign = v < 0 ? "−" : "";
      if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(2) + "M";
      if (abs >= 1e3) return sign + "$" + Math.round(abs / 1e3) + "k";
      return sign + "$" + Math.round(abs);
    };

    function readingsAtMonth(caseData, m) {
      const F1 = caseData.filters["1"], F2 = caseData.filters["2"];
      return {
        F1, F2,
        p1: pressureSeries(F1)[m].v, p2: pressureSeries(F2)[m].v,
        e1: energySeries(F1)[m].v,   e2: energySeries(F2)[m].v,
        pm1: pmSeries(F1, 91)[m].v,  pm2: pmSeries(F2, 113)[m].v,
      };
    }

    function renderDeltas() {
      const $deltas = $("#fs-deltas");
      const $mode = document.getElementById("fs-readout-mode");
      const $sub = document.getElementById("fs-readout-sub");
      if (!$deltas) return;
      const caseData = CASES[state.case];
      const m = Math.max(0, Math.min(12, Math.round(state.month)));
      const r = readingsAtMonth(caseData, m);

      if (state.filter === "compare") {
        // ----- Compare mode: 6 directional tiles
        $deltas.classList.add("fs__deltas--compare");
        $deltas.classList.remove("fs__deltas--single");
        if ($mode) $mode.textContent = "Comparison · Camfil vs H&V";
        if ($sub)  $sub.textContent = `${caseData.short} · Month ${m} / 12 · who wins each metric`;

        const pressureDelta = r.p2 - r.p1; // > 0 → Camfil saves Pa
        const pmDelta = r.pm1 - r.pm2;     // > 0 → H&V cleaner
        const energyDelta = r.e2 - r.e1;   // > 0 → Camfil saves MWh
        const climateAvoided = energyDelta * COBENEFIT_PER_MWH.climateDollars;
        const healthAvoided  = energyDelta * COBENEFIT_PER_MWH.healthDollars;
        const energyCost     = energyDelta * 180; // $0.18/kWh × 1000
        const total          = climateAvoided + healthAvoided + energyCost;

        const pressureWinner = pressureDelta >= 0 ? "Camfil" : "H&V";
        const pmWinner       = pmDelta >= 0 ? "H&V" : "Camfil";
        const energyWinner   = energyDelta >= 0 ? "Camfil" : "H&V";
        const totalActor     = total >= 0 ? "Camfil annual upside" : "H&V annual upside";

        const tiles = [
          {
            k: "Pressure drop",
            actor: `${pressureWinner} saves`,
            v: Math.abs(pressureDelta).toFixed(0),
            unit: "Pa",
            sub: `Camfil ${r.p1.toFixed(0)} · H&V ${r.p2.toFixed(0)}`,
            win: true,
          },
          {
            k: "Indoor PM₂.₅",
            actor: `${pmWinner} cleaner by`,
            v: Math.abs(pmDelta).toFixed(2),
            unit: "µg/m³",
            sub: `Camfil ${r.pm1.toFixed(2)} · H&V ${r.pm2.toFixed(2)}`,
            win: true,
          },
          {
            k: "Fan energy",
            actor: `${energyWinner} saves`,
            v: Math.abs(energyDelta).toFixed(0),
            unit: "MWh/y",
            sub: `Camfil ${r.e1.toFixed(0)} · H&V ${r.e2.toFixed(0)}`,
            win: true,
          },
          {
            k: "Climate damages",
            actor: "Choosing Camfil avoids",
            v: compactUSD(climateAvoided),
            unit: "/y",
            sub: `CoBE · $13.70/MWh saved`,
            win: false,
          },
          {
            k: "Public health",
            actor: "Choosing Camfil avoids",
            v: compactUSD(healthAvoided),
            unit: "/y",
            sub: "CoBE · PM-attributable damages",
            win: false,
          },
          {
            k: "Building co-benefits",
            actor: totalActor,
            v: compactUSD(total),
            unit: "/y",
            sub: "Sum of three avoided cost lines",
            total: true,
          },
        ];
        $deltas.innerHTML = tiles.map((t) => {
          const cls = `fs__delta${t.win ? " fs__delta--win" : ""}${t.total ? " fs__delta--total" : ""}`;
          return `<div class="${cls}">
            <span class="fs__delta-k">${t.k}</span>
            <span class="fs__delta-actor">${t.actor}</span>
            <span class="fs__delta-v">${t.v}<span class="u">${t.unit}</span></span>
            <span class="fs__delta-sub">${t.sub}</span>
          </div>`;
        }).join("");
      } else {
        // ----- Single-filter mode: 3 absolute-value tiles for the active filter
        $deltas.classList.add("fs__deltas--single");
        $deltas.classList.remove("fs__deltas--compare");
        const isF1 = state.filter === "1";
        const filterName = isF1 ? "Camfil" : "H&V";
        const otherName  = isF1 ? "H&V" : "Camfil";
        if ($mode) $mode.textContent = `Single filter · ${filterName}`;
        if ($sub)  $sub.innerHTML = `${caseData.short} · Month ${m} / 12 · <em>click Compare to see deltas vs ${otherName}</em>`;

        const pAct  = isF1 ? r.p1  : r.p2;
        const pOth  = isF1 ? r.p2  : r.p1;
        const pmAct = isF1 ? r.pm1 : r.pm2;
        const pmOth = isF1 ? r.pm2 : r.pm1;
        const eAct  = isF1 ? r.e1  : r.e2;
        const eOth  = isF1 ? r.e2  : r.e1;

        const dir = (a, b, d) => {
          const diff = a - b;
          const arrow = diff < 0 ? "−" : "+";
          return arrow + Math.abs(diff).toFixed(d);
        };
        const tiles = [
          {
            k: "Pressure drop",
            v: pAct.toFixed(0),
            unit: "Pa",
            sub: `vs ${otherName} ${pOth.toFixed(0)} (${dir(pAct, pOth, 0)} Pa)`,
          },
          {
            k: "Indoor PM₂.₅",
            v: pmAct.toFixed(2),
            unit: "µg/m³",
            sub: `vs ${otherName} ${pmOth.toFixed(2)} (${dir(pmAct, pmOth, 2)} µg)`,
          },
          {
            k: "Fan energy",
            v: eAct.toFixed(0),
            unit: "MWh/y cumul.",
            sub: `vs ${otherName} ${eOth.toFixed(0)} (${dir(eAct, eOth, 0)} MWh)`,
          },
        ];
        $deltas.innerHTML = tiles.map((t) => {
          return `<div class="fs__delta fs__delta--solo">
            <span class="fs__delta-k">${t.k}</span>
            <span class="fs__delta-v">${t.v}<span class="u">${t.unit}</span></span>
            <span class="fs__delta-sub">${t.sub}</span>
          </div>`;
        }).join("");
      }
    }

    // Intent block live state — updated only on user-initiated control
    // changes (case / filter clicks), not on every autoplay tick. Keeps
    // screen readers from getting a flood of month-by-month announcements
    // during the 12-second year scrubber. The timer label still shows
    // month progress separately.
    function updateIntent() {
      const filterLbl = state.filter === "compare"
        ? "Compare"
        : (state.filter === "1" ? "Filter 1 · Camfil" : "Filter 2 · H&V");
      const viewing = document.getElementById("fs-viewing");
      if (viewing) viewing.textContent = `${CASES[state.case].short} · ${filterLbl}`;
    }

    // -------- Chart redraw
    function redraw() {
      const caseData = CASES[state.case];
      const filters = activeFilters();
      const COLORS = { "1": "#0A74D6", "2": "#6BA6F1" };

      // Pressure
      const pressureSets = filters.map((fKey) => ({
        pts: pressureSeries(caseData.filters[fKey]),
        color: COLORS[fKey],
      }));
      const allP = pressureSets.flatMap((s) => s.pts.map((p) => p.v));
      const pMax = Math.max(...allP) * 1.08;
      drawLineChart(ps, {
        series: pressureSets,
        yMin: 0, yMax: pMax,
        yTicks: 4,
        fmtY: (v) => Math.round(v),
      });

      // PM
      const pmSets = filters.map((fKey) => ({
        pts: pmSeries(caseData.filters[fKey], fKey === "1" ? 91 : 113),
        color: COLORS[fKey],
      }));
      const allM = pmSets.flatMap((s) => s.pts.map((p) => p.v));
      const mMax = Math.max(...allM) * 1.2;
      drawLineChart(pm, {
        series: pmSets,
        yMin: 0, yMax: mMax,
        yTicks: 4,
        fmtY: (v) => v.toFixed(2),
      });

      // Energy bars
      drawEnergyBars(en);

      // Chart-caption readouts at the current month
      const setReadout = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
      const month = state.month;
      const F1 = caseData.filters["1"], F2 = caseData.filters["2"];
      if (filters.length === 1) {
        const f = caseData.filters[filters[0]];
        setReadout("fs-pressure-readout", `${pressureSeries(f)[month].v.toFixed(0)} Pa`);
        setReadout("fs-pm-readout", `${pmSeries(f, filters[0] === "1" ? 91 : 113)[month].v.toFixed(2)}`);
        setReadout("fs-energy-readout", `${energySeries(f)[month].v.toFixed(0)} MWh`);
      } else {
        setReadout("fs-pressure-readout", `${pressureSeries(F1)[month].v.toFixed(0)} / ${pressureSeries(F2)[month].v.toFixed(0)}`);
        setReadout("fs-pm-readout", `${pmSeries(F1, 91)[month].v.toFixed(2)} / ${pmSeries(F2, 113)[month].v.toFixed(2)}`);
        setReadout("fs-energy-readout", `${energySeries(F1)[month].v.toFixed(0)} / ${energySeries(F2)[month].v.toFixed(0)}`);
      }

      // Intent block lives outside redraw() — see updateIntent() above.
      // The autoplay year scrubber redraws ~24 times in 12 s and rebinding
      // the intent block on every tick would flood AT users.
      renderDeltas();
    }

    // -------- Timer
    let timerRaf = 0;
    function setToggleState(label, pressed) {
      const $t = $("#fs-timer-toggle");
      if (!$t) return;
      $t.textContent = label;
      $t.setAttribute("aria-pressed", pressed ? "true" : "false");
    }
    function startTimer() {
      state.playing = true;
      setToggleState("Pause", true);
      let lastT = 0;
      function tick(now) {
        if (!state.playing) return;
        if (!lastT) lastT = now;
        const dt = now - lastT;
        // Advance one full year over ~12 seconds (smooth interpolation in float).
        const inc = (dt / 12000) * 12;
        let next = state.month + inc;
        if (next >= 12) { next = 12; state.playing = false; }
        if (Math.abs(next - state.month) >= 0.05 || next === 12) {
          state.month = next;
          updateTimerUI();
          redraw();
        }
        lastT = now;
        if (state.playing) timerRaf = requestAnimationFrame(tick);
        else setToggleState("Restart", false);
      }
      timerRaf = requestAnimationFrame(tick);
    }
    function restartTimer() {
      state.playing = false;
      cancelAnimationFrame(timerRaf);
      state.month = 0;
      updateTimerUI();
      redraw();
      startTimer();
    }
    function pauseTimer() {
      state.playing = false;
      cancelAnimationFrame(timerRaf);
      setToggleState(state.month >= 12 ? "Restart" : "Resume", false);
    }
    function updateTimerUI() {
      const fill = $("#fs-timer-fill");
      if (fill) fill.style.width = ((state.month / 12) * 100) + "%";
      const lbl = $("#fs-timer-label");
      if (lbl) lbl.textContent = `Month ${Math.round(state.month)} / 12`;
    }

    // -------- Wire controls
    $$('[data-fs-case]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-fs-case]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        state.case = btn.dataset.fsCase;
        updateIntent();
        redraw();
      });
    });
    $$('[data-fs-filter]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-fs-filter]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        state.filter = btn.dataset.fsFilter;
        // Filter swap also re-labels the archetype filter membrane
        const label = arch.querySelector("#fs-filter-label");
        if (label) {
          const filters = activeFilters();
          label.textContent = filters.length === 1
            ? CASES[state.case].filters[filters[0]].short.toUpperCase()
            : "FILTER";
        }
        updateIntent();
        redraw();
      });
    });
    const $timerToggle = $("#fs-timer-toggle");
    if ($timerToggle) {
      $timerToggle.addEventListener("click", () => {
        if (state.month >= 12) { restartTimer(); return; }
        if (state.playing) pauseTimer();
        else startTimer();
      });
    }

    // -------- ResizeObserver
    if (typeof ResizeObserver !== "undefined") {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = 0; redraw(); });
      });
      ro.observe(ps);
    }

    // -------- Initial render
    buildArchetype();
    updateTimerUI();
    updateIntent();
    redraw();
    if (!REDUCED) requestAnimationFrame(archStep);
    // Auto-start the year scrubber when the section first enters viewport.
    const fsSection = document.getElementById("filterstudio");
    if (fsSection && !REDUCED) {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && state.month >= 12 && !state.playing) {
          // Begin at month 0 the first time it enters view
          state.month = 0;
          updateTimerUI();
          redraw();
          startTimer();
          io.disconnect();
        }
      }, { threshold: 0.35 });
      io.observe(fsSection);
    }
  })();

  /* ============================================================ MATRIX
     Two surfaces synced on a 500 ms tick: a building front-elevation
     figure that re-colors per scenario, and a decision-matrix grid whose
     highlighted cell anchors to the same scenario's best operating
     regime. Same cadence on both — figure changes, matrix snaps, the
     pair reads as one product demonstrating a real simulation step.
     ================================================================ */

  (function matrix() {
    const figure = $("#mx2-figure");
    const grid = $("#mx2-grid");
    if (!figure || !grid) return;

    const SVG_NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs = {}) {
      const e = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    // Scenarios cycle in this order on every 500 ms tick. Each scenario
    // names its config, its dominant brand-blue color, and the cell on
    // the matrix grid where its best operating regime lives. The grid
    // is 12 cols (envelope U-value) × 8 rows (HVAC efficiency).
    // Best regime convention: low U (left side) × high η (top side).
    const SCENARIOS = [
      { id: "baseline",     name: "Baseline · reference envelope",      colorA: "#1f3556", colorB: "#3a5a85", bestC: 7, bestR: 4, intensity: 198 },
      { id: "envelope",     name: "+ Envelope retrofit",                colorA: "#0e3870", colorB: "#0A74D6", bestC: 3, bestR: 3, intensity: 174 },
      { id: "setpoints",    name: "+ Setpoint tune",                    colorA: "#0c2e58", colorB: "#1a5396", bestC: 6, bestR: 2, intensity: 188 },
      { id: "hvac",         name: "+ HVAC efficiency upgrade",          colorA: "#0A74D6", colorB: "#6BA6F1", bestC: 5, bestR: 1, intensity: 168 },
      { id: "all",          name: "All combined · optimal regime",      colorA: "#6BA6F1", colorB: "#B2CCEE", bestC: 2, bestR: 1, intensity: 152 },
    ];
    let scenarioIdx = 0;

    // ------- Building figure (front elevation, animated colorway)
    function buildFigure() {
      clear(figure);
      figure.setAttribute("viewBox", "0 0 420 320");
      figure.innerHTML = `
        <defs>
          <linearGradient id="mx-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#23426b"/>
            <stop offset="1" stop-color="#152946"/>
          </linearGradient>
        </defs>

        <!-- Live energy-intensity readout, top-right. Sits in clear
             space well above the building so it reads as a chart
             annotation, not a label sitting on the roof. -->
        <text x="412" y="20" text-anchor="end" fill="rgba(149,163,184,0.7)" font-family="JetBrains Mono" font-size="8.5" letter-spacing="0.18em">ENERGY INTENSITY</text>
        <text id="mx-bldg-intensity" x="412" y="40" text-anchor="end" fill="rgba(10,116,214,0.95)" font-family="JetBrains Mono" font-size="14" letter-spacing="0.04em" font-weight="600">198 kWh/m²</text>

        <!-- Ground -->
        <line x1="0" y1="270" x2="420" y2="270" stroke="rgba(178,204,238,0.15)" stroke-width="0.8"/>

        <!-- Building front -->
        <rect id="mx-bldg-front" x="40" y="80" width="340" height="190" fill="#1f3556" stroke="rgba(178,204,238,0.3)" stroke-width="0.8"/>
        <!-- Roof slab -->
        <polygon id="mx-bldg-roof" points="40,80 380,80 366,60 54,60" fill="url(#mx-roof)" stroke="rgba(178,204,238,0.22)" stroke-width="0.6"/>

        <!-- Server hall louvres -->
        <g id="mx-bldg-louvres" stroke="rgba(178,204,238,0.22)" stroke-width="0.6">
          <line x1="60"  y1="110" x2="360" y2="110"/>
          <line x1="60"  y1="130" x2="360" y2="130"/>
          <line x1="60"  y1="150" x2="360" y2="150"/>
          <line x1="60"  y1="170" x2="360" y2="170"/>
          <line x1="60"  y1="190" x2="360" y2="190"/>
          <line x1="60"  y1="210" x2="360" y2="210"/>
          <line x1="60"  y1="230" x2="360" y2="230"/>
          <line x1="60"  y1="250" x2="360" y2="250"/>
        </g>

        <!-- Window pattern — fills with active highlight, the "demo
             of an intervention scanning the building" gesture. -->
        <g id="mx-bldg-cells"></g>

        <!-- Door / entrance for human scale -->
        <rect x="190" y="232" width="40" height="38" fill="rgba(178,204,238,0.1)" stroke="rgba(178,204,238,0.35)" stroke-width="0.8"/>
        <line x1="210" y1="232" x2="210" y2="270" stroke="rgba(178,204,238,0.35)" stroke-width="0.6"/>
      `;
      // Cell grid inside the building — 8 rows × 12 cols of small squares
      // that re-color in waves as scenarios cycle.
      const cellsG = figure.querySelector("#mx-bldg-cells");
      const ROWS = 7, COLS = 14;
      const x0 = 56, y0 = 96, cw = 22, ch = 18, gap = 2;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = x0 + c * (cw + gap);
          const y = y0 + r * (ch + gap);
          const sq = document.createElementNS(SVG_NS, "rect");
          sq.setAttribute("class", "mx-cell");
          sq.setAttribute("x", x);
          sq.setAttribute("y", y);
          sq.setAttribute("width", cw);
          sq.setAttribute("height", ch);
          sq.setAttribute("fill", "#1f3556");
          sq.setAttribute("opacity", "0.55");
          sq.dataset.r = r;
          sq.dataset.c = c;
          cellsG.appendChild(sq);
        }
      }
    }

    function applyFigureScenario(idx) {
      const s = SCENARIOS[idx];
      const front = figure.querySelector("#mx-bldg-front");
      if (front) {
        front.setAttribute("fill", s.colorA);
        front.style.transition = "fill 320ms cubic-bezier(.2,.8,.2,1)";
      }
      const intensity = figure.querySelector("#mx-bldg-intensity");
      if (intensity) intensity.textContent = s.intensity + " kWh/m²";
      const cells = figure.querySelectorAll(".mx-cell");
      // Cell color follows a gradient: rows closer to scenario's "best
      // operating regime" within the building get the bright B color,
      // farther rows fade to the darker A color. This visually
      // expresses "the simulation is re-evaluating the whole building".
      cells.forEach((cell) => {
        const r = +cell.dataset.r;
        const c = +cell.dataset.c;
        // Pseudo-best region — mirror the matrix grid's best cell pos
        // (mapped from 12×8 down to 14×7), so the figure highlight
        // matches the matrix highlight conceptually.
        const fbestR = Math.round(s.bestR / 8 * 7);
        const fbestC = Math.round(s.bestC / 12 * 14);
        const d = Math.sqrt((r - fbestR) ** 2 + (c - fbestC) ** 2);
        const maxD = Math.sqrt(7 ** 2 + 14 ** 2);
        const t = 1 - Math.min(1, d / (maxD * 0.5));
        cell.style.transition = "fill 360ms cubic-bezier(.2,.8,.2,1), opacity 360ms cubic-bezier(.2,.8,.2,1)";
        cell.setAttribute("fill", t > 0.5 ? s.colorB : s.colorA);
        cell.setAttribute("opacity", (0.35 + t * 0.55).toFixed(2));
      });
      // Caption + intent
      const figName = document.getElementById("mx2-fig-name");
      if (figName) figName.textContent = "Configuration · " + s.name;
    }

    // ------- Matrix grid (right side)
    const ROWS = 8, COLS = 12;
    function buildGrid() {
      clear(grid);
      grid.setAttribute("viewBox", "0 0 360 320");
      const pad = { l: 36, r: 18, t: 22, b: 38 };
      const W = 360, H = 320;
      const iw = W - pad.l - pad.r;
      const ih = H - pad.t - pad.b;
      const cellW = iw / COLS, cellH = ih / ROWS;
      // Cells
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = pad.l + c * cellW;
          const y = pad.t + r * cellH;
          const rectEl = el("rect", {
            class: "mx-grid-cell",
            x: x + 1, y: y + 1,
            width: cellW - 2, height: cellH - 2,
            rx: 2, ry: 2,
            fill: "#0e1a2c",
            opacity: 0.4,
          });
          rectEl.dataset.r = r;
          rectEl.dataset.c = c;
          grid.appendChild(rectEl);
        }
      }
      // Highlighted cell — invisible until colored by applyGridScenario
      const hi = el("rect", {
        id: "mx-grid-highlight",
        x: 0, y: 0, width: cellW - 2, height: cellH - 2,
        rx: 2, ry: 2,
        fill: "none",
        stroke: "#0A74D6",
        "stroke-width": 1.8,
        opacity: 0.95,
      });
      grid.appendChild(hi);
      // Best-cell ring
      const ring = el("circle", {
        id: "mx-grid-ring",
        cx: 0, cy: 0, r: Math.min(cellW, cellH) * 0.32,
        fill: "none",
        stroke: "#6BA6F1",
        "stroke-width": 1.1,
        opacity: 0.9,
      });
      grid.appendChild(ring);
      // Axis labels
      grid.appendChild(el("text", { x: pad.l + iw / 2, y: H - 12, "text-anchor": "middle", fill: "#95a3b8", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.08em" })).textContent = "U → high U-value";
      grid.appendChild(el("text", { x: pad.l - 28, y: pad.t + ih / 2, "text-anchor": "middle", transform: `rotate(-90 ${pad.l - 28} ${pad.t + ih / 2})`, fill: "#95a3b8", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.08em" })).textContent = "↑ η";
      // Direction marker
      grid.appendChild(el("text", { x: pad.l + 4, y: pad.t - 8, "text-anchor": "start", fill: "rgba(10,116,214,0.85)", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.16em" })).textContent = "BETTER";
      grid.appendChild(el("text", { x: pad.l + iw - 4, y: H - 22, "text-anchor": "end", fill: "rgba(149,163,184,0.7)", "font-size": 9, "font-family": "JetBrains Mono", "letter-spacing": "0.16em" })).textContent = "WORSE";

      grid._geom = { pad, W, H, iw, ih, cellW, cellH };
    }

    function applyGridScenario(idx) {
      const s = SCENARIOS[idx];
      const cells = grid.querySelectorAll(".mx-grid-cell");
      const { pad, cellW, cellH } = grid._geom;
      // Color each cell based on its distance to the active scenario's
      // best operating regime. Closer cells get the brighter B color,
      // farther cells get the darker A color. Same gradient family used
      // on the figure so the user reads them as one product.
      const maxD = Math.sqrt(ROWS ** 2 + COLS ** 2);
      cells.forEach((cell) => {
        const r = +cell.dataset.r;
        const c = +cell.dataset.c;
        const d = Math.sqrt((r - s.bestR) ** 2 + (c - s.bestC) ** 2);
        const t = 1 - Math.min(1, d / (maxD * 0.7));
        cell.style.transition = "fill 360ms cubic-bezier(.2,.8,.2,1), opacity 360ms cubic-bezier(.2,.8,.2,1)";
        const fill = t > 0.6 ? s.colorB : (t > 0.3 ? s.colorA : "#0e1a2c");
        cell.setAttribute("fill", fill);
        cell.setAttribute("opacity", (0.4 + t * 0.5).toFixed(2));
      });
      // Move the highlight rect to the best cell
      const hi = grid.querySelector("#mx-grid-highlight");
      const ring = grid.querySelector("#mx-grid-ring");
      const x = pad.l + s.bestC * cellW + 1;
      const y = pad.t + s.bestR * cellH + 1;
      if (hi) {
        hi.style.transition = "x 320ms cubic-bezier(.2,.8,.2,1), y 320ms cubic-bezier(.2,.8,.2,1), stroke 320ms cubic-bezier(.2,.8,.2,1)";
        hi.setAttribute("x", x);
        hi.setAttribute("y", y);
        hi.setAttribute("stroke", s.colorB);
      }
      if (ring) {
        ring.style.transition = "cx 320ms cubic-bezier(.2,.8,.2,1), cy 320ms cubic-bezier(.2,.8,.2,1), stroke 320ms cubic-bezier(.2,.8,.2,1)";
        ring.setAttribute("cx", x + (cellW - 2) / 2);
        ring.setAttribute("cy", y + (cellH - 2) / 2);
        ring.setAttribute("stroke", s.colorB);
      }
    }

    // Apply both surfaces + update the head readout (name, count, dots).
    function applyScenario(idx) {
      scenarioIdx = idx;
      applyFigureScenario(idx);
      applyGridScenario(idx);
      const s = SCENARIOS[idx];
      const $name = document.getElementById("mx2-name");
      const $count = document.getElementById("mx2-count");
      if ($name)  $name.textContent  = s.name;
      if ($count) $count.textContent = `${idx + 1} / ${SCENARIOS.length}`;
      // Dots reflect active scenario
      $$('.mx2__dot').forEach((d, i) => {
        const on = i === idx;
        d.classList.toggle("is-active", on);
        d.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    function step() { applyScenario((scenarioIdx + 1) % SCENARIOS.length); }

    buildFigure();
    buildGrid();
    applyScenario(0);

    // CADENCE = 1500 ms — INTENTIONAL DEVIATION from the stakeholder's
    // 500 ms ask in WEBSITE PAGE FEEDBACK.docx. At 500 ms with ~360 ms
    // applyFigureScenario / applyGridScenario transitions, the user
    // never gets a stable frame: scenario captions change faster than
    // they can be read, and the figure-to-matrix coupling the brief
    // wanted ("matrix highlight should change at the same pace") reads
    // as decorative motion rather than an analytic surface. The
    // synchronized figure-plus-matrix concept is preserved at the slower
    // tick; user ownership of the demo is restored via scenario dots
    // (click any to jump + pause) and the play/pause toggle below.
    // If you revert to 500 ms, also remove those controls or the
    // section reverts to "watch only" mode the UX review flagged.
    const CADENCE = 1500;
    let timer = 0;
    let inView = false;
    let userPaused = false;
    function setToggleLabel(playing) {
      const $t = document.getElementById("mx2-toggle");
      if (!$t) return;
      $t.textContent = playing ? "⏸ Pause cycle" : "▶ Resume cycle";
      $t.setAttribute("aria-pressed", playing ? "true" : "false");
    }
    function start() {
      if (timer || REDUCED || userPaused) return;
      timer = setInterval(step, CADENCE);
      setToggleLabel(true);
    }
    function stop()  {
      if (!timer) { setToggleLabel(false); return; }
      clearInterval(timer); timer = 0;
      setToggleLabel(false);
    }
    function userToggle() {
      if (timer) {
        userPaused = true;
        stop();
      } else {
        userPaused = false;
        if (inView) start();
      }
    }

    // Dot clicks → jump to that scenario and pause auto-cycle so the
    // user can dwell. They can resume by clicking the toggle.
    $$('.mx2__dot').forEach((dot) => {
      dot.addEventListener("click", () => {
        const idx = parseInt(dot.dataset.mxScenario, 10);
        if (!Number.isFinite(idx) || idx < 0 || idx >= SCENARIOS.length) return;
        userPaused = true;
        stop();
        applyScenario(idx);
      });
    });
    const $toggle = document.getElementById("mx2-toggle");
    if ($toggle) $toggle.addEventListener("click", userToggle);

    const mxSection = document.getElementById("matrix");
    if (mxSection) {
      const io = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        if (inView && !userPaused) start();
        else if (!inView) {
          // Pause when out of view, but don't mark as user-paused so
          // the cycle resumes on re-entry.
          clearInterval(timer); timer = 0;
        }
      }, { threshold: 0.25 });
      io.observe(mxSection);
    } else {
      start();
    }
    window.addEventListener("beforeunload", stop);
  })();

  /* ============================================================ H.E.A.A.L.
     Platform-fidelity surface — building plot · time series · space-time
     map · floor and parameter toggles. The brief asks us not to redesign
     the platform speculatively, so the composition is the
     recognizable HEAAL "building plot on the left, scrolling parameter
     on the right" layout, with restrained web-native interaction. */

  (function heaal() {
    const plot = document.getElementById("hl-plot");
    const time = document.getElementById("hl-time");
    const heat = document.getElementById("hl-heat");
    if (!plot || !time || !heat) return;

    const SVG_NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs = {}) {
      const e = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    // -------- Parameter spec
    // Each parameter knows its unit, threshold bands (Optimized → Limit
    // per brand standards §6), and an accent color (the brand's tested-
    // element palette). Bands let the building plot and space-time map
    // re-color the same sensor against the same science thresholds.
    const PARAMS = {
      pm25: {
        label: "PM₂.₅",
        unit:  "µg/m³",
        accent: "#7AA12A",
        thresholds: [4, 8, 12, 35], // Optimized < 4 ≤ Excellent < 8 ≤ Action < 12 ≤ Alert < 35 ≤ Limit
        fmt: (v) => v.toFixed(1),
      },
      co2: {
        label: "CO₂",
        unit:  "ppm",
        accent: "#3E8D5E",
        thresholds: [550, 700, 900, 1100],
        fmt: (v) => Math.round(v).toLocaleString(),
      },
      tvoc: {
        label: "TVOC",
        unit:  "µg/m³",
        accent: "#00A383",
        thresholds: [100, 200, 350, 500],
        fmt: (v) => Math.round(v).toLocaleString(),
      },
      trh: {
        // Internal key kept as `trh` so the floor baselines and reading
        // generators don't shift; user-visible label is Temperature only.
        // Relative humidity is not surfaced here — combining T and RH in
        // one scalar trace was misleading. If RH ever needs surfacing,
        // add it as its own parameter.
        label: "Temperature",
        unit:  "°C",
        accent: "#6BA6F1",
        thresholds: [21, 22, 23, 24], // ASHRAE-style setpoint band
        fmt: (v) => v.toFixed(1),
      },
    };

    const BIN_COLORS = ["#0A74D6", "#B2CCEE", "#FFEB95", "#FCBC7E", "#F5896D"];
    const BIN_NAMES  = ["Optimized", "Excellent", "Action", "Alert", "Limit"];

    function binFor(value, thresholds) {
      // Returns 0..4 for the 5 brand bins.
      for (let i = 0; i < thresholds.length; i++) {
        if (value < thresholds[i]) return i;
      }
      return thresholds.length;
    }

    // -------- Floor layouts
    // Each floor has a different sensor layout and slightly different
    // parameter baselines. Floor 2 is the live demo state by default —
    // it has alerts on PM₂.₅ and a slight CO₂ rise late afternoon.
    function sensorGrid(rows, cols) {
      const list = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push({ r, c });
      return list;
    }
    const FLOORS = {
      "1": { name: "Floor 1 · West",  bldg: "BLDG-04A", sensors: sensorGrid(4, 6), score: 82, baseline: { pm25: 9.5, co2: 720, tvoc: 165, trh: 22.8 } },
      "2": { name: "Floor 2 · Mech",  bldg: "BLDG-04A", sensors: sensorGrid(4, 6), score: 86, baseline: { pm25: 8.6, co2: 612, tvoc: 142, trh: 21.4 } },
      "3": { name: "Floor 3 · East",  bldg: "BLDG-04A", sensors: sensorGrid(4, 6), score: 91, baseline: { pm25: 5.8, co2: 488, tvoc: 96,  trh: 21.1 } },
    };

    // -------- Synthetic but stable hourly readings per sensor
    // Each sensor index produces a 24-hour series. Seeded RNG makes the
    // readings repeatable across redraws and floor switches.
    function readingsForFloor(floor, paramKey) {
      const f = FLOORS[floor];
      const base = f.baseline[paramKey];
      const series = []; // [sensorIdx][hour]
      const param = PARAMS[paramKey];
      const seedBase = (floor.charCodeAt(0) + paramKey.charCodeAt(0)) * 17;
      f.sensors.forEach((s, i) => {
        const r = rng(seedBase + i * 37);
        const hourly = [];
        // Sensor offset: row variance shifts mean ±15%, col variance ±8%
        const sensorOffset = ((s.r - 1.5) * 0.06 + (s.c - 2.5) * 0.03) * base;
        for (let h = 0; h < 24; h++) {
          const diurnal =
            paramKey === "co2"  ? Math.sin((h - 8) / 24 * Math.PI * 2) * base * 0.18
          : paramKey === "tvoc" ? Math.sin((h - 10) / 24 * Math.PI * 2) * base * 0.12
          : paramKey === "trh"  ? Math.sin((h - 12) / 24 * Math.PI * 2) * 1.4
          :                       Math.cos((h - 14) / 24 * Math.PI * 2) * base * 0.10;
          const noise = (r() - 0.5) * base * 0.06;
          let v = base + sensorOffset + diurnal + noise;
          // Floor 2 — inject a small late-afternoon spike on one sensor for PM₂.₅
          if (floor === "2" && paramKey === "pm25" && i === 9 && h >= 14 && h <= 18) v += 4.5;
          v = Math.max(0, v);
          hourly.push(v);
        }
        series.push(hourly);
      });
      return series;
    }

    // -------- State
    const state = { floor: "2", param: "pm25" };

    // -------- Building plot
    function drawPlot() {
      clear(plot);
      const param = PARAMS[state.param];
      const f = FLOORS[state.floor];
      const W = 360, H = 240;
      plot.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const pad = { l: 22, r: 22, t: 22, b: 28 };
      // Floor outline — rectangle with a clipped corner so it reads as a plan
      plot.appendChild(el("rect", {
        x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b,
        fill: "rgba(178,204,238,0.04)",
        stroke: "rgba(178,204,238,0.32)",
        "stroke-width": 1,
      }));
      // Internal walls (mech rooms)
      plot.appendChild(el("rect", {
        x: pad.l + 10, y: pad.t + 10, width: 70, height: 40,
        fill: "none", stroke: "rgba(178,204,238,0.16)", "stroke-width": 0.7,
      }));
      plot.appendChild(el("rect", {
        x: W - pad.r - 70 - 10, y: H - pad.b - 50, width: 70, height: 40,
        fill: "none", stroke: "rgba(178,204,238,0.16)", "stroke-width": 0.7,
      }));
      // Floor label
      plot.appendChild(el("text", {
        x: pad.l, y: pad.t - 8,
        fill: "rgba(178,204,238,0.55)",
        "font-family": "JetBrains Mono",
        "font-size": 9,
        "letter-spacing": "0.14em",
      })).textContent = (f.name + " · " + f.bldg).toUpperCase();
      // North arrow
      plot.appendChild(el("text", {
        x: W - pad.r, y: pad.t - 8, "text-anchor": "end",
        fill: "rgba(178,204,238,0.4)",
        "font-family": "JetBrains Mono", "font-size": 9, "letter-spacing": "0.14em",
      })).textContent = "↑ N";

      // Sensors — placed on a regular grid inside the floor plan
      const innerX = pad.l + 20;
      const innerY = pad.t + 30;
      const innerW = W - pad.l - pad.r - 40;
      const innerH = H - pad.t - pad.b - 50;
      const readings = readingsForFloor(state.floor, state.param);
      f.sensors.forEach((s, i) => {
        const x = innerX + (s.c + 0.5) / 6 * innerW;
        const y = innerY + (s.r + 0.5) / 4 * innerH;
        const lastValue = readings[i][readings[i].length - 1];
        const bin = binFor(lastValue, param.thresholds);
        const c = BIN_COLORS[Math.min(4, bin)];
        // Sensor halo (soft)
        plot.appendChild(el("circle", { cx: x, cy: y, r: 12, fill: c, opacity: 0.14 }));
        // Sensor dot
        plot.appendChild(el("circle", {
          cx: x, cy: y, r: 5.5,
          fill: c, stroke: "#0a1422", "stroke-width": 1.2,
        }));
        // Sensor ID
        plot.appendChild(el("text", {
          x: x, y: y + 18,
          "text-anchor": "middle",
          fill: "rgba(149,163,184,0.7)",
          "font-family": "JetBrains Mono", "font-size": 7.5,
          "letter-spacing": "0.06em",
        })).textContent = "S" + String(i + 1).padStart(2, "0");
      });

      // Legend (bins active)
      const legend = document.getElementById("hl-plot-legend");
      if (legend) {
        legend.innerHTML = BIN_NAMES.map((n, i) =>
          `<span><i style="background:${BIN_COLORS[i]}"></i>${n}</span>`
        ).join("");
      }
    }

    // -------- Time series
    function drawTime() {
      clear(time);
      const param = PARAMS[state.param];
      const series = readingsForFloor(state.floor, state.param);
      // Spatial average across sensors → primary line. Min/max envelope shaded.
      const HOURS = 24;
      const avg = [], lo = [], hi = [];
      for (let h = 0; h < HOURS; h++) {
        let s = 0, minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < series.length; i++) {
          const v = series[i][h];
          s += v;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        avg.push(s / series.length);
        lo.push(minV);
        hi.push(maxV);
      }

      const W = 480, H = 140;
      time.setAttribute("viewBox", `0 0 ${W} ${H}`);
      time.setAttribute("preserveAspectRatio", "none");
      const pad = { l: 38, r: 12, t: 12, b: 24 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      // Y range pinned to ~1.25× max sensor reading
      const maxY = Math.max(...hi) * 1.15;
      const minY = Math.min(0, Math.min(...lo) * 0.95);
      const xS = (h) => pad.l + (h / (HOURS - 1)) * iw;
      const yS = (v) => pad.t + (1 - (v - minY) / (maxY - minY)) * ih;

      // Threshold bands — soft horizontal strips so users can see at a
      // glance which bin the live trace is in.
      const thresh = param.thresholds;
      const bandBoundaries = [minY, ...thresh, maxY].filter((v, i, arr) => i === 0 || v > arr[i - 1]);
      for (let i = 0; i < bandBoundaries.length - 1; i++) {
        const yTop = yS(bandBoundaries[i + 1]);
        const yBot = yS(bandBoundaries[i]);
        time.appendChild(el("rect", {
          x: pad.l, y: yTop,
          width: iw, height: Math.max(0, yBot - yTop),
          fill: BIN_COLORS[i] || BIN_COLORS[4], opacity: 0.06,
        }));
      }
      // Axis gridlines
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
        const v = minY + (maxY - minY) * (1 - t);
        const y = pad.t + t * ih;
        time.appendChild(el("line", {
          x1: pad.l, x2: W - pad.r, y1: y, y2: y,
          stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6,
        }));
        const tx = el("text", {
          x: pad.l - 6, y: y + 3, "text-anchor": "end",
          fill: "#5f6c80",
          "font-family": "JetBrains Mono", "font-size": 8.5,
        });
        tx.textContent = param.fmt(v);
        time.appendChild(tx);
      });
      // Hour ticks
      [0, 6, 12, 18, 23].forEach((h) => {
        const x = xS(h);
        time.appendChild(el("line", {
          x1: x, x2: x, y1: H - pad.b, y2: H - pad.b + 3,
          stroke: "rgba(178,204,238,0.18)",
        }));
        const tx = el("text", {
          x: x, y: H - 6, "text-anchor": "middle",
          fill: "#5f6c80",
          "font-family": "JetBrains Mono", "font-size": 8.5,
        });
        tx.textContent = String(h).padStart(2, "0") + ":00";
        time.appendChild(tx);
      });

      // Envelope
      const envPath = (
        avg.map((_, i) => (i ? "L" : "M") + xS(i).toFixed(1) + "," + yS(hi[i]).toFixed(1)).join(" ") +
        " " +
        avg.slice().reverse().map((_, j) => {
          const i = HOURS - 1 - j;
          return "L" + xS(i).toFixed(1) + "," + yS(lo[i]).toFixed(1);
        }).join(" ") +
        " Z"
      );
      time.appendChild(el("path", {
        d: envPath, fill: param.accent, opacity: 0.18,
      }));
      // Average trace
      const avgPath = avg.map((v, i) => (i ? "L" : "M") + xS(i).toFixed(1) + "," + yS(v).toFixed(1)).join(" ");
      time.appendChild(el("path", {
        d: avgPath, fill: "none", stroke: param.accent,
        "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
      }));
      // Latest marker
      const lastV = avg[avg.length - 1];
      time.appendChild(el("circle", {
        cx: xS(HOURS - 1), cy: yS(lastV), r: 3.4,
        fill: param.accent, stroke: "#0a1422", "stroke-width": 1.2,
      }));
      // Update header readouts
      const timeNow = document.getElementById("hl-time-now");
      const timeUnit = document.getElementById("hl-time-unit");
      const timeTitle = document.getElementById("hl-time-title");
      if (timeNow) timeNow.textContent = param.fmt(lastV);
      if (timeUnit) timeUnit.textContent = param.unit;
      if (timeTitle) timeTitle.innerHTML = "Time series · " + param.label;
    }

    // -------- Space-time heatmap
    function drawHeat() {
      clear(heat);
      const param = PARAMS[state.param];
      const series = readingsForFloor(state.floor, state.param);
      const N = series.length;
      const HOURS = 24;
      const W = 480, H = 130;
      heat.setAttribute("viewBox", `0 0 ${W} ${H}`);
      heat.setAttribute("preserveAspectRatio", "none");
      const pad = { l: 38, r: 12, t: 10, b: 22 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const cellW = iw / HOURS;
      const cellH = ih / N;
      // Cells colored by threshold bin per reading
      for (let i = 0; i < N; i++) {
        for (let h = 0; h < HOURS; h++) {
          const v = series[i][h];
          const bin = binFor(v, param.thresholds);
          const x = pad.l + h * cellW;
          const y = pad.t + i * cellH;
          heat.appendChild(el("rect", {
            x: x.toFixed(1), y: y.toFixed(1),
            width: cellW.toFixed(1), height: cellH.toFixed(1),
            fill: BIN_COLORS[Math.min(4, bin)],
            opacity: 0.65,
          }));
        }
      }
      // Sensor labels (Y axis)
      for (let i = 0; i < N; i += Math.max(1, Math.floor(N / 4))) {
        const y = pad.t + (i + 0.5) * cellH + 3;
        heat.appendChild(el("text", {
          x: pad.l - 6, y, "text-anchor": "end",
          fill: "#5f6c80",
          "font-family": "JetBrains Mono", "font-size": 8.5,
        })).textContent = "S" + String(i + 1).padStart(2, "0");
      }
      // Hour ticks (X axis)
      [0, 6, 12, 18, 23].forEach((h) => {
        const x = pad.l + h * cellW + cellW / 2;
        heat.appendChild(el("text", {
          x, y: H - 6, "text-anchor": "middle",
          fill: "#5f6c80",
          "font-family": "JetBrains Mono", "font-size": 8.5,
        })).textContent = String(h).padStart(2, "0") + ":00";
      });
    }

    // -------- Score + intent
    function applyScore() {
      const f = FLOORS[state.floor];
      const $score = document.getElementById("hl-score");
      const $bar = document.getElementById("hl-bar");
      const $note = document.getElementById("hl-score-note");
      if ($score) $score.textContent = String(f.score);
      if ($bar) $bar.style.width = f.score + "%";
      // Quick status note — count "Alert" or "Limit" readings on the current
      // parameter to surface real signal without hand-tuned floors data.
      const param = PARAMS[state.param];
      const readings = readingsForFloor(state.floor, state.param);
      let alerts = 0, exceeds = 0;
      readings.forEach((s) => {
        const lastV = s[s.length - 1];
        const bin = binFor(lastV, param.thresholds);
        if (bin === 3) alerts++;
        else if (bin >= 4) exceeds++;
      });
      if ($note) $note.textContent = `${f.name} · ${alerts} alert${alerts === 1 ? "" : "s"} · ${exceeds} threshold${exceeds === 1 ? "" : "s"} exceeded · ${param.label}`;

      const intent = document.getElementById("intent-hl");
      if (intent) {
        const series = readingsForFloor(state.floor, state.param);
        let sum = 0;
        series.forEach((s) => { sum += s[s.length - 1]; });
        const avg = sum / series.length;
        intent.innerHTML = `${f.name} · ${param.label} · <b>${param.fmt(avg)}</b> ${param.unit}`;
      }
    }

    function redraw() {
      drawPlot();
      drawTime();
      drawHeat();
      applyScore();
    }

    // -------- Wire controls
    $$('[data-hl-floor]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-hl-floor]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        state.floor = btn.dataset.hlFloor;
        redraw();
      });
    });
    $$('[data-hl-param]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-hl-param]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        state.param = btn.dataset.hlParam;
        redraw();
      });
    });

    // ResizeObserver — only redraw time/heat (the plot is xMidYMid meet so it scales fine)
    if (typeof ResizeObserver !== "undefined") {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = 0; drawTime(); drawHeat(); });
      });
      ro.observe(time);
    }

    // Initial paint
    redraw();
    // Animate the score bar fill on first viewport entry
    const bar = document.getElementById("hl-bar");
    if (bar && !REDUCED) {
      const targetWidth = bar.style.width;
      bar.style.width = "0%";
      const scoreIO = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          bar.style.transition = "width 900ms cubic-bezier(.2,.8,.2,1)";
          requestAnimationFrame(() => { bar.style.width = targetWidth; });
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
