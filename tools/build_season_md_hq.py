#!/usr/bin/env python3
import argparse
import re
import subprocess
from pathlib import Path

DAY_RE = re.compile(r"Day(\d+)\.Done\.pdf$")
START_RE = re.compile(r"^\s*([1-5])[\s\.,。．、:：]*\s*(.*)$")


HDR_PATTERNS = [
    re.compile(r"中\s*译\s*英"),
    re.compile(r"每\s*日\s*一\s*练"),
    re.compile(r"Day\s*\d+", re.I),
    re.compile(r"参考答案"),
]


def day_from_name(name: str):
    m = DAY_RE.search(name)
    return int(m.group(1)) if m else None


def run(cmd):
    subprocess.run(cmd, check=True)


def ocr(path: Path, psm: int) -> str:
    p = subprocess.run(
        ["tesseract", str(path), "stdout", "-l", "chi_sim+eng", "--psm", str(psm)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=True,
    )
    return p.stdout


def extract_pdf_page(pdf: Path, out_png: Path, page: int, dpi: int):
    prefix = out_png.with_suffix("")
    run(["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-png", str(pdf), str(prefix)])
    cand = prefix.parent / f"{prefix.name}-{page}.png"
    alt = prefix.parent / f"{prefix.name}-1.png"
    if cand.exists():
        cand.rename(out_png)
    elif alt.exists():
        alt.rename(out_png)
    else:
        raise FileNotFoundError(str(cand))


def normalize_line(s: str) -> str:
    s = s.replace("（", "(").replace("）", ")")
    s = s.replace("|", "I")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def is_header_noise(line: str) -> bool:
    if not line:
        return True
    for p in HDR_PATTERNS:
        if p.search(line):
            return True
    # mostly symbols / low-information lines
    if re.fullmatch(r"[\W_一二三四五六七八九十0-9]{1,8}", line):
        return True
    return False


def parse_question_map(text: str):
    lines = [normalize_line(x) for x in text.splitlines()]
    lines = [x for x in lines if x and not is_header_noise(x)]

    items = {}
    cur = None
    buf = []

    def flush():
        nonlocal cur, buf
        if cur is None:
            return
        t = normalize_line(" ".join(buf))
        # strip leading junk before first Chinese char
        m = re.search(r"[\u4e00-\u9fff]", t)
        if m:
            t = t[m.start() :]
        # trim trailing OCR junk
        t = re.sub(r"\s+[A-Za-z]{1,2}$", "", t)
        if t:
            items[cur] = t
        cur = None
        buf = []

    for ln in lines:
        m = START_RE.match(ln)
        if m:
            flush()
            cur = int(m.group(1))
            rest = m.group(2).strip()
            buf = [rest] if rest else []
            continue

        if cur is not None:
            # keep meaningful lines for question
            if re.search(r"[\u4e00-\u9fff]", ln) or "(" in ln or ")" in ln:
                buf.append(ln)

    flush()

    # fallback: if parsing failed, try parenthesis chunks
    if len(items) < 4:
        merged = " ".join(lines)
        merged = normalize_line(merged)
        chunks = [m.group(1).strip() for m in re.finditer(r"(.+?\([^)]+\))", merged)]
        items = {}
        idx = 1
        for ch in chunks:
            m = START_RE.match(ch)
            if m:
                n = int(m.group(1))
                t = m.group(2).strip()
            else:
                n = idx
                t = ch
            mm = re.search(r"[\u4e00-\u9fff]", t)
            if mm:
                t = t[mm.start() :]
            t = normalize_line(t)
            if t and n not in items:
                items[n] = t
                idx += 1
            if len(items) == 5:
                break

    return items


def parse_answer_map(text: str):
    lines = [normalize_line(x) for x in text.splitlines()]
    # drop obvious noise lines
    keep = []
    for ln in lines:
        if not ln:
            continue
        if is_header_noise(ln):
            continue
        if re.search(r"[A-Za-z]", ln) or START_RE.match(ln):
            keep.append(ln)

    items = {}
    cur = None
    buf = []

    def flush():
        nonlocal cur, buf
        if cur is None:
            return
        t = normalize_line(" ".join(buf))
        t = re.sub(r"[^A-Za-z0-9\s,\'\"?.!;:\-()]+", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        # remove trailing tiny garbage tokens
        t = re.sub(r"\b([a-zA-Z]{1,2})\b\s*$", "", t).strip()
        if t and t[-1] not in ".?!":
            t += "."
        if t:
            items[cur] = t
        cur = None
        buf = []

    for ln in keep:
        m = START_RE.match(ln)
        if m:
            flush()
            cur = int(m.group(1))
            rest = m.group(2).strip()
            buf = [rest] if rest else []
            continue
        if cur is not None:
            if re.search(r"[A-Za-z]", ln):
                buf.append(ln)

    flush()
    return items


def choose_answer_text(pdf: Path, tmp: Path, day: int, dpi: int):
    p2 = tmp / f"d{day}_p2.png"
    p3 = tmp / f"d{day}_p3.png"
    txt2 = txt3 = ""

    try:
        extract_pdf_page(pdf, p2, 2, dpi)
        txt2 = ocr(p2, 11)
    except Exception:
        pass

    try:
        extract_pdf_page(pdf, p3, 3, dpi)
        txt3 = ocr(p3, 11)
    except Exception:
        pass

    def score(t: str):
        if not t:
            return -999
        s = 0
        s += 6 if "参考答案" in t else 0
        s += len(re.findall(r"\b(the|you|we|is|are|can|will|to|of)\b", t, re.I))
        s += len(re.findall(r"[1-5][\.,。．、:]", t)) * 2
        s -= len(re.findall(r"今日考点|词汇", t)) * 5
        return s

    return txt2 if score(txt2) > score(txt3) else txt3


def merge_maps(a: dict, b: dict):
    out = dict(a)
    for k, v in b.items():
        if k not in out or len(out[k]) < len(v):
            out[k] = v
    return out


def build(input_dir: Path, output_md: Path, season_tag: str, dpi: int):
    pdfs = [p for p in input_dir.glob("*.pdf") if day_from_name(p.name) is not None]
    pdfs.sort(key=lambda p: day_from_name(p.name))

    tmp = Path("tmp/hq_ocr") / season_tag.lower()
    tmp.mkdir(parents=True, exist_ok=True)

    blocks = []
    for pdf in pdfs:
        day = day_from_name(pdf.name)
        q = tmp / f"d{day}_p1.png"
        extract_pdf_page(pdf, q, 1, dpi)

        q11 = parse_question_map(ocr(q, 11))
        q6 = parse_question_map(ocr(q, 6))
        qmap = merge_maps(q11, q6)

        atxt = choose_answer_text(pdf, tmp, day, dpi)
        amap11 = parse_answer_map(atxt)

        # second pass for answer with psm6 by re-running selected answer page
        # select page by rescoring again
        a_page = tmp / f"d{day}_ans.png"
        # rough: if p2 map has more entries then use p2 otherwise p3
        p2 = tmp / f"d{day}_p2.png"
        p3 = tmp / f"d{day}_p3.png"
        src = p2 if p2.exists() and (not p3.exists() or len(parse_answer_map(ocr(p2,11))) >= len(parse_answer_map(ocr(p3,11)))) else p3
        if src.exists():
            a_page.write_bytes(src.read_bytes())
            amap6 = parse_answer_map(ocr(a_page, 6))
            amap = merge_maps(amap11, amap6)
        else:
            amap = amap11

        nums = sorted(set(qmap.keys()) & set(amap.keys()))
        if len(nums) < 5:
            nums = sorted(set(qmap.keys()) | set(amap.keys()))[:5]

        lines = [f"### Day{day}", ""]
        for n in nums:
            qline = qmap.get(n, "")
            aline = amap.get(n, "")
            lines.append(f"{n}. {qline}")
            lines.append(f"  - {aline}")
        blocks.append("\n".join(lines).rstrip())

    output_md.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", required=True)
    ap.add_argument("--output-md", required=True)
    ap.add_argument("--season-tag", required=True)
    ap.add_argument("--dpi", type=int, default=220)
    args = ap.parse_args()
    build(Path(args.input_dir), Path(args.output_md), args.season_tag, args.dpi)


if __name__ == "__main__":
    main()
