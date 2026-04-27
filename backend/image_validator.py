"""
image_validator.py — Validação segura de uploads de ícone de usuário.

Esta versão é específica para AVATARES/ÍCONES de detetive:
- Saída sempre PNG 256x256 (forçado, não opcional)
- Aceita apenas JPEG, PNG e WebP estáticos (sem GIF, sem animações)
- 12 camadas de validação cobrindo magic bytes, decompression bombs,
  animações, perfis ICC, modos de cor inseguros e payloads embutidos.

Uso:
    from image_validator import validate_and_sanitize, InvalidImageError

    with open('user_upload.jpg', 'rb') as f:
        clean_bytes, filename = validate_and_sanitize(f.read())
        # clean_bytes é um PNG 256x256 limpo, pronto pra subir ao Firebase Storage.

Pip install:
    pip install Pillow filetype
"""

import io
import secrets
from typing import Tuple

import filetype
from PIL import Image, ImageOps, UnidentifiedImageError


# ═══════════════════════════════════════════════════
# Configurações
# ═══════════════════════════════════════════════════

# Apenas formatos seguros e modernos.
# - SVG fora: é XML, pode conter <script> (XSS)
# - GIF fora: deprecated, suporta animação (vetor de DoS)
# - BMP fora: sem compressão, pode estourar memória facilmente
# - TIFF fora: histórico de CVEs em decoders
ALLOWED_FORMATS = {
    'jpg':  ('image/jpeg', 'JPEG'),
    'jpeg': ('image/jpeg', 'JPEG'),
    'png':  ('image/png',  'PNG'),
    'webp': ('image/webp', 'WEBP'),
}

# Limites de entrada (antes do processamento)
MAX_SIZE_MB        = 5            # 5 MB no upload bruto
MAX_DIMENSION      = 8000         # 8000px de largura ou altura
MAX_PIXELS         = 25_000_000   # 25 megapixels (anti-decompression-bomb)
MIN_DIMENSION      = 32           # 32x32 mínimo (qualquer coisa menor é absurdo)

# Saída padronizada (não negociável)
ICON_SIZE          = (256, 256)   # tamanho final do ícone
OUTPUT_FORMAT      = 'PNG'        # PNG é lossless e universal
OUTPUT_EXTENSION   = 'png'

# Limite global do Pillow para detecção de decompression bombs.
# Pillow lança DecompressionBombError automaticamente acima de 2x esse valor.
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


# ═══════════════════════════════════════════════════
# Exceção customizada
# ═══════════════════════════════════════════════════

class InvalidImageError(Exception):
    """Erro de validação — sempre seguro mostrar a mensagem ao usuário."""
    pass


# ═══════════════════════════════════════════════════
# Pipeline de validação (12 camadas)
# ═══════════════════════════════════════════════════

def validate_and_sanitize(
    raw_bytes: bytes,
    max_size_mb: float = MAX_SIZE_MB,
) -> Tuple[bytes, str]:
    """
    Valida, recorta e re-encoda um upload para PNG 256x256.

    Returns:
        (clean_bytes, filename) — PNG 256x256 + nome aleatório seguro

    Raises:
        InvalidImageError — se qualquer camada de validação falhar.
        A mensagem é segura para exibir ao usuário (sem stacktraces).
    """

    # ─── Camada 1: Tamanho do upload ────────────────
    size_mb = len(raw_bytes) / (1024 * 1024)
    if size_mb > max_size_mb:
        raise InvalidImageError(
            f'Arquivo muito grande: {size_mb:.1f}MB (máx: {max_size_mb}MB)'
        )
    if len(raw_bytes) < 100:
        raise InvalidImageError('Arquivo vazio ou inválido.')

    # ─── Camada 2: Magic bytes (tipo real) ──────────
    # Detecta o tipo pelos primeiros bytes, NÃO pela extensão.
    # Bloqueia: malware.exe renomeado para foto.jpg
    kind = filetype.guess(raw_bytes)
    if kind is None:
        raise InvalidImageError('Não foi possível detectar o tipo do arquivo.')

    if kind.extension not in ALLOWED_FORMATS:
        raise InvalidImageError(
            f'Tipo não permitido: {kind.mime}. '
            f'Aceitos: {", ".join(sorted(set(ALLOWED_FORMATS.keys())))}'
        )

    expected_mime, expected_pil_format = ALLOWED_FORMATS[kind.extension]
    if kind.mime != expected_mime:
        raise InvalidImageError(f'MIME inconsistente: {kind.mime}')

    # ─── Camada 3: Validação estrutural (Pillow) ────
    # Verify() detecta corrupção e headers malformados sem decodificar pixels
    try:
        probe = Image.open(io.BytesIO(raw_bytes))
        probe.verify()
    except (UnidentifiedImageError, Image.DecompressionBombError) as e:
        raise InvalidImageError(f'Imagem inválida: {e}')
    except Exception as e:
        raise InvalidImageError(f'Imagem corrompida: {e}')

    # Verify consome o stream — reabrir para uso real
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        # Força o load aqui para detectar bombas
        img.load()
    except Image.DecompressionBombError:
        raise InvalidImageError('Imagem suspeita (decompression bomb).')
    except Exception as e:
        raise InvalidImageError(f'Falha ao carregar imagem: {e}')

    # ─── Camada 4: Pillow concorda com magic bytes? ──
    # Defesa extra: filetype e Pillow precisam concordar no formato
    if img.format and img.format.upper() != expected_pil_format:
        raise InvalidImageError(
            f'Formato inconsistente: filetype={expected_pil_format}, '
            f'pillow={img.format}'
        )

    # ─── Camada 5: Bloqueio de animação ─────────────
    # PNG (APNG) e WebP podem ser animados — não aceitamos pra ícone estático
    if getattr(img, 'is_animated', False) or getattr(img, 'n_frames', 1) > 1:
        raise InvalidImageError(
            'Imagens animadas não são permitidas (envie uma imagem estática).'
        )

    # ─── Camada 6: Limites de dimensão ──────────────
    width, height = img.size
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise InvalidImageError(
            f'Dimensões muito grandes: {width}x{height} '
            f'(máx: {MAX_DIMENSION}x{MAX_DIMENSION})'
        )
    if width * height > MAX_PIXELS:
        raise InvalidImageError(
            f'Imagem muito densa: {width*height:,} pixels (máx: {MAX_PIXELS:,})'
        )
    if width < MIN_DIMENSION or height < MIN_DIMENSION:
        raise InvalidImageError(
            f'Imagem muito pequena: {width}x{height} (mín: {MIN_DIMENSION}x{MIN_DIMENSION})'
        )

    # ─── Camada 7: Forçar modo de cor seguro ────────
    # Bloqueia: P (paleta — pode esconder cores fora do gamut),
    #          CMYK, LAB, YCbCr, I, F (modos exóticos sem necessidade)
    if img.mode not in ('RGB', 'RGBA', 'L', 'LA'):
        # Converte preservando alpha se existir
        target_mode = 'RGBA' if 'A' in img.mode or img.mode == 'P' else 'RGB'
        img = img.convert(target_mode)

    # ─── Camada 8: Strip de metadados ICC ───────────
    # Perfis ICC podem conter dados arbitrários (já houve CVE com isso)
    # Pillow os preserva por padrão no save() — removemos manualmente
    for key in ('icc_profile', 'exif', 'xmp', 'photoshop', 'iptc'):
        img.info.pop(key, None)

    # ─── Camada 9: Resize para ícone 256x256 ────────
    # ImageOps.fit faz crop centralizado mantendo aspect ratio,
    # garantindo que a imagem final tem EXATAMENTE 256x256.
    # LANCZOS é o filtro de melhor qualidade pra reduzir.
    img = ImageOps.fit(img, ICON_SIZE, method=Image.Resampling.LANCZOS)

    # Garante modo final adequado para PNG
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGBA')

    # ─── Camada 10: Re-encode (DESTRÓI payloads) ────
    # Esse é o passo mais importante: Pillow lê apenas pixels e cria
    # um arquivo novo do zero. Qualquer payload (EXIF, comentários,
    # appendices polyglot, malware embutido) é descartado aqui.
    output = io.BytesIO()
    img.save(
        output,
        format=OUTPUT_FORMAT,
        optimize=True,
        # Sem metadados, sem ICC profile, sem comentários
    )
    clean_bytes = output.getvalue()

    # ─── Camada 11: Validação do output ─────────────
    # Sanity check: o resultado tem que ser um PNG 256x256 válido
    try:
        check = Image.open(io.BytesIO(clean_bytes))
        check.verify()
        if check.size != ICON_SIZE:
            raise InvalidImageError(
                f'Saída inesperada: {check.size}, esperado {ICON_SIZE}'
            )
    except Exception as e:
        # Se chegou aqui, é bug nosso — não do usuário
        raise InvalidImageError(f'Erro interno na validação: {e}')

    # ─── Camada 12: Filename aleatório ──────────────
    # 16 bytes de entropia (~22 chars base64). Nunca usamos o nome
    # enviado pelo usuário (que pode conter ../, unicode malicioso, etc.)
    random_id = secrets.token_urlsafe(16)
    safe_filename = f'{random_id}.{OUTPUT_EXTENSION}'

    return clean_bytes, safe_filename


# ═══════════════════════════════════════════════════
# Teste standalone
# ═══════════════════════════════════════════════════

if __name__ == '__main__':
    """
    Uso:
        python image_validator.py minha-foto.jpg
        python image_validator.py uma-imagem-grande.png
        python image_validator.py um-pdf-renomeado.jpg   # deve rejeitar
    """
    import sys

    if len(sys.argv) != 2:
        print('Uso: python image_validator.py <arquivo>')
        sys.exit(1)

    path = sys.argv[1]
    try:
        with open(path, 'rb') as f:
            raw = f.read()
    except FileNotFoundError:
        print(f'❌ Arquivo não encontrado: {path}')
        sys.exit(1)

    try:
        clean, filename = validate_and_sanitize(raw, max_size_mb=5)
        print(f'✅ Imagem válida e sanitizada.')
        print(f'   Tamanho original: {len(raw):>10,} bytes')
        print(f'   Tamanho limpo:    {len(clean):>10,} bytes')
        print(f'   Resolução final:  {ICON_SIZE[0]}x{ICON_SIZE[1]} (PNG)')
        print(f'   Filename seguro:  {filename}')

        out_path = f'clean_{filename}'
        with open(out_path, 'wb') as f:
            f.write(clean)
        print(f'   Salvo em:         {out_path}')

    except InvalidImageError as e:
        print(f'❌ Imagem rejeitada: {e}')
        sys.exit(1)
