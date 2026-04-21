// ══════════════════════════════════════════════
//  state.js — Variáveis globais compartilhadas
// ══════════════════════════════════════════════

const S = {
  playerId: null,
  playerName: null,
  roomCode: null,
  isHost: false,
  role: null,       // 'player' | 'impostor'
  myWord: null,
  roomData: null,
  prevGameState: null,
};

let db, roomRef;
let currentTab = 'statement';
let prevActor  = null;
