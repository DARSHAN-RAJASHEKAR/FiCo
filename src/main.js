import './style.css';
import { renderNav } from './components/nav.js';
import { renderImagesToPdf } from './pages/imagesToPdf.js';
import { renderPdfToImages } from './pages/pdfToImages.js';
import { renderUnlockPdf } from './pages/unlockPdf.js';
import { renderCompressImage } from './pages/compressImage.js';
import { renderResizeImage } from './pages/resizeImage.js';
import { renderAiAnalyzer } from './pages/aiAnalyzer.js';

const app = document.querySelector('#app');

function renderHome() {
  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>File Converter</h1>
      <p>Fast, private, and free. Everything runs in your browser — no uploads to any server.</p>
    </div>
    <div class="tools-grid">
      <a href="/images-to-pdf" class="tool-link-card" id="tool-images-to-pdf">
        <div class="card-icon">🖼️</div>
        <h3>Images → PDF</h3>
        <p>Merge JPG, PNG, or WebP images into a single PDF document</p>
      </a>
      <a href="/pdf-to-images" class="tool-link-card" id="tool-pdf-to-images">
        <div class="card-icon">📄</div>
        <h3>PDF → Images</h3>
        <p>Extract every page of a PDF as high-quality PNG images</p>
      </a>
      <a href="/unlock-pdf" class="tool-link-card" id="tool-unlock-pdf">
        <div class="card-icon">🔓</div>
        <h3>Unlock PDF</h3>
        <p>Remove password protection and download an unlocked copy</p>
      </a>
      <a href="/compress-image" class="tool-link-card" id="tool-compress-image">
        <div class="card-icon">🗜️</div>
        <h3>Compress Image</h3>
        <p>Reduce file size while keeping great visual quality</p>
      </a>
      <a href="/resize-image" class="tool-link-card" id="tool-resize-image">
        <div class="card-icon">📐</div>
        <h3>Resize Image</h3>
        <p>Change dimensions by pixels, percentage, or presets</p>
      </a>
      <a href="/ai-analyzer" class="tool-link-card" id="tool-ai-analyzer">
        <div class="card-icon">🤖</div>
        <h3>AI Doc Analyzer</h3>
        <p>Summarize contracts & flag hidden clauses before you sign</p>
      </a>
    </div>
  `;
  return page;
}

function render404() {
  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header" style="text-align:center; padding: 100px 20px;">
      <div style="font-size: 80px; margin-bottom: 20px;">🕵️‍♂️</div>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist or has moved.</p>
      <a href="/" class="btn btn-primary" style="margin-top: 30px; display: inline-block;">Back to Home</a>
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
  footer.innerHTML = 'FiCo — All processing happens locally in your browser. No data is sent anywhere.<br>Built using Antigravity, powered by Gemini 2.5 Flash.';
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
