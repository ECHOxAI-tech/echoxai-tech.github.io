(() => {
  const style = document.createElement('style');
  style.textContent = '.echox-plain-x,.echox-mark-x{text-transform:none;letter-spacing:0;font-weight:inherit;font-style:normal}.echox-mark-x{display:inline-block;margin:0 .04em;font-size:.92em;line-height:1;vertical-align:.02em}';
  document.head.appendChild(style);

  const applyMarks = root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/ECHOx/.test(node.nodeValue) && !node.parentElement.closest('script, style, textarea, svg, .echox-mark-x, .echox-plain-x')) nodes.push(node);
    }

    nodes.forEach(node => {
      const parts = node.nodeValue.split(/(ECHOx)/g);
      const fragment = document.createDocumentFragment();
      parts.forEach((part, index) => {
        if (part === 'ECHOx') {
          fragment.append('ECHO');
          const mark = document.createElement('span');
          const compound = /^[A-Za-z0-9]/.test(parts[index + 1] || '');
          mark.className = compound ? 'echox-mark-x' : 'echox-plain-x';
          mark.setAttribute('aria-label', 'x');
          mark.textContent = compound ? '\u00d7' : 'x';
          fragment.append(mark);
        } else if (part) {
          fragment.append(part);
        }
      });
      node.replaceWith(fragment);
    });
  };

  applyMarks(document.body);
  new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          applyMarks(node.parentElement);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          applyMarks(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
