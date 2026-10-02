// Optional, anonymous research contribution endpoint.
//
// Design (see docs/RESEARCH_PROTOCOL.md):
//  - Disabled unless env.RESEARCH_ENABLED === '1' AND env.ETHICS_APPROVAL_REF is set.
//  - Stores only per-dimension HISTOGRAM COUNTERS (tool, dimension, 10-point bucket, month).
//    No row per submission, no codes, no e-mail, no IP, no timestamps finer than a month,
//    so individual response vectors can never be reconstructed.
//  - Summary output is suppressed for any tool/month with fewer than K contributions.
//
// Bindings: RESEARCH_DB (D1), RESEARCH_LIMITER (rate limit, optional), RESEARCH_ENABLED, ETHICS_APPROVAL_REF.
import { cors, json, readJson, limited } from './lib.mjs';

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

const month = () => new Date().toISOString().slice(0, 7);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const enabled = env.RESEARCH_ENABLED === '1' && !!env.ETHICS_APPROVAL_REF;

    try {
      if (url.pathname === '/research' && req.method === 'POST') {
        if (!enabled) return json(req, { error: 'research contribution is not active' }, 503);
        if (await limited(env, 'RESEARCH_LIMITER', req)) return json(req, { error: 'slow down' }, 429);
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
          note: 'Self-selected, non-representative contributions. Marginal histograms only; not a census or clinical measure.',
        });
      }

      return json(req, { error: 'not found' }, 404);
    } catch (error) {
      return json(req, { error: error.message || 'error' }, error.status || 500);
    }
  },
};
