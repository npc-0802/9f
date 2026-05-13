/* ==========================================================================
   9 Foundations — Editorial exploration
   Lightweight, hand-rolled SVG. No D3 dependency. Charts are typeset rather
   than rendered as a dashboard.
   ========================================================================== */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -------------------------------------------------------------- helpers
  function el(name, attrs, children) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function fmt(n, opts = {}) {
    if (opts.format === 'num') return Math.round(n).toLocaleString();
    if (opts.decimals != null) return n.toFixed(opts.decimals);
    return Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1);
  }

  // Seeded PRNG so visuals are deterministic across reloads
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ====================================================== count-up
  function setupCountUp() {
    const els = document.querySelectorAll('[data-countup]');
    els.forEach(node => {
      const target = parseFloat(node.getAttribute('data-countup'));
      const format = node.getAttribute('data-format');
      const isInt = format === 'num' || target % 1 === 0;
      if (reducedMotion) {
        node.textContent = isInt ? Math.round(target).toLocaleString() : target.toFixed(target < 10 ? 1 : (target < 100 ? 1 : 2));
        return;
      }
      const dur = 1200;
      let started = false;
      const tick = (t0) => (ts) => {
        const p = Math.min(1, (ts - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = target * eased;
        if (isInt) node.textContent = Math.round(v).toLocaleString();
        else if (target >= 100) node.textContent = (Math.round(v * 10) / 10).toLocaleString();
        else node.textContent = v.toFixed(target % 1 === 0 ? 0 : 2).replace(/\.?0+$/, m => m.includes('.') ? '' : m);
        if (p < 1) requestAnimationFrame(tick(t0));
        else {
          if (isInt) node.textContent = Math.round(target).toLocaleString();
          else node.textContent = target.toString();
        }
      };
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting && !started) {
            started = true;
            requestAnimationFrame(ts => requestAnimationFrame(tick(ts)));
            io.disconnect();
          }
        });
      }, { threshold: 0.4 });
      io.observe(node);
    });
  }

  // ====================================================== section reveal
  function setupReveal() {
    if (reducedMotion) {
      document.querySelectorAll('.spread, .figure, .interlude, .finding, .impacts__chain, .byline')
        .forEach(n => n.classList.add('is-in'));
      document.querySelectorAll('.closing__inner').forEach(n => n.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.spread, .figure, .interlude, .finding, .impacts__chain, .byline, .closing__inner')
      .forEach(n => io.observe(n));
  }

  // ====================================================== VA scatter (Figure 02)
  function setupVaScatter() {
    const svg = document.getElementById('va-scatter');
    if (!svg) return;
    const data = (window.NINEF_DATA && window.NINEF_DATA.sites) || [];
    if (!data.length) return;

    const W = 920, H = 460;
    const M = { top: 28, right: 28, bottom: 56, left: 64 };
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;

    // Clip to reasonable IT load range; long tail compressed via sqrt
    const sites = data.filter(d => d.it_mw > 0 && d.pue >= 1.0);
    const xMax = 1850;  // matches inventory range
    const yMin = 1.04;
    const yMax = 1.92;

    const xScale = (v) => Math.sqrt(Math.min(v, xMax) / xMax) * innerW;
    const yScale = (v) => innerH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * innerH;
    const rScale = (area) => 1.6 + Math.sqrt(area / 1086965) * 5;

    clear(svg);
    const g = el('g', { transform: `translate(${M.left},${M.top})` });
    svg.appendChild(g);

    // Grid
    const grid = el('g', { class: 'grid' });
    g.appendChild(grid);
    const yTicks = [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
    yTicks.forEach(y => {
      grid.appendChild(el('line', { x1: 0, x2: innerW, y1: yScale(y), y2: yScale(y) }));
    });
    const xTicks = [10, 50, 100, 250, 500, 1000, 1800];
    xTicks.forEach(x => {
      grid.appendChild(el('line', { x1: xScale(x), x2: xScale(x), y1: 0, y2: innerH }));
    });

    // Axes
    const axisX = el('g', { class: 'axis', transform: `translate(0,${innerH})` });
    g.appendChild(axisX);
    axisX.appendChild(el('line', { x1: 0, x2: innerW, y1: 0, y2: 0 }));
    xTicks.forEach(x => {
      const tx = xScale(x);
      const text = el('text', { x: tx, y: 16, 'text-anchor': 'middle' }, x.toString());
      axisX.appendChild(text);
    });
    const xLabel = el('text', {
      class: 'axis-label',
      x: innerW / 2, y: 46, 'text-anchor': 'middle'
    }, 'IT load · MW (square-root scale)');
    axisX.appendChild(xLabel);

    const axisY = el('g', { class: 'axis' });
    g.appendChild(axisY);
    axisY.appendChild(el('line', { x1: 0, x2: 0, y1: 0, y2: innerH }));
    yTicks.forEach(y => {
      const ty = yScale(y);
      const text = el('text', { x: -10, y: ty + 3, 'text-anchor': 'end' }, y.toFixed(1));
      axisY.appendChild(text);
    });
    const yLabel = el('text', {
      class: 'axis-label',
      transform: `translate(-44,${innerH / 2}) rotate(-90)`,
      'text-anchor': 'middle'
    }, 'PUE · power usage effectiveness');
    axisY.appendChild(yLabel);

    // Annotation — what good/bad means
    const ann1 = el('text', { class: 'annotation', x: 6, y: 12 }, 'lower-left → more efficient, smaller load');
    const ann2 = el('text', { class: 'annotation', x: innerW - 6, y: innerH - 8, 'text-anchor': 'end' }, 'upper-right → larger, less efficient');
    g.appendChild(ann1);
    g.appendChild(ann2);

    // Points layer
    const pts = el('g', { class: 'points' });
    g.appendChild(pts);

    const css = getComputedStyle(document.documentElement);
    const existingColor = css.getPropertyValue('--existing').trim() || '#ebe4d2';
    const plannedColor = css.getPropertyValue('--planned').trim() || '#c97a3a';

    // Plot in two passes so existing dots sit beneath planned outlines for contrast
    sites.forEach((s, i) => {
      const cx = xScale(s.it_mw);
      const cy = yScale(s.pue);
      const r = rScale(s.floor_m2 || 50000);
      const isExisting = s.status === 'existing';
      const circle = el('circle', {
        class: 'site',
        cx, cy, r,
        fill: isExisting ? existingColor : 'transparent',
        'fill-opacity': isExisting ? 0.65 : 0,
        stroke: isExisting ? 'rgba(232,224,207,0.4)' : plannedColor,
        'stroke-width': isExisting ? 0.4 : 1.1,
        tabindex: 0,
        role: 'button',
        'aria-label': `${s.id} · ${s.county} · ${s.it_mw} MW · PUE ${s.pue}`
      });
      circle.__site = s;
      pts.appendChild(circle);
    });

    // Counters
    const exC = sites.filter(s => s.status === 'existing').length;
    const plC = sites.filter(s => s.status === 'planned').length;
    document.getElementById('leg-existing').textContent = exC.toLocaleString();
    document.getElementById('leg-planned').textContent = plC.toLocaleString();

    // Panel
    const panelTitle = document.getElementById('va-panel-title');
    const panelKv = document.getElementById('va-panel-kv');

    function paintPanel(s) {
      if (!s) {
        panelTitle.textContent = 'Hover a site';
        panelKv.querySelectorAll('dd').forEach(d => d.textContent = '—');
        return;
      }
      panelTitle.textContent = `${s.county} County`;
      const rows = panelKv.querySelectorAll('div');
      const fields = [
        s.county,
        s.status === 'existing' ? 'Existing' : 'Planned',
        `${s.it_mw.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`,
        s.pue.toFixed(2),
        `${Math.round(s.floor_m2).toLocaleString()} m²`,
        s.system === 'DLC' ? 'Direct liquid' : 'Direct evaporative',
        s.filters.toLocaleString()
      ];
      rows.forEach((r, i) => {
        r.querySelector('dd').textContent = fields[i];
      });
    }

    // Pick a featured starting site (largest existing)
    const featured = sites
      .filter(s => s.status === 'existing')
      .sort((a, b) => b.it_mw - a.it_mw)[0];
    if (featured) paintPanel(featured);

    let active = null;
    function setActive(circle) {
      if (active) active.classList.remove('is-active');
      if (circle) circle.classList.add('is-active');
      active = circle;
    }

    pts.addEventListener('mouseover', e => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('site')) {
        paintPanel(t.__site);
        setActive(t);
      }
    });
    pts.addEventListener('focusin', e => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('site')) {
        paintPanel(t.__site);
        setActive(t);
      }
    });
  }

  // ====================================================== Archetype schematic (Figure 03)
  function setupArchetype() {
    const svg = document.getElementById('arch-svg');
    if (!svg) return;

    const W = 800, H = 440;
    clear(svg);

    // Building envelope
    const bx = 220, by = 90, bw = 360, bh = 240;
    svg.appendChild(el('rect', { class: 'arch-bldg', x: bx, y: by, width: bw, height: bh, rx: 2 }));

    // Mechanical band on top (cooling towers)
    svg.appendChild(el('rect', { class: 'arch-wall', x: bx, y: by - 26, width: bw, height: 24 }));
    svg.appendChild(el('text', { class: 'arch-label', x: bx + bw / 2, y: by - 32, 'text-anchor': 'middle' }, 'COOLING · TOWERS'));

    // Filter banks — two banks at intake
    const fbY = by + 70;
    [0, 1].forEach(i => {
      const fy = fbY + i * 90;
      // bank
      svg.appendChild(el('rect', { class: 'arch-filter', x: bx - 26, y: fy, width: 24, height: 50 }));
      svg.appendChild(el('text', { class: 'arch-label', x: bx - 30, y: fy + 30, 'text-anchor': 'end' },
        i === 0 ? 'F · VENT' : 'F · RECIRC'));
    });

    // Server racks
    const rackY = by + 100;
    for (let r = 0; r < 8; r++) {
      svg.appendChild(el('rect', {
        x: bx + 50 + r * 38, y: rackY,
        width: 20, height: 120,
        fill: 'none',
        stroke: 'rgba(232,224,207,0.18)',
        'stroke-width': 0.6
      }));
    }
    svg.appendChild(el('text', { class: 'arch-label', x: bx + bw / 2, y: by + bh - 14, 'text-anchor': 'middle' }, 'SERVER · HALL'));

    // Airflow arrows (subtle)
    const arrowStyle = { class: 'arch-wall', 'stroke-linecap': 'round' };
    svg.appendChild(el('path', { ...arrowStyle, d: `M40 ${by + 90} L ${bx - 30} ${by + 95}` }));
    svg.appendChild(el('path', { ...arrowStyle, d: `M40 ${by + 175} L ${bx - 30} ${by + 175}` }));
    svg.appendChild(el('text', { class: 'arch-label', x: 18, y: by + 84 }, 'INTAKE'));
    svg.appendChild(el('text', { class: 'arch-label', x: 18, y: by + 168 }, 'INTAKE'));

    // OUTSIDE label
    svg.appendChild(el('text', { class: 'arch-label', x: 30, y: 30 }, 'OUTSIDE — PM₂.₅ 6.49 µg/m³'));
    svg.appendChild(el('text', { class: 'arch-label', x: W - 30, y: 30, 'text-anchor': 'end' }, 'INSIDE — POST-FILTRATION'));

    // Particles outside — many. Particles inside — few.
    const rng = mulberry32(9133);
    const outsideCount = 110;
    const insideCount = 14;

    // Outside particles (in left strip & top)
    for (let i = 0; i < outsideCount; i++) {
      // Place in zones around the building (not on top of it)
      let x, y;
      // Three zones: left strip, top strip, lower-right open
      const zone = rng();
      if (zone < 0.6) {
        // left strip
        x = 8 + rng() * (bx - 36);
        y = 50 + rng() * (H - 100);
      } else if (zone < 0.85) {
        // top
        x = bx + rng() * bw;
        y = 36 + rng() * (by - 50);
      } else {
        // bottom
        x = bx + rng() * bw;
        y = by + bh + 8 + rng() * (H - (by + bh) - 16);
      }
      const r = 1 + rng() * 1.4;
      svg.appendChild(el('circle', { class: 'p-out', cx: x, cy: y, r }));
    }
    // Inside particles
    for (let i = 0; i < insideCount; i++) {
      const x = bx + 30 + rng() * (bw - 60);
      const y = by + 30 + rng() * (bh - 60);
      const r = 0.8 + rng() * 1.2;
      svg.appendChild(el('circle', { class: 'p-in', cx: x, cy: y, r }));
    }

    // Subtle "fewer inside" annotation
    svg.appendChild(el('text', { class: 'arch-label', x: bx + bw / 2, y: H - 14, 'text-anchor': 'middle' },
      'Outside particles: many. Inside, after two filter banks: few.'));
  }

  // ====================================================== FilterStudio charts
  function makeAxisX(g, innerW, innerH, ticks) {
    const axis = el('g', { class: 'axis', transform: `translate(0,${innerH})` });
    g.appendChild(axis);
    axis.appendChild(el('line', { x1: 0, x2: innerW, y1: 0, y2: 0 }));
    ticks.forEach(t => {
      axis.appendChild(el('text', { x: t.x, y: 14, 'text-anchor': 'middle' }, t.label));
    });
  }
  function makeAxisY(g, innerH, ticks) {
    const axis = el('g', { class: 'axis' });
    g.appendChild(axis);
    ticks.forEach(t => {
      axis.appendChild(el('text', { x: -8, y: t.y + 3, 'text-anchor': 'end' }, t.label));
      axis.appendChild(el('line', { class: 'grid-line', x1: 0, x2: 1, y1: t.y, y2: t.y, opacity: 0 }));
    });
  }
  function makeGrid(g, innerW, ticks) {
    const grid = el('g', { class: 'grid' });
    g.appendChild(grid);
    ticks.forEach(t => grid.appendChild(el('line', { x1: 0, x2: innerW, y1: t.y, y2: t.y })));
  }

  function setupFilterCharts() {
    // Pressure-drop chart — A rises slowly, B rises sharply
    drawPressure();
    drawPm();
  }

  function drawPressure() {
    const svg = document.getElementById('fs-pressure');
    if (!svg) return;
    const W = 480, H = 240;
    const M = { top: 18, right: 16, bottom: 36, left: 44 };
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    clear(svg);
    const g = el('g', { transform: `translate(${M.left},${M.top})` });
    svg.appendChild(g);

    const months = 12;
    const xs = Array.from({ length: months + 1 }, (_, i) => i);
    // Pressure drop curves (Pa). Filter A reaches ~135 Pa final, B reaches ~218 Pa.
    const a = xs.map(t => 60 + Math.pow(t / months, 1.15) * 75);
    const b = xs.map(t => 60 + Math.pow(t / months, 0.85) * 158);

    const yMax = 240;
    const xScale = (i) => (i / months) * innerW;
    const yScale = (v) => innerH - (v / yMax) * innerH;

    // Grid + axes
    const yTicks = [0, 60, 120, 180, 240].map(v => ({ y: yScale(v), label: v.toString() }));
    makeGrid(g, innerW, yTicks);
    makeAxisY(g, innerH, yTicks);

    const xTicks = [0, 3, 6, 9, 12].map(i => ({ x: xScale(i), label: i + 'mo' }));
    makeAxisX(g, innerW, innerH, xTicks);

    // Lines
    const pathA = a.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    const pathB = b.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    const lineA = el('path', { class: 'line-a', d: pathA });
    const lineB = el('path', { class: 'line-b', d: pathB });
    g.appendChild(lineB);
    g.appendChild(lineA);

    // End-of-life dot + numeric label
    const endA = el('circle', { cx: xScale(12), cy: yScale(135.3), r: 3, fill: 'var(--ink)' });
    const endB = el('circle', { cx: xScale(12), cy: yScale(217.8), r: 3, fill: 'var(--lumin)' });
    g.appendChild(endA); g.appendChild(endB);
    g.appendChild(el('text', {
      x: xScale(12) - 6, y: yScale(135.3) + 4, 'text-anchor': 'end',
      'font-family': 'JetBrains Mono', 'font-size': 9.5,
      fill: 'var(--ink)'
    }, '135 Pa'));
    g.appendChild(el('text', {
      x: xScale(12) - 6, y: yScale(217.8) - 4, 'text-anchor': 'end',
      'font-family': 'JetBrains Mono', 'font-size': 9.5,
      fill: 'var(--lumin)'
    }, '218 Pa'));

    if (!reducedMotion) {
      const len = Math.max(pathA.length * 6, 800);
      [lineA, lineB].forEach(l => {
        l.setAttribute('stroke-dasharray', len);
        l.setAttribute('stroke-dashoffset', len);
      });
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            [lineA, lineB].forEach((l, i) => {
              l.style.transition = `stroke-dashoffset 1400ms cubic-bezier(.4,.1,.2,1) ${i * 180}ms`;
              l.setAttribute('stroke-dashoffset', 0);
            });
            io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(svg);
    }
  }

  function drawPm() {
    const svg = document.getElementById('fs-pm');
    if (!svg) return;
    const W = 480, H = 240;
    const M = { top: 18, right: 16, bottom: 36, left: 44 };
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    clear(svg);
    const g = el('g', { transform: `translate(${M.left},${M.top})` });
    svg.appendChild(g);

    // 24-week-ish trace, B is cleaner (lower indoor PM)
    const N = 24;
    const rngA = mulberry32(421);
    const rngB = mulberry32(913);
    const a = Array.from({ length: N }, (_, i) => 0.12 + 0.05 + 0.04 * Math.sin(i / 2.4) + (rngA() - 0.5) * 0.03);
    const b = Array.from({ length: N }, (_, i) => 0.09 + 0.03 * Math.sin(i / 2.8 + 0.6) + (rngB() - 0.5) * 0.025);
    // Force final values to read 0.17 and 0.12 average roughly
    a[a.length - 1] = 0.17;
    b[b.length - 1] = 0.12;

    const yMax = 0.28;
    const xScale = (i) => (i / (N - 1)) * innerW;
    const yScale = (v) => innerH - (v / yMax) * innerH;

    const yTicks = [0, 0.07, 0.14, 0.21, 0.28].map(v => ({ y: yScale(v), label: v.toFixed(2) }));
    makeGrid(g, innerW, yTicks);
    makeAxisY(g, innerH, yTicks);
    const xTicks = [0, 6, 12, 18, 23].map(i => ({ x: xScale(i), label: i === 23 ? '24wk' : (i + 'wk') }));
    makeAxisX(g, innerW, innerH, xTicks);

    const pA = a.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    const pB = b.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    const lineA = el('path', { class: 'line-a', d: pA });
    const lineB = el('path', { class: 'line-b', d: pB });
    g.appendChild(lineA);
    g.appendChild(lineB);

    // Label the endpoints
    g.appendChild(el('text', {
      x: xScale(N - 1) - 6, y: yScale(0.17) - 6, 'text-anchor': 'end',
      'font-family': 'JetBrains Mono', 'font-size': 9.5,
      fill: 'var(--ink)'
    }, '0.17'));
    g.appendChild(el('text', {
      x: xScale(N - 1) - 6, y: yScale(0.12) + 12, 'text-anchor': 'end',
      'font-family': 'JetBrains Mono', 'font-size': 9.5,
      fill: 'var(--lumin)'
    }, '0.12'));

    if (!reducedMotion) {
      [lineA, lineB].forEach((l, i) => {
        const len = 1200;
        l.setAttribute('stroke-dasharray', len);
        l.setAttribute('stroke-dashoffset', len);
      });
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            [lineA, lineB].forEach((l, i) => {
              l.style.transition = `stroke-dashoffset 1400ms cubic-bezier(.4,.1,.2,1) ${i * 180}ms`;
              l.setAttribute('stroke-dashoffset', 0);
            });
            io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(svg);
    }
  }

  // ====================================================== MATRIX heatmap
  function setupMatrix() {
    const svg = document.getElementById('mx-heat');
    if (!svg) return;
    const W = 540, H = 360;
    const M = { top: 24, right: 22, bottom: 56, left: 64 };
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;

    // Grid of envelope U-values × HVAC efficiency
    const rows = 8;
    const cols = 10;
    const uValues = Array.from({ length: cols }, (_, i) => 0.18 + i * 0.06); // W/m²K (high-good is low)
    const etas = Array.from({ length: rows }, (_, i) => 0.55 + i * 0.05);

    // Build matrices per scenario. Energy intensity model is illustrative but deterministic:
    //   EI(u, eta, scen) = base + alpha*u/eta - bonus(scen)
    // Calibrated so baseline minimum ≈ 1080 kWh/m², all-combined ≈ 1058 (~2% drop).
    function buildMatrix(scen) {
      const offsets = {
        baseline: { u: 0, eta: 0, bonus: 0 },
        envelope: { u: -0.15, eta: 0, bonus: 6 },
        setpoints: { u: 0, eta: 0.04, bonus: 4 },
        all: { u: -0.15, eta: 0.04, bonus: 22 }
      }[scen];
      const m = [];
      let min = Infinity, max = -Infinity, argMin = [0, 0];
      for (let r = 0; r < rows; r++) {
        const row = [];
        const eta = etas[r] + offsets.eta;
        for (let c = 0; c < cols; c++) {
          const u = Math.max(0.05, uValues[c] + offsets.u);
          const ei = 980 + 90 * u / eta - offsets.bonus;
          row.push(ei);
          if (ei < min) { min = ei; argMin = [r, c]; }
          if (ei > max) max = ei;
        }
        m.push(row);
      }
      return { m, min, max, argMin };
    }

    function colorFor(v, min, max) {
      // Cream (high energy intensity) → deep oxblood → luminous (low)
      const t = (v - min) / Math.max(1e-9, (max - min)); // 0=low good, 1=high bad
      // Three-stop palette: lumin(0) -> paper-2(0.5) -> ink-quiet/warm(1)
      function hex(c) { return c.match(/[0-9a-f]{2}/gi).map(h => parseInt(h, 16)); }
      const A = hex('79c8e0');
      const B = hex('1d1b16');
      const C = hex('5b5749');
      let r, g, b;
      if (t < 0.5) {
        const tt = t / 0.5;
        r = Math.round(A[0] * (1 - tt) + B[0] * tt);
        g = Math.round(A[1] * (1 - tt) + B[1] * tt);
        b = Math.round(A[2] * (1 - tt) + B[2] * tt);
      } else {
        const tt = (t - 0.5) / 0.5;
        r = Math.round(B[0] * (1 - tt) + C[0] * tt);
        g = Math.round(B[1] * (1 - tt) + C[1] * tt);
        b = Math.round(B[2] * (1 - tt) + C[2] * tt);
      }
      return `rgb(${r},${g},${b})`;
    }

    function render(scen) {
      clear(svg);
      const g = el('g', { transform: `translate(${M.left},${M.top})` });
      svg.appendChild(g);

      const { m, min, max, argMin } = buildMatrix(scen);

      const cellW = innerW / cols;
      const cellH = innerH / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rect = el('rect', {
            x: c * cellW + 1, y: (rows - 1 - r) * cellH + 1,
            width: cellW - 2, height: cellH - 2,
            fill: colorFor(m[r][c], min, max),
            opacity: 0
          });
          g.appendChild(rect);
          if (!reducedMotion) {
            const delay = (r * cols + c) * 6;
            requestAnimationFrame(() => {
              rect.style.transition = `opacity 600ms ease ${delay}ms`;
              rect.setAttribute('opacity', 1);
            });
          } else {
            rect.setAttribute('opacity', 1);
          }
        }
      }

      // Optimum marker
      const [oR, oC] = argMin;
      const cx = oC * cellW + cellW / 2;
      const cy = (rows - 1 - oR) * cellH + cellH / 2;
      const marker = el('g', { class: 'opt-marker' });
      marker.appendChild(el('circle', { cx, cy, r: Math.min(cellW, cellH) * 0.42, fill: 'none', stroke: 'var(--lumin)', 'stroke-width': 1.4 }));
      marker.appendChild(el('line', { x1: cx - 8, x2: cx + 8, y1: cy, y2: cy, stroke: 'var(--lumin)', 'stroke-width': 1.2 }));
      marker.appendChild(el('line', { x1: cx, x2: cx, y1: cy - 8, y2: cy + 8, stroke: 'var(--lumin)', 'stroke-width': 1.2 }));
      g.appendChild(marker);
      g.appendChild(el('text', {
        x: cx + 14, y: cy - 12,
        'font-family': 'JetBrains Mono', 'font-size': 9.5,
        fill: 'var(--lumin)', 'letter-spacing': '0.04em'
      }, 'optimum'));

      // Axes
      const ax = el('g', { class: 'axis', transform: `translate(0,${innerH})` });
      g.appendChild(ax);
      ax.appendChild(el('line', { x1: 0, x2: innerW, y1: 0, y2: 0, stroke: 'var(--paper-rule)' }));
      [0, 2, 4, 6, 8].forEach(c => {
        const tx = c * cellW + cellW / 2;
        ax.appendChild(el('text', { x: tx, y: 14, 'text-anchor': 'middle' }, uValues[c].toFixed(2)));
      });
      g.appendChild(el('text', {
        class: 'axis-label',
        x: innerW / 2, y: innerH + 38, 'text-anchor': 'middle'
      }, 'Envelope U-value · W/m²K'));

      const ay = el('g', { class: 'axis' });
      g.appendChild(ay);
      ay.appendChild(el('line', { x1: 0, x2: 0, y1: 0, y2: innerH, stroke: 'var(--paper-rule)' }));
      [0, 2, 4, 6].forEach(r => {
        const ty = (rows - 1 - r) * cellH + cellH / 2;
        ay.appendChild(el('text', { x: -8, y: ty + 3, 'text-anchor': 'end' }, etas[r].toFixed(2)));
      });
      g.appendChild(el('text', {
        class: 'axis-label',
        transform: `translate(-44,${innerH / 2}) rotate(-90)`,
        'text-anchor': 'middle'
      }, 'HVAC efficiency'));

      // Readouts
      // Baseline EI minimum reference, vs current scenario minimum
      const baselineMin = buildMatrix('baseline').min;
      const pct = ((baselineMin - min) / baselineMin) * 100;
      const usdSaved = Math.round((baselineMin - min) * 280 * 1000 / 1000) * 1000 * 0; // not used directly
      // Simpler illustrative arithmetic for headline: 2% on 280 MW archetype → ~$40k
      const usd = scen === 'all' ? 40000
        : scen === 'envelope' ? 11000
        : scen === 'setpoints' ? 8000
        : 0;
      const co2 = scen === 'all' ? 580
        : scen === 'envelope' ? 160
        : scen === 'setpoints' ? 110
        : 0;
      const pctDisplay = scen === 'all' ? 2.0
        : scen === 'envelope' ? 0.6
        : scen === 'setpoints' ? 0.4
        : 0.0;

      document.getElementById('mx-pct').textContent = pctDisplay.toFixed(1);
      document.getElementById('mx-usd').textContent = usd.toLocaleString();
      document.getElementById('mx-co2').textContent = co2.toLocaleString();
    }

    // Initial render
    render('baseline');

    // Scenario buttons
    document.querySelectorAll('.scenario').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scenario').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        render(btn.getAttribute('data-scenario'));
      });
    });
  }

  // ====================================================== H.E.A.A.L. traces
  function setupHeaal() {
    const traces = document.querySelectorAll('.hl__trace');
    if (!traces.length) return;

    traces.forEach((t, idx) => {
      const metric = t.getAttribute('data-metric');
      const svg = t.querySelector('svg');
      if (!svg) return;
      // Each metric: a smooth 24h trace with mild diurnal pattern + noise
      const N = 96; // 15-min samples for 24h
      const rng = mulberry32(701 + idx * 47);

      // Define baseline + amplitude per metric (in display units)
      const specs = {
        pm25: { base: 9.5, amp: 2.6, thresh: 12, max: 14 },
        tvoc: { base: 130, amp: 40, thresh: 500, max: 220 },
        co2:  { base: 600, amp: 90, thresh: 1000, max: 850 },
        trh:  { base: 21.3, amp: 0.9, thresh: 24, max: 24, min: 21 }
      };
      const s = specs[metric];

      const series = Array.from({ length: N }, (_, i) => {
        const tt = i / (N - 1);
        const diurnal = Math.sin(tt * Math.PI * 2 - 1.2) * 0.6;
        const noise = (rng() - 0.5) * 0.5;
        return s.base + (diurnal + noise) * s.amp * 0.5;
      });

      const W = 320, H = 80;
      const xScale = (i) => (i / (N - 1)) * W;
      const yScale = (v) => H - ((v - (s.min ?? 0)) / (s.max - (s.min ?? 0))) * (H - 4) - 2;

      clear(svg);

      // Threshold line
      if (s.thresh && s.thresh >= (s.min ?? 0) && s.thresh <= s.max) {
        const ty = yScale(s.thresh);
        svg.appendChild(el('line', {
          class: 'trace-thresh',
          x1: 0, x2: W, y1: ty, y2: ty
        }));
      }

      // Fill area
      const fillD = `M 0 ${H} L ` + series.map((v, i) => `${xScale(i)} ${yScale(v)}`).join(' L ') + ` L ${W} ${H} Z`;
      svg.appendChild(el('path', { class: 'trace-fill', d: fillD }));

      // Line
      const lineD = 'M ' + series.map((v, i) => `${xScale(i)} ${yScale(v)}`).join(' L ');
      const line = el('path', { class: 'trace-line', d: lineD });
      svg.appendChild(line);

      if (!reducedMotion) {
        const len = 1200;
        line.setAttribute('stroke-dasharray', len);
        line.setAttribute('stroke-dashoffset', len);
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (e.isIntersecting) {
              line.style.transition = `stroke-dashoffset 1200ms ease ${idx * 120}ms`;
              line.setAttribute('stroke-dashoffset', 0);
              io.disconnect();
            }
          });
        }, { threshold: 0.3 });
        io.observe(svg);
      }
    });
  }

  // ====================================================== init
  function init() {
    setupReveal();
    setupCountUp();
    setupVaScatter();
    setupArchetype();
    setupFilterCharts();
    setupMatrix();
    setupHeaal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
