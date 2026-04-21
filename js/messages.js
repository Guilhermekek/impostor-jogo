// ══════════════════════════════════════════════
//  messages.js — Renderização e envio de mensagens
// ══════════════════════════════════════════════

function renderMessages(messages) {
  const area = document.getElementById('g-messages');
  const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 60;

  const sorted = Object.entries(messages || {})
    .sort(([keyA], [keyB]) => keyA < keyB ? -1 : keyA > keyB ? 1 : 0)
    .map(([, v]) => v);
  area.innerHTML = '';
  sorted.forEach(m => {
    const d = document.createElement('div');
    if (m.type === 'system') {
      d.className = 'msg msg-sys';
      d.textContent = m.text;
    } else {
      const isQ = m.type === 'question';
      const isA = m.type === 'answer';
      d.className = 'msg';
      const badgeClass = isQ ? ' q' : isA ? ' a' : '';
      const badgeText  = isQ ? '❓ Pergunta' : isA ? '💬 Resposta' : '💬 Declaração';
      d.innerHTML = `
        <div class="msg-header">
          <span class="msg-author">${escHtml(m.playerName)}</span>
          <span class="msg-badge${badgeClass}">${badgeText}</span>
          ${isQ ? `<span class="msg-target">→ ${escHtml(m.targetName || '')}</span>` : ''}
        </div>
        <div class="msg-text">${escHtml(m.text)}</div>`;
    }
    area.appendChild(d);
  });

  if (wasAtBottom) area.scrollTop = area.scrollHeight;
}

async function sendMsg(type) {
  const myPlayer = S.roomData?.players?.[S.playerId];
  if (!myPlayer?.isAlive) { toast('Você foi eliminado!'); return; }
  if (S.roomData?.turnPlayerId !== S.playerId) { toast('Não é sua vez!'); return; }
  if (S.roomData?.pendingAnswer) { toast('Aguardando resposta antes de continuar!'); return; }

  let text, targetId, targetName;
  if (type === 'statement') {
    text = document.getElementById('t-statement').value.trim();
    if (!text) { toast('Escreva algo!'); return; }
    document.getElementById('t-statement').value = '';
  } else {
    text       = document.getElementById('t-question').value.trim();
    targetId   = document.getElementById('sel-target').value;
    targetName = S.roomData?.players?.[targetId]?.name;
    if (!text)     { toast('Escreva uma pergunta!'); return; }
    if (!targetId) { toast('Escolha um jogador!'); return; }
    document.getElementById('t-question').value = '';
  }

  const msgKey = roomRef.child('messages').push().key;

  // Atomic update: mensagem + estado do turno juntos (evita race condition)
  const updates = {
    [`messages/${msgKey}`]: {
      playerId: S.playerId, playerName: S.playerName,
      type, text,
      targetId: targetId || null,
      targetName: targetName || null,
      ts: Date.now(),
    }
  };

  if (type === 'statement') {
    // Marca quem agiu, verifica se a rodada foi completa
    const { newActed, allActed } = actorUpdate(S.playerId, S.roomData);
    updates['turnPlayerId'] = getNextTurnPlayerId(S.roomData);
    updates['pendingAnswer'] = null;
    updates['roundActed'] = newActed;
    if (allActed) {
      updates['votingEnabled'] = true;
      updates['roundActed']    = null;
      const sysKey2 = roomRef.child('messages').push().key;
      updates[`messages/${sysKey2}`] = {
        type: 'system',
        text: '🗳️ Todos falaram! Votação habilitada.',
        ts: Date.now() + 1,
      };
    }
  } else {
    // Pergunta conta o turno do perguntador, mas aguarda a resposta
    const { newActed } = actorUpdate(S.playerId, S.roomData);
    updates['roundActed'] = newActed;
    updates['pendingAnswer'] = {
      targetId, targetName,
      askerName: S.playerName,
      questionText: text,
    };
  }

  await roomRef.update(updates);
}

async function sendAnswer() {
  const text = document.getElementById('t-answer').value.trim();
  if (!text) { toast('Escreva sua resposta!'); return; }

  const msgKey = roomRef.child('messages').push().key;

  // Resposta NÃO conta como turno do respondedor — apenas avança o turno
  const answerUpdates = {
    [`messages/${msgKey}`]: {
      playerId: S.playerId, playerName: S.playerName,
      type: 'answer', text, ts: Date.now(),
    },
    turnPlayerId: getNextTurnPlayerId(S.roomData),
    pendingAnswer: null,
  };
  await roomRef.update(answerUpdates);

  document.getElementById('t-answer').value = '';
}
