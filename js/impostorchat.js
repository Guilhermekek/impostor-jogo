// ══════════════════════════════════════════════
//  impostorchat.js — Chat secreto dos impostores
// ══════════════════════════════════════════════

let _impChatOpen      = false;
let _impUnread        = 0;
let _lastImpMsgCount  = 0;

function openImpostorChat() {
  _impChatOpen = true;
  _impUnread   = 0;
  updateImpostorBadge();
  const panel = document.getElementById('imp-chat-modal');
  panel.style.display = 'flex';
  // Reinicia animação ao reabrir
  panel.style.animation = 'none';
  panel.offsetHeight; // força reflow
  panel.style.animation = '';
  renderImpostorMessages(S.roomData?.impostorMessages);
  setTimeout(() => document.getElementById('t-imp-msg')?.focus(), 50);
}

function closeImpostorChat() {
  _impChatOpen = false;
  document.getElementById('imp-chat-modal').style.display = 'none';
}

function updateImpostorBadge() {
  const badge = document.getElementById('imp-chat-badge');
  if (!badge) return;
  if (_impUnread > 0) {
    badge.textContent    = _impUnread > 9 ? '9+' : _impUnread;
    badge.style.display  = 'inline-flex';
  } else {
    badge.style.display  = 'none';
  }
}

function renderImpostorMessages(messages) {
  const el = document.getElementById('imp-messages');
  if (!el) return;
  const entries = Object.values(messages || {}).sort((a, b) => a.ts - b.ts);
  el.innerHTML = '';

  if (!entries.length) {
    el.innerHTML = '<div class="imp-empty">Nenhuma mensagem ainda…<br>Coordenem-se aqui!</div>';
    return;
  }

  entries.forEach(msg => {
    const isMine = msg.playerId === S.playerId;
    const div    = document.createElement('div');
    div.className = 'imp-msg' + (isMine ? ' imp-msg-mine' : '');
    div.innerHTML = `
      <span class="imp-msg-name">${isMine ? 'Você' : escHtml(msg.playerName)}</span>
      <span class="imp-msg-text">${escHtml(msg.text)}</span>`;
    el.appendChild(div);
  });

  el.scrollTop = el.scrollHeight;
}

function updateImpostorChatVisibility(data) {
  const myIsImp  = isImpostor(data, S.playerId);
  const multiImp = (data.config?.impostorCount || 1) > 1;
  const btn      = document.getElementById('btn-imp-chat');
  if (!btn) return;

  btn.style.display = (myIsImp && multiImp) ? 'flex' : 'none';

  // Contagem de mensagens não lidas
  const msgs  = data.impostorMessages || {};
  const count = Object.keys(msgs).length;
  if (!_impChatOpen && count > _lastImpMsgCount) {
    _impUnread += count - _lastImpMsgCount;
    updateImpostorBadge();
  }
  _lastImpMsgCount = count;

  // Atualiza mensagens se o chat estiver aberto
  if (_impChatOpen) renderImpostorMessages(msgs);
}

async function sendImpostorMsg() {
  const input = document.getElementById('t-imp-msg');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const key = roomRef.child('impostorMessages').push().key;
  await roomRef.child(`impostorMessages/${key}`).set({
    playerId:   S.playerId,
    playerName: S.playerName,
    text,
    ts: Date.now(),
  });
}
