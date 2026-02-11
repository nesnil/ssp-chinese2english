#!/usr/bin/env python3
import argparse
import re
import subprocess
from pathlib import Path

DAY_RE = re.compile(r"Day(\d+)\.Done\.pdf$")
ITEM_START_RE = re.compile(r"^\s*[^0-9]{0,6}([1-9])\s*[\.。．、:]\s*(.*)$")


def run(cmd):
    return subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def ocr_image(img_path: Path) -> str:
    proc = subprocess.run(
        ["tesseract", str(img_path), "stdout", "-l", "chi_sim+eng", "--psm", "6"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=True,
    )
    return proc.stdout


def split_items(text: str):
    items = []
    cur_num = None
    cur_text = []

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if len(line) <= 1:
            continue

        m = ITEM_START_RE.match(line)
        if m:
            if cur_num is not None:
                items.append((cur_num, " ".join(cur_text).strip()))
            cur_num = int(m.group(1))
            cur_text = [m.group(2).strip()]
            continue

        if cur_num is not None:
            cur_text.append(line)

    if cur_num is not None:
        items.append((cur_num, " ".join(cur_text).strip()))

    # de-dup by number; keep first appearance
    dedup = {}
    for n, t in items:
        if n not in dedup and t:
            dedup[n] = t
    return [(n, dedup[n]) for n in sorted(dedup.keys())]


def clean_question(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("（", "(").replace("）", ")")
    s = re.sub(r"\s*\(\s*", " (", s)
    s = re.sub(r"\s*\)\s*", ")", s)
    s = s.replace(" :", ":")
    return s


def clean_answer(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("|", "I")
    s = s.replace(" ,", ",")
    s = s.replace(" .", ".")
    return s


def day_from_name(name: str):
    m = DAY_RE.search(name)
    return int(m.group(1)) if m else None


def build(input_dir: Path, output_md: Path, season_tag: str):
    pdfs = [p for p in input_dir.glob("*.pdf") if day_from_name(p.name) is not None]
    pdfs.sort(key=lambda p: day_from_name(p.name))

    tmp_root = Path("tmp/ocr_pages") / season_tag.lower()
    tmp_root.mkdir(parents=True, exist_ok=True)

    chunks = []

    for pdf in pdfs:
        day = day_from_name(pdf.name)
        prefix = tmp_root / f"day{day}"

        for old in tmp_root.glob(f"day{day}-*.png"):
            old.unlink()

        subprocess.run(["pdftoppm", "-r", "300", "-png", str(pdf), str(prefix)], check=True)
        pages = sorted(tmp_root.glob(f"day{day}-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
        if not pages:
            continue

        ocr_texts = [ocr_image(p) for p in pages]

        q_idx = 0
        ans_idx = None
        for i, t in enumerate(ocr_texts):
            if i == q_idx:
                continue
            if "参考答案" in t or "参考答" in t:
                ans_idx = i
                break
        if ans_idx is None:
            ans_idx = 2 if len(ocr_texts) >= 3 else len(ocr_texts) - 1

        q_items = split_items(ocr_texts[q_idx])
        a_items = split_items(ocr_texts[ans_idx])

        q_map = {n: clean_question(t) for n, t in q_items}
        a_map = {n: clean_answer(t) for n, t in a_items}
        nums = sorted(set(q_map.keys()) & set(a_map.keys()))

        if not nums:
            nums = sorted(q_map.keys() or a_map.keys())

        lines = [f"### Day{day}", ""]
        for n in nums:
            q = q_map.get(n, "")
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
    args = ap.parse_args()
    build(Path(args.input_dir), Path(args.output_md), args.season_tag)


if __name__ == "__main__":
    main()
