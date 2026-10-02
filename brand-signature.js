(() => {
  // The ECHOx artist mark is a small, quiet signature, instantly seen but never loud (about 20px high).
  // Where a footer shows the text logo (.footer-logo, lower-left gutter) the mark replaces that text in place;
  // on pages without one it closes the page in the lower right corner, clear of the fixed "Data choices" control.
  const script = document.currentScript;
  const base = script && script.src ? script.src.replace(/brand-signature\.js.*$/, '') : '/';
  if (document.documentElement.hasAttribute('data-no-signature')) return;

  const style = document.createElement('style');
  style.textContent = '.echox-signature{align-self:stretch;box-sizing:border-box;display:flex;justify-content:flex-end;padding:2.25rem 1.25rem 3.6rem;line-height:0}.echox-signature a,.footer-logo a.echox-mark-link{display:inline-block;line-height:0;opacity:.8;transition:opacity .25s}.echox-signature a:hover,.echox-signature a:focus-visible,.footer-logo a.echox-mark-link:hover,.footer-logo a.echox-mark-link:focus-visible{opacity:1}.echox-signature img{height:20px;width:auto;display:block}.footer-logo{line-height:0}.footer-logo img{height:20px;width:auto;display:block}@media print{.echox-signature{display:none}}';
  document.head.appendChild(style);

  const makeLink = () => {
    const link = document.createElement('a');
    link.href = base + 'about-echoxstudios.html';
    link.setAttribute('aria-label', 'About ECHOxSTUDIOS');
    const img = document.createElement('img');
    img.src = base + 'assets/brand/echox-artist-mark-onblack.svg?v=20261007';
    img.alt = 'ECHOx';
    img.width = 83; img.height = 20; img.decoding = 'async'; img.loading = 'lazy';
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
  link.firstChild.height = 20; link.firstChild.width = 83;
  wrap.appendChild(link);
  document.body.appendChild(wrap);

  // Some pages keep their content in a narrow centred column. The signature belongs in the true lower right
  // corner of the page, so extend it to the viewport edge; its own padding then sets the gutter.
  const reach = () => {
    wrap.style.marginRight = '0';
    const gap = document.documentElement.clientWidth - wrap.getBoundingClientRect().right;
    wrap.style.marginRight = gap > 0 ? '-' + gap + 'px' : '0';
  };
  reach();
  window.addEventListener('resize', reach);
  window.addEventListener('load', reach);
  if (window.ResizeObserver) new ResizeObserver(reach).observe(document.body);
})();
