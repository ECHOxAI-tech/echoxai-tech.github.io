// Shared helpers for the TDH workers. No personal data is ever logged.

export const ORIGINS = ['https://echoxstudios.art', 'https://www.echoxstudios.art'];

// 6 = legacy codes still in circulation; 12 = current generation (unambiguous 32-char alphabet).
export const CODE_RE = /^(?:[A-HJ-NP-Z2-9]{6}|[A-HJ-NP-Z2-9]{12})$/;
export const TOOL_RE = /^t[1-7]$/;

export function cors(req, extra = {}) {
  const origin = req.headers.get('Origin');
  const allowed = origin && ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

export function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(req, { 'Content-Type': 'application/json' }),
  });
}

export async function readJson(req, maxBytes) {
  const text = await req.text();
  if (text.length > maxBytes) throw Object.assign(new Error('payload too large'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('invalid json'), { status: 400 }); }
}

// Cloudflare rate-limit binding when present (nothing is stored); permissive no-op otherwise.
export async function limited(env, name, req) {
  const binding = env && env[name];
  if (!binding || typeof binding.limit !== 'function') return false;
  const key = req.headers.get('CF-Connecting-IP') || 'unknown';
  const { success } = await binding.limit({ key });
  return !success;
}

// Constant-time-ish comparison for code lookups (codes are the only credential).
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
