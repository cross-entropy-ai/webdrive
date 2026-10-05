"""Generate the PWA's folder icons using only the Python standard library."""
from pathlib import Path
import struct
import zlib

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"


def rounded(x, y, left, top, right, bottom, radius):
    cx = max(left + radius, min(x, right - radius))
    cy = max(top + radius, min(y, bottom - radius))
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def color(x, y):
    # All folder details fit inside the maskable icon's central safe circle.
    if rounded(x, y, 25, 38, 75, 69, 5):
        return (255, 255, 255)
    if rounded(x, y, 25, 30, 48, 49, 4) or rounded(x, y, 25, 35, 75, 65, 5):
        return (174, 191, 255)
    return (66, 99, 235)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def generate(size):
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)  # PNG filter: none
        for x in range(size):
            samples = [color((x + dx) * 100 / size, (y + dy) * 100 / size)
                       for dx in (.25, .75) for dy in (.25, .75)]
            pixels.extend(sum(sample[c] for sample in samples) // 4 for c in range(3))
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(pixels, 9)) + chunk(b"IEND", b"")
    (OUT / f"icon-{size}.png").write_bytes(data)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        generate(size)
