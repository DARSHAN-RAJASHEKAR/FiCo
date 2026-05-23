import * as pdfjsLib from 'pdfjs-dist';
import { createDropzone } from '../components/dropzone.js';
import { showToast } from '../components/toast.js';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY;

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

export function renderAiAnalyzer() {
  let uploadedFile = null;
  let extractedText = '';

  const PASSCODE = import.meta.env.VITE_AI_PASSCODE;

  const page = document.createElement('div');
  page.innerHTML = `
    <div class="page-header">
      <h1>AI Document Analyzer</h1>
      <p>Upload a contract or T&C — AI will summarize key points and flag hidden clauses</p>
    </div>

    <div id="passcode-gate" class="tool-card" style="text-align:center;padding:var(--space-3xl)">
      <div style="font-size:48px;margin-bottom:var(--space-lg)">🔒</div>
      <h3 style="margin-bottom:var(--space-sm)">Enter Passcode</h3>
      <p style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-lg)">This tool requires a 4-digit passcode to access</p>
      <div class="passcode-inputs">
        <input type="tel" maxlength="1" class="passcode-digit" data-index="0" autocomplete="off" />
        <input type="tel" maxlength="1" class="passcode-digit" data-index="1" autocomplete="off" />
        <input type="tel" maxlength="1" class="passcode-digit" data-index="2" autocomplete="off" />
        <input type="tel" maxlength="1" class="passcode-digit" data-index="3" autocomplete="off" />
      </div>
      <p id="passcode-error" style="color:var(--error);font-size:var(--text-sm);margin-top:var(--space-md);display:none">Incorrect passcode</p>
    </div>

    <div id="analyzer-content" style="display:none">
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
  const passcodeGate = page.querySelector('#passcode-gate');
  const analyzerContent = page.querySelector('#analyzer-content');
  const passcodeError = page.querySelector('#passcode-error');
  const digits = page.querySelectorAll('.passcode-digit');

  // Passcode logic
  digits[0].focus();

  digits.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '');
      if (input.value && i < 3) digits[i + 1].focus();
      checkPasscode();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        digits[i - 1].focus();
      }
    });
  });

  function checkPasscode() {
    const entered = Array.from(digits).map(d => d.value).join('');
    if (entered.length === 4) {
      if (entered === PASSCODE) {
        passcodeGate.style.display = 'none';
        analyzerContent.style.display = 'block';
      } else {
        passcodeError.style.display = 'block';
        digits.forEach(d => {
          d.value = '';
          d.style.borderColor = 'var(--error)';
        });
        digits[0].focus();
        setTimeout(() => {
          passcodeError.style.display = 'none';
          digits.forEach(d => d.style.borderColor = '');
        }, 1500);
      }
    }
  }

  const dropzone = createDropzone({
    accept: 'application/pdf,.pdf,.txt,.doc,.docx,text/plain',
    multiple: false,
    icon: '🔍',
    title: 'Drop your document here',
    subtitle: 'PDF or text file',
    onFiles: handleFile,
  });
  dropzoneMount.appendChild(dropzone);

  function updateAnalyzeButton() {
    analyzeBtn.disabled = extractedText.length === 0;
  }

  async function handleFile(files) {
    const file = files[0];
    if (!file) return;

    uploadedFile = file;
    result.style.display = 'none';

    fileInfo.style.display = 'flex';
    fileInfo.innerHTML = `
      <div class="file-item">
        <div class="file-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px">📄</div>
        <div class="file-item-info">
          <div class="file-item-name">${file.name}</div>
          <div class="file-item-size">${formatBytes(file.size)}</div>
        </div>
        <button class="file-item-remove" id="remove-file">✕</button>
      </div>
    `;

    page.querySelector('#remove-file').addEventListener('click', () => {
      uploadedFile = null;
      extractedText = '';
      fileInfo.style.display = 'none';
      textPreview.style.display = 'none';
      customQuerySection.style.display = 'none';
      analyzeBtn.style.display = 'none';
      result.style.display = 'none';
    });

    // Extract text
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        extractedText = await extractPdfText(file);
      } else {
        extractedText = await file.text();
      }

      if (!extractedText.trim()) {
        showToast('Could not extract text from this document. It might be a scanned image.', 'error');
        return;
      }

      // Show text preview
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  analyzeBtn.addEventListener('click', async () => {
    if (!OPENROUTER_KEY || !extractedText) {
      showToast('API key not configured.', 'error');
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
    progressArea.style.display = 'block';
    result.style.display = 'none';
    progressFill.style.width = '20%';
    progressText.textContent = 'Sending document to AI...';

    const userQuery = customQuery.value.trim();
    let userMessage = `Here is the document to analyze:\n\n---\n${extractedText}\n---`;
    if (userQuery) {
      userMessage += `\n\nThe user also has a specific question: ${userQuery}`;
    }

    try {
      progressFill.style.width = '40%';
      progressText.textContent = 'AI is reading the document...';

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'FiCo Document Analyzer',
        },
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
          <span class="ai-model-badge">${data.model || 'gemini-2.0-flash'}</span>
        </div>
        <div class="ai-result-content">${renderMarkdown(aiResponse)}</div>
      `;

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

  // Simple markdown renderer
  function renderMarkdown(text) {
    return text
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
