import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

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

export function renderMergePdf() {
  let pdfs = []; // { file, pageCount }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 03</span>
      <h1>Merge PDF.</h1>
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

      <div id="totals-section" class="bureau-slip is-totals" style="display:none">
        <div class="bureau-slip-head">
          <span>SLIP C · TOTALS</span>
          <span>EST. ONLY</span>
        </div>
        <div class="bureau-slip-row"><span class="k">filename</span><span class="d"></span><span class="v">merged.pdf</span></div>
        <div class="bureau-slip-row"><span class="k">files</span><span class="d"></span><span class="v" id="totals-files">—</span></div>
        <div class="bureau-slip-row"><span class="k">pages</span><span class="d"></span><span class="v" id="totals-pages">—</span></div>
        <div class="bureau-slip-row bureau-totals"><span class="k">TOTAL SIZE</span><span class="d"></span><span class="v" id="totals-output">—</span></div>
      </div>

      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Bind &amp; Merge →
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Preparing...</div>
      </div>
      <div id="result" class="result-section" style="display:none"></div>
    </div>
  `;

  const dropzoneMount   = page.querySelector('#dropzone-mount');
  const fileListSection = page.querySelector('#file-list-section');
  const fileList        = page.querySelector('#file-list');
  const slipBCount      = page.querySelector('#slip-b-count');
  const totalsSection   = page.querySelector('#totals-section');
  const totalsFiles     = page.querySelector('#totals-files');
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
    icon: '📎',
    title: 'Drop PDFs here.',
    subtitle: 'accepts: pdf · add two or more',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  async function addFiles(files) {
    const valid = files.filter(f => f.type === 'application/pdf');
    if (!valid.length) { showToast('Please select PDF files.', 'error'); return; }

    for (const file of valid) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        pdfs.push({ file, pageCount: doc.getPageCount() });
      } catch (err) {
        console.error(err);
        showToast(`Could not read "${file.name}" — skipped.`, 'error');
      }
    }
    renderPreview();
  }

  function totalBytes() { return pdfs.reduce((s, p) => s + p.file.size, 0); }
  function totalPages() { return pdfs.reduce((s, p) => s + p.pageCount, 0); }

  function renderPreview() {
    result.style.display = 'none';

    if (!pdfs.length) {
      fileListSection.style.display = 'none';
      totalsSection.style.display   = 'none';
      convertBtn.style.display      = 'none';
      return;
    }

    slipBCount.textContent =
      `${formatNum(pdfs.length)} ITEM${pdfs.length > 1 ? 'S' : ''} · ${formatBytes(totalBytes())}`;

    const head = fileList.querySelector('.bureau-slip-head');
    fileList.innerHTML = '';
    fileList.appendChild(head);

    pdfs.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'file-item';
      row.draggable = true;
      row.dataset.index = i;
      row.innerHTML = `
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
          font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">
          ${formatNum(i + 1)}
        </div>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(p.file.name)}</div>
          <div class="file-item-size">${p.pageCount} page${p.pageCount > 1 ? 's' : ''}</div>
        </div>
        <span style="font-family:var(--font-mono);font-size:12px;color:var(--ink-2);font-weight:600;flex-shrink:0">
          ${formatBytes(p.file.size)}
        </span>
        <button class="file-item-remove" data-index="${i}" title="Remove">✕</button>
      `;
      fileList.appendChild(row);
    });

    fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        pdfs.splice(idx, 1);
        renderPreview();
      });
    });

    let dragIdx = null;
    fileList.querySelectorAll('.file-item').forEach(row => {
      row.addEventListener('dragstart', () => { dragIdx = parseInt(row.dataset.index); row.style.opacity = '0.4'; });
      row.addEventListener('dragend',   () => { row.style.opacity = ''; });
      row.addEventListener('dragover',  e => e.preventDefault());
      row.addEventListener('drop', e => {
        e.preventDefault();
        const dropIdx = parseInt(row.dataset.index);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const [moved] = pdfs.splice(dragIdx, 1);
          pdfs.splice(dropIdx, 0, moved);
          renderPreview();
        }
        dragIdx = null;
      });
    });

    totalsFiles.textContent  = formatNum(pdfs.length);
    totalsPages.textContent  = formatNum(totalPages());
    totalsOutput.textContent = '~ ' + formatBytes(totalBytes());

    fileListSection.style.display = 'block';
    totalsSection.style.display   = 'block';
    convertBtn.style.display      = 'flex';
    convertBtn.disabled           = pdfs.length < 2;
  }

  convertBtn.addEventListener('click', async () => {
    if (pdfs.length < 2) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Merging...';
    progressArea.style.display = 'block';
    result.style.display = 'none';

    try {
      const mergedDoc = await PDFDocument.create();

      for (let i = 0; i < pdfs.length; i++) {
        progressFill.style.width = `${((i + 1) / pdfs.length) * 100}%`;
        progressText.textContent = `Merging ${pdfs[i].file.name} (${i + 1} of ${pdfs.length})...`;

        const arrayBuffer = await pdfs[i].file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(p => mergedDoc.addPage(p));
      }

      progressText.textContent = 'Saving merged PDF...';
      const pdfBytes = await mergedDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pageCount = mergedDoc.getPageCount();

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ PDFs Merged!</h3>
        <p>${pdfs.length} files combined · ${pageCount} page${pageCount > 1 ? 's' : ''} · ${formatBytes(pdfBytes.length)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download Merged PDF</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => saveAs(blob, 'merged.pdf'));
      showToast('PDFs merged successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to merge PDFs: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = pdfs.length < 2;
      convertBtn.innerHTML = 'Bind &amp; Merge →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
