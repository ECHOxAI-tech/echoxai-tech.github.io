(() => {
  const style = document.createElement('style');
  style.textContent = '.echox-name{font:inherit!important;letter-spacing:inherit!important;text-transform:inherit!important;color:inherit!important;font-style:normal!important;font-synthesis:none;white-space:nowrap}.echox-name .echox-plain-x{font:inherit!important;letter-spacing:0!important;text-transform:none!important;color:inherit!important;font-style:normal!important}.echox-name .echox-mark-x{display:inline-block;font-family:Inconsolata,monospace!important;font-size:.9em!important;font-weight:400!important;font-style:normal!important;letter-spacing:0!important;text-transform:none!important;color:var(--gold-dim,#b8963e)!important;margin:0 .03em;line-height:1;vertical-align:0}';
  document.head.appendChild(style);

  const applyMarks = root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/ECHOx/.test(node.nodeValue) && !node.parentElement.closest('script, style, textarea, svg, .echox-name, .echox-mark-x, .echox-plain-x')) nodes.push(node);
    }

    nodes.forEach(node => {
      const parts = node.nodeValue.split(/(ECHOx[A-Za-z0-9]*)/g);
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (/^ECHOx/.test(part)) {
          // The whole name (standalone or compound) is one upright unit, never italic.
          const name = document.createElement('span');
          name.className = 'echox-name';
          const rest = part.slice(5);
          const mark = document.createElement('span');
          mark.className = rest ? 'echox-mark-x' : 'echox-plain-x';
          mark.setAttribute('aria-label', 'x');
          mark.textContent = rest ? '\u00d7' : 'x';
          name.append('ECHO', mark);
          if (rest) name.append(rest);
          fragment.append(name);
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
