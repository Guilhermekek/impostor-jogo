// ══════════════════════════════════════════════
//  auth.js — Firebase Authentication
// ══════════════════════════════════════════════

// Called once after Firebase is initialised
function initAuth() {
  // One-time listeners on modal buttons
  setupAuthListeners();
  // React to auth state (logged in / logged out)
  firebase.auth().onAuthStateChanged(updateAuthUI);
}

// ── Dynamic auth row in home ─────────────────
function updateAuthUI(user) {
  const row = document.querySelector('.home-auth-row');
  if (!row) return;

  if (user) {
    const name = user.displayName || user.email?.split('@')[0] || 'Detetive';
    // Pre-fill name input only when it is empty
    const nameInput = document.getElementById('inp-name');
    if (nameInput && !nameInput.value) nameInput.value = name;

    row.innerHTML = `
      <div class="home-user-chip">
        <div class="home-user-avatar">${escHtml(name.charAt(0).toUpperCase())}</div>
        <span class="home-user-name">${escHtml(name)}</span>
        <button class="btn btn-secondary home-auth-btn" id="btn-logout"
          style="width:auto;padding:7px 14px;flex-shrink:0">Sair</button>
      </div>`;
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await firebase.auth().signOut();
      toast('Você saiu da conta.');
    });
  } else {
    row.innerHTML = `
      <button class="btn btn-secondary home-auth-btn" id="btn-login">👤 Entrar</button>
      <button class="btn btn-secondary home-auth-btn" id="btn-register">＋ Criar conta</button>`;
    document.getElementById('btn-login').addEventListener('click', openLoginModal);
    document.getElementById('btn-register').addEventListener('click', openRegisterModal);
  }
}

// ── Setup one-time modal listeners ───────────
function setupAuthListeners() {
  // --- Login modal ---
  document.getElementById('btn-close-login').addEventListener('click', closeLoginModal);
  document.getElementById('btn-confirm-login').addEventListener('click', signInEmail);
  document.getElementById('btn-google-login').addEventListener('click', signInGoogle);

  document.getElementById('login-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('login-modal')) closeLoginModal();
  });
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') signInEmail();
  });
  document.getElementById('btn-switch-to-register').addEventListener('click', () => {
    closeLoginModal();
    openRegisterModal();
  });

  // --- Register modal ---
  document.getElementById('btn-close-register').addEventListener('click', closeRegisterModal);
  document.getElementById('btn-confirm-register').addEventListener('click', registerEmail);
  document.getElementById('btn-google-register').addEventListener('click', signInGoogle);

  document.getElementById('register-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('register-modal')) closeRegisterModal();
  });
  ['register-name','register-email','register-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const fields = ['register-name','register-email','register-password','register-password2'];
        const i = fields.indexOf(id);
        if (i < fields.length - 1) document.getElementById(fields[i + 1]).focus();
        else registerEmail();
      }
    });
  });
  document.getElementById('register-password').addEventListener('input', e => {
    updatePasswordStrength(e.target.value);
  });
  document.getElementById('register-password2').addEventListener('keydown', e => {
    if (e.key === 'Enter') registerEmail();
  });
  document.getElementById('btn-switch-to-login').addEventListener('click', () => {
    closeRegisterModal();
    openLoginModal();
  });
}

// ── Login ────────────────────────────────────
function openLoginModal() {
  clearAuthErrors();
  document.getElementById('login-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('login-email').focus(), 60);
}
function closeLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
  clearAuthErrors();
}

async function signInEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;
  const err   = document.getElementById('login-error');
  if (!email || !pw) { err.textContent = 'Preencha e-mail e senha.'; return; }

  const btn = document.getElementById('btn-confirm-login');
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    await firebase.auth().signInWithEmailAndPassword(email, pw);
    closeLoginModal();
    toast('Bem-vindo de volta! ✓');
  } catch (e) {
    err.textContent = authErrorMsg(e.code);
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function signInGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await firebase.auth().signInWithPopup(provider);
    closeLoginModal();
    closeRegisterModal();
    toast('Login com Google realizado! ✓');
  } catch (e) {
    const errId = document.getElementById('login-modal').style.display !== 'none'
      ? 'login-error' : 'register-error';
    document.getElementById(errId).textContent = authErrorMsg(e.code);
  }
}

// ── Register ─────────────────────────────────
function openRegisterModal() {
  clearAuthErrors();
  document.getElementById('register-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('register-name').focus(), 60);
}
function closeRegisterModal() {
  document.getElementById('register-modal').style.display = 'none';
  clearAuthErrors();
}

async function registerEmail() {
  const name = document.getElementById('register-name').value.trim();
  const email= document.getElementById('register-email').value.trim();
  const pw   = document.getElementById('register-password').value;
  const pw2  = document.getElementById('register-password2').value;
  const err  = document.getElementById('register-error');

  if (!name || !email || !pw) { err.textContent = 'Preencha todos os campos.'; return; }
  if (pw !== pw2)             { err.textContent = 'As senhas não coincidem.'; return; }
  if (pw.length < 6)          { err.textContent = 'Senha mínima: 6 caracteres.'; return; }

  const btn = document.getElementById('btn-confirm-register');
  btn.disabled = true; btn.textContent = 'Criando conta…';
  try {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, pw);
    await cred.user.updateProfile({ displayName: name });
    // updateProfile não dispara onAuthStateChanged — forçamos o refresh
    updateAuthUI(firebase.auth().currentUser);
    closeRegisterModal();
    toast('Conta criada com sucesso! ✓');
  } catch (e) {
    err.textContent = authErrorMsg(e.code);
  } finally {
    btn.disabled = false; btn.textContent = 'Criar conta';
  }
}

// ── Helpers ──────────────────────────────────
function clearAuthErrors() {
  ['login-error','register-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

function authErrorMsg(code) {
  const map = {
    'auth/user-not-found':          'Conta não encontrada.',
    'auth/wrong-password':          'Senha incorreta.',
    'auth/invalid-credential':      'E-mail ou senha incorretos.',
    'auth/email-already-in-use':    'Este e-mail já está em uso.',
    'auth/invalid-email':           'E-mail inválido.',
    'auth/weak-password':           'Senha muito fraca (mínimo 6 caracteres).',
    'auth/popup-closed-by-user':    'Login com Google cancelado.',
    'auth/cancelled-popup-request': 'Login com Google cancelado.',
    'auth/network-request-failed':  'Erro de conexão. Tente novamente.',
    'auth/too-many-requests':       'Muitas tentativas. Aguarde um momento.',
  };
  return map[code] || 'Erro inesperado: ' + code;
}

// ── Password strength indicator ──────────────
function updatePasswordStrength(pw) {
  const bars  = [1,2,3,4].map(i => document.getElementById('pw-bar-' + i));
  const label = document.getElementById('pw-strength-label');
  if (!bars[0] || !label) return;

  let score = 0;
  if (pw.length >= 6)  score++;                                // comprimento mínimo
  if (pw.length >= 10) score++;                                // comprimento bom
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;          // misto de caixa
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;  // número ou símbolo

  const COLORS = ['var(--danger)', 'var(--warning)', 'var(--primary)', 'var(--success)'];
  const LABELS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  const color  = score > 0 ? COLORS[score - 1] : 'var(--border)';

  bars.forEach((b, i) => {
    b.style.background = i < score ? color : 'var(--border)';
  });
  label.textContent  = pw.length ? (LABELS[score] || '') : '';
  label.style.color  = score > 0 ? color : 'var(--muted)';
}
