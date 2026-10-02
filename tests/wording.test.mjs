// Scripted wording audit: the public repository must say what docs/DATA_FACTS.md says, and must not contain stale claims.
// Run: node tests/wording.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const text = f => read(f).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok  ', name); };

const scope = [
  'privacy.html', 'terms.html', 'tdh/research.html', 'tdh/system.html', 'tdh/info-sheet.html', 'tdh/index.html',
  'docs/DPIA.md', 'docs/RESEARCH_PROTOCOL.md', 'docs/DATA_FACTS.md', 'worker/README.md', 'development.html', 'tdh/profile.html',
  ...fs.readdirSync(path.join(root, 'tdh')).filter(f => /^tool-.*\.html$/.test(f)).map(f => 'tdh/' + f),
];

const STALE = [
  [/research service not deployed|\bnot deployed\b/i, 'says something is "not deployed"'],
  [/switched[ -]off/i, 'says the research channel is "switched off"'],
  [/off, and not deployed/i, 'says research is off'],
  [/until deletion is requested/i, 'says profiles are kept until deletion is requested (they expire after 24 months)'],
  [/required before research collection is enabled/i, 'says research is not yet enabled'],
  [/research (?:counters|channel|contribution)[^.]{0,60}\b(?:pending|not active|not yet active|coming soon)\b/i, 'says the research channel is pending'],
  [/explicit consent[^.|]{0,40}anonymous at source/i, 'claims consent for the anonymous counters (they are a term of use)'],
  [/(?<!older |legacy )\bsix-character (?:retrieval )?code/i, 'says retrieval codes have six characters (new codes have twelve; six-character codes are legacy)'],
  [/\b(?:reader|review)\s+(?:score|rating)s?\b|\b\d(?:\.\d)?\s*\/\s*10\b|\b\d(?:\.\d)?\s*(?:out of 10|stars?)\b/i, 'shows a rating or score'],
];
t('no stale or contradictory data wording in the public repository', () => {
  const problems = [];
  for (const f of scope) {
    if (!fs.existsSync(path.join(root, f)) || f === 'docs/DATA_FACTS.md') continue; // the source of truth quotes the forbidden claims as rules
    const body = f.endsWith('.md') ? read(f) : text(f);
    for (const [re, why] of STALE) if (re.test(body)) problems.push(`${f}: ${why}`);
  }
  assert.deepEqual(problems, []);
});

const REQUIRED = {
  'privacy.html': [/without a time limit/i, /24 months/, /anonymous research counters/i, /tool 1, 2, 3, 4 or 6/i],
  'tdh/research.html': [/fewer than 30|30 contributions/i, /tools 5 and 7/i, /Live/],
  'docs/RESEARCH_PROTOCOL.md': [/live since 2026-10-03/i, /fewer than \*\*30\*\*|k = 30/i, /Tools 5 and 7/],
  'docs/DPIA.md': [/live since 2026-10-03/i, /24 months/, /docs\/DATA_FACTS\.md/],
  'worker/README.md': [/live/i, /DATA_FACTS/],
};
t('each document states the required public truths', () => {
  const problems = [];
  for (const [f, res] of Object.entries(REQUIRED)) {
    const body = f.endsWith('.md') ? read(f) : text(f);
    for (const re of res) if (!re.test(body)) problems.push(`${f}: missing statement matching ${re}`);
  }
  assert.deepEqual(problems, []);
});

t('research status matches the live configuration', () => {
  const client = read('tdh/privacy-choice.js');
  const endpoint = (/RESEARCH_ENDPOINT = '([^']*)'/.exec(client) || [])[1];
  const toml = read('worker/wrangler.research.toml');
  const enabled = /RESEARCH_ENABLED\s*=\s*"1"/.test(toml);
  assert.ok(endpoint && enabled, 'documents say research is live, so the client endpoint must be set and RESEARCH_ENABLED must be "1"');
});

t('house rules: no full stop at the end of a heading, "Scandinavia" not "Sweden"', () => {
  const problems = [];
  for (const f of fs.readdirSync(root).filter(f => f.endsWith('.html')).concat(fs.readdirSync(path.join(root, 'tdh')).filter(f => f.endsWith('.html')).map(f => 'tdh/' + f))) {
    const html = read(f);
    for (const m of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
      const h = m[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim();
      if (/[.]$/.test(h) && !/\.\.\.$|…$/.test(h)) problems.push(`${f}: heading ends with a full stop: "${h.slice(0, 60)}"`);
    }
    // The rule is about how the artist describes where they are from. A song's language (lyrics.html) and a novel's
    // fictional setting (ones-who-left.html) are content, not self-description, so they are exempt.
    if (!/^(lyrics|ones-who-left)\.html$/.test(f) && /\bSweden\b|\bSwedish\b/.test(text(f))) problems.push(`${f}: says Sweden/Swedish (house rule: Scandinavia)`);
  }
  assert.deepEqual(problems, []);
});
console.log(`wording audit: ${passed} passed`);
