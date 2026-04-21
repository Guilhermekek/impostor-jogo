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
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

// ── Tenta iniciar a música; se o navegador bloquear,
//    registra listeners para a primeira interação do usuário ──
function tryStartMusic(volume) {
  const audio = document.getElementById('bg-music');
  if (!audio) return;
  audio.volume = volume / 100;

  audio.play().then(() => {
    // Tocou imediatamente — remove qualquer listener pendente
    document.removeEventListener('click',      _musicUnlock);
    document.removeEventListener('keydown',    _musicUnlock);
    document.removeEventListener('touchstart', _musicUnlock);
  }).catch(() => {
    // Navegador bloqueou autoplay — aguarda primeira interação
    document.addEventListener('click',      _musicUnlock, { once: true });
    document.addEventListener('keydown',    _musicUnlock, { once: true });
    document.addEventListener('touchstart', _musicUnlock, { once: true, passive: true });
  });
}

function _musicUnlock() {
  const audio  = document.getElementById('bg-music');
  const enabled = document.getElementById('chk-music')?.checked ?? true;
  if (audio && enabled && audio.paused) {
    audio.play().catch(() => {});
  }
  // Remove os outros listeners caso mais de um tenha sido registrado
  document.removeEventListener('click',      _musicUnlock);
  document.removeEventListener('keydown',    _musicUnlock);
  document.removeEventListener('touchstart', _musicUnlock);
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
  document.getElementById('chk-music').checked        = s.musicEnabled;
  document.getElementById('music-volume').value       = s.volume;
  document.getElementById('volume-pct').textContent   = s.volume + '%';

  // Aplica volume
  applyVolume(s.volume);

  // Tenta iniciar a música assim que a página carrega
  if (s.musicEnabled) {
    tryStartMusic(s.volume);
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
    if (enabled) {
      tryStartMusic(parseInt(document.getElementById('music-volume').value));
    } else {
      const audio = document.getElementById('bg-music');
      if (audio) audio.pause();
    }
  });

  // ── Slider de volume ──
  document.getElementById('music-volume').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    document.getElementById('volume-pct').textContent = v + '%';
    applyVolume(v);
    localStorage.setItem('s_volume', v);

    // Mexer no slider conta como interação — inicia se estiver pausada
    const audio = document.getElementById('bg-music');
    const enabled = document.getElementById('chk-music').checked;
    if (enabled && audio && audio.paused) {
      audio.play().catch(() => {});
    }
  });
});
