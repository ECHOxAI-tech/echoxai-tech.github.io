(() => {
  const button = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-links');
  if (button && menu) {
    const closeMenu = () => {
      menu.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open navigation');
    };

    button.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      button.setAttribute('aria-expanded', String(isOpen));
      button.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });

    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  const content = document.querySelector('main, .wrapper, .catalogue, #about');
  if (content) {
    if (!content.id) content.id = 'main-content';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${content.id}`;
    skip.textContent = 'Skip to content';
    document.body.prepend(skip);
  }

  document.querySelectorAll('.photo-cell').forEach((cell, index) => {
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');
    const image = cell.querySelector('img');
    cell.setAttribute('aria-label', `Open photograph: ${(image && image.alt) || `work ${index + 1}`}`);
    cell.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        cell.click();
      }
    });
  });

  window.toggleTrack = function toggleTrack(id) {
    const body = document.getElementById(id);
    const toggle = document.getElementById(`${id}-toggle`);
    if (!body) return;
    const open = body.classList.toggle('open');
    const header = body.previousElementSibling;
    if (header) header.setAttribute('aria-expanded', String(open));
    if (toggle) toggle.textContent = open ? 'Close lyrics ↑' : 'Read lyrics ↓';
  };

  document.querySelectorAll('.track-header').forEach(header => {
    const body = header.nextElementSibling;
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', body && body.classList.contains('open') ? 'true' : 'false');
    if (body && body.id) header.setAttribute('aria-controls', body.id);
    header.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        header.click();
      }
    });
  });
})();
