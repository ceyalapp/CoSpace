// Surface any uncaught script error on-screen instead of silently leaving the boot loader.
// Extracted from an inline <script> so the CSP can use script-src 'self' (no unsafe-inline).
window.addEventListener('error', function (ev) {
  var root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '<div style="padding:24px;font-family:system-ui;color:#a6586a;max-width:640px;margin:40px auto;line-height:1.5"><strong>JS error:</strong><br><pre style="white-space:pre-wrap;font-size:13px">' +
    String(ev.message) + '\n' + (ev.filename || '') + ':' + (ev.lineno || 0) + '</pre><div style="color:#666;font-size:12px;margin-top:12px">Open DevTools (F12) → Console for the full stack.</div></div>';
});
window.addEventListener('unhandledrejection', function (ev) {
  console.error('Unhandled promise rejection:', ev.reason);
});
