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
