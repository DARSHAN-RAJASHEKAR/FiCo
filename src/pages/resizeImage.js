import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatNum(n) { return String(n).padStart(2, '0'); }

export function renderResizeImage() {
  let files = []; // { file, url, width, height }
  let aspectRatio = 1;

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 05</span>
      <h1>Resize Image.</h1>
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
            <div class="opt-label">Resize method</div>
            <label class="opt-row"><input type="radio" name="resize-mode" value="pixels" checked/><span class="box">By Pixels</span></label>
            <label class="opt-row"><input type="radio" name="resize-mode" value="percentage"/><span class="box">By Percentage</span></label>
            <label class="opt-row"><input type="radio" name="resize-mode" value="preset"/><span class="box">Preset Size</span></label>
          </div>

          <div id="pixels-inputs" class="opt-group">
            <div class="opt-label">Dimensions</div>
            <div class="page-range-row" style="gap:8px;align-items:center">
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)">W</span>
              <input type="number" id="width-input" min="1" max="10000" placeholder="width" class="bureau-num-input" style="width:80px" />
              <span style="font-family:var(--font-mono);font-size:13px;color:var(--ink-2)">×</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)">H</span>
              <input type="number" id="height-input" min="1" max="10000" placeholder="height" class="bureau-num-input" style="width:80px" />
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-left:4px">
                <input type="checkbox" id="lock-ratio" checked style="accent-color:var(--accent)" />
                <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-2)">lock ratio</span>
              </label>
            </div>
          </div>

          <div id="percentage-input" class="opt-group" style="display:none">
            <div class="opt-label">Scale factor</div>
            <div class="page-range-row">
              <input type="number" id="scale-input" min="1" max="500" value="50" class="bureau-num-input" style="width:72px" />
              <span style="font-family:var(--font-mono);font-size:13px;color:var(--ink-2)">%</span>
            </div>
          </div>

          <div id="preset-input" class="opt-group" style="display:none">
            <div class="opt-label">Preset</div>
            <div style="margin-top:4px">
              <select id="preset-select" style="font-family:var(--font-mono);font-size:12px;padding:8px 12px;
                border:1.5px solid var(--ink-3);border-radius:4px;background:var(--paper);color:var(--ink);
                appearance:none;cursor:pointer;outline:none;">
                <option value="1920x1080">1920 × 1080 · Full HD</option>
                <option value="1280x720">1280 × 720 · HD</option>
                <option value="800x600">800 × 600</option>
                <option value="640x480">640 × 480</option>
                <option value="256x256">256 × 256 · Thumbnail</option>
                <option value="128x128">128 × 128 · Icon</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div id="totals-section" class="bureau-slip is-totals" style="display:none">
        <div class="bureau-slip-head">
          <span>SLIP D · TOTALS</span>
          <span>EST. ONLY</span>
        </div>
        <div class="bureau-slip-row"><span class="k">images</span><span class="d"></span><span class="v" id="totals-count">—</span></div>
        <div class="bureau-slip-row"><span class="k">original dimensions</span><span class="d"></span><span class="v" id="totals-dims">—</span></div>
        <div class="bureau-slip-row bureau-totals"><span class="k">TOTAL</span><span class="d"></span><span class="v" id="totals-output">—</span></div>
      </div>

      <button id="resize-btn" class="btn btn-primary btn-large btn-convert" style="display:none">
        Resize &amp; Export →
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Resizing...</div>
      </div>
      <div id="results" style="display:none"></div>
    </div>
  `;

  const dropzoneMount   = page.querySelector('#dropzone-mount');
  const fileListSection = page.querySelector('#file-list-section');
  const fileList        = page.querySelector('#file-list');
  const slipBCount      = page.querySelector('#slip-b-count');
  const optionsSection  = page.querySelector('#options-section');
  const pixelsInputs    = page.querySelector('#pixels-inputs');
  const percentageInput = page.querySelector('#percentage-input');
  const presetInput     = page.querySelector('#preset-input');
  const widthInput      = page.querySelector('#width-input');
  const heightInput     = page.querySelector('#height-input');
  const lockRatio       = page.querySelector('#lock-ratio');
  const scaleInput      = page.querySelector('#scale-input');
  const presetSelect    = page.querySelector('#preset-select');
  const totalsSection   = page.querySelector('#totals-section');
  const totalsCount     = page.querySelector('#totals-count');
  const totalsDims      = page.querySelector('#totals-dims');
  const totalsOutput    = page.querySelector('#totals-output');
  const resizeBtn       = page.querySelector('#resize-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const results         = page.querySelector('#results');

  const dropzone = createDropzone({
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    multiple: true,
    icon: '📐',
    title: 'Drop images to resize.',
    subtitle: 'accepts: jpg · png · webp',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  // Mode switching
  page.querySelectorAll('input[name="resize-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      pixelsInputs.style.display    = radio.value === 'pixels'     ? 'block' : 'none';
      percentageInput.style.display = radio.value === 'percentage' ? 'block' : 'none';
      presetInput.style.display     = radio.value === 'preset'     ? 'block' : 'none';
    });
  });

  // Lock aspect ratio
  widthInput.addEventListener('input', () => {
    if (lockRatio.checked && widthInput.value && aspectRatio) {
      heightInput.value = Math.round(parseInt(widthInput.value) / aspectRatio);
    }
  });
  heightInput.addEventListener('input', () => {
    if (lockRatio.checked && heightInput.value && aspectRatio) {
      widthInput.value = Math.round(parseInt(heightInput.value) * aspectRatio);
    }
  });

  function totalBytes() { return files.reduce((s, f) => s + f.file.size, 0); }

  function renderFileList() {
    results.style.display = 'none';

    if (!files.length) {
      fileListSection.style.display = 'none';
      optionsSection.style.display  = 'none';
      totalsSection.style.display   = 'none';
      resizeBtn.style.display       = 'none';
      return;
    }

    slipBCount.textContent =
      `${formatNum(files.length)} ITEM${files.length > 1 ? 'S' : ''} · ${formatBytes(totalBytes())}`;

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
          <div class="file-item-name">${f.file.name}</div>
          <div class="file-item-size">${f.width} × ${f.height} · ${formatBytes(f.file.size)}</div>
        </div>
        <button class="file-item-remove" data-index="${i}" title="Remove">✕</button>
      `;
      fileList.appendChild(row);
    });

    fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        URL.revokeObjectURL(files[idx].url);
        files.splice(idx, 1);
        renderFileList();
      });
    });

    totalsCount.textContent  = formatNum(files.length);
    totalsDims.textContent   = files[0] ? `${files[0].width} × ${files[0].height}` : '—';
    totalsOutput.textContent = `${formatNum(files.length)} × resized`;

    fileListSection.style.display = 'block';
    optionsSection.style.display  = 'block';
    totalsSection.style.display   = 'block';
    resizeBtn.style.display       = 'flex';
  }

  async function addFiles(newFiles) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = newFiles.filter(f => validTypes.includes(f.type));
    if (!valid.length) {
      showToast('Please select valid images (JPG, PNG, WebP)', 'error');
      return;
    }

    for (const file of valid) {
      const bitmap = await createImageBitmap(file);
      files.push({ file, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height });
    }

    // Pre-fill with first image dimensions
    if (files.length && !widthInput.value) {
      widthInput.value  = files[0].width;
      heightInput.value = files[0].height;
      aspectRatio = files[0].width / files[0].height;
    }

    renderFileList();
  }

  function getTargetDimensions(origW, origH) {
    const mode = page.querySelector('input[name="resize-mode"]:checked')?.value || 'pixels';
    if (mode === 'pixels') {
      return { w: parseInt(widthInput.value) || origW, h: parseInt(heightInput.value) || origH };
    } else if (mode === 'percentage') {
      const scale = (parseInt(scaleInput.value) || 100) / 100;
      return { w: Math.round(origW * scale), h: Math.round(origH * scale) };
    } else {
      const [w, h] = presetSelect.value.split('x').map(Number);
      return { w, h };
    }
  }

  resizeBtn.addEventListener('click', async () => {
    if (!files.length) return;

    resizeBtn.disabled = true;
    resizeBtn.innerHTML = '<span class="spinner"></span> Processing...';
    progressArea.style.display = 'block';
    results.style.display = 'none';

    const resized = [];

    try {
      for (let i = 0; i < files.length; i++) {
        progressFill.style.width = `${((i + 1) / files.length) * 100}%`;
        progressText.textContent = `Resizing ${i + 1} of ${files.length}...`;

        const { w, h } = getTargetDimensions(files[i].width, files[i].height);
        const bitmap = await createImageBitmap(files[i].file);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);

        const outputType = files[i].file.type === 'image/webp' ? 'image/webp'
          : files[i].file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise(r => canvas.toBlob(r, outputType, 0.92));

        const ext      = outputType === 'image/webp' ? '.webp' : outputType === 'image/png' ? '.png' : '.jpg';
        const baseName = files[i].file.name.replace(/\.[^.]+$/, '');
        resized.push({
          name: `${baseName}-${w}x${h}${ext}`,
          blob,
          origDims: `${files[i].width} × ${files[i].height}`,
          newDims: `${w} × ${h}`,
          url: URL.createObjectURL(blob),
        });
      }

      results.style.display = 'block';
      results.innerHTML = `
        <div class="result-section">
          <h3>✓ Resize Complete!</h3>
          <p>${resized.length} image${resized.length > 1 ? 's' : ''} resized</p>
        </div>
        <div class="file-list" style="margin-top:var(--space-md)">
          <div class="bureau-slip-head"><span>RESULTS</span><span>${resized.length} FILE${resized.length > 1 ? 'S' : ''}</span></div>
          ${resized.map((r, i) => `
            <div class="file-item">
              <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
                font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">${formatNum(i + 1)}</div>
              <div class="file-item-info">
                <div class="file-item-name">${r.name}</div>
                <div class="file-item-size">${r.origDims} → ${r.newDims}</div>
              </div>
              <button class="btn btn-secondary download-single" data-index="${i}"
                style="font-size:var(--text-xs);padding:6px 12px;flex-shrink:0">⬇</button>
            </div>
          `).join('')}
        </div>
        ${resized.length > 1 ? `<button id="download-all" class="btn btn-primary btn-large btn-convert">⬇ Download All as ZIP</button>` : ''}
      `;

      results.querySelectorAll('.download-single').forEach(btn => {
        btn.addEventListener('click', () => {
          const r = resized[parseInt(btn.dataset.index)];
          saveAs(r.blob, r.name);
        });
      });

      if (resized.length > 1) {
        const { default: JSZip } = await import('jszip');
        results.querySelector('#download-all').addEventListener('click', async () => {
          const zip = new JSZip();
          resized.forEach(r => zip.file(r.name, r.blob));
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, 'resized-images.zip');
        });
      }

      showToast(`${resized.length} image${resized.length > 1 ? 's' : ''} resized!`);
    } catch (err) {
      console.error(err);
      showToast('Resize failed: ' + err.message, 'error');
    } finally {
      resizeBtn.disabled = false;
      resizeBtn.innerHTML = 'Resize &amp; Export →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
