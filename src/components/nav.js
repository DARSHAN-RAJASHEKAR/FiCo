const NAV_ITEMS = [
  { hash: '#/', label: '🏠 Home' },
  { hash: '#/images-to-pdf', label: '🖼️ Images → PDF' },
  { hash: '#/pdf-to-images', label: '📄 PDF → Images' },
  { hash: '#/unlock-pdf', label: '🔓 Unlock PDF' },
  { hash: '#/compress-image', label: '🗜️ Compress' },
  { hash: '#/resize-image', label: '📐 Resize' },
  { hash: '#/ai-analyzer', label: '🤖 AI Analyzer' },
];

export function renderNav() {
  const currentHash = window.location.hash || '#/';

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-brand">
        <div class="logo-icon">⚡</div>
        <span>FiCo</span>
      </a>
      <div class="nav-links">
        ${NAV_ITEMS.map(item => `
          <a href="${item.hash}" class="nav-link ${currentHash === item.hash ? 'active' : ''}">${item.label}</a>
        `).join('')}
      </div>
    </div>
  `;

  return nav;
}
