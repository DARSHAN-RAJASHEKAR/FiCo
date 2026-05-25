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

export function renderCompressImage() {
  let files = []; // { file, url }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 04</span>
      <h1>Compress Image.</h1>
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
            <div class="opt-label">Quality preset</div>
            <label class="opt-row"><input type="radio" name="quality" value="85" checked/><span class="box">High · 85%</span></label>
            <label class="opt-row"><input type="radio" name="quality" value="70"/><span class="box">Standard · 70%</span></label>
            <label class="opt-row"><input type="radio" name="quality" value="50"/><span class="box">Small · 50%</span></label>
          </div>
          <div class="opt-group">
            <div class="opt-label">Output format</div>
            <label class="opt-row"><input type="radio" name="format" value="auto" checked/><span class="box">Auto (keep original)</span></label>
            <label class="opt-row"><input type="radio" name="format" value="jpeg"/><span class="box">JPEG</span></label>
            <label class="opt-row"><input type="radio" name="format" value="webp"/><span class="box">WebP</span></label>
          </div>
        </div>
      </div>

      <div id="totals-section" class="bureau-slip is-totals" style="display:none">
        <div class="bureau-slip-head">
          <span>SLIP D · TOTALS</span>
          <span>EST. ONLY</span>
        </div>
        <div class="bureau-slip-row"><span class="k">images</span><span class="d"></span><span class="v" id="totals-count">—</span></div>
        <div class="bureau-slip-row"><span class="k">total input size</span><span class="d"></span><span class="v" id="totals-size">—</span></div>
        <div class="bureau-slip-row bureau-totals"><span class="k">TOTAL</span><span class="d"></span><span class="v" id="totals-output">—</span></div>
      </div>

      <button id="compress-btn" class="btn btn-primary btn-large btn-convert" style="display:none">
        Compress &amp; Export →
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Compressing...</div>
      </div>
      <div id="results" style="display:none"></div>
    </div>
  `;

  const dropzoneMount   = page.querySelector('#dropzone-mount');
  const fileListSection = page.querySelector('#file-list-section');
  const fileList        = page.querySelector('#file-list');
  const slipBCount      = page.querySelector('#slip-b-count');
  const optionsSection  = page.querySelector('#options-section');
  const totalsSection   = page.querySelector('#totals-section');
  const totalsCount     = page.querySelector('#totals-count');
  const totalsSize      = page.querySelector('#totals-size');
  const totalsOutput    = page.querySelector('#totals-output');
  const compressBtn     = page.querySelector('#compress-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const results         = page.querySelector('#results');

  const dropzone = createDropzone({
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    multiple: true,
    icon: '🗜️',
    title: 'Drop images to compress.',
    subtitle: 'accepts: jpg · png · webp',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  function totalBytes() { return files.reduce((s, f) => s + f.file.size, 0); }

  function renderFileList() {
    results.style.display = 'none';

    if (!files.length) {
      fileListSection.style.display = 'none';
      optionsSection.style.display  = 'none';
      totalsSection.style.display   = 'none';
      compressBtn.style.display     = 'none';
      return;
    }

    const tb = totalBytes();
    slipBCount.textContent =
      `${formatNum(files.length)} ITEM${files.length > 1 ? 'S' : ''} · ${formatBytes(tb)}`;

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
          <div class="file-item-size">${formatBytes(f.file.size)}</div>
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

    totalsCount.textContent  = formatNum(files.length);
    totalsSize.textContent   = formatBytes(tb);
    totalsOutput.textContent = `${formatNum(files.length)} × compressed`;

    fileListSection.style.display = 'block';
    optionsSection.style.display  = 'block';
    totalsSection.style.display   = 'block';
    compressBtn.style.display     = 'flex';
  }

  function addFiles(newFiles) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = newFiles.filter(f => validTypes.includes(f.type));
    if (!valid.length) {
      showToast('Please select valid images (JPG, PNG, WebP)', 'error');
      return;
    }
    valid.forEach(file => files.push({ file }));
    renderFileList();
  }

  function getQuality() {
    return parseInt(page.querySelector('input[name="quality"]:checked')?.value || '70') / 100;
  }

  function getOutputType(originalType) {
    const fmt = page.querySelector('input[name="format"]:checked')?.value || 'auto';
    if (fmt === 'jpeg') return 'image/jpeg';
    if (fmt === 'webp') return 'image/webp';
    // auto: PNG → WebP (for better compression), others keep original
    return originalType === 'image/png' ? 'image/webp' : originalType;
  }

  compressBtn.addEventListener('click', async () => {
    if (!files.length) return;

    compressBtn.disabled = true;
    compressBtn.innerHTML = '<span class="spinner"></span> Processing...';
    progressArea.style.display = 'block';
    results.style.display = 'none';

    const quality = getQuality();
    const compressed = [];

    try {
      for (let i = 0; i < files.length; i++) {
        progressFill.style.width = `${((i + 1) / files.length) * 100}%`;
        progressText.textContent = `Compressing ${i + 1} of ${files.length}...`;

        const bitmap = await createImageBitmap(files[i].file);
        const canvas = document.createElement('canvas');
        canvas.width  = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);

        const outputType = getOutputType(files[i].file.type);
        const blob = await new Promise(r => canvas.toBlob(r, outputType, quality));

        const ext      = outputType === 'image/webp' ? '.webp' : outputType === 'image/png' ? '.png' : '.jpg';
        const baseName = files[i].file.name.replace(/\.[^.]+$/, '');
        compressed.push({
          name: baseName + '-compressed' + ext,
          blob,
          originalSize: files[i].file.size,
          newSize: blob.size,
        });
      }

      const totalOriginal = compressed.reduce((s, c) => s + c.originalSize, 0);
      const totalNew      = compressed.reduce((s, c) => s + c.newSize, 0);
      const savedPct      = Math.round((1 - totalNew / totalOriginal) * 100);

      results.style.display = 'block';
      results.innerHTML = `
        <div class="result-section">
          <h3>✓ Compression Complete!</h3>
          <p>Saved ${savedPct}% — ${formatBytes(totalOriginal)} → ${formatBytes(totalNew)}</p>
        </div>
        <div class="file-list" style="margin-top:var(--space-md)">
          <div class="bureau-slip-head"><span>RESULTS</span><span>−${savedPct}%</span></div>
          ${compressed.map((c, i) => {
            const saved = Math.round((1 - c.newSize / c.originalSize) * 100);
            return `
              <div class="file-item">
                <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
                  font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">${formatNum(i + 1)}</div>
                <div class="file-item-info">
                  <div class="file-item-name">${escapeHtml(c.name)}</div>
                  <div class="file-item-size">${formatBytes(c.originalSize)} → ${formatBytes(c.newSize)} (−${saved}%)</div>
                </div>
                <button class="btn btn-secondary download-single" data-index="${i}"
                  style="font-size:var(--text-xs);padding:6px 12px;flex-shrink:0">⬇</button>
              </div>
            `;
          }).join('')}
        </div>
        ${compressed.length > 1 ? `<button id="download-all" class="btn btn-primary btn-large btn-convert">⬇ Download All as ZIP</button>` : ''}
      `;

      results.querySelectorAll('.download-single').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = compressed[parseInt(btn.dataset.index)];
          saveAs(c.blob, c.name);
        });
      });

      if (compressed.length > 1) {
        const { default: JSZip } = await import('jszip');
        results.querySelector('#download-all').addEventListener('click', async () => {
          const zip = new JSZip();
          compressed.forEach(c => zip.file(c.name, c.blob));
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, 'compressed-images.zip');
        });
      }

      showToast(`${files.length} image${files.length > 1 ? 's' : ''} compressed — saved ${savedPct}%!`);
    } catch (err) {
      console.error(err);
      showToast('Compression failed: ' + err.message, 'error');
    } finally {
      compressBtn.disabled = false;
      compressBtn.innerHTML = 'Compress &amp; Export →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
