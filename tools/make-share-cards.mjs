// Draws the share-card images (1200 x 630) used for link previews of the TDH pages: assets/og/*.png.
// Reproducible: node tools/make-share-cards.mjs  (needs Chrome; uses the self-hosted fonts and the site's colours).
import fs from 'node:fs';
import path from 'node:path';
import { launch, root } from '../tests/lib/browser.mjs';

const CARDS = [
  { file: 'tdh-index', kicker: 'The digital Echo-System', title: 'The Dark Hierarchy', line: 'Seven private instruments for personal reflection. Free, no account, adults only.' },
  { file: 'tool-1', kicker: 'Tool I of VII', title: 'Trigger Gradient Profiler', line: 'Which of four channels carries your desire, and in what proportion.' },
  { file: 'tool-2', kicker: 'Tool II of VII', title: 'Aspirational Sexual Self', line: 'The version of yourself you most want to feel like, in your own words.' },
  { file: 'tool-3', kicker: 'Tool III of VII', title: 'Attachment as Confirmation', line: 'How confirmation has reached you, and how you respond when it wavers.' },
  { file: 'tool-4', kicker: 'Tool IV of VII', title: 'Dark Night Diagnostic', line: 'Erosion survived, or a system that has failed. A provisional reading.' },
  { file: 'tool-5', kicker: 'Tool V of VII', title: 'Protocol Designer', line: 'A written protocol for a dynamic, built from your own choices.' },
  { file: 'tool-6', kicker: 'Tool VI of VII', title: 'The Threshold', line: 'Which threshold you stand at, and what crossing or staying costs.' },
  { file: 'tool-7', kicker: 'Tool VII of VII', title: 'Liturgy and Household Matrix', line: 'The rites and rules of a household, assembled into one matrix.' },
  { file: 'system', kicker: 'Acquisitions briefing', title: 'The Dark Hierarchy', line: 'A work of erotic philosophy with a private digital companion.' },
  { file: 'research', kicker: 'Research roadmap', title: 'The Thesis, Made Testable', line: 'Six hypotheses, stated so that they could be wrong.' },
  { file: 'examples', kicker: 'Example results', title: 'What a result looks like', line: 'Invented answers, shown so you can see before you start.' },
  { file: 'scoring', kicker: 'Method', title: 'How the scores are computed', line: 'Plain arithmetic on your own answers, done in your browser.' },
];
// Product pages: the official lockup centred on the dark ground (an SVG cannot be a link preview on most networks).
const LOCKUPS = [
  { file: 'echoxlumina', svg: '/assets/brand/echoxlumina-lockup-dark.svg' },
  { file: 'echoxvault', svg: '/assets/brand/echoxvault-lockup-dark.svg' },
];
const lockupHtml = l => `<!doctype html><meta charset="utf-8"><style>*{margin:0}html,body{width:1200px;height:630px;background:#080806}body{display:flex;align-items:center;justify-content:center}img{max-width:820px;max-height:360px}</style><body><img src="${l.svg}"></body>`;
const html = c => `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/assets/fonts/fonts.css"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;background:#080806;color:#f0ece3;overflow:hidden}
body{position:relative;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;padding:72px 84px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(ellipse at 15% 0%,rgba(212,169,62,.14),transparent 60%),#080806}
.k{font:400 22px 'Inconsolata',monospace;letter-spacing:.32em;text-transform:uppercase;color:#d4a93e}
.rule{width:88px;height:2px;background:#d4a93e;margin:34px 0 38px}
h1{font:400 84px/1.04 'IM Fell English',Georgia,serif;letter-spacing:.01em;color:#f0ece3;max-width:980px}
p{font:italic 300 36px/1.35 'Cormorant Garamond',Georgia,serif;color:#cfc9bd;max-width:900px;margin-top:30px}
.f{display:flex;justify-content:space-between;align-items:baseline;font:300 20px 'Inconsolata',monospace;letter-spacing:.2em;text-transform:uppercase;color:#a09890}
.f b{font-weight:400;color:#d4a93e;text-transform:none;letter-spacing:.1em}
</style><body><div><div class="k">${c.kicker}</div><div class="rule"></div><h1>${c.title}</h1><p>${c.line}</p></div><div class="f"><span>The Dark Hierarchy &middot; Echo-System</span><b>echoxstudios.art/tdh</b></div></body>`;

const tmp = path.join(root, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(path.join(root, 'assets', 'og'), { recursive: true });
const b = await launch(); const c = await b.context();
for (const card of CARDS) {
  fs.writeFileSync(path.join(tmp, 'card.html'), html(card));
  const p = await c.page('tmp/card.html', { width: 1200, height: 630, mobile: false });
  await p.evaluate('document.fonts.ready.then(() => true)'); await p.sleep(500);
  const s = await p.call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  fs.writeFileSync(path.join(root, 'assets', 'og', card.file + '.png'), Buffer.from(s.result.data, 'base64'));
  await p.close();
}
for (const l of LOCKUPS) {
  fs.writeFileSync(path.join(tmp, 'card.html'), lockupHtml(l));
  const p = await c.page('tmp/card.html', { width: 1200, height: 630, mobile: false });
  await p.sleep(700);
  const s = await p.call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  fs.writeFileSync(path.join(root, 'assets', 'og', l.file + '.png'), Buffer.from(s.result.data, 'base64'));
  await p.close();
}
await b.stop();
console.log(`wrote ${CARDS.length + LOCKUPS.length} share cards to assets/og/`);
