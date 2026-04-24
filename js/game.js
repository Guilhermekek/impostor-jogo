// ══════════════════════════════════════════════
//  game.js — Início do jogo, revelação de papel e tela de jogo
// ══════════════════════════════════════════════

async function startGame() {
  const players = S.roomData?.players || {};
  const active  = connectedPlayers(players);
  if (active.length < 2) { toast('Precisa de pelo menos 2 jogadores!'); return; }

  const similarWordMode = document.getElementById('chk-similar').checked;
  const wordCategory    = document.getElementById('sel-category').value || 'Tudo';
  const rawCount        = parseInt(document.getElementById('sel-impostor-count')?.value || '1');
  const maxImpostors    = Math.max(1, Math.floor(active.length / 2));
  const impostorCount   = Math.min(rawCount, maxImpostors);
  if (impostorCount < rawCount) {
    toast(`Máx. ${maxImpostors} impostor(es) para ${active.length} jogadores`);
  }

  const categoryPairs   = CATEGORIES[wordCategory];
  const pairIndex       = Math.floor(Math.random() * categoryPairs.length);
  const lastImpostorIds = S.roomData?.lastImpostorIds || [];
  const impostorIds     = selectImpostors(players, impostorCount, lastImpostorIds);

  const playerUpdates = {};
  active.forEach(([id]) => { playerUpdates[`players/${id}/isAlive`] = true; });

  const firstTurnId = connectedPlayers(players)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0][0];

  await roomRef.update({
    ...playerUpdates,
    'config/similarWordMode': similarWordMode,
    'config/wordCategory':    wordCategory,
    'config/impostorCount':   impostorCount,
    state:               'roleReveal',
    round:               1,
    wordCategory,
    wordPairIndex:       pairIndex,
    impostorIds,
    turnPlayerId:        firstTurnId,
    pendingAnswer:       null,
    votingEnabled:       false,
    roundActed:          null,
    readyPlayers:        null,
    messages:            null,
    impostorMessages:    null,
    votes:               null,
    eliminatedThisRound: null,
    tiedVote:            null,
    winner:              null,
    impostorKicked:      null,
  });
}

function showRoleReveal(data) {
  playGameStartSound();
  const pair        = getWordPair(data);
  const myIsImp     = isImpostor(data, S.playerId);
  const similarMode = data.config?.similarWordMode;
  const impostorIds = data.impostorIds || [];
  const players     = data.players || {};
  const multiImp    = impostorIds.length > 1;

  S.role   = myIsImp ? 'impostor' : 'player';
  S.myWord = myIsImp ? (similarMode ? pair.similar : null) : pair.word;

  const icon  = document.getElementById('role-icon');
  const stamp = document.getElementById('role-stamp');
  const title = document.getElementById('role-title');
  const desc  = document.getElementById('role-desc');
  const wdisp = document.getElementById('word-display');

  if (myIsImp) {
    stamp.textContent = '◈ Alvo ◈';
    stamp.className   = 'role-stamp impostor';
    icon.textContent  = '🕵️';
    title.textContent = multiImp ? 'Vocês são os IMPOSTORES!' : 'Você é o IMPOSTOR!';

    const allies = impostorIds
      .filter(id => id !== S.playerId)
      .map(id => players[id]?.name || '???');

    if (multiImp && allies.length) {
      desc.textContent = `Aliado(s): ${allies.join(', ')}. Use o chat secreto para se coordenar!`;
    } else {
      desc.textContent = similarMode
        ? 'Você recebeu uma palavra similar. Se misture!'
        : 'Você não tem a palavra real. Se misture!';
    }

    wdisp.textContent       = similarMode ? pair.similar : '???';
    wdisp.style.borderColor = similarMode ? 'var(--warning)' : 'var(--danger)';
    wdisp.style.color       = similarMode ? 'var(--warning)' : 'var(--danger)';
  } else {
    stamp.textContent = '◆ Detetive ◆';
    stamp.className   = 'role-stamp';
    icon.textContent  = '👥';
    title.textContent = 'Você é um Jogador!';
    desc.textContent  = multiImp
      ? `Atenção: há ${impostorIds.length} impostores! Descubra todos!`
      : 'Dê dicas sem entregar a palavra. Descubra o impostor!';
    wdisp.textContent       = pair.word;
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
  const ready     = data.readyPlayers || {};
  if (connected.length > 0 && connected.every(([id]) => ready[id])) {
    roomRef.update({ state: 'playing' });
  }
}

function showGame(data) {
  const pair    = getWordPair(data);
  const myIsImp = isImpostor(data, S.playerId);
  const simMode = data.config?.similarWordMode;

  const badge = document.getElementById('g-word-badge');
  if (myIsImp && !simMode) {
    badge.textContent = '??? (Impostor)';
  } else {
    badge.textContent = 'Palavra: ' + (myIsImp ? pair.similar : pair.word);
  }

  document.getElementById('g-round').textContent = data.round || 1;
  document.getElementById('btn-guess').style.display = myIsImp ? 'block' : 'none';

  renderStrip(data.players, data.turnPlayerId);
  updateTargets(data.players);
  renderMessages(data.messages);
  updateImpostorChatVisibility(data);
  renderTurnState(data);
  updateSidebar(data);
  screen('game');
}

function updateGame(data) {
  document.getElementById('g-round').textContent = data.round || 1;
  renderStrip(data.players, data.turnPlayerId);
  updateTargets(data.players);
  renderMessages(data.messages);
  updateImpostorChatVisibility(data);
  renderTurnState(data);
  updateSidebar(data);
}

// ── Sidebar (painel lateral desktop) ──
function updateSidebar(data) {
  const sidebar = document.getElementById('game-sidebar');
  if (!sidebar) return;

  const pair       = getWordPair(data);
  const myIsImp    = isImpostor(data, S.playerId);
  const simMode    = data.config?.similarWordMode;
  const impostorIds = data.impostorIds || [];
  const players    = data.players || {};
  const cat        = data.config?.wordCategory || data.wordCategory || 'Tudo';
  const impCount   = impostorIds.length;

  const allAlive   = alivePlayers(players);
  const aliveCount = allAlive.length;
  const totalConn  = connectedPlayers(players).length;
  const deadCount  = totalConn - aliveCount;

  const word       = myIsImp ? (simMode ? pair.similar : '???') : pair.word;
  const wordColor  = myIsImp ? (simMode ? 'var(--warning)' : 'var(--danger)') : 'var(--primary)';
  const roleTitle  = myIsImp ? 'Impostor' : 'Detetive';
  const roleDesc   = myIsImp
    ? (simMode ? 'Você recebeu uma palavra similar. Se misture com os detetives!'
               : 'Você não tem a palavra real. Observe as dicas e se misture!')
    : 'Você conhece a palavra. Dê pistas sutis para desmascarar o impostor sem entregá-la.';
  const tip = myIsImp
    ? '"Ouça com atenção. Os detetives darão pistas que revelam a palavra — use-as a seu favor."'
    : '"Repare em quem fala genericamente demais. O impostor pesca — o detetive sabe."';
  const roleCardClass = myIsImp ? 'sidebar-role-card imp' : 'sidebar-role-card';

  sidebar.innerHTML = `
    <div class="${roleCardClass}">
      <div class="sidebar-label">◆ Seu papel</div>
      <div class="sidebar-role-title">${roleTitle}</div>
      <div class="sidebar-role-desc">${escHtml(roleDesc)}</div>
      <div class="sidebar-word-box" style="border-color:${wordColor}">
        <div class="sidebar-word-label">PALAVRA SECRETA</div>
        <div class="sidebar-word" style="color:${wordColor}">${escHtml(word)}</div>
      </div>
    </div>
    <div class="sidebar-meta">
      <div class="sidebar-label">Meta</div>
      <div class="sidebar-meta-rows">
        <div class="sidebar-meta-row"><span>Categoria</span><span>${escHtml(cat)}</span></div>
        <div class="sidebar-meta-row"><span>Impostores</span><span>${impCount}</span></div>
        <div class="sidebar-meta-row"><span>Jogadores</span><span>${aliveCount}${deadCount > 0 ? ` · ${deadCount} elim.` : ''}</span></div>
        <div class="sidebar-meta-row"><span>Palavra similar</span><span>${simMode ? 'Sim' : 'Não'}</span></div>
      </div>
    </div>
    <div class="sidebar-tips">
      <div class="sidebar-label">🕵️ Dica do caso</div>
      <div class="sidebar-tips-text">${escHtml(tip)}</div>
    </div>
  `;
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
    state:                    'gameOver',
    winner:                   correct ? 'impostor' : 'players',
    impostorGuess:            guess,
    impostorGuessedCorrectly: correct,
  });
}
