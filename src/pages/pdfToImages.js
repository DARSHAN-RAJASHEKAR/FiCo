import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderPdfToImages() {
  let pdfFile = null;

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>PDF → Images</h1>
      <p>Extract every page of your PDF as high-quality PNG images</p>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>
      <div id="file-info" class="file-list" style="display:none"></div>
      <div id="pages-preview" class="pdf-pages-preview" style="display:none"></div>
      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Extract Images
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Loading PDF...</div>
      </div>
      <div id="result" class="result-section" style="display:none"></div>
    </div>
  `;

  const dropzoneMount = page.querySelector('#dropzone-mount');
  const fileInfo = page.querySelector('#file-info');
  const pagesPreview = page.querySelector('#pages-preview');
  const convertBtn = page.querySelector('#convert-btn');
  const progressArea = page.querySelector('#progress-area');
  const progressFill = page.querySelector('#progress-fill');
  const progressText = page.querySelector('#progress-text');
  const result = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf',
    multiple: false,
    icon: '📄',
    title: 'Drop your PDF here',
    subtitle: 'Single PDF file',
    onFiles: handleFile,
  });
  dropzoneMount.appendChild(dropzone);

  async function handleFile(files) {
    const file = files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a valid PDF file', 'error');
      return;
    }

    pdfFile = file;
    result.style.display = 'none';

    fileInfo.style.display = 'flex';
    fileInfo.innerHTML = `
      <div class="file-item">
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px">📄</div>
        <div class="file-item-info">
          <div class="file-item-name">${file.name}</div>
          <div class="file-item-size">${formatBytes(file.size)}</div>
        </div>
        <button class="file-item-remove" id="remove-file">✕</button>
      </div>
    `;

    page.querySelector('#remove-file').addEventListener('click', () => {
      pdfFile = null;
      fileInfo.style.display = 'none';
      pagesPreview.style.display = 'none';
      convertBtn.style.display = 'none';
    });

    // Show preview of first few pages
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      pagesPreview.style.display = 'grid';
      pagesPreview.innerHTML = '';

      const previewCount = Math.min(totalPages, 6);
      for (let i = 1; i <= previewCount; i++) {
        const pg = await pdf.getPage(i);
        const viewport = pg.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pg.render({ canvasContext: ctx, viewport }).promise;

        const thumb = document.createElement('div');
        thumb.className = 'pdf-page-thumb';
        thumb.appendChild(canvas);
        thumb.innerHTML += `<span class="page-num">${i}</span>`;
        pagesPreview.appendChild(thumb);
      }

      if (totalPages > previewCount) {
        const more = document.createElement('div');
        more.className = 'pdf-page-thumb';
        more.style.cssText = 'display:flex;align-items:center;justify-content:center;background:var(--bg-card);min-height:100px;';
        more.innerHTML = `<span style="color:var(--text-muted);font-size:var(--text-sm)">+${totalPages - previewCount} more</span>`;
        pagesPreview.appendChild(more);
      }

      convertBtn.style.display = 'flex';
      convertBtn.disabled = false;
      convertBtn.textContent = `Extract ${totalPages} Page${totalPages > 1 ? 's' : ''} as Images`;
    } catch (err) {
      console.error(err);
      showToast('Failed to load PDF preview', 'error');
    }
  }

  convertBtn.addEventListener('click', async () => {
    if (!pdfFile) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Extracting...';
    progressArea.style.display = 'block';
    result.style.display = 'none';

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const zip = new JSZip();
      const totalPages = pdf.numPages;

      for (let i = 1; i <= totalPages; i++) {
        progressFill.style.width = `${(i / totalPages) * 100}%`;
        progressText.textContent = `Rendering page ${i} of ${totalPages}...`;

        const pg = await pdf.getPage(i);
        const viewport = pg.getViewport({ scale: 2.0 }); // High quality
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pg.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        zip.file(`page-${String(i).padStart(3, '0')}.png`, blob);
      }

      progressText.textContent = 'Creating ZIP archive...';
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipName = pdfFile.name.replace('.pdf', '') + '-images.zip';

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ Images Extracted!</h3>
        <p>${totalPages} page${totalPages > 1 ? 's' : ''} • ${formatBytes(zipBlob.size)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download ZIP</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => {
        saveAs(zipBlob, zipName);
      });

      showToast(`${totalPages} pages extracted successfully!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to extract images: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Extract Images';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
