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

export function renderImagesToPdf() {
  let images = []; // { file, url, w, h }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 01</span>
      <h1>Images → PDF.</h1>
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
            <div class="opt-label">Page size</div>
            <label class="opt-row"><input type="radio" name="page-size" value="fit" checked/><span class="box">Fit to image</span></label>
            <label class="opt-row"><input type="radio" name="page-size" value="a4"/><span class="box">A4 portrait</span></label>
            <label class="opt-row"><input type="radio" name="page-size" value="letter"/><span class="box">US Letter</span></label>
          </div>
          <div class="opt-group">
            <div class="opt-label">Orientation</div>
            <label class="opt-row"><input type="radio" name="orientation" value="portrait" checked/><span class="box">Portrait</span></label>
            <label class="opt-row"><input type="radio" name="orientation" value="landscape"/><span class="box">Landscape</span></label>
            <label class="opt-row"><input type="radio" name="orientation" value="auto"/><span class="box">Auto</span></label>
          </div>
        </div>
      </div>

      <div id="totals-section" class="bureau-slip is-totals" style="display:none">
        <div class="bureau-slip-head">
          <span>SLIP D · TOTALS</span>
          <span>EST. ONLY</span>
        </div>
        <div class="bureau-slip-row"><span class="k">filename</span><span class="d"></span><span class="v">converted.pdf</span></div>
        <div class="bureau-slip-row"><span class="k">pages</span><span class="d"></span><span class="v" id="totals-pages">—</span></div>
        <div class="bureau-slip-row"><span class="k">estimated size</span><span class="d"></span><span class="v" id="totals-est-size">—</span></div>
        <div class="bureau-slip-row bureau-totals"><span class="k">TOTAL</span><span class="d"></span><span class="v" id="totals-output">—</span></div>
      </div>

      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Stamp &amp; Export →
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
  const totalsSection   = page.querySelector('#totals-section');
  const totalsPages     = page.querySelector('#totals-pages');
  const totalsEstSize   = page.querySelector('#totals-est-size');
  const totalsOutput    = page.querySelector('#totals-output');
  const convertBtn      = page.querySelector('#convert-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const result          = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    multiple: true,
    icon: '🖼️',
    title: 'Drop images here.',
    subtitle: 'accepts: jpg · png · webp',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  function addFiles(files) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = files.filter(f => validTypes.includes(f.type));
    if (!valid.length) { showToast('Please select JPG, PNG, or WebP images.', 'error'); return; }

    let loaded = 0;
    valid.forEach(file => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        images.push({ file, url, w: img.naturalWidth, h: img.naturalHeight });
        if (++loaded === valid.length) renderPreview();
      };
      img.src = url;
    });
  }

  function totalBytes() { return images.reduce((s, i) => s + i.file.size, 0); }

  function renderPreview() {
    result.style.display = 'none';

    if (!images.length) {
      fileListSection.style.display = 'none';
      optionsSection.style.display  = 'none';
      totalsSection.style.display   = 'none';
      convertBtn.style.display      = 'none';
      return;
    }

    // Update SLIP B count
    slipBCount.textContent =
      `${formatNum(images.length)} ITEM${images.length > 1 ? 'S' : ''} · ${formatBytes(totalBytes())}`;

    // Render file rows (keep only bureau-slip-head + new rows)
    const head = fileList.querySelector('.bureau-slip-head');
    fileList.innerHTML = '';
    fileList.appendChild(head);

    images.forEach((img, i) => {
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
          <div class="file-item-name">${img.file.name}</div>
          <div class="file-item-size">${img.w} × ${img.h}</div>
        </div>
        <span style="font-family:var(--font-mono);font-size:12px;color:var(--ink-2);font-weight:600;flex-shrink:0">
          ${formatBytes(img.file.size)}
        </span>
        <button class="file-item-remove" data-index="${i}" title="Remove">✕</button>
      `;
      fileList.appendChild(row);
    });

    // Remove buttons
    fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        URL.revokeObjectURL(images[idx].url);
        images.splice(idx, 1);
        renderPreview();
      });
    });

    // Drag-to-reorder rows
    let dragIdx = null;
    fileList.querySelectorAll('.file-item').forEach(row => {
      row.addEventListener('dragstart', () => { dragIdx = parseInt(row.dataset.index); row.style.opacity = '0.4'; });
      row.addEventListener('dragend',   () => { row.style.opacity = ''; });
      row.addEventListener('dragover',  e => e.preventDefault());
      row.addEventListener('drop', e => {
        e.preventDefault();
        const dropIdx = parseInt(row.dataset.index);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const [moved] = images.splice(dragIdx, 1);
          images.splice(dropIdx, 0, moved);
          renderPreview();
        }
        dragIdx = null;
      });
    });

    // Update SLIP D totals
    // PDF size ≈ source bytes (JPEGs embed as-is; WebP/PNG re-encoded to PNG ≈ slightly larger)
    const estBytes = totalBytes() * 1.05; // +5% overhead for PDF structure
    totalsPages.textContent   = formatNum(images.length);
    totalsEstSize.textContent = '~ ' + formatBytes(estBytes);
    totalsOutput.textContent  = `${formatNum(images.length)} PAGE${images.length > 1 ? 'S' : ''}`;

    fileListSection.style.display = 'block';
    optionsSection.style.display  = 'block';
    totalsSection.style.display   = 'block';
    convertBtn.style.display      = 'flex';
    convertBtn.disabled           = false;
  }

  function getPageSize() {
    return page.querySelector('input[name="page-size"]:checked')?.value || 'fit';
  }

  convertBtn.addEventListener('click', async () => {
    if (!images.length) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Processing...';
    progressArea.style.display = 'block';
    result.style.display = 'none';

    try {
      const pdfDoc  = await PDFDocument.create();
      const pageSize = getPageSize();

      for (let i = 0; i < images.length; i++) {
        progressFill.style.width = `${((i + 1) / images.length) * 100}%`;
        progressText.textContent = `Processing image ${i + 1} of ${images.length}...`;

        const arrayBuffer = await images[i].file.arrayBuffer();
        const type = images[i].file.type;
        let embeddedImg;

        if (type === 'image/png') {
          embeddedImg = await pdfDoc.embedPng(arrayBuffer);
        } else if (type === 'image/jpeg') {
          embeddedImg = await pdfDoc.embedJpg(arrayBuffer);
        } else {
          // WebP → PNG via canvas
          const bitmap = await createImageBitmap(images[i].file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
          embeddedImg = await pdfDoc.embedPng(await blob.arrayBuffer());
        }

        let w, h;
        if (pageSize === 'a4')     { w = 595.28; h = 841.89; }
        else if (pageSize === 'letter') { w = 612; h = 792; }
        else                        { w = embeddedImg.width; h = embeddedImg.height; }

        const p = pdfDoc.addPage([w, h]);

        if (pageSize === 'fit') {
          p.drawImage(embeddedImg, { x: 0, y: 0, width: w, height: h });
        } else {
          const scale = Math.min(w / embeddedImg.width, h / embeddedImg.height);
          const sw = embeddedImg.width * scale, sh = embeddedImg.height * scale;
          p.drawImage(embeddedImg, { x: (w - sw) / 2, y: (h - sh) / 2, width: sw, height: sh });
        }
      }

      progressText.textContent = 'Generating PDF...';
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ PDF Ready!</h3>
        <p>${images.length} page${images.length > 1 ? 's' : ''} · ${formatBytes(pdfBytes.length)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download PDF</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => saveAs(blob, 'converted.pdf'));
      showToast('PDF created successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to create PDF: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      convertBtn.innerHTML = 'Stamp &amp; Export →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
