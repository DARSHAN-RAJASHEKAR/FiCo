import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderCompressImage() {
  let files = []; // { file, url }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>Compress Image</h1>
      <p>Reduce file size while keeping great visual quality</p>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>
      <div id="file-list-area" style="display:none">
        <div id="file-list" class="file-list"></div>
        <div class="options-bar" style="margin-top:var(--space-lg)">
          <label style="font-size:var(--text-sm);font-weight:500;color:var(--text-secondary)">Quality</label>
          <div class="slider-group">
            <input type="range" id="quality-slider" min="10" max="95" value="70" class="slider" />
            <span id="quality-value" style="font-size:var(--text-sm);font-weight:600;color:var(--accent);min-width:36px">70%</span>
          </div>
          <span style="color:var(--text-muted);font-size:var(--text-xs)">Lower = smaller file</span>
        </div>
        <button id="compress-btn" class="btn btn-primary btn-large btn-convert">
          🗜️ Compress Images
        </button>
      </div>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Compressing...</div>
      </div>
      <div id="results" style="display:none"></div>
    </div>
  `;

  const dropzoneMount = page.querySelector('#dropzone-mount');
  const fileListArea = page.querySelector('#file-list-area');
  const fileList = page.querySelector('#file-list');
  const qualitySlider = page.querySelector('#quality-slider');
  const qualityValue = page.querySelector('#quality-value');
  const compressBtn = page.querySelector('#compress-btn');
  const progressArea = page.querySelector('#progress-area');
  const progressFill = page.querySelector('#progress-fill');
  const progressText = page.querySelector('#progress-text');
  const results = page.querySelector('#results');

  const dropzone = createDropzone({
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    multiple: true,
    icon: '🗜️',
    title: 'Drop images to compress',
    subtitle: 'JPG, PNG, or WebP',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value + '%';
  });

  function addFiles(newFiles) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = newFiles.filter(f => validTypes.includes(f.type));
    if (!valid.length) {
      showToast('Please select valid images (JPG, PNG, WebP)', 'error');
      return;
    }
    valid.forEach(file => {
      files.push({ file, url: URL.createObjectURL(file) });
    });
    renderFileList();
  }

  function renderFileList() {
    if (!files.length) {
      fileListArea.style.display = 'none';
      return;
    }
    fileListArea.style.display = 'block';
    results.style.display = 'none';

    fileList.innerHTML = files.map((f, i) => `
      <div class="file-item">
        <img class="file-item-thumb" src="${f.url}" alt="${f.file.name}" />
        <div class="file-item-info">
          <div class="file-item-name">${f.file.name}</div>
          <div class="file-item-size">${formatBytes(f.file.size)}</div>
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

  compressBtn.addEventListener('click', async () => {
    if (!files.length) return;

    compressBtn.disabled = true;
    compressBtn.innerHTML = '<span class="spinner"></span> Compressing...';
    progressArea.style.display = 'block';
    results.style.display = 'none';

    const quality = parseInt(qualitySlider.value) / 100;
    const compressed = [];

    try {
      for (let i = 0; i < files.length; i++) {
        progressFill.style.width = `${((i + 1) / files.length) * 100}%`;
        progressText.textContent = `Compressing ${i + 1} of ${files.length}...`;

        const bitmap = await createImageBitmap(files[i].file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);

        // Output as JPEG for best compression, or WebP
        const outputType = files[i].file.type === 'image/png' ? 'image/webp' : files[i].file.type;
        const blob = await new Promise(r => canvas.toBlob(r, outputType, quality));

        const ext = outputType === 'image/webp' ? '.webp' : outputType === 'image/png' ? '.png' : '.jpg';
        const baseName = files[i].file.name.replace(/\.[^.]+$/, '');
        compressed.push({
          name: baseName + '-compressed' + ext,
          blob,
          originalSize: files[i].file.size,
          newSize: blob.size,
          url: URL.createObjectURL(blob),
        });
      }

      results.style.display = 'block';
      const totalOriginal = compressed.reduce((s, c) => s + c.originalSize, 0);
      const totalNew = compressed.reduce((s, c) => s + c.newSize, 0);
      const savedPct = Math.round((1 - totalNew / totalOriginal) * 100);

      results.innerHTML = `
        <div class="result-section">
          <h3>✓ Compression Complete!</h3>
          <p>Saved ${savedPct}% — ${formatBytes(totalOriginal)} → ${formatBytes(totalNew)}</p>
        </div>
        <div class="file-list" style="margin-top:var(--space-md)">
          ${compressed.map((c, i) => {
            const saved = Math.round((1 - c.newSize / c.originalSize) * 100);
            return `
              <div class="file-item">
                <img class="file-item-thumb" src="${c.url}" alt="${c.name}" />
                <div class="file-item-info">
                  <div class="file-item-name">${c.name}</div>
                  <div class="file-item-size">${formatBytes(c.originalSize)} → ${formatBytes(c.newSize)} <span style="color:var(--success)">(-${saved}%)</span></div>
                </div>
                <button class="btn btn-secondary download-single" data-index="${i}" style="font-size:var(--text-xs);padding:6px 12px">⬇</button>
              </div>
            `;
          }).join('')}
        </div>
        ${compressed.length > 1 ? `<button id="download-all" class="btn btn-primary btn-large btn-convert">⬇ Download All</button>` : ''}
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

      showToast(`Compressed ${files.length} image${files.length > 1 ? 's' : ''} — saved ${savedPct}%!`);
    } catch (err) {
      console.error(err);
      showToast('Compression failed: ' + err.message, 'error');
    } finally {
      compressBtn.disabled = false;
      compressBtn.innerHTML = '🗜️ Compress Images';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
