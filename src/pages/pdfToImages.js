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
      <div id="page-range-selector" style="display:none; margin: 15px 0; gap: 10px; align-items: center; justify-content: center;">
        <label>From page:</label>
        <input type="number" id="page-start" min="1" value="1" style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text);">
        <label>to:</label>
        <input type="number" id="page-end" min="1" value="1" style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text);">
      </div>
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
  const pageRangeSelector = page.querySelector('#page-range-selector');
  const pageStartInput = page.querySelector('#page-start');
  const pageEndInput = page.querySelector('#page-end');
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
      pageRangeSelector.style.display = 'none';
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

      if (totalPages > 1) {
        pageRangeSelector.style.display = 'flex';
        pageStartInput.max = totalPages;
        pageEndInput.max = totalPages;
        pageStartInput.value = 1;
        pageEndInput.value = totalPages;
        
        const updateBtn = () => {
          let s = parseInt(pageStartInput.value) || 1;
          let e = parseInt(pageEndInput.value) || totalPages;
          
          if (s < 1) s = 1;
          if (s > totalPages) s = totalPages;
          if (e > totalPages) e = totalPages;
          
          // Ensure "to" cannot go below "from"
          pageEndInput.min = s;
          if (e < s) {
            e = s;
            pageEndInput.value = s;
          }

          const c = Math.max(0, e - s + 1);
          convertBtn.textContent = `Extract ${c} Page${c !== 1 ? 's' : ''} as Images`;
        };
        pageStartInput.oninput = updateBtn;
        pageEndInput.oninput = updateBtn;
        updateBtn();
      } else {
        pageRangeSelector.style.display = 'none';
        convertBtn.textContent = `Extract 1 Page as Image`;
      }

      convertBtn.style.display = 'flex';
      convertBtn.disabled = false;
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
      const totalPages = pdf.numPages;
      let startPage = 1;
      let endPage = totalPages;
      
      if (totalPages > 1) {
        startPage = parseInt(pageStartInput.value) || 1;
        endPage = parseInt(pageEndInput.value) || totalPages;
      }
      
      const safeStart = Math.max(1, Math.min(startPage, totalPages));
      const safeEnd = Math.max(safeStart, Math.min(endPage, totalPages));
      const pagesToExtract = safeEnd - safeStart + 1;
      
      if (pagesToExtract <= 0) {
        showToast('Invalid page range', 'error');
        return;
      }

      const zip = pagesToExtract > 1 ? new JSZip() : null; // Only create zip if > 1 page
      let singleImageBlob = null; // Store the blob if there's only 1 page

      for (let i = safeStart; i <= safeEnd; i++) {
        const currentIndex = i - safeStart + 1;
        progressFill.style.width = `${(currentIndex / pagesToExtract) * 100}%`;
        progressText.textContent = `Rendering page ${i} of ${safeEnd}...`;

        const pg = await pdf.getPage(i);
        const viewport = pg.getViewport({ scale: 2.0 }); // High quality
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pg.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (pagesToExtract === 1) {
          singleImageBlob = blob;
        } else {
          zip.file(`page-${String(i).padStart(3, '0')}.png`, blob);
        }
      }

      result.style.display = 'block';

      if (pagesToExtract === 1) {
        // Single Page Logic
        const imageName = pdfFile.name.replace('.pdf', '') + `-page-${safeStart}.png`;
        
        result.innerHTML = `
          <h3>✓ Image Extracted!</h3>
          <p>Page ${safeStart} • ${formatBytes(singleImageBlob.size)}</p>
          <button class="btn btn-primary" id="download-result">⬇ Download PNG</button>
        `;
        page.querySelector('#download-result').addEventListener('click', () => {
          saveAs(singleImageBlob, imageName);
        });
      } else {
        // Multi-Page ZIP Logic
        progressText.textContent = 'Creating ZIP archive...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = pdfFile.name.replace('.pdf', '') + `-pages-${safeStart}-${safeEnd}.zip`;

        result.innerHTML = `
          <h3>✓ Images Extracted!</h3>
          <p>${pagesToExtract} pages • ${formatBytes(zipBlob.size)}</p>
          <button class="btn btn-primary" id="download-result">⬇ Download ZIP</button>
        `;
        page.querySelector('#download-result').addEventListener('click', () => {
          saveAs(zipBlob, zipName);
        });
      }

      showToast(`${pagesToExtract} page${pagesToExtract > 1 ? 's' : ''} extracted successfully!`);
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
