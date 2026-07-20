(() => {
  const style = document.createElement('style');
  style.textContent = '.echox-plain-x{text-transform:none}.echox-mark-x{display:inline-block;width:clamp(6px,.5em,10px);height:clamp(6px,.5em,10px);vertical-align:1px;margin:0 .5px;overflow:visible;white-space:nowrap;line-height:1;letter-spacing:0;text-transform:none}.echox-mark-x svg{display:block;width:100%;height:100%;overflow:visible}.echox-mark-x line{stroke:currentColor;stroke-width:1.65;stroke-linecap:square;vector-effect:non-scaling-stroke}';
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
          if (compound) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 12 12');
            svg.setAttribute('aria-hidden', 'true');
            [[1.5, 1.5, 10.5, 10.5], [10.5, 1.5, 1.5, 10.5]].forEach(points => {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', points[0]); line.setAttribute('y1', points[1]);
              line.setAttribute('x2', points[2]); line.setAttribute('y2', points[3]);
              svg.append(line);
            });
            mark.append(svg);
          } else {
            mark.textContent = 'x';
          }
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
