// ══════════════════════════════════════════════
//  settings.js — Música, volume e tema claro/escuro
// ══════════════════════════════════════════════

// ── Carrega preferências do localStorage ──
function loadSettings() {
  return {
    musicEnabled: localStorage.getItem('s_music') !== 'false',
    volume:       parseInt(localStorage.getItem('s_volume') ?? '40'),
    theme:        localStorage.getItem('s_theme') ?? 'dark',
  };
}

// ── Aplica tema ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Aplica volume ──
function applyVolume(v) {
  const audio = document.getElementById('bg-music');
  if (audio) audio.volume = v / 100;
  const pct = document.getElementById('volume-pct');
  if (pct) pct.textContent = v + '%';
  const slider = document.getElementById('music-volume');
  if (slider) slider.value = v;
}

// ── Toca ou pausa a música ──
function applyMusicEnabled(enabled) {
  const audio = document.getElementById('bg-music');
  if (!audio) return;
  if (enabled) {
    audio.play().catch(() => {}); // ignora se bloqueado pelo navegador
  } else {
    audio.pause();
  }
}

// ── Abre / fecha o modal de settings ──
function openSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
}
function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

// ── Inicialização ──
document.addEventListener('DOMContentLoaded', () => {
  const s = loadSettings();

  // Aplica tema imediatamente
  applyTheme(s.theme);

  // Sincroniza UI do modal
  document.getElementById('chk-light-theme').checked = s.theme === 'light';
  document.getElementById('chk-music').checked = s.musicEnabled;
  document.getElementById('music-volume').value = s.volume;
  document.getElementById('volume-pct').textContent = s.volume + '%';

  // Aplica volume no player de áudio
  applyVolume(s.volume);

  // A maioria dos navegadores bloqueia autoplay sem interação do usuário.
  // Esperamos o primeiro clique em qualquer lugar para iniciar a música.
  if (s.musicEnabled) {
    const startMusic = () => {
      const audio = document.getElementById('bg-music');
      if (audio && audio.paused) {
        audio.volume = s.volume / 100;
        audio.play().catch(() => {});
      }
      document.removeEventListener('click', startMusic);
    };
    document.addEventListener('click', startMusic);
  }

  // ── Botão de configurações ──
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);

  // Fecha ao clicar fora do modal
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-modal')) closeSettings();
  });

  // ── Toggle de tema ──
  document.getElementById('chk-light-theme').addEventListener('change', e => {
    const theme = e.target.checked ? 'light' : 'dark';
    applyTheme(theme);
    localStorage.setItem('s_theme', theme);
  });

  // ── Toggle de música ──
  document.getElementById('chk-music').addEventListener('change', e => {
    const enabled = e.target.checked;
    localStorage.setItem('s_music', enabled);
    applyMusicEnabled(enabled);
  });

  // ── Slider de volume ──
  document.getElementById('music-volume').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    document.getElementById('volume-pct').textContent = v + '%';
    applyVolume(v);
    localStorage.setItem('s_volume', v);

    // Se a música está ativada mas pausada (ainda aguardando interação),
    // o movimento do slider já conta como interação — inicia a música
    const enabled = document.getElementById('chk-music').checked;
    const audio = document.getElementById('bg-music');
    if (enabled && audio && audio.paused) {
      audio.play().catch(() => {});
    }
  });
});
