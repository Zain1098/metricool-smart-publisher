(function () {
  try {
    var script = document.currentScript;
    var siteId = (script && script.getAttribute('data-site')) || window.location.hostname || 'default';
    var srcOrigin = script && script.src ? new URL(script.src).origin : window.location.origin;
    var endpoint = srcOrigin + '/api/pixel/collect';

    var sessionKey = '_mc_pixel_sid';
    var sid = '';
    try {
      sid = sessionStorage.getItem(sessionKey) || '';
      if (!sid) {
        sid = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(sessionKey, sid);
      }
    } catch (_) {
      sid = 's_' + Math.random().toString(36).slice(2);
    }

    function send(eventType) {
      var payload = JSON.stringify({
        siteId: siteId,
        sessionId: sid,
        event: eventType || 'pageview',
        url: window.location.href,
        path: window.location.pathname + window.location.search,
        title: document.title || '',
        referrer: document.referrer || '',
        screen: window.screen ? window.screen.width + 'x' + window.screen.height : '',
        ts: new Date().toISOString(),
      });

      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        mode: 'cors',
      }).catch(function () {});
    }

    send('pageview');

    // Track SPA route changes
    var pushState = history.pushState;
    history.pushState = function () {
      pushState.apply(history, arguments);
      setTimeout(function () { send('pageview'); }, 50);
    };
    window.addEventListener('popstate', function () {
      setTimeout(function () { send('pageview'); }, 50);
    });
  } catch (_) {}
})();
