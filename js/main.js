// ══════════════════════════════════════════════
//  main.js — Inicialização, listener Firebase e eventos DOM
// ══════════════════════════════════════════════

// ── Firebase Init ──────────────────────────────
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  } catch (e) {
    if (e.code !== 'app/duplicate-app') throw e;
    db = firebase.database();
  }
}

// ── Firebase Listener ──────────────────────────
function listenRoom() {
  roomRef.on('value', snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    S.roomData = data;
    const changed = data.state !== S.prevGameState;
    S.prevGameState = data.state;

    // Atualiza o "reaper" da sala (último conectado registra auto-delete)
    // Roda em todo update porque players entram/saem em qualquer momento.
    if (typeof updateAutoCleanup === 'function') {
      updateAutoCleanup(data);
    }

    handleUpdate(data, changed);
  });
}

function handleUpdate(data, changed) {
  const cur = document.querySelector('.screen.active')?.id;

  switch (data.state) {
    case 'lobby':
      renderLobby(data.players, data.config);
      if (changed && cur !== 'screen-lobby') enterLobby();
      break;

    case 'roleReveal':
      if (changed) showRoleReveal(data);
      checkAllReady(data);
      break;

    case 'playing':
      if (S.midGameJoin) {
        S.midGameJoin = false;
        showRoleReveal(data); // mostra a palavra para quem entrou no meio
      } else if (changed) {
        showGame(data);
      } else if (cur === 'screen-game') {
        updateGame(data);
      }
      break;

    case 'voting':
      showVoting(data);
      checkAutoProcess(data);
      break;

    case 'roundResult':
      if (changed) showRoundResult(data);
      break;

    case 'gameOver':
      if (changed) showGameOver(data);
      break;
  }
}

// ── DOM Event Listeners ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initAuth();

  // ── Home ──
  document.getElementById('btn-create').addEventListener('click', createRoom);
  document.getElementById('btn-join').addEventListener('click', joinRoom);

  // btn-login e btn-register são gerenciados dinamicamente por auth.js

  document.getElementById('btn-how-to-play').addEventListener('click', () => {
    document.getElementById('how-to-play-modal').style.display = 'flex';
  });
  document.getElementById('btn-close-htp').addEventListener('click', () => {
    document.getElementById('how-to-play-modal').style.display = 'none';
  });
  document.getElementById('how-to-play-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('how-to-play-modal'))
      document.getElementById('how-to-play-modal').style.display = 'none';
  });

  ['inp-name', 'inp-code'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const code = document.getElementById('inp-code').value.trim();
        code ? joinRoom() : createRoom();
      }
    });
  });

  // ── Lobby ──
  document.getElementById('btn-leave-lobby').addEventListener('click', leaveLobby);
  document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(S.roomCode)
      .then(() => toast('Código copiado! ✓'))
      .catch(() => toast('Código: ' + S.roomCode));
  });
  document.getElementById('btn-start').addEventListener('click', startGame);

  // Sincroniza modo palavra similar com Firebase
  document.getElementById('chk-similar').addEventListener('change', async e => {
    if (roomRef && S.isHost) await roomRef.child('config/similarWordMode').set(e.target.checked);
  });

  // Sincroniza categoria com Firebase
  document.getElementById('sel-category').addEventListener('change', async e => {
    if (roomRef && S.isHost) await roomRef.child('config/wordCategory').set(e.target.value);
  });

  // Sincroniza número de impostores com Firebase
  document.getElementById('sel-impostor-count').addEventListener('change', async e => {
    if (roomRef && S.isHost) await roomRef.child('config/impostorCount').set(parseInt(e.target.value));
  });

  // ── Role reveal ──
  document.getElementById('btn-ready').addEventListener('click', markReady);

  // ── Abas do jogo ──
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      currentTab = btn.dataset.t;
      document.getElementById('f-statement').style.display = currentTab === 'statement' ? 'flex' : 'none';
      document.getElementById('f-question').style.display  = currentTab === 'question'  ? 'flex' : 'none';
    });
  });

  // ── Envio de mensagens ──
  document.getElementById('btn-send-s').addEventListener('click', () => sendMsg('statement'));
  document.getElementById('btn-send-q').addEventListener('click', () => sendMsg('question'));
  document.getElementById('btn-send-a').addEventListener('click', sendAnswer);

  document.getElementById('t-statement').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg('statement'); }
  });
  document.getElementById('t-question').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg('question'); }
  });
  document.getElementById('t-answer').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer(); }
  });

  // ── Chat dos impostores ──
  document.getElementById('btn-imp-chat').addEventListener('click', openImpostorChat);
  document.getElementById('btn-close-imp-chat').addEventListener('click', closeImpostorChat);
  document.getElementById('btn-send-imp').addEventListener('click', sendImpostorMsg);
  document.getElementById('t-imp-msg').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendImpostorMsg(); }
  });

  // ── Chute do impostor ──
  document.getElementById('btn-guess').addEventListener('click', openGuessModal);
  document.getElementById('btn-confirm-guess').addEventListener('click', submitGuess);
  document.getElementById('btn-cancel-guess').addEventListener('click', closeGuessModal);
  document.getElementById('guess-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitGuess();
    if (e.key === 'Escape') closeGuessModal();
  });

  // ── Votação ──
  document.getElementById('btn-call-vote').addEventListener('click', callVote);
  document.getElementById('btn-force-result').addEventListener('click', forceResult);
  document.getElementById('btn-cancel-vote').addEventListener('click', cancelVote);

  // ── Resultado da rodada ──
  document.getElementById('btn-continue').addEventListener('click', continueGame);
  document.getElementById('btn-end').addEventListener('click', endGame);

  // ── Fim de jogo ──
  document.getElementById('btn-play-again').addEventListener('click', playAgain);
  document.getElementById('btn-home').addEventListener('click', goHome);
});
