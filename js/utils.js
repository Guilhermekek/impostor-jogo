// ══════════════════════════════════════════════
//  utils.js — Funções utilitárias gerais
// ══════════════════════════════════════════════

function getPlayerId() {
  let id = localStorage.getItem('impostorUID');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('impostorUID', id);
  }
  return id;
}

function initial(name) { return (name || '?')[0].toUpperCase(); }

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function screen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getWordPair(data) {
  const cat = data.wordCategory || 'Tudo';
  return CATEGORIES[cat][data.wordPairIndex];
}

function sysMsg(text) {
  const key = roomRef.child('messages').push().key;
  roomRef.child(`messages/${key}`).set({ type: 'system', text, ts: Date.now() });
}

function alivePlayers(players) {
  return Object.entries(players || {}).filter(([, p]) => p.isAlive && p.isConnected !== false);
}

function connectedPlayers(players) {
  return Object.entries(players || {}).filter(([, p]) => p.isConnected !== false);
}

// Verifica se playerId é impostor (suporta múltiplos impostores)
function isImpostor(data, playerId) {
  return (data.impostorIds || []).includes(playerId);
}

// Seleciona `count` impostores com peso: quem foi impostor na última partida
// tem 1/3 da chance dos demais (peso 1 vs peso 3)
function selectImpostors(players, count, lastImpostorIds) {
  const eligible = connectedPlayers(players);
  const pool = [];
  eligible.forEach(([id]) => {
    const w = (lastImpostorIds || []).includes(id) ? 1 : 3;
    for (let i = 0; i < w; i++) pool.push(id);
  });

  const selected = [];
  const remaining = [...pool];
  for (let i = 0; i < Math.min(count, eligible.length); i++) {
    if (!remaining.length) break;
    const idx    = Math.floor(Math.random() * remaining.length);
    const chosen = remaining[idx];
    selected.push(chosen);
    for (let j = remaining.length - 1; j >= 0; j--) {
      if (remaining[j] === chosen) remaining.splice(j, 1);
    }
  }
  return selected;
}
