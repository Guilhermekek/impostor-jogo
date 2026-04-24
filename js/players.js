// ══════════════════════════════════════════════
//  players.js — Renderização e gestão de jogadores
// ══════════════════════════════════════════════

function renderStrip(players, turnPlayerId) {
  const el = document.getElementById('g-players');
  el.innerHTML = '';

  const ordered = Object.entries(players || {})
    .filter(([, p]) => !(p.isConnected === false && p.kicked))
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  ordered.forEach(([id, p]) => {
    const chip     = document.createElement('div');
    const isMe     = id === S.playerId;
    const isActive = id === turnPlayerId && p.isAlive;
    chip.className = 'p-chip'
      + (p.isAlive ? '' : ' dead')
      + (isActive  ? ' active' : '');

    const subLabel = isActive ? '▸ na vez' : !p.isAlive ? 'eliminado' : '';
    chip.innerHTML = `
      <div class="av">${initial(p.name)}</div>
      <span>${escHtml(p.name)}${isMe ? ' <small style="opacity:.6;font-size:.85em">(você)</small>' : ''}</span>
      <div class="p-info">
        <div class="p-name">${escHtml(p.name)}${isMe ? ' <small style="opacity:.6;font-size:.75em">você</small>' : ''}</div>
        <div class="p-sub">${subLabel}</div>
      </div>
      ${S.isHost && !isMe && p.isAlive ? `<button class="kick-btn" data-id="${id}" title="Remover jogador">×</button>` : ''}
    `;
    el.appendChild(chip);
  });

  el.querySelectorAll('.kick-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      kickPlayer(btn.dataset.id);
    });
  });
}

function updateTargets(players) {
  const sel  = document.getElementById('sel-target');
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

  const impostorIds = S.roomData?.impostorIds || [];
  const isImpKick   = impostorIds.includes(playerId);

  // Simula estado após remoção para calcular condição de vitória
  const fakePlayers = {
    ...players,
    [playerId]: { ...players[playerId], isAlive: false, isConnected: false },
  };
  const fakeData  = { ...S.roomData, players: fakePlayers };
  const aliveAll  = alivePlayers(fakePlayers);
  const aliveImps = aliveAll.filter(([id]) => impostorIds.includes(id));
  const aliveReg  = aliveAll.filter(([id]) => !impostorIds.includes(id));

  const updates = {
    [`players/${playerId}/isAlive`]:     false,
    [`players/${playerId}/isConnected`]: false,
    [`players/${playerId}/kicked`]:      true,
  };

  const sysKey = roomRef.child('messages').push().key;

  // ── Todos os impostores eliminados → jogadores vencem ──
  if (aliveImps.length === 0) {
    updates.state          = 'gameOver';
    updates.winner         = 'players';
    updates.impostorKicked = true;
    updates[`messages/${sysKey}`] = {
      type: 'system',
      text: `👢 ${playerName} era o IMPOSTOR e foi removido! Jogadores vencem!`,
      ts: Date.now(),
    };
    await roomRef.update(updates);
    return;
  }

  // ── Impostores ≥ regulares → impostores vencem ──
  if (aliveImps.length >= aliveReg.length) {
    updates.state  = 'gameOver';
    updates.winner = 'impostor';
    updates[`messages/${sysKey}`] = {
      type: 'system',
      text: isImpKick
        ? `👢 ${playerName} era IMPOSTOR e foi removido, mas os demais impostores vencem!`
        : `👢 ${playerName} foi removido. Os impostores tomaram o controle!`,
      ts: Date.now(),
    };
    await roomRef.update(updates);
    return;
  }

  // ── Jogo continua ──
  if (isImpKick) {
    updates[`messages/${sysKey}`] = {
      type: 'system',
      text: `👢 ${playerName} era IMPOSTOR e foi removido! Ainda há ${aliveImps.length} impostor(es)!`,
      ts: Date.now(),
    };
  } else {
    updates[`messages/${sysKey}`] = {
      type: 'system',
      text: `👢 ${playerName} foi removido pelo host.`,
      ts: Date.now(),
    };
  }

  // Se era a vez dele, avança o turno
  if (S.roomData.turnPlayerId === playerId) {
    updates['turnPlayerId']  = getNextTurnPlayerId(fakeData);
    updates['pendingAnswer'] = null;
  }

  // Se havia pergunta pendente para ele, cancela
  if (S.roomData.pendingAnswer?.targetId === playerId) {
    updates['pendingAnswer'] = null;
  }

  await roomRef.update(updates);
}
