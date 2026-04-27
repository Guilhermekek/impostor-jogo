"""
cleanup_rooms.py — Limpeza periódica de salas no Firebase Realtime Database.

Roda LOCALMENTE pelo dono do projeto. Não é executado em CI/CD.

═══════════════════════════════════════════════════════════════
SETUP (uma vez)
═══════════════════════════════════════════════════════════════

1. Instala dependência:
       pip install firebase-admin

2. Gera service account JSON:
       Firebase Console → ⚙️ Configurações do projeto
       → Aba "Contas de serviço" → "Gerar nova chave privada"

3. Salva o arquivo baixado em:
       backend/service-account.json

   ⚠️ Este arquivo NUNCA deve ser commitado!
   Já está no .gitignore.

═══════════════════════════════════════════════════════════════
USO
═══════════════════════════════════════════════════════════════

# Modo dry-run (apenas LISTA o que seria apagado, não apaga nada)
python backend/cleanup_rooms.py

# Apaga de verdade (com confirmação interativa)
python backend/cleanup_rooms.py --delete

═══════════════════════════════════════════════════════════════
CRITÉRIOS DE LIMPEZA
═══════════════════════════════════════════════════════════════

Uma sala é marcada para limpeza quando:

  • state == 'gameOver' E age > 1 hora
        → partida acabou e ninguém fechou
  • state == 'lobby' E age > 24 horas
        → lobby abandonado (escapou do onDisconnect.remove())
  • Todos jogadores desconectados E age > 1 hora
        → ninguém ativo na sala
  • age > 7 dias (qualquer state)
        → garbage collector geral
"""

import sys
import time
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, db

# ═══════════════════════════════════════════════════
# Configuração
# ═══════════════════════════════════════════════════

SERVICE_ACCOUNT_PATH = Path(__file__).parent / 'service-account.json'
DATABASE_URL = 'https://impostorjogo-76625-default-rtdb.firebaseio.com'

# Critérios em milissegundos (timestamps do Firebase usam ms)
HOUR = 60 * 60 * 1000
DAY  = 24 * HOUR

CRITERIA = {
    'gameOver_old':       1 * HOUR,    # gameOver com mais de 1h → apaga
    'lobby_abandoned':    24 * HOUR,   # lobby com mais de 24h → apaga
    'all_disconnected':   1 * HOUR,    # ninguém conectado há +1h → apaga
    'any_old':            7 * DAY,     # qualquer sala com +7 dias → apaga
}


# ═══════════════════════════════════════════════════
# Inicialização
# ═══════════════════════════════════════════════════

def init_firebase():
    if not SERVICE_ACCOUNT_PATH.exists():
        print(f'❌ Service account não encontrado em: {SERVICE_ACCOUNT_PATH}')
        print()
        print('   Como gerar:')
        print('     1. Firebase Console → ⚙️ Configurações do projeto')
        print('     2. Aba "Contas de serviço"')
        print('     3. Botão "Gerar nova chave privada"')
        print(f'     4. Salvar como {SERVICE_ACCOUNT_PATH}')
        sys.exit(1)

    cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
    firebase_admin.initialize_app(cred, {'databaseURL': DATABASE_URL})


# ═══════════════════════════════════════════════════
# Análise
# ═══════════════════════════════════════════════════

def evaluate_room(code, data, now_ms):
    """Retorna o motivo (str) se a sala deve ser apagada, ou None."""
    config = (data or {}).get('config') or {}
    created_at = config.get('createdAt') or 0
    age = now_ms - created_at if created_at else float('inf')

    state = (data or {}).get('state', 'unknown')
    players = (data or {}).get('players') or {}
    connected = sum(1 for p in players.values() if (p or {}).get('isConnected'))

    if state == 'gameOver' and age > CRITERIA['gameOver_old']:
        return 'gameOver antigo (>1h)'
    if state == 'lobby' and age > CRITERIA['lobby_abandoned']:
        return 'lobby abandonado (>24h)'
    if age > CRITERIA['any_old']:
        return f'sala muito antiga (>{CRITERIA["any_old"] // DAY}d)'
    if not players:
        return 'sala sem jogadores'
    if connected == 0 and age > CRITERIA['all_disconnected']:
        return 'todos desconectados (>1h)'
    return None


def analyze_rooms():
    ref = db.reference('rooms')
    all_rooms = ref.get() or {}
    now_ms = int(time.time() * 1000)

    to_delete = []
    keep = []

    for code, data in all_rooms.items():
        info = {
            'code': code,
            'state': (data or {}).get('state', 'unknown'),
            'players_count': len((data or {}).get('players') or {}),
            'connected': sum(
                1 for p in ((data or {}).get('players') or {}).values()
                if (p or {}).get('isConnected')
            ),
            'age_h': (now_ms - ((data or {}).get('config') or {}).get('createdAt', 0)) / HOUR,
        }

        reason = evaluate_room(code, data, now_ms)
        if reason:
            info['reason'] = reason
            to_delete.append(info)
        else:
            keep.append(info)

    return to_delete, keep


# ═══════════════════════════════════════════════════
# Output
# ═══════════════════════════════════════════════════

def print_summary(to_delete, keep):
    total = len(to_delete) + len(keep)
    print('═══════════════════════════════════════════════')
    print(f'  LIMPEZA DE SALAS · IMPOSTOR JOGO')
    print(f'  {total} sala(s) no banco')
    print('═══════════════════════════════════════════════\n')

    if keep:
        print(f'✅ {len(keep)} ATIVAS (manter):')
        for r in sorted(keep, key=lambda x: x['age_h']):
            print(f'   {r["code"]:<6} state={r["state"]:<12} '
                  f'age={r["age_h"]:>6.1f}h  '
                  f'players={r["players_count"]:>2} '
                  f'conn={r["connected"]:>2}')
        print()

    if to_delete:
        print(f'🗑️  {len(to_delete)} MARCADAS pra apagar:')
        for r in sorted(to_delete, key=lambda x: -x['age_h']):
            print(f'   {r["code"]:<6} state={r["state"]:<12} '
                  f'age={r["age_h"]:>6.1f}h  '
                  f'conn={r["connected"]:>2}  → {r["reason"]}')
        print()
    else:
        print('🎉 Nada para limpar! Banco em ordem.\n')


def delete_rooms(to_delete):
    ref = db.reference('rooms')
    for r in to_delete:
        try:
            ref.child(r['code']).delete()
            print(f'   ✓ {r["code"]} apagada')
        except Exception as e:
            print(f'   ✗ {r["code"]} FALHOU: {e}')


# ═══════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════

def main():
    do_delete = '--delete' in sys.argv

    init_firebase()
    to_delete, keep = analyze_rooms()
    print_summary(to_delete, keep)

    if not to_delete:
        return

    if not do_delete:
        print('💡 Modo dry-run (não apagou nada).')
        print('   Para apagar de verdade:')
        print('     python backend/cleanup_rooms.py --delete')
        return

    confirm = input(f'Confirma deletar {len(to_delete)} sala(s)? Digite "SIM" pra confirmar: ').strip()
    if confirm != 'SIM':
        print('Cancelado.')
        return

    print(f'\nApagando {len(to_delete)} sala(s)...')
    delete_rooms(to_delete)
    print(f'\n✅ Limpeza concluída.')


if __name__ == '__main__':
    main()
