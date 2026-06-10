// ─────────────────────────────────────────────────────────────────────────────
// LegendRenderer.js  –  Interactive series legend
//   Responsibility: render legend items; fire a toggle callback on click.
//   Knows nothing about data state – caller decides how to handle the toggle.
// ─────────────────────────────────────────────────────────────────────────────

export class LegendRenderer {

  /**
   * @param {HTMLElement} containerEl
   * @param {(index:number) => void} onToggle  Called with the series index clicked
   */
  constructor(containerEl, onToggle) {
    this._container = containerEl;
    this._onToggle  = onToggle;
  }

  /** @param {{ name:string, color:string, visible:boolean }[]} datasets */
  render(datasets) {
    if (!datasets.length) { this._container.innerHTML = ''; return; }

    this._container.innerHTML = datasets.map((d, i) => `
      <button class="legend-item ${d.visible ? '' : 'legend-muted'}"
              data-idx="${i}"
              title="${d.visible ? 'Click to hide' : 'Click to show'} ${_esc(d.name)}"
              aria-pressed="${d.visible}">
        <span class="legend-swatch"
              style="background:${d.color};
                     box-shadow:0 0 7px ${d.color}90">
        </span>
        <span class="legend-name">${_esc(d.name)}</span>
        <span class="legend-eye">
          ${d.visible
            ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                    stroke="currentColor" stroke-width="2">
                 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                 <circle cx="12" cy="12" r="3"/>
               </svg>`
            : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                    stroke="currentColor" stroke-width="2">
                 <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
                          a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12
                          4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07
                          a3 3 0 1 1-4.24-4.24"/>
                 <line x1="1" y1="1" x2="23" y2="23"/>
               </svg>`}
        </span>
      </button>
    `).join('');

    this._container.querySelectorAll('.legend-item').forEach(btn => {
      btn.addEventListener('click', () => this._onToggle(parseInt(btn.dataset.idx, 10)));
    });
  }
}

function _esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}