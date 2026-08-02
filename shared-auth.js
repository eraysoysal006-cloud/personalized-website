// Shared across index.html / po-coach.html / gym.html / study.html.
// Owns the Supabase client (window.sb), a full-viewport sign-in overlay, and
// window.pcAuthGate() — an async function pages await as the first line of
// their boot sequence, resolving once a session exists.
//
// This app stays single-user forever (see Part A spec) — the overlay is
// sign-in only, no public sign-up. The one account is created directly in
// the Supabase dashboard.
(function () {
  const SUPABASE_URL = 'https://mxgrrjyoosiywksxzlje.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_K1-mePuh2s7ECxxUdUZtqQ_KY3brvIL';
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  // Exposed for pages' raw fetch() calls (e.g. flushSync on pagehide) that
  // can't go through the JS client — those need the anon key + a manually
  // attached access token, not the automatic JWT swap sb.from(...) gets.
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;

  window.pcUserId = null;
  window.pcAccessToken = null;

  let resolveGate = null;
  const gatePromise = new Promise((resolve) => { resolveGate = resolve; });
  window.pcAuthGate = function () { return gatePromise; };

  // ─── Overlay (built in JS, no page-specific HTML needed) ──────────────────
  const style = document.createElement('style');
  style.textContent = `
    .pc-auth-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: #08090B;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .pc-auth-overlay.pc-hidden { display: none; }
    .pc-auth-card {
      width: 100%; max-width: 340px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 16px;
      padding: 28px 24px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    }
    .pc-auth-title {
      font-size: 18px; font-weight: 700; color: #F5F5F4; margin-bottom: 18px;
    }
    .pc-auth-input {
      width: 100%; padding: 12px 14px; margin-bottom: 10px;
      border-radius: 10px; border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.28); color: #F5F5F4;
      font-family: inherit; font-size: 14px; outline: none;
      box-sizing: border-box;
    }
    .pc-auth-input:focus { border-color: rgba(255,255,255,0.30); }
    .pc-auth-btn {
      width: 100%; padding: 12px; margin-top: 4px;
      border-radius: 10px; border: none;
      background: linear-gradient(180deg, #7B9BF5 0%, #5C7FEA 100%);
      color: #08090B; font-family: inherit; font-size: 14px; font-weight: 700;
      cursor: pointer;
    }
    .pc-auth-btn:disabled { opacity: 0.5; cursor: default; }
    .pc-auth-error {
      color: #F87171; font-size: 12px; margin-top: 10px; min-height: 14px;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'pc-auth-overlay pc-hidden';
  overlay.innerHTML = `
    <div class="pc-auth-card">
      <div class="pc-auth-title">Giriş yap</div>
      <input class="pc-auth-input" id="pcAuthEmail" type="email" placeholder="Email" autocomplete="username">
      <input class="pc-auth-input" id="pcAuthPassword" type="password" placeholder="Şifre" autocomplete="current-password">
      <button class="pc-auth-btn" id="pcAuthSubmit" type="button">Giriş yap</button>
      <div class="pc-auth-error" id="pcAuthError"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  function showOverlay() { overlay.classList.remove('pc-hidden'); }
  function hideOverlay() { overlay.classList.add('pc-hidden'); }

  async function submit() {
    const email = document.getElementById('pcAuthEmail').value.trim();
    const password = document.getElementById('pcAuthPassword').value;
    const errorEl = document.getElementById('pcAuthError');
    const btn = document.getElementById('pcAuthSubmit');
    errorEl.textContent = '';
    if (!email || !password) { errorEl.textContent = 'Email ve şifre gerekli.'; return; }
    btn.disabled = true;
    try {
      const { error } = await window.sb.auth.signInWithPassword({ email, password });
      if (error) errorEl.textContent = error.message;
    } catch (e) {
      errorEl.textContent = 'Giriş başarısız, tekrar dene.';
    } finally {
      btn.disabled = false;
    }
  }
  document.getElementById('pcAuthSubmit').addEventListener('click', submit);
  document.getElementById('pcAuthPassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  // ─── Session wiring ─────────────────────────────────────────────────────
  let gateResolved = false;
  window.sb.auth.onAuthStateChange((event, session) => {
    if (session) {
      window.pcUserId = session.user.id;
      window.pcAccessToken = session.access_token;
      hideOverlay();
      if (!gateResolved) { gateResolved = true; resolveGate(); }
    } else {
      window.pcUserId = null;
      window.pcAccessToken = null;
      showOverlay();
    }
  });
})();
