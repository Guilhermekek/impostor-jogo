// ══════════════════════════════════════════════
//  results.js — Resultado da rodada e fim de jogo
// ══════════════════════════════════════════════

// Cria overlay fullscreen de confete (cobre toda a tela, não só o card).
// Limpa qualquer overlay anterior e remove a si mesmo após 8s.
function spawnConfetti(count = 60) {
  document.querySelectorAll('.confetti-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'confetti-overlay';

  const palette = ['var(--primary)', 'var(--success)', 'var(--text-dim)', 'oklch(0.50 0.10 80)'];
  for (let i = 0; i < count; i++) {
    const left  = (i * 137) % 100; // distribuição estilo golden-ratio
    const color = palette[i % 4];
    const dur   = 3.0 + (i % 6) * 0.45;
    const delay = (i * 0.06) % 2.5;
    const el = document.createElement('span');
    el.className = 'result-confetti';
    el.style.cssText = `left:${left}%;background:${color};animation-duration:${dur}s;animation-delay:${delay}s;`;
    overlay.appendChild(el);
  }

  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 8000);
}

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

  card.className = `result-card-noir result-${variant}`;
  card.innerHTML = `
    <div class="result-grain-pulse"></div>
    <div class="result-content">
      <div class="result-stamp">${stamp}</div>
      <div class="result-headline display">${headline}</div>
      <div class="result-subtitle">${subtitle}</div>
      ${wordBox}
    </div>`;

  if (detectivesWon) spawnConfetti(50);

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

  const winPlayers  = data.winner === 'players';
  const iAmImpostor = impostorIds.includes(S.playerId);
  const iWon        = (winPlayers && !iAmImpostor) || (!winPlayers && iAmImpostor);

  const stamp    = iWon ? '◆ CASO ENCERRADO ◆' : '◈ INVESTIGAÇÃO FRACASSOU ◈';
  const variant  = iWon ? 'win' : 'loss';
  const headline = iWon ? 'Você venceu' : 'Você perdeu';

  // Subtitle context — prioriza eventos especiais (kick / chute final)
  let subtitle;
  if (data.impostorKicked) {
    subtitle = 'O impostor foi removido pelo host.';
  } else if (data.impostorGuess) {
    subtitle = data.impostorGuessedCorrectly
      ? `O impostor chutou "${escHtml(data.impostorGuess)}" e acertou.`
      : `O impostor chutou "${escHtml(data.impostorGuess)}" e errou.`;
  } else {
    subtitle = winPlayers
      ? 'Os detetives expuseram o impostor.'
      : 'O impostor enganou todos até o fim.';
  }

  const impLabel = impostorIds.length > 1 ? 'Os impostores eram' : 'O impostor era';

  card.className = `result-card-noir result-${variant}`;
  card.innerHTML = `
    <div class="result-grain-pulse"></div>
    <div class="result-content">
      <div class="result-stamp">${stamp}</div>
      <div class="result-headline display">${headline}</div>
      <div class="result-subtitle">${subtitle}</div>

      <div class="result-info-line">
        <div class="result-info-label">${impLabel.toUpperCase()}</div>
        <div class="result-info-val">${escHtml(impNames)}</div>
      </div>

      <div class="result-word-box" style="animation-delay: 1.7s">
        <div class="result-word-label">A PALAVRA ERA</div>
        <div class="result-word" style="animation-delay: 2.0s">${escHtml(pair.word)}</div>
      </div>

      ${similarMode ? `
        <div class="result-info-line" style="animation-delay: 2.0s">
          <div class="result-info-label">PALAVRA DO IMPOSTOR</div>
          <div class="result-info-val">${escHtml(pair.similar)}</div>
        </div>` : ''}
    </div>`;

  // Aplica animação de subida + pulse no botão primário
  const pulseName = iWon ? 'ra-pulse-success' : 'ra-pulse-danger';
  document.querySelectorAll('#screen-gameover .btn').forEach((b, i) => {
    const rise = `ra-btn-rise 0.4s ease-out ${2.6 + i * 0.12}s forwards`;
    const pulse = b.classList.contains('btn-primary')
      ? `, ${pulseName} 2.2s ease-in-out ${3.4 + i * 0.12}s infinite`
      : '';
    b.style.opacity = '0';
    b.style.animation = rise + pulse;
  });

  // Confete fullscreen + som de vitória/derrota
  if (iWon) {
    spawnConfetti(60);
    playVictorySound();
  } else {
    playDefeatSound();
  }

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
