// Optional, anonymous research contribution endpoint.
//
// Design (see docs/RESEARCH_PROTOCOL.md):
//  - Active only while env.RESEARCH_ENABLED === '1' (kill switch: unset it and the endpoint returns 503).
//  - Anonymous counters only; item-level or linked data would need a separate consented study with ethics approval.
//  - Stores only per-dimension HISTOGRAM COUNTERS (tool, dimension, 10-point bucket, month).
//    No row per submission, no codes, no e-mail, no IP, no timestamps finer than a month,
//    so individual response vectors can never be reconstructed.
//  - The public on-site summary waits for K total contributions per tool, to avoid
//    over-interpreting a very small sample. That display rule does not limit the
//    author's use or sharing of the full anonymous aggregate table for research,
//    cultural-science work, publication or media.
//
// Bindings: RESEARCH_DB (D1), RESEARCH_LIMITER (rate limit, optional), RESEARCH_ENABLED, ETHICS_APPROVAL_REF.
import { cors, json, readJson, limited, ORIGINS } from './lib.mjs';

export const K = 30;
const MAX_BYTES = 1024;
const TOOLS = [1, 2, 3, 4, 6]; // tools 5 and 7 produce free-text protocols and never contribute
const T4_LABELS = ['system_failure', 'system_failure_early', 'dark_night', 'both', 'unclear'];
const DIM_RE = /^[a-z][a-z0-9_]{0,23}$/;

export function validate(body) {
  if (!body || typeof body !== 'object') return null;
  const allowed = new Set(['v', 'tool', 'scores', 'label']);
  if (Object.keys(body).some((k) => !allowed.has(k))) return null; // unknown fields are rejected, never stored
  if (body.v !== 1 || !TOOLS.includes(body.tool)) return null;

  const cells = [];
  if (body.tool === 4) {
    if (!T4_LABELS.includes(body.label)) return null;
    cells.push({ dim: `label_${body.label}`, bucket: 0 });
    return cells;
  }
  const scores = body.scores;
  if (body.tool === 6) {
    // Tool 6 reports small ordinal codes, not 0-100 scores.
    const LIMITS = { threshold: 4, architecture: 4, cost: 3 };
    if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return null;
    const keys = Object.keys(scores);
    if (!keys.length || keys.some((k) => !(k in LIMITS))) return null;
    for (const k of keys) {
      const v = scores[k];
      if (!Number.isInteger(v) || v < 1 || v > LIMITS[k]) return null;
      cells.push({ dim: k, bucket: v });
    }
    return cells;
  }
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return null;
  const entries = Object.entries(scores);
  if (!entries.length || entries.length > 12) return null;
  for (const [dim, value] of entries) {
    if (!DIM_RE.test(dim) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
    cells.push({ dim, bucket: Math.round(value / 10) * 10 });
  }
  return cells;
}

// Automated runs (our own test suites, headless browsers, scripts, crawlers) must never reach the counters.
// Nothing about the visitor is stored: the check is evaluated and discarded.
const AUTOMATED_UA = /headless|bot\b|crawl|spider|puppeteer|playwright|phantom|selenium|webdriver|lighthouse|curl|wget|python|node-fetch|undici|axios|httpclient|go-http/i;
export function isAutomated(req) {
  const origin = req.headers.get('Origin');
  if (!origin || !ORIGINS.includes(origin)) return true;          // only the live site, from a browser
  if (AUTOMATED_UA.test(req.headers.get('User-Agent') || '')) return true;
  if (!req.headers.get('User-Agent')) return true;
  return false;
}

const month = () => new Date().toISOString().slice(0, 7);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const enabled = env.RESEARCH_ENABLED === '1';

    try {
      if (url.pathname === '/research' && req.method === 'POST') {
        if (!enabled) return json(req, { error: 'research contribution is not active' }, 503);
        if (await limited(env, 'RESEARCH_LIMITER', req)) return json(req, { error: 'slow down' }, 429);
        // Acknowledged but discarded, so a test harness cannot tell and cannot skew the data.
        if (isAutomated(req)) return json(req, { accepted: true });
        const body = await readJson(req, MAX_BYTES);
        const cells = validate(body);
        if (!cells) return json(req, { error: 'invalid payload' }, 400);
        const m = month();
        const stmts = [
          env.RESEARCH_DB.prepare(
            'INSERT INTO totals (tool, month, n) VALUES (?1, ?2, 1) ON CONFLICT(tool, month) DO UPDATE SET n = n + 1'
          ).bind(body.tool, m),
          ...cells.map((c) =>
            env.RESEARCH_DB.prepare(
              'INSERT INTO cells (tool, dim, bucket, month, n) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT(tool, dim, bucket, month) DO UPDATE SET n = n + 1'
            ).bind(body.tool, c.dim, c.bucket, m)
          ),
        ];
        await env.RESEARCH_DB.batch(stmts);
        return json(req, { accepted: true });
      }

      if (url.pathname === '/research/summary' && req.method === 'GET') {
        const tool = Number(url.searchParams.get('tool'));
        if (!TOOLS.includes(tool)) return json(req, { error: 'invalid tool' }, 400);
        const totals = (await env.RESEARCH_DB.prepare('SELECT month, n FROM totals WHERE tool = ?1').bind(tool).all()).results;
        const n = totals.reduce((a, r) => a + r.n, 0);
        if (n < K) return json(req, { tool, suppressed: true, reason: `fewer than ${K} contributions`, active: enabled });
        const rows = (await env.RESEARCH_DB.prepare('SELECT dim, bucket, SUM(n) AS n FROM cells WHERE tool = ?1 GROUP BY dim, bucket').bind(tool).all()).results;
        const histograms = {};
        for (const r of rows) (histograms[r.dim] ||= {})[r.bucket] = r.n;
        return json(req, {
          tool, n, histograms,
          note: 'Anonymous aggregate counters only. Self-selected, non-representative contributions; not a census or clinical measure.',
        });
      }

      return json(req, { error: 'not found' }, 404);
    } catch (error) {
      return json(req, { error: error.message || 'error' }, error.status || 500);
    }
  },
};
