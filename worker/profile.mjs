// Hardened reference implementation of the TDH profile service.
// Contract (unchanged for the client):  POST /profile {code, tool, data}
//                                       GET  /profile?code=&tool=
// Added:                                DELETE /profile?code=&tool=   (possession of the code is the credential)
//
// Bindings: PROFILES (KV), PROFILE_READ_LIMITER / PROFILE_WRITE_LIMITER (rate limit, optional but recommended).
import { CODE_RE, TOOL_RE, cors, json, readJson, limited } from './lib.mjs';

const MAX_BYTES = 32 * 1024;
const RETENTION_SECONDS = 60 * 60 * 24 * 730; // 24 months without use; renewed on each save and, at most weekly, on each open
const RENEW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const keyOf = (tool, code) => `${tool}${code}`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (url.pathname !== '/profile') return json(req, { error: 'not found' }, 404);

    try {
      if (req.method === 'POST') {
        if (await limited(env, 'PROFILE_WRITE_LIMITER', req)) return json(req, { error: 'slow down' }, 429);
        const body = await readJson(req, MAX_BYTES);
        const { code, tool, data, privacy } = body || {};
        if (!CODE_RE.test(code || '') || !TOOL_RE.test(tool || '') || typeof data !== 'object' || data === null) {
          return json(req, { error: 'invalid request' }, 400);
        }
        // Remote storage exists only with explicit, versioned consent.
        if (!privacy || typeof privacy.consentAt !== 'string' || typeof privacy.consentVersion !== 'string') {
          return json(req, { error: 'consent required' }, 403);
        }
        const record = { data, consentAt: privacy.consentAt, consentVersion: privacy.consentVersion, touchedAt: Date.now() };
        await env.PROFILES.put(keyOf(tool, code), JSON.stringify(record), { expirationTtl: RETENTION_SECONDS });
        return json(req, { saved: true });
      }

      if (req.method === 'GET' || req.method === 'DELETE') {
        if (await limited(env, 'PROFILE_READ_LIMITER', req)) return json(req, { error: 'slow down' }, 429);
        const code = url.searchParams.get('code') || '';
        const tool = url.searchParams.get('tool') || '';
        if (!CODE_RE.test(code) || !TOOL_RE.test(tool)) return json(req, { found: false }, 404);
        const raw = await env.PROFILES.get(keyOf(tool, code));
        if (!raw) return json(req, { found: false }, 404);
        if (req.method === 'DELETE') {
          await env.PROFILES.delete(keyOf(tool, code));
          return json(req, { deleted: true });
        }
        const record = JSON.parse(raw);
        // Opening a result counts as use: restart the 24-month clock, but write at most once a week per record.
        if (!record.touchedAt || Date.now() - record.touchedAt > RENEW_AFTER_MS) {
          record.touchedAt = Date.now();
          await env.PROFILES.put(keyOf(tool, code), JSON.stringify(record), { expirationTtl: RETENTION_SECONDS });
        }
        return json(req, { found: true, data: record.data });
      }

      return json(req, { error: 'method not allowed' }, 405);
    } catch (error) {
      return json(req, { error: error.message || 'error' }, error.status || 500);
    }
  },
};
