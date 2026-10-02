/* Gives pages without a <main> a main landmark and a skip link. */
(function () {
  'use strict';
  function init() {
    if (document.querySelector('main, [role="main"]')) return;
    var keep = /^(SCRIPT|STYLE|LINK|NOSCRIPT|FOOTER|NAV|HEADER)$/;
    var nodes = Array.prototype.slice.call(document.body.children).filter(function (n) {
      return !(keep.test(n.tagName) || n.classList.contains('site-skip') || n.classList.contains('echox-signature') || n.getAttribute('role') === 'dialog');
    });
    if (!nodes.length) return;
    var main = document.createElement('main');
    main.id = 'site-main';
    main.tabIndex = -1;
    document.body.insertBefore(main, nodes[0]);
    nodes.forEach(function (n) { main.appendChild(n); });
    var skip = document.createElement('a');
    skip.className = 'site-skip';
    skip.href = '#site-main';
    skip.textContent = 'Skip to content';
    skip.addEventListener('click', function () { main.focus(); });
    document.body.insertBefore(skip, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
