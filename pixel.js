/* Meta Pixel for Escritura/Letra sales pages.
 * Purchase must be configured in Hotmart checkout — never fire Purchase here.
 * One fbq('track') call is delivered to every pixel initialized below.
 */
const META_PIXEL_ID = '1798414894710698';
const META_PIXEL_ID_CALIGRAFIA_R3 = '1139101915369396';

(function () {
  if (!META_PIXEL_ID) return;

  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', META_PIXEL_ID);
  if (META_PIXEL_ID_CALIGRAFIA_R3) fbq('init', META_PIXEL_ID_CALIGRAFIA_R3);
  fbq('track', 'PageView');

  document.addEventListener(
    'click',
    function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('[data-cta="checkout"]') : null;
      if (!a) return;
      try {
        fbq('track', 'InitiateCheckout');
      } catch (e) {}
    },
    true
  );
})();

/* Append visitor query params (utm_*, fbclid, src, sck) to Hotmart checkout links. */
(function () {
  var KEEP = /^(utm_[a-z0-9_]+|fbclid|src|sck)$/i;
  var params = new URLSearchParams(window.location.search);
  var keep = new URLSearchParams();
  params.forEach(function (v, k) {
    if (KEEP.test(k) && v) keep.set(k, v);
  });
  if ([...keep.keys()].length === 0) return;
  var qs = keep.toString();
  document.querySelectorAll('a[data-cta="checkout"]').forEach(function (a) {
    try {
      var u = new URL(a.href, window.location.href);
      keep.forEach(function (v, k) {
        if (!u.searchParams.has(k)) u.searchParams.set(k, v);
      });
      a.href = u.toString();
    } catch (e) {
      var base = a.getAttribute('href') || '';
      a.href = base + (base.indexOf('?') >= 0 ? '&' : '?') + qs;
    }
  });
})();
