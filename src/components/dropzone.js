/**
 * Creates a reusable drag-and-drop file upload zone.
 * @param {Object} options
 * @param {string} options.accept - File accept string, e.g. 'image/*,.png,.jpg'
 * @param {boolean} options.multiple - Allow multiple files
 * @param {string} options.icon - Emoji icon to display
 * @param {string} options.title - Title text
 * @param {string} options.subtitle - Subtitle text
 * @param {function} options.onFiles - Callback receiving File[]
 * @returns {HTMLElement}
 */
export function createDropzone({ accept, multiple = false, icon = '📁', title, subtitle, onFiles }) {
  const wrapper = document.createElement('div');

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.style.display = 'none';
  input.id = 'dropzone-input-' + Math.random().toString(36).slice(2);

  const zone = document.createElement('div');
  zone.className = 'dropzone';
  zone.innerHTML = `
    <div class="dropzone-icon">${icon}</div>
    <div class="dropzone-text">
      <h3>${title}</h3>
      <p>${subtitle} or <span class="browse-link">browse files</span></p>
    </div>
  `;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  });

  input.addEventListener('change', () => {
    const files = Array.from(input.files);
    if (files.length) onFiles(files);
    input.value = '';
  });

  wrapper.appendChild(input);
  wrapper.appendChild(zone);
  return wrapper;
}
