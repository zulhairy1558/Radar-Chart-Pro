export class DataEntryGrid {
  constructor(container, dataManager) {
    this._container = container;
    this._data = dataManager;
    this._rendered = false;
  }

  render() {
    const labels = this._data.labels;
    const datasets = this._data.datasets;
    const mins = this._data.axisMins;
    const maxs = this._data.axisMaxs;
    if (!labels.length || !datasets.length) {
      this._container.innerHTML = '<div class="tbl-empty">Add axes and series to edit values</div>';
      this._rendered = false;
      return;
    }
    const seriesNames = datasets.map(d => d.name);
    const html = `
      <table class="data-entry-grid">
        <thead>
          <tr>
            <th>Axis / Series</th>
            ${seriesNames.map(s => `<th>${this._escape(s)}</th>`).join('')}
            <th>Min / Max</th>
          </tr>
        </thead>
        <tbody>
          ${labels.map((label, i) => `
            <tr>
              <td><strong>${this._escape(label)}</strong></td>
              ${datasets.map((ds, si) => `
                <td><input type="number" class="entry-val" data-series="${si}" data-axis="${i}" value="${ds.values[i]}" step="any"></td>
              `).join('')}
              <td class="axis-minmax">
                <input type="number" class="axis-min" data-axis="${i}" value="${mins[i]}" step="any" placeholder="min">
                <input type="number" class="axis-max" data-axis="${i}" value="${maxs[i]}" step="any" placeholder="max">
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    this._container.innerHTML = html;
    this._attachEvents();
    this._rendered = true;
  }

  _attachEvents() {
    // Value changes – update DataManager, no re-render
    this._container.querySelectorAll('.entry-val').forEach(inp => {
      inp.removeEventListener('change', this._valueChangeHandler);
      this._valueChangeHandler = (e) => {
        const series = parseInt(inp.dataset.series);
        const axis = parseInt(inp.dataset.axis);
        const val = parseFloat(inp.value);
        if (!isNaN(val)) this._data.updateSeriesValue(series, axis, val);
      };
      inp.addEventListener('change', this._valueChangeHandler);
    });

    // Axis min/max changes – update DataManager, then re-render (but this will lose focus; we accept because it's rare)
    this._container.querySelectorAll('.axis-min, .axis-max').forEach(inp => {
      inp.removeEventListener('change', this._rangeChangeHandler);
      this._rangeChangeHandler = (e) => {
        const axis = parseInt(inp.dataset.axis);
        const minInput = this._container.querySelector(`.axis-min[data-axis="${axis}"]`);
        const maxInput = this._container.querySelector(`.axis-max[data-axis="${axis}"]`);
        const min = parseFloat(minInput.value);
        const max = parseFloat(maxInput.value);
        if (!isNaN(min) && !isNaN(max) && min <= max) {
          this._data.setAxisRange(axis, min, max);
          // Re-render to update min/max display (but will lose focus – acceptable)
          this.render();
        } else {
          // revert to previous values from DataManager
          const currentMin = this._data.axisMins[axis];
          const currentMax = this._data.axisMaxs[axis];
          minInput.value = currentMin;
          maxInput.value = currentMax;
        }
      };
      inp.addEventListener('change', this._rangeChangeHandler);
    });
  }

  _escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}