// Reads `wrangler kv key list` JSON on stdin and prints a redacted summary: counts per tool and an expiry spread.
// Retrieval codes are credentials, so keys are never printed; only a short one-way hash prefix of each is used to count uniques.
// Usage: wrangler kv key list --binding PROFILES -c worker/wrangler.toml --remote | node worker/redacted-export.mjs
import crypto from 'node:crypto';
let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  const keys = JSON.parse(input || '[]');
  const perTool = {}, expiry = { 'no expiry': 0, '<1 month': 0, '1-6 months': 0, '6-12 months': 0, '12-24 months': 0, '>24 months': 0 };
  const seen = new Set(); const now = Date.now() / 1000;
  for (const k of keys) {
    const m = /^(t[1-7])/.exec(k.name || ''); const tool = m ? m[1] : 'other';
    perTool[tool] = (perTool[tool] || 0) + 1;
    seen.add(crypto.createHash('sha256').update(k.name || '').digest('hex').slice(0, 8));
    if (!k.expiration) { expiry['no expiry']++; continue; }
    const months = (k.expiration - now) / (30 * 86400);
    expiry[months < 1 ? '<1 month' : months < 6 ? '1-6 months' : months < 12 ? '6-12 months' : months <= 24 ? '12-24 months' : '>24 months']++;
  }
  console.log(JSON.stringify({ generated: new Date().toISOString().slice(0, 10), records: keys.length, uniqueByHash: seen.size, perTool, monthsUntilExpiry: expiry, note: 'Contains no codes, no results and no personal data.' }, null, 2));
});
