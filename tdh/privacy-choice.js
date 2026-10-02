(function () {
  'use strict';

  var WORKER = 'https://tdh-email.inbox-fde.workers.dev';
  /* Profile storage lives in its own hardened service; the original service is only read for legacy 6-character codes. */
  var PROFILE_SERVICE = 'https://tdh-profile.inbox-fde.workers.dev';
  /* E-mail delivery: the hardened service (worker/email.mjs). Set only after its Brevo secret is configured; until then
     the original service keeps delivering. */
  var EMAIL_SERVICE = '';
  var MODE_KEY = 'tdh_storage_mode';
  var AGE_KEY = 'tdh_adult_confirmed';
  var CONSENT_KEY = 'tdh_remote_consent_at';
  var CONSENT_VERSION = '2026-07-15';
  var originalFetch = window.fetch.bind(window);

  /* Retrieval-code length. Generation uses 12 characters (worker/profile.mjs deployed); 6-character legacy codes remain readable. */
  var CODE_LENGTH = 12;

  /* Anonymous research counters (docs/RESEARCH_PROTOCOL.md). A condition of use, stated plainly in the panel:
     each result adds only bucketed, identifier-free counters. Item-level or linked data is never sent here; that
     would need a separate consented study under an ethics approval. */
  var RESEARCH_ENDPOINT = 'https://tdh-research.inbox-fde.workers.dev';
  var ETHICS_APPROVAL_REF = '';
  var RESEARCH_KEY = 'tdh_research_optin';
  var RESEARCH_VERSION = '2026-10-03';
  var RESEARCH_TOOLS = [1, 2, 3, 4, 6]; /* tools 5 and 7 produce free-text protocols and never contribute */

  function mode() {
    return localStorage.getItem(MODE_KEY) || 'local';
  }

  function response(body, status) {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  window.fetch = function (input, options) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((options && options.method) || 'GET').toUpperCase();

    /* Result statistics are intentionally not transmitted. */
    if (url.indexOf(WORKER + '/stats') === 0) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (url.indexOf(WORKER + '/profile') === 0) {
      if (mode() !== 'remote') {
        return method === 'GET'
          ? response({ found: false, storage: 'local' }, 404)
          : response({ saved: false, storage: 'local' }, 200);
      }

      if (method === 'POST' && options && typeof options.body === 'string') {
        try {
          var payload = JSON.parse(options.body);
          payload.privacy = {
            consentVersion: CONSENT_VERSION,
            consentAt: localStorage.getItem(CONSENT_KEY)
          };
          options = Object.assign({}, options, { body: JSON.stringify(payload) });
        } catch (error) {
          /* Preserve the original request if its body is not JSON. */
        }
      }
    }

    if (url.indexOf(WORKER + '/profile') === 0) {
      var target = PROFILE_SERVICE + url.slice(WORKER.length);
      var legacy = method === 'GET' && /[?&]code=[A-Za-z0-9]{6}(&|$)/.test(url);
      var next = originalFetch(target, options);
      if (!legacy) return next;
      return next.then(function (res) { return res.ok ? res : originalFetch(input, options); }, function () { return originalFetch(input, options); });
    }

    if (EMAIL_SERVICE && url === WORKER && method === 'POST') return originalFetch(EMAIL_SERVICE, options);

    return originalFetch(input, options);
  };

  function researchAvailable() { return !!RESEARCH_ENDPOINT; }

  function researchOptedIn() {
    /* Accepted together with the adult confirmation; re-asked whenever the terms version changes. */
    try { return researchAvailable() && localStorage.getItem(RESEARCH_KEY) === RESEARCH_VERSION && localStorage.getItem(AGE_KEY) === 'yes'; }
    catch (error) { return false; }
  }

  /* Reduce a result to whitelisted, bucketed numbers. Nothing identifying, no free text. */
  function researchPayload(tool, result) {
    if (!result || RESEARCH_TOOLS.indexOf(tool) < 0) return null;
    if (tool === 4) {
      var labels = ['system_failure', 'system_failure_early', 'dark_night', 'both', 'unclear'];
      return labels.indexOf(result.primary) < 0 ? null : { v: 1, tool: 4, label: result.primary };
    }
    var scores = {}, count = 0;
    Object.keys(result).forEach(function (key) {
      var value = result[key], dim = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
      if (typeof value !== 'number' || !isFinite(value) || !/^[a-z]/.test(dim) || count >= 12) return;
      if (tool === 6) {
        if (['threshold', 'architecture', 'cost'].indexOf(dim) < 0) return;
        scores[dim] = Math.round(value);
      } else {
        if (value < 0 || value > 100) return;
        scores[dim] = Math.round(value);
      }
      count++;
    });
    return count ? { v: 1, tool: tool, scores: scores } : null;
  }

  function researchSubmit(tool, result) {
    try {
      if (!researchOptedIn()) return Promise.resolve(false);
      if (navigator.webdriver) return Promise.resolve(false); /* automated browsers never contribute */
      var payload = researchPayload(tool, result);
      if (!payload) return Promise.resolve(false);
      var sentKey = 'tdh_research_sent_t' + tool, month = new Date().toISOString().slice(0, 7);
      if (localStorage.getItem(sentKey) === month) return Promise.resolve(false); /* one per tool per device per month */
      localStorage.setItem(sentKey, month);
      return originalFetch(RESEARCH_ENDPOINT.replace(/\/$/, '') + '/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true
      }).then(function (r) { return r.ok; }, function () { return false; });
    } catch (error) { return Promise.resolve(false); }
  }

  function setMode(nextMode) {
    localStorage.setItem(MODE_KEY, nextMode);
    localStorage.setItem(AGE_KEY, 'yes');
    if (nextMode === 'remote') {
      localStorage.setItem(CONSENT_KEY, new Date().toISOString());
    } else {
      localStorage.removeItem(CONSENT_KEY);
    }
  }

  function localCodes() {
    var codes = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var m = /^tdh_code_t([1-7])$/.exec(key);
        if (m) codes.push('Tool ' + m[1] + ': ' + localStorage.getItem(key));
      }
    } catch (error) { /* storage unavailable */ }
    return codes.sort();
  }

  function deletionRequest() {
    var codes = localCodes();
    var body = 'Please delete the TDH profiles stored under these retrieval codes and confirm by reply.\n\n' +
      (codes.length ? codes.join('\n') : '[add your retrieval codes here]') + '\n';
    window.location.href = 'mailto:inbox@echoxstudios.art?subject=' + encodeURIComponent('TDH profile deletion') +
      '&body=' + encodeURIComponent(body);
  }

  var returnFocus = null;

  function closePanel(backdrop) {
    backdrop.remove();
    if (returnFocus && document.body.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
    document.documentElement.classList.remove('tdh-privacy-lock');
  }

  function showPanel(required) {
    var existing = document.querySelector('.tdh-privacy-backdrop');
    if (existing) return;

    returnFocus = document.activeElement;
    var current = localStorage.getItem(MODE_KEY);
    var backdrop = document.createElement('div');
    backdrop.className = 'tdh-privacy-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'tdh-privacy-title');
    backdrop.innerHTML =
      '<section class="tdh-privacy-panel">' +
        '<p class="tdh-privacy-kicker">Adults only · Privacy choice</p>' +
        '<h2 id="tdh-privacy-title">Choose how your results are stored</h2>' +
        '<p>The tools can generate intimate relationship and sexuality profiles. <strong>No analytics, and no individual result statistics, are sent.</strong></p>' +
        '<p><strong>Local only</strong> keeps results in this browser. <strong>Cross-device</strong> stores each generated result with its random retrieval code through the remote profile service, so it can be opened and compared on another device.</p>' +
        '<p>Cross-device storage is optional and requires explicit consent. Email delivery is a separate action you choose after receiving a result. Read the <a href="/privacy.html#tdh-data" target="_blank" rel="noopener">data-protection details</a>.</p>' +
        '<label class="tdh-age-confirm"><input type="checkbox" id="tdh-age-check"' + (localStorage.getItem(AGE_KEY) === 'yes' && (!researchAvailable() || localStorage.getItem(RESEARCH_KEY) === RESEARCH_VERSION) ? ' checked' : '') + '> <span>I confirm that I am 18 or older, understand that the tools may process sensitive personal reflections' + (researchAvailable() ? ', and accept the anonymous research counters described above' : '') + '.</span></label>' +
        (researchAvailable()
          ? '<p class="tdh-choice-current"><strong>Terms of use:</strong> the tools are free. In return, each result adds a few anonymous, rounded counters (for example &ldquo;visual: 60&ndash;70&rdquo;) to a research tally, at most once per tool per month. No code, name, e-mail, IP address, device identifier, free text or per-person record is ever stored, so nothing can be traced back to you. Counts are published only in aggregate. <a href="/tdh/research.html" target="_blank" rel="noopener">How it works</a>.</p>'
          : '') +
        '<div class="tdh-choice-grid">' +
          '<button class="tdh-choice-button" data-mode="local" type="button">Use locally</button>' +
          '<button class="tdh-choice-button" data-mode="remote" type="button">Enable cross-device</button>' +
        '</div>' +
        (current ? '<p class="tdh-choice-current">Current choice: ' + (current === 'remote' ? 'cross-device storage' : 'local-only storage') + '. Choosing local-only now withdraws consent for future remote storage. To erase previously stored profiles, <button type="button" class="tdh-choice-link" id="tdh-delete-request">prepare a deletion request with this device\'s retrieval codes</button> (opens your email app; nothing is sent until you send it).</p>' : '') +
      '</section>';

    document.body.appendChild(backdrop);
    document.documentElement.classList.add('tdh-privacy-lock');

    var check = backdrop.querySelector('#tdh-age-check');
    var buttons = Array.prototype.slice.call(backdrop.querySelectorAll('.tdh-choice-button'));
    function sync() {
      buttons.forEach(function (button) { button.disabled = !check.checked; });
    }
    check.addEventListener('change', sync);
    sync();

    var del = backdrop.querySelector('#tdh-delete-request');
    if (del) del.addEventListener('click', deletionRequest);

    backdrop.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var f = Array.prototype.slice.call(backdrop.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (!check.checked) return;
        setMode(button.getAttribute('data-mode'));
        try { localStorage.setItem(RESEARCH_KEY, RESEARCH_VERSION); } catch (error) { /* storage unavailable */ }
        closePanel(backdrop);
      });
    });

    if (!required) {
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) closePanel(backdrop);
      });
      document.addEventListener('keydown', function escape(event) {
        if (event.key === 'Escape' && document.body.contains(backdrop)) {
          closePanel(backdrop);
          document.removeEventListener('keydown', escape);
        }
      });
    }

    setTimeout(function () { check.focus(); }, 0);
  }

  function init() {
    var isTool = /tool-[1-7]-/.test(location.pathname);
    var requiresChoice = isTool || /\/profile\.html$/.test(location.pathname);
    var settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'tdh-privacy-settings';
    settings.textContent = 'Data choices';
    settings.setAttribute('aria-label', 'Review result storage choices');
    settings.addEventListener('click', function () { showPanel(false); });
    document.body.appendChild(settings);

    if (requiresChoice && (!localStorage.getItem(MODE_KEY) || localStorage.getItem(AGE_KEY) !== 'yes' || (researchAvailable() && localStorage.getItem(RESEARCH_KEY) !== RESEARCH_VERSION))) {
      showPanel(true);
    }
  }

  window.TDHPrivacy = { getMode: mode, codeLength: CODE_LENGTH, open: function () { showPanel(false); } };
  window.TDHResearch = { available: researchAvailable, optedIn: researchOptedIn, submit: researchSubmit, payload: researchPayload };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
