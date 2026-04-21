// ══════════════════════════════════════════════
//  lobby.js — Criação, entrada e lobby da sala
// ══════════════════════════════════════════════

async function createRoom() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { toast('Digite seu nome!'); return; }

  S.playerId = getPlayerId();
  S.playerName = name;
  S.isHost = true;

  // Encontra código não utilizado
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
  const midGame = data.state === 'playing';
  if (data.state !== 'lobby' && !midGame) { toast('Jogo já iniciado nessa sala!'); return; }

  S.playerId = getPlayerId();
  S.playerName = name;
  S.roomCode = code;
  S.isHost = false;
  roomRef = db.ref(`rooms/${code}`);

  await roomRef.child(`players/${S.playerId}`).set({
    name, isAlive: true, isConnected: true, joinedAt: Date.now(),
    midGameJoin: midGame,
  });
  roomRef.child(`players/${S.playerId}/isConnected`).onDisconnect().set(false);

  if (midGame) {
    S.midGameJoin = true;
    const sysKey = roomRef.child('messages').push().key;
    await roomRef.child(`messages/${sysKey}`).set({
      type: 'system',
      text: `🆕 ${name} entrou na partida!`,
      ts: Date.now(),
    });
  }

  enterLobby();
  listenRoom();
}

function enterLobby() {
  document.getElementById('show-code').textContent = S.roomCode;

  // Preenche select de categoria
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
