// ─────────────────────────────────────────────────────────────────────────────
// TableRenderer.js  –  Sortable data table with inline mini-bar sparklines
//   Responsibility: build and maintain the <table> inside a given container.
//   No knowledge of chart rendering or application state.
// ─────────────────────────────────────────────────────────────────────────────

export class TableRenderer {

  constructor(containerEl) {
    this._container = containerEl;
    this._labels    = [];
    this._datasets  = [];
    this._filter    = '';
    this._sortCol   = null;  // null | -1 (axis) | 0…n-1 (series index)
    this._sortDir   = 'asc';
  }

  setData(labels, datasets) {
    this._labels   = labels;
    this._datasets = datasets;
    this._render();
  }

  setFilter(text) {
    this._filter = text.toLowerCase().trim();
    this._render();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _render() {
    if (!this._labels.length || !this._datasets.length) {
      this._container.innerHTML =
        `<div class="tbl-empty">
           <svg viewBox="0 0 24 24" width="32" height="32" fill="none"
                stroke="currentColor" stroke-width="1.5">
             <path d="M3 6h18M3 12h18M3 18h18"/>
           </svg>
           <p>No data to display</p>
         </div>`;
      return;
    }

    // Build row data
    let rows = this._labels.map((label, i) => ({
      label,
      values: this._datasets.map(d => d.values[i] ?? 0),
      _orig : i,
    }));

    // Filter
    if (this._filter) {
      rows = rows.filter(r => r.label.toLowerCase().includes(this._filter));
    }

    // Sort
    if (this._sortCol !== null) {
      rows.sort((a, b) => {
        const va = this._sortCol === -1 ? a.label : a.values[this._sortCol];
        const vb = this._sortCol === -1 ? b.label : b.values[this._sortCol];
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return this._sortDir === 'asc' ? cmp : -cmp;
      });
    }

    // Column headers
    const thAxis = `<th class="tbl-th tbl-ax sortable ${this._sortCol === -1 ? 'sorted-' + this._sortDir : ''}"
                        data-col="-1">
                      Axis <span class="sort-icon">${this._sortIcon(-1)}</span>
                    </th>`;

    const thSeries = this._datasets.map((d, i) => `
      <th class="tbl-th sortable ${this._sortCol === i ? 'sorted-' + this._sortDir : ''}"
          data-col="${i}" style="--sc:${d.color}">
        <span class="th-swatch" style="background:${d.color}"></span>
        ${_esc(d.name)}
        <span class="sort-icon">${this._sortIcon(i)}</span>
      </th>`).join('');

    // Rows
    const tbody = rows.map(row => {
      const rowMax = Math.max(...row.values, 0.001);
      const cells  = row.values.map((v, i) => {
        const pct = ((v / rowMax) * 100).toFixed(1);
        const fmt = Number.isInteger(v) ? v : v.toFixed(2);
        return `<td class="tbl-td">
                  <span class="cell-val">${fmt}</span>
                  <span class="cell-bar">
                    <span class="cell-bar-fill"
                          style="width:${pct}%;background:${this._datasets[i].color}80">
                    </span>
                  </span>
                </td>`;
      }).join('');
      return `<tr><td class="tbl-td tbl-ax-cell">${_esc(row.label)}</td>${cells}</tr>`;
    }).join('');

    this._container.innerHTML =
      `<table class="data-table" role="grid">
         <thead><tr>${thAxis}${thSeries}</tr></thead>
         <tbody>${tbody}</tbody>
       </table>`;

    // Bind sort events
    this._container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = parseInt(th.dataset.col, 10);
        if (this._sortCol === col) {
          this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this._sortCol = col;
          this._sortDir = 'asc';
        }
        this._render();
      });
    });
  }

  _sortIcon(col) {
    if (this._sortCol !== col) return '⇅';
    return this._sortDir === 'asc' ? '↑' : '↓';
  }
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}