// ══════════════════════════════════════════════
//  players.js — Renderização e gestão de jogadores
// ══════════════════════════════════════════════

// turnPlayerId: quem está jogando agora (para destacar em verde)
function renderStrip(players, turnPlayerId) {
  const el = document.getElementById('g-players');
  el.innerHTML = '';

  // Ordena pela ordem dos turnos (joinedAt)
  const ordered = Object.entries(players || {})
    .filter(([, p]) => !(p.isConnected === false && p.kicked))
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  ordered.forEach(([id, p]) => {
    const chip  = document.createElement('div');
    const isMe  = id === S.playerId;
    const isActive = id === turnPlayerId && p.isAlive;
    chip.className = 'p-chip'
      + (p.isAlive ? '' : ' dead')
      + (isActive  ? ' active' : '');

    chip.innerHTML = `
      <div class="av">${initial(p.name)}</div>
      <span>${escHtml(p.name)}${isMe ? ' (você)' : ''}</span>
      ${S.isHost && !isMe && p.isAlive ? `<button class="kick-btn" data-id="${id}" title="Remover jogador">×</button>` : ''}
    `;
    el.appendChild(chip);
  });

  // Event listeners para kick
  el.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      kickPlayer(btn.dataset.id);
    });
  });
}

function updateTargets(players) {
  const sel = document.getElementById('sel-target');
  const prev = sel.value;
  sel.innerHTML = '';
  alivePlayers(players).forEach(([id, p]) => {
    if (id === S.playerId) return;
    const o = document.createElement('option');
    o.value = id; o.textContent = p.name;
    sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}

async function kickPlayer(playerId) {
  if (!S.isHost) return;
  const players    = S.roomData?.players || {};
  const playerName = players[playerId]?.name || '???';
  if (!confirm(`Remover "${playerName}" da partida?`)) return;

  const isImpostor = S.roomData.impostorId === playerId;

  // ── Se o impostor for removido → fim de jogo ──
  if (isImpostor) {
    const sysKey = roomRef.child('messages').push().key;
    await roomRef.update({
      [`players/${playerId}/isAlive`]:     false,
      [`players/${playerId}/isConnected`]: false,
      [`players/${playerId}/kicked`]:      true,
      state:          'gameOver',
      winner:         'players',
      impostorKicked: true,
      [`messages/${sysKey}`]: {
        type: 'system',
        text: `👢 ${playerName} era o IMPOSTOR e foi removido! Jogadores vencem!`,
        ts: Date.now(),
      },
    });
    return;
  }

  // ── Kick normal (jogador comum) ──
  const updates = {
    [`players/${playerId}/isAlive`]:     false,
    [`players/${playerId}/isConnected`]: false,
    [`players/${playerId}/kicked`]:      true,
  };

  // Se era a vez dele, avança o turno
  if (S.roomData.turnPlayerId === playerId) {
    const fakeData = {
      ...S.roomData,
      players: {
        ...players,
        [playerId]: { ...players[playerId], isAlive: false, isConnected: false }
      }
    };
    updates['turnPlayerId'] = getNextTurnPlayerId(fakeData);
    updates['pendingAnswer'] = null;
  }

  // Se estava aguardando resposta dele, cancela
  if (S.roomData.pendingAnswer?.targetId === playerId) {
    updates['pendingAnswer'] = null;
  }

  const sysKey = roomRef.child('messages').push().key;
  updates[`messages/${sysKey}`] = {
    type: 'system',
    text: `👢 ${playerName} foi removido pelo host.`,
    ts: Date.now(),
  };

  await roomRef.update(updates);
}
