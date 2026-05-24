import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const ANALYZE_URL = '/api/analyze';

const SYSTEM_PROMPT = `You are an expert legal document analyst. When given a document, you must:

1. **Summary** — Provide a concise summary in short bullet points. Only the most important points.
2. **Key Obligations** — What the signer is agreeing to (payments, responsibilities, deadlines etc.)
3. **🚩 Red Flags & Hidden Clauses** — Flag anything that could be problematic, unfair, or that the signer MUST know before signing. This includes:
   - Auto-renewal clauses
   - Penalty clauses
   - Liability limitations
   - Data sharing / privacy concerns
   - Non-compete or exclusivity clauses
   - Arbitration or dispute resolution restrictions
   - Fee escalation clauses
   - Termination restrictions
4. **Recommendation** — A brief overall assessment: Is this safe to sign? What to negotiate?

Format your response with markdown headings and bullet points. Be direct and flag concerns clearly with 🚩 emoji.`;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function renderAiAnalyzer() {
  let extractedText = '';
  let imageData = null; // { base64, mimeType } for vision mode

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>AI Document Analyzer</h1>
      <p>Upload a contract or T&C — AI will summarize key points and flag hidden clauses</p>
    </div>

    <div id="analyzer-content">
      <div class="tool-card">
        <div id="dropzone-mount"></div>
        <div id="file-info" class="file-list" style="display:none"></div>
        <div id="text-preview" style="display:none"></div>

      <div id="custom-query-section" style="display:none">
        <div class="query-group">
          <label for="custom-query">Ask something specific <span style="color:var(--text-muted)">(optional)</span></label>
          <textarea id="custom-query" rows="2" placeholder="e.g. What are the cancellation terms? Is there an auto-renewal clause?"></textarea>
        </div>
      </div>

      <button id="analyze-btn" class="btn btn-primary btn-large btn-convert" style="display:none" disabled>
        🤖 Analyze Document
      </button>

      <div id="progress-area" style="display:none">
        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
        <div class="progress-text" id="progress-text">Analyzing...</div>
      </div>

      <div id="result" class="ai-result" style="display:none"></div>
      </div>
    </div>
  `;

  const dropzoneMount = page.querySelector('#dropzone-mount');
  const fileInfo = page.querySelector('#file-info');
  const textPreview = page.querySelector('#text-preview');
  const customQuerySection = page.querySelector('#custom-query-section');
  const customQuery = page.querySelector('#custom-query');
  const analyzeBtn = page.querySelector('#analyze-btn');
  const progressArea = page.querySelector('#progress-area');
  const progressFill = page.querySelector('#progress-fill');
  const progressText = page.querySelector('#progress-text');
  const result = page.querySelector('#result');
  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf,.txt,.doc,.docx,text/plain,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif',
    multiple: false,
    icon: '🔍',
    title: 'Drop your document here',
    subtitle: 'PDF, DOCX, TXT or Image',
    onFiles: handleFile,
  });
  dropzoneMount.appendChild(dropzone);

  function updateAnalyzeButton() {
    analyzeBtn.disabled = !extractedText && !imageData;
  }

  async function handleFile(files) {
    const file = files[0];
    if (!file) return;

    result.style.display = 'none';

    fileInfo.style.display = 'flex';
    fileInfo.innerHTML = `
      <div class="file-item">
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px">📄</div>
        <div class="file-item-info">
          <div class="file-item-name">${escapeHtml(file.name)}</div>
          <div class="file-item-size">${formatBytes(file.size)}</div>
        </div>
        <button class="file-item-remove" id="remove-file">✕</button>
      </div>
    `;

    page.querySelector('#remove-file').addEventListener('click', () => {
      extractedText = '';
      imageData = null;
      fileInfo.style.display = 'none';
      textPreview.style.display = 'none';
      customQuerySection.style.display = 'none';
      analyzeBtn.style.display = 'none';
      result.style.display = 'none';
    });

    // Extract content
    try {
      if (IMAGE_TYPES.includes(file.type)) {
        // Vision mode — compress and store as base64
        imageData = await compressImage(file);
        extractedText = '';

        textPreview.style.display = 'block';
        textPreview.innerHTML = `
          <div class="text-preview-box">
            <div class="text-preview-header">
              <span>🖼️ Image ready for vision analysis</span>
              <span class="text-preview-count">${formatBytes(Math.round(imageData.base64.length * 0.75))}</span>
            </div>
            <img src="data:${imageData.mimeType};base64,${imageData.base64}"
              style="max-width:100%;max-height:200px;object-fit:contain;margin-top:8px;border-radius:6px;display:block" />
          </div>
        `;
      } else {
        // Text extraction mode
        imageData = null;
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          extractedText = await extractPdfText(file);
        } else if (file.name.endsWith('.docx')) {
          extractedText = await extractDocxText(file);
        } else {
          extractedText = await file.text();
        }

        if (!extractedText.trim()) {
          showToast('Could not extract text from this document.', 'error');
          return;
        }

        const previewChars = extractedText.slice(0, 500);
        textPreview.style.display = 'block';
        textPreview.innerHTML = `
          <div class="text-preview-box">
            <div class="text-preview-header">
              <span>📝 Extracted Text</span>
              <span class="text-preview-count">${extractedText.length.toLocaleString()} characters</span>
            </div>
            <div class="text-preview-content">${escapeHtml(previewChars)}${extractedText.length > 500 ? '...' : ''}</div>
          </div>
        `;
      }

      customQuerySection.style.display = 'block';
      analyzeBtn.style.display = 'flex';
      updateAnalyzeButton();

    } catch (err) {
      console.error(err);
      showToast('Failed to read document: ' + err.message, 'error');
    }
  }

  async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const content = await pg.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  }

  async function extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // word/document.xml holds the main body text
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Invalid .docx file — word/document.xml not found');

    const xml = await xmlFile.async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    // Each <w:p> is a paragraph; <w:t> nodes inside hold the text
    const paragraphs = Array.from(doc.getElementsByTagNameNS('*', 'p'));
    return paragraphs
      .map(p => {
        const textNodes = Array.from(p.getElementsByTagNameNS('*', 't'));
        return textNodes.map(t => t.textContent).join('');
      })
      .filter(line => line.trim())
      .join('\n');
  }

  function compressImage(file, maxPx = 1536, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          const scale = maxPx / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve({ base64: dataUrl.split(',')[1], mimeType });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  analyzeBtn.addEventListener('click', async () => {
    if (!extractedText && !imageData) {
      showToast('Please upload a document first.', 'error');
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
    progressArea.style.display = 'block';
    result.style.display = 'none';
    progressFill.style.width = '20%';
    progressText.textContent = 'Sending document to AI...';

    const userQuery = customQuery.value.trim();

    // Build user message — multimodal for images, plain text otherwise
    let userMessage;
    if (imageData) {
      const textPart = userQuery
        ? `Analyze this document image.\n\nThe user also has a specific question: ${userQuery}`
        : 'Analyze this document image.';
      userMessage = [
        { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } },
        { type: 'text', text: textPart },
      ];
    } else {
      let text = `Here is the document to analyze:\n\n---\n${extractedText}\n---`;
      if (userQuery) text += `\n\nThe user also has a specific question: ${userQuery}`;
      userMessage = text;
    }

    try {
      progressFill.style.width = '40%';
      progressText.textContent = 'AI is reading the document...';

      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash:standard',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });

      progressFill.style.width = '80%';
      progressText.textContent = 'Processing response...';

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('Empty response from AI');
      }

      progressFill.style.width = '100%';

      // Render markdown-ish response
      result.style.display = 'block';
      result.innerHTML = `
        <div class="ai-result-header">
          <span>🤖 AI Analysis</span>
          <span class="ai-model-badge"></span>
        </div>
        <div class="ai-result-content">${renderMarkdown(aiResponse)}</div>
      `;
      result.querySelector('.ai-model-badge').textContent = data.model || 'gemini-2.5-flash';

      showToast('Document analyzed successfully!');
    } catch (err) {
      console.error(err);
      if (err.message.includes('401') || err.message.includes('auth')) {
        showToast('Invalid API key. Check your OpenRouter key.', 'error');
      } else {
        showToast('Analysis failed: ' + err.message, 'error');
      }
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '🤖 Analyze Document';
      progressArea.style.display = 'none';
      updateAnalyzeButton();
    }
  });

  // Simple markdown renderer — escapes raw text first to prevent XSS
  function renderMarkdown(text) {
    return escapeHtml(text)
      // Headings
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Bullet points
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines
      .replace(/\n/g, '<br>')
      // Wrap in paragraph
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .replace(/<p><(h[1-4]|ul)/g, '<$1')
      .replace(/<\/(h[1-4]|ul)><\/p>/g, '</$1>');
  }

  return page;
}
