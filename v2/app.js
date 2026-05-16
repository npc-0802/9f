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
      // Briefing-style grouping echoing the deck's case-study setup
      // (Location · Building · System Characteristics). Same row primitive
      // as before so the kv CSS still applies; the new sub-headers carry
      // the deck's information-architecture into the side panel.
      const groups = [
        { title: "Location Information", rows: [
          ["County", d.county],
          ["eGRID region", d.egrid],
          ["Coordinates", `${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}`],
          ["Status", d.status[0].toUpperCase() + d.status.slice(1)],
        ]},
        { title: "Building Information", rows: [
          ["Floor area", `${m2} m²`],
          ["Ceiling height", `${fmt.flt(d.ceiling_m)} m`],
          ["IT load", `${fmt.flt(d.it_mw, 2)} MW`],
          ["PUE", fmt.flt(d.pue, 2)],
        ]},
        { title: "System Characteristics", rows: [
          ["System type", d.system],
          ["Air fraction", air],
          ["System capacity", cap],
          ["Number of filters", fmt.num(d.filters)],
        ]},
      ];
      kv.innerHTML = groups.map((g) =>
        `<div class="kv__group-title">${g.title}</div>` +
        g.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")
      ).join("");

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
     Slide-fidelity rebuild against UI mock.pdf:
       - Anonymous case studies (Data Center A / B) and filters (A / B)
       - No operating-year scrubber, no month state
       - Animated building figure on the LEFT (slide 4 for A, slide 10 for B)
       - Three deck-faithful graphs on the RIGHT:
           Pressure drop · slides 5 (A) / 11 (B)
           Indoor PM2.5  · slides 6 (A) / 12 (B)
           Energy use    · slides 7 (A) / 13 (B) — grouped recirc + vent
       - Top-right readouts source from slide 8 (A) / 14 (B) exactly
       - TBO compare zone retains the deck's 5-lane category stack
     One state object drives everything: { case, filter }.
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

    // ---------- Case + filter spec ----------
    // Values lifted directly from UI mock.pdf — slide 8 (Data Center A TBO)
    // and slide 14 (Data Center B TBO). The per-loop energy split comes
    // from slides 7 (A) and 13 (B). All vendor names anonymized per the
    // exact-fidelity brief.
    const CASES = {
      A: {
        label: "Data Center A · Manassas, VA",
        short: "Manassas, VA",
        site: {
          address: "11680 Hayden Road, Manassas, VA",
          totalVolume_m3: 743224,
          itCapacity_MW: 280,
          dailySchedule_h: 24,
          systemType: "Direct liquid cooling (DLC)",
          airFraction: "20% air cooling · 80% liquid cooling",
          systemCapacity: "113 m³/s ventilation · 487 m³/s recirculation",
          filterCount: "122 ventilation · 523 recirculation",
        },
        filters: {
          // Slide 8 (A · TBO): A = lower-pressure (135 Pa), lower PM (0.12),
          // lower energy (844K kWh/y); B = higher across the board.
          "A": { name: "Filter A", pressureEnd: 135.32, pmMean: 0.12, pm10Mean: 0.07, energyKwh:  844442, energyRecirc:  640345, energyVent:  204097, energyCost: 150311, dustHeld: 188.99 },
          "B": { name: "Filter B", pressureEnd: 217.83, pmMean: 0.17, pm10Mean: 0.08, energyKwh: 1296550, energyRecirc:  977841, energyVent:  318411, energyCost: 230786, dustHeld: 187.26 },
        },
      },
      B: {
        label: "Data Center B · Boydton, VA",
        short: "Boydton, VA",
        site: {
          address: "101 Herbert Drive, Boydton, VA",
          totalVolume_m3: 408773,
          itCapacity_MW: 222,
          dailySchedule_h: 24,
          systemType: "Direct evaporative cooling (DEC)",
          airFraction: "50% air cooling · 50% liquid cooling",
          systemCapacity: "600 m³/s ventilation · 600 m³/s recirculation",
          filterCount: "645 ventilation · 645 recirculation",
        },
        filters: {
          // Slide 14 (B · TBO): A still lower-pressure / lower energy than B.
          // PM is reversed at this site (A 0.62 vs B 0.60) but very close.
          "A": { name: "Filter A", pressureEnd: 138.51, pmMean: 0.62, pm10Mean: 0.29, energyKwh: 1890841, energyRecirc:  796344, energyVent: 1094498, energyCost: 336570, dustHeld: 197.53 },
          "B": { name: "Filter B", pressureEnd: 219.86, pmMean: 0.60, pm10Mean: 0.25, energyKwh: 2918257, energyRecirc: 1215364, energyVent: 1725270, energyCost: 519500, dustHeld: 189.96 },
        },
      },
    };

    // Co-benefit dollar scaling per MWh — derived from statewide totals
    // (412 sites · $2.83M climate · $369k health · 206,419 MWh saved).
    const COBENEFIT_PER_MWH = {
      climateDollars: (2.83e6 / 206419),  // ≈ $13.71 / MWh saved
      healthDollars:  (3.69e5 / 206419),  // ≈ $1.79 / MWh saved
    };

    // ---------- State ----------
    const state = { case: "A", filter: "compare" };

    // ---------- Formatters ----------
    const compactUSD = (v) => {
      const abs = Math.abs(v), sign = v < 0 ? "−" : "";
      if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(2) + "M";
      if (abs >= 1e3) return sign + "$" + Math.round(abs / 1e3) + "k";
      return sign + "$" + Math.round(abs);
    };
    const fmtUSDFull = (v) => "$" + Math.abs(Math.round(v)).toLocaleString();
    const fmtKwh    = (v) => v.toLocaleString() + " kWh/y";
    const fmtMWh    = (kwh) => (kwh / 1000).toFixed(0) + " MWh/y";

    function activeFilters() {
      return state.filter === "compare" ? ["A", "B"] : [state.filter];
    }

    // ---------- Series builders (full-year shapes — no month scrubber) ----------
    function pressureSeries(filter) {
      const startPa = 65;
      const out = [];
      const N = 60;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const pa = startPa + (filter.pressureEnd - startPa) * Math.pow(t, 1.5);
        out.push({ t, v: pa });
      }
      return out;
    }
    function pmSeries(filter, seed) {
      const r = rng(seed);
      const out = [];
      const N = 240; // dense for noisy slide-6 / slide-12 character
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const seasonal = Math.sin(t * Math.PI * 2 - Math.PI / 3) * 0.025;
        const noise = (r() - 0.5) * 0.045;
        out.push({ t, v: Math.max(0, filter.pmMean + seasonal + noise) });
      }
      return out;
    }

    // ---------- Chart drawing ----------
    const PAD = { l: 38, r: 14, t: 14, b: 22 };
    function lineChart(svg, opts) {
      clear(svg);
      const rect = svg.getBoundingClientRect();
      const W = Math.max(360, Math.round(rect.width));
      const H = 140;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      const xS = (t) => PAD.l + t * iw;
      const yS = (v) => PAD.t + (1 - (v - opts.yMin) / (opts.yMax - opts.yMin)) * ih;

      // y-axis gridlines + labels
      const yTicks = opts.yTicks || 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = opts.yMin + (opts.yMax - opts.yMin) * (i / yTicks);
        const y = yS(v);
        svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6 }));
        const t = el("text", { x: PAD.l - 6, y: y + 3, "text-anchor": "end", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        t.textContent = opts.fmtY ? opts.fmtY(v) : Math.round(v);
        svg.appendChild(t);
      }
      // x-axis ticks (slide convention shows clean tick stops along the
      // axis; we use 5 evenly-spaced labels)
      const xLabels = opts.xLabels || ["", "", "", "", ""];
      xLabels.forEach((lbl, i) => {
        const t = i / (xLabels.length - 1);
        const x = xS(t);
        svg.appendChild(el("line", { x1: x, x2: x, y1: H - PAD.b, y2: H - PAD.b + 3, stroke: "rgba(178,204,238,0.18)" }));
        if (lbl) {
          const tx = el("text", { x, y: H - 6, "text-anchor": "middle", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
          tx.textContent = lbl;
          svg.appendChild(tx);
        }
      });
      // Plot each series
      opts.series.forEach((s) => {
        const path = s.pts.map((p, i) => (i ? "L" : "M") + xS(p.t).toFixed(1) + "," + yS(p.v).toFixed(1)).join(" ");
        svg.appendChild(el("path", {
          d: path, fill: "none",
          stroke: s.color, "stroke-width": s.width || 1.8,
          "stroke-linecap": "round", "stroke-linejoin": "round",
          opacity: s.opacity || 0.95,
        }));
        // Endpoint marker + final-value annotation
        if (opts.endpointLabel !== false) {
          const last = s.pts[s.pts.length - 1];
          svg.appendChild(el("circle", { cx: xS(last.t), cy: yS(last.v), r: 3.4, fill: s.color, stroke: "#0a1422", "stroke-width": 1.2 }));
        }
      });
    }

    // Grouped bar chart for Energy — matches slide 7 (A) / 13 (B):
    // two groups (Recirculation, Ventilation), two bars per group
    // (Filter A green, Filter B blue), kWh/y on Y-axis.
    function drawEnergyBars(svg) {
      clear(svg);
      const rect = svg.getBoundingClientRect();
      const W = Math.max(360, Math.round(rect.width));
      const H = 140;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      const filters = activeFilters();
      const caseData = CASES[state.case];
      const colors = { "A": "#7CB342", "B": "#0A74D6" };

      // Compute max kWh across both loops + both filters for y-scale
      const allVals = [];
      Object.values(caseData.filters).forEach((f) => { allVals.push(f.energyRecirc, f.energyVent); });
      const yMax = Math.max(...allVals) * 1.18;
      const yS = (v) => PAD.t + (1 - v / yMax) * ih;

      // y gridlines + labels
      [0, yMax / 2, yMax].forEach((v) => {
        const y = yS(v);
        svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6 }));
        const tx = el("text", { x: PAD.l - 6, y: y + 3, "text-anchor": "end", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        tx.textContent = v >= 1e3 ? (v / 1000).toFixed(0) + "K" : Math.round(v);
        svg.appendChild(tx);
      });

      // Two groups: Recirculation, Ventilation
      const groups = ["Recirc", "Vent"];
      const groupW = iw / groups.length;
      groups.forEach((groupLabel, gi) => {
        const groupCx = PAD.l + (gi + 0.5) * groupW;
        const barCount = filters.length;
        const barW = Math.min(36, groupW * 0.32 / Math.max(1, barCount));
        const gap = Math.max(2, barW * 0.18);
        filters.forEach((fKey, bi) => {
          const f = caseData.filters[fKey];
          const value = gi === 0 ? f.energyRecirc : f.energyVent;
          const offset = barCount === 1
            ? -barW / 2
            : (bi - (barCount - 1) / 2) * (barW + gap) - barW / 2;
          const x = groupCx + offset;
          const y = yS(value);
          svg.appendChild(el("rect", {
            x: x.toFixed(1), y: y.toFixed(1),
            width: barW.toFixed(1),
            height: Math.max(0, (H - PAD.b) - y).toFixed(1),
            fill: colors[fKey], opacity: 0.92,
          }));
          // Value label above bar
          const lbl = el("text", {
            x: (x + barW / 2).toFixed(1),
            y: (y - 4).toFixed(1),
            "text-anchor": "middle",
            fill: colors[fKey],
            "font-size": 9.5,
            "font-family": "JetBrains Mono",
            "font-weight": 600,
          });
          lbl.textContent = value.toLocaleString();
          svg.appendChild(lbl);
        });
        // Group label
        const gl = el("text", {
          x: groupCx, y: H - 6,
          "text-anchor": "middle",
          fill: "#95a3b8",
          "font-size": 9,
          "font-family": "JetBrains Mono",
          "letter-spacing": "0.08em",
        });
        gl.textContent = groupLabel + " filter";
        svg.appendChild(gl);
      });
    }

    // ---------- Building animation per case ----------
    // The figure changes per case study (slide 4 vs slide 10) — both are
    // wireframe-style outline buildings with a labeled FILTER membrane,
    // outdoor-PM intake on the left, indoor air on the right. Particle
    // stream flows left to right; ~filter.pmMean drives pass-through.
    let archParticles = [];
    function buildArchetype() {
      clear(arch);
      const wire = "rgba(178,204,238,0.78)";
      const wireDim = "rgba(178,204,238,0.32)";
      if (state.case === "A") {
        // Slide 4: low-slung horizontal industrial massing with pitched
        // roof segments. Single floor, large fenestration band.
        arch.innerHTML = `
          <text x="14" y="22" fill="#FCBC7E" font-family="JetBrains Mono" font-size="9" letter-spacing="0.18em">OUTDOOR PM₂.₅</text>
          <text x="346" y="22" text-anchor="end" fill="#6BA6F1" font-family="JetBrains Mono" font-size="9" letter-spacing="0.18em">INDOOR HALL</text>

          <!-- Inflow arrow -->
          <g stroke="rgba(252,188,126,0.6)" stroke-width="1" fill="none">
            <line x1="14" y1="148" x2="70" y2="148"/>
            <polyline points="60,143 70,148 60,153"/>
          </g>

          <!-- Building wireframe — slide-4 silhouette (long, low, pitched roof) -->
          <g stroke="${wire}" stroke-width="1" fill="none">
            <!-- Front face -->
            <polyline points="80,238 80,98 124,76 180,76 236,76 292,76 320,98 320,238 80,238"/>
            <!-- Pitched roof segments -->
            <polyline points="80,98 124,76"/>
            <polyline points="124,76 124,98"/>
            <polyline points="180,76 180,98"/>
            <polyline points="236,76 236,98"/>
            <polyline points="292,76 292,98"/>
            <polyline points="292,76 320,98"/>
            <!-- Ground line -->
            <line x1="0" y1="238" x2="360" y2="238"/>
            <!-- Floor band / fenestration -->
            <line x1="80" y1="120" x2="320" y2="120"/>
            <line x1="80" y1="142" x2="320" y2="142"/>
            <line x1="80" y1="164" x2="320" y2="164"/>
            <line x1="80" y1="186" x2="320" y2="186"/>
            <line x1="80" y1="208" x2="320" y2="208"/>
          </g>
          <!-- Verticals (wall divisions) -->
          <g stroke="${wireDim}" stroke-width="0.6">
            <line x1="124" y1="98" x2="124" y2="238"/>
            <line x1="168" y1="98" x2="168" y2="238"/>
            <line x1="212" y1="98" x2="212" y2="238"/>
            <line x1="256" y1="98" x2="256" y2="238"/>
            <line x1="292" y1="98" x2="292" y2="238"/>
          </g>

          <!-- Filter membrane (slightly to the left of mid) -->
          <g id="fs-filter-grp">
            <line x1="100" y1="104" x2="100" y2="232" stroke="#0A74D6" stroke-width="1.6"/>
            <line x1="102" y1="104" x2="102" y2="232" stroke="rgba(10,116,214,0.5)" stroke-width="0.7"/>
            <text id="fs-filter-label" x="101" y="96" text-anchor="middle" fill="#0A74D6" font-family="JetBrains Mono" font-size="8.5" letter-spacing="0.12em" font-weight="600">FILTER</text>
          </g>

          <text x="14" y="260" fill="rgba(149,163,184,0.55)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.14em">DATA CENTER A · MANASSAS</text>
          <g id="fs-arch-particles"></g>
        `;
      } else {
        // Slide 10: taller, boxier, vertical-fin facade (warehouse mass).
        arch.innerHTML = `
          <text x="14" y="22" fill="#FCBC7E" font-family="JetBrains Mono" font-size="9" letter-spacing="0.18em">OUTDOOR PM₂.₅</text>
          <text x="346" y="22" text-anchor="end" fill="#6BA6F1" font-family="JetBrains Mono" font-size="9" letter-spacing="0.18em">INDOOR HALL</text>

          <g stroke="rgba(252,188,126,0.6)" stroke-width="1" fill="none">
            <line x1="14" y1="148" x2="70" y2="148"/>
            <polyline points="60,143 70,148 60,153"/>
          </g>

          <!-- Building wireframe — slide-10 silhouette (taller, boxy, vertical fins) -->
          <g stroke="${wire}" stroke-width="1" fill="none">
            <!-- Roof slab -->
            <polyline points="80,58 320,58"/>
            <line x1="80" y1="58" x2="320" y2="58"/>
            <line x1="74" y1="64" x2="326" y2="64"/>
            <line x1="80" y1="58" x2="74" y2="64"/>
            <line x1="320" y1="58" x2="326" y2="64"/>
            <!-- Front face -->
            <rect x="74" y="64" width="252" height="174"/>
            <!-- Ground -->
            <line x1="0" y1="238" x2="360" y2="238"/>
          </g>
          <!-- Vertical fin pattern (the slide-10 facade signature) -->
          <g stroke="${wireDim}" stroke-width="0.6">
            <line x1="92" y1="64"  x2="92" y2="238"/>
            <line x1="108" y1="64" x2="108" y2="238"/>
            <line x1="124" y1="64" x2="124" y2="238"/>
            <line x1="140" y1="64" x2="140" y2="238"/>
            <line x1="156" y1="64" x2="156" y2="238"/>
            <line x1="172" y1="64" x2="172" y2="238"/>
            <line x1="188" y1="64" x2="188" y2="238"/>
            <line x1="204" y1="64" x2="204" y2="238"/>
            <line x1="220" y1="64" x2="220" y2="238"/>
            <line x1="236" y1="64" x2="236" y2="238"/>
            <line x1="252" y1="64" x2="252" y2="238"/>
            <line x1="268" y1="64" x2="268" y2="238"/>
            <line x1="284" y1="64" x2="284" y2="238"/>
            <line x1="300" y1="64" x2="300" y2="238"/>
          </g>
          <!-- Horizontal floor lines -->
          <g stroke="${wireDim}" stroke-width="0.6">
            <line x1="74" y1="118" x2="326" y2="118"/>
            <line x1="74" y1="172" x2="326" y2="172"/>
          </g>

          <!-- Filter membrane -->
          <g id="fs-filter-grp">
            <line x1="100" y1="72" x2="100" y2="232" stroke="#0A74D6" stroke-width="1.6"/>
            <line x1="102" y1="72" x2="102" y2="232" stroke="rgba(10,116,214,0.5)" stroke-width="0.7"/>
            <text id="fs-filter-label" x="101" y="64" text-anchor="middle" fill="#0A74D6" font-family="JetBrains Mono" font-size="8.5" letter-spacing="0.12em" font-weight="600">FILTER</text>
          </g>

          <text x="14" y="260" fill="rgba(149,163,184,0.55)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.14em">DATA CENTER B · BOYDTON</text>
          <g id="fs-arch-particles"></g>
        `;
      }

      // Update filter label per active filter
      const label = arch.querySelector("#fs-filter-label");
      if (label) {
        const filters = activeFilters();
        label.textContent = filters.length === 1
          ? CASES[state.case].filters[filters[0]].name.toUpperCase()
          : "FILTER";
      }

      // Particle pool
      const group = arch.querySelector("#fs-arch-particles");
      archParticles = [];
      const N = REDUCED ? 14 : 32;
      const interiorTop = state.case === "A" ? 104 : 72;
      const interiorBot = 232;
      for (let i = 0; i < N; i++) {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("r", "1.2");
        c.setAttribute("fill", "#FCBC7E");
        c.setAttribute("opacity", "0.85");
        group.appendChild(c);
        archParticles.push({
          el: c,
          x: Math.random() * 60,
          y: interiorTop + Math.random() * (interiorBot - interiorTop),
          vx: 0.4 + Math.random() * 0.45,
          state: "outside",
          yRange: [interiorTop, interiorBot],
        });
      }
    }

    function archStep() {
      const filters = activeFilters();
      const passRates = filters.map((fKey) => {
        const f = CASES[state.case].filters[fKey];
        return Math.max(0.04, Math.min(0.4, f.pmMean / 0.9));
      });
      const passRate = passRates.reduce((a, b) => a + b, 0) / passRates.length;

      archParticles.forEach((p) => {
        if (p.state === "outside") {
          p.x += p.vx;
          if (p.x >= 100) {
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
          if (p.x > 326) {
            p.x = -2 - Math.random() * 24;
            p.y = p.yRange[0] + Math.random() * (p.yRange[1] - p.yRange[0]);
            p.state = "outside";
            p.el.setAttribute("fill", "#FCBC7E");
            p.el.setAttribute("opacity", "0.85");
          }
        } else if (p.state === "stopped") {
          p.x += 0.1;
          let op = parseFloat(p.el.getAttribute("opacity")) - 0.012;
          if (op <= 0) {
            p.x = -2 - Math.random() * 24;
            p.y = p.yRange[0] + Math.random() * (p.yRange[1] - p.yRange[0]);
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

    // ---------- TBO / Compare zone ----------
    function renderDeltas() {
      const $deltas = $("#fs-deltas");
      const $mode = document.getElementById("fs-readout-mode");
      const $sub = document.getElementById("fs-readout-sub");
      if (!$deltas) return;
      const caseData = CASES[state.case];
      const FA = caseData.filters["A"], FB = caseData.filters["B"];

      if (state.filter === "compare") {
        $deltas.classList.add("fs__deltas--compare");
        $deltas.classList.remove("fs__deltas--single");
        if ($mode) $mode.textContent = "Total Co-Benefits of Ownership";
        if ($sub)  $sub.textContent = `${caseData.short} · Filter A vs Filter B · 1 Year Period`;

        // Use end-of-year deck values throughout
        const pressureDelta = FB.pressureEnd - FA.pressureEnd;
        const pmDelta       = FB.pmMean - FA.pmMean;
        const energyDeltaMWh = (FB.energyKwh - FA.energyKwh) / 1000;
        const climateAvoided = energyDeltaMWh * COBENEFIT_PER_MWH.climateDollars;
        const healthAvoided  = energyDeltaMWh * COBENEFIT_PER_MWH.healthDollars;
        const energyCost     = (FB.energyCost - FA.energyCost);
        const total          = climateAvoided + healthAvoided + energyCost;

        const pWin = pressureDelta >= 0 ? "Filter A" : "Filter B";
        const mWin = pmDelta       >= 0 ? "Filter A" : "Filter B";
        const eWin = energyDeltaMWh >= 0 ? "Filter A" : "Filter B";
        const tActor = total >= 0 ? "Filter A annual upside" : "Filter B annual upside";

        const tiles = [
          { lane: "performance", k: "Performance", actor: `${pWin} saves`, v: Math.abs(pressureDelta).toFixed(0), unit: "Pa pressure drop", sub: `A ${FA.pressureEnd.toFixed(0)} · B ${FB.pressureEnd.toFixed(0)}` },
          { lane: "health",      k: "Health",      actor: `${mWin} cleaner by`, v: Math.abs(pmDelta).toFixed(2), unit: "µg/m³ PM₂.₅", sub: `A ${FA.pmMean.toFixed(2)} · B ${FB.pmMean.toFixed(2)}` },
          { lane: "energy",      k: "Energy",      actor: `${eWin} saves`, v: Math.abs(energyDeltaMWh).toFixed(0), unit: "MWh / year", sub: `A ${(FA.energyKwh / 1000).toFixed(0)} · B ${(FB.energyKwh / 1000).toFixed(0)}` },
          { lane: "society",     k: "Society · Climate", actor: `Choosing ${eWin} avoids`, v: compactUSD(Math.abs(climateAvoided)), unit: "/y", sub: "Harvard CoBE · $13.71/MWh" },
          { lane: "society",     k: "Society · Health",  actor: `Choosing ${eWin} avoids`, v: compactUSD(Math.abs(healthAvoided)),  unit: "/y", sub: "CoBE · PM-attributable" },
          { lane: "dollars",     k: "Dollars",     actor: tActor, v: compactUSD(Math.abs(total)), unit: "/y total", sub: "Energy + climate + health" },
        ];
        $deltas.innerHTML = tiles.map((t) =>
          `<div class="fs__delta fs__delta--lane fs__delta--${t.lane}">
            <span class="fs__delta-k">${t.k}</span>
            <span class="fs__delta-actor">${t.actor}</span>
            <span class="fs__delta-v">${t.v}<span class="u">${t.unit}</span></span>
            <span class="fs__delta-sub">${t.sub}</span>
          </div>`
        ).join("");
      } else {
        // Single-filter mode: show the active filter's deck values as
        // absolute readouts, with the comparison kept in the sub-row.
        $deltas.classList.add("fs__deltas--single");
        $deltas.classList.remove("fs__deltas--compare");
        const isA = state.filter === "A";
        const fAct = isA ? FA : FB;
        const fOth = isA ? FB : FA;
        const filterName = fAct.name;
        const otherName  = fOth.name;
        if ($mode) $mode.textContent = `Single filter · ${filterName}`;
        if ($sub)  $sub.innerHTML = `${caseData.short} · 1 Year Period · <em>click Compare for full Total Co-Benefits</em>`;

        const dir = (a, b, d) => (a < b ? "−" : "+") + Math.abs(a - b).toFixed(d);
        const tiles = [
          { k: "Pressure drop", v: fAct.pressureEnd.toFixed(0), unit: "Pa", sub: `vs ${otherName} ${fOth.pressureEnd.toFixed(0)} (${dir(fAct.pressureEnd, fOth.pressureEnd, 0)} Pa)` },
          { k: "Indoor PM₂.₅",  v: fAct.pmMean.toFixed(2), unit: "µg/m³", sub: `vs ${otherName} ${fOth.pmMean.toFixed(2)} (${dir(fAct.pmMean, fOth.pmMean, 2)} µg)` },
          { k: "Fan energy",    v: (fAct.energyKwh / 1000).toFixed(0), unit: "MWh / year", sub: `vs ${otherName} ${(fOth.energyKwh / 1000).toFixed(0)} (${dir(fAct.energyKwh / 1000, fOth.energyKwh / 1000, 0)} MWh)` },
        ];
        $deltas.innerHTML = tiles.map((t) =>
          `<div class="fs__delta fs__delta--solo">
            <span class="fs__delta-k">${t.k}</span>
            <span class="fs__delta-v">${t.v}<span class="u">${t.unit}</span></span>
            <span class="fs__delta-sub">${t.sub}</span>
          </div>`
        ).join("");
      }
    }

    // ---------- Intent block + case header ----------
    function updateIntent() {
      const c = CASES[state.case];
      const filterLbl = state.filter === "compare"
        ? "Compare"
        : c.filters[state.filter].name;
      const viewing = document.getElementById("fs-viewing");
      if (viewing) viewing.textContent = `${c.short} · ${filterLbl}`;
    }
    function renderCaseHeader() {
      const c = CASES[state.case];
      const nameEl = document.getElementById("fs-case-name");
      if (nameEl) nameEl.textContent = `Data Center ${state.case} · ${c.short}`;
      const site = document.getElementById("fs-site");
      if (!site) return;
      const s = c.site;
      site.innerHTML = `
        <div class="fs__site-head">
          <span class="fs__site-title">Site Characteristics</span>
          <span class="fs__site-addr">${s.address}</span>
        </div>
        <div class="fs__site-col">
          <div class="fs__site-row"><dt>Total Building Volume</dt><dd>${s.totalVolume_m3.toLocaleString()} m³</dd></div>
          <div class="fs__site-row"><dt>Total IT Capacity</dt><dd>${s.itCapacity_MW} MW</dd></div>
          <div class="fs__site-row"><dt>Daily Operating Schedule</dt><dd>${s.dailySchedule_h} h</dd></div>
        </div>
        <div class="fs__site-col">
          <div class="fs__site-row"><dt>System Type</dt><dd>${s.systemType}</dd></div>
          <div class="fs__site-row"><dt>Air Fraction</dt><dd>${s.airFraction}</dd></div>
          <div class="fs__site-row"><dt>Total System Capacity</dt><dd>${s.systemCapacity}</dd></div>
          <div class="fs__site-row"><dt>Number of Filters</dt><dd>${s.filterCount}</dd></div>
        </div>
      `;
    }

    // ---------- Chart redraw + readouts (slide 8 / 14 numbers) ----------
    function updateReadouts() {
      const c = CASES[state.case];
      const FA = c.filters["A"], FB = c.filters["B"];
      const setText = (id, val) => { const e = document.getElementById(id); if (e) e.innerHTML = val; };
      if (state.filter === "compare") {
        // Show A / B paired top-right (slide-8/14 values)
        setText("fs-pressure-readout", `A <b>${FA.pressureEnd.toFixed(0)}</b> · B <b>${FB.pressureEnd.toFixed(0)}</b> Pa`);
        setText("fs-pm-readout",       `A <b>${FA.pmMean.toFixed(2)}</b> · B <b>${FB.pmMean.toFixed(2)}</b> µg/m³`);
        setText("fs-energy-readout",   `A <b>${FA.energyKwh.toLocaleString()}</b> · B <b>${FB.energyKwh.toLocaleString()}</b> kWh/y`);
      } else {
        const f = c.filters[state.filter];
        setText("fs-pressure-readout", `<b>${f.pressureEnd.toFixed(0)}</b> Pa`);
        setText("fs-pm-readout",       `<b>${f.pmMean.toFixed(2)}</b> µg/m³`);
        setText("fs-energy-readout",   `<b>${f.energyKwh.toLocaleString()}</b> kWh/y`);
      }
    }

    function redraw() {
      const caseData = CASES[state.case];
      const filters = activeFilters();
      const COLORS = { "A": "#7CB342", "B": "#0A74D6" };

      // Pressure chart — slides 5 / 11
      const pressureSets = filters.map((fKey) => ({
        pts: pressureSeries(caseData.filters[fKey]),
        color: COLORS[fKey],
      }));
      const pMax = Math.max(...pressureSets.flatMap((s) => s.pts.map((p) => p.v))) * 1.08;
      lineChart(ps, {
        series: pressureSets,
        yMin: 0, yMax: pMax,
        yTicks: 4,
        fmtY: (v) => Math.round(v),
        xLabels: ["0g", "150g", "300g", "450g", "600g"],
      });

      // PM2.5 chart — slides 6 / 12 (dense noisy series, "1-year period")
      const pmSets = filters.map((fKey) => ({
        pts: pmSeries(caseData.filters[fKey], fKey === "A" ? 91 : 113),
        color: COLORS[fKey],
        width: 1.1, opacity: 0.78,
      }));
      const mMax = Math.max(...pmSets.flatMap((s) => s.pts.map((p) => p.v))) * 1.2;
      lineChart(pm, {
        series: pmSets,
        yMin: 0, yMax: mMax,
        yTicks: 4,
        fmtY: (v) => v.toFixed(2),
        xLabels: ["0h", "2K", "4K", "6K", "8K"],
        endpointLabel: false,
      });

      // Energy grouped bars — slides 7 / 13
      drawEnergyBars(en);

      // Top-right readouts (slide 8 / 14)
      updateReadouts();

      renderDeltas();
    }

    // ---------- Controls ----------
    $$('[data-fs-case]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-fs-case]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        state.case = btn.dataset.fsCase;
        renderCaseHeader();
        buildArchetype();
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
        // Update filter-membrane label
        const label = arch.querySelector("#fs-filter-label");
        if (label) {
          const filters = activeFilters();
          label.textContent = filters.length === 1
            ? CASES[state.case].filters[filters[0]].name.toUpperCase()
            : "FILTER";
        }
        updateIntent();
        redraw();
      });
    });

    // ---------- ResizeObserver ----------
    if (typeof ResizeObserver !== "undefined") {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = 0; redraw(); });
      });
      ro.observe(ps);
    }

    // ---------- Initial render ----------
    buildArchetype();
    renderCaseHeader();
    updateIntent();
    redraw();
    if (!REDUCED) requestAnimationFrame(archStep);
  })();

  /* ============================================================ MATRIX
     Compact, user-led product slice of the real MATRIX dashboard.
     Drives three connected surfaces from one state object:
       state = { mode, cop, export_scenario, buildingId }
     Surfaces:
       (1) Portfolio: US map + building list, ranked by best savings at
           the current filters.
       (2) Selected: building identity card with baseline cost + sim count.
       (3) Study: configuration matrix (battery × duration) with cell
           highlight + insight panel (strategy framing → savings →
           financial case).
     Source-of-truth data: window.MATRIX_DATA, curated from
     /tmp/matrix_brief_ingest/MATRIX/matrix/static/data/summary_*.json.
     ================================================================ */

  (function matrix() {
    const DATA = window.MATRIX_DATA;
    if (!DATA) { console.warn("[MATRIX] dataset missing"); return; }
    const sec = document.getElementById("matrix");
    if (!sec) return;

    // -------- State
    const state = {
      mode: "arbitrage",     // "arbitrage" | "peakshaving"
      cop: 3.5,
      exportScenario: "mid", // "mid" | "high"
      buildingId: null,      // set on first render
    };

    // CapEx curve from summary_arbitrage.json — used when a cell has no
    // .capex of its own (shouldn't happen with the curated data, but
    // belt-and-suspenders). Linear-interpolate $ per kWh.
    const CAPEX_CURVE = DATA.meta.capex_curve;
    const ITC_RATE = DATA.meta.itc_rate || 0.30;
    function capexFor(kwh) {
      const c = CAPEX_CURVE;
      if (kwh <= c[0][0]) return c[0][1];
      if (kwh >= c[c.length - 1][0]) return c[c.length - 1][1];
      for (let i = 0; i < c.length - 1; i++) {
        if (kwh >= c[i][0] && kwh <= c[i + 1][0]) {
          const t = (kwh - c[i][0]) / (c[i + 1][0] - c[i][0]);
          return c[i][1] + (c[i + 1][1] - c[i][1]) * t;
        }
      }
      return c[c.length - 1][1];
    }

    // -------- Formatters
    const fmtUSD = (v) => {
      if (v == null) return "—";
      const abs = Math.abs(v), sign = v < 0 ? "−" : "";
      if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(1) + "M";
      if (abs >= 1e3) return sign + "$" + Math.round(abs / 1e3) + "K";
      return sign + "$" + Math.round(abs);
    };
    const fmtUSDFull = (v) => {
      if (v == null) return "—";
      const sign = v < 0 ? "−" : "";
      return sign + "$" + Math.abs(Math.round(v)).toLocaleString();
    };
    const fmtKWH = (kwh) => kwh >= 1000 ? `${(kwh / 1000).toFixed(kwh % 1000 === 0 ? 0 : 1)} MWh` : `${Math.round(kwh)} kWh`;
    const fmtKW  = (kw)  => kw  >= 1000 ? `${(kw  / 1000).toFixed(kw  % 1000 === 0 ? 0 : 1)} MW`  : `${Math.round(kw)} kW`;
    const fmtPB  = (yr)  => (yr == null || yr >= 100) ? "— yr" : `${yr.toFixed(1)} yr`;

    // -------- Data access
    function scenariosFor(buildingId) {
      const bag = state.mode === "arbitrage" ? DATA.arbitrage : DATA.peakshaving;
      return bag[buildingId] || [];
    }
    // Filter a building's scenarios by COP (+ export if arb)
    function scenariosForCurrent(buildingId) {
      return scenariosFor(buildingId).filter((s) => {
        if (s.cop !== state.cop) return false;
        if (state.mode === "arbitrage" && s.export_scenario !== state.exportScenario) return false;
        return true;
      });
    }
    // Best scenario for the current filters — used by the portfolio ranking
    function bestFor(buildingId) {
      const matches = scenariosForCurrent(buildingId);
      if (!matches.length) return null;
      return matches.reduce((best, s) => s.savings_usd > best.savings_usd ? s : best);
    }

    // Battery × duration matrix for the currently selected building
    function buildMatrix(buildingId) {
      const matches = scenariosForCurrent(buildingId);
      const batterySet = new Set(), durationSet = new Set();
      const cells = {};
      matches.forEach((s) => {
        batterySet.add(s.battery_kwh);
        durationSet.add(s.duration_hrs);
        cells[`${s.battery_kwh}_${s.duration_hrs}`] = s;
      });
      const batteries = [...batterySet].sort((a, b) => a - b);
      const durations = [...durationSet].sort((a, b) => a - b);
      // Find best by adjusted payback (positive savings, lowest payback)
      let bestKey = null, bestPB = Infinity;
      Object.entries(cells).forEach(([k, s]) => {
        if (s.savings_usd > 0 && s.payback_after_itc < bestPB) {
          bestPB = s.payback_after_itc; bestKey = k;
        }
      });
      return { cells, batteries, durations, bestKey };
    }

    // -------- Renderers

    function renderStats() {
      const best = DATA.buildings
        .map((b) => bestFor(b.id))
        .filter(Boolean);
      const positive = best.filter((s) => s.savings_usd > 0).length;
      // Net total — includes negative-savings buildings so the headline
      // can go down under bad filters. Mirrors the source product's
      // map-page.js aggregation (`sum + s.savings_usd`). Clamping the
      // sign here would let the headline only ever go up, which would
      // misrepresent the filter state and undercut the section's
      // decision-grade framing.
      const total    = best.reduce((sum, s) => sum + s.savings_usd, 0);
      const paybacks = best.filter((s) => s.savings_usd > 0 && s.payback_after_itc < 100).map((s) => s.payback_after_itc);
      const avgPB    = paybacks.length ? paybacks.reduce((a, b) => a + b, 0) / paybacks.length : 0;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set("mx3-positive", `${positive} / ${DATA.buildings.length}`);
      set("mx3-total",    fmtUSD(total));
      set("mx3-payback",  avgPB > 0 ? `${avgPB.toFixed(1)} yr` : "—");
      set("mx3-bldg-count", DATA.buildings.length);
    }

    // ----- US map (CONUS bounding-box projection, no state outline —
    // keeps the marketing version lightweight; the real product uses
    // d3.geoAlbersUsa + topojson states, but here a clean dotted backdrop
    // reads as "national portfolio" without the load weight).
    const MAP_BOUNDS = { lngW: -125, lngE: -66.9, latS: 24.5, latN: 49.4 };
    function projectMap(lng, lat, W, H) {
      const x = (lng - MAP_BOUNDS.lngW) / (MAP_BOUNDS.lngE - MAP_BOUNDS.lngW) * (W - 24) + 12;
      // Mercator-ish: flatten by cos(lat0) for visual stability
      const y = (1 - (lat - MAP_BOUNDS.latS) / (MAP_BOUNDS.latN - MAP_BOUNDS.latS)) * (H - 24) + 12;
      return [x, y];
    }
    function renderMap() {
      const svg = document.getElementById("mx3-us-map");
      if (!svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const W = 480, H = 280;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const ns = "http://www.w3.org/2000/svg";

      // Backdrop graticule — light grid suggesting a continental scale
      const grid = document.createElementNS(ns, "g");
      grid.setAttribute("stroke", "rgba(178,204,238,0.06)");
      grid.setAttribute("stroke-width", "0.5");
      for (let i = 0; i <= 8; i++) {
        const x = (i / 8) * W;
        const l = document.createElementNS(ns, "line");
        l.setAttribute("x1", x); l.setAttribute("x2", x);
        l.setAttribute("y1", 0); l.setAttribute("y2", H);
        grid.appendChild(l);
      }
      for (let j = 0; j <= 5; j++) {
        const y = (j / 5) * H;
        const l = document.createElementNS(ns, "line");
        l.setAttribute("y1", y); l.setAttribute("y2", y);
        l.setAttribute("x1", 0); l.setAttribute("x2", W);
        grid.appendChild(l);
      }
      svg.appendChild(grid);

      // CONUS framing rect
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", 8); frame.setAttribute("y", 8);
      frame.setAttribute("width", W - 16); frame.setAttribute("height", H - 16);
      frame.setAttribute("fill", "none");
      frame.setAttribute("stroke", "rgba(178,204,238,0.18)");
      frame.setAttribute("stroke-width", "0.6");
      svg.appendChild(frame);

      // Greens (matched to real product palette)
      const colors = ["#4a5568", "#c5d96a", "#a4c639", "#7cb342", "#6ba033", "#3a6b2a"];
      const maxSav = Math.max(1, ...DATA.buildings.map((b) => {
        const s = bestFor(b.id); return s ? s.savings_usd : 0;
      }));
      const colorFor = (sav) => {
        if (sav <= 0) return colors[0];
        const t = Math.min(1, sav / maxSav);
        const idx = 1 + Math.floor(t * (colors.length - 2));
        return colors[Math.min(colors.length - 1, idx)];
      };
      const radiusFor = (sav) => 5 + Math.min(1, Math.max(0, sav) / maxSav) * 11;

      DATA.buildings.forEach((b) => {
        const best = bestFor(b.id);
        const sav = best ? best.savings_usd : 0;
        const [x, y] = projectMap(b.lng, b.lat, W, H);
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("class", "bldg" + (b.id === state.buildingId ? " is-selected" : ""));
        c.setAttribute("cx", x.toFixed(1));
        c.setAttribute("cy", y.toFixed(1));
        c.setAttribute("r", radiusFor(sav));
        c.setAttribute("fill", colorFor(sav));
        c.setAttribute("opacity", "0.92");
        c.setAttribute("stroke", "rgba(255,255,255,0.25)");
        c.setAttribute("stroke-width", "1");
        c.dataset.bid = b.id;
        c.addEventListener("click", () => selectBuilding(b.id));
        c.addEventListener("mouseenter", () => c.setAttribute("opacity", "1"));
        c.addEventListener("mouseleave", () => c.setAttribute("opacity", "0.92"));
        svg.appendChild(c);
      });
    }

    // ----- Building list (ranked, selectable)
    function renderList() {
      const list = document.getElementById("mx3-list");
      if (!list) return;
      const rows = DATA.buildings
        .map((b) => ({ b, s: bestFor(b.id) }))
        .filter((r) => r.s)
        .sort((a, b) => b.s.savings_usd - a.s.savings_usd);
      list.innerHTML = rows.map(({ b, s }) => {
        const cls = state.mode === "peakshaving" ? "PS" : "Arb";
        const klass = b.klass.replace("Commercial ", "");
        return `<button type="button" class="mx3__row${b.id === state.buildingId ? " is-selected" : ""}" data-bid="${b.id}" aria-label="Select ${b.name}" aria-pressed="${b.id === state.buildingId}">
          <span class="mx3__row-name">${b.name}</span>
          <span class="mx3__row-class">${klass}</span>
          <span class="mx3__row-state">${b.state}</span>
          <span class="mx3__row-sav${s.savings_usd < 0 ? " is-neg" : ""}">${fmtUSD(s.savings_usd)}</span>
          <span class="mx3__row-pb">${fmtPB(s.payback_after_itc)}</span>
        </button>`;
      }).join("");
      list.querySelectorAll(".mx3__row").forEach((row) => {
        row.addEventListener("click", () => selectBuilding(row.dataset.bid));
      });
    }

    // ----- Selected building bar (Part 2)
    function renderSelected() {
      const el = document.getElementById("mx3-selected");
      if (!el) return;
      const b = DATA.buildings.find((x) => x.id === state.buildingId);
      if (!b) { el.innerHTML = ""; return; }
      const best = bestFor(b.id);
      // Two counts: scenarios currently driving the matrix (filter-narrow)
      // and the building's total simulation runs across the whole mode.
      const activeCount = scenariosForCurrent(b.id).length;
      const modeCount   = scenariosFor(b.id).length;
      const baseline = best ? best.annual_cost_no_battery : 0;
      el.innerHTML = `
        <span class="mx3__sel-back" aria-hidden="true">← Portfolio</span>
        <div class="mx3__sel-id">
          <span class="mx3__sel-name">${b.name}</span>
          <span class="mx3__sel-meta">
            <span><b>${b.state}</b> · ${b.county}</span>
            <span>${b.klass}</span>
            <span>${b.sqft.toLocaleString()} SF · ${b.floors} floor${b.floors === 1 ? "" : "s"}</span>
            <span>Baseline <b>${fmtUSDFull(baseline)}</b> / yr</span>
          </span>
        </div>
        <div class="mx3__sel-sim">
          <span><b>${b.total_sims.toLocaleString()}</b> simulations</span>
          <span>${activeCount} active &middot; ${modeCount} ${state.mode === "arbitrage" ? "arbitrage" : "peak shaving"} scenarios</span>
        </div>
      `;
    }

    // ----- Configuration matrix (Part 3)
    let highlightedKey = null;
    function renderGrid() {
      const wrap = document.getElementById("mx3-grid");
      if (!wrap) return;
      const m = buildMatrix(state.buildingId);
      // Seed highlight: best cell if no manual selection
      if (!highlightedKey || !m.cells[highlightedKey]) {
        highlightedKey = m.bestKey || (m.batteries.length && m.durations.length
          ? `${m.batteries[0]}_${m.durations[0]}` : null);
      }
      // Build header + rows
      const colCount = m.batteries.length;
      const gridTemplate = `auto repeat(${colCount}, minmax(0, 1fr))`;
      const header = [`<div></div>`]
        .concat(m.batteries.map((b) => `<div class="mx3__grid-col-lbl">${fmtKWH(b)}</div>`))
        .join("");
      const rows = m.durations.map((d) => {
        const cells = m.batteries.map((batt) => {
          const key = `${batt}_${d}`;
          const cell = m.cells[key];
          if (!cell) {
            return `<div class="mx3__cell is-empty">—</div>`;
          }
          const isBest = key === m.bestKey;
          const isActive = key === highlightedKey;
          const isNeg = cell.savings_usd < 0;
          const baseline = cell.annual_cost_no_battery || 1;
          const pct = cell.savings_pct;
          return `<button type="button" class="mx3__cell${isActive ? " is-active" : ""}${isBest ? " is-best" : ""}"
              data-key="${key}" aria-pressed="${isActive}" aria-label="Battery ${fmtKWH(batt)} ${d}h duration ${fmtUSD(cell.savings_usd)} savings">
            <span class="mx3__cell-sav${isNeg ? " is-neg" : ""}">${fmtUSD(cell.savings_usd)}</span>
            <span class="mx3__cell-pct${isNeg ? " is-neg" : ""}">${pct.toFixed(1)}% of baseline</span>
            <span class="mx3__cell-pb">${fmtPB(cell.payback_after_itc)} payback</span>
          </button>`;
        }).join("");
        return `<div class="mx3__grid-row" style="grid-template-columns:${gridTemplate}">
          <div class="mx3__grid-row-lbl"><span>Duration</span><b>${d}h</b></div>
          ${cells}
        </div>`;
      }).join("");
      wrap.innerHTML = `
        <div class="mx3__grid-row" style="grid-template-columns:${gridTemplate}">${header}</div>
        ${rows}
      `;
      wrap.querySelectorAll(".mx3__cell[data-key]").forEach((cell) => {
        cell.addEventListener("click", () => {
          highlightedKey = cell.dataset.key;
          renderGrid();
          renderPanel();
        });
      });
    }

    // ----- Insight panel
    function renderPanel() {
      const panel = document.getElementById("mx3-panel");
      if (!panel) return;
      const m = buildMatrix(state.buildingId);
      const cell = m.cells[highlightedKey];
      if (!cell) {
        panel.innerHTML = `<div class="mx3__p-foot">No matching configurations under current filters. Try a different COP or strategy.</div>`;
        return;
      }
      const grossCapex = cell.capex || (cell.battery_kwh * capexFor(cell.battery_kwh));
      const itcCredit = grossCapex * ITC_RATE;
      const netCapex = grossCapex - itcCredit;
      const isNeg = cell.savings_usd < 0;
      const baseline = cell.annual_cost_no_battery;
      const withBat = cell.annual_cost_battery;
      const isArb = state.mode === "arbitrage";
      const strategyTitle = isArb ? "Arbitrage Spread Captured" : "Peak Demand Reduction";
      const configSub = isArb
        ? `${cell.duration_hrs}h duration · COP ${cell.cop} · Export ${state.exportScenario === "high" ? "80% of retail" : "60% of retail"}`
        : `${fmtKW(cell.target_kw || 0)} demand target · ${cell.duration_hrs}h · COP ${cell.cop}`;
      const savingsContext = isNeg
        ? "net cost increase under these assumptions"
        : (isArb ? "annual arbitrage revenue captured" : "annual demand-charge savings");
      panel.innerHTML = `
        <div class="mx3__p-config">
          <div class="mx3__p-config-title">${fmtKWH(cell.battery_kwh)} / ${fmtKW(cell.power_kw)} PCS</div>
          <div class="mx3__p-config-sub">${configSub}</div>
        </div>

        <div class="mx3__p-section">
          <span class="mx3__p-section-k">${strategyTitle}</span>
          <div class="mx3__p-hero">
            <span class="mx3__p-hero-v${isNeg ? " is-neg" : ""}">${fmtUSD(cell.savings_usd)}</span>
            <span class="mx3__p-hero-sub">${cell.savings_pct.toFixed(1)}% of baseline · ${savingsContext}</span>
          </div>
          <div class="mx3__p-rows">
            <div class="mx3__p-row"><span class="mx3__p-row-k">Without battery</span><span class="mx3__p-row-v">${fmtUSDFull(baseline)}/yr</span></div>
            <div class="mx3__p-row"><span class="mx3__p-row-k">With battery</span><span class="mx3__p-row-v${withBat < 0 ? " is-neg" : ""}">${fmtUSDFull(withBat)}/yr</span></div>
          </div>
        </div>

        <div class="mx3__p-section">
          <span class="mx3__p-section-k">Financial Case</span>
          <div class="mx3__p-pb-hero">
            <span class="mx3__p-pb-v">${cell.payback_after_itc < 100 ? cell.payback_after_itc.toFixed(1) : "—"}</span>
            <span class="mx3__p-pb-unit">year payback &middot; with ITC</span>
          </div>
          <div class="mx3__p-rows">
            <div class="mx3__p-row"><span class="mx3__p-row-k">CapEx</span><span class="mx3__p-row-v">${fmtUSDFull(grossCapex)}</span></div>
            <div class="mx3__p-row"><span class="mx3__p-row-k">ITC credit (${Math.round(ITC_RATE * 100)}%)</span><span class="mx3__p-row-v is-accent">−${fmtUSDFull(itcCredit)}</span></div>
            <div class="mx3__p-row"><span class="mx3__p-row-k">Net cost</span><span class="mx3__p-row-v">${fmtUSDFull(netCapex)}</span></div>
          </div>
        </div>

        <div class="mx3__p-foot">LFP chemistry · CapEx curve from ${DATA.meta.source} · ${DATA.meta.mode_arbitrage_scenarios.toLocaleString()} arbitrage + ${DATA.meta.mode_peakshaving_scenarios.toLocaleString()} peak-shaving scenarios in the source dataset</div>
      `;
    }

    // -------- Selection
    function selectBuilding(bid) {
      if (state.buildingId === bid) return;
      state.buildingId = bid;
      highlightedKey = null;
      renderMap();
      renderList();
      renderSelected();
      renderGrid();
      renderPanel();
    }

    // -------- Mode / filter changes
    function applyMode(mode) {
      state.mode = mode;
      // Toggle export-price chip group visibility
      const exportGroup = document.getElementById("mx3-export-group");
      if (exportGroup) exportGroup.style.display = mode === "arbitrage" ? "" : "none";
      highlightedKey = null;
      renderAll();
    }
    function applyCop(cop) {
      state.cop = parseFloat(cop);
      highlightedKey = null;
      renderAll();
    }
    function applyExport(exp) {
      state.exportScenario = exp;
      highlightedKey = null;
      renderAll();
    }
    function renderAll() {
      // If current building has no scenarios under new filters, fall back
      // to the first building that does.
      if (!scenariosForCurrent(state.buildingId).length) {
        const fallback = DATA.buildings.find((b) => scenariosForCurrent(b.id).length);
        if (fallback) state.buildingId = fallback.id;
      }
      renderStats();
      renderMap();
      renderList();
      renderSelected();
      renderGrid();
      renderPanel();
    }

    // -------- Wire controls
    $$('[data-mx-mode]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-mx-mode]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        applyMode(btn.dataset.mxMode);
      });
    });
    $$('[data-mx-cop]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-mx-cop]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        applyCop(btn.dataset.mxCop);
      });
    });
    $$('[data-mx-export]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-mx-export]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        applyExport(btn.dataset.mxExport);
      });
    });

    // -------- Initial paint
    // Seed selected building = highest savings under default filters.
    const seedBest = DATA.buildings
      .map((b) => ({ b, s: bestFor(b.id) }))
      .filter((r) => r.s)
      .sort((a, b) => b.s.savings_usd - a.s.savings_usd)[0];
    if (seedBest) state.buildingId = seedBest.b.id;
    renderAll();
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
    // Initial state mirrors the deck's H.E.A.A.L. console (slide 18):
    // TRH parameter active, Floor 2. The tab chip restores the deck's
    // "TRH" shorthand for recognition; the data model is temperature-
    // only, and a disclosure strip under the console (.hl2__disclosure)
    // makes that explicit. The 30d / 7d range chips were removed in the
    // trust-repair pass — they couldn't actually swap the window.
    const state = { floor: "2", param: "trh" };

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
      // Reference window only — 30d / 7d range tabs were removed in the
      // trust-repair pass because they couldn't actually swap the data
      // window. Title stays anchored to the parameter; the disclosure
      // strip under the console names this as a reference console.
      if (timeTitle) timeTitle.innerHTML = `H.E.A.A.L. ${param.label} · Timeseries`;
    }

    // -------- Space-time heatmap
    function drawHeat() {
      clear(heat);
      const param = PARAMS[state.param];
      const series = readingsForFloor(state.floor, state.param);
      const N = series.length;
      const HOURS = 24;
      const heatTitle = document.getElementById("hl-heat-title");
      if (heatTitle) heatTitle.innerHTML = `H.E.A.A.L. ${param.label} · SpaceTime Map`;
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

    // -------- Bin breakdown + live values (slide-18 left-column blocks)
    // Computes the % distribution across the 5 brand bins for the active
    // floor + parameter, and a 5-reading live values mini-grid.
    function renderBins() {
      const wrap = document.getElementById("hl-bins");
      if (!wrap) return;
      const param = PARAMS[state.param];
      const readings = readingsForFloor(state.floor, state.param);
      const bins = [0, 0, 0, 0, 0];
      let total = 0;
      readings.forEach((s) => {
        s.forEach((v) => {
          const b = Math.min(4, binFor(v, param.thresholds));
          bins[b]++;
          total++;
        });
      });
      wrap.innerHTML = BIN_NAMES.map((name, i) => {
        const pct = total > 0 ? (bins[i] / total) * 100 : 0;
        return `<div class="hl2__bin">
          <span class="hl2__bin-dot" style="background:${BIN_COLORS[i]}"></span>
          <span class="hl2__bin-k">${name}</span>
          <span class="hl2__bin-v">${pct.toFixed(1)}%</span>
        </div>`;
      }).join("");

      // Update building label
      const bldgLabel = document.getElementById("hl-bldg-label");
      if (bldgLabel) {
        const f = FLOORS[state.floor];
        bldgLabel.textContent = `BLDG-04A · ${f.name}`;
      }
    }

    function renderLiveVals() {
      const wrap = document.getElementById("hl-live-vals");
      if (!wrap) return;
      // For each parameter, compute the spatial-average final-reading
      // for the current floor. Temperature shows °C only; RH is shown
      // as a static reference value (slide 18 shows 33%).
      const floorReadings = (paramKey) => {
        const series = readingsForFloor(state.floor, paramKey);
        let sum = 0;
        series.forEach((s) => { sum += s[s.length - 1]; });
        return sum / series.length;
      };
      const co2 = floorReadings("co2");
      const pm25 = floorReadings("pm25");
      const tvoc = floorReadings("tvoc");
      const temp = floorReadings("trh");
      const rh = 33; // reference value, deck slide 18

      const vals = [
        { k: "CO₂",   v: Math.round(co2).toLocaleString(), u: "ppm" },
        { k: "PM₂.₅", v: pm25.toFixed(1), u: "µg/m³" },
        { k: "TVOC",  v: Math.round(tvoc).toLocaleString(), u: "ppb" },
        { k: "Temp",  v: temp.toFixed(1), u: "°C" },
        { k: "RH",    v: String(rh), u: "%" },
      ];
      wrap.innerHTML = vals.map((v) =>
        `<div class="hl2__live-val">
          <span class="hl2__live-val-k">${v.k}</span>
          <span class="hl2__live-val-v">${v.v}</span>
          <span class="hl2__live-val-u">${v.u}</span>
        </div>`
      ).join("");
    }

    function redraw() {
      drawPlot();
      drawTime();
      drawHeat();
      renderBins();
      renderLiveVals();
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
    // Sensor view toggle (aggregate / by-sensor) — non-functional in
    // this build (the time-series chart already shows the spatial
    // average + min/max envelope, which is the deck's aggregate view).
    // The chip is a presentation-recognition affordance only.
    $$('[data-hl-sensor]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-hl-sensor]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
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
