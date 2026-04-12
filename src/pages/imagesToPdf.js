import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderImagesToPdf() {
  let images = []; // { file, url }

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>Images → PDF</h1>
      <p>Drag your images, reorder them, and convert to a single PDF</p>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>
      <div id="image-preview" class="image-grid" style="display:none"></div>
      <div id="options" class="options-bar" style="display:none">
        <div class="select-wrapper">
          <select id="page-size">
            <option value="fit">Fit to Image</option>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </div>
        <span style="color:var(--text-muted);font-size:var(--text-sm)" id="image-count"></span>
      </div>
      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Convert to PDF
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Preparing...</div>
      </div>
      <div id="result" class="result-section" style="display:none"></div>
    </div>
  `;

  const dropzoneMount = page.querySelector('#dropzone-mount');
  const preview = page.querySelector('#image-preview');
  const options = page.querySelector('#options');
  const convertBtn = page.querySelector('#convert-btn');
  const progressArea = page.querySelector('#progress-area');
  const progressFill = page.querySelector('#progress-fill');
  const progressText = page.querySelector('#progress-text');
  const result = page.querySelector('#result');
  const imageCount = page.querySelector('#image-count');

  const dropzone = createDropzone({
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    multiple: true,
    icon: '🖼️',
    title: 'Drop images here',
    subtitle: 'JPG, PNG, or WebP',
    onFiles: addFiles,
  });
  dropzoneMount.appendChild(dropzone);

  function addFiles(files) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validFiles = files.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      showToast('Please select valid image files (JPG, PNG, WebP)', 'error');
      return;
    }

    validFiles.forEach(file => {
      images.push({ file, url: URL.createObjectURL(file) });
    });

    renderPreview();
  }

  function renderPreview() {
    if (images.length === 0) {
      preview.style.display = 'none';
      options.style.display = 'none';
      convertBtn.style.display = 'none';
      return;
    }

    preview.style.display = 'grid';
    options.style.display = 'flex';
    convertBtn.style.display = 'flex';
    convertBtn.disabled = false;
    result.style.display = 'none';
    imageCount.textContent = `${images.length} image${images.length > 1 ? 's' : ''}`;

    preview.innerHTML = images.map((img, i) => `
      <div class="image-grid-item" draggable="true" data-index="${i}">
        <img src="${img.url}" alt="Image ${i + 1}" />
        <span class="item-index">${i + 1}</span>
        <button class="item-remove" data-index="${i}">✕</button>
      </div>
    `).join('');

    // Remove handlers
    preview.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        URL.revokeObjectURL(images[idx].url);
        images.splice(idx, 1);
        renderPreview();
      });
    });

    // Drag-to-reorder
    let dragIdx = null;
    preview.querySelectorAll('.image-grid-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        dragIdx = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropIdx = parseInt(item.dataset.index);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const [moved] = images.splice(dragIdx, 1);
          images.splice(dropIdx, 0, moved);
          renderPreview();
        }
        dragIdx = null;
      });
    });
  }

  convertBtn.addEventListener('click', async () => {
    if (images.length === 0) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Converting...';
    progressArea.style.display = 'block';
    result.style.display = 'none';

    try {
      const pdfDoc = await PDFDocument.create();
      const pageSize = page.querySelector('#page-size').value;

      for (let i = 0; i < images.length; i++) {
        progressFill.style.width = `${((i + 1) / images.length) * 100}%`;
        progressText.textContent = `Processing image ${i + 1} of ${images.length}...`;

        const arrayBuffer = await images[i].file.arrayBuffer();
        let img;
        const type = images[i].file.type;

        if (type === 'image/png') {
          img = await pdfDoc.embedPng(arrayBuffer);
        } else if (type === 'image/jpeg') {
          img = await pdfDoc.embedJpg(arrayBuffer);
        } else {
          // WebP: convert to PNG via canvas
          const bitmap = await createImageBitmap(images[i].file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
          const pngBuf = await blob.arrayBuffer();
          img = await pdfDoc.embedPng(pngBuf);
        }

        let width, height;
        if (pageSize === 'a4') {
          width = 595.28;
          height = 841.89;
        } else if (pageSize === 'letter') {
          width = 612;
          height = 792;
        } else {
          width = img.width;
          height = img.height;
        }

        const p = pdfDoc.addPage([width, height]);

        if (pageSize === 'fit') {
          p.drawImage(img, { x: 0, y: 0, width, height });
        } else {
          const scale = Math.min(width / img.width, height / img.height);
          const scaledW = img.width * scale;
          const scaledH = img.height * scale;
          p.drawImage(img, {
            x: (width - scaledW) / 2,
            y: (height - scaledH) / 2,
            width: scaledW,
            height: scaledH,
          });
        }
      }

      progressText.textContent = 'Generating PDF...';
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ PDF Ready!</h3>
        <p>${images.length} page${images.length > 1 ? 's' : ''} • ${formatBytes(pdfBytes.length)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download PDF</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => {
        saveAs(blob, 'converted.pdf');
      });

      showToast('PDF created successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to create PDF: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      convertBtn.innerHTML = 'Convert to PDF';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
