#!/usr/bin/env python3
import argparse
import re
import subprocess
from pathlib import Path

DAY_RE = re.compile(r"Day(\d+)\.Done\.pdf$")


def day_from_name(name: str):
    m = DAY_RE.search(name)
    return int(m.group(1)) if m else None


def run(cmd):
    subprocess.run(cmd, check=True)


def ocr(path: Path, psm: int = 11) -> str:
    p = subprocess.run(
        ["tesseract", str(path), "stdout", "-l", "chi_sim+eng", "--psm", str(psm)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=True,
    )
    return p.stdout


def extract_page(pdf: Path, out_png: Path, page_no: int, dpi: int):
    prefix = out_png.with_suffix("")
    run(["pdftoppm", "-r", str(dpi), "-f", str(page_no), "-l", str(page_no), "-png", str(pdf), str(prefix)])
    cand = prefix.parent / f"{prefix.name}-{page_no}.png"
    alt = prefix.parent / f"{prefix.name}-1.png"
    if cand.exists():
        cand.rename(out_png)
    elif alt.exists():
        alt.rename(out_png)
    else:
        raise FileNotFoundError(str(cand))


def clean_spaces(s: str) -> str:
    s = s.replace("（", "(").replace("）", ")")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_questions(text: str):
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    keep = []
    for ln in lines:
        if re.search(r"[\u4e00-\u9fff]", ln) or "(" in ln or ")" in ln:
            keep.append(ln)
    if not keep:
        return {}

    merged = " ".join(keep)
    merged = clean_spaces(merged)

    segs = [m.group(1).strip() for m in re.finditer(r"(.+?\([^)]+\))", merged)]

    out = {}
    idx = 0
    for s in segs:
        # prefer explicit numbering
        m = re.match(r"^\s*([1-9])[\.,。．、:]?\s*(.*)$", s)
        if m:
            n = int(m.group(1))
            t = m.group(2).strip()
        else:
            idx += 1
            n = idx
            t = s
        # strip leading non-Chinese noise
        t = re.sub(r"^[^\u4e00-\u9fff]*(?=[\u4e00-\u9fff])", "", t)
        t = clean_spaces(t)
        if t and n not in out:
            out[n] = t
    return out


def parse_answers(text: str):
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # keep mostly english-ish lines
    kept = []
    for ln in lines:
        if re.search(r"[A-Za-z]", ln) or re.match(r"^[1-9][\.,。．、:]", ln):
            kept.append(ln)
    merged = " ".join(kept)
    merged = clean_spaces(merged)

    # normalize common OCR chars
    merged = merged.replace("|", "I")

    out = {}
    pat = re.compile(r"(?:^|\s)([1-9])[\.,。．、:]\s*(.+?)(?=(?:\s[1-9][\.,。．、:])|$)")
    for m in pat.finditer(merged):
        n = int(m.group(1))
        t = m.group(2)
        # keep ascii + common punctuation
        t = re.sub(r"[^A-Za-z0-9\s,'?.!;:\-()]+", " ", t)
        t = re.sub(r"\s+", " ", t).strip(" .") + "."
        if len(t) >= 3 and n not in out:
            out[n] = t

    if not out:
        # fallback: sentence split
        sents = re.split(r"(?<=[.?!])\s+", merged)
        n = 1
        for s in sents:
            s = re.sub(r"[^A-Za-z0-9\s,'?.!;:\-()]+", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            if len(s) < 8:
                continue
            out[n] = s if s.endswith(('.', '?', '!')) else s + '.'
            n += 1
            if n > 5:
                break
    return out


def build(input_dir: Path, output_md: Path, season_tag: str, dpi: int):
    pdfs = [p for p in input_dir.glob("*.pdf") if day_from_name(p.name) is not None]
    pdfs.sort(key=lambda p: day_from_name(p.name))

    tmp = Path("tmp/fast2") / season_tag.lower()
    tmp.mkdir(parents=True, exist_ok=True)

    blocks = []
    for pdf in pdfs:
        day = day_from_name(pdf.name)
        q = tmp / f"d{day}_q.png"
        a3 = tmp / f"d{day}_a3.png"
        a2 = tmp / f"d{day}_a2.png"

        extract_page(pdf, q, 1, dpi)
        # try p3 first
        answer_img = None
        try:
            extract_page(pdf, a3, 3, dpi)
            t3 = ocr(a3, 11)
            if ("参考答" in t3) or ("Everyone" in t3) or ("The " in t3):
                answer_img = a3
            else:
                answer_img = a3
        except Exception:
            pass
        # fallback to p2 for abnormal files
        if answer_img is None:
            try:
                extract_page(pdf, a2, 2, dpi)
                answer_img = a2
            except Exception:
                answer_img = a3

        q_text = ocr(q, 11)
        a_text = ocr(answer_img, 11)

        # if p3 clearly not answer, try p2
        if ("参考答" not in a_text) and ("Everyone" not in a_text) and ("The " not in a_text):
            try:
                extract_page(pdf, a2, 2, dpi)
                a2_text = ocr(a2, 11)
                if ("参考答" in a2_text) or ("Everyone" in a2_text) or ("The " in a2_text):
                    a_text = a2_text
            except Exception:
                pass

        q_map = parse_questions(q_text)
        a_map = parse_answers(a_text)

        nums = sorted(set(q_map.keys()) & set(a_map.keys()))
        if not nums:
            nums = sorted(q_map.keys())
        if not nums:
            nums = sorted(a_map.keys())

        lines = [f"### Day{day}", ""]
        for n in nums:
            lines.append(f"{n}. {q_map.get(n,'')}" )
            lines.append(f"  - {a_map.get(n,'')}" )

        blocks.append("\n".join(lines).rstrip())

    output_md.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


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
