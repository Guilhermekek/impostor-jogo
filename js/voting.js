// ══════════════════════════════════════════════
//  voting.js — Sistema de votação
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

  // contagem de votos
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

  // controles do host
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
  const sysKey = roomRef.child('messages').push().key;
  await roomRef.update({
    state: 'playing',
    votes: null,
    voteInitiator: null,
    votingEnabled: false,
    roundActed: null,
    [`messages/${sysKey}`]: {
      type: 'system',
      text: '❌ Votação cancelada. Todos precisam falar novamente para reativar.',
      ts: Date.now(),
    },
  });
}

async function processVotes(data) {
  if (!S.isHost) return;

  const players     = data.players || {};
  const votes       = data.votes   || {};
  const alive       = alivePlayers(players);
  const impostorIds = data.impostorIds || [];

  // contagem
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

  // Jogadores restantes após eliminação
  const remaining     = alive.filter(([id]) => id !== eliminated);
  const aliveImps     = remaining.filter(([id]) => impostorIds.includes(id));
  const aliveRegulars = remaining.filter(([id]) => !impostorIds.includes(id));

  // Todos os impostores eliminados → jogadores vencem
  if (aliveImps.length === 0) {
    await roomRef.update({ state: 'gameOver', winner: 'players', eliminatedThisRound: eliminated });
    return;
  }

  // Impostores >= jogadores regulares → impostores vencem
  if (aliveImps.length >= aliveRegulars.length) {
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
