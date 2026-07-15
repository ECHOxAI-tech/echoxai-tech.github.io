(() => {
  const style = document.createElement('style');
  style.textContent = '.echox-mark-x{display:inline-block;width:.44em;height:.44em;position:relative;vertical-align:.13em;margin:0 .025em;overflow:hidden;text-indent:-9999px;white-space:nowrap;line-height:1;letter-spacing:0;text-transform:none}.echox-mark-x::before,.echox-mark-x::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:.08em;min-height:1px;background:currentColor;transform-origin:center}.echox-mark-x::before{transform:translate(-50%,-50%) rotate(45deg)}.echox-mark-x::after{transform:translate(-50%,-50%) rotate(-45deg)}';
  document.head.appendChild(style);

  const applyMarks = root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/ECHOx(?=[A-Za-z0-9])/.test(node.nodeValue) && !node.parentElement.closest('script, style, textarea, svg, .echox-mark-x')) nodes.push(node);
    }

    nodes.forEach(node => {
      const parts = node.nodeValue.split(/(ECHOx(?=[A-Za-z0-9]))/g);
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (part === 'ECHOx') {
          fragment.append('ECHO');
          const mark = document.createElement('span');
          mark.className = 'echox-mark-x';
          mark.setAttribute('aria-label', 'x');
          mark.textContent = 'x';
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
