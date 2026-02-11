#!/usr/bin/env python3
import argparse
import re
import subprocess
from pathlib import Path

DAY_RE = re.compile(r"Day(\d+)\.Done\.pdf$")
ITEM_START_RE = re.compile(r"^\s*[^0-9]{0,8}([1-9])\s*[\.。．、:]\s*(.*)$")


def day_from_name(name: str):
    m = DAY_RE.search(name)
    return int(m.group(1)) if m else None


def run(cmd):
    subprocess.run(cmd, check=True)


def ocr(path: Path) -> str:
    p = subprocess.run(
        ["tesseract", str(path), "stdout", "-l", "chi_sim+eng", "--psm", "6"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=True,
    )
    return p.stdout


def split_items(text: str):
    items = []
    cur_n, cur = None, []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or len(line) <= 1:
            continue
        m = ITEM_START_RE.match(line)
        if m:
            if cur_n is not None:
                items.append((cur_n, " ".join(cur).strip()))
            cur_n = int(m.group(1))
            cur = [m.group(2).strip()]
        elif cur_n is not None:
            cur.append(line)
    if cur_n is not None:
        items.append((cur_n, " ".join(cur).strip()))

    out = {}
    for n, t in items:
        if n not in out and t:
            out[n] = re.sub(r"\s+", " ", t).strip()
    return out


def extract_page(pdf: Path, out_png: Path, page_no: int, dpi: int):
    prefix = out_png.with_suffix("")
    run([
        "pdftoppm", "-r", str(dpi), "-f", str(page_no), "-l", str(page_no), "-png", str(pdf), str(prefix)
    ])
    generated = prefix.parent / f"{prefix.name}-{page_no}.png"
    if not generated.exists():
        # fallback (some versions still suffix -1 when single-page output)
        alt = prefix.parent / f"{prefix.name}-1.png"
        if alt.exists():
            alt.rename(out_png)
            return
        raise FileNotFoundError(generated)
    generated.rename(out_png)


def build(input_dir: Path, output_md: Path, season_tag: str, dpi: int):
    pdfs = [p for p in input_dir.glob("*.pdf") if day_from_name(p.name) is not None]
    pdfs.sort(key=lambda p: day_from_name(p.name))

    tmp = Path("tmp/fast_ocr") / season_tag.lower()
    tmp.mkdir(parents=True, exist_ok=True)

    chunks = []
    for pdf in pdfs:
        day = day_from_name(pdf.name)
        q_png = tmp / f"d{day}_q.png"
        a_png = tmp / f"d{day}_a.png"

        # page 1 = question; page 3 preferred as answer, fallback to page 2.
        extract_page(pdf, q_png, 1, dpi)
        try:
            extract_page(pdf, a_png, 3, dpi)
        except Exception:
            extract_page(pdf, a_png, 2, dpi)

        q_text = ocr(q_png)
        a_text = ocr(a_png)

        if "参考答" not in a_text and "参考答案" not in a_text:
            # swap fallback for documents where answer is on p2
            alt_png = tmp / f"d{day}_a2.png"
            extract_page(pdf, alt_png, 2, dpi)
            alt_text = ocr(alt_png)
            if "参考答" in alt_text or "参考答案" in alt_text:
                a_text = alt_text

        q_map = split_items(q_text)
        a_map = split_items(a_text)
        nums = sorted(set(q_map) & set(a_map))
        if not nums:
            nums = sorted(q_map.keys() or a_map.keys())

        lines = [f"### Day{day}", ""]
        for n in nums:
            q = q_map.get(n, "").replace("（", "(").replace("）", ")")
            a = a_map.get(n, "")
            lines.append(f"{n}. {q}")
            lines.append(f"  - {a}")
        chunks.append("\n".join(lines).rstrip())

    output_md.write_text("\n\n".join(chunks) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", required=True)
    ap.add_argument("--output-md", required=True)
    ap.add_argument("--season-tag", required=True)
    ap.add_argument("--dpi", type=int, default=180)
    args = ap.parse_args()
    build(Path(args.input_dir), Path(args.output_md), args.season_tag, args.dpi)


if __name__ == "__main__":
    main()
