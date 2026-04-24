// ══════════════════════════════════════════════
//  results.js — Resultado da rodada e fim de jogo
// ══════════════════════════════════════════════

function showRoundResult(data) {
  const players     = data.players || {};
  const elimId      = data.eliminatedThisRound;
  const elimName    = players[elimId]?.name || '???';
  const impostorIds = data.impostorIds || [];
  const card        = document.getElementById('result-card');
  const hostActions = document.getElementById('result-host-actions');

  if (data.tiedVote || !elimId) {
    card.innerHTML = `
      <div class="big-icon">🤝</div>
      <div class="big-title">Empate!</div>
      <div class="big-sub">Ninguém foi eliminado nessa rodada.</div>`;
  } else {
    const wasImpostor = impostorIds.includes(elimId);
    card.innerHTML = `
      <div class="big-icon">⚡</div>
      <div class="big-title">${escHtml(elimName)} foi eliminado!</div>
      <div class="big-sub">${wasImpostor ? '🎉 Era um impostor!' : 'Mas não era impostor…'}</div>`;
  }

  // Build host actions dynamically — what makes sense depends on the outcome
  if (S.isHost) {
    const detectivesWon = elimId && impostorIds.includes(elimId);

    if (detectivesWon) {
      // Detetives pegaram um impostor — nova palavra faz sentido
      hostActions.innerHTML = `
        <button class="btn btn-primary"   id="btn-continue">Próxima rodada · nova palavra</button>
        <button class="btn btn-secondary" id="btn-end">Encerrar jogo</button>`;
      document.getElementById('btn-continue').addEventListener('click', continueNewWord);
    } else {
      // Impostor sobreviveu — oferecer revanche com a mesma palavra
      hostActions.innerHTML = `
        <button class="btn btn-primary"   id="btn-continue-same">Revanche · mesma palavra</button>
        <button class="btn btn-secondary" id="btn-continue-new">Próxima rodada · nova palavra</button>
        <button class="btn btn-secondary" id="btn-end">Encerrar jogo</button>
        <p class="hint" style="font-style:italic;margin-top:4px;">
          O impostor sobreviveu — a revanche dá aos detetives outra chance com as dicas que já têm.</p>`;
      document.getElementById('btn-continue-same').addEventListener('click', continueGame);
      document.getElementById('btn-continue-new').addEventListener('click', continueNewWord);
    }

    document.getElementById('btn-end').addEventListener('click', endGame);
    hostActions.style.display = 'flex';
  } else {
    hostActions.style.display = 'none';
  }

  document.getElementById('result-waiting').style.display = S.isHost ? 'none' : 'block';
  screen('result');
}

async function continueGame() {
  // Revanche — mantém a mesma palavra; rodada já foi incrementada pelo allActed
  const nextTurnId = getNextTurnPlayerId(S.roomData);
  await roomRef.update({
    state:               'playing',
    turnPlayerId:        nextTurnId,
    pendingAnswer:       null,
    votingEnabled:       false,
    roundActed:          null,
    votes:               null,
    voteInitiator:       null,
    eliminatedThisRound: null,
    tiedVote:            null,
  });
}

async function continueNewWord() {
  // Avança para nova rodada com palavra diferente da categoria atual
  const cat    = S.roomData?.config?.wordCategory || S.roomData?.wordCategory || 'Tudo';
  const pairs  = CATEGORIES[cat];
  let newIndex = Math.floor(Math.random() * pairs.length);
  if (pairs.length > 1) {
    while (newIndex === S.roomData?.wordPairIndex) {
      newIndex = Math.floor(Math.random() * pairs.length);
    }
  }
  const nextTurnId = getNextTurnPlayerId(S.roomData);
  await roomRef.update({
    state:               'playing',
    wordPairIndex:       newIndex,
    wordCategory:        cat,
    turnPlayerId:        nextTurnId,
    pendingAnswer:       null,
    votingEnabled:       false,
    roundActed:          null,
    votes:               null,
    voteInitiator:       null,
    eliminatedThisRound: null,
    tiedVote:            null,
  });
}

async function endGame() {
  const impostorIds      = S.roomData?.impostorIds || [];
  const players          = S.roomData?.players || {};
  const anyImpostorAlive = impostorIds.some(id => players[id]?.isAlive);
  await roomRef.update({ state: 'gameOver', winner: anyImpostorAlive ? 'impostor' : 'players' });
}

function showGameOver(data) {
  const pair        = getWordPair(data);
  const impostorIds = data.impostorIds || [];
  const players     = data.players || {};
  const impNames    = impostorIds.map(id => players[id]?.name || '???').join(', ');
  const similarMode = data.config?.similarWordMode;
  const card        = document.getElementById('gameover-card');

  const winPlayers = data.winner === 'players';
  const guessCtx = data.impostorKicked
    ? `👢 O impostor foi removido pelo host!`
    : data.impostorGuess
      ? (data.impostorGuessedCorrectly
          ? `O impostor chutou "<strong>${escHtml(data.impostorGuess)}</strong>" e acertou!`
          : `O impostor chutou "<strong>${escHtml(data.impostorGuess)}</strong>" e errou!`)
      : (winPlayers ? 'Os impostores foram descobertos!' : 'Os impostores enganaram todo mundo!');

  const impLabel = impostorIds.length > 1 ? 'Os impostores eram:' : 'O impostor era:';

  card.innerHTML = `
    <div class="big-icon">${winPlayers ? '🏆' : '🕵️'}</div>
    <div class="big-title ${winPlayers ? 'win-p' : 'win-i'}">
      ${winPlayers ? 'Jogadores vencem!' : 'Impostores vencem!'}
    </div>
    <div class="big-sub">${guessCtx}</div>
    <div style="margin-top:20px;width:100%">
      <div class="info-line">${impLabel}</div>
      <div class="info-val" style="margin-top:4px">${escHtml(impNames)}</div>
    </div>
    <div style="width:100%">
      <div class="info-line">A palavra era:</div>
      <span class="reveal-word">${escHtml(pair.word)}</span>
      ${similarMode ? `<div class="info-line" style="margin-top:8px">Palavra do(s) impostor(es): <strong>${escHtml(pair.similar)}</strong></div>` : ''}
    </div>`;
  screen('gameover');
}

async function playAgain() {
  const players = S.roomData?.players || {};
  const updates = {};
  Object.keys(players).forEach(id => { updates[`players/${id}/isAlive`] = true; });
  updates.state               = 'lobby';
  updates.round               = 0;
  updates.wordPairIndex       = null;
  updates.lastImpostorIds     = S.roomData?.impostorIds || null;  // peso para próxima partida
  updates.impostorIds         = null;
  updates.readyPlayers        = null;
  updates.messages            = null;
  updates.impostorMessages    = null;
  updates.votes               = null;
  updates.eliminatedThisRound = null;
  updates.winner              = null;
  updates.tiedVote            = null;
  updates.voteInitiator       = null;
  updates.impostorKicked      = null;
  await roomRef.update(updates);
  enterLobby();
}

function goHome() {
  if (roomRef) roomRef.off();
  S.roomCode = null; S.isHost = false; S.roomData = null; S.prevGameState = null;
  screen('home');
}
