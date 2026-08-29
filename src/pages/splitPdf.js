import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
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

export function renderSplitPdf() {
  let pdfFile = null;
  let totalPages = 0;

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 04</span>
      <h1>Split PDF.</h1>
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
            <div class="opt-label">Split mode</div>
            <label class="opt-row"><input type="radio" name="split-mode" value="range" checked/><span class="box">Extract a page range</span></label>
            <label class="opt-row"><input type="radio" name="split-mode" value="chunks"/><span class="box">Split every N pages</span></label>
            <label class="opt-row"><input type="radio" name="split-mode" value="all"/><span class="box">Split into individual pages</span></label>
          </div>
          <div class="opt-group" id="range-group">
            <div class="opt-label">Page range</div>
            <div class="page-range-row">
              <span class="opt-label" style="font-size:11px;margin-bottom:0">From</span>
              <input type="number" id="page-start" min="1" value="1" class="bureau-num-input" />
              <span class="opt-label" style="font-size:11px;margin-bottom:0">to</span>
              <input type="number" id="page-end" min="1" value="1" class="bureau-num-input" />
              <span id="range-hint" style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)"></span>
            </div>
          </div>
          <div class="opt-group" id="chunks-group" style="display:none">
            <div class="opt-label">Pages per file</div>
            <div class="page-range-row">
              <input type="number" id="chunk-size" min="1" value="1" class="bureau-num-input" />
              <span id="chunk-hint" style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)"></span>
            </div>
          </div>
          <div class="opt-group" id="all-note" style="display:none">
            <div class="opt-label">Output</div>
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--ink-2)">
              Every page becomes its own single-page PDF.
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
        <div class="bureau-slip-row"><span class="k">total pages</span><span class="d"></span><span class="v" id="totals-source-pages">—</span></div>
        <div class="bureau-slip-row bureau-totals"><span class="k">OUTPUT FILES</span><span class="d"></span><span class="v" id="totals-output">—</span></div>
      </div>

      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Divide &amp; Export →
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
  const optionsSection  = page.querySelector('#options-section');
  const rangeGroup      = page.querySelector('#range-group');
  const chunksGroup     = page.querySelector('#chunks-group');
  const allNote         = page.querySelector('#all-note');
  const pageStartInput  = page.querySelector('#page-start');
  const pageEndInput    = page.querySelector('#page-end');
  const rangeHint       = page.querySelector('#range-hint');
  const chunkSizeInput  = page.querySelector('#chunk-size');
  const chunkHint       = page.querySelector('#chunk-hint');
  const totalsSection   = page.querySelector('#totals-section');
  const totalsFilename  = page.querySelector('#totals-filename');
  const totalsSourcePages = page.querySelector('#totals-source-pages');
  const totalsOutput    = page.querySelector('#totals-output');
  const convertBtn      = page.querySelector('#convert-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const result          = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf',
    multiple: false,
    icon: '✂️',
    title: 'Drop your PDF here.',
    subtitle: 'accepts: pdf · one file at a time',
    onFiles: handleFile,
  });
  dropzoneMount.appendChild(dropzone);

  function getMode() {
    return page.querySelector('input[name="split-mode"]:checked')?.value || 'range';
  }

  // Clamps as the user types; leaves a bare '' or '-' alone mid-edit so
  // typing isn't fought, but any parseable out-of-range/negative value is
  // corrected immediately (so e.g. "-4" never survives past its 2nd digit).
  function clampInput(input, lo, hi) {
    const raw = input.value;
    if (raw === '' || raw === '-') return null;
    let n = parseInt(raw, 10);
    if (isNaN(n)) n = lo;
    if (n < lo) n = lo;
    if (n > hi) n = hi;
    if (String(n) !== raw) input.value = n;
    return n;
  }

  // Called on blur to fill in a value left blank mid-edit.
  function finalizeInput(input, lo, hi, fallback) {
    let n = parseInt(input.value, 10);
    if (isNaN(n)) n = fallback;
    if (n < lo) n = lo;
    if (n > hi) n = hi;
    input.value = n;
    return n;
  }

  function outputCount() {
    const mode = getMode();
    if (!totalPages) return 0;
    if (mode === 'range') return 1;
    if (mode === 'all') return totalPages;
    const size = Math.max(1, parseInt(chunkSizeInput.value) || 1);
    return Math.ceil(totalPages / size);
  }

  function updateTotals() {
    if (!totalPages) return;
    const mode = getMode();

    if (mode === 'range') {
      const start = parseInt(pageStartInput.value) || 1;
      const end   = parseInt(pageEndInput.value)   || totalPages;
      const count = Math.max(0, end - start + 1);
      rangeHint.textContent = `${count} page${count !== 1 ? 's' : ''}`;
    } else if (mode === 'chunks') {
      const size = Math.max(1, parseInt(chunkSizeInput.value) || 1);
      chunkHint.textContent = `${Math.ceil(totalPages / size)} file${Math.ceil(totalPages / size) !== 1 ? 's' : ''}`;
    }

    const count = outputCount();
    totalsOutput.textContent = `${formatNum(count)} FILE${count !== 1 ? 'S' : ''}`;
    convertBtn.textContent = count === 1 ? 'Divide & Export →' : `Divide into ${formatNum(count)} Files →`;
  }

  function setMode(mode) {
    rangeGroup.style.display  = mode === 'range'  ? 'block' : 'none';
    chunksGroup.style.display = mode === 'chunks' ? 'block' : 'none';
    allNote.style.display     = mode === 'all'    ? 'block' : 'none';
    updateTotals();
  }

  page.querySelectorAll('input[name="split-mode"]').forEach(radio => {
    radio.addEventListener('change', () => setMode(getMode()));
  });

  chunkSizeInput.addEventListener('input', updateTotals);

  function handleFile(files) {
    const file = files[0];
    if (!file || (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name))) {
      showToast('Please select a valid PDF file', 'error');
      return;
    }

    pdfFile = file;
    result.style.display = 'none';

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        totalPages = doc.getPageCount();
      } catch (err) {
        console.error(err);
        showToast('Failed to read PDF: ' + err.message, 'error');
        pdfFile = null;
        return;
      }

      const head = fileList.querySelector('.bureau-slip-head');
      fileList.innerHTML = '';
      fileList.appendChild(head);

      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
          font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">01</div>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(file.name)}</div>
          <div class="file-item-size">${totalPages} page${totalPages !== 1 ? 's' : ''} · ${formatBytes(file.size)}</div>
        </div>
        <button class="file-item-remove" id="remove-file" title="Remove">✕</button>
      `;
      fileList.appendChild(row);

      page.querySelector('#remove-file').addEventListener('click', () => {
        pdfFile = null;
        totalPages = 0;
        fileListSection.style.display = 'none';
        optionsSection.style.display  = 'none';
        totalsSection.style.display   = 'none';
        convertBtn.style.display      = 'none';
        result.style.display          = 'none';
      });

      pageStartInput.min = 1;
      pageEndInput.min   = 1;
      pageStartInput.max = totalPages;
      pageEndInput.max   = totalPages;
      pageStartInput.value = 1;
      pageEndInput.value   = totalPages;

      pageStartInput.oninput = () => {
        const s = clampInput(pageStartInput, 1, totalPages);
        if (s !== null) {
          pageEndInput.min = s;
          const e = parseInt(pageEndInput.value, 10);
          if (!isNaN(e) && e < s) pageEndInput.value = s;
        }
        updateTotals();
      };
      pageStartInput.onblur = () => {
        const s = finalizeInput(pageStartInput, 1, totalPages, 1);
        pageEndInput.min = s;
        const e = parseInt(pageEndInput.value, 10);
        if (isNaN(e) || e < s) pageEndInput.value = s;
        updateTotals();
      };

      pageEndInput.oninput = () => {
        clampInput(pageEndInput, 1, totalPages);
        updateTotals();
      };
      pageEndInput.onblur = () => {
        const s = parseInt(pageStartInput.value, 10) || 1;
        let e = finalizeInput(pageEndInput, 1, totalPages, totalPages);
        if (e < s) { e = s; pageEndInput.value = e; }
        updateTotals();
      };

      chunkSizeInput.min = 1;
      chunkSizeInput.max = totalPages;
      chunkSizeInput.value = 1;
      chunkSizeInput.oninput = () => {
        clampInput(chunkSizeInput, 1, totalPages);
        updateTotals();
      };
      chunkSizeInput.onblur = () => {
        finalizeInput(chunkSizeInput, 1, totalPages, 1);
        updateTotals();
      };

      slipBCount.textContent = `01 ITEM · ${formatBytes(file.size)}`;
      totalsFilename.textContent = file.name.length > 28 ? file.name.slice(0, 25) + '...' : file.name;
      totalsSourcePages.textContent = formatNum(totalPages);

      setMode(getMode());

      fileListSection.style.display = 'block';
      optionsSection.style.display  = 'block';
      totalsSection.style.display   = 'block';
      convertBtn.style.display      = 'flex';
      convertBtn.disabled           = false;
    })();
  }

  convertBtn.addEventListener('click', async () => {
    if (!pdfFile || !totalPages) return;

    const mode = getMode();
    const baseName = pdfFile.name.replace(/\.pdf$/i, '');

    let ranges = [];
    if (mode === 'range') {
      const start = parseInt(pageStartInput.value) || 1;
      const end   = parseInt(pageEndInput.value)   || totalPages;
      const safeStart = Math.max(1, Math.min(start, totalPages));
      const safeEnd   = Math.max(safeStart, Math.min(end, totalPages));
      ranges = [{ start: safeStart, end: safeEnd }];
    } else if (mode === 'chunks') {
      const size = Math.max(1, parseInt(chunkSizeInput.value) || 1);
      for (let s = 1; s <= totalPages; s += size) {
        ranges.push({ start: s, end: Math.min(s + size - 1, totalPages) });
      }
    } else {
      for (let i = 1; i <= totalPages; i++) ranges.push({ start: i, end: i });
    }

    if (!ranges.length) { showToast('Nothing to split.', 'error'); return; }

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Splitting...';
    progressArea.style.display = 'block';
    result.style.display = 'none';

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

      const zip = ranges.length > 1 ? new JSZip() : null;
      let singleBlob = null;
      let singleName = null;

      for (let idx = 0; idx < ranges.length; idx++) {
        const { start, end } = ranges[idx];
        progressFill.style.width = `${((idx + 1) / ranges.length) * 100}%`;
        progressText.textContent = `Building file ${idx + 1} of ${ranges.length} (pages ${start}-${end})...`;

        const outDoc = await PDFDocument.create();
        const indices = [];
        for (let p = start; p <= end; p++) indices.push(p - 1);
        const copiedPages = await outDoc.copyPages(srcDoc, indices);
        copiedPages.forEach(p => outDoc.addPage(p));

        const bytes = await outDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });

        const name = ranges.length === 1
          ? `${baseName}-pages-${start}-${end}.pdf`
          : mode === 'all'
            ? `${baseName}-page-${String(start).padStart(3, '0')}.pdf`
            : `${baseName}-part-${formatNum(idx + 1)}-pages-${start}-${end}.pdf`;

        if (!zip) { singleBlob = blob; singleName = name; }
        else zip.file(name, blob);
      }

      result.style.display = 'block';

      if (!zip) {
        result.innerHTML = `
          <h3>✓ PDF Split!</h3>
          <p>${formatBytes(singleBlob.size)}</p>
          <button class="btn btn-primary" id="download-result">⬇ Download PDF</button>
        `;
        page.querySelector('#download-result').addEventListener('click', () => saveAs(singleBlob, singleName));
      } else {
        progressText.textContent = 'Packaging archive...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipName = `${baseName}-split.zip`;
        result.innerHTML = `
          <h3>✓ PDF Split!</h3>
          <p>${ranges.length} files · ${formatBytes(zipBlob.size)}</p>
          <button class="btn btn-primary" id="download-result">⬇ Download ZIP</button>
        `;
        page.querySelector('#download-result').addEventListener('click', () => saveAs(zipBlob, zipName));
      }

      showToast(`PDF split into ${ranges.length} file${ranges.length !== 1 ? 's' : ''}!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to split PDF: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      updateTotals();
      progressArea.style.display = 'none';
    }
  });

  return page;
}
