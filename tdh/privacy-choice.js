(function () {
  'use strict';

  var WORKER = 'https://tdh-email.inbox-fde.workers.dev';
  /* Profile storage lives in its own hardened service. The original service has been retired. */
  var PROFILE_SERVICE = 'https://tdh-profile.inbox-fde.workers.dev';
  /* E-mail delivery: the hardened service (worker/email.mjs). Set only after its Brevo secret is configured; until then
     the original service keeps delivering. */
  var EMAIL_SERVICE = 'https://tdh-mail.inbox-fde.workers.dev';
  var MODE_KEY = 'tdh_storage_mode';
  var AGE_KEY = 'tdh_adult_confirmed';
  var CONSENT_KEY = 'tdh_remote_consent_at';
  var CONSENT_VERSION = '2026-07-15';
  var originalFetch = window.fetch.bind(window);

  /* "Nothing saved" mode: everything the tools would keep in the browser goes to this window's session storage instead,
     which the browser wipes when the window closes. The choice itself lives only there, so a new window asks again. */
  var realStorage = null;
  try { realStorage = window.localStorage; } catch (error) { realStorage = null; }
  function installNoneShim() {
    try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return window.sessionStorage; } }); } catch (error) { /* keep default */ }
  }
  function removeNoneShim() {
    try { delete window.localStorage; } catch (error) { /* ignore */ }
    try { window.sessionStorage.removeItem(MODE_KEY); } catch (error) { /* ignore */ }
  }
  try { if (window.sessionStorage.getItem(MODE_KEY) === 'none') installNoneShim(); } catch (error) { /* ignore */ }

  /* Retrieval-code length. Generation uses 12 characters (worker/profile.mjs deployed); 6-character legacy codes remain readable. */
  var CODE_LENGTH = 12;

  /* Anonymous research counters (docs/RESEARCH_PROTOCOL.md). A condition of use, stated plainly in the panel:
     each result adds only bucketed, identifier-free counters. Item-level or linked data is never sent here; that
     would need a separate consented study under an ethics approval. */
  var RESEARCH_ENDPOINT = 'https://tdh-research.inbox-fde.workers.dev';
  var ETHICS_APPROVAL_REF = '';
  var RESEARCH_KEY = 'tdh_research_optin';
  // Re-ask because the disclosure now expressly permits redacted sharing with scientists and media.
  var RESEARCH_VERSION = '2026-10-03';
  var RESEARCH_TOOLS = [1, 2, 3, 4, 6]; /* tools 5 and 7 produce free-text protocols and never contribute */

  /* Storage that never throws. When the browser blocks localStorage (some private modes, strict settings), values live
     in memory for this page view only and the result screen says so. */
  var memory = {}, storageBlocked = false;
  var store = {
    get: function (key) {
      try { return localStorage.getItem(key); }
      catch (error) { storageBlocked = true; return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, value); }
      catch (error) { storageBlocked = true; memory[key] = String(value); }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); }
      catch (error) { storageBlocked = true; delete memory[key]; }
    }
  };

  function mode() {
    return store.get(MODE_KEY) || 'local';
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
            consentAt: store.get(CONSENT_KEY)
          };
          options = Object.assign({}, options, { body: JSON.stringify(payload) });
        } catch (error) {
          /* Preserve the original request if its body is not JSON. */
        }
      }
    }

    if (url.indexOf(WORKER + '/profile') === 0) {
      var target = PROFILE_SERVICE + url.slice(WORKER.length);
      return originalFetch(target, options);
    }

    if (EMAIL_SERVICE && url === WORKER && method === 'POST') return originalFetch(EMAIL_SERVICE, options);

    return originalFetch(input, options);
  };

  /* A page opened with ?code= is a stored result being revisited, not a new completion; it never contributes again.
     Evaluated once at load, before a tool rewrites the address after saving. */
  var openedByCode = /[?&]code=/.test(location.search);

  function researchAvailable() { return !!RESEARCH_ENDPOINT; }

  function researchOptedIn() {
    /* Accepted together with the adult confirmation; re-asked whenever the terms version changes. */
    try { return researchAvailable() && store.get(RESEARCH_KEY) === RESEARCH_VERSION && store.get(AGE_KEY) === 'yes'; }
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

  /* Receipt shown under the retrieval code. It never contains submitted values, an identifier or a count. */
  var RECEIPT = {
    sent: 'Anonymous aggregate contribution recorded.',
    already: 'Anonymous contribution for this month is already recorded from this device.',
    paused: 'Anonymous research counters are paused at the moment. Your result is unaffected.',
    failed: 'Your result is still available; the anonymous contribution could not be sent and will retry next time.'
  };

  function showReceipt(status) {
    var text = RECEIPT[status];
    if (!text) return;
    function place() {
      var el = document.getElementById('tdh-research-receipt');
      if (!el) {
        el = document.createElement('p');
        el.id = 'tdh-research-receipt';
        el.className = 'tdh-research-receipt';
        el.setAttribute('role', 'status');
        var anchor = document.getElementById('code-box');
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
        else document.body.appendChild(el);
      }
      el.setAttribute('data-status', status);
      el.textContent = text;
    }
    if (document.body) place(); else document.addEventListener('DOMContentLoaded', place);
  }

  /* Resolves to 'sent' | 'already' | 'paused' | 'failed' | 'skipped'. 'skipped' (not opted in, automated browser,
     shared-link view, nothing to send) shows no receipt. Only an acknowledged contribution consumes the monthly
     allowance, so every failure stays retryable. */
  function researchSubmit(tool, result) {
    function done(status) { showReceipt(status); return status; }
    try {
      if (openedByCode) return Promise.resolve('skipped');
      if (window.__tdhSharedView) return Promise.resolve('skipped'); /* someone else's result opened from a link is never contributed */
      if (!researchOptedIn()) return Promise.resolve('skipped');
      if (navigator.webdriver) return Promise.resolve('skipped'); /* automated browsers never contribute */
      var payload = researchPayload(tool, result);
      if (!payload) return Promise.resolve('skipped');
      var sentKey = 'tdh_research_sent_t' + tool, month = new Date().toISOString().slice(0, 7);
      if (store.get(sentKey) === month) return Promise.resolve(done('already')); /* one per tool per device per month */
      return originalFetch(RESEARCH_ENDPOINT.replace(/\/$/, '') + '/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true
      }).then(function (r) {
        if (r.ok) { store.set(sentKey, month); return done('sent'); }
        return done(r.status === 503 ? 'paused' : 'failed');
      }, function () { return done('failed'); });
    } catch (error) { return Promise.resolve('failed'); }
  }

  function setMode(nextMode) {
    if (nextMode === 'none') {
      try { if (realStorage) { realStorage.removeItem(MODE_KEY); realStorage.removeItem(CONSENT_KEY); } } catch (error) { /* ignore */ }
      try { window.sessionStorage.setItem(MODE_KEY, 'none'); } catch (error) { /* ignore */ }
      installNoneShim();
      store.set(AGE_KEY, 'yes');
      return;
    }
    if (store.get(MODE_KEY) === 'none') removeNoneShim();
    store.set(MODE_KEY, nextMode);
    store.set(AGE_KEY, 'yes');
    if (nextMode === 'remote') {
      store.set(CONSENT_KEY, new Date().toISOString());
    } else {
      store.remove(CONSENT_KEY);
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

  /* Removes the results this device already holds (not the research "already contributed" markers). */
  function wipeLocalResults() {
    try {
      if (!realStorage) return;
      var drop = [];
      for (var i = 0; i < realStorage.length; i++) {
        var k = realStorage.key(i);
        if (/^tdh_t[1-7]_/.test(k) || /^tdh_code_t[1-7]$/.test(k)) drop.push(k);
      }
      drop.forEach(function (k) { realStorage.removeItem(k); });
    } catch (error) { /* ignore */ }
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
    var current = store.get(MODE_KEY);
    var backdrop = document.createElement('div');
    backdrop.className = 'tdh-privacy-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'tdh-privacy-title');
    backdrop.innerHTML =
      '<section class="tdh-privacy-panel">' +
        '<p class="tdh-privacy-kicker">Adults only · Privacy choice</p>' +
        '<h2 id="tdh-privacy-title">Should your code work on any device and browser?</h2>' +
        '<p>The tools give you a personal result and a code. <strong>No analytics, and no individual result statistics, are sent.</strong> Read the <a href="/privacy.html#tdh-data" target="_blank" rel="noopener">data-protection details</a>.</p>' +
        '<label class="tdh-age-confirm"><input type="checkbox" id="tdh-age-check"' + (store.get(AGE_KEY) === 'yes' ? ' checked' : '') + '> <span>I confirm that I am 18 or older and understand that the tools may process sensitive personal reflections.</span></label>' +
        (researchAvailable()
          ? '<p class="tdh-choice-current"><strong>Terms of use:</strong> the tools are free. In return, each result adds a few anonymous, rounded counters (for example &ldquo;visual: 60&ndash;70&rdquo;) to a research tally, at most once per tool per month. No code, name, e-mail, IP address, device identifier, free text or per-person record is ever stored, so nothing can be traced back to you. Only redacted aggregate summaries may be published or shared with scientists or media; no count below 30, raw database data or monthly breakdown is released. <a href="/tdh/research.html" target="_blank" rel="noopener">How it works</a>.</p>' +
            '<label class="tdh-age-confirm"><input type="checkbox" id="tdh-research-check"' + (store.get(RESEARCH_KEY) === RESEARCH_VERSION ? ' checked' : '') + '> <span>I agree that these anonymous, untraceable counters may be stored without a time limit and used for scientific research, public reporting and redacted sharing with scientists or media. I understand they cannot be traced to me, so they cannot be located or withdrawn later.</span></label>'
          : '') +
        '<div class="tdh-choice-grid">' +
          '<div class="tdh-choice-opt"><button class="tdh-choice-button" data-mode="remote" type="button">Recommended: works on any device and browser</button>' +
            '<p class="tdh-choice-note">Your result is saved under your code, and you can delete it at any time. Choosing this is your consent to saving it. <span class="tdh-fine">Results are deleted after two years without use.</span></p></div>' +
          '<div class="tdh-choice-opt"><button class="tdh-choice-button" data-mode="local" type="button">Limited access: this device and browser only</button>' +
            '<p class="tdh-choice-note">Nothing is saved anywhere else, and your code only works in this browser on this device. <a href="/privacy.html#tdh-storage-difference" target="_blank" rel="noopener">Read here about the difference</a>.</p></div>' +
          '<div class="tdh-choice-opt tdh-choice-wide"><button class="tdh-choice-button" data-mode="none" type="button">Nothing saved: most privacy</button>' +
            '<p class="tdh-choice-note">Nothing is saved, not even on this device. There is no way to come back to this result after the window is closed. <a href="/privacy.html#tdh-storage-difference" target="_blank" rel="noopener">Read here about the difference</a>.</p>' +
            (localCodes().length ? '<label class="tdh-wipe"><input type="checkbox" id="tdh-wipe-check"> <span>Also remove the ' + localCodes().length + (localCodes().length === 1 ? ' result' : ' results') + ' already saved on this device.</span></label>' : '') + '</div>' +
        '</div>' +
        (current ? '<p class="tdh-choice-current">Current choice: ' + (current === 'remote' ? 'your code works on any device and browser' : current === 'none' ? 'nothing saved' : 'this device and browser only') + '. Choosing "this device and browser only" or "nothing saved" now withdraws consent for future saving of results. To erase previously stored profiles, <button type="button" class="tdh-choice-link" id="tdh-delete-request">prepare a deletion request with this device\'s retrieval codes</button> (opens your email app; nothing is sent until you send it).</p>' : '') +
      '</section>';

    document.body.appendChild(backdrop);
    document.documentElement.classList.add('tdh-privacy-lock');

    var check = backdrop.querySelector('#tdh-age-check');
    var rcheck = backdrop.querySelector('#tdh-research-check');
    var buttons = Array.prototype.slice.call(backdrop.querySelectorAll('.tdh-choice-button'));
    function sync() {
      var ok = check.checked && (!rcheck || rcheck.checked);
      buttons.forEach(function (button) { button.disabled = !ok; });
    }
    check.addEventListener('change', sync);
    if (rcheck) rcheck.addEventListener('change', sync);
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
        if (!check.checked || (rcheck && !rcheck.checked)) return;
        var wipe = backdrop.querySelector('#tdh-wipe-check');
        if (button.getAttribute('data-mode') === 'none' && wipe && wipe.checked) wipeLocalResults();
        setMode(button.getAttribute('data-mode'));
        codeWhereNote();
        store.set(RESEARCH_KEY, RESEARCH_VERSION);
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

  function codeWhereNote() {
    var box = document.getElementById('code-box') || document.getElementById('res-code');
    if (!box || !box.parentNode) return;
    var n = document.getElementById('tdh-code-where');
    if (!n) { n = document.createElement('p'); n.id = 'tdh-code-where'; n.className = 'code-hint'; box.parentNode.insertBefore(n, box.nextSibling); }
    n.textContent = mode() === 'none' ? 'Nothing is saved. This result is gone when you close this window and the code will not work later. Emailing yourself the result is the only way to keep it.' : mode() === 'remote' ? 'Your result is saved under this code, so the code works on any device and browser.' : 'Your result is kept on this device only, so this code works only in this browser on this device. It will not work in another browser or on another device.';
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

    codeWhereNote();
    store.get(MODE_KEY); /* probe: marks storage as blocked before the notice check below */
    if (isTool && storageBlocked) {
      var notice = document.createElement('p');
      notice.className = 'tdh-storage-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = 'This browser blocks local storage, so results and retrieval codes last only while this page stays open. Write down your code before leaving.';
      document.body.insertBefore(notice, document.body.firstChild);
    }

    if (requiresChoice && (!store.get(MODE_KEY) || store.get(AGE_KEY) !== 'yes' || (researchAvailable() && store.get(RESEARCH_KEY) !== RESEARCH_VERSION))) {
      showPanel(true);
    }
  }

  window.TDHPrivacy = { getMode: mode, storageBlocked: function () { return storageBlocked; }, codeLength: CODE_LENGTH, open: function () { showPanel(false); } };
  window.TDHResearch = { available: researchAvailable, optedIn: researchOptedIn, submit: researchSubmit, payload: researchPayload };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
