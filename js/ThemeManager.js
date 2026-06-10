// ─────────────────────────────────────────────────────────────────────────────
// ThemeManager.js  –  CSS theme application and persistence
//   Responsibility: set data-theme attribute on <html>; persist choice.
//   Themes are defined entirely in style.css via [data-theme="x"] selectors.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rviz-theme';
const VALID_THEMES = new Set(['dark', 'light', 'ocean', 'aurora', 'carbon', 'paper']);

export class ThemeManager {

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    this._current = VALID_THEMES.has(stored) ? stored : 'dark';
    this._apply(this._current);
  }

  get current() { return this._current; }

  /** @param {'dark'|'light'|'ocean'|'aurora'|'carbon'|'paper'} theme */
  setTheme(theme) {
    if (!VALID_THEMES.has(theme)) return;
    this._current = theme;
    this._apply(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
}