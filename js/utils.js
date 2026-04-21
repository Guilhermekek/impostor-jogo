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
