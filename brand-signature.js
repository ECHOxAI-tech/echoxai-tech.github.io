(() => {
  // The ECHOx artist mark is the page signature. Where a footer shows the text logo (.footer-logo),
  // the mark replaces it; on pages without one, it closes the page as a quiet signature.
  const script = document.currentScript;
  const base = script && script.src ? script.src.replace(/brand-signature\.js.*$/, '') : '/';
  if (document.documentElement.hasAttribute('data-no-signature')) return;

  const style = document.createElement('style');
  style.textContent = '.echox-signature{text-align:center;padding:2.75rem 1rem 4.75rem;line-height:0}.echox-signature a,.footer-logo a.echox-mark-link{display:inline-block;line-height:0;opacity:.85;transition:opacity .25s}.echox-signature a:hover,.echox-signature a:focus-visible,.footer-logo a.echox-mark-link:hover,.footer-logo a.echox-mark-link:focus-visible{opacity:1}.echox-signature img{height:36px;width:auto;display:block}.footer-logo{line-height:0}.footer-logo img{height:36px;width:auto;display:block}@media print{.echox-signature{display:none}}';
  document.head.appendChild(style);

  const makeLink = () => {
    const link = document.createElement('a');
    link.href = base + 'about-echoxstudios.html';
    link.setAttribute('aria-label', 'About ECHOxSTUDIOS');
    const img = document.createElement('img');
    img.src = base + 'assets/brand/echox-artist-mark-onblack.svg?v=20261004';
    img.alt = 'ECHOx';
    img.width = 149; img.height = 36; img.decoding = 'async'; img.loading = 'lazy';
    link.appendChild(img);
    return link;
  };

  const footerLogos = document.querySelectorAll('.footer-logo');
  if (footerLogos.length) {
    footerLogos.forEach(el => {
      const link = makeLink();
      link.className = 'echox-mark-link';
      el.textContent = '';
      el.appendChild(link);
    });
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'echox-signature';
  const link = makeLink();
  link.firstChild.height = 36; link.firstChild.width = 149;
  wrap.appendChild(link);
  document.body.appendChild(wrap);
})();
