(() => {
  const style = document.createElement('style');
  style.textContent = '.echox-mark-x{display:inline-block;font-size:.62em;line-height:1;position:static;vertical-align:middle;margin:0 .015em}';
  document.head.appendChild(style);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/ECHOx(?=[A-Z0-9])/.test(node.nodeValue) && !node.parentElement.closest('script, style, textarea, svg')) nodes.push(node);
  }

  nodes.forEach(node => {
    const parts = node.nodeValue.split(/(ECHOx(?=[A-Z0-9]))/g);
    const fragment = document.createDocumentFragment();
    parts.forEach(part => {
      if (part === 'ECHOx') {
        fragment.append('ECHO');
        const mark = document.createElement('span');
        mark.className = 'echox-mark-x';
        mark.textContent = 'x';
        fragment.append(mark);
      } else if (part) {
        fragment.append(part);
      }
    });
    node.replaceWith(fragment);
  });
})();
