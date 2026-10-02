(() => {
  // Quiet signature at the very end of every page: the ECHOx artist mark, linking to About ECHOxSTUDIOS.
  const script = document.currentScript;
  const base = script && script.src ? script.src.replace(/brand-signature\.js.*$/, '') : '/';
  if (document.documentElement.hasAttribute('data-no-signature')) return;

  const style = document.createElement('style');
  style.textContent = '.echox-signature{text-align:center;padding:2.75rem 1rem 4.5rem;line-height:0}.echox-signature a{display:inline-block;opacity:.82;transition:opacity .25s}.echox-signature a:hover,.echox-signature a:focus-visible{opacity:1}.echox-signature img{height:26px;width:auto;display:block}@media print{.echox-signature{display:none}}';
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'echox-signature';
  const link = document.createElement('a');
  link.href = base + 'about-echoxstudios.html';
  link.setAttribute('aria-label', 'About ECHOxSTUDIOS');
  const img = document.createElement('img');
  img.src = base + 'assets/brand/echox-artist-mark.png?v=20261002';
  img.alt = 'ECHOx';
  img.width = 98; img.height = 26; img.decoding = 'async'; img.loading = 'lazy';
  link.appendChild(img); wrap.appendChild(link);
  document.body.appendChild(wrap);
})();
