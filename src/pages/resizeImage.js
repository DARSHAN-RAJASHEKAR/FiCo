import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderResizeImage() {
  let files = []; // { file, url, width, height }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>Resize Image</h1>
      <p>Change dimensions of your images — by pixels or percentage</p>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>
      <div id="controls" style="display:none">
        <div id="file-list" class="file-list"></div>

        <div class="resize-options" style="margin-top:var(--space-lg)">
          <div class="options-bar" style="flex-wrap:wrap;gap:var(--space-md)">
            <div class="select-wrapper">
              <select id="resize-mode">
                <option value="pixels">By Pixels</option>
                <option value="percentage">By Percentage</option>
                <option value="preset">Preset Sizes</option>
              </select>
            </div>

            <div id="pixels-inputs" class="dimension-inputs">
              <div class="dim-input-group">
                <label>W</label>
                <input type="number" id="width-input" min="1" max="10000" placeholder="width" />
              </div>
              <span style="color:var(--text-muted);font-size:var(--text-lg)">×</span>
              <div class="dim-input-group">
                <label>H</label>
                <input type="number" id="height-input" min="1" max="10000" placeholder="height" />
              </div>
              <label class="lock-ratio" title="Lock aspect ratio">
                <input type="checkbox" id="lock-ratio" checked />
                <span class="lock-toggle"></span>
                <span class="lock-label">Lock ratio</span>
              </label>
            </div>

            <div id="percentage-input" class="dimension-inputs" style="display:none">
              <div class="dim-input-group">
                <label>Scale</label>
                <input type="number" id="scale-input" min="1" max="500" value="50" />
                <span style="color:var(--text-muted)">%</span>
              </div>
            </div>

            <div id="preset-input" style="display:none">
              <div class="select-wrapper">
                <select id="preset-select">
                  <option value="1920x1080">1920 × 1080 (Full HD)</option>
                  <option value="1280x720">1280 × 720 (HD)</option>
                  <option value="800x600">800 × 600</option>
                  <option value="640x480">640 × 480</option>
                  <option value="256x256">256 × 256 (Thumbnail)</option>
                  <option value="128x128">128 × 128 (Icon)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button id="resize-btn" class="btn btn-primary btn-large btn-convert">
          📐 Resize Images
        </button>
      </div>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Resizing...</div>
      </div>
      <div id="results" style="display:none"></div>
    </div>
  `;

  const dropzoneMount = page.querySelector('#dropzone-mount');
  const controls = page.querySelector('#controls');
  const fileList = page.querySelector('#file-list');
  const resizeMode = page.querySelector('#resize-mode');
  const pixelsInputs = page.querySelector('#pixels-inputs');
  const percentageInput = page.querySelector('#percentage-input');
  const presetInput = page.querySelector('#preset-input');
  const widthInput = page.querySelector('#width-input');
  const heightInput = page.querySelector('#height-input');
  const lockRatio = page.querySelector('#lock-ratio');
  const scaleInput = page.querySelector('#scale-input');
  const presetSelect = page.querySelector('#preset-select');
  const resizeBtn = page.querySelector('#resize-btn');
  const progressArea = page.querySelector('#progress-area');
  const progressFill = page.querySelector('#progress-fill');
  const progressText = page.querySelector('#progress-text');
  const results = page.querySelector('#results');

  let aspectRatio = 1;

  const dropzone = createDropzone({
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    multiple: true,
    icon: '📐',
    title: 'Drop images to resize',
    subtitle: 'JPG, PNG, or WebP',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  // Mode switching
  resizeMode.addEventListener('change', () => {
    pixelsInputs.style.display = resizeMode.value === 'pixels' ? 'flex' : 'none';
    percentageInput.style.display = resizeMode.value === 'percentage' ? 'flex' : 'none';
    presetInput.style.display = resizeMode.value === 'preset' ? 'block' : 'none';
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

  async function addFiles(newFiles) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = newFiles.filter(f => validTypes.includes(f.type));
    if (!valid.length) {
      showToast('Please select valid images (JPG, PNG, WebP)', 'error');
      return;
    }

    for (const file of valid) {
      const bitmap = await createImageBitmap(file);
      files.push({
        file,
        url: URL.createObjectURL(file),
        width: bitmap.width,
        height: bitmap.height,
      });
    }

    // Pre-fill with first image dimensions
    if (files.length && !widthInput.value) {
      widthInput.value = files[0].width;
      heightInput.value = files[0].height;
      aspectRatio = files[0].width / files[0].height;
    }

    renderFileList();
  }

  function renderFileList() {
    if (!files.length) {
      controls.style.display = 'none';
      return;
    }
    controls.style.display = 'block';
    results.style.display = 'none';

    fileList.innerHTML = files.map((f, i) => `
      <div class="file-item">
        <img class="file-item-thumb" src="${f.url}" alt="${f.file.name}" />
        <div class="file-item-info">
          <div class="file-item-name">${f.file.name}</div>
          <div class="file-item-size">${f.width} × ${f.height} • ${formatBytes(f.file.size)}</div>
        </div>
        <button class="file-item-remove" data-index="${i}">✕</button>
      </div>
    `).join('');

    fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        URL.revokeObjectURL(files[idx].url);
        files.splice(idx, 1);
        renderFileList();
      });
    });
  }

  function getTargetDimensions(origW, origH) {
    const mode = resizeMode.value;
    if (mode === 'pixels') {
      return {
        w: parseInt(widthInput.value) || origW,
        h: parseInt(heightInput.value) || origH,
      };
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
    resizeBtn.innerHTML = '<span class="spinner"></span> Resizing...';
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
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, w, h);

        const outputType = files[i].file.type === 'image/webp' ? 'image/webp' : files[i].file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise(r => canvas.toBlob(r, outputType, 0.92));

        const ext = outputType === 'image/webp' ? '.webp' : outputType === 'image/png' ? '.png' : '.jpg';
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
          ${resized.map((r, i) => `
            <div class="file-item">
              <img class="file-item-thumb" src="${r.url}" alt="${r.name}" />
              <div class="file-item-info">
                <div class="file-item-name">${r.name}</div>
                <div class="file-item-size">${r.origDims} → ${r.newDims}</div>
              </div>
              <button class="btn btn-secondary download-single" data-index="${i}" style="font-size:var(--text-xs);padding:6px 12px">⬇</button>
            </div>
          `).join('')}
        </div>
        ${resized.length > 1 ? `<button id="download-all" class="btn btn-primary btn-large btn-convert">⬇ Download All</button>` : ''}
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
      resizeBtn.innerHTML = '📐 Resize Images';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
