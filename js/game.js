// ══════════════════════════════════════════════
//  game.js — Início do jogo, revelação de papel e tela de jogo
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

  // Reseta isAlive de todos (em caso de revanche)
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

function showRoleReveal(data) {
  playGameStartSound();
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

function showGame(data) {
  const pair = getWordPair(data);
  const isImpostor = data.impostorId === S.playerId;
  const similarMode = data.config?.similarWordMode;

  // badge da palavra
  const badge = document.getElementById('g-word-badge');
  if (isImpostor && !similarMode) {
    badge.textContent = '??? (Impostor)';
  } else {
    badge.textContent = 'Palavra: ' + (isImpostor ? pair.similar : pair.word);
  }

  document.getElementById('g-round').textContent = data.round || 1;
  document.getElementById('btn-guess').style.display =
    (data.impostorId === S.playerId) ? 'block' : 'none';

  renderStrip(data.players, data.turnPlayerId);
  updateTargets(data.players);
  renderMessages(data.messages);
  renderTurnState(data);
  screen('game');
}

function updateGame(data) {
  document.getElementById('g-round').textContent = data.round || 1;
  renderStrip(data.players, data.turnPlayerId);
  updateTargets(data.players);
  renderMessages(data.messages);
  renderTurnState(data);
}

// ── Chute do impostor ──
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
