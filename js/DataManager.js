import { SERIES_COLORS } from './config.js';

export class DataManager extends EventTarget {
  constructor() {
    super();
    this._labels = [];
    this._axisVisible = [];
    this._axisMins = [];
    this._axisMaxs = [];
    this._datasets = [];
    this._title = '';
    this._subtitle = '';
  }

  get labels() { return [...this._labels]; }
  get axisVisible() { return [...this._axisVisible]; }
  get axisMins() { return [...this._axisMins]; }
  get axisMaxs() { return [...this._axisMaxs]; }
  get datasets() { return this._datasets.map(d => ({ ...d, values: [...d.values] })); }
  get title() { return this._title; }
  get subtitle() { return this._subtitle; }
  get hasData() { return this._labels.length >= 3 && this._datasets.length >= 1; }

  getNormalisedValues(seriesIdx) {
    const raw = this._datasets[seriesIdx]?.values;
    if (!raw) return [];
    return raw.map((val, i) => {
      const min = this._axisMins[i] ?? 0;
      const max = this._axisMaxs[i] ?? 100;
      const norm = (val - min) / (max - min);
      return Math.min(1, Math.max(0, norm));
    });
  }

  parseCSV(csv) {
    try {
      const lines = csv.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('Need header + data rows');
      const header = this._splitRow(lines[0]);
      if (header.length < 2) throw new Error('Need Axis + at least 1 series');
      const seriesNames = header.slice(1);
      const labels = [];
      const buckets = seriesNames.map(() => []);
      for (let i = 1; i < lines.length; i++) {
        const row = this._splitRow(lines[i]);
        labels.push(row[0] || `Axis ${i}`);
        seriesNames.forEach((_, si) => {
          const val = parseFloat(row[si + 1]);
          buckets[si].push(isNaN(val) ? 0 : val);
        });
      }
      if (labels.length < 3) throw new Error('At least 3 axes required');
      this._labels = labels;
      this._axisVisible = labels.map(() => true);
      this._axisMins = labels.map((_, i) => Math.min(...buckets.map(b => b[i])));
      this._axisMaxs = labels.map((_, i) => Math.max(...buckets.map(b => b[i])));
      this._datasets = seriesNames.map((name, i) => ({
        name, values: buckets[i],
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        visible: true,
      }));
      this._title = this._subtitle = '';
      this._fire('datachange');
      return { success: true, axes: labels.length, series: seriesNames.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  importJSON(jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      this._labels = obj.labels || [];
      this._datasets = (obj.datasets || []).map(d => ({ ...d, visible: true }));
      this._axisVisible = this._labels.map(() => true);
      this._axisMins = obj.axisMins || this._labels.map(() => 0);
      this._axisMaxs = obj.axisMaxs || this._labels.map(() => 100);
      this._title = obj.title || '';
      this._subtitle = obj.subtitle || '';
      this._fire('datachange');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  toJSON() {
    return JSON.stringify({
      title: this._title, subtitle: this._subtitle,
      labels: this._labels, datasets: this._datasets,
      axisMins: this._axisMins, axisMaxs: this._axisMaxs,
    }, null, 2);
  }

  toCSV() {
    const hdr = ['Axis', ...this._datasets.map(d => `"${d.name}"`)].join(',');
    const rows = this._labels.map((lbl, li) => {
      const vals = this._datasets.map(d => this._fmt(d.values[li] ?? 0));
      return [`"${lbl}"`, ...vals].join(',');
    });
    return [hdr, ...rows].join('\n');
  }

  clear() {
    this._labels = []; this._axisVisible = []; this._axisMins = []; this._axisMaxs = [];
    this._datasets = []; this._title = this._subtitle = '';
    this._fire('datachange');
  }

  addSeries(name = '', color = null, values = null) {
    const vals = values || this._labels.map(() => 50);
    this._datasets.push({
      name: name || `Series ${this._datasets.length + 1}`,
      values: vals,
      color: color || SERIES_COLORS[this._datasets.length % SERIES_COLORS.length],
      visible: true,
    });
    this._fire('datachange');
  }
  removeSeries(idx) { this._datasets.splice(idx, 1); this._fire('datachange'); }
  updateSeriesName(idx, name) { if (this._datasets[idx]) this._datasets[idx].name = name; this._fire('seriesupdate'); }
  updateSeriesColor(idx, color) { if (this._datasets[idx]) this._datasets[idx].color = color; this._fire('datachange'); }
  updateSeriesVisibility(idx, visible) {
    if (this._datasets[idx]) this._datasets[idx].visible = visible;
    this._fire('visibilitychange', { idx });
  }

  addAxis(label = '') {
    const newLabel = label || `Axis ${this._labels.length + 1}`;
    this._labels.push(newLabel);
    this._axisVisible.push(true);
    this._axisMins.push(0);
    this._axisMaxs.push(100);
    this._datasets.forEach(d => d.values.push(50));
    this._fire('datachange');
  }
  removeAxis(idx) {
    this._labels.splice(idx, 1);
    this._axisVisible.splice(idx, 1);
    this._axisMins.splice(idx, 1);
    this._axisMaxs.splice(idx, 1);
    this._datasets.forEach(d => d.values.splice(idx, 1));
    this._fire('datachange');
  }
  updateAxisLabel(idx, label) { if (this._labels[idx] !== undefined) this._labels[idx] = label; this._fire('labelschange'); }
  toggleAxis(idx, visible) { this._axisVisible[idx] = visible; this._fire('axisvisibility'); }
  setAxisRange(idx, minVal, maxVal) {
    this._axisMins[idx] = minVal;
    this._axisMaxs[idx] = maxVal;
    this._fire('datachange');
  }
  updateSeriesValue(seriesIdx, axisIdx, value) {
    if (this._datasets[seriesIdx]) this._datasets[seriesIdx].values[axisIdx] = value;
    this._fire('datachange');
  }

  setTitle(title, subtitle = '') { this._title = title; this._subtitle = subtitle; this._fire('titlechange'); }

  _fire(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  _splitRow(line) {
    const cells = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }
  _fmt(v) { return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, ''); }
}