// ─────────────────────────────────────────────────────────────────────────────
// main.js  –  Application entry point
//   Single responsibility: wait for DOM, boot UIController.
// ─────────────────────────────────────────────────────────────────────────────

import { UIController } from './UIController.js';

document.addEventListener('DOMContentLoaded', () => new UIController());