const ARR = '<span class="nav-arr">→</span>';

const NAV_ITEMS = [
  { path: '/',               label: 'Home' },
  { path: '/images-to-pdf',  label: `IMG ${ARR} PDF` },
  { path: '/pdf-to-images',  label: `PDF ${ARR} IMG` },
  { path: '/unlock-pdf',     label: 'Unlock PDF' },
  { path: '/compress-image', label: 'Compress' },
  { path: '/resize-image',   label: 'Resize' },
  { path: '/ai-analyzer',    label: 'AI Analyzer' },
  { path: '/doc-to-pdf',     label: `Docs ${ARR} PDF` },
];

export function renderNav() {
  const currentPath = window.location.pathname;

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="/" class="nav-brand">
        <span>F<span class="brand-i">i</span>Co</span>
      </a>
      <div class="nav-links">
        ${NAV_ITEMS.map(item => `
          <a href="${item.path}" class="nav-link ${currentPath === item.path ? 'active' : ''}">${item.label}</a>
        `).join('')}
      </div>
    </div>
  `;

  return nav;
}
