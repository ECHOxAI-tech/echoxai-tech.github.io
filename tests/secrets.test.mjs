// Secret scan of every tracked file: provider keys, tokens, private keys and key-like assignments must never be committed.
// (Resource ids such as KV and D1 ids are public configuration and are allowed.)  Run: node tests/secrets.test.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const files = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const PATTERNS = [
  [/xkeysib-[a-f0-9]{20,}/i, 'Brevo API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/, 'GitHub fine-grained token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'secret API key (sk-...)'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, 'private key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/(?:api[_-]?key|secret|token|password|passwd)["']?\s*[:=]\s*["'][A-Za-z0-9_\-\/+=]{24,}["']/i, 'key-like assignment'],
  [/\bCLOUDFLARE_API_TOKEN\s*=\s*\S{20,}/, 'Cloudflare API token'],
];
const SKIP = /(^|\/)(package-lock\.json|node_modules\/|test-results\/)|\.(png|jpe?g|webp|gif|pdf|mp3|woff2?|ico|svg)$/i;
let passed = 0;
const findings = [];
for (const f of files) {
  if (SKIP.test(f)) continue;
  let text; try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    for (const [re, name] of PATTERNS) if (re.test(line)) findings.push(`${f}:${i + 1}: possible ${name}`);
  });
}
assert.deepEqual(findings, [], 'secrets found in tracked files');
passed++; console.log(`ok   no secrets in ${files.length} tracked files`);
const ignored = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
assert.ok(/^\.anonymity-patterns$/m.test(ignored), '.anonymity-patterns (the name guard) must be git-ignored so it can never be committed');
passed++; console.log('ok   the name-guard pattern file is git-ignored');
console.log(`secrets scan: ${passed} passed`);
