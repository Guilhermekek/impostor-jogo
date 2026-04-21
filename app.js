// ══════════════════════════════════════════════
//  O Impostor — app.js
// ══════════════════════════════════════════════

// ── STATE ──────────────────────────────────────
const S = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  role: null,       // 'player' | 'impostor'
  myWord: null,
  roomData: null,
  prevGameState: null,
};

let db, roomRef;
let currentTab = 'statement';
let prevActor   = null;

// ── FIREBASE INIT ──────────────────────────────
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch (e) {
    if (e.code !== 'app/duplicate-app') throw e;
    db = firebase.database();
  }
}

// ── LOCAL STORAGE ──────────────────────────────
function getPlayerId() {
  let id = localStorage.getItem('impostorUID');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('impostorUID', id);
  }
  return id;
}

// ── UTILS ──────────────────────────────────────
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

// ── SOUND & POPUP ──────────────────────────────
function playTurnSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch(e) {}
}

function showTurnPopup(icon, label) {
  const popup = document.getElementById('turn-popup');
  document.getElementById('turn-popup-icon').textContent = icon;
  document.getElementById('turn-popup-text').textContent = label;
  popup.style.display = 'flex';
  clearTimeout(popup._t);
  // Re-trigger animation
  const inner = popup.querySelector('.turn-popup-inner');
  inner.style.animation = 'none';
  inner.offsetHeight; // reflow
  inner.style.animation = '';
  popup._t = setTimeout(() => { popup.style.display = 'none'; }, 1800);
}

// Who needs to act right now (turn holder or pending answerer)
function whoNeedsToAct(data) {
  return data.pendingAnswer ? data.pendingAnswer.targetId : data.turnPlayerId;
}

// Returns updated roundActed and whether all alive players have acted
function actorUpdate(actorId, roomData) {
  const newActed = { ...(roomData.roundActed || {}), [actorId]: true };
  const alive    = alivePlayers(roomData.players || {});
  const allActed = alive.length > 0 && alive.every(([id]) => newActed[id]);
  return { newActed, allActed };
}

function getWordPair(data) {
  const cat = data.wordCategory || 'Tudo';
  return CATEGORIES[cat][data.wordPairIndex];
}

function sysMsg(text) {
  const id = 'sys_' + Date.now();
  roomRef.child(`messages/${id}`).set({ type: 'system', text, ts: Date.now() });
}

// ── ALIVE PLAYERS (array of [id, playerObj]) ──
function alivePlayers(players) {
  return Object.entries(players || {}).filter(([, p]) => p.isAlive && p.isConnected !== false);
}

function connectedPlayers(players) {
  return Object.entries(players || {}).filter(([, p]) => p.isConnected !== false);
}

// ══════════════════════════════════════════════
//  CREATE / JOIN
// ══════════════════════════════════════════════
async function createRoom() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { toast('Digite seu nome!'); return; }

  S.playerId = getPlayerId();
  S.playerName = name;
  S.isHost = true;

  // find unused code
  let code;
  for (let tries = 0; tries < 10; tries++) {
    code = randomCode();
    const snap = await db.ref(`rooms/${code}`).once('value');
    if (!snap.exists()) break;
  }
  S.roomCode = code;
  roomRef = db.ref(`rooms/${code}`);

  await roomRef.set({
    config: { host: S.playerId, similarWordMode: false, createdAt: Date.now() },
    state: 'lobby',
    round: 0,
    players: {
      [S.playerId]: { name, isAlive: true, isConnected: true, joinedAt: Date.now() }
    }
  });

  roomRef.child(`players/${S.playerId}/isConnected`).onDisconnect().set(false);
  enterLobby();
  listenRoom();
}

async function joinRoom() {
  const name = document.getElementById('inp-name').value.trim();
  const code = document.getElementById('inp-code').value.trim().toUpperCase();
  if (!name) { toast('Digite seu nome!'); return; }
  if (code.length !== 4) { toast('Código deve ter 4 caracteres!'); return; }

  const snap = await db.ref(`rooms/${code}`).once('value');
  if (!snap.exists()) { toast('Sala não encontrada!'); return; }

  const data = snap.val();
  if (data.state !== 'lobby') { toast('Jogo já iniciado nessa sala!'); return; }

  S.playerId = getPlayerId();
  S.playerName = name;
  S.roomCode = code;
  S.isHost = false;
  roomRef = db.ref(`rooms/${code}`);

  await roomRef.child(`players/${S.playerId}`).set({
    name, isAlive: true, isConnected: true, joinedAt: Date.now()
  });
  roomRef.child(`players/${S.playerId}/isConnected`).onDisconnect().set(false);

  enterLobby();
  listenRoom();
}

// ══════════════════════════════════════════════
//  LOBBY
// ══════════════════════════════════════════════
function enterLobby() {
  document.getElementById('show-code').textContent = S.roomCode;

  // Populate category select
  const sel = document.getElementById('sel-category');
  sel.innerHTML = '';
  CATEGORY_LIST.forEach(cat => {
    const o = document.createElement('option');
    o.value = cat;
    o.textContent = `${CATEGORY_ICONS[cat]} ${cat}`;
    sel.appendChild(o);
  });

  if (S.isHost) {
    document.getElementById('host-settings').style.display = 'block';
    document.getElementById('host-start-area').style.display = 'block';
    document.getElementById('lobby-waiting').style.display = 'none';
  } else {
    document.getElementById('host-settings').style.display = 'none';
    document.getElementById('host-start-area').style.display = 'none';
    document.getElementById('lobby-waiting').style.display = 'block';
  }
  screen('lobby');
}

function renderLobby(players) {
  const el = document.getElementById('lobby-players');
  const hostId = S.roomData?.config?.host;
  el.innerHTML = '';
  connectedPlayers(players).forEach(([id, p]) => {
    const d = document.createElement('div');
    d.className = 'player-item';
    d.innerHTML = `
      <div class="player-avatar">${initial(p.name)}</div>
      <span class="player-name">${escHtml(p.name)}${id === S.playerId ? ' <span style="color:var(--muted);font-size:.8rem">(você)</span>' : ''}</span>
      ${id === hostId ? '<span class="player-badge">Host</span>' : ''}
    `;
    el.appendChild(d);
  });
}

// ══════════════════════════════════════════════
//  START GAME
// ══════════════════════════════════════════════
async function startGame() {
  const players = S.roomData?.players || {};
  const active = connectedPlayers(players);
  if (active.length < 2) { toast('Precisa de pelo menos 2 jogadores!'); return; }

  const similarWordMode = document.getElementById('chk-similar').checked;
  const wordCategory    = document.getElementById('sel-category').value || 'Tudo';
  const categoryPairs   = CATEGORIES[wordCategory];
  const pairIndex       = Math.floor(Math.random() * categoryPairs.length);
  const impostorIndex   = Math.floor(Math.random() * active.length);
  const [impostorId]    = active[impostorIndex];

  // reset alive for everyone (in case of rematch)
  const playerUpdates = {};
  active.forEach(([id]) => { playerUpdates[`players/${id}/isAlive`] = true; });

  const firstTurnId = connectedPlayers(players)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0][0];

  await roomRef.update({
    ...playerUpdates,
    'config/similarWordMode': similarWordMode,
    'config/wordCategory': wordCategory,
    state: 'roleReveal',
    round: 1,
    wordCategory,
    wordPairIndex: pairIndex,
    impostorId,
    turnPlayerId: firstTurnId,
    pendingAnswer: null,
    votingEnabled: false,
    roundActed: null,
    readyPlayers: null,
    messages: null,
    votes: null,
    eliminatedThisRound: null,
    tiedVote: null,
    winner: null,
  });
}

// ══════════════════════════════════════════════
//  ROLE REVEAL
// ══════════════════════════════════════════════
function showRoleReveal(data) {
  const pair = getWordPair(data);
  const isImpostor = data.impostorId === S.playerId;
  const similarMode = data.config?.similarWordMode;

  S.role = isImpostor ? 'impostor' : 'player';
  S.myWord = isImpostor ? (similarMode ? pair.similar : null) : pair.word;

  const icon  = document.getElementById('role-icon');
  const title = document.getElementById('role-title');
  const desc  = document.getElementById('role-desc');
  const wdisp = document.getElementById('word-display');

  if (isImpostor) {
    icon.textContent  = '🕵️';
    title.textContent = 'Você é o IMPOSTOR!';
    desc.textContent  = similarMode
      ? 'Você recebeu uma palavra similar. Se misture!'
      : 'Você não tem a palavra real. Se misture!';
    wdisp.textContent = similarMode ? pair.similar : '???';
    wdisp.style.borderColor = similarMode ? 'var(--warning)' : 'var(--danger)';
    wdisp.style.color       = similarMode ? 'var(--warning)' : 'var(--danger)';
  } else {
    icon.textContent  = '👥';
    title.textContent = 'Você é um Jogador!';
    desc.textContent  = 'Dê dicas sem entregar a palavra. Descubra o impostor!';
    wdisp.textContent = pair.word;
    wdisp.style.borderColor = 'var(--primary)';
    wdisp.style.color       = 'var(--primary-light)';
  }

  document.getElementById('btn-ready').disabled = false;
  document.getElementById('role-waiting').style.display = 'none';
  screen('role');
}

async function markReady() {
  document.getElementById('btn-ready').disabled = true;
  document.getElementById('role-waiting').style.display = 'block';
  await roomRef.child(`readyPlayers/${S.playerId}`).set(true);
}

function checkAllReady(data) {
  if (!S.isHost) return;
  const connected = connectedPlayers(data.players || {});
  const ready = data.readyPlayers || {};
  if (connected.length > 0 && connected.every(([id]) => ready[id])) {
    roomRef.update({ state: 'playing' });
  }
}

// ══════════════════════════════════════════════
//  TURN LOGIC
// ══════════════════════════════════════════════
function getNextTurnPlayerId(data) {
  const ordered = Object.entries(data.players || {})
    .filter(([, p]) => p.isAlive && p.isConnected !== false)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
  if (!ordered.length) return null;
  const idx = ordered.findIndex(([id]) => id === data.turnPlayerId);
  return ordered[(idx + 1) % ordered.length][0];
}

async function advanceTurn(data) {
  const nextId = getNextTurnPlayerId(data || S.roomData);
  await roomRef.update({ turnPlayerId: nextId, pendingAnswer: null });
}

function renderTurnState(data) {
  const players    = data.players || {};
  const turnId     = data.turnPlayerId;
  const pending    = data.pendingAnswer;
  const isMyTurn   = turnId === S.playerId && !pending;
  const isMyAnswer = pending?.targetId === S.playerId;

  // ── Sound & popup when it becomes my turn ──
  const currentActor = whoNeedsToAct(data);
  if (currentActor === S.playerId && prevActor !== S.playerId) {
    playTurnSound();
    if (isMyAnswer) {
      showTurnPopup('❓', 'RESPONDA!');
    } else {
      showTurnPopup('✨', 'SUA VEZ!');
    }
  }
  prevActor = currentActor;

  // ── Turn bar ──
  const bar = document.getElementById('turn-bar');
  if (isMyTurn) {
    bar.innerHTML = '<span style="color:var(--success)">✨ Sua vez!</span>';
  } else if (pending) {
    const tName = players[pending.targetId]?.name || '???';
    bar.innerHTML = `<span style="color:var(--warning)">⏳ Aguardando ${escHtml(tName)} responder…</span>`;
  } else {
    const tName = players[turnId]?.name || '???';
    bar.innerHTML = `<span style="color:var(--muted)">⏳ Vez de ${escHtml(tName)}…</span>`;
  }

  // ── Vote button: enabled only after full round ──
  const voteBtn = document.getElementById('btn-call-vote');
  voteBtn.disabled = !data.votingEnabled;
  voteBtn.title    = data.votingEnabled ? '' : 'Aguarde todos falarem para votar';

  // ── Action panels ──
  document.getElementById('my-turn-area').style.display = isMyTurn   ? 'block' : 'none';
  document.getElementById('f-answer').style.display     = isMyAnswer ? 'flex'  : 'none';
  document.getElementById('waiting-turn').style.display = (!isMyTurn && !isMyAnswer) ? 'block' : 'none';

  if (isMyAnswer && pending) {
    document.getElementById('answer-prompt').textContent =
      `${escHtml(pending.askerName)} perguntou: "${escHtml(pending.questionText)}"`;
  }

  if (!isMyTurn && !isMyAnswer) {
    const who = pending
      ? `${escHtml(players[pending.targetId]?.name || '???')} está respondendo…`
      : `Vez de ${escHtml(players[turnId]?.name || '???')}. Aguarde…`;
    document.getElementById('waiting-turn').textContent = who;
  }
}

// ══════════════════════════════════════════════
//  GAME SCREEN
// ══════════════════════════════════════════════
function showGame(data) {
  const pair = getWordPair(data);
  const isImpostor = data.impostorId === S.playerId;
  const similarMode = data.config?.similarWordMode;

  // word badge
  const badge = document.getElementById('g-word-badge');
  if (isImpostor && !similarMode) {
    badge.textContent = '??? (Impostor)';
  } else {
    badge.textContent = 'Palavra: ' + (isImpostor ? pair.similar : pair.word);
  }

  document.getElementById('g-round').textContent = data.round || 1;
  document.getElementById('btn-guess').style.display =
    (data.impostorId === S.playerId) ? 'block' : 'none';

  renderStrip(data.players);
  updateTargets(data.players);
  renderMessages(data.messages);
  renderTurnState(data);
  screen('game');
}

function updateGame(data) {
  document.getElementById('g-round').textContent = data.round || 1;
  renderStrip(data.players);
  updateTargets(data.players);
  renderMessages(data.messages);
  renderTurnState(data);
}

function renderStrip(players) {
  const el = document.getElementById('g-players');
  el.innerHTML = '';
  Object.entries(players || {}).forEach(([id, p]) => {
    if (p.isConnected === false) return;
    const chip = document.createElement('div');
    chip.className = 'p-chip' + (p.isAlive ? '' : ' dead');
    chip.innerHTML = `<div class="av">${initial(p.name)}</div><span>${escHtml(p.name)}${id === S.playerId ? ' (você)' : ''}</span>`;
    el.appendChild(chip);
  });
}

function updateTargets(players) {
  const sel = document.getElementById('sel-target');
  const prev = sel.value;
  sel.innerHTML = '';
  alivePlayers(players).forEach(([id, p]) => {
    if (id === S.playerId) return;
    const o = document.createElement('option');
    o.value = id; o.textContent = p.name;
    sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}

function renderMessages(messages) {
  const area = document.getElementById('g-messages');
  const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 60;

  const sorted = Object.values(messages || {}).sort((a, b) => a.ts - b.ts);
  area.innerHTML = '';
  sorted.forEach(m => {
    const d = document.createElement('div');
    if (m.type === 'system') {
      d.className = 'msg msg-sys';
      d.textContent = m.text;
    } else {
      const isQ = m.type === 'question';
      const isA = m.type === 'answer';
      d.className = 'msg';
      const badgeClass = isQ ? ' q' : isA ? ' a' : '';
      const badgeText  = isQ ? '❓ Pergunta' : isA ? '💬 Resposta' : '💬 Declaração';
      d.innerHTML = `
        <div class="msg-header">
          <span class="msg-author">${escHtml(m.playerName)}</span>
          <span class="msg-badge${badgeClass}">${badgeText}</span>
          ${isQ ? `<span class="msg-target">→ ${escHtml(m.targetName || '')}</span>` : ''}
        </div>
        <div class="msg-text">${escHtml(m.text)}</div>`;
    }
    area.appendChild(d);
  });

  if (wasAtBottom) area.scrollTop = area.scrollHeight;
}

async function sendMsg(type) {
  const myPlayer = S.roomData?.players?.[S.playerId];
  if (!myPlayer?.isAlive) { toast('Você foi eliminado!'); return; }
  if (S.roomData?.turnPlayerId !== S.playerId) { toast('Não é sua vez!'); return; }
  if (S.roomData?.pendingAnswer) { toast('Aguardando resposta antes de continuar!'); return; }

  let text, targetId, targetName;
  if (type === 'statement') {
    text = document.getElementById('t-statement').value.trim();
    if (!text) { toast('Escreva algo!'); return; }
    document.getElementById('t-statement').value = '';
  } else {
    text       = document.getElementById('t-question').value.trim();
    targetId   = document.getElementById('sel-target').value;
    targetName = S.roomData?.players?.[targetId]?.name;
    if (!text)     { toast('Escreva uma pergunta!'); return; }
    if (!targetId) { toast('Escolha um jogador!'); return; }
    document.getElementById('t-question').value = '';
  }

  const msgId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  // Atomic update: message + turn state together (avoids race condition)
  const updates = {
    [`messages/${msgId}`]: {
      playerId: S.playerId, playerName: S.playerName,
      type, text,
      targetId: targetId || null,
      targetName: targetName || null,
      ts: Date.now(),
    }
  };

  if (type === 'statement') {
    // Mark sender as acted, check if round complete
    const { newActed, allActed } = actorUpdate(S.playerId, S.roomData);
    updates['turnPlayerId'] = getNextTurnPlayerId(S.roomData);
    updates['pendingAnswer'] = null;
    updates['roundActed'] = newActed;
    if (allActed) {
      updates['votingEnabled'] = true;
      updates['roundActed']    = null;
      const sysId = 'sys_' + (Date.now() + 1);
      updates[`messages/${sysId}`] = {
        type: 'system',
        text: '🗳️ Todos falaram! Votação habilitada.',
        ts: Date.now() + 1,
      };
    }
  } else {
    // Asker uses their turn — mark as acted but wait for answer
    const { newActed } = actorUpdate(S.playerId, S.roomData);
    updates['roundActed'] = newActed;
    updates['pendingAnswer'] = {
      targetId, targetName,
      askerName: S.playerName,
      questionText: text,
    };
  }

  await roomRef.update(updates);
}

async function sendAnswer() {
  const text = document.getElementById('t-answer').value.trim();
  if (!text) { toast('Escreva sua resposta!'); return; }

  const msgId = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  // Mark answerer as acted, check round complete
  const { newActed, allActed } = actorUpdate(S.playerId, S.roomData);
  const answerUpdates = {
    [`messages/${msgId}`]: {
      playerId: S.playerId, playerName: S.playerName,
      type: 'answer', text, ts: Date.now(),
    },
    turnPlayerId: getNextTurnPlayerId(S.roomData),
    pendingAnswer: null,
    roundActed: newActed,
  };
  if (allActed) {
    answerUpdates['votingEnabled'] = true;
    answerUpdates['roundActed']    = null;
    const sysId = 'sys_' + (Date.now() + 1);
    answerUpdates[`messages/${sysId}`] = {
      type: 'system',
      text: '🗳️ Todos falaram! Votação habilitada.',
      ts: Date.now() + 1,
    };
  }
  await roomRef.update(answerUpdates);

  document.getElementById('t-answer').value = '';
}

// ══════════════════════════════════════════════
//  IMPOSTOR GUESS
// ══════════════════════════════════════════════
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function openGuessModal() {
  document.getElementById('guess-input').value = '';
  document.getElementById('guess-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('guess-input').focus(), 50);
}

function closeGuessModal() {
  document.getElementById('guess-modal').style.display = 'none';
}

async function submitGuess() {
  const guess = document.getElementById('guess-input').value.trim();
  if (!guess) { toast('Digite uma palavra!'); return; }

  const pair    = getWordPair(S.roomData);
  const correct = normalize(guess) === normalize(pair.word);

  closeGuessModal();
  sysMsg(`${S.playerName} (impostor) chutou: "${guess}"`);

  await roomRef.update({
    state: 'gameOver',
    winner: correct ? 'impostor' : 'players',
    impostorGuess: guess,
    impostorGuessedCorrectly: correct,
  });
}

// ══════════════════════════════════════════════
//  VOTING
// ══════════════════════════════════════════════
async function callVote() {
  if (S.roomData?.state !== 'playing') return;
  if (!S.roomData?.votingEnabled) { toast('Aguarde todos falarem antes de votar!'); return; }
  await roomRef.update({ state: 'voting', voteInitiator: S.playerId, votes: null });
  sysMsg(`${S.playerName} iniciou uma votação!`);
}

function showVoting(data) {
  const players = data.players || {};
  const votes   = data.votes   || {};
  const alive   = alivePlayers(players);

  // vote counts
  const counts = {};
  Object.values(votes).forEach(tid => { counts[tid] = (counts[tid] || 0) + 1; });
  const maxVotes = Math.max(0, ...Object.values(counts));

  const grid = document.getElementById('vote-grid');
  grid.innerHTML = '';
  alive.forEach(([id, p]) => {
    const myVote = votes[S.playerId];
    const btn = document.createElement('button');
    const isLeading = counts[id] === maxVotes && maxVotes > 0;
    btn.className = 'vote-btn' + (myVote === id ? ' my-vote' : '') + (isLeading && !myVote ? ' leading' : '');
    btn.innerHTML = `
      <div class="vav">${initial(p.name)}</div>
      <div class="vote-name">${escHtml(p.name)}${id === S.playerId ? '<br><small style="color:var(--muted)">(você)</small>' : ''}</div>
      <div class="vote-count">${counts[id] || 0} voto(s)</div>`;
    btn.addEventListener('click', () => castVote(id));
    grid.appendChild(btn);
  });

  // status
  const votedCount = Object.keys(votes).length;
  document.getElementById('vote-status').textContent = `${votedCount} de ${alive.length} votaram`;

  // host controls
  document.getElementById('btn-force-result').style.display = S.isHost ? 'block' : 'none';
  document.getElementById('btn-cancel-vote').style.display  = (data.voteInitiator === S.playerId) ? 'block' : 'none';

  screen('voting');
}

async function castVote(targetId) {
  await roomRef.child(`votes/${S.playerId}`).set(targetId);
}

async function forceResult() {
  await processVotes(S.roomData);
}

async function cancelVote() {
  await roomRef.update({ state: 'playing', votes: null, voteInitiator: null });
  sysMsg('Votação cancelada.');
}

async function processVotes(data) {
  if (!S.isHost) return;

  const players = data.players || {};
  const votes   = data.votes   || {};
  const alive   = alivePlayers(players);

  // count
  const counts = {};
  Object.values(votes).forEach(tid => { counts[tid] = (counts[tid] || 0) + 1; });

  let maxV = 0, eliminated = null, tie = false;
  Object.entries(counts).forEach(([id, c]) => {
    if (c > maxV) { maxV = c; eliminated = id; tie = false; }
    else if (c === maxV) { tie = true; eliminated = null; }
  });

  if (tie || !eliminated) {
    await roomRef.update({ state: 'roundResult', eliminatedThisRound: null, tiedVote: true });
    return;
  }

  await roomRef.child(`players/${eliminated}/isAlive`).set(false);

  const impostorId = data.impostorId;

  if (eliminated === impostorId) {
    await roomRef.update({ state: 'gameOver', winner: 'players', eliminatedThisRound: eliminated });
    return;
  }

  // check impostor wins: impostor alive AND remaining alive <= 2 (impostor + 1)
  const remaining = alive.filter(([id]) => id !== eliminated);
  if (remaining.length <= 2) {
    await roomRef.update({ state: 'gameOver', winner: 'impostor', eliminatedThisRound: eliminated });
    return;
  }

  await roomRef.update({ state: 'roundResult', eliminatedThisRound: eliminated, tiedVote: false });
}

function checkAutoProcess(data) {
  if (!S.isHost) return;
  if (data.state !== 'voting') return;
  const players = data.players || {};
  const votes   = data.votes   || {};
  const alive   = alivePlayers(players);
  if (Object.keys(votes).length >= alive.length) {
    processVotes(data);
  }
}

// ══════════════════════════════════════════════
//  ROUND RESULT
// ══════════════════════════════════════════════
function showRoundResult(data) {
  const players  = data.players || {};
  const elimId   = data.eliminatedThisRound;
  const elimName = players[elimId]?.name || '???';
  const card     = document.getElementById('result-card');

  if (data.tiedVote || !elimId) {
    card.innerHTML = `
      <div class="big-icon">🤝</div>
      <div class="big-title">Empate!</div>
      <div class="big-sub">Ninguém foi eliminado nessa rodada.</div>`;
  } else {
    card.innerHTML = `
      <div class="big-icon">⚡</div>
      <div class="big-title">${escHtml(elimName)} foi eliminado!</div>
      <div class="big-sub">Mas não era o impostor…</div>`;
  }

  document.getElementById('result-host-actions').style.display = S.isHost ? 'flex' : 'none';
  document.getElementById('result-waiting').style.display       = S.isHost ? 'none' : 'block';
  screen('result');
}

async function continueGame() {
  const nextTurnId = getNextTurnPlayerId(S.roomData);
  await roomRef.update({
    state: 'playing',
    round: (S.roomData?.round || 1) + 1,
    turnPlayerId: nextTurnId,
    pendingAnswer: null,
    votingEnabled: false,
    roundActed: null,
    votes: null, voteInitiator: null,
    eliminatedThisRound: null, tiedVote: null,
  });
}

async function endGame() {
  const impostorId   = S.roomData?.impostorId;
  const players      = S.roomData?.players || {};
  const impostorAlive = players[impostorId]?.isAlive;
  await roomRef.update({ state: 'gameOver', winner: impostorAlive ? 'impostor' : 'players' });
}

// ══════════════════════════════════════════════
//  GAME OVER
// ══════════════════════════════════════════════
function showGameOver(data) {
  const pair       = getWordPair(data);
  const impostorId = data.impostorId;
  const players    = data.players || {};
  const impName    = players[impostorId]?.name || '???';
  const similarMode = data.config?.similarWordMode;
  const card = document.getElementById('gameover-card');

  const winPlayers = data.winner === 'players';
  const guessCtx = data.impostorGuess
    ? (data.impostorGuessedCorrectly
        ? `O impostor chutou "<strong>${escHtml(data.impostorGuess)}</strong>" e acertou!`
        : `O impostor chutou "<strong>${escHtml(data.impostorGuess)}</strong>" e errou!`)
    : (winPlayers ? 'O impostor foi descoberto!' : 'O impostor enganou todo mundo!');

  card.innerHTML = `
    <div class="big-icon">${winPlayers ? '🏆' : '🕵️'}</div>
    <div class="big-title ${winPlayers ? 'win-p' : 'win-i'}">
      ${winPlayers ? 'Jogadores vencem!' : 'Impostor vence!'}
    </div>
    <div class="big-sub">${guessCtx}</div>
    <div style="margin-top:20px;width:100%">
      <div class="info-line">O impostor era:</div>
      <div class="info-val" style="margin-top:4px">${escHtml(impName)}</div>
    </div>
    <div style="width:100%">
      <div class="info-line">A palavra era:</div>
      <span class="reveal-word">${escHtml(pair.word)}</span>
      ${similarMode ? `<div class="info-line" style="margin-top:8px">Palavra do impostor: <strong>${escHtml(pair.similar)}</strong></div>` : ''}
    </div>`;
  screen('gameover');
}

async function playAgain() {
  // Reset all players to alive + back to lobby
  const players = S.roomData?.players || {};
  const updates = {};
  Object.keys(players).forEach(id => { updates[`players/${id}/isAlive`] = true; });
  updates.state            = 'lobby';
  updates.round            = 0;
  updates.wordPairIndex    = null;
  updates.impostorId       = null;
  updates.readyPlayers     = null;
  updates.messages         = null;
  updates.votes            = null;
  updates.eliminatedThisRound = null;
  updates.winner           = null;
  updates.tiedVote         = null;
  updates.voteInitiator    = null;
  await roomRef.update(updates);
  enterLobby();
}

function goHome() {
  if (roomRef) roomRef.off();
  S.roomCode = null; S.isHost = false; S.roomData = null; S.prevGameState = null;
  screen('home');
}

// ══════════════════════════════════════════════
//  FIREBASE LISTENER
// ══════════════════════════════════════════════
function listenRoom() {
  roomRef.on('value', snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    S.roomData = data;
    const changed = data.state !== S.prevGameState;
    S.prevGameState = data.state;
    handleUpdate(data, changed);
  });
}

function handleUpdate(data, changed) {
  const cur = document.querySelector('.screen.active')?.id;

  switch (data.state) {
    case 'lobby':
      renderLobby(data.players);
      if (changed && cur !== 'screen-lobby') enterLobby();
      // sync similar word toggle for non-hosts
      if (!S.isHost) {
        // nothing to sync in UI, just data
      }
      break;

    case 'roleReveal':
      if (changed) showRoleReveal(data);
      checkAllReady(data);
      break;

    case 'playing':
      if (changed) showGame(data);
      else if (cur === 'screen-game') updateGame(data);
      break;

    case 'voting':
      showVoting(data);
      checkAutoProcess(data);
      break;

    case 'roundResult':
      if (changed) showRoundResult(data);
      break;

    case 'gameOver':
      if (changed) showGameOver(data);
      break;
  }
}

// ══════════════════════════════════════════════
//  DOM EVENT LISTENERS
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();

  // ── Home ──
  document.getElementById('btn-create').addEventListener('click', createRoom);
  document.getElementById('btn-join').addEventListener('click', joinRoom);

  ['inp-name', 'inp-code'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const code = document.getElementById('inp-code').value.trim();
        code ? joinRoom() : createRoom();
      }
    });
  });

  // ── Lobby ──
  document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(S.roomCode)
      .then(() => toast('Código copiado! ✓'))
      .catch(() => toast('Código: ' + S.roomCode));
  });
  document.getElementById('btn-start').addEventListener('click', startGame);

  // sync similar word mode to firebase
  document.getElementById('chk-similar').addEventListener('change', async e => {
    if (roomRef && S.isHost) await roomRef.child('config/similarWordMode').set(e.target.checked);
  });

  // sync category to firebase
  document.getElementById('sel-category').addEventListener('change', async e => {
    if (roomRef && S.isHost) await roomRef.child('config/wordCategory').set(e.target.value);
  });

  // ── Role reveal ──
  document.getElementById('btn-ready').addEventListener('click', markReady);

  // ── Game tabs ──
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      currentTab = btn.dataset.t;
      document.getElementById('f-statement').style.display = currentTab === 'statement' ? 'flex' : 'none';
      document.getElementById('f-question').style.display  = currentTab === 'question'  ? 'flex' : 'none';
    });
  });

  // ── Send messages ──
  document.getElementById('btn-send-s').addEventListener('click', () => sendMsg('statement'));
  document.getElementById('btn-send-q').addEventListener('click', () => sendMsg('question'));
  document.getElementById('btn-send-a').addEventListener('click', sendAnswer);

  document.getElementById('t-statement').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg('statement'); }
  });
  document.getElementById('t-question').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg('question'); }
  });
  document.getElementById('t-answer').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(); }
  });

  // ── Impostor guess ──
  document.getElementById('btn-guess').addEventListener('click', openGuessModal);
  document.getElementById('btn-confirm-guess').addEventListener('click', submitGuess);
  document.getElementById('btn-cancel-guess').addEventListener('click', closeGuessModal);
  document.getElementById('guess-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitGuess();
    if (e.key === 'Escape') closeGuessModal();
  });

  // ── Call vote ──
  document.getElementById('btn-call-vote').addEventListener('click', callVote);

  // ── Voting ──
  document.getElementById('btn-force-result').addEventListener('click', forceResult);
  document.getElementById('btn-cancel-vote').addEventListener('click', cancelVote);

  // ── Round result ──
  document.getElementById('btn-continue').addEventListener('click', continueGame);
  document.getElementById('btn-end').addEventListener('click', endGame);

  // ── Game over ──
  document.getElementById('btn-play-again').addEventListener('click', playAgain);
  document.getElementById('btn-home').addEventListener('click', goHome);
});
