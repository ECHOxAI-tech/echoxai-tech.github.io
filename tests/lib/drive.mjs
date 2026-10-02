// Generic questionnaire driver: answers whatever the current screen asks, advances, and stops at the result screen.
export const TOOLS = [
  { n: 1, file: 'tdh/tool-1-trigger-gradient.html', result: '#view-results', research: true },
  { n: 2, file: 'tdh/tool-2-aspirational-self.html', result: '#view-profile', research: true },
  { n: 3, file: 'tdh/tool-3-attachment-confirmation.html', result: '#view-results', research: true },
  { n: 4, file: 'tdh/tool-4-dark-night.html', result: '#view-results', research: true },
  { n: 5, file: 'tdh/tool-5-protocol-designer.html', result: '#view-protocol', research: false },
  { n: 6, file: 'tdh/tool-6-threshold.html', result: '#view-results', research: true },
  { n: 7, file: 'tdh/tool-7-liturgy-matrix.html', result: '#view-results', research: false },
];

const STEP = `(() => {
  const vis = e => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && (e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  const q = (s, root = document) => [...root.querySelectorAll(s)].filter(vis);
  const click = e => { e.click(); return true; };
  const survey = document.querySelector('[id^=view-]:not([style*="display: none"])');
  const lit0 = q('.liturgy-item'); if (lit0.length && !document.querySelector('.liturgy-item.sel')) { lit0.slice(0, 4).forEach(click); return 'liturgies'; }
  // 1. one-shot gates and start buttons
  for (const s of ['#btn-start', '#btn-ready', '#btn-from-more', '#btn-generate', '#btn-reveal', '#btn-axes-next', '#btn-phase-continue']) {
    const b = q(s)[0]; if (b && !b.disabled) return (click(b), 'click ' + s);
  }
  // 2. answer the current prompt
  const likert = q('.lbtn'); if (likert.length) { if (!likert.some(b => b.classList.contains('sel') || b.getAttribute('aria-pressed') === 'true')) return (click(likert[3] || likert[0]), 'likert'); }
  const sel = q('.sel-btn'); if (sel.length && !sel.some(b => b.classList.contains('sel') || b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true')) return (click(sel[0]), 'select');
  const cloud = q('#q-cloud button, #q-cloud .adj, .adj-chip'); 
  const fields = q('textarea, input[type=text]').filter(e => e.id !== 'email-input' && !e.value);
  if (fields.length) { const f = fields[0]; f.focus(); f.value = 'quiet'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); return 'type'; }
  const lit = q('.liturgy-item'); if (lit.length && !document.querySelector('.liturgy-item.sel, .liturgy-item.active, .liturgy-item.on, .liturgy-item.selected')) { lit.slice(0, 4).forEach(click); return 'liturgies'; }
  if (cloud.length && !cloud.some(b => /sel|on|active/.test(b.className))) return (click(cloud[0]), 'chip');
  const sliders = q('input[type=range]'); if (sliders.length && !window.__tdhMoved) { window.__tdhMoved = true; sliders.forEach(s => { s.value = Math.round((+s.min + +s.max) / 2) + 1; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }); return 'sliders'; }
  // 3. advance
  const next = q('#btn-next')[0]; if (next && !next.disabled) return (click(next), 'next');
  return 'idle';
})()`;

// Drive until the result screen is visible. Returns the number of steps taken.
export async function completeTool(p, tool, { maxSteps = 400 } = {}) {
  const done = `(() => { const e = document.querySelector(${JSON.stringify(tool.result)}); return !!e && getComputedStyle(e).display !== 'none'; })()`;
  let idle = 0;
  for (let i = 0; i < maxSteps; i++) {
    if (await p.evaluate(done)) return i;
    const action = await p.evaluate(STEP);
    if (action === 'idle') { if (++idle > 12) throw new Error(`tool ${tool.n}: stuck (no actionable control) after ${i} steps`); await p.sleep(80); }
    else { idle = 0; if (/^(type|sliders|liturgies)$/.test(action)) await p.sleep(40); }
    // question screens may need a moment between answers
  }
  throw new Error(`tool ${tool.n}: result screen not reached in ${maxSteps} steps`);
}
