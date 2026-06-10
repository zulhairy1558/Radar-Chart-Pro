const NS = 'http://www.w3.org/2000/svg';

export class ImageWatermark {
  constructor(svgEl) {
    this.svg = svgEl;
    this.imageData = null;
    this.opacity = 0.2;
  }

  loadImage(file, callback) {
    const reader = new FileReader();
    reader.onload = e => {
      this.imageData = e.target.result;
      callback?.();
    };
    reader.readAsDataURL(file);
  }

  setOpacity(op) { this.opacity = op; }

  render(showText, text, textOpacity, showImage) {
    this._removeOld();
    if (showText && text) this._addText(text, textOpacity);
    if (showImage && this.imageData) this._addImage();
  }

  _addText(text, opacity) {
    const W = Number(this.svg.getAttribute('width')) || 600;
    const H = Number(this.svg.getAttribute('height')) || 500;
    const el = document.createElementNS(NS, 'text');
    el.setAttribute('x', W/2);
    el.setAttribute('y', H/2);
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'middle');
    el.setAttribute('font-size', Math.min(W,H)*0.07);
    el.setAttribute('font-family', "'Syne', sans-serif");
    el.setAttribute('font-weight', '800');
    el.setAttribute('fill', 'var(--chart-label-color)');
    el.setAttribute('opacity', opacity);
    el.setAttribute('transform', `rotate(-25, ${W/2}, ${H/2})`);
    el.setAttribute('class', 'wm-text');
    el.setAttribute('pointer-events', 'none');
    el.textContent = text;
    this.svg.appendChild(el);
  }

  _addImage() {
    const W = Number(this.svg.getAttribute('width')) || 600;
    const H = Number(this.svg.getAttribute('height')) || 500;
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href', this.imageData);
    img.setAttribute('x', W*0.2);
    img.setAttribute('y', H*0.2);
    img.setAttribute('width', W*0.6);
    img.setAttribute('height', H*0.6);
    img.setAttribute('opacity', this.opacity);
    img.setAttribute('class', 'wm-image');
    img.setAttribute('pointer-events', 'none');
    this.svg.appendChild(img);
  }

  _removeOld() {
    this.svg.querySelectorAll('.wm-text, .wm-image').forEach(el => el.remove());
  }
}