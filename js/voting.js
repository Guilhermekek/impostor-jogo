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
  // Não pode votar em si mesmo — filtra o próprio player dos alvos
  const targets = alive.filter(([id]) => id !== S.playerId);
  targets.forEach(([id, p]) => {
    const myVote = votes[S.playerId];
    const btn = document.createElement('button');
    const isLeading = counts[id] === maxVotes && maxVotes > 0;
    btn.className = 'vote-btn' + (myVote === id ? ' my-vote' : '') + (isLeading && !myVote ? ' leading' : '');
    btn.innerHTML = `
      <div class="vav">${initial(p.name)}</div>
      <div class="vote-name">${escHtml(p.name)}</div>
      <div class="vote-count">${counts[id] || 0} voto(s)</div>`;
    btn.addEventListener('click', () => castVote(id));
    grid.appendChild(btn);
  });

  // status — todos os vivos podem votar (mesmo sem se incluir como alvo)
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
  const impostorIds = data.impostorIds || [];

  // contagem
  const counts = {};
  Object.values(votes).forEach(tid => { counts[tid] = (counts[tid] || 0) + 1; });

  let maxV = 0, eliminated = null, tie = false;
  Object.entries(counts).forEach(([id, c]) => {
    if (c > maxV) { maxV = c; eliminated = id; tie = false; }
    else if (c === maxV) { tie = true; eliminated = null; }
  });

  // Empate ou ninguém votado → cancela votação e volta a jogar
  // (futuro: pode-se mudar pra terminar como derrota dos jogadores)
  if (tie || !eliminated) {
    const sysKey = roomRef.child('messages').push().key;
    await roomRef.update({
      state:         'playing',
      votes:         null,
      voteInitiator: null,
      votingEnabled: false,
      roundActed:    null,
      tiedVote:      null,
      [`messages/${sysKey}`]: {
        type: 'system',
        text: '🤝 Votação empatou! A investigação continua — chamem nova votação quando estiverem prontos.',
        ts: Date.now(),
      },
    });
    return;
  }

  // Marca como eliminado
  await roomRef.child(`players/${eliminated}/isAlive`).set(false);

  // Lógica atual: 1 eliminação termina o jogo
  // - Eliminado era impostor  → jogadores vencem
  // - Eliminado era inocente → impostor vence
  // (Futuro: implementar continuar/parar a cada eliminação aqui)
  const wasImpostor = impostorIds.includes(eliminated);
  await roomRef.update({
    state:               'gameOver',
    winner:              wasImpostor ? 'players' : 'impostor',
    eliminatedThisRound: eliminated,
  });
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
