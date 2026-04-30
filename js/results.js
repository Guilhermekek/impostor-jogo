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

  const isTie         = data.tiedVote || !elimId;
  const detectivesWon = !isTie && impostorIds.includes(elimId);
  const detectivesLost = !isTie && !detectivesWon;

  // Variant content (stamp / headline / subtitle)
  let stamp, variant, headline, subtitle;
  if (isTie) {
    stamp    = '◇ EMPATE ◇';
    variant  = 'tie';
    headline = 'Ninguém eliminado';
    subtitle = 'A votação empatou. A investigação continua.';
  } else if (detectivesWon) {
    stamp    = '◆ CASO RESOLVIDO ◆';
    variant  = 'win';
    headline = 'Você acertou';
    const multi = impostorIds.length > 1;
    subtitle = `${escHtml(elimName)} era ${multi ? 'um' : 'o'} impostor. Os detetives venceram esta rodada.`;
  } else {
    stamp    = '◈ IMPOSTOR ESCAPOU ◈';
    variant  = 'loss';
    headline = 'Você errou';
    subtitle = `${escHtml(elimName)} era inocente. O impostor continua à solta.`;
  }

  // Word reveal: APENAS na vitória — derrota oferece revanche com mesma palavra,
  // então mostrar a palavra quebraria a mecânica do jogo.
  let wordBox = '';
  if (detectivesWon) {
    const pair = getWordPair(data);
    wordBox = `
      <div class="result-word-box">
        <div class="result-word-label">A PALAVRA ERA</div>
        <div class="result-word">${escHtml(pair.word)}</div>
      </div>`;
  }

  // Confetti — só na vitória
  let confetti = '';
  if (detectivesWon) {
    const palette = ['var(--primary)', 'var(--success)', 'var(--text-dim)', 'oklch(0.50 0.10 80)'];
    confetti = Array.from({ length: 22 }, (_, i) => {
      const left  = (i * 7 + 3) % 100;
      const color = palette[i % 4];
      const dur   = 2.4 + (i % 5) * 0.3;
      const delay = 0.6 + (i * 0.07) % 2;
      return `<span class="result-confetti" style="left:${left}%;background:${color};animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
    }).join('');
  }

  card.className = `result-card-noir result-${variant}`;
  card.innerHTML = `
    ${confetti}
    <div class="result-grain-pulse"></div>
    <div class="result-content">
      <div class="result-stamp">${stamp}</div>
      <div class="result-headline display">${headline}</div>
      <div class="result-subtitle">${subtitle}</div>
      ${wordBox}
    </div>`;

  // Build host actions dynamically — what makes sense depends on the outcome
  if (S.isHost) {
    if (detectivesWon) {
      hostActions.innerHTML = `
        <button class="btn btn-primary"   id="btn-continue">▸ Próxima rodada · nova palavra</button>
        <button class="btn btn-secondary" id="btn-end">Encerrar jogo</button>`;
      document.getElementById('btn-continue').addEventListener('click', continueNewWord);
    } else if (isTie) {
      hostActions.innerHTML = `
        <button class="btn btn-primary"   id="btn-continue-same">▸ Continuar com mesma palavra</button>
        <button class="btn btn-secondary" id="btn-continue-new">Nova palavra</button>
        <button class="btn btn-secondary" id="btn-end">Encerrar jogo</button>`;
      document.getElementById('btn-continue-same').addEventListener('click', continueGame);
      document.getElementById('btn-continue-new').addEventListener('click', continueNewWord);
    } else {
      // Impostor sobreviveu — oferecer revanche com a mesma palavra
      hostActions.innerHTML = `
        <button class="btn btn-primary"   id="btn-continue-same">▸ Revanche · mesma palavra</button>
        <button class="btn btn-secondary" id="btn-continue-new">Próxima rodada com nova palavra</button>
        <button class="btn btn-secondary" id="btn-end">Encerrar jogo</button>`;
      document.getElementById('btn-continue-same').addEventListener('click', continueGame);
      document.getElementById('btn-continue-new').addEventListener('click', continueNewWord);
    }

    document.getElementById('btn-end').addEventListener('click', endGame);
    hostActions.style.display = 'flex';

    // Aplica animação de subida + pulse no botão primário (delays escalonados)
    const pulseName = detectivesWon ? 'ra-pulse-success' : detectivesLost ? 'ra-pulse-danger' : 'ra-pulse-primary';
    hostActions.querySelectorAll('.btn').forEach((b, i) => {
      const rise = `ra-btn-rise 0.4s ease-out ${2.6 + i * 0.12}s forwards`;
      const pulse = b.classList.contains('btn-primary')
        ? `, ${pulseName} 2.2s ease-in-out ${3.4 + i * 0.12}s infinite`
        : '';
      b.style.opacity = '0';
      b.style.animation = rise + pulse;
    });
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
