// ══════════════════════════════════════════════
//  audio.js — Som e popup de turno
// ══════════════════════════════════════════════

function playTurnSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch(e) {}
}

// Som dramático de início de jogo — arpejo ascendente
function playGameStartSound() {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [262, 330, 392, 523, 659]; // Dó, Mi, Sol, Dó, Mi
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.11;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch(e) {}
}

// Som de vitória — arpejo maior ascendente + acorde sustentado
function playVictorySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Arpejo C maior (C5, E5, G5, C6)
    const arpeggio = [523, 659, 784, 1047];
    arpeggio.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.13;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    // Acorde C maior sustentado (C5, E5, G5)
    const chord = [523, 659, 784];
    const tFinal = ctx.currentTime + arpeggio.length * 0.13;
    chord.forEach(freq => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, tFinal);
      gain.gain.setValueAtTime(0.16, tFinal);
      gain.gain.exponentialRampToValueAtTime(0.001, tFinal + 1.1);
      osc.start(tFinal);
      osc.stop(tFinal + 1.1);
    });
  } catch(e) {}
}

// Som de derrota — descida menor + nota grave caindo
function playDefeatSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Descida em A menor (A4, G4, E4, C4)
    const desc = [440, 392, 330, 262];
    desc.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    // "Wah-wah" final — nota grave caindo de A3 pra A2
    const tFinal = ctx.currentTime + desc.length * 0.18;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, tFinal);
    osc.frequency.exponentialRampToValueAtTime(110, tFinal + 0.85);
    gain.gain.setValueAtTime(0.20, tFinal);
    gain.gain.exponentialRampToValueAtTime(0.001, tFinal + 1.2);
    osc.start(tFinal);
    osc.stop(tFinal + 1.2);
  } catch(e) {}
}

function showTurnPopup(icon, label) {
  const popup = document.getElementById('turn-popup');
  document.getElementById('turn-popup-icon').textContent = icon;
  document.getElementById('turn-popup-text').textContent = label;
  popup.style.display = 'flex';
  clearTimeout(popup._t);
  // Re-trigger animation
  const inner = popup.querySelector('.turn-popup-inner');
  inner.style.animation = 'none';
  inner.offsetHeight; // reflow
  inner.style.animation = '';
  popup._t = setTimeout(() => { popup.style.display = 'none'; }, 1800);
}
