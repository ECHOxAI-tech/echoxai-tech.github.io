(function () {
  'use strict';

  function humanize(el) {
    var id = (el.id || el.name || '').replace(/[-_]+/g, ' ').trim();
    return el.getAttribute('placeholder') || el.title || id || 'Input';
  }

  function labelField(el) {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
    if (el.id && document.querySelector('label[for="' + el.id + '"]')) return;
    if (el.closest('label')) return;
    if (el.type === 'hidden' || el.type === 'checkbox' && el.closest('label')) return;
    var text = humanize(el);
    if (el.classList.contains('code-cell')) text = 'Retrieval code, ' + text.replace(/[^\w ]/g, '').trim();
    if (/^[—-]+$/.test(el.getAttribute('placeholder') || '')) text = 'Retrieval code';
    el.setAttribute('aria-label', text);
  }

  function syncPressed(btn) {
    btn.setAttribute('aria-pressed', btn.classList.contains('sel') ? 'true' : 'false');
  }

  function enhance(root) {
    root.querySelectorAll('input, textarea, select').forEach(labelField);
    root.querySelectorAll('button.lbtn').forEach(syncPressed);
    root.querySelectorAll('.send-feedback').forEach(function (el) {
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
    });
    root.querySelectorAll('svg').forEach(function (svg) {
      if (svg.closest('button, a, [aria-hidden="true"]') || svg.getAttribute('role') || svg.getAttribute('aria-label')) return;
      if (svg.getAttribute('viewBox') && svg.querySelector('polygon, circle')) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Visual summary chart of your result. The same findings are given in the written interpretation.');
      }
    });
  }

  function landmarks() {
    if (document.querySelector('main, [role="main"]')) return;
    var main = document.createElement('main');
    main.id = 'tdh-main';
    main.tabIndex = -1;
    var keep = /^(SCRIPT|STYLE|LINK|NOSCRIPT|FOOTER|NAV)$/;
    var nodes = Array.prototype.slice.call(document.body.children).filter(function (node) {
      return !(keep.test(node.tagName) || node.classList.contains('tdh-privacy-backdrop') || node.classList.contains('tdh-privacy-settings') || node.classList.contains('tdh-skip') || node.classList.contains('echox-signature'));
    });
    if (!nodes.length) return;
    document.body.insertBefore(main, nodes[0]);
    nodes.forEach(function (node) { main.appendChild(node); });
    var skip = document.createElement('a');
    skip.className = 'tdh-skip';
    skip.href = '#tdh-main';
    skip.textContent = 'Skip to content';
    skip.addEventListener('click', function () { main.focus(); });
    document.body.insertBefore(skip, document.body.firstChild);
  }

  function init() {
    landmarks();
    enhance(document);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.target.matches && m.target.matches('button.lbtn')) { syncPressed(m.target); return; }
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) enhance(n); });
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
