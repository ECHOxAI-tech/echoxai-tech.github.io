// Hardened e-mail delivery for TDH results ("send my result to myself"). Replaces the original dashboard-edited
// worker, which accepted any recipient and any HTML from any caller (an open relay) and kept a public /stats route.
//
// Contract with the pages is unchanged: POST / { to, subject, htmlContent }. What changed is what it will accept:
//  - only requests from the live site's origin, one recipient, rate limited per visitor and per day overall;
//  - the subject must be one of the tool subjects; the HTML must be our own template (marker present, size capped,
//    no scripts, no handlers, links only to echoxstudios.art);
//  - nothing is logged or stored: not the recipient, not the content. The provider (Brevo) delivers the message.
//
// Bindings: BREVO_API_KEY (secret), SENDER_EMAIL (var, a sender verified in Brevo), EMAIL_LIMITER (rate limit),
// EMAIL_DAILY (KV, optional daily cap counter, expires in 36 h; holds a number only).
import { cors, json, readJson, limited, ORIGINS } from './lib.mjs';

const MAX_BYTES = 40 * 1024;
const DAILY_CAP = 300;
const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[A-Za-z]{2,}$/;
const SUBJECTS = [
  /^Trigger Gradient — The Dark Hierarchy$/,
  /^[\w —\-:,'’]{3,90} — The Dark Hierarchy$/,
  /^The Dark Hierarchy \u2014 Liturgical Matrix \[[A-HJ-NP-Z2-9]{6,12}\]$/,
];
const MARKER = 'The Dark Hierarchy';

export function validateMail(body) {
  if (!body || typeof body !== 'object') return 'Missing fields';
  const { to, subject, htmlContent } = body;
  if (Object.keys(body).some((k) => !['to', 'subject', 'htmlContent'].includes(k))) return 'Unexpected fields';
  if (typeof to !== 'string' || !EMAIL_RE.test(to.trim())) return 'Invalid recipient';
  if (typeof subject !== 'string' || !SUBJECTS.some((r) => r.test(subject))) return 'Invalid subject';
  if (typeof htmlContent !== 'string' || htmlContent.length < 50 || htmlContent.length > MAX_BYTES) return 'Invalid content';
  if (!htmlContent.includes(MARKER)) return 'Invalid content';
  if (/<\s*(script|iframe|object|embed|form|link|meta|base|style)\b/i.test(htmlContent)) return 'Invalid content';
  if (/\son[a-z]+\s*=/i.test(htmlContent) || /javascript:|data:text/i.test(htmlContent)) return 'Invalid content';
  for (const m of htmlContent.matchAll(/(?:href|src)\s*=\s*"([^"]*)"/gi)) {
    let u; try { u = new URL(m[1]); } catch { return 'Invalid content'; }
    if (u.protocol !== 'https:' || !/^(www\.)?echoxstudios\.art$/.test(u.hostname)) return 'Invalid content';
  }
  return null;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    if (url.pathname !== '/' || req.method !== 'POST') return json(req, { error: 'not found' }, 404);
    try {
      const origin = req.headers.get('Origin');
      if (!origin || !ORIGINS.includes(origin)) return json(req, { error: 'forbidden' }, 403);
      if (await limited(env, 'EMAIL_LIMITER', req)) return json(req, { error: 'slow down' }, 429);
      const body = await readJson(req, MAX_BYTES + 2048);
      const problem = validateMail(body);
      if (problem) return json(req, { error: problem }, 400);
      if (!env.BREVO_API_KEY || !env.SENDER_EMAIL) return json(req, { error: 'e-mail delivery is not configured' }, 503);

      if (env.EMAIL_DAILY) {
        const key = 'n' + new Date().toISOString().slice(0, 10);
        const n = Number(await env.EMAIL_DAILY.get(key)) || 0;
        if (n >= DAILY_CAP) return json(req, { error: 'daily limit reached' }, 429);
        await env.EMAIL_DAILY.put(key, String(n + 1), { expirationTtl: 60 * 60 * 36 });
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: 'The Dark Hierarchy', email: env.SENDER_EMAIL },
          to: [{ email: body.to.trim() }],
          subject: body.subject,
          htmlContent: body.htmlContent,
        }),
      });
      if (!res.ok) return json(req, { error: 'delivery failed' }, 502);
      return json(req, { sent: true });
    } catch (error) {
      return json(req, { error: error.message || 'error' }, error.status || 500);
    }
  },
};
