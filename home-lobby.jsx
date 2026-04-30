/* Home + Lobby screens for all 3 directions */

const Avatar = ({ name, accent = 'var(--accent)', size = 36 }) => {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: accent,
      color: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4,
      fontFamily: 'var(--font-ui)',
      flexShrink: 0,
      letterSpacing: 0,
    }}>{initial}</div>
  );
};

/* ═══════════════ NOIR: Home ═══════════════ */
const NoirHome = ({ compact = false }) => (
  <div className="screen-shell dir-noir grain vignette" style={{ padding: compact ? '32px 20px' : '56px 40px', justifyContent: 'center' }}>
    {/* faint case-file number */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--muted)' }}>
        CASO Nº 047 · CLASSIFICADO
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--muted)' }}>
          <span className="flicker" style={{ color: 'var(--danger)' }}>●</span> REC
        </div>
        <button aria-label="Perfil" title="Abrir dossiê" style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'oklch(0.78 0.14 75 / 0.10)',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, cursor: 'pointer', padding: 0,
          fontFamily: 'var(--font-display)',
        }}>🎩</button>
      </div>
    </div>

    <div className="fade-up" style={{ textAlign: 'center', marginBottom: 40 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.35em', marginBottom: 14 }}>
        ——— DOSSIÊ ———
      </div>
      <h1 className="display" style={{ fontSize: compact ? 56 : 88, lineHeight: 0.95, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
        O Impostor
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 12, fontStyle: 'italic', letterSpacing: '0.03em' }}>
        "Um está entre vocês. Descubra quem."
      </p>
    </div>

    <div style={{ maxWidth: 380, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Account chip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        <a style={{ flex: 1, textAlign: 'center', padding: '10px', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>👤 Entrar</a>
        <a style={{ flex: 1, textAlign: 'center', padding: '10px', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>＋ Criar conta</a>
      </div>

      <div>
        <label style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Identificação rápida (convidado)</label>
        <input className="input-n" placeholder="Seu nome de detetive" defaultValue="Rafael" />
      </div>
      <button className="btn-p" style={{ padding: '14px', fontSize: 13 }}>
        ▸ Abrir nova investigação
      </button>

      <div className="divider-n" style={{ margin: '12px 0' }}>ou</div>

      <div>
        <label style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Código do caso</label>
        <input className="input-n mono" placeholder="A B 3 C" style={{ textTransform: 'uppercase', letterSpacing: '0.5em', textAlign: 'center', fontSize: 22, fontWeight: 700, padding: '16px' }} />
      </div>
      <button className="btn-s" style={{ padding: '14px', fontSize: 13 }}>Entrar na investigação</button>

      <a style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 8, cursor: 'pointer', letterSpacing: '0.05em' }}>
        📖 <span style={{ borderBottom: '1px dashed var(--text-dim)' }}>Como jogar?</span>
      </a>
    </div>

    <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.3em' }}>
      🕵️ PROTOCOLO·ALPHA·3 · USO·RESTRITO
    </div>
  </div>
);

/* ═══════════════ NOIR: Lobby ═══════════════ */
const NoirLobby = ({ compact = false }) => {
  const players = [
    { name: 'Rafael', host: true },
    { name: 'Marina', host: false },
    { name: 'Lucas', host: false },
    { name: 'Beatriz', host: false },
    { name: 'João', host: false },
  ];
  return (
    <div className="screen-shell dir-noir grain" style={{ padding: compact ? '24px 20px' : '40px 32px', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button className="btn-s" style={{ padding: '6px 12px', fontSize: 12 }}>← Voltar</button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)' }}>
          SALA DE ESPERA
        </div>
      </div>

      {/* Case code */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>
          Código de acesso
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          padding: '18px 28px',
          border: '1px dashed var(--accent)',
          background: 'oklch(0.78 0.14 75 / 0.05)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div className="mono" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '0.4em', color: 'var(--accent)', paddingLeft: '0.4em' }}>
            7K9M
          </div>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>📋</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, fontStyle: 'italic' }}>
          Compartilhe com os suspeitos
        </div>
      </div>

      {/* Players list */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
            Suspeitos · {players.length}/10
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>
            <span className="pulse">●</span> ao vivo
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {players.map((p, i) => (
            <div key={i} className="fade-up" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              animationDelay: `${i * 0.05}s`,
            }}>
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', width: 18 }}>{String(i+1).padStart(2, '0')}</div>
              <Avatar name={p.name} />
              <div style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{p.name}</div>
              {p.host && (
                <div style={{ fontSize: 9, letterSpacing: '0.2em', padding: '3px 8px', border: '1px solid var(--accent)', color: 'var(--accent)', textTransform: 'uppercase', borderRadius: 2 }}>
                  Narrador
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: 18,
        borderRadius: 'var(--radius-lg)',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 14 }}>
          ◆ Parâmetros da Investigação
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Categoria</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Conjunto de palavras</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Cinema ▾</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Impostores</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Quantos agentes infiltrados</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>1 ▾</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Palavra similar</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Impostor recebe dica</div>
            </div>
            <div style={{
              width: 40, height: 22, background: 'var(--accent)', borderRadius: 11, position: 'relative',
            }}>
              <div style={{ position: 'absolute', width: 18, height: 18, background: 'var(--bg)', borderRadius: '50%', top: 2, right: 2 }} />
            </div>
          </div>
        </div>
      </div>

      <button className="btn-p" style={{ padding: 16, fontSize: 14, width: '100%' }}>
        ▸ Iniciar Investigação
      </button>
    </div>
  );
};

Object.assign(window, { NoirHome, NoirLobby, Avatar });
