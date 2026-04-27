// ══════════════════════════════════════════════
//  profile.js — Tela de perfil do detetive
//
//  Responsabilidades:
//  - Renderizar identidade (avatar, nome, agente nº, data ativo)
//  - Picker de avatar com 12 opções noir
//  - Tabs: Histórico de casos / Identidade (avatar picker)
//  - Persistir escolha de avatar (localStorage)
//  - Mostrar histórico de partidas (mock por enquanto, TODO: Firebase)
// ══════════════════════════════════════════════

// ── Catálogo de avatares ───────────────────────
const NOIR_AVATARS = [
  { id: 'fedora',    glyph: '🎩', label: 'Chapéu' },
  { id: 'magnifier', glyph: '🔍', label: 'Lupa' },
  { id: 'badge',     glyph: '★',  label: 'Distintivo' },
  { id: 'cigar',     glyph: '🚬', label: 'Charuto' },
  { id: 'mask',      glyph: '◑',  label: 'Máscara' },
  { id: 'key',       glyph: '⚿',  label: 'Chave' },
  { id: 'eye',       glyph: '◉',  label: 'Olho' },
  { id: 'spade',     glyph: '♠',  label: 'Espadas' },
  { id: 'cross',     glyph: '✚',  label: 'Cruz' },
  { id: 'diamond',   glyph: '◆',  label: 'Diamante' },
  { id: 'crown',     glyph: '♛',  label: 'Coroa' },
  { id: 'skull',     glyph: '☠',  label: 'Caveira' },
];

const DEFAULT_AVATAR_ID = 'fedora';
const STORAGE_KEY_AVATAR = 'impostorAvatar';

// Estado local da tela
let _selectedAvatar = DEFAULT_AVATAR_ID;
let _committedAvatar = DEFAULT_AVATAR_ID;

// ── Helpers ─────────────────────────────────────
function getAvatarById(id) {
  return NOIR_AVATARS.find(a => a.id === id) || NOIR_AVATARS[0];
}

function loadSavedAvatar() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AVATAR);
    if (saved && NOIR_AVATARS.some(a => a.id === saved)) return saved;
  } catch (_) {}
  return DEFAULT_AVATAR_ID;
}

function saveAvatar(id) {
  try { localStorage.setItem(STORAGE_KEY_AVATAR, id); } catch (_) {}
  // TODO(seguranca): quando habilitarmos /users/{uid} nas regras do RTDB,
  // sincronizar aqui também via firebase.database().ref(`users/${uid}/avatar`).set(id)
}

// Exporta para outros módulos saberem qual o avatar atual
function getCurrentAvatarGlyph() {
  return getAvatarById(loadSavedAvatar()).glyph;
}

// ── Abertura/fechamento da tela ────────────────
function openProfile() {
  // Garante que o estado está sincronizado com o que está salvo
  _committedAvatar = loadSavedAvatar();
  _selectedAvatar  = _committedAvatar;

  renderProfile();

  // Trocar de tela
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-profile').classList.add('active');
  // Resetar para a aba histórico ao abrir
  switchProfileTab('history');
}

function closeProfile() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
}

// ── Renderização ───────────────────────────────
function renderProfile() {
  renderIdentity();
  renderStats();
  renderHistory();
  renderAvatarGrid();
}

function renderIdentity() {
  const user = firebase.auth().currentUser;
  const name = user?.displayName || user?.email?.split('@')[0] || 'Detetive Convidado';

  // Número de agente: derivado do uid (ou aleatório fixo pra guests)
  const agentNum = user?.uid
    ? String(parseInt(user.uid.slice(-6), 16) % 1000).padStart(3, '0')
    : '047';

  // Data de criação da conta
  let activeSince = '—';
  if (user?.metadata?.creationTime) {
    const d = new Date(user.metadata.creationTime);
    const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    activeSince = `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  document.getElementById('profile-avatar-big').textContent = getAvatarById(_committedAvatar).glyph;
  document.getElementById('profile-agent-num').textContent  = `AGENTE Nº ${agentNum}`;
  document.getElementById('profile-name').textContent       = name;
  document.getElementById('profile-active-since').textContent = activeSince === '—'
    ? 'MODO CONVIDADO · SEM CONTA'
    : `ATIVO DESDE · ${activeSince}`;
}

function renderStats() {
  // TODO(firebase): ler de users/{uid}/history e calcular
  // Por enquanto: zerados (sem mock pra evitar mentir pro usuário)
  const stats = loadStatsFromHistory();

  document.getElementById('stat-total').textContent    = stats.total;
  document.getElementById('stat-winrate').textContent  = stats.total
    ? `${Math.round((stats.wins / stats.total) * 100)}%`
    : '0%';
  document.getElementById('stat-impostor').textContent = `${stats.asImpostorWin}/${stats.asImpostor}`;
  document.getElementById('history-streak').textContent = stats.bestStreak;
}

function renderHistory() {
  // TODO(firebase): ler de users/{uid}/history
  const history = loadHistory();
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const count = document.getElementById('history-count');

  count.textContent = `CASOS ENCERRADOS · ${history.length}`;

  if (history.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = history.map((c, i) => {
    const idx = String(history.length - i).padStart(3, '0');
    const isWin = c.outcome === 'win';
    const isImp = c.role === 'impostor';
    return `
      <div class="case-row ${isWin ? 'win' : 'loss'}">
        <div class="case-idx">#${escHtml(idx)}</div>
        <div class="case-info">
          <div class="case-info-top">
            <span class="case-role ${isImp ? 'imp' : 'det'}">${isImp ? 'Impostor' : 'Detetive'}</span>
            <span class="case-word">${escHtml(c.word || '—')}</span>
          </div>
          <div class="case-info-bottom">
            ${escHtml(c.category || '—')} · ${c.players || 0} suspeitos · ${escHtml(c.date || '—')}
          </div>
        </div>
        <div class="case-outcome ${isWin ? 'win' : 'loss'}">
          ${isWin ? '✓ Vitória' : '✕ Derrota'}
        </div>
      </div>
    `;
  }).join('');
}

function renderAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  grid.innerHTML = NOIR_AVATARS.map(a => `
    <div class="avatar-tile-wrap">
      <button class="avatar-tile ${_selectedAvatar === a.id ? 'selected' : ''}"
              data-id="${a.id}" aria-label="${escHtml(a.label)}">
        ${a.glyph}
        ${_selectedAvatar === a.id ? '<span class="avatar-tile-dot"></span>' : ''}
      </button>
      <div class="avatar-tile-label ${_selectedAvatar === a.id ? 'on' : ''}">${escHtml(a.label)}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.avatar-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedAvatar = btn.dataset.id;
      renderAvatarGrid();
      // Botão de confirmar fica destacado se mudou
      const confirmBtn = document.getElementById('btn-confirm-avatar');
      if (_selectedAvatar !== _committedAvatar) {
        confirmBtn.classList.add('pulse-ready');
      } else {
        confirmBtn.classList.remove('pulse-ready');
      }
    });
  });
}

// ── Persistência (mock — TODO Firebase) ────────
function loadHistory() {
  // Por enquanto retorna array vazio.
  // Quando plugarmos: db.ref(`users/${uid}/history`).once('value')
  return [];
}

function loadStatsFromHistory() {
  const hist = loadHistory();
  let wins = 0, asImpostor = 0, asImpostorWin = 0;
  let curStreak = 0, bestStreak = 0;

  for (const c of hist) {
    if (c.outcome === 'win') {
      wins++;
      curStreak++;
      bestStreak = Math.max(bestStreak, curStreak);
    } else {
      curStreak = 0;
    }
    if (c.role === 'impostor') {
      asImpostor++;
      if (c.outcome === 'win') asImpostorWin++;
    }
  }

  return { total: hist.length, wins, asImpostor, asImpostorWin, bestStreak };
}

// ── Tab switching ──────────────────────────────
function switchProfileTab(tabId) {
  document.querySelectorAll('.profile-tab').forEach(t => {
    t.classList.toggle('on', t.dataset.tab === tabId);
  });
  document.getElementById('tab-content-history').style.display = tabId === 'history' ? 'block' : 'none';
  document.getElementById('tab-content-avatar').style.display  = tabId === 'avatar'  ? 'block' : 'none';
}

// ── Confirmar avatar ───────────────────────────
function confirmAvatar() {
  if (_selectedAvatar === _committedAvatar) {
    toast('Você já está usando esse disfarce.');
    return;
  }
  saveAvatar(_selectedAvatar);
  _committedAvatar = _selectedAvatar;
  renderIdentity(); // atualiza o avatar grande no card
  document.getElementById('btn-confirm-avatar').classList.remove('pulse-ready');

  // Re-renderiza o chip do usuário no home pra refletir o novo avatar
  if (typeof updateAuthUI === 'function') {
    updateAuthUI(firebase.auth().currentUser);
  }

  toast(`Disfarce trocado: ${getAvatarById(_selectedAvatar).label} ✓`);
}

// ── Listeners (uma vez no carregamento) ────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-profile-back').addEventListener('click', closeProfile);
  document.getElementById('tab-history').addEventListener('click', () => switchProfileTab('history'));
  document.getElementById('tab-avatar').addEventListener('click', () => switchProfileTab('avatar'));
  document.getElementById('btn-confirm-avatar').addEventListener('click', confirmAvatar);
});
