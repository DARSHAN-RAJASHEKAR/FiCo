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
    <div class="page-header">
      <h1>Unlock PDF</h1>
      <p>Remove password protection from your PDF files</p>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>
      <div id="file-info" class="file-list" style="display:none"></div>
      <div id="password-section" style="display:none">
        <div class="password-group">
          <label for="pdf-password">PDF Password</label>
          <div class="password-input-wrapper">
            <input type="password" id="pdf-password" placeholder="Enter the PDF password" autocomplete="off" />
            <button class="password-toggle" id="toggle-password" type="button">👁</button>
          </div>
        </div>
      </div>
      <button id="unlock-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        🔓 Unlock & Download
      </button>
      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Unlocking...</div>
      </div>
      <div id="result" class="result-section" style="display:none"></div>
    </div>
  `;

  const dropzoneMount = page.querySelector('#dropzone-mount');
  const fileInfo = page.querySelector('#file-info');
  const passwordSection = page.querySelector('#password-section');
  const passwordInput = page.querySelector('#pdf-password');
  const togglePassword = page.querySelector('#toggle-password');
  const unlockBtn = page.querySelector('#unlock-btn');
  const progressArea = page.querySelector('#progress-area');
  const progressFill = page.querySelector('#progress-fill');
  const progressText = page.querySelector('#progress-text');
  const result = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf',
    multiple: false,
    icon: '🔒',
    title: 'Drop your locked PDF here',
    subtitle: 'Password-protected PDF',
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
    if (e.key === 'Enter' && !unlockBtn.disabled) {
      unlockBtn.click();
    }
  });

  function handleFile(files) {
    const file = files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a valid PDF file', 'error');
      return;
    }

    pdfFile = file;
    result.style.display = 'none';

    fileInfo.style.display = 'flex';
    fileInfo.innerHTML = `
      <div class="file-item">
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px">🔒</div>
        <div class="file-item-info">
          <div class="file-item-name">${file.name}</div>
          <div class="file-item-size">${formatBytes(file.size)}</div>
        </div>
        <button class="file-item-remove" id="remove-file">✕</button>
      </div>
    `;

    page.querySelector('#remove-file').addEventListener('click', () => {
      pdfFile = null;
      fileInfo.style.display = 'none';
      passwordSection.style.display = 'none';
      unlockBtn.style.display = 'none';
    });

    passwordSection.style.display = 'block';
    unlockBtn.style.display = 'flex';
    unlockBtn.disabled = !passwordInput.value.trim();
    passwordInput.focus();
  }

  unlockBtn.addEventListener('click', async () => {
    if (!pdfFile || !passwordInput.value.trim()) return;

    const password = passwordInput.value.trim();

    unlockBtn.disabled = true;
    unlockBtn.innerHTML = '<span class="spinner"></span> Unlocking...';
    progressArea.style.display = 'block';
    result.style.display = 'none';
    progressFill.style.width = '30%';
    progressText.textContent = 'Loading encrypted PDF...';

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();

      // Step 1: Load with pdfjs using the password (to decrypt)
      progressFill.style.width = '50%';
      progressText.textContent = 'Decrypting with password...';

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        password: password,
      }).promise;

      // Step 2: Render each page and rebuild a clean PDF with pdf-lib
      progressFill.style.width = '60%';
      progressText.textContent = 'Rebuilding unlocked PDF...';

      const newPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
        progressFill.style.width = `${60 + (i / pdf.numPages) * 30}%`;
        progressText.textContent = `Processing page ${i} of ${pdf.numPages}...`;

        const pg = await pdf.getPage(i);
        const viewport = pg.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pg.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const pngBuf = await blob.arrayBuffer();
        const img = await newPdfDoc.embedPng(pngBuf);

        // Use original page dimensions
        const origViewport = pg.getViewport({ scale: 1.0 });
        const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height,
        });
      }

      progressFill.style.width = '95%';
      progressText.textContent = 'Saving unlocked PDF...';

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const downloadName = pdfFile.name.replace('.pdf', '') + '-unlocked.pdf';

      progressFill.style.width = '100%';

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ PDF Unlocked!</h3>
        <p>${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} • ${formatBytes(pdfBytes.length)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download Unlocked PDF</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => {
        saveAs(blob, downloadName);
      });

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
      unlockBtn.innerHTML = '🔓 Unlock & Download';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
