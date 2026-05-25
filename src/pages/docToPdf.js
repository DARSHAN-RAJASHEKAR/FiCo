import { renderAsync } from 'docx-preview';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

export function renderDocToPdf() {
  let currentFile = null;
  let fileType    = null;   // 'docx' | 'txt'
  let docxBuffer  = null;
  let textContent = null;

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header is-job-order">
      <span class="form-no">Form No. 07</span>
      <h1>Docs → PDF.</h1>
    </div>
    <div class="tool-card">
      <div id="dropzone-mount"></div>

      <div id="file-list-section" style="display:none">
        <div class="file-list" id="file-list">
          <div class="bureau-slip-head">
            <span>SLIP B · MATERIALS ENUMERATED</span>
            <span id="slip-b-meta"></span>
          </div>
        </div>
      </div>

      <div id="preview-section" style="display:none">
        <div class="options-bar bureau-opts" style="padding-bottom:0">
          <div class="bureau-slip-head" style="cursor:pointer" id="preview-toggle">
            <span>SLIP C · DOCUMENT PREVIEW</span>
            <span id="preview-toggle-label">SHOW</span>
          </div>
          <div id="doc-preview" style="display:none;margin-top:8px"></div>
        </div>
      </div>

      <button id="convert-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        Typeset &amp; Export →
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
  const slipBMeta       = page.querySelector('#slip-b-meta');
  const previewSection  = page.querySelector('#preview-section');
  const previewToggle   = page.querySelector('#preview-toggle');
  const previewLabel    = page.querySelector('#preview-toggle-label');
  const docPreview      = page.querySelector('#doc-preview');
  const convertBtn      = page.querySelector('#convert-btn');
  const progressArea    = page.querySelector('#progress-area');
  const progressFill    = page.querySelector('#progress-fill');
  const progressText    = page.querySelector('#progress-text');
  const result          = page.querySelector('#result');

  const dropzone = createDropzone({
    accept: '.docx,.doc,.txt,.text,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain',
    multiple: false,
    icon: '📝',
    title: 'Drop your document here.',
    subtitle: 'accepts: docx · doc · txt',
    onFiles: handleFile,
  });
  dropzoneMount.appendChild(dropzone);

  let previewVisible = false;
  previewToggle.addEventListener('click', () => {
    previewVisible = !previewVisible;
    docPreview.style.display = previewVisible ? 'block' : 'none';
    previewLabel.textContent = previewVisible ? 'HIDE' : 'SHOW';
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function handleFile(files) {
    const file = files[0];
    if (!file) return;

    const ext = getFileExtension(file.name);
    const validExts = ['docx', 'doc', 'txt', 'text'];
    if (!validExts.includes(ext)) {
      showToast('Please select a valid document file (DOCX, DOC, or TXT)', 'error');
      return;
    }

    currentFile = file;
    const icons = { docx: '📘', doc: '📘', txt: '📃', text: '📃' };

    // Build SLIP B row
    const head = fileList.querySelector('.bureau-slip-head');
    fileList.innerHTML = '';
    fileList.appendChild(head);

    const row = document.createElement('div');
    row.className = 'file-item';
    row.innerHTML = `
      <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;
        font-family:var(--font-mono);font-weight:700;font-size:13px;color:var(--ink-2)">
        ${icons[ext] || '📄'}
      </div>
      <div class="file-item-info">
        <div class="file-item-name">${escapeHtml(file.name)}</div>
        <div class="file-item-size">${ext.toUpperCase()} · ${formatBytes(file.size)}</div>
      </div>
      <button class="file-item-remove" id="remove-file" title="Remove">✕</button>
    `;
    fileList.appendChild(row);

    page.querySelector('#remove-file').addEventListener('click', () => {
      currentFile = null;
      fileType = null;
      docxBuffer = null;
      textContent = null;
      fileListSection.style.display = 'none';
      previewSection.style.display  = 'none';
      convertBtn.style.display      = 'none';
      result.style.display          = 'none';
    });

    slipBMeta.textContent = `01 ITEM · ${ext.toUpperCase()} · ${formatBytes(file.size)}`;
    fileListSection.style.display = 'block';
    convertBtn.style.display      = 'flex';
    convertBtn.disabled           = false;
    result.style.display          = 'none';

    try {
      if (ext === 'docx') {
        fileType   = 'docx';
        docxBuffer = await file.arrayBuffer();

        // Use an iframe to isolate docx-preview CSS from the main app
        docPreview.innerHTML = '';
        const previewIframe = document.createElement('iframe');
        previewIframe.style.cssText = 'width:100%;border:none;border-radius:4px;min-height:200px;overflow-x:hidden;';
        docPreview.appendChild(previewIframe);

        const iframeDoc = previewIframe.contentDocument;
        iframeDoc.open();
        iframeDoc.write(`<!DOCTYPE html>
<html><head><style>body{margin:0;padding:0;background:transparent;overflow-x:hidden;}</style></head><body></body></html>`);
        iframeDoc.close();

        const renderTarget = iframeDoc.createElement('div');
        iframeDoc.body.appendChild(renderTarget);

        await renderAsync(docxBuffer, renderTarget, iframeDoc.head, {
          className: 'docx-prev',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          ignoreFonts: false,
          renderHeaders: false,
          renderFooters: false,
        });

        const overrideStyle = iframeDoc.createElement('style');
        overrideStyle.textContent = `
          .docx-prev-wrapper { background: transparent !important; padding: 0 !important; }
          body { margin: 0 !important; padding: 0 !important; }
          section.docx-prev { box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important; }
        `;
        iframeDoc.head.appendChild(overrideStyle);

        const fitPreview = () => {
          const wrapper     = iframeDoc.querySelector('.docx-prev-wrapper') || renderTarget;
          const pageSection = iframeDoc.querySelector('section.docx-prev');
          const contentWidth = pageSection ? pageSection.offsetWidth : wrapper.scrollWidth;
          const iframeWidth  = previewIframe.clientWidth;

          if (contentWidth > iframeWidth) {
            const scale = iframeWidth / contentWidth;
            wrapper.style.transformOrigin = 'top left';
            wrapper.style.transform       = `scale(${scale})`;
            wrapper.style.width           = contentWidth + 'px';
            const leftOffset = (iframeWidth - contentWidth * scale) / 2;
            wrapper.style.marginLeft = leftOffset + 'px';
            previewIframe.style.height = Math.min(wrapper.scrollHeight * scale, 600) + 'px';
          } else {
            wrapper.style.margin        = '0 auto';
            wrapper.style.display       = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems    = 'center';
            previewIframe.style.height  = Math.min(iframeDoc.body.scrollHeight, 600) + 'px';
          }
        };
        fitPreview();
        setTimeout(fitPreview, 500);
      } else {
        fileType    = 'txt';
        textContent = await file.text();
        if (ext === 'doc') {
          textContent = textContent.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/ {3,}/g, '\n').trim();
          showToast('Note: .doc has limited formatting. Use .docx for best results.', 'error');
        }
        docPreview.innerHTML = `<pre style="white-space:pre-wrap;word-wrap:break-word;
          font-family:var(--font-mono);font-size:12px;line-height:1.6;
          padding:12px;background:var(--paper);border-radius:4px;">${escapeHtml(textContent)}</pre>`;
      }

      previewSection.style.display = 'block';
      previewVisible = false;
      previewLabel.textContent = 'SHOW';
      docPreview.style.display = 'none';
    } catch (err) {
      console.error('Parse error:', err);
      showToast('Failed to parse document: ' + err.message, 'error');
    }
  }

  /* ─── DOCX → PDF using iframe-isolated docx-preview + html2canvas ─── */
  async function convertDocxToPdf() {
    progressText.textContent = 'Rendering document...';
    progressFill.style.width = '15%';

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-10000px;top:0;border:none;width:1200px;height:2000px;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument;
    iframeDoc.open();
    iframeDoc.write('<!DOCTYPE html><html><head></head><body style="margin:0;padding:0;background:white;"></body></html>');
    iframeDoc.close();

    const renderTarget = iframeDoc.createElement('div');
    iframeDoc.body.appendChild(renderTarget);

    await renderAsync(docxBuffer, renderTarget, iframeDoc.head, {
      className: 'docx-conv',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      ignoreFonts: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    });

    await new Promise(r => setTimeout(r, 800));

    progressText.textContent = 'Capturing pages...';
    progressFill.style.width = '30%';

    let sections = Array.from(renderTarget.querySelectorAll('section.docx-conv'));
    if (sections.length === 0) {
      const wrapper = renderTarget.querySelector('.docx-conv-wrapper') || renderTarget.firstElementChild;
      sections = wrapper ? [wrapper] : [renderTarget];
    }

    const html2canvas = (await import('html2canvas-pro')).default;
    const pdfDoc      = await PDFDocument.create();
    const captureScale = 2;

    for (let i = 0; i < sections.length; i++) {
      progressText.textContent = `Capturing page ${i + 1} of ${sections.length}...`;
      progressFill.style.width = `${30 + ((i + 1) / sections.length) * 55}%`;

      const section = sections[i];
      const canvas  = await html2canvas(section, {
        scale: captureScale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth:  section.scrollWidth  || 900,
        windowHeight: section.scrollHeight || 1200,
      });

      const dataUrl  = canvas.toDataURL('image/png');
      const base64   = dataUrl.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const pdfImage = await pdfDoc.embedPng(imgBytes);

      const cssWidth  = canvas.width  / captureScale;
      const cssHeight = canvas.height / captureScale;
      const dpiRatio  = 72 / 96;
      const pageW = cssWidth  * dpiRatio;
      const pageH = cssHeight * dpiRatio;

      const pdfPage = pdfDoc.addPage([pageW, pageH]);
      pdfPage.drawImage(pdfImage, { x: 0, y: 0, width: pageW, height: pageH });
    }

    document.body.removeChild(iframe);
    return pdfDoc;
  }

  /* ─── TXT/DOC → PDF using pdf-lib native text ─── */
  async function convertTextToPdf() {
    progressText.textContent = 'Building PDF...';
    progressFill.style.width = '30%';

    const pdfDoc  = await PDFDocument.create();
    const font    = await pdfDoc.embedFont(StandardFonts.Courier);
    const fontSize = 10;
    const lineH   = fontSize * 1.4;

    const pw = 595.28, ph = 841.89;
    const mx = 72,     my = 72;
    const contentW = pw - mx * 2;

    const allLines = [];
    for (const rawLine of textContent.split('\n')) {
      if (!rawLine.trim()) { allLines.push(''); continue; }
      const words = rawLine.split(/\s+/);
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (font.widthOfTextAtSize(test, fontSize) > contentW && cur) {
          allLines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) allLines.push(cur);
    }

    let pg = pdfDoc.addPage([pw, ph]);
    let y  = ph - my;

    for (const line of allLines) {
      if (y - lineH < my) {
        pg = pdfDoc.addPage([pw, ph]);
        y  = ph - my;
      }
      y -= lineH;
      if (line) {
        pg.drawText(line, { x: mx, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      }
    }

    return pdfDoc;
  }

  /* ─── Convert button handler ─── */
  convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> Typesetting...';
    progressArea.style.display = 'block';
    result.style.display = 'none';
    progressFill.style.width = '5%';

    try {
      const pdfDoc = fileType === 'docx'
        ? await convertDocxToPdf()
        : await convertTextToPdf();

      progressText.textContent = 'Saving PDF...';
      progressFill.style.width = '95%';

      const pdfBytes  = await pdfDoc.save();
      const blob      = new Blob([pdfBytes], { type: 'application/pdf' });
      const pageCount = pdfDoc.getPageCount();
      const baseName  = currentFile.name.replace(/\.[^.]+$/, '');

      progressFill.style.width = '100%';

      result.style.display = 'block';
      result.innerHTML = `
        <h3>✓ PDF Ready!</h3>
        <p>${pageCount} page${pageCount > 1 ? 's' : ''} · ${formatBytes(pdfBytes.length)}</p>
        <button class="btn btn-primary" id="download-result">⬇ Download PDF</button>
      `;
      page.querySelector('#download-result').addEventListener('click', () => saveAs(blob, `${baseName}.pdf`));

      showToast('PDF created successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to create PDF: ' + err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      convertBtn.innerHTML = 'Typeset &amp; Export →';
      progressArea.style.display = 'none';
    }
  });

  return page;
}
