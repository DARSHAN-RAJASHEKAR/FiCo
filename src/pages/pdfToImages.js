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

function formatNum(n) { return String(n).padStart(2, '0'); }

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderPdfToImages() {
  let files = []; // { file, totalPages }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 02</span>
      <h1>PDF → Images.</h1>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>

      <div id="file-list-section" style="display:none">
        <div class="file-list" id="file-list">
          <div class="bureau-slip-head">
            <span>SLIP B · MATERIALS ENUMERATED</span>
            <span id="slip-b-count"></span>
          </div>
        </div>
      </div>

      <div id="options-section" style="display:none">
        <div class="options-bar bureau-opts">
          <div class="bureau-slip-head">
            <span>SLIP C · OPTIONS &amp; PREFERENCES</span>
            <span>SELECT ONE</span>
          </div>
          <div class="opt-group">
            <div class="opt-label">Resolution</div>
            <label class="opt-row"><input type="radio" name="resolution" value="150" checked/><span class="box">Standard · 150 dpi</span></label>
            <label class="opt-row"><input type="radio" name="resolution" value="200"/><span class="box">Good · 200 dpi</span></label>
            <label class="opt-row"><input type="radio" name="resolution" value="300"/><span class="box">High · 300 dpi</span></label>
          </div>
          <div class="opt-group" id="range-group" style="display:none">
            <div class="opt-label">Page range</div>
            <div class="page-range-row">
              <span class="opt-label" style="font-size:11px;margin-bottom:0">From</span>
              <input type="number" id="page-start" min="1" value="1" class="bureau-num-input" />
              <span class="opt-label" style="font-size:11px;margin-bottom:0">to</span>
              <input type="number" id="page-end" min="1" value="1" class="bureau-num-input" />
              <span id="range-hint" style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)"></span>
            </div>
          </div>
          <div class="opt-group" id="multi-note" style="display:none">
            <div class="opt-label">Page range</div>
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--ink-2)">
              Multiple PDFs — every page of each file will be extracted.
            </div>
          </div>
        </div>
      </div>

      <div id="totals-section" class="bureau-slip is-totals" style="display:none">
        <div class="bureau-slip-head">
          <span>SLIP D · TOTALS</span>
          <span>EST. ONLY</span>
        </div>
        <div class="bureau-slip-row"><span class="k">source</span><span class="d"></span><span class="v" id="totals-filename">—</span></div>
        <div class="bureau-slip-row"><span class="k">pages to extract</span><span class="d"></span><span class="v" id="totals-pages">—</span></div>
        <div class="bureau-slip-row bureau-totals"><span class="k">TOTAL</span><span class="d"></span><span class="v" id="totals-output">—</span></div>
      </div>

      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Develop &amp; Export →
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Loading PDF...</div>
      </div>
      <div id="result" class="result-section" style="display:none"></div>
    </div>
  `;

  const dropzoneMount   = page.querySelector('#dropzone-mount');
  const fileListSection = page.querySelector('#file-list-section');
  const fileList        = page.querySelector('#file-list');
  const slipBCount      = page.querySelector('#slip-b-count');
  const optionsSection  = page.querySelector('#options-section');
  const rangeGroup      = page.querySelector('#range-group');
  const multiNote       = page.querySelector('#multi-note');
  const pageStartInput  = page.querySelector('#page-start');
  const pageEndInput    = page.querySelector('#page-end');
  const rangeHint       = page.querySelector('#range-hint');
  const totalsSection   = page.querySelector('#totals-section');
  const totalsFilename  = page.querySelector('#totals-filename');
  const totalsPages     = page.querySelector('#totals-pages');
  const totalsOutput    = page.querySelector('#totals-output');
  const convertBtn      = page.querySelector('#convert-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const result          = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf',
    multiple: true,
    icon: '📄',
    title: 'Drop your PDFs here.',
    subtitle: 'accepts: pdf · multiple files supported',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  function updateTotals() {
    if (files.length === 1) {
      const start = parseInt(pageStartInput.value) || 1;
      const end   = parseInt(pageEndInput.value)   || files[0].totalPages;
      const count = Math.max(0, end - start + 1);
      rangeHint.textContent = `${count} page${count !== 1 ? 's' : ''}`;
      totalsPages.textContent  = formatNum(count);
      totalsOutput.textContent = `${formatNum(count)} ${count === 1 ? 'IMAGE' : 'IMAGES'}`;
      convertBtn.textContent = count === 1
        ? 'Develop & Export →'
        : `Develop ${formatNum(count)} Pages →`;
    } else {
      const count = files.reduce((s, f) => s + f.totalPages, 0);
      totalsPages.textContent  = formatNum(count);
      totalsOutput.textContent = `${formatNum(count)} ${count === 1 ? 'IMAGE' : 'IMAGES'}`;
      convertBtn.textContent = `Develop ${formatNum(count)} Pages →`;
    }
  }

  function renderFileList() {
    result.style.display = 'none';

    if (!files.length) {
      fileListSection.style.display = 'none';
      optionsSection.style.display  = 'none';
      totalsSection.style.display   = 'none';
      convertBtn.style.display      = 'none';
      return;
    }

    const totalSize = files.reduce((s, f) => s + f.file.size, 0);
    slipBCount.textContent =
      `${formatNum(files.length)} ITEM${files.length > 1 ? 'S' : ''} · ${formatBytes(totalSize)}`;

    const head = fileList.querySelector('.bureau-slip-head');
    fileList.innerHTML = '';
    fileList.appendChild(head);

    files.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
          font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">
          ${formatNum(i + 1)}
        </div>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(f.file.name)}</div>
          <div class="file-item-size">${f.totalPages} page${f.totalPages !== 1 ? 's' : ''} · ${formatBytes(f.file.size)}</div>
        </div>
        <button class="file-item-remove" data-index="${i}" title="Remove">✕</button>
      `;
      fileList.appendChild(row);
    });

    fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        files.splice(idx, 1);
        renderFileList();
      });
    });

    if (files.length === 1) {
      const totalPages = files[0].totalPages;
      multiNote.style.display = 'none';

      if (totalPages > 1) {
        rangeGroup.style.display = 'block';
        pageStartInput.max = totalPages;
        pageEndInput.max   = totalPages;
        pageStartInput.value = 1;
        pageEndInput.value   = totalPages;
        pageStartInput.oninput = () => {
          let s = parseInt(pageStartInput.value) || 1;
          if (s < 1) s = 1;
          if (s > totalPages) s = totalPages;
          pageEndInput.min = s;
          if (parseInt(pageEndInput.value) < s) pageEndInput.value = s;
          updateTotals();
        };
        pageEndInput.oninput = updateTotals;
      } else {
        rangeGroup.style.display = 'none';
        pageStartInput.value = 1;
        pageEndInput.value   = 1;
      }

      totalsFilename.textContent = files[0].file.name.length > 28
        ? files[0].file.name.slice(0, 25) + '...'
        : files[0].file.name;
    } else {
      rangeGroup.style.display = 'none';
      multiNote.style.display  = 'block';
      totalsFilename.textContent = `${files.length} PDFs`;
    }

    updateTotals();

    fileListSection.style.display = 'block';
    optionsSection.style.display  = 'block';
    totalsSection.style.display   = 'block';
    convertBtn.style.display      = 'flex';
    convertBtn.disabled           = false;
  }

  async function addFiles(newFiles) {
    const valid = newFiles.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!valid.length) {
      showToast('Please select valid PDF files', 'error');
      return;
    }

    for (const file of valid) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        files.push({ file, totalPages: pdf.numPages });
      } catch (err) {
        console.error(err);
        showToast(`Failed to load ${file.name}`, 'error');
      }
    }

    renderFileList();
  }

  function getScale() {
    const dpi = parseInt(page.querySelector('input[name="resolution"]:checked')?.value || '150');
    return dpi / 72; // pdfjs viewport scale = dpi / 72
  }

  convertBtn.addEventListener('click', async () => {
    if (!files.length) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Processing...';
    progressArea.style.display = 'block';
    result.style.display = 'none';

    try {
      const scale = getScale();
      let jobs; // { file, start, end }

      if (files.length === 1) {
        const f = files[0];
        const startPage = parseInt(pageStartInput.value) || 1;
        const endPage   = parseInt(pageEndInput.value)   || f.totalPages;
        const safeStart = Math.max(1, Math.min(startPage, f.totalPages));
        const safeEnd   = Math.max(safeStart, Math.min(endPage, f.totalPages));
        if (safeEnd - safeStart + 1 <= 0) { showToast('Invalid page range', 'error'); return; }
        jobs = [{ file: f.file, start: safeStart, end: safeEnd }];
      } else {
        jobs = files.map(f => ({ file: f.file, start: 1, end: f.totalPages }));
      }

      const totalPagesToRender = jobs.reduce((s, j) => s + (j.end - j.start + 1), 0);
      const zip = totalPagesToRender > 1 ? new JSZip() : null;
      let singleBlob = null;
      let singleName = null;
      let rendered = 0;

      for (let idx = 0; idx < jobs.length; idx++) {
        const job = jobs[idx];
        const arrayBuffer = await job.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const baseName = job.file.name.replace(/\.pdf$/i, '');
        const folder = zip && jobs.length > 1 ? zip.folder(`${formatNum(idx + 1)}-${baseName}`) : zip;

        for (let i = job.start; i <= job.end; i++) {
          rendered++;
          progressFill.style.width = `${(rendered / totalPagesToRender) * 100}%`;
          progressText.textContent = `Rendering ${baseName} — page ${i} of ${job.end}...`;

          const pg = await pdf.getPage(i);
          const viewport = pg.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await pg.render({ canvasContext: ctx, viewport }).promise;

          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
          if (!zip) {
            singleBlob = blob;
            singleName = `${baseName}-page-${i}.png`;
          } else {
            folder.file(`page-${String(i).padStart(3, '0')}.png`, blob);
          }
        }
      }

      result.style.display = 'block';

      if (!zip) {
        result.innerHTML = `
          <h3>✓ Image Ready!</h3>
          <p>${formatBytes(singleBlob.size)}</p>
          <button class="btn btn-primary" id="download-result">⬇ Download PNG</button>
        `;
        page.querySelector('#download-result').addEventListener('click', () => saveAs(singleBlob, singleName));
      } else {
        progressText.textContent = 'Packaging archive...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = jobs.length === 1
          ? `${jobs[0].file.name.replace(/\.pdf$/i, '')}-pages-${jobs[0].start}-${jobs[0].end}.zip`
          : 'pdf-images.zip';
        result.innerHTML = `
          <h3>✓ Images Ready!</h3>
          <p>${totalPagesToRender} page${totalPagesToRender > 1 ? 's' : ''} · ${formatBytes(zipBlob.size)}</p>
          <button class="btn btn-primary" id="download-result">⬇ Download ZIP</button>
        `;
        page.querySelector('#download-result').addEventListener('click', () => saveAs(zipBlob, zipName));
      }

      showToast(`${totalPagesToRender} page${totalPagesToRender > 1 ? 's' : ''} extracted!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to extract images: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      convertBtn.innerHTML = 'Develop &amp; Export →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
