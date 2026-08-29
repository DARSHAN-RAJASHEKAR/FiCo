import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
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

export function renderUnlockPdf() {
  let pdfFile = null;

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 05</span>
      <h1>Unlock PDF.</h1>
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
            <span>SLIP C · CREDENTIALS</span>
            <span>REQUIRED</span>
          </div>
          <div class="opt-group">
            <div class="opt-label">PDF password</div>
            <div class="password-input-wrapper" style="margin-top:4px">
              <input type="password" id="pdf-password"
                placeholder="Enter the PDF password"
                autocomplete="off"
                style="font-family:var(--font-mono);font-size:13px;padding:10px 44px 10px 12px;
                  border:1.5px solid var(--ink-3);border-radius:4px;background:var(--paper);
                  color:var(--ink);width:100%;box-sizing:border-box;outline:none;" />
              <button class="password-toggle" id="toggle-password" type="button">👁</button>
            </div>
          </div>
        </div>
      </div>

      <button id="unlock-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Unseal &amp; Download →
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Unlocking...</div>
      </div>
      <div id="result" class="result-section" style="display:none"></div>
    </div>
  `;

  const dropzoneMount   = page.querySelector('#dropzone-mount');
  const fileListSection = page.querySelector('#file-list-section');
  const fileList        = page.querySelector('#file-list');
  const slipBCount      = page.querySelector('#slip-b-count');
  const optionsSection  = page.querySelector('#options-section');
  const passwordInput   = page.querySelector('#pdf-password');
  const togglePassword  = page.querySelector('#toggle-password');
  const unlockBtn       = page.querySelector('#unlock-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const result          = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf',
    multiple: false,
    icon: '🔒',
    title: 'Drop your locked PDF here.',
    subtitle: 'accepts: pdf (password-protected)',
    onFiles: handleFile,
  });
  dropzoneMount.appendChild(dropzone);

  // Toggle password visibility
  togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePassword.textContent = isPassword ? '🙈' : '👁';
  });

  // Enable button when password is typed
  passwordInput.addEventListener('input', () => {
    unlockBtn.disabled = !passwordInput.value.trim();
  });

  // Allow Enter key to submit
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !unlockBtn.disabled) unlockBtn.click();
  });

  function handleFile(files) {
    const file = files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a valid PDF file', 'error');
      return;
    }

    pdfFile = file;
    result.style.display = 'none';

    // Build SLIP B file row
    const head = fileList.querySelector('.bureau-slip-head');
    fileList.innerHTML = '';
    fileList.appendChild(head);

    const row = document.createElement('div');
    row.className = 'file-item';
    row.innerHTML = `
      <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
        font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">01</div>
      <div class="file-item-info">
        <div class="file-item-name">${file.name}</div>
        <div class="file-item-size">${formatBytes(file.size)}</div>
      </div>
      <button class="file-item-remove" id="remove-file" title="Remove">✕</button>
    `;
    fileList.appendChild(row);

    page.querySelector('#remove-file').addEventListener('click', () => {
      pdfFile = null;
      fileListSection.style.display = 'none';
      optionsSection.style.display  = 'none';
      unlockBtn.style.display       = 'none';
      result.style.display          = 'none';
      passwordInput.value           = '';
    });

    slipBCount.textContent = `01 ITEM · ${formatBytes(file.size)}`;
    fileListSection.style.display = 'block';
    optionsSection.style.display  = 'block';
    unlockBtn.style.display       = 'flex';
    unlockBtn.disabled            = !passwordInput.value.trim();
    passwordInput.focus();
  }

  unlockBtn.addEventListener('click', async () => {
    if (!pdfFile || !passwordInput.value.trim()) return;

    const password = passwordInput.value.trim();

    unlockBtn.disabled = true;
    unlockBtn.innerHTML = '<span class="spinner"></span> Unsealing...';
    progressArea.style.display = 'block';
    result.style.display = 'none';
    progressFill.style.width = '30%';
    progressText.textContent = 'Loading encrypted PDF...';

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();

      progressFill.style.width = '50%';
      progressText.textContent = 'Decrypting with password...';

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        password: password,
      }).promise;

      progressFill.style.width = '60%';
      progressText.textContent = 'Rebuilding unlocked PDF...';

      const newPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
        progressFill.style.width = `${60 + (i / pdf.numPages) * 30}%`;
        progressText.textContent = `Processing page ${i} of ${pdf.numPages}...`;

        const pg = await pdf.getPage(i);
        const viewport = pg.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pg.render({ canvasContext: ctx, viewport }).promise;

        const blob   = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const pngBuf = await blob.arrayBuffer();
        const img    = await newPdfDoc.embedPng(pngBuf);

        const origViewport = pg.getViewport({ scale: 1.0 });
        const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
        newPage.drawImage(img, { x: 0, y: 0, width: origViewport.width, height: origViewport.height });
      }

      progressFill.style.width = '95%';
      progressText.textContent = 'Saving unlocked PDF...';

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const downloadName = pdfFile.name.replace('.pdf', '') + '-unlocked.pdf';

      progressFill.style.width = '100%';

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ PDF Unsealed!</h3>
        <p>${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} · ${formatBytes(pdfBytes.length)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download Unlocked PDF</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => saveAs(blob, downloadName));

      showToast('PDF unlocked successfully!');
    } catch (err) {
      console.error(err);
      if (err.name === 'PasswordException' || err.message?.includes('password')) {
        showToast('Incorrect password. Please try again.', 'error');
      } else {
        showToast('Failed to unlock PDF: ' + err.message, 'error');
      }
    } finally {
      unlockBtn.disabled = false;
      unlockBtn.innerHTML = 'Unseal &amp; Download →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
