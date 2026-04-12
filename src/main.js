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
      <a href="#/images-to-pdf" class="tool-link-card" id="tool-images-to-pdf">
        <div class="card-icon">🖼️</div>
        <h3>Images → PDF</h3>
        <p>Merge JPG, PNG, or WebP images into a single PDF document</p>
      </a>
      <a href="#/pdf-to-images" class="tool-link-card" id="tool-pdf-to-images">
        <div class="card-icon">📄</div>
        <h3>PDF → Images</h3>
        <p>Extract every page of a PDF as high-quality PNG images</p>
      </a>
      <a href="#/unlock-pdf" class="tool-link-card" id="tool-unlock-pdf">
        <div class="card-icon">🔓</div>
        <h3>Unlock PDF</h3>
        <p>Remove password protection and download an unlocked copy</p>
      </a>
      <a href="#/compress-image" class="tool-link-card" id="tool-compress-image">
        <div class="card-icon">🗜️</div>
        <h3>Compress Image</h3>
        <p>Reduce file size while keeping great visual quality</p>
      </a>
      <a href="#/resize-image" class="tool-link-card" id="tool-resize-image">
        <div class="card-icon">📐</div>
        <h3>Resize Image</h3>
        <p>Change dimensions by pixels, percentage, or presets</p>
      </a>
      <a href="#/ai-analyzer" class="tool-link-card" id="tool-ai-analyzer">
        <div class="card-icon">🤖</div>
        <h3>AI Doc Analyzer</h3>
        <p>Summarize contracts & flag hidden clauses before you sign</p>
      </a>
    </div>
  `;
  return page;
}

const routes = {
  '#/': renderHome,
  '#/images-to-pdf': renderImagesToPdf,
  '#/pdf-to-images': renderPdfToImages,
  '#/unlock-pdf': renderUnlockPdf,
  '#/compress-image': renderCompressImage,
  '#/resize-image': renderResizeImage,
  '#/ai-analyzer': renderAiAnalyzer,
};

function render() {
  const hash = window.location.hash || '#/';
  const renderPage = routes[hash] || renderHome;

  app.innerHTML = '';
  app.appendChild(renderNav());

  const main = document.createElement('main');
  main.className = 'main';
  main.appendChild(renderPage());
  app.appendChild(main);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = 'FiCo — All processing happens locally in your browser. No data is sent anywhere.<br>Built using Antigravity, powered by Claude Opus 4.6.';
  app.appendChild(footer);
}

window.addEventListener('hashchange', render);
render();

// Default hash
if (!window.location.hash) {
  window.location.hash = '#/';
}
