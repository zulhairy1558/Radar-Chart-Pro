// ─────────────────────────────────────────────────────────────────────────────
// TooltipManager.js  –  Floating tooltip: positioning & content rendering
//   Responsibility: show, hide, and correctly position a single tooltip DOM node.
// ─────────────────────────────────────────────────────────────────────────────

export class TooltipManager {

  constructor(el) {
    this.el        = el;
    this._hideTimer = null;
  }

  /**
   * Master update handler – pass the raw event object from RadarRenderer.
   * @param {{ visible:boolean, x?:number, y?:number,
   *           series?:string, axis?:string, value?:number, color?:string }} evt
   */
  update(evt) {
    evt.visible ? this._show(evt) : this._scheduleHide();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _show({ x, y, series, axis, value, color }) {
    clearTimeout(this._hideTimer);

    const display = typeof value === 'number'
      ? value.toFixed(2).replace(/\.?0+$/, '')
      : String(value ?? '–');

    this.el.innerHTML = `
      <div class="tt-row tt-header">
        <span class="tt-swatch" style="background:${color}"></span>
        <span class="tt-series">${_esc(series)}</span>
      </div>
      <div class="tt-row tt-axis">${_esc(axis)}</div>
      <div class="tt-row tt-value" style="color:${color}">${display}</div>
    `;

    this.el.classList.remove('tt-hidden');
    this._position(x, y);
  }

  _scheduleHide() {
    this._hideTimer = setTimeout(() => this.el.classList.add('tt-hidden'), 120);
  }

  _position(cx, cy) {
    const gap  = 14;
    const rect = this.el.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    let left = cx + gap;
    let top  = cy - rect.height / 2;

    if (left + rect.width  > vw - 8) left = cx - rect.width - gap;
    if (top < 8)                      top  = 8;
    if (top + rect.height > vh - 8)   top  = vh - rect.height - 8;

    this.el.style.left = `${left}px`;
    this.el.style.top  = `${top}px`;
  }
}

function _esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}