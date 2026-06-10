// UIController.js – Composition root (orchestrator)
// All DOM IDs are queried here; feature modules are instantiated and wired.

import { DataManager } from './DataManager.js';
import { RadarRenderer } from './RadarRenderer.js';
import { TooltipManager } from './TooltipManager.js';
import { ThemeManager } from './ThemeManager.js';
import { ExportManager } from './ExportManager.js';
import { TableRenderer } from './TableRenderer.js';
import { LegendRenderer } from './LegendRenderer.js';
import { DataEntryGrid } from './DataEntryGrid.js';
import { ImageWatermark } from './ImageWatermark.js';

const q = s => document.querySelector(s);
const qAll = s => document.querySelectorAll(s);
const on = (target, evt, fn) => {
  const el = typeof target === 'string' ? q(target) : target;
  if (el) el.addEventListener(evt, fn);
};

export class UIController {
  constructor() {
    // Instantiate modules
    this._data = new DataManager();
    this._theme = new ThemeManager();
    this._renderer = new RadarRenderer(q('#radar-svg'));
    this._tooltip = new TooltipManager(q('#tooltip'));
    this._export = new ExportManager(this._renderer, this._data);
    this._table = new TableRenderer(q('#table-container'));
    this._legend = new LegendRenderer(q('#legend'), idx => this._toggleSeries(idx));
    this._dataEntry = new DataEntryGrid(q('#data-entry-container'), this._data);
    this._imageWM = new ImageWatermark(q('#radar-svg'));

    this._renderer.setOnTooltip(e => this._tooltip.update(e));

    // PWA related
    this._deferredPrompt = null;

    this._bindDataEvents();
    this._bindNavbar();
    this._bindSidebar();
    this._bindSettings();
    this._bindExport();
    this._bindUpload();
    this._bindViewTabs();
    this._bindTable();
    this._bindWatermarks();
    this._initPWA();
    this._initOfflineListener();

    this._refreshThemeButtons();
  }

  // ── Data event listeners ──────────────────────────────────────────────
  _bindDataEvents() {
    const d = this._data;
    d.addEventListener('datachange', () => this._onDataChange());
    d.addEventListener('visibilitychange', e => {
      const { idx } = e.detail;
      this._renderer.toggleSeriesVisibility(idx, d.datasets[idx]?.visible);
      this._legend.render(d.datasets);
      this._buildSeriesList();
    });
    d.addEventListener('axisvisibility', () => {
      this._renderer.setAxisVisible(this._data.axisVisible);
      this._redrawFull();
    });
    d.addEventListener('seriesupdate', () => {
      this._buildSeriesList();
      this._legend.render(d.datasets);
    });
    d.addEventListener('labelschange', () => {
      this._buildAxesList();
      this._dataEntry.render();
      this._redrawFull();
    });
    d.addEventListener('titlechange', () => this._updateHeaderDisplay());
  }

  // ── Navbar ────────────────────────────────────────────────────────────
  _bindNavbar() {
    on('#btn-clear', 'click', () => {
      this._data.clear();
      this._toast('Cleared', 'info');
    });
  }

  // ── Sidebar: tabs, collapse, add buttons (with auto‑expand) ───────────
  _bindSidebar() {
    // Collapse / expand
    on('#sidebar-toggle', 'click', () => {
      q('#sidebar').classList.toggle('collapsed');
    });

    // Tab switching
    qAll('.tab-btn').forEach(btn =>
      on(btn, 'click', () => {
        const target = btn.dataset.tab;
        const sidebar = q('#sidebar');
        if (sidebar.classList.contains('collapsed')) sidebar.classList.remove('collapsed');
        qAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        qAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === target));
      })
    );

    // Helper: expand sidebar and switch to Series tab
    const expandAndShowSeriesTab = () => {
      const sidebar = q('#sidebar');
      if (sidebar.classList.contains('collapsed')) sidebar.classList.remove('collapsed');
      const seriesBtn = q('.tab-btn[data-tab="tab-series"]');
      if (seriesBtn && !seriesBtn.classList.contains('active')) seriesBtn.click();
    };

    // Add series / axis
    on('#btn-add-series', 'click', () => {
      this._data.addSeries();
      expandAndShowSeriesTab();
    });
    on('#btn-add-axis', 'click', () => {
      this._data.addAxis();
      expandAndShowSeriesTab();
    });
  }

  // ── Chart settings ────────────────────────────────────────────────────
  _bindSettings() {
    // Range sliders with efficient updates
    const ranges = [
      ['grid-rings', 'rings', parseInt, (v) => { this._renderer.setOptions({ rings: v }); this._redrawFull(); }],
      ['fill-opacity', 'fillOpacity', parseFloat, (v) => this._renderer.updateFillOpacity(v)],
      ['stroke-width', 'strokeWidth', parseFloat, (v) => this._renderer.updateStrokeWidth(v)],
      ['point-size', 'pointRadius', parseInt, (v) => this._renderer.updatePointRadius(v)],
      ['label-font-size', 'labelFontSize', parseInt, (v) => this._renderer.updateLabelFontSize(v)],
    ];
    ranges.forEach(([id, key, parse, updater]) => {
      const input = q(`#${id}`), disp = q(`#${id}-val`);
      on(input, 'input', () => {
        const v = parse(input.value);
        if (disp) disp.textContent = key === 'fillOpacity' ? v.toFixed(2) : v;
        updater(v);
      });
    });

    // Toggles
    on('#show-grid-labels', 'change', e => this._renderer.updateGridLabelsVisibility(e.target.checked));
    on('#smooth-curves', 'change', e => { this._renderer.setOptions({ smoothCurves: e.target.checked }); this._redrawFull(); });
    on('#animate-chart', 'change', e => { this._renderer.setOptions({ animate: e.target.checked }); this._redrawFull(); });
    on('#glow-effect', 'change', e => this._renderer.updateGlowEffect(e.target.checked));
    on('#show-legend', 'change', e => q('#legend').style.display = e.target.checked ? '' : 'none');
    on('#scale-mode', 'change', e => { this._renderer.setOptions({ scaleMode: e.target.value }); this._redrawFull(); });

    // Theme dropdown
    const themeDD = q('#theme-dropdown');
    on('#theme-btn', 'click', e => { e.stopPropagation(); themeDD.classList.toggle('open'); });
    qAll('[data-theme]').forEach(btn =>
      on(btn, 'click', e => {
        e.stopPropagation();
        this._theme.setTheme(btn.dataset.theme);
        themeDD.classList.remove('open');
        this._refreshThemeButtons();
        requestAnimationFrame(() => this._redrawFull());
      })
    );

    // Title inputs
    on('#chart-title-input', 'input', () => this._saveTitle());
    on('#chart-subtitle-input', 'input', () => this._saveTitle());
  }

  // ── Export ────────────────────────────────────────────────────────────
  _bindExport() {
    const dd = q('#export-dropdown');
    on('#export-btn', 'click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
    const actions = {
      'ex-png': () => { this._export.exportPNG(); this._toast('PNG exported', 'success'); },
      'ex-svg': () => { this._export.exportSVG(); this._toast('SVG exported', 'success'); },
      'ex-html': () => { this._export.exportInteractiveHTML(); this._toast('Interactive HTML exported', 'success'); },
      'ex-csv': () => { this._export.exportCSV(); this._toast('CSV exported', 'success'); },
      'ex-json': () => { this._export.exportJSON(); this._toast('JSON exported', 'success'); },
    };
    Object.entries(actions).forEach(([id, fn]) =>
      on(`#${id}`, 'click', () => { dd.classList.remove('open'); fn(); })
    );
  }

  // ── File upload (CSV + JSON) with input reset ─────────────────────────
  _bindUpload() {
    // CSV upload
    const csvZone = q('#upload-zone'), csvInput = q('#file-input');
    on(csvInput, 'change', e => this._handleFile(e.target.files[0], 'csv'));
    csvZone.addEventListener('dragover', e => { e.preventDefault(); csvZone.classList.add('dz-over'); });
    csvZone.addEventListener('dragleave', () => csvZone.classList.remove('dz-over'));
    csvZone.addEventListener('drop', e => {
      e.preventDefault();
      csvZone.classList.remove('dz-over');
      if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0], 'csv');
    });

    // JSON upload
    const jsonZone = q('#json-zone'), jsonInput = q('#json-input');
    on(jsonInput, 'change', e => this._handleFile(e.target.files[0], 'json'));
    jsonZone.addEventListener('dragover', e => { e.preventDefault(); jsonZone.classList.add('dz-over'); });
    jsonZone.addEventListener('dragleave', () => jsonZone.classList.remove('dz-over'));
    jsonZone.addEventListener('drop', e => {
      e.preventDefault();
      jsonZone.classList.remove('dz-over');
      if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0], 'json');
    });
  }

  _handleFile(file, type) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let res;
      if (type === 'csv') res = this._data.parseCSV(e.target.result);
      else res = this._data.importJSON(e.target.result);
      if (res.success) {
        this._setFeedback(`✓ ${res.axes ? `${res.axes} axes · ${res.series} series` : 'JSON loaded'}`, 'success');
        this._toast(res.axes ? `Loaded ${res.axes} axes, ${res.series} series` : 'JSON imported', 'success');
        q('#upload-zone')?.classList.add('dz-loaded');
      } else {
        this._setFeedback(`✗ ${res.error}`, 'error');
        this._toast(`Error: ${res.error}`, 'error');
      }
      // Reset file input to allow re-upload of the same file
      if (type === 'csv') q('#file-input').value = '';
      else q('#json-input').value = '';
    };
    reader.readAsText(file);
  }

  // ── View tabs ─────────────────────────────────────────────────────────
  _bindViewTabs() {
    qAll('.view-tab').forEach(btn =>
      on(btn, 'click', () => {
        qAll('.view-tab').forEach(b => b.classList.toggle('active', b === btn));
        qAll('.view-panel').forEach(p =>
          p.classList.toggle('active', p.id === `view-${btn.dataset.view}`)
        );
        if (btn.dataset.view === 'entry') this._dataEntry.render();
      })
    );
  }

  // ── Table search ──────────────────────────────────────────────────────
  _bindTable() {
    on('#table-search', 'input', e => this._table.setFilter(e.target.value));
  }

  // ── Watermarks (text + image) ─────────────────────────────────────────
  _bindWatermarks() {
    on('#wm-toggle', 'change', () => this._redrawWatermark());
    on('#wm-text', 'input', () => this._redrawWatermark());
    on('#wm-opacity', 'input', e => {
      q('#wm-opacity-val').textContent = parseFloat(e.target.value).toFixed(2);
      this._redrawWatermark();
    });
    on('#img-wm-toggle', 'change', () => this._redrawWatermark());
    on('#img-wm-opacity', 'input', e => {
      q('#img-wm-opacity-val').textContent = parseFloat(e.target.value).toFixed(2);
      this._imageWM.setOpacity(parseFloat(e.target.value));
      this._redrawWatermark();
    });
    on('#img-wm-input', 'change', e => {
      if (e.target.files[0]) {
        this._imageWM.loadImage(e.target.files[0], () => this._redrawWatermark());
      }
    });
  }

  // ── PWA installation ──────────────────────────────────────────────────
  _initPWA() {
    const installBtn = q('#btn-install');
    if (!installBtn) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      installBtn.style.display = '';
    });

    installBtn.addEventListener('click', async () => {
      if (!this._deferredPrompt) return;
      this._deferredPrompt.prompt();
      const { outcome } = await this._deferredPrompt.userChoice;
      console.log(`User ${outcome}`);
      this._deferredPrompt = null;
      installBtn.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
      this._deferredPrompt = null;
      installBtn.style.display = 'none';
      this._toast('RadarViz Pro installed!', 'success');
    });
  }

  // ── Offline / online listener ─────────────────────────────────────────
  _initOfflineListener() {
    window.addEventListener('online', () => this._toast('Back online', 'success'));
    window.addEventListener('offline', () => this._toast('No internet – using cached app', 'info'));
  }

  // ── Core data flow ────────────────────────────────────────────────────
  _onDataChange() {
    const { labels, datasets, hasData } = this._data;
    this._renderer.setData(labels, datasets);
    this._renderer.setAxisVisible(this._data.axisVisible);
    this._table.setData(labels, datasets);
    this._legend.render(datasets);
    this._buildSeriesList();
    this._buildAxesList();
    this._updateHeaderDisplay();
    this._dataEntry.render();

    q('#chart-placeholder').style.display = hasData ? 'none' : '';
    q('#radar-svg').style.display = hasData ? 'block' : 'none';
    q('#row-count').textContent = hasData ? `${labels.length} axes · ${datasets.length} series` : '';

    if (hasData) {
      requestAnimationFrame(() => this._redrawFull());
    }
  }

  _redrawFull() {
    if (this._data.hasData) {
      this._renderer.setData(this._data.labels, this._data.datasets);
      this._renderer.setAxisVisible(this._data.axisVisible);
      this._renderer.render();
      this._redrawWatermark();
    }
  }

  _redrawWatermark() {
    const svg = q('#radar-svg');
    if (!svg.getAttribute('width') || svg.getAttribute('width') === 'undefined') return;
    this._imageWM.render(
      q('#wm-toggle').checked,
      q('#wm-text').value,
      parseFloat(q('#wm-opacity').value),
      q('#img-wm-toggle').checked
    );
  }

  // ── Series list builder (with visibility sync) ────────────────────────
  _buildSeriesList() {
    const container = q('#series-list');
    const datasets = this._data.datasets;
    if (!datasets.length) {
      container.innerHTML = '<p class="list-empty">No series yet.</p>';
      return;
    }
    container.innerHTML = datasets.map((d, i) => `
      <div class="series-row" data-idx="${i}">
        <input class="sr-color" type="color" value="${d.color}" data-idx="${i}" title="Change colour">
        <input class="sr-name" type="text" value="${this._escape(d.name)}" data-idx="${i}" placeholder="Name">
        <label class="toggle-sw mini" title="${d.visible ? 'Visible' : 'Hidden'}">
          <input class="sr-vis" type="checkbox" ${d.visible ? 'checked' : ''} data-idx="${i}">
          <span class="sw-thumb"></span>
        </label>
        <button class="sr-del icon-btn" data-idx="${i}" title="Remove series">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.sr-color').forEach(el =>
      on(el, 'change', () => this._data.updateSeriesColor(+el.dataset.idx, el.value))
    );
    container.querySelectorAll('.sr-name').forEach(el =>
      on(el, 'change', () => this._data.updateSeriesName(+el.dataset.idx, el.value))
    );
    container.querySelectorAll('.sr-vis').forEach(el =>
      on(el, 'change', () => this._data.updateSeriesVisibility(+el.dataset.idx, el.checked))
    );
    container.querySelectorAll('.sr-del').forEach(el =>
      on(el, 'click', () => this._data.removeSeries(+el.dataset.idx))
    );
  }

  // ── Axes list builder (with visibility toggle) ────────────────────────
  _buildAxesList() {
    const container = q('#axes-list');
    const labels = this._data.labels;
    const visible = this._data.axisVisible;
    if (!labels.length) {
      container.innerHTML = '<p class="list-empty">No axes yet.</p>';
      return;
    }
    container.innerHTML = labels.map((lbl, i) => `
      <div class="axis-row" data-idx="${i}">
        <span class="ax-num">${i + 1}</span>
        <input class="ax-name" type="text" value="${this._escape(lbl)}" data-idx="${i}" placeholder="Label">
        <label class="toggle-sw mini" title="${visible[i] ? 'Visible' : 'Hidden'}">
          <input class="ax-vis" type="checkbox" ${visible[i] ? 'checked' : ''} data-idx="${i}">
          <span class="sw-thumb"></span>
        </label>
        <button class="ax-del icon-btn" data-idx="${i}" ${labels.length <= 3 ? 'disabled' : ''} title="Remove axis">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.ax-name').forEach(el =>
      on(el, 'change', () => this._data.updateAxisLabel(+el.dataset.idx, el.value))
    );
    container.querySelectorAll('.ax-vis').forEach(el =>
      on(el, 'change', () => this._data.toggleAxis(+el.dataset.idx, el.checked))
    );
    container.querySelectorAll('.ax-del:not([disabled])').forEach(el =>
      on(el, 'click', () => this._data.removeAxis(+el.dataset.idx))
    );
  }

  // ── Legend toggle callback ────────────────────────────────────────────
  _toggleSeries(idx) {
    const ds = this._data.datasets[idx];
    if (ds) this._data.updateSeriesVisibility(idx, !ds.visible);
  }

  // ── Title handling ─────────────────────────────────────────────────────
  _saveTitle() {
    this._data.setTitle(
      q('#chart-title-input').value.trim(),
      q('#chart-subtitle-input').value.trim()
    );
  }

  _updateHeaderDisplay() {
    const title = this._data.title;
    const subtitle = this._data.subtitle;
    const hdr = q('#chart-header');
    q('#chart-title-display').textContent = title;
    q('#chart-subtitle-display').textContent = subtitle;
    hdr.style.display = (title || subtitle) ? 'block' : 'none';

    // Sync inputs without triggering extra events
    const ti = q('#chart-title-input');
    const si = q('#chart-subtitle-input');
    if (document.activeElement !== ti) ti.value = title;
    if (document.activeElement !== si) si.value = subtitle;
  }

  // ── Theme buttons ─────────────────────────────────────────────────────
  _refreshThemeButtons() {
    const cur = this._theme.current;
    qAll('[data-theme]').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.theme === cur)
    );
  }

  // ── Toast & feedback ──────────────────────────────────────────────────
  _setFeedback(msg, type) {
    const fb = q('#upload-feedback');
    if (fb) {
      fb.textContent = msg;
      fb.className = `upload-feedback ${type}`;
    }
  }

  _toast(msg, type = 'info') {
    const el = q('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast-${type} toast-show`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('toast-show'), 3200);
  }

  _escape(s = '') {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}