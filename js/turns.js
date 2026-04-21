// ══════════════════════════════════════════════
//  turns.js — Lógica de turnos e rodadas
// ══════════════════════════════════════════════

// Quem precisa agir agora (dono do turno ou respondedor)
function whoNeedsToAct(data) {
  return data.pendingAnswer ? data.pendingAnswer.targetId : data.turnPlayerId;
}

// Retorna roundActed atualizado e se todos os jogadores vivos agiram
function actorUpdate(actorId, roomData) {
  const newActed = { ...(roomData.roundActed || {}), [actorId]: true };
  const alive    = alivePlayers(roomData.players || {});
  const allActed = alive.length > 0 && alive.every(([id]) => newActed[id]);
  return { newActed, allActed };
}

function getNextTurnPlayerId(data) {
  const ordered = Object.entries(data.players || {})
    .filter(([, p]) => p.isAlive && p.isConnected !== false)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
  if (!ordered.length) return null;
  const idx = ordered.findIndex(([id]) => id === data.turnPlayerId);
  // Se o jogador atual foi removido (idx === -1), começa do primeiro
  const nextIdx = (idx + 1) % ordered.length;
  return ordered[nextIdx][0];
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

  // ── Som & popup quando é minha vez ──
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

  // ── Barra de turno ──
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

  // ── Botão votar: apenas habilitado após rodada completa ──
  const voteBtn = document.getElementById('btn-call-vote');
  voteBtn.disabled = !data.votingEnabled;
  voteBtn.title    = data.votingEnabled ? '' : 'Aguarde todos falarem para votar';

  // ── Painéis de ação ──
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
