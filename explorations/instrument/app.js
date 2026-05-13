/* ==========================================================================
   9F · DC-OPS · operations terminal
   Deterministic instrument-panel interactions.
   d3 + topojson via CDN; window.NINEF_DATA from ../../data.js.
   ========================================================================== */

(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmt = {
    int: n => Math.round(n).toLocaleString("en-US"),
    flt: (n, d = 1) => Number(n).toFixed(d),
    num: n => Number(n).toLocaleString("en-US"),
    money: n => "$" + Math.round(n).toLocaleString("en-US"),
    nice: n => {
      const abs = Math.abs(n);
      if (abs >= 1e9) return (n/1e9).toFixed(2) + "B";
      if (abs >= 1e6) return (n/1e6).toFixed(2) + "M";
      if (abs >= 1e3) return (n/1e3).toFixed(1) + "k";
      return Math.round(n).toString();
    }
  };

  // Mulberry32 — deterministic RNG (single seed for entire page).
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ============================================================ TOPNAV: scroll progress rail
  (function topnavProgress() {
    const progress = $("#console-progress");
    if (!progress) return;
    function onScroll() {
      const doc = document.documentElement;
      const max = Math.max(1, (doc.scrollHeight || document.body.scrollHeight) - window.innerHeight);
      const pct = Math.min(1, Math.max(0, window.scrollY / max));
      progress.style.transform = `scaleX(${pct.toFixed(4)})`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  })();

  // ============================================================ SUBNAV scroll-spy
  (function subnav() {
    const links = $$(".subnav__lnk");
    if (!links.length) return;
    const targets = links
      .map((a) => ({ a, el: document.querySelector(a.getAttribute("href")) }))
      .filter(x => x.el);
    if (!targets.length) return;
    const visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        });
        const arr = Array.from(visible).sort(
          (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
        );
        const active = arr.find((el) => el.getBoundingClientRect().top < 140) || arr[0];
        targets.forEach(({a}) => a.classList.remove("is-active"));
        if (active) {
          const m = targets.find((t) => t.el === active);
          if (m) m.a.classList.add("is-active");
        }
      },
      { rootMargin: "-100px 0px -50% 0px", threshold: [0, 0.1, 0.5, 1] }
    );
    targets.forEach((t) => io.observe(t.el));
  })();

  // ============================================================ REVEAL on scroll
  (function reveal() {
    $$(".mod__head, .panel, .readouts, .why__grid, .fs__readouts, .fs__charts, .fs__headline, .mx__flow, .mx__heat-wrap, .mx__readout, .hl__top, .hl__grid-wrap, .imp__grid, .imp__cobe, .team__grid, .lead").forEach(el => el.setAttribute("data-reveal", ""));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );
    $$("[data-reveal]").forEach((el) => io.observe(el));
  })();

  // ============================================================ DATASET aggregates
  const DATA = window.NINEF_DATA;
  const SITES = DATA ? DATA.sites : [];

  function aggregate(sites) {
    let ex = 0, pl = 0, it = 0, fi = 0;
    sites.forEach((s) => {
      if (s.status === "existing") ex++;
      else if (s.status === "planned") pl++;
      it += s.it_mw || 0;
      fi += s.filters || 0;
    });
    return { total: sites.length, ex, pl, it, fi };
  }

  function siteMatches(s, state) {
    if (state.status !== "all" && s.status !== state.status) return false;
    if (state.system !== "all" && s.system !== state.system) return false;
    return true;
  }

  // ============================================================ MAP-01 · VA PORTFOLIO
  (function map() {
    if (!DATA || typeof d3 === "undefined" || typeof topojson === "undefined") return;
    const svg = d3.select("#va-map");
    const loading = $("#map-loading");
    const W = 800, H = 500;
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const state = { status: "all", system: "all" };

    const allCount = aggregate(SITES);

    // Default labels in legend
    $("#lg-ex").textContent = fmt.int(allCount.ex);
    $("#lg-pl").textContent = fmt.int(allCount.pl);
    $("#map-load").textContent = (allCount.it / 1000).toFixed(1) + " GW";
    $("#map-filt").textContent = fmt.int(allCount.fi);
    $("#map-count").textContent = fmt.int(allCount.total) + " / " + fmt.int(allCount.total);

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

    let projection, points, outlinePath;

    loadVA()
      .then((us) => {
        const states = topojson.feature(us, us.objects.states);
        const va = states.features.find((f) => f.id === "51");
        render(va);
      })
      .catch(() => render(null));

    function render(va) {
      if (va) {
        projection = d3.geoMercator().fitExtent([[24, 30], [W - 24, H - 30]], va);
      } else {
        const VA_BBOX = {
          type: "Polygon",
          coordinates: [[[-83.7, 36.5], [-75.2, 36.5], [-75.2, 39.5], [-83.7, 39.5], [-83.7, 36.5]]]
        };
        projection = d3.geoMercator().fitExtent([[24, 30], [W - 24, H - 30]], VA_BBOX);
      }
      const path = d3.geoPath(projection);

      // background grid
      const gGrid = svg.append("g").attr("class", "va-grid");
      const stepX = (W - 48) / 8;
      const stepY = (H - 60) / 5;
      for (let i = 0; i <= 8; i++) {
        gGrid.append("line").attr("x1", 24 + i*stepX).attr("x2", 24 + i*stepX).attr("y1", 30).attr("y2", H - 30);
      }
      for (let i = 0; i <= 5; i++) {
        gGrid.append("line").attr("x1", 24).attr("x2", W - 24).attr("y1", 30 + i*stepY).attr("y2", 30 + i*stepY);
      }

      // VA outline
      if (va) {
        svg.append("path")
          .datum(va)
          .attr("class", "va-outline")
          .attr("d", path);
      }

      // sites
      const rScale = d3.scaleSqrt()
        .domain([0, d3.max(SITES, d => d.it_mw) || 1])
        .range([1.2, 6.6]);

      const gPts = svg.append("g").attr("class", "sites");
      points = gPts.selectAll("circle.site-pt")
        .data(SITES, d => d.id)
        .enter()
        .append("circle")
        .attr("class", d => "site-pt is-" + d.status)
        .attr("cx", d => projection([d.lng, d.lat])[0])
        .attr("cy", d => projection([d.lng, d.lat])[1])
        .attr("r", d => rScale(d.it_mw))
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", d => `${d.id} · ${d.county} · ${d.status}`)
        .on("mouseover", (ev, d) => showSite(d, ev.currentTarget))
        .on("focus", (ev, d) => showSite(d, ev.currentTarget))
        .on("mouseout", (ev) => { ev.currentTarget.classList.remove("is-hover"); })
        .on("blur", (ev) => { ev.currentTarget.classList.remove("is-hover"); });

      // ticks
      const gTicks = svg.append("g").attr("class", "va-ticks");
      [
        { x: 30, y: H-12, txt: "37.0°N" },
        { x: W/2, y: H-12, txt: "78.5°W · CENTERLINE", anchor: "middle" },
        { x: W-30, y: H-12, txt: "37.0°N", anchor: "end" }
      ].forEach((t) => {
        gTicks.append("text")
          .attr("class", "va-tick")
          .attr("x", t.x)
          .attr("y", t.y)
          .attr("text-anchor", t.anchor || "start")
          .text(t.txt);
      });

      if (loading) loading.classList.add("is-hidden");

      // Hook filters now that points exist
      $$(".map .seg__b").forEach((b) => {
        b.addEventListener("click", () => {
          const filter = b.dataset.filter;
          const value = b.dataset.value;
          state[filter] = value;
          $$(`.map .seg__b[data-filter="${filter}"]`).forEach(x => x.classList.toggle("is-active", x.dataset.value === value));
          applyFilter();
        });
      });
      applyFilter();
      renderHistograms();
    }

    function showSite(d, el) {
      const cls = "site-pt is-hover";
      // ensure hover style; we keep classes for filtering
      // remove hover from previous
      svg.selectAll("circle.site-pt").classed("is-hover", false);
      el.classList.add("is-hover");

      $("#site-id").textContent = (d.id || "—") + " · " + (d.status || "—").toUpperCase();
      $("#site-sub").textContent = `Parameterised archetype · ${d.county} County · ${d.egrid}`;

      const kv = $("#site-kv");
      const rows = [
        ["COUNTY", d.county],
        ["STATUS", (d.status || "").toUpperCase()],
        ["FLOOR", fmt.int(d.floor_m2) + " m²"],
        ["CEILING", d.ceiling_m.toFixed(1) + " m"],
        ["IT LOAD", d.it_mw.toFixed(2) + " MW"],
        ["PUE", d.pue.toFixed(2)],
        ["SYSTEM", d.system],
        ["AIR FRAC", (d.air_frac*100).toFixed(0) + "%"],
        ["CAPACITY", fmt.int(d.capacity_m3s) + " m³/s"],
        ["FILTERS", fmt.int(d.filters)],
        ["eGRID", d.egrid],
        ["LAT,LNG", d.lat.toFixed(3) + ", " + d.lng.toFixed(3)],
      ];
      kv.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    }

    function applyFilter() {
      if (!points) return;
      let visible = [];
      points.each(function (d) {
        const ok = siteMatches(d, state);
        this.classList.toggle("is-dim", !ok);
        if (ok) visible.push(d);
      });
      const ag = aggregate(visible);
      $("#lg-ex").textContent = fmt.int(ag.ex);
      $("#lg-pl").textContent = fmt.int(ag.pl);
      $("#map-load").textContent = (ag.it / 1000).toFixed(1) + " GW";
      $("#map-filt").textContent = fmt.int(ag.fi);
      $("#map-count").textContent = fmt.int(ag.total) + " / " + fmt.int(allCount.total);
      $("#map-query").textContent = `status=${state.status.toUpperCase()} · system=${state.system.toUpperCase()}`;
      renderHistograms(visible);
    }

    function renderHistograms(subset) {
      const data = subset && subset.length ? subset : SITES;
      const allSet = SITES;

      function bins(arr, accessor, n, isLog) {
        const vals = arr.map(accessor).filter(v => Number.isFinite(v));
        if (!vals.length) return { bins: [], domain: [0, 0] };
        const dom = [d3.min(allSet, accessor), d3.max(allSet, accessor)];
        const scale = isLog ? d3.scaleLog().domain([Math.max(0.01, dom[0]), dom[1]]).range([0, 1])
                            : d3.scaleLinear().domain(dom).range([0, 1]);
        const out = new Array(n).fill(0);
        vals.forEach((v) => {
          const t = Math.min(0.9999, Math.max(0, scale(v)));
          out[Math.floor(t * n)] += 1;
        });
        return { bins: out, domain: dom };
      }

      function drawHist(svgSel, dataset, accessor, isLog) {
        const sel = d3.select(svgSel);
        sel.selectAll("*").remove();
        const N = 28;
        const { bins: b1 } = bins(dataset, accessor, N, isLog);
        const { bins: bAll } = bins(allSet, accessor, N, isLog);
        const max = d3.max(bAll) || 1;
        const W = 320, H = 56;
        const padL = 4, padR = 4, padT = 6, padB = 10;
        const bw = (W - padL - padR) / N;
        // baseline rule
        sel.append("line")
          .attr("x1", padL).attr("x2", W - padR)
          .attr("y1", H - padB).attr("y2", H - padB)
          .attr("stroke", "rgba(170,200,230,0.18)").attr("stroke-width", 0.5);
        // ghost (full dataset) outline
        bAll.forEach((v, i) => {
          const h = (v / max) * (H - padT - padB);
          sel.append("rect")
            .attr("x", padL + i*bw + 0.5)
            .attr("y", (H - padB) - h)
            .attr("width", Math.max(1, bw - 1))
            .attr("height", h)
            .attr("fill", "rgba(170,200,230,0.06)")
            .attr("stroke", "rgba(170,200,230,0.12)")
            .attr("stroke-width", 0.5);
        });
        // active subset
        b1.forEach((v, i) => {
          const h = (v / max) * (H - padT - padB);
          sel.append("rect")
            .attr("class", "bar")
            .attr("x", padL + i*bw + 0.5)
            .attr("y", (H - padB) - h)
            .attr("width", Math.max(1, bw - 1))
            .attr("height", h)
            .attr("fill", "var(--sig-ok)")
            .attr("opacity", 0.78);
        });
      }

      drawHist("#hist-floor", data, d => d.floor_m2, true);
      drawHist("#hist-it", data, d => d.it_mw, true);
      drawHist("#hist-pue", data, d => d.pue, false);
      drawHist("#hist-fi", data, d => d.filters, true);
    }
  })();

  // ============================================================ ARCHETYPE diagram
  (function archetype() {
    const svg = d3.select("#arch-svg");
    if (svg.empty()) return;
    const W = 640, H = 360;
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    // Background grid
    const gridG = svg.append("g");
    for (let x = 24; x < W - 24; x += 32) {
      gridG.append("line").attr("x1", x).attr("x2", x).attr("y1", 24).attr("y2", H - 24)
        .attr("stroke", "rgba(170,200,230,0.04)").attr("stroke-width", 0.5);
    }
    for (let y = 24; y < H - 24; y += 32) {
      gridG.append("line").attr("y1", y).attr("y2", y).attr("x1", 24).attr("x2", W - 24)
        .attr("stroke", "rgba(170,200,230,0.04)").attr("stroke-width", 0.5);
    }

    // Building rectangle (cross-section)
    const bX = 110, bY = 100, bW = 420, bH = 200;
    svg.append("rect")
      .attr("x", bX).attr("y", bY).attr("width", bW).attr("height", bH)
      .attr("fill", "rgba(108,243,200,0.025)")
      .attr("stroke", "rgba(108,243,200,0.5)")
      .attr("stroke-width", 1);

    // Internal divisions: server rooms
    [0.25, 0.5, 0.75].forEach((p) => {
      svg.append("line")
        .attr("x1", bX + bW*p).attr("x2", bX + bW*p)
        .attr("y1", bY + 20).attr("y2", bY + bH - 20)
        .attr("stroke", "rgba(108,243,200,0.18)")
        .attr("stroke-dasharray", "2 3")
        .attr("stroke-width", 0.8);
    });

    // server "racks"
    const r = rng(42);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 6; row++) {
        const x = bX + 18 + col*(bW/4) + (row%2)*8;
        const y = bY + 40 + row*22;
        svg.append("rect")
          .attr("x", x).attr("y", y).attr("width", 28).attr("height", 14)
          .attr("fill", "rgba(108,243,200,0.08)")
          .attr("stroke", "rgba(108,243,200,0.35)")
          .attr("stroke-width", 0.6);
        // small "LED"
        svg.append("circle")
          .attr("cx", x + 24).attr("cy", y + 4).attr("r", 1.2)
          .attr("fill", r() > 0.2 ? "var(--sig-ok)" : "var(--sig-amber)");
      }
    }

    // Filter banks (intake)
    svg.append("rect")
      .attr("x", bX - 24).attr("y", bY + 30).attr("width", 18).attr("height", 50)
      .attr("fill", "rgba(154,166,255,0.1)")
      .attr("stroke", "rgba(154,166,255,0.55)")
      .attr("stroke-width", 1);
    // hatching for filter
    for (let i = 0; i < 6; i++) {
      svg.append("line")
        .attr("x1", bX - 22).attr("x2", bX - 8)
        .attr("y1", bY + 34 + i*8).attr("y2", bY + 34 + i*8)
        .attr("stroke", "rgba(154,166,255,0.55)").attr("stroke-width", 0.6);
    }
    // Filter bank (recirc / exhaust)
    svg.append("rect")
      .attr("x", bX + bW + 6).attr("y", bY + bH - 80).attr("width", 18).attr("height", 50)
      .attr("fill", "rgba(154,166,255,0.1)")
      .attr("stroke", "rgba(154,166,255,0.55)")
      .attr("stroke-width", 1);
    for (let i = 0; i < 6; i++) {
      svg.append("line")
        .attr("x1", bX + bW + 8).attr("x2", bX + bW + 22)
        .attr("y1", bY + bH - 76 + i*8).attr("y2", bY + bH - 76 + i*8)
        .attr("stroke", "rgba(154,166,255,0.55)").attr("stroke-width", 0.6);
    }

    // Air path arrow (intake side)
    const arrow = (x1, y1, x2, y2) => {
      svg.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
        .attr("stroke", "rgba(154,166,255,0.7)").attr("stroke-width", 1.2)
        .attr("marker-end", "url(#arrowhead)");
    };
    // arrow defs
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead").attr("viewBox", "0 0 10 10")
      .attr("refX", 8).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "rgba(154,166,255,0.8)");

    arrow(40, bY + 55, bX - 26, bY + 55);
    arrow(bX + bW + 26, bY + bH - 55, W - 30, bY + bH - 55);

    // Labels (mono, faint)
    const label = (x, y, txt, anchor) => {
      svg.append("text")
        .attr("x", x).attr("y", y)
        .attr("text-anchor", anchor || "start")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 9.5)
        .attr("letter-spacing", "0.06em")
        .attr("fill", "rgba(155,175,198,0.7)")
        .text(txt);
    };
    label(40, bY + 42, "OUTDOOR · 6.49 µg/m³ PM₂.₅");
    label(bX - 26, bY + 22, "VENT FILTER · 122 UNITS");
    label(bX + bW + 6, bY + bH - 92, "RECIRC · 523 FILTERS", "start");
    label(bX, bY + bH + 16, "ARCHETYPE NV-REP-01 · 280 MW · DLC · 20% AIR / 80% LIQUID");
    label(bX + bW, bY + bH + 16, "INDOOR · 0.17 µg/m³ POST-FILTRATION", "end");
    // Outdoor side label
    label(W - 30, bY + bH - 72, "EXHAUST", "end");

    // Particles — outdoor (dense, amber) and indoor (sparse, cyan)
    // Deterministic positions; reduced-motion = static.
    const RAND = rng(91);
    const outdoorN = 90;
    const indoorN = 14;

    const outdoor = [];
    for (let i = 0; i < outdoorN; i++) {
      // Place outside the building or near intake
      let x, y;
      if (RAND() < 0.5) {
        x = 24 + RAND() * (bX - 30 - 24);
        y = 24 + RAND() * (H - 48);
      } else {
        x = (bX + bW + 30) + RAND() * (W - 24 - (bX + bW + 30));
        y = 24 + RAND() * (H - 48);
      }
      outdoor.push({ x, y, r: 1 + RAND() * 1.6, a: 0.55 + RAND() * 0.4 });
    }
    const indoor = [];
    for (let i = 0; i < indoorN; i++) {
      indoor.push({
        x: bX + 12 + RAND() * (bW - 24),
        y: bY + 12 + RAND() * (bH - 24),
        r: 0.8 + RAND() * 1.0,
        a: 0.65
      });
    }

    const gOut = svg.append("g");
    outdoor.forEach((p) => {
      gOut.append("circle")
        .attr("cx", p.x).attr("cy", p.y).attr("r", p.r)
        .attr("fill", "var(--sig-amber)")
        .attr("opacity", p.a);
    });
    const gIn = svg.append("g");
    indoor.forEach((p) => {
      gIn.append("circle")
        .attr("cx", p.x).attr("cy", p.y).attr("r", p.r)
        .attr("fill", "var(--sig-ok)")
        .attr("opacity", p.a);
    });

    // Optional: faint deterministic pulse on indoor particles via CSS animation only when not reduced
    if (!REDUCED) {
      gIn.selectAll("circle").each(function (d, i) {
        d3.select(this)
          .append("animate")
          .attr("attributeName", "opacity")
          .attr("values", `${0.4};${0.85};${0.4}`)
          .attr("dur", `${2.4 + (i % 4) * 0.3}s`)
          .attr("repeatCount", "indefinite");
      });
    }
  })();

  // ============================================================ MOD-04 · FILTERSTUDIO
  (function filterStudio() {
    if (typeof d3 === "undefined") return;

    // Locked, deterministic ground-truth values for the comparison.
    const FS = {
      A: { energy: 204096, pm: 0.17, perfFinal: 135.3, perfInitial: 40, color: "var(--sig-ok)" },
      B: { energy: 318411, pm: 0.12, perfFinal: 217.8, perfInitial: 50, color: "var(--sig-amber)" }
    };

    // Pressure drop trace (TBO time 0 → 1 normalized; lab-style monotonic build)
    function pressureCurve(f) {
      const pts = [];
      const N = 30;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        // Mild non-linear loading curve. Endpoints honest.
        const v = f.perfInitial + (f.perfFinal - f.perfInitial) * Math.pow(t, 0.85);
        pts.push([t, v]);
      }
      return pts;
    }
    function pmCurve(f) {
      // PM converges to filter steady state; same shape, different asymptote.
      const pts = [];
      const N = 30;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        // start near 0 (clean room), rise toward steady-state value
        const v = f.pm * (1 - Math.exp(-3 * t));
        pts.push([t, v]);
      }
      return pts;
    }

    const view = { mode: "AB" };

    function setActive(mode) {
      view.mode = mode;
      $$(".panel--fs .seg--fs .seg__b").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.fs === mode)
      );

      // Scenario label (element only exists if the HTML still renders the meta strip)
      const fsScen = $("#fs-scenario");
      if (fsScen) fsScen.textContent = mode === "AB" ? "Compare A↔B" : mode === "A" ? "Isolate A" : "Isolate B";

      const showA = mode === "A" || mode === "AB";
      const showB = mode === "B" || mode === "AB";

      // Cards: numbers always honest, "primary" rotates.
      const primary = mode === "B" ? "B" : "A";
      const secondary = primary === "A" ? "B" : "A";

      // ENERGY (kWh/y) — lower = better — A is lower
      $("#fs-energy-a").textContent = fmt.int(FS[primary].energy);
      const eP = FS[primary].energy, eS = FS[secondary].energy;
      $("#fs-energy-b").textContent = mode === "AB"
        ? `vs ${fmt.int(eS)} kWh / y · ${secondary}`
        : (mode === "A" ? `vs ${fmt.int(FS.B.energy)} kWh / y · B (hidden)` : `vs ${fmt.int(FS.A.energy)} kWh / y · A (hidden)`);
      // delta vs the other filter, % difference relative to the other
      const eDelta = Math.round(((FS.B.energy - FS.A.energy) / FS.A.energy) * 100);
      $("#fs-d-energy").textContent = `Δ +${eDelta}% B · A WINS`;

      // PM2.5 (µg/m³) — lower = better — B is lower
      $("#fs-health-a").textContent = FS[primary].pm.toFixed(2);
      $("#fs-health-b").textContent = mode === "AB"
        ? `vs ${FS[secondary].pm.toFixed(2)} µg / m³ · ${secondary}`
        : (mode === "A" ? `vs ${FS.B.pm.toFixed(2)} µg / m³ · B (hidden)` : `vs ${FS.A.pm.toFixed(2)} µg / m³ · A (hidden)`);
      const pmDelta = Math.round(((FS.A.pm - FS.B.pm) / FS.A.pm) * 100);
      $("#fs-d-health").textContent = `Δ −${pmDelta}% B · B WINS`;

      // Pressure drop (Pa) — lower = better — A is lower
      $("#fs-perf-a").textContent = FS[primary].perfFinal.toFixed(1);
      $("#fs-perf-b").textContent = mode === "AB"
        ? `vs ${FS[secondary].perfFinal.toFixed(1)} Pa · ${secondary}`
        : (mode === "A" ? `vs ${FS.B.perfFinal.toFixed(1)} Pa · B (hidden)` : `vs ${FS.A.perfFinal.toFixed(1)} Pa · A (hidden)`);
      const pDelta = Math.round(((FS.B.perfFinal - FS.A.perfFinal) / FS.A.perfFinal) * 100);
      $("#fs-d-perf").textContent = `Δ +${pDelta}% B · A WINS`;

      // Charts
      drawTrace("#fs-pressure", [
        { f: FS.A, pts: pressureCurve(FS.A), cls: "a" },
        { f: FS.B, pts: pressureCurve(FS.B), cls: "b" },
      ], showA, showB, {
        yLabel: "Pa", xLabel: "TIME → END OF LIFE",
        yMax: 240, yTicks: [0, 50, 100, 150, 200],
        threshold: 200,  // amber threshold
      });
      drawTrace("#fs-pm", [
        { f: FS.A, pts: pmCurve(FS.A), cls: "a" },
        { f: FS.B, pts: pmCurve(FS.B), cls: "b" },
      ], showA, showB, {
        yLabel: "µg/m³", xLabel: "TIME → STEADY STATE",
        yMax: 0.22, yTicks: [0, 0.05, 0.10, 0.15, 0.20],
        threshold: 0.18,
      });
    }

    function drawTrace(sel, series, showA, showB, opts) {
      const svg = d3.select(sel);
      svg.selectAll("*").remove();
      const W = 480, H = 240;
      const m = { l: 38, r: 14, t: 12, b: 28 };
      svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");

      const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain([0, opts.yMax]).range([H - m.b, m.t]);

      // grid + ticks
      const g = svg.append("g").attr("class", "grid");
      opts.yTicks.forEach((t) => {
        g.append("line")
          .attr("x1", m.l).attr("x2", W - m.r)
          .attr("y1", y(t)).attr("y2", y(t));
        svg.append("text")
          .attr("class", "axis-text")
          .attr("font-family", "JetBrains Mono")
          .attr("font-size", 9)
          .attr("fill", "rgba(155,175,198,0.55)")
          .attr("x", m.l - 6).attr("y", y(t) + 3)
          .attr("text-anchor", "end")
          .text(t.toString());
      });
      // x ticks (mono)
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
        svg.append("line")
          .attr("x1", x(t)).attr("x2", x(t))
          .attr("y1", H - m.b).attr("y2", H - m.b + 4)
          .attr("stroke", "rgba(170,200,230,0.22)");
        svg.append("text")
          .attr("font-family", "JetBrains Mono")
          .attr("font-size", 9)
          .attr("fill", "rgba(155,175,198,0.55)")
          .attr("x", x(t))
          .attr("y", H - m.b + 14)
          .attr("text-anchor", "middle")
          .text(t === 0 ? "T0" : t === 1 ? "T1" : t.toFixed(2));
      });

      // axis labels
      svg.append("text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 8.5)
        .attr("letter-spacing", "0.08em")
        .attr("fill", "rgba(155,175,198,0.5)")
        .attr("x", m.l).attr("y", 10)
        .text(opts.yLabel.toUpperCase());
      svg.append("text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 8.5)
        .attr("letter-spacing", "0.08em")
        .attr("fill", "rgba(155,175,198,0.5)")
        .attr("x", W - m.r).attr("y", H - 4)
        .attr("text-anchor", "end")
        .text(opts.xLabel.toUpperCase());

      // amber threshold dashed
      svg.append("line")
        .attr("class", "threshold")
        .attr("x1", m.l).attr("x2", W - m.r)
        .attr("y1", y(opts.threshold)).attr("y2", y(opts.threshold));
      svg.append("text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 9)
        .attr("fill", "var(--sig-amber)")
        .attr("opacity", 0.85)
        .attr("x", W - m.r - 4)
        .attr("y", y(opts.threshold) - 3)
        .attr("text-anchor", "end")
        .text("THRESH");

      const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]))
        .curve(d3.curveMonotoneX);
      const area = d3.area()
        .x(d => x(d[0]))
        .y0(H - m.b)
        .y1(d => y(d[1]))
        .curve(d3.curveMonotoneX);

      // areas (subtle) + lines
      series.forEach((s) => {
        const visible = (s.cls === "a" && showA) || (s.cls === "b" && showB);
        if (!visible) return;
        svg.append("path")
          .attr("class", "area area--" + s.cls)
          .attr("d", area(s.pts));
        svg.append("path")
          .attr("class", "line line--" + s.cls)
          .attr("d", line(s.pts));

        // final value marker
        const last = s.pts[s.pts.length - 1];
        svg.append("circle")
          .attr("cx", x(last[0])).attr("cy", y(last[1]))
          .attr("r", 3)
          .attr("fill", s.cls === "a" ? "var(--sig-ok)" : "var(--sig-amber)")
          .attr("stroke", "var(--bg-1)").attr("stroke-width", 1);
      });
    }

    $$(".panel--fs .seg--fs .seg__b").forEach((b) =>
      b.addEventListener("click", () => setActive(b.dataset.fs))
    );
    setActive("AB");
  })();

  // ============================================================ MATRIX (decision surface)
  // The heatmap is rendered fluidly — measure the SVG's container, set the
  // viewBox to match, and draw cells from measured dimensions. preserveAspectRatio
  // is intentionally NOT set to "none" (was distorting cells); the surface stays
  // in proportion. Y-axis is conventional: HIGH HVAC efficiency at the TOP, low at
  // the bottom. Best operating regime is therefore top-left (low U + high η).
  (function matrix() {
    if (typeof d3 === "undefined") return;
    const svg = d3.select("#mx-heat");
    if (svg.empty()) return;
    const svgEl = svg.node();

    // 8 × 6 surface: U-value × HVAC efficiency
    const COLS = 8;  // U-value: 0.5 → 1.6 W/m²K (left = best envelope)
    const ROWS = 6;  // HVAC eff: 0.55 → 0.90    (top = best HVAC efficiency)
    const us = d3.range(COLS).map(i => 0.5 + (i / (COLS - 1)) * 1.1);
    const effs = d3.range(ROWS).map(i => 0.55 + (i / (ROWS - 1)) * 0.35);

    // Baseline EUI (kWh/m²)
    const BASE_EUI = 720;
    // Scenarios: model deltas applied to surface
    const SCEN = {
      baseline:   { dU: 0,    dEff: 0,    label: "Baseline",   pctMax: 0.4,  stack: "Baseline" },
      envelope:   { dU: -0.4, dEff: 0,    label: "+ Envelope", pctMax: 1.0,  stack: "Baseline + envelope" },
      setpoints:  { dU: 0,    dEff: 0.05, label: "+ Setpoints", pctMax: 1.3,  stack: "Baseline + setpoint tune" },
      all:        { dU: -0.4, dEff: 0.08, label: "+ All",      pctMax: 2.0,  stack: "Baseline + envelope + setpoint + HVAC" }
    };

    // Surface generator — deterministic, scenario-shifted. Returns the data
    // grid in DATA ORIENTATION: row 0 = lowest efficiency, row ROWS-1 = highest.
    // The renderer flips rows so the highest efficiency is drawn at the top.
    function surface(scen) {
      const grid = [];
      let min = Infinity, max = -Infinity, minIdx = [0, 0]; // [col, dataRow]
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          const u = us[c] + scen.dU;
          const eff = effs[r] + scen.dEff;
          // EUI model: linear in U, inverse in efficiency
          const eui = BASE_EUI * (0.65 + 0.3 * Math.max(0.2, u) / 1.6) / Math.max(0.55, eff);
          row.push(eui);
          if (eui < min) { min = eui; minIdx = [c, r]; }
          if (eui > max) { max = eui; }
        }
        grid.push(row);
      }
      return { grid, min, max, minIdx };
    }

    let lastScenKey = "baseline";

    function render(scenKey) {
      lastScenKey = scenKey;
      const scen = SCEN[scenKey];
      const s = surface(scen);

      // Measure the rendered SVG width and set viewBox to match — no aspect
      // distortion. Height held to a fixed editorial proportion of the width
      // so cells stay close to square at typical container widths.
      const rect = svgEl.getBoundingClientRect();
      const W = Math.max(560, Math.round(rect.width || 720));
      const H = Math.min(420, Math.max(320, Math.round(W * 0.42)));
      svg.attr("viewBox", `0 0 ${W} ${H}`);

      const m = { l: 84, r: 152, t: 22, b: 56 };
      const drawW = W - m.l - m.r;
      const drawH = H - m.t - m.b;
      const cellW = drawW / COLS;
      const cellH = drawH / ROWS;

      const color = d3.scaleSequential()
        .domain([s.max, s.min])  // reversed so dark = high EUI (worst), light = low EUI (best)
        .interpolator(d3.interpolateRgbBasis([
          "#0e1620",        // worst → near-black navy
          "#1b3242",
          "#2c6c84",
          "#4fc3a8",
          "#a5ffd9"         // best → primary accent
        ]));

      svg.selectAll("*").remove();

      // surface cells — flip row index so highest efficiency draws at TOP
      // (data row 0 = lowest eff renders at display row ROWS-1 = bottom).
      const flipRow = (dataR) => ROWS - 1 - dataR;
      const minDisplayR = flipRow(s.minIdx[1]);
      for (let dataR = 0; dataR < ROWS; dataR++) {
        const displayR = flipRow(dataR);
        for (let c = 0; c < COLS; c++) {
          const v = s.grid[dataR][c];
          svg.append("rect")
            .attr("class", "cell" + ((c === s.minIdx[0] && dataR === s.minIdx[1]) ? " is-min" : ""))
            .attr("x", m.l + c*cellW + 0.5)
            .attr("y", m.t + displayR*cellH + 0.5)
            .attr("width", cellW - 1)
            .attr("height", cellH - 1)
            .attr("fill", color(v));
        }
      }

      // axes
      // x-axis: U-value labels (left = low/good, right = high/bad)
      us.forEach((u, c) => {
        svg.append("text")
          .attr("class", "axis-text")
          .attr("font-family", "JetBrains Mono")
          .attr("font-size", 10)
          .attr("font-variant-numeric", "tabular-nums")
          .attr("fill", "rgba(180,200,220,0.78)")
          .attr("x", m.l + c*cellW + cellW/2)
          .attr("y", m.t + drawH + 14)
          .attr("text-anchor", "middle")
          .text(u.toFixed(2));
      });
      // y-axis: HVAC efficiency labels — TOP shows highest eff, BOTTOM shows lowest
      effs.forEach((e, dataR) => {
        const displayR = flipRow(dataR);
        svg.append("text")
          .attr("class", "axis-text")
          .attr("font-family", "JetBrains Mono")
          .attr("font-size", 10)
          .attr("font-variant-numeric", "tabular-nums")
          .attr("fill", "rgba(180,200,220,0.78)")
          .attr("x", m.l - 10)
          .attr("y", m.t + displayR*cellH + cellH/2 + 3.5)
          .attr("text-anchor", "end")
          .text(e.toFixed(2));
      });

      // axis titles
      svg.append("text")
        .attr("class", "axis-title")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 9.5)
        .attr("letter-spacing", "0.16em")
        .attr("fill", "rgba(180,200,220,0.8)")
        .attr("x", m.l + drawW/2)
        .attr("y", H - 22)
        .attr("text-anchor", "middle")
        .text("ENVELOPE U-VALUE · W/m²K");
      // "good ← → bad" direction marker on X axis
      svg.append("text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 8.5)
        .attr("letter-spacing", "0.18em")
        .attr("fill", "rgba(108,243,200,0.7)")
        .attr("x", m.l)
        .attr("y", H - 8)
        .attr("text-anchor", "start")
        .text("← BETTER");
      svg.append("text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 8.5)
        .attr("letter-spacing", "0.18em")
        .attr("fill", "rgba(180,200,220,0.5)")
        .attr("x", m.l + drawW)
        .attr("y", H - 8)
        .attr("text-anchor", "end")
        .text("WORSE →");

      // y-axis title (rotated, sits left of the y-axis numerics)
      svg.append("text")
        .attr("class", "axis-title")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 9.5)
        .attr("letter-spacing", "0.16em")
        .attr("fill", "rgba(180,200,220,0.8)")
        .attr("transform", `translate(${m.l - 56}, ${m.t + drawH/2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .text("HVAC EFFICIENCY · η");
      // "↑ better" indicator at top of y-axis
      svg.append("text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 8.5)
        .attr("letter-spacing", "0.18em")
        .attr("fill", "rgba(108,243,200,0.7)")
        .attr("transform", `translate(${m.l - 38}, ${m.t + 6}) rotate(-90)`)
        .attr("text-anchor", "end")
        .text("BETTER ↑");

      // marker at min — translate dataRow → displayRow
      const mx = m.l + s.minIdx[0]*cellW + cellW/2;
      const my = m.t + minDisplayR*cellH + cellH/2;
      // crosshair
      svg.append("line").attr("class", "marker")
        .attr("x1", mx - 10).attr("x2", mx + 10).attr("y1", my).attr("y2", my);
      svg.append("line").attr("class", "marker")
        .attr("x1", mx).attr("x2", mx).attr("y1", my - 10).attr("y2", my + 10);
      svg.append("circle").attr("class", "marker")
        .attr("cx", mx).attr("cy", my).attr("r", 8);

      // marker label
      const lblX = mx + 14;
      const lblY = my - 14;
      svg.append("rect").attr("class", "marker-bg")
        .attr("x", lblX).attr("y", lblY - 12).attr("rx", 1).attr("ry", 1)
        .attr("width", 96).attr("height", 28);
      svg.append("text").attr("class", "marker-text")
        .attr("x", lblX + 6).attr("y", lblY + 0)
        .text("MIN · " + Math.round(s.min) + " kWh/m²");
      svg.append("text").attr("class", "marker-text")
        .attr("x", lblX + 6).attr("y", lblY + 12)
        .attr("opacity", 0.7)
        .text("ΔEUI " + Math.round(s.max - s.min) + " kWh/m²");

      // legend gradient
      const legX = W - m.r + 30;
      const legY = m.t + 10;
      const legH = drawH - 20;
      const grad = svg.append("defs").append("linearGradient").attr("id", "mx-grad").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
      const stops = [
        [0, "#a5ffd9"], [0.25, "#6cf3c8"], [0.55, "#3a8b9a"], [0.8, "#28455a"], [1, "#1b2330"]
      ];
      stops.forEach((st) => {
        grad.append("stop").attr("offset", (st[0]*100) + "%").attr("stop-color", st[1]);
      });
      svg.append("rect")
        .attr("x", legX).attr("y", legY)
        .attr("width", 14).attr("height", legH)
        .attr("fill", "url(#mx-grad)")
        .attr("stroke", "rgba(170,200,230,0.18)").attr("stroke-width", 0.5);
      svg.append("text").attr("class", "legend-text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 9)
        .attr("fill", "rgba(155,175,198,0.7)")
        .attr("x", legX + 18).attr("y", legY + 8)
        .text(Math.round(s.min) + " kWh/m²");
      svg.append("text").attr("class", "legend-text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 9)
        .attr("fill", "rgba(155,175,198,0.7)")
        .attr("x", legX + 18).attr("y", legY + legH)
        .text(Math.round(s.max) + " kWh/m²");
      svg.append("text").attr("class", "legend-text")
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", 8.5)
        .attr("letter-spacing", "0.08em")
        .attr("fill", "rgba(155,175,198,0.55)")
        .attr("x", legX + 18).attr("y", legY + legH/2)
        .text("EUI →");

      // Update readouts (deterministic; scenario.pctMax is the headline)
      const baselineMin = surface(SCEN.baseline).min;
      // pct savings vs baseline minimum
      const pct = Math.max(0, ((baselineMin - s.min) / baselineMin) * 100);
      // cap visible savings at scen.pctMax for honest UX (matches brief)
      const reported = Math.min(scen.pctMax, pct);
      $("#mx-savings-pct").textContent = reported.toFixed(2);
      // cost — at $0.18/kWh, 280 MW IT × 8760h × PUE simplification
      const annualKwh = 280 * 1000 * 8760 * 1.1; // ~2.7 GWh
      const annualCost = annualKwh * 0.18;
      const costSav = Math.round(annualCost * (reported / 100));
      $("#mx-savings-usd").textContent = fmt.int(costSav);
      // CO2 — assume 0.42 t / MWh marginal
      $("#mx-co2").textContent = fmt.int((annualKwh / 1000) * 0.42 * (reported / 100));
      $("#mx-stack").textContent = scen.stack;

      const lbl = $("#mx-scenario-lbl");
      if (lbl) lbl.textContent = scen.label.replace("+ ", "").trim() || "Baseline";

      // bars
      $("#mx-bar-pct").style.right = (100 - (reported / 2.0) * 100) + "%";
      $("#mx-bar-usd").style.right = (100 - (reported / 2.0) * 100) + "%";
      $("#mx-bar-co2").style.right = (100 - (reported / 2.0) * 100) + "%";
    }

    $$(".panel--mx .seg--mx .seg__b").forEach((b) =>
      b.addEventListener("click", () => {
        $$(".panel--mx .seg--mx .seg__b").forEach(x => x.classList.toggle("is-active", x === b));
        render(b.dataset.scenario);
      })
    );
    render("baseline");

    // Redraw on container resize (rAF-debounced) so cells stay in proportion.
    if (typeof ResizeObserver !== "undefined") {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = 0; render(lastScenKey); });
      });
      ro.observe(svgEl);
    }
  })();

  // ============================================================ MOD-06 · H.E.A.A.L.
  (function heaal() {
    if (typeof d3 === "undefined") return;

    // Three floors of deterministic snapshot data (NOT live).
    // Same calc path drives gauge, tiles, grid.
    const FLOORS = {
      1: {
        tvoc: 165, pm25: 9.8, t: 21.9, rh: 45, co2: 580,
        seed: 31,
        // tile pip levels
        pips: { tvoc: "ok", pm25: "ok", trh: "ok", co2: "ok" },
        deltas: { tvoc: "Δ +2.1", pm25: "Δ −0.4", trh: "in band", co2: "Δ +12" }
      },
      2: {
        tvoc: 142, pm25: 11.4, t: 21.4, rh: 42, co2: 612,
        seed: 47,
        pips: { tvoc: "ok", pm25: "warn", trh: "ok", co2: "ok" },
        deltas: { tvoc: "Δ −4.1", pm25: "Δ +0.3", trh: "in band", co2: "Δ −22" }
      },
      3: {
        tvoc: 198, pm25: 13.5, t: 22.6, rh: 39, co2: 745,
        seed: 71,
        pips: { tvoc: "warn", pm25: "bad", trh: "warn", co2: "ok" },
        deltas: { tvoc: "Δ +9.4", pm25: "Δ +1.8", trh: "drift", co2: "Δ +38" }
      }
    };

    function computeScore(f) {
      // simple, deterministic weighted score 0-100
      // Lower is better for tvoc, pm25, co2; closer-to-setpoint better for T/RH.
      const sTvoc = clamp(100 - (f.tvoc / 500) * 100, 0, 100);
      const sPm   = clamp(100 - (f.pm25 / 15) * 100, 0, 100);
      const sCo2  = clamp(100 - ((f.co2 - 400) / 700) * 100, 0, 100);
      // T target 22.5; RH target 45
      const sT    = clamp(100 - Math.abs(f.t - 22.5) * 12, 0, 100);
      const sRh   = clamp(100 - Math.abs(f.rh - 45) * 2.4, 0, 100);
      const w = (sTvoc * 0.2) + (sPm * 0.3) + (sCo2 * 0.2) + (sT * 0.15) + (sRh * 0.15);
      return Math.round(w);
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function drawGauge(svgSel, score) {
      const sel = d3.select(svgSel);
      sel.selectAll("*").remove();
      const W = 200, H = 120;
      const cx = W/2, cy = H - 12, R = 86, sw = 6;
      // arc background half-circle
      const arcGen = d3.arc().innerRadius(R - sw).outerRadius(R).startAngle(-Math.PI/2).endAngle(Math.PI/2);
      sel.append("path").attr("d", arcGen()).attr("class", "arc-bg").attr("transform", `translate(${cx}, ${cy})`);
      // foreground
      const arcFg = d3.arc().innerRadius(R - sw).outerRadius(R).startAngle(-Math.PI/2).endAngle(-Math.PI/2 + Math.PI * (score / 100));
      sel.append("path").attr("d", arcFg()).attr("class", "arc-fg").attr("transform", `translate(${cx}, ${cy})`);
      // tick marks
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI/2 + (Math.PI * i / 10);
        const r1 = R + 3;
        const r2 = R + 8;
        sel.append("line")
          .attr("class", "arc-tick")
          .attr("x1", cx + Math.cos(a) * r1)
          .attr("y1", cy + Math.sin(a) * r1)
          .attr("x2", cx + Math.cos(a) * r2)
          .attr("y2", cy + Math.sin(a) * r2);
      }
      // labels
      sel.append("text").attr("font-family", "JetBrains Mono").attr("font-size", 9)
        .attr("fill", "rgba(155,175,198,0.6)")
        .attr("x", cx - R - 6).attr("y", cy + 4).attr("text-anchor", "middle").text("0");
      sel.append("text").attr("font-family", "JetBrains Mono").attr("font-size", 9)
        .attr("fill", "rgba(155,175,198,0.6)")
        .attr("x", cx + R + 6).attr("y", cy + 4).attr("text-anchor", "middle").text("100");
    }

    function drawSpark(svgEl, baseline, seed) {
      // deterministic 14-point spark, stable across re-renders
      const r = rng(seed);
      const N = 14;
      const pts = [];
      for (let i = 0; i < N; i++) {
        // Drift around baseline by up to 8%
        const v = baseline * (0.92 + r() * 0.16);
        pts.push([i, v]);
      }
      const W = 140, H = 36;
      const x = d3.scaleLinear().domain([0, N-1]).range([2, W - 2]);
      const ext = d3.extent(pts, d => d[1]);
      const pad = (ext[1] - ext[0]) * 0.2 || 1;
      const y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).range([H - 4, 4]);
      const line = d3.line().x(d => x(d[0])).y(d => y(d[1])).curve(d3.curveMonotoneX);
      const sel = d3.select(svgEl);
      sel.selectAll("*").remove();
      sel.append("path").attr("d", line(pts)).attr("class", "ln");
      // last point dot
      const last = pts[pts.length - 1];
      sel.append("circle")
        .attr("cx", x(last[0])).attr("cy", y(last[1])).attr("r", 1.5)
        .attr("fill", "currentColor");
    }

    function drawGrid(f) {
      const grid = $("#hl-grid");
      grid.innerHTML = "";
      // 18 × 6 = 108 cells (sensor grid).
      const cols = 18, rows = 6;
      const r = rng(f.seed);
      const score = computeScore(f);
      for (let i = 0; i < cols * rows; i++) {
        const div = document.createElement("div");
        const v = r();
        // Probability of each state depends on overall score.
        let cls = "hl__cell";
        const okT = score / 100 - 0.05;
        const warnT = okT + 0.18;
        if (v < okT)        cls += " is-ok";
        else if (v < warnT) cls += " is-warn";
        else if (v < warnT + 0.06) cls += " is-bad";
        div.className = cls;
        grid.appendChild(div);
      }
    }

    function setFloor(f) {
      const data = FLOORS[f];
      const floorLbl = $("#hl-floor-lbl");
      if (floorLbl) floorLbl.textContent = "Floor " + f;
      $$(".panel--hl [data-hl-floor]").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.hlFloor === String(f))
      );
      const score = computeScore(data);
      $("#hl-score").textContent = score;
      drawGauge("#hl-gauge", score);

      $("#tile-tvoc").textContent = fmt.int(data.tvoc);
      $("#tile-pm25").textContent = data.pm25.toFixed(1);
      $("#tile-t").textContent    = data.t.toFixed(1);
      $("#tile-rh").textContent   = String(Math.round(data.rh));
      $("#tile-co2").textContent  = fmt.int(data.co2);
      $("#tile-tvoc-d").textContent = data.deltas.tvoc;
      $("#tile-pm25-d").textContent = data.deltas.pm25;
      $("#tile-trh-d").textContent  = data.deltas.trh;
      $("#tile-co2-d").textContent  = data.deltas.co2;

      // pips
      const pipMap = { ok: "pip--ok", warn: "pip--warn", bad: "pip--bad" };
      ["tvoc", "pm25", "trh", "co2"].forEach((m) => {
        const el = document.querySelector(`.tile[data-metric="${m}"] .tile__pip`);
        if (el) {
          el.className = "tile__pip " + pipMap[data.pips[m]];
        }
      });

      // sparks
      const sparks = $$(".tile__spark");
      const baselines = [data.tvoc, data.pm25, data.t, data.co2];
      const seeds = [data.seed + 1, data.seed + 2, data.seed + 3, data.seed + 4];
      sparks.forEach((sp, i) => drawSpark(sp, baselines[i], seeds[i]));

      drawGrid(data);
    }

    $$(".panel--hl [data-hl-floor]").forEach((b) =>
      b.addEventListener("click", () => setFloor(parseInt(b.dataset.hlFloor, 10)))
    );
    setFloor(2);
  })();

})();
