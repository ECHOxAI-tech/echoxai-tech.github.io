(() => {
  const footer = document.querySelector('body > footer');
  if (!footer) return;
  footer.innerHTML = `
    <span class="footer-logo">ECHOx</span>
    <ul class="footer-links">
      <li><a href="manuscripts.html">Manuscripts</a></li>
      <li><a href="gallery.html">Photography</a></li>
      <li><a href="lyrics.html">Music</a></li>
      <li><a href="development.html">Development</a></li>
      <li><a href="method.html">Method</a></li>
      <li><a href="terms.html">Terms</a></li>
      <li><a href="privacy.html">Privacy</a></li>
      <li><a href="contact.html">Contact</a></li>
      <li><a href="https://github.com/ECHOxAI-tech" target="_blank" rel="noopener">GitHub</a></li>
    </ul>
    <p class="footer-copy">© ECHOx — echoxstudios.art — Berlin — All rights reserved</p>`;
})();
