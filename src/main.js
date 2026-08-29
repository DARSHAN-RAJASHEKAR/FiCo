// Drop-in replacement for src/main.js. The router, navigation, popstate
// handler, and all page route mappings are identical to the original — only
// the home (renderHome) and 404 (render404) markup change to match the
// "Bureau Ledger" aesthetic. All backend logic in src/pages/* is untouched.

import './style.css';
import { renderNav } from './components/nav.js';
import { renderImagesToPdf } from './pages/imagesToPdf.js';
import { renderPdfToImages } from './pages/pdfToImages.js';
import { renderMergePdf } from './pages/mergePdf.js';
import { renderSplitPdf } from './pages/splitPdf.js';
import { renderUnlockPdf } from './pages/unlockPdf.js';
import { renderCompressImage } from './pages/compressImage.js';
import { renderResizeImage } from './pages/resizeImage.js';
import { renderAiAnalyzer } from './pages/aiAnalyzer.js';
import { renderDocToPdf } from './pages/docToPdf.js';

const app = document.querySelector('#app');

const TOOLS = [
  { path: '/images-to-pdf',  icon: '🖼️', title: 'Images → PDF',     blurb: 'Merge JPG, PNG, or WebP images into a single PDF' },
  { path: '/pdf-to-images',  icon: '📄', title: 'PDF → Images',     blurb: 'Extract every page of a PDF as high-quality PNGs' },
  { path: '/merge-pdf',      icon: '📎', title: 'Merge PDF',        blurb: 'Combine multiple PDFs into one, in any order' },
  { path: '/split-pdf',      icon: '✂️', title: 'Split PDF',        blurb: 'Extract page ranges or break a PDF into separate files' },
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
      <p>nine small instruments &middot; for keeping documents &middot; in good order</p>
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
      <span>QTY &middot; ${String(TOOLS.length).padStart(2, '0')}</span>
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
  '/merge-pdf': renderMergePdf,
  '/split-pdf': renderSplitPdf,
  '/unlock-pdf': renderUnlockPdf,
  '/compress-image': renderCompressImage,
  '/resize-image': renderResizeImage,
  '/ai-analyzer': renderAiAnalyzer,
  '/doc-to-pdf': renderDocToPdf,
};

const SITE_NAME = 'FiCo — Bureau of Small File Works';

const ROUTE_META = {
  '/': {
    title: SITE_NAME,
    description: 'A small bureau of nine file utilities. Convert, compress, merge, split, unlock, and analyse documents — entirely in your browser. Nothing is uploaded.',
  },
  '/images-to-pdf': {
    title: `Images to PDF Converter — ${SITE_NAME}`,
    description: 'Merge JPG, PNG, or WebP images into a single PDF, entirely in your browser. No uploads, no accounts — free and private.',
  },
  '/pdf-to-images': {
    title: `PDF to Images Converter — ${SITE_NAME}`,
    description: 'Extract every page of a PDF as high-quality PNG images, processed locally in your browser. Nothing is uploaded.',
  },
  '/merge-pdf': {
    title: `Merge PDF Files — ${SITE_NAME}`,
    description: 'Combine multiple PDFs into one document, in any order you choose. Fast, free, and processed entirely in your browser.',
  },
  '/split-pdf': {
    title: `Split PDF — ${SITE_NAME}`,
    description: 'Extract page ranges, split every N pages, or break a PDF into individual pages — all processed locally in your browser.',
  },
  '/unlock-pdf': {
    title: `Unlock PDF — Remove Password — ${SITE_NAME}`,
    description: 'Strip password protection from a PDF using its password, entirely in your browser. Nothing is uploaded to a server.',
  },
  '/compress-image': {
    title: `Compress Image — ${SITE_NAME}`,
    description: 'Reduce image file size while keeping great visual quality. Fast, free, browser-based image compression.',
  },
  '/resize-image': {
    title: `Resize Image — ${SITE_NAME}`,
    description: 'Change image dimensions by pixels, percentage, or common presets — instantly, in your browser.',
  },
  '/ai-analyzer': {
    title: `AI Document Analyzer — ${SITE_NAME}`,
    description: 'Summarise contracts and flag hidden clauses before you sign, powered by AI.',
  },
  '/doc-to-pdf': {
    title: `Docs to PDF Converter — ${SITE_NAME}`,
    description: 'Convert Word documents and text files to PDF instantly, right in your browser.',
  },
};

const NOT_FOUND_META = {
  title: `404 · Page Not Found — ${SITE_NAME}`,
  description: 'The page you requested isn\'t in the bureau\'s registry.',
};

function updateMeta(path) {
  const meta = ROUTE_META[path] || NOT_FOUND_META;
  document.title = meta.title;
  const descTag = document.querySelector('meta[name="description"]');
  if (descTag) descTag.setAttribute('content', meta.description);
}

function render() {
  const path = window.location.pathname;
  const renderPage = routes[path] || render404;

  updateMeta(path);

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
