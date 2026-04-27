"""
image_validator.py — Validação segura de uploads de imagem.

Uso básico:
    from image_validator import validate_and_sanitize

    with open('user_upload.jpg', 'rb') as f:
        clean_bytes = validate_and_sanitize(f.read(), max_size_mb=5)
        # clean_bytes agora é uma imagem 100% limpa, pronta pra salvar.

Pip install:
    pip install Pillow filetype
"""

import io
import secrets
from typing import Tuple

import filetype
from PIL import Image, UnidentifiedImageError


# ═══════════════════════════════════════════════════
# Configurações
# ═══════════════════════════════════════════════════

# Apenas estes formatos são aceitos. SVG fica DE FORA porque pode ter JS embutido.
ALLOWED_FORMATS = {
    'jpg':  ('image/jpeg', 'JPEG'),
    'jpeg': ('image/jpeg', 'JPEG'),
    'png':  ('image/png',  'PNG'),
    'webp': ('image/webp', 'WEBP'),
    'gif':  ('image/gif',  'GIF'),
}

MAX_SIZE_MB_DEFAULT      = 5      # 5 MB por padrão
MAX_PIXELS               = 25_000_000   # 25 megapixels (anti-bomb decompressão)
MAX_DIMENSION            = 8000   # 8000px de largura ou altura


# ═══════════════════════════════════════════════════
# Exceção customizada
# ═══════════════════════════════════════════════════

class InvalidImageError(Exception):
    """Erro de validação — sempre é seguro mostrar a mensagem ao usuário."""
    pass


# ═══════════════════════════════════════════════════
# Pipeline de validação
# ═══════════════════════════════════════════════════

def validate_and_sanitize(
    raw_bytes: bytes,
    max_size_mb: float = MAX_SIZE_MB_DEFAULT,
) -> Tuple[bytes, str]:
    """
    Valida e re-encoda uma imagem enviada pelo usuário.

    Args:
        raw_bytes: bytes crus do upload
        max_size_mb: tamanho máximo permitido em MB

    Returns:
        (clean_bytes, filename) — bytes limpos e um filename aleatório seguro

    Raises:
        InvalidImageError: se qualquer camada de validação falhar
    """

    # ─── Camada 1: Tamanho ──────────────────────────
    size_mb = len(raw_bytes) / (1024 * 1024)
    if size_mb > max_size_mb:
        raise InvalidImageError(
            f'Arquivo muito grande: {size_mb:.1f}MB (máx: {max_size_mb}MB)'
        )
    if len(raw_bytes) < 100:
        raise InvalidImageError('Arquivo vazio ou inválido.')

    # ─── Camada 2: Magic bytes (detectar tipo real) ─
    kind = filetype.guess(raw_bytes)
    if kind is None:
        raise InvalidImageError('Não foi possível detectar o tipo do arquivo.')

    if kind.extension not in ALLOWED_FORMATS:
        raise InvalidImageError(
            f'Tipo não permitido: {kind.mime}. '
            f'Aceitos: {", ".join(ALLOWED_FORMATS.keys())}'
        )

    expected_mime, pil_format = ALLOWED_FORMATS[kind.extension]
    if kind.mime != expected_mime:
        raise InvalidImageError(f'MIME inconsistente: {kind.mime}')

    # ─── Camada 3: Carregar com Pillow (validação estrutural) ──
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img.verify()  # detecta corrupção sem decodificar tudo
        # verify() consome o stream, precisa reabrir pra usar depois
        img = Image.open(io.BytesIO(raw_bytes))
    except (UnidentifiedImageError, Exception) as e:
        raise InvalidImageError(f'Imagem corrompida: {e}')

    # ─── Camada 4: Limites de dimensões (anti-bomb) ──
    width, height = img.size
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise InvalidImageError(
            f'Dimensões muito grandes: {width}x{height} '
            f'(máx: {MAX_DIMENSION}x{MAX_DIMENSION})'
        )
    if width * height > MAX_PIXELS:
        raise InvalidImageError(
            f'Imagem muito densa: {width*height:,} pixels '
            f'(máx: {MAX_PIXELS:,})'
        )

    # ─── Camada 5: Re-encode (DESTRÓI payloads embutidos) ─────
    # Esse é o passo MAIS importante. Pillow decodifica e re-encoda
    # do zero, jogando fora qualquer dado extra (EXIF, comentários,
    # appendices polyglot, etc.)
    if img.mode in ('RGBA', 'LA', 'P') and pil_format == 'JPEG':
        # JPEG não suporta transparência → converte
        img = img.convert('RGB')

    output = io.BytesIO()
    save_kwargs = {'format': pil_format, 'optimize': True}
    if pil_format == 'JPEG':
        save_kwargs['quality'] = 90
        save_kwargs['progressive'] = True

    img.save(output, **save_kwargs)
    clean_bytes = output.getvalue()

    # ─── Camada 6: Filename aleatório ────────────────
    random_id = secrets.token_urlsafe(16)
    safe_filename = f'{random_id}.{kind.extension}'

    return clean_bytes, safe_filename


# ═══════════════════════════════════════════════════
# Exemplo de uso (Flask)
# ═══════════════════════════════════════════════════

if __name__ == '__main__':
    """
    Exemplo standalone — valida um arquivo passado via argv.
    Uso: python image_validator.py minha-foto.jpg
    """
    import sys

    if len(sys.argv) != 2:
        print('Uso: python image_validator.py <arquivo>')
        sys.exit(1)

    path = sys.argv[1]
    with open(path, 'rb') as f:
        raw = f.read()

    try:
        clean, filename = validate_and_sanitize(raw, max_size_mb=5)
        print(f'✅ Imagem válida.')
        print(f'   Tamanho original: {len(raw):,} bytes')
        print(f'   Tamanho limpo:    {len(clean):,} bytes')
        print(f'   Filename seguro:  {filename}')

        out_path = f'clean_{filename}'
        with open(out_path, 'wb') as f:
            f.write(clean)
        print(f'   Salvo em: {out_path}')

    except InvalidImageError as e:
        print(f'❌ Imagem rejeitada: {e}')
        sys.exit(1)
