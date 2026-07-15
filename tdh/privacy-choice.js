(function () {
  'use strict';

  var WORKER = 'https://tdh-email.inbox-fde.workers.dev';
  var MODE_KEY = 'tdh_storage_mode';
  var AGE_KEY = 'tdh_adult_confirmed';
  var CONSENT_KEY = 'tdh_remote_consent_at';
  var CONSENT_VERSION = '2026-07-15';
  var originalFetch = window.fetch.bind(window);

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

    return originalFetch(input, options);
  };

  function setMode(nextMode) {
    localStorage.setItem(MODE_KEY, nextMode);
    localStorage.setItem(AGE_KEY, 'yes');
    if (nextMode === 'remote') {
      localStorage.setItem(CONSENT_KEY, new Date().toISOString());
    } else {
      localStorage.removeItem(CONSENT_KEY);
    }
  }

  function closePanel(backdrop) {
    backdrop.remove();
    document.documentElement.classList.remove('tdh-privacy-lock');
  }

  function showPanel(required) {
    var existing = document.querySelector('.tdh-privacy-backdrop');
    if (existing) return;

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
        '<p>The tools can generate intimate relationship and sexuality profiles. <strong>No result statistics are sent for analytics.</strong></p>' +
        '<p><strong>Local only</strong> keeps results in this browser. <strong>Cross-device</strong> stores each generated result with its random retrieval code through the remote profile service, so it can be opened and compared on another device.</p>' +
        '<p>Cross-device storage is optional and requires explicit consent. Email delivery is a separate action you choose after receiving a result. Read the <a href="/privacy.html#tdh-data" target="_blank" rel="noopener">data-protection details</a>.</p>' +
        '<label class="tdh-age-confirm"><input type="checkbox" id="tdh-age-check"' + (localStorage.getItem(AGE_KEY) === 'yes' ? ' checked' : '') + '> <span>I confirm that I am 18 or older and understand that the tools may process sensitive personal reflections.</span></label>' +
        '<div class="tdh-choice-grid">' +
          '<button class="tdh-choice-button" data-mode="local" type="button">Use locally</button>' +
          '<button class="tdh-choice-button" data-mode="remote" type="button">Enable cross-device</button>' +
        '</div>' +
        (current ? '<p class="tdh-choice-current">Current choice: ' + (current === 'remote' ? 'cross-device storage' : 'local-only storage') + '. Choosing local-only now withdraws consent for future remote storage. To erase previously stored profiles, email the retrieval codes to <a href="mailto:inbox@echoxstudios.art?subject=TDH%20profile%20deletion">inbox@echoxstudios.art</a>.</p>' : '') +
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

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (!check.checked) return;
        setMode(button.getAttribute('data-mode'));
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
    var isTool = /tool-[1-6]-/.test(location.pathname);
    var requiresChoice = isTool || /\/profile\.html$/.test(location.pathname);
    var settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'tdh-privacy-settings';
    settings.textContent = 'Data choices';
    settings.setAttribute('aria-label', 'Review result storage choices');
    settings.addEventListener('click', function () { showPanel(false); });
    document.body.appendChild(settings);

    if (requiresChoice && (!localStorage.getItem(MODE_KEY) || localStorage.getItem(AGE_KEY) !== 'yes')) {
      showPanel(true);
    }
  }

  window.TDHPrivacy = { getMode: mode, open: function () { showPanel(false); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
