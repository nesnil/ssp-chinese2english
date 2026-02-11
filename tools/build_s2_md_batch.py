#!/usr/bin/env python3
import argparse
import re
import subprocess
from pathlib import Path

DAY_RE = re.compile(r"Day(\d+)\.Done\.pdf$")
START_RE = re.compile(r"^\s*([1-5])[\s\.,。．、:：)]*\s*(.*)$")


HDR_PATTERNS = [
    re.compile(r"中\s*译\s*英"),
    re.compile(r"每\s*日\s*一\s*练"),
    re.compile(r"Day\s*\d+", re.I),
    re.compile(r"参考答案"),
    re.compile(r"今日考点"),
    re.compile(r"词汇"),
]


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ocr(img: Path, lang: str, psm: int) -> str:
    try:
        p = subprocess.run(
            ["tesseract", str(img), "stdout", "-l", lang, "--psm", str(psm)],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            check=True,
        )
        return p.stdout
    except subprocess.CalledProcessError:
        return ""


def extract_page(
    pdf: Path,
    page: int,
    out_png: Path,
    dpi: int = 210,
    crop_x: int | None = None,
    crop_y: int | None = None,
    crop_w: int | None = None,
    crop_h: int | None = None,
    gray: bool = True,
):
    out_png.parent.mkdir(parents=True, exist_ok=True)
    pref = out_png.with_suffix("")
    cmd = ["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page)]
    if gray:
        cmd.append("-gray")
    if None not in (crop_x, crop_y, crop_w, crop_h):
        cmd += ["-x", str(crop_x), "-y", str(crop_y), "-W", str(crop_w), "-H", str(crop_h)]
    cmd += ["-png", str(pdf), str(pref)]
    run(cmd)
    cand = Path(str(pref) + f"-{page}.png")
    alt = Path(str(pref) + "-1.png")
    if cand.exists():
        cand.replace(out_png)
        return True
    if alt.exists():
        alt.replace(out_png)
        return True
    return False


def day_num(pdf: Path):
    m = DAY_RE.search(pdf.name)
    return int(m.group(1)) if m else None


def norm(s: str) -> str:
    s = s.replace("（", "(").replace("）", ")")
    s = s.replace("【", "(").replace("】", ")")
    s = s.replace("|", "I")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def clean_question_text(s: str) -> str:
    s = norm(s)
    m = re.search(r"[\u4e00-\u9fff]", s)
    if m:
        s = s[m.start() :]
    if "(" in s and ")" in s and s.rfind(")") > s.find("("):
        s = s[: s.rfind(")") + 1]

    out = []
    in_paren = False
    for ch in s:
        if ch == "(":
            in_paren = True
            out.append(ch)
            continue
        if ch == ")":
            in_paren = False
            out.append(ch)
            continue
        if in_paren:
            if re.match(r"[A-Za-z0-9/ .'-]", ch):
                out.append(ch)
            continue
        if re.match(r"[\u4e00-\u9fff0-9，。！？、；：,.?!:;\s]", ch):
            out.append(ch)
    s = "".join(out)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_noise(line: str) -> bool:
    if not line:
        return True
    for p in HDR_PATTERNS:
        if p.search(line):
            return True
    return False


def parse_questions(text: str):
    lines = [norm(x) for x in text.splitlines()]
    lines = [x for x in lines if x and not is_noise(x)]

    out = {}
    cur = None
    buf = []

    def flush():
        nonlocal cur, buf
        if cur is None:
            return
        t = norm(" ".join(buf))
        m = re.search(r"[\u4e00-\u9fff]", t)
        if m:
            t = t[m.start():]
        t = re.sub(r"\s+[A-Za-z]{1,2}$", "", t)
        t = clean_question_text(t)
        if t:
            out[cur] = t
        cur = None
        buf = []

    for ln in lines:
        m = START_RE.match(ln)
        if m:
            flush()
            cur = int(m.group(1))
            rest = m.group(2).strip()
            buf = [rest] if rest else []
        elif cur is not None:
            if re.search(r"[\u4e00-\u9fff]", ln) or "(" in ln or ")" in ln:
                buf.append(ln)

    flush()

    if len(out) < 4:
        merged = norm(" ".join(lines))
        chunks = [m.group(1).strip() for m in re.finditer(r"(.+?\([A-Za-z/ .'-]+\))", merged)]
        out2 = {}
        idx = 1
        for ch in chunks:
            ch = re.sub(r"^\s*[1-5][\s\.,。．、:：)]*\s*", "", ch)
            m = re.search(r"[\u4e00-\u9fff]", ch)
            if m:
                ch = ch[m.start():]
            ch = clean_question_text(ch)
            if ch:
                out2[idx] = ch
                idx += 1
            if idx > 5:
                break
        if len(out2) > len(out):
            out = out2

    if len(out) < 4:
        out3 = {}
        buf = []
        idx = 1
        for ln in lines:
            if re.search(r"[\u4e00-\u9fff]", ln) or "(" in ln or ")" in ln:
                buf.append(ln)
            if re.search(r"\([A-Za-z/ .'-]+\)", ln):
                t = norm(" ".join(buf))
                t = re.sub(r"^[^\\u4e00-\\u9fff]*", "", t)
                t = re.sub(r"^\\s*[1-5@Oo][\\s\\.,。．、:：)]*\\s*", "", t)
                t = clean_question_text(t)
                if t:
                    out3[idx] = t
                    idx += 1
                buf = []
            if idx > 5:
                break
        if len(out3) > len(out):
            out = out3

    return out


def clean_en(s: str) -> str:
    s = norm(s)
    s = re.sub(r"[^A-Za-z0-9\s,\'\"?.!;:\-()]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(" ,", ",").replace(" .", ".")
    keep_short = {"a", "i", "an", "am", "is", "it", "to", "of", "in", "on", "at", "by", "we", "he", "be", "or", "do"}
    parts = []
    for tok in s.split():
        w = re.sub(r"[^A-Za-z]", "", tok).lower()
        if w and len(w) <= 2 and w not in keep_short:
            continue
        parts.append(tok)
    s = " ".join(parts)
    s = re.sub(r"\b([A-Za-z]{1,2})\b\s*$", "", s).strip()
    if s and s[-1] not in ".?!":
        s += "."
    return s


def parse_answers(text: str):
    lines = [norm(x) for x in text.splitlines()]
    lines = [x for x in lines if x and not is_noise(x)]

    out = {}
    cur = None
    buf = []

    def flush():
        nonlocal cur, buf
        if cur is None:
            return
        t = clean_en(" ".join(buf))
        if t:
            out[cur] = t
        cur = None
        buf = []

    for ln in lines:
        m = START_RE.match(ln)
        if m:
            flush()
            cur = int(m.group(1))
            rest = m.group(2).strip()
            buf = [rest] if rest else []
        elif cur is not None:
            if re.search(r"[A-Za-z]", ln):
                buf.append(ln)

    flush()

    if len(out) < 4:
        merged = clean_en(" ".join(lines))
        chunks = re.split(r"\s*(?=[1-5][\.,])", merged)
        out2 = {}
        for ch in chunks:
            m = re.match(r"\s*([1-5])[\.,]\s*(.*)", ch)
            if not m:
                continue
            n = int(m.group(1))
            t = clean_en(m.group(2))
            if t:
                out2[n] = t
        if len(out2) > len(out):
            out = out2

    if len(out) < 4:
        eng_lines = [clean_en(x) for x in lines if re.search(r"[A-Za-z]", x)]
        eng_lines = [x for x in eng_lines if x and len(x.split()) >= 3]
        out3 = {}
        idx = 1
        for ln in eng_lines:
            if idx > 5:
                break
            if ln.lower().startswith("day ") or "daily" in ln.lower():
                continue
            out3[idx] = ln
            idx += 1
        if len(out3) > len(out):
            out = out3

    return out


def select_answer_text(pdf: Path, day: int, tmp: Path, dpi: int):
    p3 = tmp / f"d{day}_p3.png"
    p2 = tmp / f"d{day}_p2.png"

    t3 = ""
    if extract_page(pdf, 3, p3, dpi, crop_x=220, crop_y=780, crop_w=2050, crop_h=2300):
        t3 = ocr(p3, "eng+chi_sim", 6)

    # Prefer page 3; fallback to page 2 if page3 does not look like answer page.
    if ("参考答案" in t3) or (len(re.findall(r"[A-Za-z]", t3)) > 80):
        return t3

    t2 = ""
    if extract_page(pdf, 2, p2, dpi, crop_x=220, crop_y=780, crop_w=2050, crop_h=2300):
        t2 = ocr(p2, "eng+chi_sim", 6)

    if ("参考答案" in t2) or (len(re.findall(r"[A-Za-z]", t2)) > len(re.findall(r"[A-Za-z]", t3))):
        return t2
    return t3 or t2


def process_day(pdf: Path, tmp: Path, dpi: int):
    d = day_num(pdf)
    qimg = tmp / f"d{d}_p1.png"
    if not extract_page(pdf, 1, qimg, dpi, crop_x=220, crop_y=760, crop_w=2050, crop_h=2350):
        return d, {}, {}

    q_text = ocr(qimg, "chi_sim+eng", 4)
    qmap = parse_questions(q_text)
    if len(qmap) < 4:
        qmap2 = parse_questions(ocr(qimg, "chi_sim+eng", 11))
        if len(qmap2) > len(qmap):
            qmap = qmap2
    if len(qmap) < 4:
        qmap3 = parse_questions(ocr(qimg, "chi_sim+eng", 6))
        if len(qmap3) > len(qmap):
            qmap = qmap3

    a_text = select_answer_text(pdf, d, tmp, dpi)
    amap = parse_answers(a_text)
    if len(amap) < 4:
        # Re-run with sparse text mode for harder pages
        p = tmp / f"d{d}_ans_retry.png"
        src3 = tmp / f"d{d}_p3.png"
        src2 = tmp / f"d{d}_p2.png"
        src = src3 if src3.exists() else src2
        if src.exists():
            p.write_bytes(src.read_bytes())
            amap2 = parse_answers(ocr(p, "eng+chi_sim", 11))
            if len(amap2) > len(amap):
                amap = amap2
    if len(amap) < 4:
        p = tmp / f"d{d}_ans_retry2.png"
        src3 = tmp / f"d{d}_p3.png"
        src2 = tmp / f"d{d}_p2.png"
        src = src3 if src3.exists() else src2
        if src.exists():
            p.write_bytes(src.read_bytes())
            amap3 = parse_answers(ocr(p, "eng+chi_sim", 4))
            if len(amap3) > len(amap):
                amap = amap3

    return d, qmap, amap


def write_day_md(out_path: Path, day: int, qmap: dict, amap: dict):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    nums = [n for n in range(1, 6) if (n in qmap or n in amap)]
    if not nums:
        nums = [1, 2, 3, 4, 5]

    lines = [f"### Day{day}", ""]
    for n in nums:
        lines.append(f"{n}. {qmap.get(n, '')}".rstrip())
        lines.append(f"  - {amap.get(n, '')}".rstrip())

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def merge_days(day_dir: Path, out_md: Path):
    files = sorted(day_dir.glob("Day*.md"), key=lambda p: int(re.search(r"Day(\d+)", p.name).group(1)))
    blocks = [f.read_text(encoding="utf-8").strip() for f in files if f.read_text(encoding="utf-8").strip()]
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", default="pdf/s2")
    ap.add_argument("--tmp-dir", default="tmp/s2_batch")
    ap.add_argument("--day-dir", default="result/s2_days")
    ap.add_argument("--output", default="result/C2E-S2.md")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=999)
    ap.add_argument("--dpi", type=int, default=210)
    args = ap.parse_args()

    input_dir = Path(args.input_dir)
    tmp = Path(args.tmp_dir)
    day_dir = Path(args.day_dir)

    pdfs = [p for p in input_dir.glob("*.pdf") if day_num(p) is not None]
    pdfs.sort(key=day_num)

    for pdf in pdfs:
        d = day_num(pdf)
        if d < args.start or d > args.end:
            continue
        day_md = day_dir / f"Day{d}.md"
        d, qmap, amap = process_day(pdf, tmp, args.dpi)
        write_day_md(day_md, d, qmap, amap)
        print(f"done Day{d}: q={len(qmap)} a={len(amap)}")

    merge_days(day_dir, Path(args.output))
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
