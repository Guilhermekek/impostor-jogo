// ══════════════════════════════════════════════
//  results.js — Resultado da rodada e fim de jogo
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
  const impostorId    = S.roomData?.impostorId;
  const players       = S.roomData?.players || {};
  const impostorAlive = players[impostorId]?.isAlive;
  await roomRef.update({ state: 'gameOver', winner: impostorAlive ? 'impostor' : 'players' });
}

function showGameOver(data) {
  const pair       = getWordPair(data);
  const impostorId = data.impostorId;
  const players    = data.players || {};
  const impName    = players[impostorId]?.name || '???';
  const similarMode = data.config?.similarWordMode;
  const card = document.getElementById('gameover-card');

  const winPlayers = data.winner === 'players';
  const guessCtx = data.impostorKicked
    ? `👢 O impostor foi removido pelo host!`
    : data.impostorGuess
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
  const players = S.roomData?.players || {};
  const updates = {};
  Object.keys(players).forEach(id => { updates[`players/${id}/isAlive`] = true; });
  updates.state               = 'lobby';
  updates.round               = 0;
  updates.wordPairIndex       = null;
  updates.impostorId          = null;
  updates.readyPlayers        = null;
  updates.messages            = null;
  updates.votes               = null;
  updates.eliminatedThisRound = null;
  updates.winner              = null;
  updates.tiedVote            = null;
  updates.voteInitiator       = null;
  await roomRef.update(updates);
  enterLobby();
}

function goHome() {
  if (roomRef) roomRef.off();
  S.roomCode = null; S.isHost = false; S.roomData = null; S.prevGameState = null;
  screen('home');
}
