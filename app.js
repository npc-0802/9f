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
    const raw = el.dataset.countup;
    const target = parseFloat(raw);
    const suffix = el.dataset.suffix || "";
    const isNum = el.dataset.format === "num";
    // Preserve the decimal precision the author wrote (e.g. "2.83" stays
    // 2 decimals, "36.7" stays 1, "412" stays 0).
    const dotIdx = raw.indexOf(".");
    const decimals = dotIdx === -1 ? 0 : (raw.length - dotIdx - 1);
    const dur = 1500;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function fmtVal(v) {
      if (isNum) return fmt.int(v);
      if (decimals === 0) return Math.round(v).toString();
      return v.toFixed(decimals);
    }
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = target * ease(t);
      el.textContent = fmtVal(v) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    if (REDUCED) {
      el.textContent = fmtVal(target) + suffix;
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

      // Seed legend counts + "showing N of N" caption on first paint.
      // The right column starts empty (no committed site); a hover or
      // click paints the tracker lines.
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
          (filterState.status !== "all" && d.status !== filterState.status);
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
    // Histogram drawing — the stacked variant uses a taller viewBox so
    // bars + a tracker line have room to breathe. The hist__track-line
    // and hist__track-dot persist across redraws (they're appended last
    // and toggled via the .is-on class from the dot-hover handler).
    const HIST_GEOM = {
      W: 320, H: 80,
      padL: 6, padR: 6, padT: 10, padB: 14,
    };
    function histDomain(accessor) {
      const allVals = data.sites.map(accessor).filter((v) => Number.isFinite(v));
      return [Math.min(...allVals), Math.max(...allVals)];
    }
    function drawHist(svgId, subset, accessor, isLog) {
      const svgNode = document.getElementById(svgId);
      if (!svgNode) return;
      while (svgNode.firstChild) svgNode.removeChild(svgNode.firstChild);
      const N = 32;
      const bActive = bins(subset, accessor, N, isLog);
      const bAll = bins(data.sites, accessor, N, isLog);
      const max = Math.max(1, ...bAll);
      const { W, H, padL, padR, padT, padB } = HIST_GEOM;
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
      // Tracker primitives — line + dot, appended once and reused on hover.
      svgNode.appendChild(elN("line", {
        class: "hist__track-line",
        x1: padL, x2: padL, y1: padT, y2: H - padB,
      }));
      svgNode.appendChild(elN("circle", {
        class: "hist__track-dot",
        cx: padL, cy: H - padB, r: 3.4,
      }));
    }
    function renderHistograms(subset) {
      const set = subset && subset.length ? subset : data.sites;
      drawHist("hist-floor",   set, (d) => d.floor_m2, true);
      drawHist("hist-it",      set, (d) => d.it_mw,    true);
      drawHist("hist-pue",     set, (d) => d.pue,      false);
      drawHist("hist-filters", set, (d) => d.filters,  true);
    }

    // Tracker — given a site, paint a vertical line + dot on each
    // histogram at the site's value for that metric. Clearing the
    // tracker just toggles all four off.
    const HIST_TRACKERS = [
      { id: "hist-floor",   valEl: "hist-floor-val",   accessor: (d) => d.floor_m2, isLog: true,  fmt: (v) => `${Math.round(v).toLocaleString()} m²` },
      { id: "hist-it",      valEl: "hist-it-val",      accessor: (d) => d.it_mw,    isLog: true,  fmt: (v) => `${v.toFixed(2)} MW` },
      { id: "hist-pue",     valEl: "hist-pue-val",     accessor: (d) => d.pue,      isLog: false, fmt: (v) => v.toFixed(2) },
      { id: "hist-filters", valEl: "hist-filters-val", accessor: (d) => d.filters,  isLog: true,  fmt: (v) => Math.round(v).toLocaleString() },
    ];
    function setTrackers(site) {
      HIST_TRACKERS.forEach((cfg) => {
        const svgNode = document.getElementById(cfg.id);
        if (!svgNode) return;
        const line = svgNode.querySelector(".hist__track-line");
        const dot  = svgNode.querySelector(".hist__track-dot");
        const val  = document.getElementById(cfg.valEl);
        if (!site) {
          if (line) line.classList.remove("is-on");
          if (dot)  dot.classList.remove("is-on");
          if (val)  val.textContent = "—";
          return;
        }
        const v = cfg.accessor(site);
        if (!Number.isFinite(v)) {
          if (line) line.classList.remove("is-on");
          if (dot)  dot.classList.remove("is-on");
          if (val)  val.textContent = "—";
          return;
        }
        const [lo, hi] = histDomain(cfg.accessor);
        let t;
        if (cfg.isLog) {
          const loL = Math.log(Math.max(0.001, lo));
          const hiL = Math.log(Math.max(0.001, hi));
          t = (Math.log(Math.max(0.001, v)) - loL) / (hiL - loL);
        } else {
          t = (v - lo) / (hi - lo);
        }
        t = Math.min(0.999, Math.max(0, t));
        const { W, padL, padR, padT, H, padB } = HIST_GEOM;
        const x = padL + t * (W - padL - padR);
        if (line) {
          line.setAttribute("x1", x.toFixed(1));
          line.setAttribute("x2", x.toFixed(1));
          line.classList.add("is-on");
        }
        if (dot) {
          dot.setAttribute("cx", x.toFixed(1));
          // place dot near the top of the bar at that x position
          // (use a fixed mid-height for simplicity)
          dot.setAttribute("cy", (padT + (H - padT - padB) * 0.45).toFixed(1));
          dot.classList.add("is-on");
        }
        if (val) val.textContent = cfg.fmt(v);
      });
      const activeLbl = document.getElementById("hist-active");
      if (activeLbl) {
        if (site) {
          activeLbl.textContent = `${site.id} · ${site.county} · ${site.status === "existing" ? "Existing" : "Planned"}`;
        } else {
          activeLbl.textContent = "— · click any site to commit";
        }
      }
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

    // Hover preview drives the tracker lines on the right-column
    // distribution graphs; commit persists the selection until another
    // dot is clicked. The site-detail kv panel is gone — the graphs
    // ARE the readout now.
    let committedSite = null;
    function previewSite(d, node) {
      if (!pointSel) return;
      pointSel.classed("is-active", false);
      if (node) d3.select(node).classed("is-active", true);
      setTrackers(d);
    }
    function commitSite(d, node) {
      if (!pointSel) return;
      const target = node || pointSel.filter((p) => p.id === d.id).node();
      pointSel.classed("is-committed", false);
      pointSel.classed("is-active", false);
      if (target) {
        d3.select(target).classed("is-active", true).classed("is-committed", true);
      }
      committedSite = d;
      setTrackers(d);
      const statusLabel = d.status === "existing" ? "Existing" : "Planned";
      const summary = `<b>${d.id}</b> · ${d.county} · ${statusLabel} · ${d.system} · ${fmt.flt(d.it_mw, 1)} MW`;
      const intentMap = document.getElementById("intent-map");
      if (intentMap) intentMap.innerHTML = summary;
    }
    function deactivate() {
      // On hover-out, fall back to the committed site (if any). Tracker
      // sticks to the committed record so the user keeps the position
      // markers on screen between hovers.
      if (!pointSel) return;
      pointSel.classed("is-active", function () { return d3.select(this).classed("is-committed"); });
      setTrackers(committedSite);
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
    // Feedback 3 reversal: Filter A = anonymized Camfil (higher pressure /
    // lower PM / higher energy / higher TBO cost), Filter B = anonymized
    // H&V (lower pressure / higher PM / lower energy / lower TBO cost).
    // Pressure dots and PM averages match Feedback 3 §02.4/02.7 exactly.
    // Energy splits (recirc + vent) match §02.8 verbatim. Cost values to
    // the cent match §02.10. Vendor names never appear in UI.
    const CASES = {
      A: {
        label: "Data Center A",
        short: "Data Center A",
        site: {
          descriptor: "Modeled Virginia data center · DLC archetype",
          totalVolume_m3: 743224,
          itCapacity_MW: 280,
          dailySchedule_h: 24,
          systemType: "Direct liquid cooling (DLC)",
          airFraction: "20% air cooling · 80% liquid cooling",
          systemCapacity: "113 m³/s ventilation · 487 m³/s recirculation",
          filterCount: "122 ventilation · 523 recirculation",
        },
        filters: {
          "A": { name: "Filter A", pressureEnd: 217.83, pmMean: 0.17, pm10Mean: 0.08, energyRecirc:  977841, energyVent:  318411, energyKwh: 1296252, energyCost: 230785.95, dustHeld: 187.26 },
          "B": { name: "Filter B", pressureEnd: 135.32, pmMean: 0.25, pm10Mean: 0.07, energyRecirc:  640345, energyVent:  204096, energyKwh:  844441, energyCost: 150310.68, dustHeld: 188.99 },
        },
      },
      B: {
        label: "Data Center B",
        short: "Data Center B",
        site: {
          descriptor: "Modeled Virginia data center · DEC archetype",
          totalVolume_m3: 408773,
          itCapacity_MW: 222,
          dailySchedule_h: 24,
          systemType: "Direct evaporative cooling (DEC)",
          airFraction: "50% air cooling · 50% liquid cooling",
          systemCapacity: "600 m³/s ventilation · 600 m³/s recirculation",
          filterCount: "645 ventilation · 645 recirculation",
        },
        filters: {
          "A": { name: "Filter A", pressureEnd: 219.86, pmMean: 0.60, pm10Mean: 0.25, energyRecirc: 1215364, energyVent: 1725270, energyKwh: 2940634, energyCost: 519499.50, dustHeld: 189.96 },
          "B": { name: "Filter B", pressureEnd: 138.51, pmMean: 0.62, pm10Mean: 0.29, energyRecirc:  796344, energyVent: 1094498, energyKwh: 1890842, energyCost: 336569.71, dustHeld: 197.53 },
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
    // Default to single-filter mode (Filter A) per Feedback 3 §02.6/02.7
    // singular readout grammar — "[N] Pa at one year", "YY μg/m³ annual
    // average". Compare remains an opt-in via the chip control.
    const state = { case: "A", filter: "A" };

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

    // Filter color convention per Feedback 3 §02.6: A=blue, B=green.
    // Used by every chart, readout, archetype membrane, cost readout.
    const FILTER_COLORS = { "A": "#0A74D6", "B": "#7CB342" };

    // ---------- Series builders (full-year shapes — no month scrubber) ----------
    // Pressure builds dust mass on the filter over a 1-year operating
    // period. Endpoint dot lands at (filter.dustHeld grams, filter.pressureEnd Pa);
    // we sample from (0, startPa) to that endpoint along an accelerating curve.
    function pressureSeries(filter, opts = {}) {
      const startPa = 65;
      const xEnd = filter.dustHeld;
      const yEnd = filter.pressureEnd;
      const N = 60;
      const out = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        out.push({ x: t * xEnd, y: startPa + (yEnd - startPa) * Math.pow(t, 1.5) });
      }
      return out;
    }
    function pmSeries(filter, seed) {
      const r = rng(seed);
      const N = 240;
      const out = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const seasonal = Math.sin(t * Math.PI * 2 - Math.PI / 3) * 0.025;
        const noise = (r() - 0.5) * 0.045;
        // x = PM level (μg/m³), y = hours into the year (0..8760)
        const pm = Math.max(0, filter.pmMean + seasonal + noise);
        out.push({ x: pm, y: t * 8760 });
      }
      return out;
    }

    // ---------- Chart drawing ----------
    const PAD = { l: 42, r: 14, t: 14, b: 30 };
    // Generalized x/y scales over real (xMin..xMax) × (yMin..yMax) domains.
    // The PM chart inverts data orientation per Feedback 3 §02.7:
    // x = PM2.5 level (μg/m³), y = Time (hrs). The series builder above
    // already labels coords {x, y} so the same plotter works for both
    // pressure (x=g, y=Pa) and PM (x=μg/m³, y=hrs).
    function lineChart(svg, opts) {
      clear(svg);
      const rect = svg.getBoundingClientRect();
      const W = Math.max(360, Math.round(rect.width));
      const H = 150;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      const xMin = opts.xMin, xMax = opts.xMax;
      const yMin = opts.yMin, yMax = opts.yMax;
      const xS = (x) => PAD.l + ((x - xMin) / (xMax - xMin)) * iw;
      const yS = (y) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * ih;

      // Y-axis gridlines + tick labels
      const yTicks = opts.yTicks || 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = yMin + (yMax - yMin) * (i / yTicks);
        const y = yS(v);
        svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6 }));
        const t = el("text", { x: PAD.l - 6, y: y + 3, "text-anchor": "end", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        t.textContent = opts.fmtY ? opts.fmtY(v) : Math.round(v);
        svg.appendChild(t);
      }
      // X-axis ticks + labels
      const xTicks = opts.xTicks || 4;
      for (let i = 0; i <= xTicks; i++) {
        const v = xMin + (xMax - xMin) * (i / xTicks);
        const x = xS(v);
        svg.appendChild(el("line", { x1: x, x2: x, y1: H - PAD.b, y2: H - PAD.b + 3, stroke: "rgba(178,204,238,0.18)" }));
        const tx = el("text", { x, y: H - PAD.b + 14, "text-anchor": "middle", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        tx.textContent = opts.fmtX ? opts.fmtX(v) : Math.round(v);
        svg.appendChild(tx);
      }
      // Axis-title labels (slide-faithful: tucked under the tick row on x,
      // rotated on y near the top of the y-axis).
      if (opts.xLabel) {
        const t = el("text", { x: PAD.l + iw / 2, y: H - 2, "text-anchor": "middle", fill: "#95a3b8", "font-size": 9.5, "font-family": "JetBrains Mono", "letter-spacing": "0.06em" });
        t.textContent = opts.xLabel;
        svg.appendChild(t);
      }
      if (opts.yLabel) {
        const yLblY = PAD.t - 3;
        const t = el("text", { x: PAD.l, y: yLblY, "text-anchor": "start", fill: "#95a3b8", "font-size": 9.5, "font-family": "JetBrains Mono", "letter-spacing": "0.06em" });
        t.textContent = opts.yLabel;
        svg.appendChild(t);
      }
      // Plot each series
      opts.series.forEach((s) => {
        const path = s.pts.map((p, i) => (i ? "L" : "M") + xS(p.x).toFixed(1) + "," + yS(p.y).toFixed(1)).join(" ");
        svg.appendChild(el("path", {
          d: path, fill: "none",
          stroke: s.color, "stroke-width": s.width || 1.8,
          "stroke-linecap": "round", "stroke-linejoin": "round",
          opacity: s.opacity || 0.95,
        }));
        if (s.dot) {
          const dx = xS(s.dot.x), dy = yS(s.dot.y);
          svg.appendChild(el("circle", { cx: dx, cy: dy, r: 4, fill: s.color, stroke: "#0a1422", "stroke-width": 1.3 }));
          if (s.dotLabel) {
            const tx = el("text", { x: dx + 7, y: dy - 4, fill: s.color, "font-size": 9, "font-family": "JetBrains Mono", "font-weight": 600 });
            tx.textContent = s.dotLabel;
            svg.appendChild(tx);
          }
        }
      });
    }

    // Grouped bar chart for Energy — Feedback 3 §02.8:
    // x = Filter (A and B groups), y = Annual fan energy (kWh/y).
    // Each filter group shows two bars: Recirculation + Ventilation. Recirc
    // is the saturated filter color, Vent is the same hue dimmed.
    function drawEnergyBars(svg) {
      clear(svg);
      const rect = svg.getBoundingClientRect();
      const W = Math.max(360, Math.round(rect.width));
      const H = 150;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "none");
      const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      const filters = activeFilters();
      const caseData = CASES[state.case];

      // Y-axis max across all visible bars
      const allVals = [];
      filters.forEach((fKey) => {
        const f = caseData.filters[fKey];
        allVals.push(f.energyRecirc, f.energyVent);
      });
      const yMax = Math.max(...allVals) * 1.22;
      const yS = (v) => PAD.t + (1 - v / yMax) * ih;
      const xAxisY = H - PAD.b;

      // y gridlines + labels (5 ticks)
      const yTicks = 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = (yMax * i) / yTicks;
        const y = yS(v);
        svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "rgba(178,204,238,0.06)", "stroke-width": 0.6 }));
        const tx = el("text", { x: PAD.l - 6, y: y + 3, "text-anchor": "end", fill: "#5f6c80", "font-size": 8.5, "font-family": "JetBrains Mono" });
        tx.textContent = v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : Math.round(v).toString();
        svg.appendChild(tx);
      }
      // y-axis label
      const yLbl = el("text", { x: PAD.l, y: PAD.t - 3, "text-anchor": "start", fill: "#95a3b8", "font-size": 9.5, "font-family": "JetBrains Mono", "letter-spacing": "0.06em" });
      yLbl.textContent = "Annual fan energy (kWh/y)";
      svg.appendChild(yLbl);

      // Groups: one per active filter
      const groupW = iw / filters.length;
      filters.forEach((fKey, gi) => {
        const f = caseData.filters[fKey];
        const groupCx = PAD.l + (gi + 0.5) * groupW;
        const fill = FILTER_COLORS[fKey];
        const lanes = [
          { k: "Recirc", v: f.energyRecirc, fill: fill, opacity: 0.95 },
          { k: "Vent",   v: f.energyVent,   fill: fill, opacity: 0.55 },
        ];
        const barW = Math.min(44, (groupW * 0.34) / lanes.length);
        const gap = Math.max(3, barW * 0.18);
        lanes.forEach((lane, bi) => {
          const offset = (bi - (lanes.length - 1) / 2) * (barW + gap) - barW / 2;
          const x = groupCx + offset;
          const y = yS(lane.v);
          svg.appendChild(el("rect", {
            x: x.toFixed(1), y: y.toFixed(1),
            width: barW.toFixed(1),
            height: Math.max(0, xAxisY - y).toFixed(1),
            fill: lane.fill, opacity: lane.opacity,
          }));
          // Value label above bar
          const lbl = el("text", {
            x: (x + barW / 2).toFixed(1),
            y: (y - 4).toFixed(1),
            "text-anchor": "middle",
            fill: lane.fill,
            "font-size": 9,
            "font-family": "JetBrains Mono",
            "font-weight": 600,
          });
          lbl.textContent = lane.v.toLocaleString();
          svg.appendChild(lbl);
          // Lane tick label below bar (Recirc / Vent)
          const sub = el("text", {
            x: (x + barW / 2).toFixed(1),
            y: (xAxisY + 11).toFixed(1),
            "text-anchor": "middle",
            fill: "#5f6c80",
            "font-size": 8,
            "font-family": "JetBrains Mono",
            "letter-spacing": "0.08em",
          });
          sub.textContent = lane.k;
          svg.appendChild(sub);
        });
        // Group label = "Filter A" / "Filter B"
        const gl = el("text", {
          x: groupCx, y: xAxisY + 24,
          "text-anchor": "middle",
          fill: fill,
          "font-size": 10,
          "font-family": "JetBrains Mono",
          "font-weight": 600,
          "letter-spacing": "0.08em",
        });
        gl.textContent = f.name;
        svg.appendChild(gl);
      });
      // x-axis title — "Filter"
      const xLbl = el("text", { x: PAD.l + iw / 2, y: H - 1, "text-anchor": "middle", fill: "#95a3b8", "font-size": 9.5, "font-family": "JetBrains Mono", "letter-spacing": "0.06em" });
      xLbl.textContent = "Filter";
      svg.appendChild(xLbl);
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

          <text x="14" y="260" fill="rgba(149,163,184,0.55)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.14em">DATA CENTER A · DLC ARCHETYPE</text>
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

          <text x="14" y="260" fill="rgba(149,163,184,0.55)" font-family="JetBrains Mono" font-size="8" letter-spacing="0.14em">DATA CENTER B · DEC ARCHETYPE</text>
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

    // ---------- Cost readout (top of section, replaces bottom TBO) ----------
    // Renders the case-study Total Co-Benefits of Ownership cost values
    // exactly per Feedback 3 §02.10. Filter A in blue, Filter B in green.
    function renderCostReadout() {
      const c = CASES[state.case];
      const caseEl = document.getElementById("fs-cost-case");
      const aEl = document.getElementById("fs-cost-a");
      const bEl = document.getElementById("fs-cost-b");
      if (caseEl) caseEl.textContent = c.label;
      const fmt = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (aEl) aEl.textContent = fmt(c.filters.A.energyCost);
      if (bEl) bEl.textContent = fmt(c.filters.B.energyCost);
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
      if (nameEl) nameEl.textContent = c.label;
      const site = document.getElementById("fs-site");
      if (!site) return;
      const s = c.site;
      site.innerHTML = `
        <div class="fs__site-head">
          <span class="fs__site-title">Site Characteristics</span>
          <span class="fs__site-addr">${s.descriptor}</span>
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

    // ---------- Chart readouts ----------
    // Top-left lead readouts use the exact singular grammar Feedback 3
    // §02.6/02.7 specified ("[N] Pa at one year", "YY μg/m³ annual
    // average"). Even in compare mode the phrase stays singular; the
    // two values fuse as "A=NN / B=MM" so the sentence still reads as
    // a single metric statement. Top-right boxed stats keep A blue /
    // B green per §02.9.
    function updateReadouts() {
      const c = CASES[state.case];
      const FA = c.filters["A"], FB = c.filters["B"];
      const setHTML = (id, val) => { const e = document.getElementById(id); if (e) e.innerHTML = val; };

      const aSpan = (txt) => `<span class="fs__readout-a">${txt}</span>`;
      const bSpan = (txt) => `<span class="fs__readout-b">${txt}</span>`;

      if (state.filter === "compare") {
        // Compare leads — keep singular phrasing; values fuse as A=/B=
        const pPair = `${aSpan("A=" + FA.pressureEnd.toFixed(0))} / ${bSpan("B=" + FB.pressureEnd.toFixed(0))}`;
        const mPair = `${aSpan("A=" + FA.pmMean.toFixed(2))} / ${bSpan("B=" + FB.pmMean.toFixed(2))}`;
        const ePair = `${aSpan("A=" + FA.energyKwh.toLocaleString())} / ${bSpan("B=" + FB.energyKwh.toLocaleString())}`;
        setHTML("fs-pressure-lead", `${pPair} Pa at one year`);
        setHTML("fs-pm-lead",       `${mPair} µg/m³ annual average`);
        setHTML("fs-energy-lead",   `${ePair} kWh/y total`);
        setHTML("fs-pressure-readout", `<span class="fs__readout-row">${aSpan("A <b>" + FA.pressureEnd.toFixed(0) + "</b>")} · ${bSpan("B <b>" + FB.pressureEnd.toFixed(0) + "</b>")} Pa</span>`);
        setHTML("fs-pm-readout",       `<span class="fs__readout-row">${aSpan("A <b>" + FA.pmMean.toFixed(2) + "</b>")} · ${bSpan("B <b>" + FB.pmMean.toFixed(2) + "</b>")} µg/m³</span>`);
        setHTML("fs-energy-readout",   `<span class="fs__readout-row">${aSpan("A <b>" + (FA.energyKwh/1000).toFixed(0) + "</b>")} · ${bSpan("B <b>" + (FB.energyKwh/1000).toFixed(0) + "</b>")} MWh/y</span>`);
      } else {
        const isA = state.filter === "A";
        const f  = isA ? FA : FB;
        const wrap = isA ? aSpan : bSpan;
        setHTML("fs-pressure-lead", `${wrap(f.pressureEnd.toFixed(0))} Pa at one year`);
        setHTML("fs-pm-lead",       `${wrap(f.pmMean.toFixed(2))} µg/m³ annual average`);
        setHTML("fs-energy-lead",   `${wrap(f.energyKwh.toLocaleString())} kWh/y total`);
        setHTML("fs-pressure-readout", wrap(`<b>${f.pressureEnd.toFixed(0)}</b> Pa`));
        setHTML("fs-pm-readout",       wrap(`<b>${f.pmMean.toFixed(2)}</b> µg/m³`));
        setHTML("fs-energy-readout",   wrap(`<b>${f.energyKwh.toLocaleString()}</b> kWh/y`));
      }
    }

    function redraw() {
      const caseData = CASES[state.case];
      const filters = activeFilters();

      // Pressure chart — dust feed (g) → pressure drop (Pa). Endpoint dots
      // land exactly on (dustHeld, pressureEnd) per Feedback 3 §02.4.
      const pressureSets = filters.map((fKey) => {
        const f = caseData.filters[fKey];
        const pts = pressureSeries(f);
        return {
          pts,
          color: FILTER_COLORS[fKey],
          dot: { x: f.dustHeld, y: f.pressureEnd },
          dotLabel: `(${f.dustHeld.toFixed(2)}, ${f.pressureEnd.toFixed(2)})`,
        };
      });
      const allPa = pressureSets.flatMap((s) => s.pts.map((p) => p.y)).concat([0]);
      const allG  = pressureSets.flatMap((s) => s.pts.map((p) => p.x));
      const xMax = Math.max(...allG, 1) * 1.12;
      const yMax = Math.max(...allPa) * 1.15;
      lineChart(ps, {
        series: pressureSets,
        xMin: 0, xMax,
        yMin: 0, yMax,
        xTicks: 5, yTicks: 4,
        fmtX: (v) => Math.round(v) + "g",
        fmtY: (v) => Math.round(v),
        xLabel: "Dust feed (g)",
        yLabel: "Pressure drop (Pa)",
      });

      // PM2.5 chart — Feedback 3 §02.7 TRANSPOSED orientation:
      // x = PM2.5 level (μg/m³), y = Time (hrs).
      const pmSets = filters.map((fKey) => ({
        pts: pmSeries(caseData.filters[fKey], fKey === "A" ? 91 : 113),
        color: FILTER_COLORS[fKey],
        width: 1.0, opacity: 0.78,
      }));
      const pmVals = pmSets.flatMap((s) => s.pts.map((p) => p.x));
      const pmXMax = Math.max(...pmVals) * 1.12;
      lineChart(pm, {
        series: pmSets,
        xMin: 0, xMax: pmXMax,
        yMin: 0, yMax: 8760,
        xTicks: 4, yTicks: 4,
        fmtX: (v) => v.toFixed(2),
        fmtY: (v) => v >= 1000 ? (v / 1000).toFixed(1) + "K" : Math.round(v),
        xLabel: "PM2.5 level (μg/m³)",
        yLabel: "Time (hrs)",
      });

      // Energy bars — Feedback 3 §02.8 (x=Filter, y=Annual fan energy)
      drawEnergyBars(en);

      updateReadouts();
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
        renderCostReadout();
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
    renderCostReadout();
    updateIntent();
    redraw();
    if (!REDUCED) requestAnimationFrame(archStep);
  })();

  /* ============================================================ MATRIX
     Functional rebuild of the platform matrix per Feedback 3 §03 (P1).
     The matrix grid is real HTML — every cell has its energy-reduction
     value (read off the screenshots, identical across all 49 scenarios)
     and a green gradient color. Hovering a cell swaps the image-backed
     Healthy People panel on the right (cropped from each scenario
     screenshot) so the bin distribution, building tilt, and offsets
     all come from authentic platform output, not freehand mockups.
     Cell → image mapping derived from the in-image scenario labels:
     panel index = (6 − row) × 7 + col, with row 0 = +7°F summer
     setback at the top and col 0 = no winter setback on the left.
     The bottom-left BASELINE cell maps to panel 00. */

  (function matrixPlatform() {
    const root = document.getElementById("mxp");
    const grid = document.getElementById("mxp-grid");
    const panel = document.getElementById("mxp-panel");
    const readout = document.getElementById("mxp-readout");
    if (!root || !grid || !panel) return;

    const ROWS = 7, COLS = 7;
    // Row labels (top → bottom): +7°F .. +2°F, then 0 (BASELINE row)
    const ROW_LBLS = ["+7°F", "+6°F", "+5°F", "+4°F", "+3°F", "+2°F", "0"];
    // Col labels (left → right): 0, −2°F .. −7°F
    const COL_LBLS = ["0", "−2°F", "−3°F", "−4°F", "−5°F", "−6°F", "−7°F"];
    // Cell %-reduction values read directly off the platform screenshots.
    // Format: [low, high] per cell, row-major top-to-bottom. The BASELINE
    // cell (row 6, col 0) is rendered as a literal "BASELINE" label.
    const CELLS = [
      // Row +7°F
      [[1.1,1.2],[3.3,3.7],[4.3,5.0],[4.9,5.7],[6.6,7.7],[7.4,8.7],[8.1,9.5]],
      // Row +6°F
      [[1.1,1.1],[3.3,3.7],[4.3,4.9],[4.9,5.6],[6.6,7.7],[7.4,8.6],[8.1,9.5]],
      // Row +5°F
      [[1.0,1.1],[3.2,3.6],[4.2,4.9],[4.8,5.6],[6.5,7.6],[7.3,8.6],[8.0,9.4]],
      // Row +4°F
      [[0.8,0.9],[3.0,3.4],[4.0,4.7],[4.6,5.4],[6.3,7.4],[7.1,8.4],[7.8,9.2]],
      // Row +3°F
      [[0.8,0.8],[2.9,3.3],[3.9,4.6],[4.5,5.3],[6.2,7.4],[7.0,8.3],[7.7,9.2]],
      // Row +2°F
      [[0.6,0.6],[2.7,3.2],[3.7,4.4],[4.3,5.1],[6.0,7.2],[6.8,8.1],[7.5,9.0]],
      // Row 0 (S=0 baseline row): col 0 = BASELINE label cell
      [null,        [2.1,2.6],[3.1,3.8],[3.7,4.5],[5.4,6.6],[6.2,7.5],[6.9,8.4]],
    ];

    // % reduction → green gradient color. Anchored to 0% (pale) and
    // ~8.8% (deep). Matches the screenshot legend.
    function cellColor(pct) {
      const t = Math.max(0, Math.min(1, pct / 8.8));
      const stops = [
        { p: 0.00, c: [240, 245, 224] },
        { p: 0.18, c: [197, 217, 106] },
        { p: 0.50, c: [124, 179,  66] },
        { p: 1.00, c: [ 58, 107,  42] },
      ];
      let a = stops[0], b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].p && t <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const k = (t - a.p) / (b.p - a.p || 1);
      const rgb = a.c.map((cc, i) => Math.round(cc + (b.c[i] - cc) * k));
      return `rgb(${rgb.join(",")})`;
    }

    // Build grid: corner cell, 7 col labels, then 7 rows of (row-label + 7 cells)
    function build() {
      grid.innerHTML = "";
      // First DOM row: corner + col labels (col-labels actually sit BELOW
      // the cells visually — we'll inject the col-label row at the
      // bottom via CSS row order. Simpler: top corner is empty, and
      // we append a col-label row at the END of the grid.

      // Render rows top-down
      for (let r = 0; r < ROWS; r++) {
        // Row label cell
        const rlbl = document.createElement("div");
        rlbl.className = "mxp__row-lbl";
        rlbl.textContent = ROW_LBLS[r];
        grid.appendChild(rlbl);
        // Seven data cells
        for (let c = 0; c < COLS; c++) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "mxp__cell";
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
          cell.setAttribute("role", "gridcell");
          cell.setAttribute("aria-selected", "false");
          const vals = CELLS[r][c];
          if (vals === null) {
            cell.classList.add("is-baseline");
            cell.textContent = "BASELINE";
            cell.style.background = "rgba(10,116,214,0.42)";
          } else {
            const mid = (vals[0] + vals[1]) / 2;
            cell.style.background = cellColor(mid);
            cell.textContent = `${vals[0].toFixed(1)}% – ${vals[1].toFixed(1)}%`;
          }
          cell.setAttribute("aria-label",
            `Summer setback ${ROW_LBLS[r]}, winter setback ${COL_LBLS[c]}`);
          cell.addEventListener("mouseenter", () => activate(r, c, cell));
          cell.addEventListener("focus",      () => activate(r, c, cell));
          grid.appendChild(cell);
        }
      }
      // Empty corner under row-label column
      const corner = document.createElement("div");
      grid.appendChild(corner);
      // 7 column labels along the bottom
      COL_LBLS.forEach((lbl) => {
        const cl = document.createElement("div");
        cl.className = "mxp__col-lbl";
        cl.textContent = lbl;
        grid.appendChild(cl);
      });
    }

    // Preload all 49 cropped panel images so swaps are instant
    for (let i = 0; i < 49; i++) {
      const im = new Image();
      im.src = `assets/matrix-panel/panel-${String(i).padStart(2, "0")}.webp`;
    }

    // (row, col) → panel index. BASELINE = panel 0; otherwise
    // (6 − row) × 7 + col gives the chronological capture order.
    function panelIndexFor(r, c) {
      return (6 - r) * 7 + c;
    }

    let activeCell = null;
    function activate(r, c, cellEl) {
      const idx = panelIndexFor(r, c);
      const safeIdx = String(idx).padStart(2, "0");
      panel.src = `assets/matrix-panel/panel-${safeIdx}.webp`;

      const vals = CELLS[r][c];
      const isBaseline = vals === null;
      const wLbl = COL_LBLS[c];
      const sLbl = ROW_LBLS[r];
      const reductionLbl = isBaseline
        ? "no setback · baseline"
        : `${vals[0].toFixed(1)}% – ${vals[1].toFixed(1)}% energy reduction`;
      panel.alt = isBaseline
        ? "Healthy People · Baseline · no temperature setback"
        : `Healthy People · winter ${wLbl} / summer ${sLbl}`;
      if (readout) {
        readout.textContent = isBaseline
          ? "Baseline · no setback · 0.00% offset across all bins"
          : `Winter ${wLbl} · Summer ${sLbl} · ${reductionLbl}`;
      }
      if (activeCell) {
        activeCell.classList.remove("is-active");
        activeCell.setAttribute("aria-selected", "false");
      }
      if (cellEl) {
        cellEl.classList.add("is-active");
        cellEl.setAttribute("aria-selected", "true");
        activeCell = cellEl;
      }
    }

    grid.addEventListener("mouseleave", () => {
      const baselineCell = grid.querySelector(".mxp__cell.is-baseline");
      activate(6, 0, baselineCell);
    });

    // Note: intervention tabs, setback timing chips, clock-format toggle,
    // and °F/°C toggle are all display-only reference tokens (the 49
    // scenario panels were captured at fixed defaults — no extra state
    // they can drive). They render as static <span>s in the HTML; no
    // click handlers are wired up here so they don't read as live
    // controls to keyboard or AT users.

    build();
    // Initialize at BASELINE (row 6, col 0)
    activate(6, 0, grid.querySelector('.mxp__cell.is-baseline'));
  })();

  /* Legacy slide-16 module (heatmap + Healthy People SVG). Disabled —
     replaced by the image-backed matrix49 above. Kept as a no-op so any
     stale references resolve cleanly. */
  (function matrix16() {
    const grid = document.getElementById("mx16-grid");
    const bldg = document.getElementById("mx16-bldg");
    const bins = document.getElementById("mx16-bins");
    const readout = document.getElementById("mx16-cell-readout");
    if (!grid || !bldg || !bins) return;

    // Axes — outdoor temperature columns (low → high °F) and HVAC
    // shift rows (-0°F at the bottom → -10°F at the top, deeper setbacks
    // produce bigger reductions). Same shape as slide 16.
    const OUTDOOR_TEMPS = [0, 10, 20, 30, 40, 50, 60, 70];           // °F
    const HVAC_SHIFTS   = [-0, -2, -4, -6, -8, -10];                 // °F, displayed top-down
    // Baseline lives in the bottom-left corner of slide 16.

    // % energy reduction model — combine HVAC setback depth with how
    // close the outdoor temperature is to the heating/cooling setpoint
    // sweet spot (around 50-60°F). Deeper setbacks + mid temperatures
    // give the biggest reductions; extreme temperatures attenuate.
    function reductionFor(shift, outdoor) {
      if (shift === 0) return 0;
      const depth = Math.abs(shift) / 10;                            // 0..1
      const distFromSweet = Math.abs(outdoor - 55) / 55;             // 0..~1.3
      const tempPenalty = Math.max(0, 1 - distFromSweet * 0.85);
      return Math.max(0, depth * tempPenalty * 8.4);                  // up to ~8%
    }

    // Color scale — gray (0%) → light green → deep green (8%+)
    function cellColor(pct) {
      if (pct <= 0) return "rgba(178,204,238,0.06)";
      const t = Math.min(1, pct / 8);
      // interpolate light→deep green
      const stops = [
        { p: 0.0, c: [197, 217, 106] },                              // c5d96a
        { p: 0.45, c: [124, 179, 66] },                              // 7cb342
        { p: 1.0, c: [58, 107, 42] },                                // 3a6b2a
      ];
      let a = stops[0], b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].p && t <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const k = (t - a.p) / (b.p - a.p || 1);
      const rgb = a.c.map((cc, i) => Math.round(cc + (b.c[i] - cc) * k));
      return `rgb(${rgb.join(",")})`;
    }

    // Baseline bin distribution + how each cell tilts it. As the
    // outdoor temperature pulls away from the comfort zone, more
    // occupants slide from Optimized → Excellent → Action → Alert →
    // Limit. Aggressive setbacks compound the tilt.
    const BASELINE_BINS = [81.0, 13.3, 3.1, 1.3, 1.4];               // matches slide-16 figure
    const BIN_NAMES = ["Health Optimized", "Excellent", "Action", "Alert", "Limit"];
    const BIN_COLORS = ["#0a74d6", "#b2ccee", "#ffeb95", "#fcbc7e", "#f5896d"];

    function tiltFor(shift, outdoor) {
      if (shift === 0) return BASELINE_BINS.slice();                 // baseline
      // Severity score: deeper setback × distance from comfort zone (55°F)
      const depth = Math.abs(shift) / 10;
      const tempDist = Math.abs(outdoor - 55) / 55;
      const severity = depth * (0.45 + tempDist * 0.95);             // 0..~1.5
      // Tilt: shave from top bins, push into bottom bins
      const moveFromOpt = Math.min(BASELINE_BINS[0] * 0.18, BASELINE_BINS[0] * severity * 0.18);
      const moveFromExc = Math.min(BASELINE_BINS[1] * 0.5,  BASELINE_BINS[1] * severity * 0.5);
      // Distribute into Action / Alert / Limit
      const into = moveFromOpt + moveFromExc;
      const intoAction = into * 0.55;
      const intoAlert  = into * 0.30;
      const intoLimit  = into * 0.15;
      const out = [
        BASELINE_BINS[0] - moveFromOpt,
        BASELINE_BINS[1] - moveFromExc,
        BASELINE_BINS[2] + intoAction,
        BASELINE_BINS[3] + intoAlert,
        BASELINE_BINS[4] + intoLimit,
      ];
      return out;
    }

    // ---------- Render the grid ----------
    function renderGrid() {
      grid.innerHTML = "";
      // First row: empty corner + outdoor-temp column labels
      grid.style.gridTemplateColumns = `48px repeat(${OUTDOOR_TEMPS.length}, minmax(0, 1fr))`;
      grid.style.gridTemplateRows = `auto repeat(${HVAC_SHIFTS.length}, minmax(0, 1fr))`;

      // Column-label row
      const corner = document.createElement("div");
      grid.appendChild(corner);
      OUTDOOR_TEMPS.forEach((t) => {
        const lbl = document.createElement("div");
        lbl.className = "mx16__grid-collbl";
        lbl.textContent = t + "°F";
        grid.appendChild(lbl);
      });

      // Data rows, top-down: deepest setback (-10°F) first
      const rowsTopDown = HVAC_SHIFTS.slice().sort((a, b) => a - b); // [-10, -8, ..., 0]
      rowsTopDown.forEach((shift) => {
        const rowLbl = document.createElement("div");
        rowLbl.className = "mx16__grid-rowlbl";
        rowLbl.textContent = (shift === 0 ? "0" : shift) + "°F";
        grid.appendChild(rowLbl);
        OUTDOOR_TEMPS.forEach((outdoor) => {
          const cell = document.createElement("div");
          cell.className = "mx16__cell";
          cell.dataset.shift = String(shift);
          cell.dataset.outdoor = String(outdoor);
          if (shift === 0 && outdoor === OUTDOOR_TEMPS[0]) {
            cell.classList.add("is-baseline");
            cell.textContent = "BASELINE";
          } else {
            const pct = reductionFor(shift, outdoor);
            cell.style.background = cellColor(pct);
            cell.textContent = pct.toFixed(1) + "%";
          }
          cell.addEventListener("mouseenter", () => applyCell(shift, outdoor, cell));
          cell.addEventListener("focus",      () => applyCell(shift, outdoor, cell));
          cell.tabIndex = 0;
          grid.appendChild(cell);
        });
      });
    }

    // ---------- Render the Healthy People panel ----------
    function renderBuilding(pcts) {
      // Stacked vertical tower made of 5 segments; each segment height
      // is proportional to its bin percentage. As the cell hover tilts
      // the distribution, the tower visibly shifts color weight.
      bldg.innerHTML = "";
      const total = pcts.reduce((a, b) => a + b, 0) || 100;
      const top = 20, bot = 268, height = bot - top;
      let y = top;
      const ns = "http://www.w3.org/2000/svg";
      // Outline frame
      const frame = document.createElementNS(ns, "rect");
      frame.setAttribute("x", "20"); frame.setAttribute("y", "16");
      frame.setAttribute("width", "80"); frame.setAttribute("height", "256");
      frame.setAttribute("fill", "none");
      frame.setAttribute("stroke", "rgba(178,204,238,0.45)");
      frame.setAttribute("stroke-width", "1");
      bldg.appendChild(frame);
      // Roof slab
      const roof = document.createElementNS(ns, "polygon");
      roof.setAttribute("points", "20,16 100,16 92,8 28,8");
      roof.setAttribute("fill", "rgba(178,204,238,0.08)");
      roof.setAttribute("stroke", "rgba(178,204,238,0.35)");
      bldg.appendChild(roof);

      pcts.forEach((p, i) => {
        const h = (p / total) * height;
        const seg = document.createElementNS(ns, "rect");
        seg.setAttribute("x", "22");
        seg.setAttribute("y", y.toFixed(1));
        seg.setAttribute("width", "76");
        seg.setAttribute("height", Math.max(0, h - 1).toFixed(1));
        seg.setAttribute("fill", BIN_COLORS[i]);
        seg.setAttribute("opacity", "0.92");
        seg.style.transition = "y 320ms cubic-bezier(.2,.8,.2,1), height 320ms cubic-bezier(.2,.8,.2,1)";
        bldg.appendChild(seg);
        y += h;
      });
      // Ground line
      const ground = document.createElementNS(ns, "line");
      ground.setAttribute("x1", "10"); ground.setAttribute("x2", "110");
      ground.setAttribute("y1", "272"); ground.setAttribute("y2", "272");
      ground.setAttribute("stroke", "rgba(178,204,238,0.18)");
      bldg.appendChild(ground);
    }

    function renderBins(pcts, deltas) {
      bins.innerHTML = BIN_NAMES.map((name, i) => {
        const d = deltas[i];
        const dStr = d == null ? "—" : ((d >= 0 ? "+" : "−") + Math.abs(d).toFixed(2) + "%");
        const dCls = d == null || Math.abs(d) < 0.005
          ? ""
          : d > 0
            ? (i >= 2 ? " is-neg" : " is-pos")
            : (i >= 2 ? " is-pos" : " is-neg");
        return `<div class="mx16__bin">
          <span class="mx16__bin-dot" style="background:${BIN_COLORS[i]}"></span>
          <span class="mx16__bin-k">${name}</span>
          <span class="mx16__bin-v">${pcts[i].toFixed(1)}%</span>
          <span class="mx16__bin-d${dCls}">${dStr}</span>
        </div>`;
      }).join("");
    }

    // ---------- Apply hovered cell to the Healthy People panel ----------
    let activeCell = null;
    function applyCell(shift, outdoor, el) {
      // Visual selection
      if (activeCell) activeCell.classList.remove("is-active");
      if (el) { el.classList.add("is-active"); activeCell = el; }

      // Recompute distribution + deltas
      const tilted = tiltFor(shift, outdoor);
      const deltas = tilted.map((v, i) => +(v - BASELINE_BINS[i]).toFixed(2));
      renderBuilding(tilted);
      renderBins(tilted, deltas);

      // Readout copy
      const pct = reductionFor(shift, outdoor);
      const shiftLbl = shift === 0 ? "0°F (baseline)" : `${shift}°F setback`;
      readout.textContent = `${shiftLbl} · ${outdoor}°F outdoor · ${pct.toFixed(1)}% reduction`;
    }

    // Initial state: baseline (0°F shift, 0°F outdoor cell is BASELINE)
    renderGrid();
    renderBuilding(BASELINE_BINS);
    renderBins(BASELINE_BINS, [0, 0, 0, 0, 0]);
  })();

  /* ============================================================ H.E.A.A.L.
     Platform-fidelity surface — building plot · time series · space-time
     map · floor and parameter toggles. The brief asks us not to redesign
     the platform speculatively, so the composition is the
     recognizable HEAAL "building plot on the left, scrolling parameter
     on the right" layout, with restrained web-native interaction. */

  /* ============================================================ H.E.A.A.L.
     Image-backed parameter switcher per Feedback 3 §04. Four pill
     buttons (CO2 / PM2.5 / TVOC / Temp) swap among 4 platform
     screenshots. Everything else inside the box (SpaceTime Map,
     Timeseries Plot, live values, bin breakdown, building tower) lives
     in the image — no synthetic recreation.
     ================================================================ */
  (function heaal4() {
    const root = document.getElementById("hl4");
    const img  = document.getElementById("hl4-img");
    if (!root || !img) return;

    // Image order matches chronological screenshot capture:
    //   heaal-00 → CO₂, heaal-01 → PM₂.₅, heaal-02 → TVOC, heaal-03 → Temp.
    const MAP = { co2: 0, pm25: 1, tvoc: 2, temp: 3 };
    const ALT = { co2: "H.E.A.A.L. Analytics platform · CO₂ view",
                  pm25: "H.E.A.A.L. Analytics platform · PM₂.₅ view",
                  tvoc: "H.E.A.A.L. Analytics platform · TVOC view",
                  temp: "H.E.A.A.L. Analytics platform · Temperature view" };

    // Preload all four screenshots so swaps are instant.
    Object.values(MAP).forEach((i) => {
      const im = new Image();
      im.src = `assets/heaal/heaal-0${i}.webp`;
    });

    const btns = root.querySelectorAll(".hl4__btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.dataset.hlParam;
        if (!(p in MAP)) return;
        img.src = `assets/heaal/heaal-0${MAP[p]}.webp`;
        img.alt = ALT[p];
        btns.forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
      });
    });
  })();

  /* Legacy SVG-based HEAAL module — disabled. Replaced by heaal4 above.
     Kept as a no-op guard so any orphaned hl-* elements don't error. */
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
