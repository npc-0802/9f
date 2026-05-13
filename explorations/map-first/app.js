/* ===========================================================================
   9 Foundations — Map-first / Data-led exploration
   Single calculation path: filterState → activeSet → every readout/dot/chip.
   =========================================================================== */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DATA = window.NINEF_DATA || { sites: [], summary: {} };
  const SITES = Array.isArray(DATA.sites) ? DATA.sites.slice() : [];

  /* -----------------------------------------------------------------
   * Number formatters
   * ----------------------------------------------------------------- */
  const fmtInt = d3 ? d3.format(",d") : (n) => String(Math.round(n));
  const fmt1   = d3 ? d3.format(",.1f") : (n) => (Math.round(n * 10) / 10).toFixed(1);
  const fmt2M  = (n) => (n / 1_000_000).toFixed(1) + "M";
  function fmtMW(mw) {
    if (mw >= 1000) return fmt1(mw / 1000) + " GW";
    return fmtInt(mw) + " MW";
  }

  /* -----------------------------------------------------------------
   * Bounds for IT load
   * ----------------------------------------------------------------- */
  const itLoadMax = Math.ceil(SITES.reduce((m, s) => Math.max(m, s.it_mw || 0), 0));
  const itLoadMin = 0;

  /* -----------------------------------------------------------------
   * Filter state — SINGLE source of truth
   * ----------------------------------------------------------------- */
  const state = {
    status: "all",   // all | existing | planned
    system: "all",   // all | DLC | DEC
    loadLo: itLoadMin,
    loadHi: itLoadMax,
    activeSiteId: null,
    fsMode: "AB",
    mxScenario: "baseline",
    hlFloor: 2,
  };

  function siteMatches(s) {
    if (state.status !== "all" && s.status !== state.status) return false;
    if (state.system !== "all" && s.system !== state.system) return false;
    const load = s.it_mw || 0;
    if (load < state.loadLo) return false;
    if (load > state.loadHi) return false;
    return true;
  }

  function activeSites() {
    return SITES.filter(siteMatches);
  }

  /* -----------------------------------------------------------------
   * COUNT TABLE (computed once per state change; everything reads from this)
   *
   * Counts shown on each chip = count of sites that would be visible if
   * THAT chip were the active value of its own dimension, holding all
   * OTHER dimensions at their current state. (Datawrapper / Mapbox
   * convention: chip counts answer "what would I see if I clicked this?".)
   * ----------------------------------------------------------------- */
  function matchExcept(s, exclude) {
    if (exclude !== "status" && state.status !== "all" && s.status !== state.status) return false;
    if (exclude !== "system" && state.system !== "all" && s.system !== state.system) return false;
    if (exclude !== "load") {
      const load = s.it_mw || 0;
      if (load < state.loadLo || load > state.loadHi) return false;
    }
    return true;
  }

  function recompute() {
    const active = activeSites();
    const t = {
      count: active.length,
      total: SITES.length,
      itLoad: 0,
      floorM2: 0,
      filters: 0,
      byStatus: { all: 0, existing: 0, planned: 0 },
      bySystem: { all: 0, DLC: 0, DEC: 0 },
    };
    for (const s of active) {
      t.itLoad += s.it_mw || 0;
      t.floorM2 += s.floor_m2 || 0;
      t.filters += s.filters || 0;
    }
    // chip counts hold OTHER dims constant
    for (const s of SITES) {
      if (matchExcept(s, "status")) {
        t.byStatus.all += 1;
        if (s.status === "existing") t.byStatus.existing += 1;
        if (s.status === "planned")  t.byStatus.planned += 1;
      }
      if (matchExcept(s, "system")) {
        t.bySystem.all += 1;
        if (s.system === "DLC") t.bySystem.DLC += 1;
        if (s.system === "DEC") t.bySystem.DEC += 1;
      }
    }
    return { active, totals: t };
  }

  /* -----------------------------------------------------------------
   * MAP RENDERING
   * ----------------------------------------------------------------- */
  const mapEl = document.getElementById("stage-map");
  const svgEl = document.getElementById("va-map");
  let svg, gOutline, gPoints, gPulse, projection;

  const VA_BBOX = {
    type: "Polygon",
    coordinates: [[
      [-83.7, 36.5], [-75.2, 36.5], [-75.2, 39.5], [-83.7, 39.5], [-83.7, 36.5]
    ]]
  };

  let radiusScale;

  function buildRadiusScale() {
    if (typeof d3 === "undefined") return () => 4;
    const max = d3.max(SITES, (d) => d.it_mw) || 1;
    return d3.scaleSqrt().domain([0, max]).range([1.6, 9.4]);
  }

  function initMap() {
    if (typeof d3 === "undefined" || typeof topojson === "undefined") {
      console.warn("[9F] d3/topojson missing; map skipped");
      return;
    }

    radiusScale = buildRadiusScale();
    svg = d3.select(svgEl);

    const sources = [
      "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json",
      "https://unpkg.com/us-atlas@3.0.1/states-10m.json"
    ];
    const counties = [
      "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json",
      "https://unpkg.com/us-atlas@3.0.1/counties-10m.json"
    ];

    fetchFirst(sources).then((us) => {
      let va = null;
      if (us) {
        const states = topojson.feature(us, us.objects.states);
        va = states.features.find((f) => f.id === "51");
      }
      return Promise.all([va, fetchFirst(counties).catch(() => null)]);
    }).then(([va, cntopo]) => {
      let countyShapes = null;
      if (cntopo) {
        try {
          const cnt = topojson.feature(cntopo, cntopo.objects.counties);
          countyShapes = cnt.features.filter((f) => String(f.id).startsWith("51"));
        } catch (e) { /* ignore */ }
      }
      drawMap(va, countyShapes);
    }).catch((err) => {
      console.warn("[9F] map geometry failed; falling back to points-only", err);
      drawMap(null, null);
    });
  }

  function fetchFirst(urls) {
    return urls.reduce((p, url) => p.catch(() => fetch(url, { mode: "cors" }).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })), Promise.reject());
  }

  let cachedVA, cachedCounties;

  function drawMap(va, countyShapes) {
    cachedVA = va;
    cachedCounties = countyShapes;
    const rect = mapEl.getBoundingClientRect();
    const W = Math.max(rect.width, 480);
    const H = Math.max(rect.height, 360);

    svg.attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();

    // Background grid (graticule-ish — just a subtle reticule)
    const gridG = svg.append("g").attr("class", "va-grid");
    const ticksX = 6, ticksY = 4;
    for (let i = 0; i <= ticksX; i++) {
      gridG.append("line")
        .attr("x1", (W / ticksX) * i).attr("x2", (W / ticksX) * i)
        .attr("y1", 0).attr("y2", H);
    }
    for (let j = 0; j <= ticksY; j++) {
      gridG.append("line")
        .attr("y1", (H / ticksY) * j).attr("y2", (H / ticksY) * j)
        .attr("x1", 0).attr("x2", W);
    }

    // Coordinate label (single, top-left)
    gridG.append("text").attr("x", 8).attr("y", 12).text("LAT 36.5 – 39.5 N");
    gridG.append("text").attr("x", 8).attr("y", H - 6).text("LON -83.7 – -75.2 W");

    // Outline
    if (va) {
      projection = d3.geoMercator().fitExtent([[28, 30], [W - 28, H - 30]], va);
      const path = d3.geoPath(projection);

      // glow underlay
      svg.append("path")
        .attr("class", "va-outline-glow")
        .attr("d", path(va));

      // counties (very faint)
      if (countyShapes && countyShapes.length) {
        svg.append("g")
          .selectAll("path")
          .data(countyShapes)
          .join("path")
          .attr("class", "va-counties")
          .attr("d", path);
      }

      svg.append("path")
        .attr("class", "va-outline")
        .attr("d", path(va));
    } else {
      projection = d3.geoMercator().fitExtent([[28, 30], [W - 28, H - 30]], VA_BBOX);
    }

    // Pulse layer
    gPulse = svg.append("g").attr("class", "va-pulse-layer");
    gPulse.append("circle").attr("class", "va-pulse").attr("id", "va-pulse-1");
    gPulse.append("circle").attr("class", "va-pulse").attr("id", "va-pulse-2");

    // Points
    gPoints = svg.append("g").attr("class", "va-points");
    const points = gPoints.selectAll("circle")
      .data(SITES, (d) => d.id)
      .join("circle")
      .attr("class", (d) => `va-point is-${d.status}`)
      .attr("data-id", (d) => d.id)
      .attr("cx", (d) => projection([d.lng, d.lat])[0])
      .attr("cy", (d) => projection([d.lng, d.lat])[1])
      .attr("r", (d) => radiusScale(d.it_mw || 0))
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${d.id} · ${d.county} County · ${fmtMW(d.it_mw)}`)
      .on("mouseenter", (ev, d) => {
        if (state.activeSiteId === d.id) return;
        setActiveSite(d.id, false);
      })
      .on("click", (ev, d) => setActiveSite(d.id, true))
      .on("focus", (ev, d) => setActiveSite(d.id, false))
      .on("keydown", function (ev, d) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          setActiveSite(d.id, true);
        }
      });

    // Animated reveal — staggered fade-in
    if (!reduceMotion) {
      points
        .attr("fill-opacity", 0)
        .transition()
        .delay((d, i) => 200 + (i * 4))
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr("fill-opacity", 0.85);
    }

    // Initial: pick a meaningful anchor for the archetype (largest planned DLC or first planned DLC)
    let anchor = SITES.filter((s) => s.status === "planned" && s.system === "DLC").sort((a, b) => (b.it_mw || 0) - (a.it_mw || 0))[0];
    if (!anchor) anchor = SITES[0];
    if (anchor) {
      bindArchetypeAnchor(anchor.id);
    }

    applyFilter(true);
  }

  // Resize handling — redraw map on container resize
  let resizeT;
  let firstResize = true;
  const resizeObserver = ("ResizeObserver" in window) ? new ResizeObserver(() => {
    // first call fires immediately on observe — skip it
    if (firstResize) { firstResize = false; return; }
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (cachedVA !== undefined || cachedCounties !== undefined) {
        // preserve current active site through redraw
        const keepActive = state.activeSiteId;
        drawMap(cachedVA, cachedCounties);
        if (keepActive) setActiveSite(keepActive, false);
      }
    }, 150);
  }) : null;

  if (resizeObserver && mapEl) resizeObserver.observe(mapEl);

  /* -----------------------------------------------------------------
   * SITE CARD + ACTIVE SITE
   * ----------------------------------------------------------------- */
  const siteCard = document.getElementById("site-card");
  const siteBody = document.getElementById("site-body");
  const siteClose = document.getElementById("site-close");
  const archAnchor = document.getElementById("anchor-archetype");

  function siteByID(id) { return SITES.find((s) => s.id === id); }

  function setActiveSite(id, pin) {
    const s = siteByID(id);
    if (!s) return;
    state.activeSiteId = id;

    // Update card
    siteCard.dataset.state = "open";
    siteBody.innerHTML = renderSiteDetail(s);

    // highlight on map
    if (gPoints) {
      gPoints.selectAll("circle").classed("is-active", (d) => d.id === id);
    }

    // pulse halos
    if (gPulse && projection) {
      const [cx, cy] = projection([s.lng, s.lat]);
      gPulse.selectAll("circle.va-pulse")
        .attr("cx", cx).attr("cy", cy)
        .classed("is-on", !reduceMotion);
    }

    // Honor the archetype-section promise: the per-building view that
    // follows the map IS the active site. The map dot click updates the
    // archetype readout (anchor id, IT load, system type, air fraction,
    // filter split) so the copy stays true under interaction.
    bindArchetypeAnchor(id);

    // hide hint after first interaction
    const hint = document.getElementById("stage-hint");
    if (hint) hint.classList.add("is-hidden");
  }

  function clearActiveSite() {
    state.activeSiteId = null;
    siteCard.dataset.state = "empty";
    siteBody.innerHTML = `<div class="site-card__empty">Hover or tap a point to inspect a modeled site. Every dot carries floor area, IT load, PUE, HVAC topology, and filter count — the parameterization that drives the energy and air-quality findings on this page.</div>`;
    if (gPoints) gPoints.selectAll("circle").classed("is-active", false);
    if (gPulse) gPulse.selectAll("circle.va-pulse").classed("is-on", false);
  }

  function renderSiteDetail(s) {
    const tag = s.status === "existing"
      ? `<span class="dd-tag dd-tag--existing">Existing</span>`
      : `<span class="dd-tag dd-tag--planned">Planned</span>`;
    const floor = fmtInt(s.floor_m2) + " m²";
    const sys = s.system === "DLC" ? "Direct liquid cooling" : (s.system === "DEC" ? "Direct evaporative cooling" : s.system);
    return `
      <div class="site-card__title">${s.id}</div>
      <div class="site-card__sub">${s.county} County · ${s.egrid}</div>
      <dl class="site-card__kv">
        <div><dt>Status</dt><dd>${tag}</dd></div>
        <div><dt>IT load</dt><dd>${fmtMW(s.it_mw)}</dd></div>
        <div><dt>PUE</dt><dd>${s.pue.toFixed(2)}</dd></div>
        <div><dt>System</dt><dd>${sys}</dd></div>
        <div><dt>Air fraction</dt><dd>${Math.round((s.air_frac || 0) * 100)}%</dd></div>
        <div><dt>Floor area</dt><dd>${floor}</dd></div>
        <div><dt>Ceiling</dt><dd>${(s.ceiling_m || 0).toFixed(1)} m</dd></div>
        <div><dt>Capacity</dt><dd>${fmtInt(s.capacity_m3s)} m³/s</dd></div>
        <div><dt>Filters</dt><dd>${fmtInt(s.filters)}</dd></div>
        <div><dt>Load band</dt><dd>${s.l_band}</dd></div>
        <div><dt>Lat / Lon</dt><dd>${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}</dd></div>
      </dl>
    `;
  }

  siteClose.addEventListener("click", clearActiveSite);
  archAnchor.addEventListener("click", () => {
    if (!state.activeSiteId) {
      // pick a sensible default anchor — first planned DLC
      const s = SITES.find((x) => x.status === "planned" && x.system === "DLC") || SITES[0];
      if (s) {
        setActiveSite(s.id, true);
        bindArchetypeAnchor(s.id);
      }
    } else {
      bindArchetypeAnchor(state.activeSiteId);
    }
    document.getElementById("archetype").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });

  function bindArchetypeAnchor(id) {
    const s = siteByID(id);
    if (!s) return;
    const elID = document.getElementById("arch-anchor");
    const elTitle = document.getElementById("arch-title");
    const elIT = document.getElementById("arch-it");
    const elSys = document.getElementById("arch-sys");
    const elAir = document.getElementById("arch-air");
    const elFilters = document.getElementById("arch-filters");
    if (elID) elID.textContent = s.id;
    if (elTitle) elTitle.textContent = (s.county || "Northern Virginia") + " archetype";
    if (elIT) elIT.textContent = fmtMW(s.it_mw);
    if (elSys) elSys.textContent = s.system === "DLC" ? "Direct liquid cooling (DLC)" : (s.system === "DEC" ? "Direct evaporative cooling (DEC)" : s.system);
    const af = Math.round((s.air_frac || 0) * 100);
    if (elAir) elAir.textContent = `${af}% air · ${100 - af}% liquid`;
    if (elFilters) elFilters.textContent = `${Math.round((s.filters || 0) * 0.19)} vent · ${Math.round((s.filters || 0) * 0.81)} recirc`;
  }

  /* -----------------------------------------------------------------
   * APPLY FILTER (single calculation path)
   * ----------------------------------------------------------------- */
  function applyFilter(initial) {
    const { active, totals } = recompute();
    const activeSet = new Set(active.map((s) => s.id));

    // Update dots
    if (gPoints) {
      gPoints.selectAll("circle.va-point")
        .classed("is-hidden", (d) => !activeSet.has(d.id));
    }

    // Update readouts
    setText("r-count", fmtInt(totals.count));
    setText("r-load", fmtInt(totals.itLoad));
    setText("r-floor", (totals.floorM2 / 1_000_000).toFixed(1));
    setText("r-filters", fmtInt(totals.filters));

    // Update chip counts — also reconciled with current state
    setText(qs("[data-count='status-all']"), fmtInt(totals.byStatus.all));
    setText(qs("[data-count='status-existing']"), fmtInt(totals.byStatus.existing));
    setText(qs("[data-count='status-planned']"), fmtInt(totals.byStatus.planned));
    setText(qs("[data-count='sys-DLC']"), fmtInt(totals.bySystem.DLC));
    setText(qs("[data-count='sys-DEC']"), fmtInt(totals.bySystem.DEC));

    // Range readout
    setText("range-lo", fmtInt(state.loadLo));
    setText("range-hi", fmtInt(state.loadHi));
    updateRangeFill();

    // If active site no longer in filter, clear (but only on filter change, not initial)
    if (!initial && state.activeSiteId && !activeSet.has(state.activeSiteId)) {
      clearActiveSite();
    }
  }

  function setText(idOrEl, val) {
    const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    if (el) el.textContent = val;
  }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

  /* -----------------------------------------------------------------
   * CHIP WIRING
   * ----------------------------------------------------------------- */
  qsa("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter, v = btn.dataset.value;
      state[f] = v;
      // toggle active class
      qsa(`[data-filter="${f}"]`).forEach((b) => b.classList.toggle("is-active", b === btn));
      applyFilter(false);
    });
  });

  /* -----------------------------------------------------------------
   * DUAL-THUMB RANGE
   * ----------------------------------------------------------------- */
  const rMin = document.getElementById("range-min");
  const rMax = document.getElementById("range-max");
  const rFill = document.getElementById("range-fill");
  const rReset = document.getElementById("range-reset");

  rMin.max = itLoadMax; rMin.value = 0;
  rMax.max = itLoadMax; rMax.value = itLoadMax;

  function updateRangeFill() {
    const lo = +rMin.value, hi = +rMax.value;
    const pctLo = (lo / itLoadMax) * 100;
    const pctHi = (hi / itLoadMax) * 100;
    rFill.style.left = pctLo + "%";
    rFill.style.right = (100 - pctHi) + "%";
  }

  function onRangeChange() {
    let lo = +rMin.value, hi = +rMax.value;
    if (lo > hi) {
      // swap visually
      if (this === rMin) lo = hi - 1;
      else hi = lo + 1;
      rMin.value = lo; rMax.value = hi;
    }
    state.loadLo = lo;
    state.loadHi = hi;
    applyFilter(false);
  }

  rMin.addEventListener("input", onRangeChange);
  rMax.addEventListener("input", onRangeChange);
  rReset.addEventListener("click", () => {
    rMin.value = 0; rMax.value = itLoadMax;
    state.loadLo = 0; state.loadHi = itLoadMax;
    applyFilter(false);
  });

  /* -----------------------------------------------------------------
   * ARCHETYPE DIAGRAM (deterministic particle layout)
   * ----------------------------------------------------------------- */
  function drawArchetype() {
    const svg = document.getElementById("arch-svg");
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 540, H = 380;

    // Building shell
    const shell = document.createElementNS(NS, "rect");
    shell.setAttribute("x", 130); shell.setAttribute("y", 90);
    shell.setAttribute("width", 320); shell.setAttribute("height", 220);
    shell.setAttribute("fill", "rgba(76,214,232,0.04)");
    shell.setAttribute("stroke", "rgba(76,214,232,0.4)");
    shell.setAttribute("stroke-width", 1);
    svg.appendChild(shell);

    // Filter bank — left wall
    const filt = document.createElementNS(NS, "rect");
    filt.setAttribute("x", 128); filt.setAttribute("y", 130);
    filt.setAttribute("width", 6); filt.setAttribute("height", 140);
    filt.setAttribute("fill", "rgba(244,184,64,0.5)");
    svg.appendChild(filt);

    const filtLabel = document.createElementNS(NS, "text");
    filtLabel.setAttribute("x", 60); filtLabel.setAttribute("y", 205);
    filtLabel.setAttribute("fill", "#f4b840");
    filtLabel.setAttribute("font-family", "IBM Plex Mono, monospace");
    filtLabel.setAttribute("font-size", "10");
    filtLabel.setAttribute("letter-spacing", "0.1em");
    filtLabel.textContent = "FILTER BANK";
    svg.appendChild(filtLabel);

    // Building label
    const buildLabel = document.createElementNS(NS, "text");
    buildLabel.setAttribute("x", 290); buildLabel.setAttribute("y", 76);
    buildLabel.setAttribute("fill", "#4cd6e8");
    buildLabel.setAttribute("font-family", "IBM Plex Mono, monospace");
    buildLabel.setAttribute("font-size", "10");
    buildLabel.setAttribute("letter-spacing", "0.1em");
    buildLabel.setAttribute("text-anchor", "middle");
    buildLabel.textContent = "DATA HALL · 24/7";
    svg.appendChild(buildLabel);

    // Server racks (subtle vertical lines)
    for (let i = 0; i < 8; i++) {
      const x = 180 + i * 30;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      line.setAttribute("y1", 130); line.setAttribute("y2", 270);
      line.setAttribute("stroke", "rgba(255,255,255,0.06)");
      line.setAttribute("stroke-width", 1);
      svg.appendChild(line);

      const rack = document.createElementNS(NS, "rect");
      rack.setAttribute("x", x - 8); rack.setAttribute("y", 200);
      rack.setAttribute("width", 16); rack.setAttribute("height", 40);
      rack.setAttribute("fill", "rgba(76,214,232,0.08)");
      rack.setAttribute("stroke", "rgba(76,214,232,0.2)");
      rack.setAttribute("stroke-width", 0.5);
      svg.appendChild(rack);
    }

    // Outdoor particles — left side, many
    function seedRand(seed) {
      let s = seed;
      return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    }
    const rand = seedRand(1337);

    const N_OUT = 80;
    for (let i = 0; i < N_OUT; i++) {
      const x = 10 + rand() * 110;
      const y = 60 + rand() * 280;
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y);
      c.setAttribute("r", 0.8 + rand() * 1.4);
      c.setAttribute("fill", "rgba(244,184,64,0.7)");
      svg.appendChild(c);

      // motion trail toward filter
      if (!reduceMotion && i % 4 === 0) {
        const anim = document.createElementNS(NS, "animateMotion");
        anim.setAttribute("path", `M0,0 L${130 - x},${190 - y}`);
        anim.setAttribute("dur", (6 + rand() * 8) + "s");
        anim.setAttribute("begin", -rand() * 5 + "s");
        anim.setAttribute("repeatCount", "indefinite");
        c.appendChild(anim);
      }
    }

    const N_IN = 12; // many fewer indoor — post-filter
    for (let i = 0; i < N_IN; i++) {
      const x = 145 + rand() * 290;
      const y = 130 + rand() * 140;
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y);
      c.setAttribute("r", 0.8 + rand() * 0.8);
      c.setAttribute("fill", "rgba(76,214,232,0.85)");
      svg.appendChild(c);
    }

    // Annotations
    function annotate(x, y, text, color) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.setAttribute("fill", color);
      t.setAttribute("font-family", "IBM Plex Mono, monospace");
      t.setAttribute("font-size", "9");
      t.setAttribute("letter-spacing", "0.08em");
      t.textContent = text;
      svg.appendChild(t);
    }
    annotate(14, 50, "OUTDOOR PM 6.49 µg/m³", "#f4b840");
    annotate(180, 320, "INDOOR PM (post-filter) · 0.17 µg/m³", "#4cd6e8");

    // arrow into filter
    const arr = document.createElementNS(NS, "path");
    arr.setAttribute("d", "M40,140 L120,180");
    arr.setAttribute("stroke", "rgba(244,184,64,0.4)");
    arr.setAttribute("stroke-width", 1);
    arr.setAttribute("stroke-dasharray", "3,3");
    arr.setAttribute("fill", "none");
    svg.appendChild(arr);
  }

  /* -----------------------------------------------------------------
   * FILTERSTUDIO — chart + metrics
   * ----------------------------------------------------------------- */
  // Approved comparative values (representative archetype, brief-approved):
  const FS = {
    A: { name: "Filter A", energy: 204096, press: 135.3, pm: 0.17, color: "#4cd6e8" },
    B: { name: "Filter B", energy: 318411, press: 217.8, pm: 0.12, color: "#a06bff" },
  };

  function fsApply() {
    const mode = state.fsMode;
    const a = FS.A, b = FS.B;
    const show = (id, v) => setText(id, v);

    // pressure-vs-time chart
    drawFSChart(mode);

    // toggle active button
    qsa("[data-fs]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.fs === mode));

    // Metrics block — show numeric for one filter, or comparative
    if (mode === "A") {
      show("fs-energy", fmtInt(a.energy)); show("fs-press", fmt1(a.press)); show("fs-pm", a.pm.toFixed(2));
      show("fs-energy-d", "Filter A · single filter"); show("fs-press-d", "Filter A · single filter"); show("fs-pm-d", "Filter A · single filter");
    } else if (mode === "B") {
      show("fs-energy", fmtInt(b.energy)); show("fs-press", fmt1(b.press)); show("fs-pm", b.pm.toFixed(2));
      show("fs-energy-d", "Filter B · single filter"); show("fs-press-d", "Filter B · single filter"); show("fs-pm-d", "Filter B · single filter");
    } else {
      show("fs-energy", fmtInt(a.energy)); show("fs-press", fmt1(a.press)); show("fs-pm", a.pm.toFixed(2));
      const eP = Math.round((1 - a.energy / b.energy) * 100);
      const pP = Math.round((1 - a.press / b.press) * 100);
      const pmP = Math.round((1 - b.pm / a.pm) * 100);
      show("fs-energy-d", `A wins · ${eP}% less`);
      show("fs-press-d", `A wins · ${pP}% less`);
      show("fs-pm-d", `B wins · ${pmP}% lower`);
    }
  }

  function drawFSChart(mode) {
    const svg = document.getElementById("fs-chart");
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 520, H = 220;
    const m = { l: 36, r: 16, t: 12, b: 36 };
    const innerW = W - m.l - m.r, innerH = H - m.t - m.b;

    // axes
    const ax = document.createElementNS(NS, "g");
    ax.setAttribute("transform", `translate(${m.l},${m.t})`);
    svg.appendChild(ax);

    // grid
    for (let i = 0; i <= 4; i++) {
      const y = (innerH / 4) * i;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", 0); line.setAttribute("x2", innerW);
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(255,255,255,0.06)");
      line.setAttribute("stroke-width", 1);
      ax.appendChild(line);
    }

    function curve(start, end, color, dashed) {
      const pts = [];
      const N = 60;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const x = t * innerW;
        // exponential-ish loading curve
        const y = innerH - (start + (end - start) * Math.pow(t, 1.6)) / 250 * innerH;
        pts.push([x, y]);
      }
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "1.8");
      if (dashed) path.setAttribute("stroke-dasharray", "4,4");
      path.setAttribute("opacity", "0.9");
      ax.appendChild(path);

      // end label
      const end_y = innerH - (end / 250) * innerH;
      const lbl = document.createElementNS(NS, "text");
      lbl.setAttribute("x", innerW + 2); lbl.setAttribute("y", end_y - 4);
      lbl.setAttribute("fill", color);
      lbl.setAttribute("font-family", "IBM Plex Mono, monospace");
      lbl.setAttribute("font-size", "10");
      lbl.setAttribute("text-anchor", "end");
      lbl.textContent = end.toFixed(0) + " Pa";
      ax.appendChild(lbl);
    }

    const showA = mode === "A" || mode === "AB";
    const showB = mode === "B" || mode === "AB";
    if (showA) curve(40, 135.3, FS.A.color, false);
    if (showB) curve(40, 217.8, FS.B.color, mode === "AB");

    // axis labels
    function label(x, y, text, anchor) {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.setAttribute("fill", "rgba(138,149,163,0.85)");
      t.setAttribute("font-family", "IBM Plex Mono, monospace");
      t.setAttribute("font-size", "9");
      t.setAttribute("text-anchor", anchor || "start");
      t.setAttribute("letter-spacing", "0.08em");
      t.textContent = text;
      svg.appendChild(t);
    }
    label(m.l, H - 8, "DUST LOAD →");
    label(28, m.t + innerH / 2, "Pa", "end");
    label(m.l, m.t - 2, "PRESSURE DROP");
  }

  qsa("[data-fs]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.fsMode = btn.dataset.fs;
      fsApply();
    });
  });

  /* -----------------------------------------------------------------
   * MATRIX — heatmap + readout
   * ----------------------------------------------------------------- */
  const MX = {
    baseline:  { pct: 0.0, usd: 0,     co2: 0,   bias: { u: 0, c: 0 } },
    envelope:  { pct: 1.1, usd: 21600, co2: 138, bias: { u: -0.18, c: 0 } },
    setpoints: { pct: 1.4, usd: 27400, co2: 175, bias: { u: 0,     c: 0.18 } },
    all:       { pct: 2.0, usd: 39200, co2: 248, bias: { u: -0.18, c: 0.18 } },
  };

  function mxApply() {
    const s = MX[state.mxScenario] || MX.baseline;
    setText("mx-pct", fmt1(s.pct));
    setText("mx-usd", fmtInt(s.usd));
    setText("mx-co2", fmtInt(s.co2));
    qsa("[data-scenario]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.scenario === state.mxScenario));
    drawHeatmap(s.bias);
  }

  function drawHeatmap(bias) {
    const svg = document.getElementById("mx-heat");
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 520, H = 280;
    const m = { l: 40, r: 28, t: 16, b: 32 };
    const innerW = W - m.l - m.r, innerH = H - m.t - m.b;
    const cols = 12, rows = 8;
    const cw = innerW / cols, ch = innerH / rows;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${m.l},${m.t})`);
    svg.appendChild(g);

    // find min for marker
    let minVal = Infinity, minIJ = [0, 0];
    const vals = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        // shifted minimum based on scenario bias
        const cx = (cols - 1) / 2 + (bias.u || 0) * cols;
        const cy = (rows - 1) / 2 + (bias.c || 0) * rows;
        const dx = (j - cx) / cols;
        const dy = (i - cy) / rows;
        const v = 80 + 220 * (dx * dx + dy * dy);
        row.push(v);
        if (v < minVal) { minVal = v; minIJ = [i, j]; }
      }
      vals.push(row);
    }

    // colors — cyan→violet ramp (low energy intensity = good = cyan)
    function ramp(v) {
      const t = Math.min(1, Math.max(0, (v - 80) / 220));
      const lerp = (a, b) => Math.round(a + (b - a) * t);
      const r = lerp(76, 160);   // cyan -> violet ascending R
      const gg = lerp(214, 107);
      const b = lerp(232, 255);
      return `rgb(${r},${gg},${b})`;
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const v = vals[i][j];
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", j * cw + 1);
        rect.setAttribute("y", i * ch + 1);
        rect.setAttribute("width", cw - 2);
        rect.setAttribute("height", ch - 2);
        rect.setAttribute("fill", ramp(v));
        rect.setAttribute("opacity", 0.18 + 0.42 * (1 - (v - 80) / 220));
        g.appendChild(rect);
      }
    }

    // marker on minimum
    const [mi, mj] = minIJ;
    const mx = mj * cw + cw / 2;
    const my = mi * ch + ch / 2;
    const cMark = document.createElementNS(NS, "circle");
    cMark.setAttribute("cx", mx); cMark.setAttribute("cy", my);
    cMark.setAttribute("r", 6);
    cMark.setAttribute("fill", "none");
    cMark.setAttribute("stroke", "#f4b840");
    cMark.setAttribute("stroke-width", 1.6);
    g.appendChild(cMark);

    const mCenter = document.createElementNS(NS, "circle");
    mCenter.setAttribute("cx", mx); mCenter.setAttribute("cy", my);
    mCenter.setAttribute("r", 2);
    mCenter.setAttribute("fill", "#f4b840");
    g.appendChild(mCenter);

    // marker label
    const tl = document.createElementNS(NS, "text");
    tl.setAttribute("x", mx + 12); tl.setAttribute("y", my - 6);
    tl.setAttribute("fill", "#f4b840");
    tl.setAttribute("font-family", "IBM Plex Mono, monospace");
    tl.setAttribute("font-size", "10");
    tl.textContent = `min ${minVal.toFixed(0)} kWh/m²`;
    g.appendChild(tl);

    // axis ticks
    function ax(x, y, t, anchor) {
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", x); text.setAttribute("y", y);
      text.setAttribute("fill", "rgba(138,149,163,0.85)");
      text.setAttribute("font-family", "IBM Plex Mono, monospace");
      text.setAttribute("font-size", "9");
      text.setAttribute("letter-spacing", "0.08em");
      if (anchor) text.setAttribute("text-anchor", anchor);
      text.textContent = t;
      svg.appendChild(text);
    }
    ax(m.l, H - 8, "ENVELOPE U-VALUE →");
    ax(28, m.t + innerH / 2, "COP", "end");
    ax(m.l, m.t - 2, "ENERGY INTENSITY (kWh/m²)");
  }

  qsa("[data-scenario]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mxScenario = btn.dataset.scenario;
      mxApply();
    });
  });

  /* -----------------------------------------------------------------
   * H.E.A.A.L. — score + tiles + sparks
   * ----------------------------------------------------------------- */
  const HL = {
    1: { score: 91, pm: 8.2, tvoc: 118, t: 21.6, co2: 540 },
    2: { score: 86, pm: 11.4, tvoc: 142, t: 21.4, co2: 612 },
    3: { score: 78, pm: 14.1, tvoc: 196, t: 22.1, co2: 718 },
  };

  function hlApply() {
    const d = HL[state.hlFloor] || HL[2];
    setText("hl-score", fmtInt(d.score));
    setText("hl-pm", fmt1(d.pm));
    setText("hl-tvoc", fmtInt(d.tvoc));
    setText("hl-t", fmt1(d.t));
    setText("hl-co2", fmtInt(d.co2));
    const bar = document.getElementById("hl-bar");
    if (bar) bar.style.width = d.score + "%";
    qsa("[data-hl]").forEach((btn) => btn.classList.toggle("is-active", +btn.dataset.hl === state.hlFloor));
    drawSparks(state.hlFloor);
  }

  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function drawSparks(floor) {
    qsa("[data-spark]").forEach((svgEl) => {
      const metric = svgEl.dataset.spark;
      const NS = "http://www.w3.org/2000/svg";
      while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
      const rand = seeded(floor * 13 + metric.length * 7);
      const N = 24;
      const pts = [];
      let v = 0.5;
      for (let i = 0; i < N; i++) {
        v += (rand() - 0.5) * 0.2;
        v = Math.max(0.1, Math.min(0.9, v));
        pts.push([(i / (N - 1)) * 120, (1 - v) * 32]);
      }
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#5eead4");
      path.setAttribute("stroke-width", 1.4);
      svgEl.appendChild(path);
    });
  }

  qsa("[data-hl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.hlFloor = +btn.dataset.hl;
      hlApply();
    });
  });

  /* -----------------------------------------------------------------
   * COUNTUP (initial title pulse only — reduced-motion safe)
   * ----------------------------------------------------------------- */
  function countup(el, target, decimals) {
    if (reduceMotion) {
      el.textContent = decimals ? target.toFixed(decimals) : fmtInt(target);
      return;
    }
    const dur = 900;
    const start = performance.now();
    function tick(t) {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = target * eased;
      el.textContent = decimals ? v.toFixed(decimals) : fmtInt(v);
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = decimals ? target.toFixed(decimals) : fmtInt(target);
    }
    requestAnimationFrame(tick);
  }

  function startCountups() {
    qsa("[data-countup]").forEach((el) => {
      const target = parseFloat(el.dataset.countup);
      const decimals = el.dataset.decimals ? +el.dataset.decimals : 0;
      // when in viewport
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            countup(el, target, decimals);
            io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(el);
    });
  }

  /* -----------------------------------------------------------------
   * BOOT
   * ----------------------------------------------------------------- */
  function boot() {
    initMap();
    drawArchetype();
    fsApply();
    mxApply();
    hlApply();
    applyFilter(true);
    startCountups();

    // auto-hide hint after a few seconds
    if (!reduceMotion) {
      setTimeout(() => {
        const hint = document.getElementById("stage-hint");
        if (hint) hint.classList.add("is-hidden");
      }, 8000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
