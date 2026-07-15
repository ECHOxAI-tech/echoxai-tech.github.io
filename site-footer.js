(() => {
  const footer = document.querySelector('body > footer');
  if (!footer) return;
  footer.innerHTML = `
    <span class="footer-logo">ECHOx</span>
    <ul class="footer-links">
      <li><a href="contact.html">Contact</a></li>
      <li><a href="privacy.html">Privacy</a></li>
      <li><a href="terms.html">Terms</a></li>
    </ul>
    <p class="footer-copy">© ECHOx — echoxstudios.art — Berlin — All rights reserved</p>`;
})();
