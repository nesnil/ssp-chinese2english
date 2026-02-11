#!/usr/bin/env python3
"""Extract embedded JPEG page images from PDF files.

Usage:
  python3 tools/extract_pdf_image_pages.py --input pdf --output tmp/extracted_pages
"""

from pathlib import Path
import argparse


def extract_images(pdf_path: Path, out_dir: Path) -> int:
    b = pdf_path.read_bytes()
    idx = 0
    pos = 0

    while True:
        s = b.find(b"stream", pos)
        if s == -1:
            break

        s2 = s + 6
        if s2 < len(b) and b[s2 : s2 + 2] == b"\r\n":
            data_start = s2 + 2
        elif s2 < len(b) and b[s2 : s2 + 1] in (b"\n", b"\r"):
            data_start = s2 + 1
        else:
            pos = s + 6
            continue

        e = b.find(b"endstream", data_start)
        if e == -1:
            break

        header = b[max(0, s - 600) : s]
        is_jpeg_image = b"/Subtype /Image" in header and b"/DCTDecode" in header
        if is_jpeg_image:
            raw = b[data_start:e]
            if raw.endswith(b"\r\n"):
                raw = raw[:-2]
            elif raw.endswith(b"\n") or raw.endswith(b"\r"):
                raw = raw[:-1]

            if raw.startswith(b"\xff\xd8"):
                idx += 1
                out_name = f"{pdf_path.stem}.p{idx}.jpg"
                (out_dir / out_name).write_bytes(raw)

        pos = e + 9

    return idx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="pdf", help="Input PDF directory")
    parser.add_argument("--output", default="tmp/extracted_pages", help="Output image directory")
    args = parser.parse_args()

    in_dir = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    for pdf in sorted(in_dir.glob("*.pdf")):
        n = extract_images(pdf, out_dir)
        print(f"{pdf.name} -> {n} jpg pages")


if __name__ == "__main__":
    main()
