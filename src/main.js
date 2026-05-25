// Drop-in replacement for src/main.js. The router, navigation, popstate
// handler, and all page route mappings are identical to the original — only
// the home (renderHome) and 404 (render404) markup change to match the
// "Bureau Ledger" aesthetic. All backend logic in src/pages/* is untouched.

import './style.css';
import { renderNav } from './components/nav.js';
import { renderImagesToPdf } from './pages/imagesToPdf.js';
import { renderPdfToImages } from './pages/pdfToImages.js';
import { renderUnlockPdf } from './pages/unlockPdf.js';
import { renderCompressImage } from './pages/compressImage.js';
import { renderResizeImage } from './pages/resizeImage.js';
import { renderAiAnalyzer } from './pages/aiAnalyzer.js';
import { renderDocToPdf } from './pages/docToPdf.js';

const app = document.querySelector('#app');

const TOOLS = [
  { path: '/images-to-pdf',  icon: '🖼️', title: 'Images → PDF',     blurb: 'Merge JPG, PNG, or WebP images into a single PDF' },
  { path: '/pdf-to-images',  icon: '📄', title: 'PDF → Images',     blurb: 'Extract every page of a PDF as high-quality PNGs' },
  { path: '/unlock-pdf',     icon: '🔓', title: 'Unlock PDF',       blurb: 'Strip password protection from a PDF' },
  { path: '/compress-image', icon: '🗜️', title: 'Compress Image',  blurb: 'Reduce file size while keeping great visual quality' },
  { path: '/resize-image',   icon: '📐', title: 'Resize Image',     blurb: 'Change dimensions by pixels, percentage, or presets' },
  { path: '/ai-analyzer',    icon: '🤖', title: 'AI Doc Analyzer',  blurb: 'Summarise contracts & flag hidden clauses before you sign' },
  { path: '/doc-to-pdf',     icon: '📝', title: 'Docs → PDF',       blurb: 'Convert Word documents & text files to PDF instantly' },
];

function renderHome() {
  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-bureau">
      <h1>The File Bureau.</h1>
      <p>seven small instruments &middot; for keeping documents &middot; in good order</p>
      <div class="bureau-stamp" aria-hidden="true">Local-Only &middot; Nothing Uploaded</div>
    </div>
    <aside class="bureau-slip" aria-label="Bureau information">
      <div class="bureau-slip-head">
        <span>SLIP &#8470; 001 &middot; INTAKE</span>
        <span>00:00:00</span>
      </div>
      <div class="bureau-slip-row"><span class="k">how it works</span><span class="d"></span><span class="v">drop &middot; choose &middot; download</span></div>
      <div class="bureau-slip-row"><span class="k">where files go</span><span class="d"></span><span class="v">your device &middot; nowhere else</span></div>
    </aside>
    <div class="bureau-slip-head register-head">
      <span>SLIP &#8470; 002 &middot; REGISTER OF TOOLS</span>
      <span>QTY &middot; 07</span>
    </div>
    <div class="tools-grid" aria-label="Register of tools">
      ${TOOLS.map(t => `
        <a href="${t.path}" class="tool-link-card" id="tool-${t.path.slice(1)}">
          <span class="card-icon" aria-hidden="true">${t.icon}</span>
          <div>
            <h3>${t.title}</h3>
            <p>${t.blurb}</p>
          </div>
        </a>
      `).join('')}
    </div>
  `;
  return page;
}

function render404() {
  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>404 · Slip not on file.</h1>
      <p>The page you requested isn't in the bureau's registry. Try the ledger.</p>
    </div>
    <div style="text-align:center;margin-top:32px">
      <a href="/" class="btn btn-primary btn-large" style="display:inline-flex">▸ Back to Ledger</a>
    </div>
  `;
  return page;
}

const routes = {
  '/': renderHome,
  '/images-to-pdf': renderImagesToPdf,
  '/pdf-to-images': renderPdfToImages,
  '/unlock-pdf': renderUnlockPdf,
  '/compress-image': renderCompressImage,
  '/resize-image': renderResizeImage,
  '/ai-analyzer': renderAiAnalyzer,
  '/doc-to-pdf': renderDocToPdf,
};

function render() {
  const path = window.location.pathname;
  const renderPage = routes[path] || render404;

  app.innerHTML = '';
  app.appendChild(renderNav());

  const main = document.createElement('main');
  main.className = 'main';
  main.appendChild(renderPage());
  app.appendChild(main);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    FiCo — all processing happens locally in your browser. No data is sent anywhere.<br/>
    Built using <a href="https://antigravity.google/" target="_blank" rel="noopener noreferrer">Antigravity</a>, powered by Gemini 3.1 Pro and Claude Opus 4.6.
  `;
  app.appendChild(footer);
}

// Navigation handling
export function navigateTo(url) {
  window.history.pushState(null, null, url);
  render();
}

window.addEventListener('popstate', render);

// Hijack link clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href.startsWith(window.location.origin)) {
    e.preventDefault();
    navigateTo(link.getAttribute('href'));
  }
});

// Initial render
render();
