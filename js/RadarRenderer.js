// RadarRenderer.js – Pure SVG rendering with axis visibility filtering

import { DEFAULT_OPTIONS } from './config.js';

const NS = 'http://www.w3.org/2000/svg';

export class RadarRenderer {
  constructor(svgEl) {
    this.svg = svgEl;
    this.options = { ...DEFAULT_OPTIONS };
    this.labels = [];
    this.datasets = [];
    this.axisVisible = [];     // boolean array per original axis
    this._maxVals = [];
    this._onTip = null;
    this._seriesGroups = [];
    this._gridGroup = null;
    this._axesGroup = null;
    this._labelGroup = null;
    this._gridLabelGroup = null;
    this._ro = new ResizeObserver(() => {
      if (this.labels.length >= 3 && this._isVisible()) this.render();
    });
    this._ro.observe(svgEl.parentElement ?? svgEl);
  }

  setOptions(patch) { Object.assign(this.options, patch); }
  setOnTooltip(fn) { this._onTip = fn; }
  setData(labels, datasets) {
    this.labels = labels;
    this.datasets = datasets;
    this.axisVisible = this.axisVisible.length === labels.length ? this.axisVisible : labels.map(() => true);
    this._calcMaxVals();
  }
  setAxisVisible(visibleArray) {
    this.axisVisible = [...visibleArray];
    this._calcMaxVals();
  }

  render() {
    if (this.labels.length < 3) return;
    this._measure();
    if (!this.W || !this.H || isNaN(this.W) || isNaN(this.H)) return;
    this.svg.innerHTML = '';
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.svg.setAttribute('width', this.W);
    this.svg.setAttribute('height', this.H);
    this._defs();
    this._background();
    this._grid();
    this._axes();
    this._axisLabels();
    // Grid value labels removed per user request
    // if (this.options.showGridLabels) this._gridLabels();
    this._data();
    this._seriesGroups = this._seriesGroups.filter(g => g && this.svg.contains(g));
  }

  updateStrokeWidth(w) { this.options.strokeWidth = w; this.svg.querySelectorAll('.r-stroke').forEach(p => p.setAttribute('stroke-width', w)); }
  updatePointRadius(r) { this.options.pointRadius = r; this.svg.querySelectorAll('.r-point').forEach(c => c.setAttribute('r', r)); }
  updateFillOpacity(op) {
    this.options.fillOpacity = op;
    for (let i = 0; i < this.datasets.length; i++) {
      const grad = this.svg.querySelector(`#sfg${i}`);
      if (grad) {
        const stop = grad.querySelector('stop:last-child');
        if (stop) stop.setAttribute('stop-opacity', (op * 1.6).toFixed(2));
      }
    }
  }
  updateGlowEffect(enabled) {
    this.options.glowEffect = enabled;
    this.svg.querySelectorAll('.r-stroke').forEach(p => {
      if (enabled) p.setAttribute('filter', 'url(#glow)');
      else p.removeAttribute('filter');
    });
  }
  updateGridLabelsVisibility(visible) {
    this.options.showGridLabels = visible;
    if (this._gridLabelGroup) this._gridLabelGroup.style.display = visible ? '' : 'none';
    else if (visible) this._gridLabels();
  }
  updateLabelFontSize(size) {
    this.options.labelFontSize = size;
    this.svg.querySelectorAll('.r-axis-label').forEach(t => t.setAttribute('font-size', size));
  }
  toggleSeriesVisibility(idx, visible) {
    const g = this._seriesGroups[idx];
    if (g) g.style.display = visible ? '' : 'none';
  }

  getSVGString() {
    const clone = this.svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    const cs = getComputedStyle(document.documentElement);
    const vars = [
      '--chart-grid-stroke', '--chart-grid-fill', '--chart-axis-stroke',
      '--chart-label-color', '--chart-grid-label-color', '--chart-bg-center',
      '--surface-bg', '--bg'
    ];
    let str = clone.outerHTML;
    vars.forEach(v => {
      const val = cs.getPropertyValue(v).trim();
      if (val) str = str.replaceAll(`var(${v})`, val);
    });
    return str;
  }
  destroy() { this._ro.disconnect(); }

  // Private helpers
  _isVisible() { return this.svg.offsetParent !== null; }

  _getVisibleIndices() {
    return this.labels.map((_, i) => i).filter(i => this.axisVisible[i]);
  }

  _measure() {
    const parent = this.svg.parentElement ?? this.svg;
    let rect = parent.getBoundingClientRect();
    let w = rect.width, h = rect.height;
    if (w === 0 && h === 0) {
      w = this.svg.clientWidth || parent.clientWidth || 600;
      h = this.svg.clientHeight || parent.clientHeight || 500;
    }
    this.W = w || 600;
    this.H = h || 500;
    this.cx = this.W / 2;
    this.cy = this.H / 2;
    const pad = Math.max(this.options.labelFontSize * 5.5, 72);
    let r = Math.min(this.W, this.H) / 2 - pad;
    this.R = Math.max(r, 60);
    if (isNaN(this.R)) this.R = 100;
  }

  _angle(i, totalVisible) {
    return (i / totalVisible) * 2 * Math.PI - Math.PI / 2;
  }

  _pt(norm, visibleIdx, totalVisible) {
    const a = this._angle(visibleIdx, totalVisible);
    const r = Math.max(0, Math.min(norm, 1)) * this.R;
    return { x: this.cx + r * Math.cos(a), y: this.cy + r * Math.sin(a) };
  }

  _gridPt(ring, visibleIdx, totalVisible) {
    const a = this._angle(visibleIdx, totalVisible);
    const r = (ring / this.options.rings) * this.R;
    return { x: this.cx + r * Math.cos(a), y: this.cy + r * Math.sin(a) };
  }

  _calcMaxVals() {
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    if (nVisible === 0) return;
    const { scaleMode } = this.options;
    if (scaleMode === 'fixed') {
      this._maxVals = Array(nVisible).fill(100);
    } else if (scaleMode === 'global') {
      let gmax = 1;
      for (let vi of visibleIdx) {
        for (let ds of this.datasets) {
          gmax = Math.max(gmax, ds.values[vi] ?? 0);
        }
      }
      this._maxVals = Array(nVisible).fill(gmax);
    } else {
      this._maxVals = visibleIdx.map(vi =>
        Math.max(...this.datasets.map(d => d.values[vi] ?? 0), 1)
      );
    }
  }

  _polyPath(pts) {
    return this.options.smoothCurves ? this._catmull(pts) : this._linear(pts);
  }
  _linear(pts) {
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';
  }
  _catmull(pts) {
    const n = pts.length;
    const all = [pts[n-1], ...pts, pts[0], pts[1]];
    const t = 0.35;
    let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = all[i], p1 = all[i+1], p2 = all[i+2], p3 = all[i+3];
      const c1x = (p1.x + (p2.x - p0.x) * t).toFixed(2);
      const c1y = (p1.y + (p2.y - p0.y) * t).toFixed(2);
      const c2x = (p2.x - (p3.x - p1.x) * t).toFixed(2);
      const c2y = (p2.y - (p3.y - p1.y) * t).toFixed(2);
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
    return d + ' Z';
  }

  _el(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }
  _g(cls) { return this._el('g', { class: cls }); }
  _app(el) { this.svg.appendChild(el); return el; }

  _defs() {
    const defs = this._el('defs');
    // glow filter
    const f = this._el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    const blur = this._el('feGaussianBlur', { stdDeviation: '3.5', result: 'blur' });
    const merge = this._el('feMerge');
    f.appendChild(blur);
    merge.appendChild(this._el('feMergeNode', { in: 'blur' }));
    merge.appendChild(this._el('feMergeNode', { in: 'SourceGraphic' }));
    f.appendChild(merge);
    defs.appendChild(f);
    const f2 = this._el('filter', { id: 'gridglow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
    const blur2 = this._el('feGaussianBlur', { stdDeviation: '1.2', result: 'b2' });
    const merge2 = this._el('feMerge');
    f2.appendChild(blur2);
    merge2.appendChild(this._el('feMergeNode', { in: 'b2' }));
    merge2.appendChild(this._el('feMergeNode', { in: 'SourceGraphic' }));
    f2.appendChild(merge2);
    defs.appendChild(f2);
    const rg = this._el('radialGradient', { id: 'chartBg', cx: '50%', cy: '50%', r: '50%' });
    rg.appendChild(this._el('stop', { offset: '0%', 'stop-color': 'var(--chart-bg-center)' }));
    rg.appendChild(this._el('stop', { offset: '100%', 'stop-color': 'var(--chart-bg-edge, transparent)' }));
    defs.appendChild(rg);
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    this.datasets.forEach((d, i) => {
      const lg = this._el('radialGradient', {
        id: `sfg${i}`, cx: '50%', cy: '50%', r: '50%',
        gradientUnits: 'userSpaceOnUse', cx: this.cx, cy: this.cy, r: this.R
      });
      lg.appendChild(this._el('stop', { offset: '0%', 'stop-color': d.color, 'stop-opacity': '0.08' }));
      lg.appendChild(this._el('stop', { offset: '100%', 'stop-color': d.color, 'stop-opacity': (this.options.fillOpacity * 1.6).toFixed(2) }));
      defs.appendChild(lg);
    });
    this._app(defs);
  }

  _background() {
    this._app(this._el('circle', { cx: this.cx, cy: this.cy, r: this.R * 1.05, fill: 'url(#chartBg)' }));
  }

  _grid() {
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    if (nVisible < 3) return;
    const g = this._app(this._g('r-grid'));
    for (let ring = 1; ring <= this.options.rings; ring++) {
      const pts = Array.from({ length: nVisible }, (_, i) => this._gridPt(ring, i, nVisible));
      const d = this._polyPath(pts);
      const opacity = (0.25 + ring / this.options.rings * 0.35).toFixed(2);
      const path = this._el('path', {
        d, fill: ring === this.options.rings ? 'var(--chart-grid-fill)' : 'none',
        stroke: 'var(--chart-grid-stroke)', 'stroke-width': '1', opacity,
      });
      if (this.options.glowEffect && ring === this.options.rings) path.setAttribute('filter', 'url(#gridglow)');
      g.appendChild(path);
    }
    g.appendChild(this._el('circle', { cx: this.cx, cy: this.cy, r: 3, fill: 'var(--chart-axis-stroke)', opacity: '0.6' }));
    this._gridGroup = g;
  }

  _axes() {
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    if (nVisible < 3) return;
    const g = this._app(this._g('r-axes'));
    for (let i = 0; i < nVisible; i++) {
      const end = this._gridPt(this.options.rings, i, nVisible);
      g.appendChild(this._el('line', {
        x1: this.cx, y1: this.cy, x2: end.x, y2: end.y,
        stroke: 'var(--chart-axis-stroke)', 'stroke-width': '1', opacity: '0.55'
      }));
    }
    this._axesGroup = g;
  }

  _axisLabels() {
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    if (nVisible < 3) return;
    const g = this._app(this._g('r-labels'));
    const offset = 22;
    for (let vi = 0; vi < nVisible; vi++) {
      const originalIdx = visibleIdx[vi];
      const lbl = this.labels[originalIdx];
      const a = this._angle(vi, nVisible);
      const x = this.cx + (this.R + offset) * Math.cos(a);
      const y = this.cy + (this.R + offset) * Math.sin(a);
      const cos = Math.cos(a);
      const anchor = cos < -0.1 ? 'end' : cos > 0.1 ? 'start' : 'middle';
      const display = lbl.length > 18 ? lbl.slice(0,16)+'…' : lbl;
      const txt = this._el('text', {
        x: x.toFixed(2), y: y.toFixed(2),
        'text-anchor': anchor, 'dominant-baseline': 'middle',
        'font-size': this.options.labelFontSize,
        'font-family': "'Syne', sans-serif", 'font-weight': '600',
        fill: 'var(--chart-label-color)', class: 'r-axis-label'
      });
      if (display !== lbl) {
        const title = document.createElementNS(NS, 'title');
        title.textContent = lbl;
        txt.appendChild(title);
      }
      txt.textContent = display;
      g.appendChild(txt);
    }
    this._labelGroup = g;
  }

  _gridLabels() {
    // kept for completeness but not used (user does not want numeric labels)
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    if (nVisible === 0) return;
    const g = this._app(this._g('r-glabels'));
    for (let ring = 1; ring <= this.options.rings; ring++) {
      const pt = this._gridPt(ring, 0, nVisible);
      let val = (ring / this.options.rings) * (this._maxVals[0] || 100);
      const disp = Number.isInteger(val) ? val : val.toFixed(1);
      const txt = this._el('text', {
        x: (pt.x+4).toFixed(2), y: (pt.y-4).toFixed(2),
        'text-anchor': 'start', 'font-size': '9',
        'font-family': "'Fira Code', monospace",
        fill: 'var(--chart-grid-label-color)', class: 'r-glabel', opacity: '0.8'
      });
      txt.textContent = disp;
      g.appendChild(txt);
    }
    this._gridLabelGroup = g;
  }

  _data() {
    const visibleIdx = this._getVisibleIndices();
    const nVisible = visibleIdx.length;
    if (nVisible < 3) return;
    const g = this._app(this._g('r-data'));
    const animate = this.options.animate;
    this._seriesGroups = [];
    this.datasets.forEach((ds, di) => {
      if (!ds.visible) return;
      // Build points only for visible axes
      const pts = [];
      for (let vi = 0; vi < nVisible; vi++) {
        const origIdx = visibleIdx[vi];
        const rawVal = ds.values[origIdx] ?? 0;
        const norm = rawVal / (this._maxVals[vi] || 1);
        pts.push(this._pt(norm, vi, nVisible));
      }
      const dPath = this._polyPath(pts);
      const sg = this._el('g', { class: `r-series r-s${di}`, 'data-name': ds.name });
      if (animate) {
        sg.style.transformOrigin = `${this.cx}px ${this.cy}px`;
        sg.style.animation = `radarReveal ${0.45+di*0.07}s cubic-bezier(0.34,1.56,0.64,1) both`;
        sg.style.animationDelay = `${di*0.08}s`;
      }
      sg.appendChild(this._el('path', { d: dPath, fill: `url(#sfg${di})`, stroke: 'none', class: 'r-fill' }));
      const strokePath = this._el('path', {
        d: dPath, fill: 'none', stroke: ds.color,
        'stroke-width': this.options.strokeWidth,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'r-stroke'
      });
      if (this.options.glowEffect) strokePath.setAttribute('filter', 'url(#glow)');
      sg.appendChild(strokePath);
      if (this.options.pointRadius > 0) {
        pts.forEach((pt, vi) => {
          const origIdx = visibleIdx[vi];
          const c = this._el('circle', {
            cx: pt.x.toFixed(2), cy: pt.y.toFixed(2), r: this.options.pointRadius,
            fill: ds.color, stroke: 'var(--surface-bg)', 'stroke-width': '2',
            class: 'r-point', style: 'cursor:crosshair'
          });
          const tip = { series: ds.name, axis: this.labels[origIdx], value: ds.values[origIdx], color: ds.color };
          c.addEventListener('mouseenter', e => {
            c.setAttribute('r', this.options.pointRadius * 2.4);
            this._onTip?.({ ...tip, visible: true, x: e.clientX, y: e.clientY });
          });
          c.addEventListener('mousemove', e => this._onTip?.({ ...tip, visible: true, x: e.clientX, y: e.clientY }));
          c.addEventListener('mouseleave', () => {
            c.setAttribute('r', this.options.pointRadius);
            this._onTip?.({ visible: false });
          });
          sg.appendChild(c);
        });
      }
      g.appendChild(sg);
      this._seriesGroups.push(sg);
    });
  }
}