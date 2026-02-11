#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

PDF_DIR = Path('pdf/s2')
OUT_MD = Path('result/C2E-S2.md')
TMP = Path('tmp/s2_hq')
TMP.mkdir(parents=True, exist_ok=True)

DAY_RE = re.compile(r"Day(\d+)\.Done\.pdf$")


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def ocr(img: Path, psm: int) -> str:
    p = subprocess.run(
        ["tesseract", str(img), "stdout", "-l", "chi_sim+eng", "--psm", str(psm)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=True,
    )
    return p.stdout


def extract_page(pdf: Path, page: int, out_png: Path, dpi: int = 260):
    pref = out_png.with_suffix('')
    run(["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-png", str(pdf), str(pref)])
    cand = Path(str(pref) + f"-{page}.png")
    alt = Path(str(pref) + "-1.png")
    if cand.exists():
        cand.rename(out_png)
    elif alt.exists():
        alt.rename(out_png)
    else:
        raise FileNotFoundError(cand)


def day_num(pdf: Path):
    m = DAY_RE.search(pdf.name)
    return int(m.group(1)) if m else None


def norm(s: str) -> str:
    s = s.replace("（", "(").replace("）", ")")
    s = s.replace("|", "I")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def clean_en(s: str) -> str:
    s = norm(s)
    s = re.sub(r"[^A-Za-z0-9\s,\'\"?.!;:\-()]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(" ,", ",").replace(" .", ".")
    if s and s[-1] not in ".?!":
        s += "."
    return s


def parse_questions(q_text: str):
    lines = [norm(x) for x in q_text.splitlines() if norm(x)]
    # Keep lines likely question content
    lines = [l for l in lines if (re.search(r"[\u4e00-\u9fff]", l) or '(' in l or ')' in l)]

    merged = " ".join(lines)
    merged = norm(merged)

    # split by keyword parentheses, which are stable in this material
    chunks = [m.group(1).strip() for m in re.finditer(r"(.+?\([A-Za-z/ .'-]+\))", merged)]

    out = {}
    idx = 1
    for ch in chunks:
        # remove leading noise before first Chinese char or leading numbering
        mzh = re.search(r"[\u4e00-\u9fff]", ch)
        if mzh:
            ch = ch[mzh.start():]
        ch = re.sub(r"^\s*[1-5][\.,。．、:：]?\s*", "", ch)
        ch = norm(ch)
        if ch and idx <= 5:
            out[idx] = ch
            idx += 1
        if idx > 5:
            break

    return out


def parse_answers(a_text: str):
    lines = [norm(x) for x in a_text.splitlines() if norm(x)]
    lines = [l for l in lines if re.search(r"[A-Za-z]", l) or re.match(r"^[1-5][\.,。．、:：]", l)]

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

    for l in lines:
        m = re.match(r"^([1-5])[\.,。．、:：]?\s*(.*)$", l)
        if m:
            flush()
            cur = int(m.group(1))
            rest = m.group(2).strip()
            buf = [rest] if rest else []
        elif cur is not None:
            if re.search(r"[A-Za-z]", l):
                buf.append(l)

    flush()

    # fallback: sentence segmentation if numbering not reliable
    if len(out) < 4:
        text = clean_en(" ".join(lines))
        sents = [s.strip() for s in re.split(r"(?<=[.?!])\s+", text) if s.strip()]
        out = {}
        for i, s in enumerate(sents[:5], 1):
            out[i] = s if s.endswith((".", "?", "!")) else s + "."

    return out


def pick_answer_text(pdf: Path, day: int):
    p2 = TMP / f"d{day}_p2.png"
    p3 = TMP / f"d{day}_p3.png"
    extract_page(pdf, 2, p2)
    extract_page(pdf, 3, p3)

    t2 = ocr(p2, 11)
    t3 = ocr(p3, 11)

    def score(t: str):
        s = 0
        s += 6 if "参考答案" in t else 0
        s += len(re.findall(r"\b(the|you|we|is|are|can|will|to|of|and|in|on)\b", t, re.I))
        s += 2 * len(re.findall(r"[1-5][\.,。．、:：]", t))
        s -= 5 * len(re.findall(r"今日考点|词汇", t))
        return s

    return t2 if score(t2) >= score(t3) else t3


def main():
    pdfs = [p for p in PDF_DIR.glob('*.pdf') if day_num(p) is not None]
    pdfs.sort(key=day_num)

    blocks = []
    for pdf in pdfs:
        d = day_num(pdf)
        qimg = TMP / f"d{d}_p1.png"
        extract_page(pdf, 1, qimg)

        q_text = ocr(qimg, 11)
        # second pass helps for some pages
        q_text2 = ocr(qimg, 6)
        a_text = pick_answer_text(pdf, d)
        a_text2 = a_text

        qmap = parse_questions(q_text)
        if len(qmap) < 4:
            qmap = parse_questions(q_text2)

        amap = parse_answers(a_text)
        if len(amap) < 4:
            amap = parse_answers(a_text2)

        nums = [n for n in range(1, 6) if n in qmap or n in amap]
        if not nums:
            nums = [1, 2, 3, 4, 5]

        lines = [f"### Day{d}", ""]
        for n in nums:
            lines.append(f"{n}. {qmap.get(n, '')}".rstrip())
            lines.append(f"  - {amap.get(n, '')}".rstrip())
        blocks.append("\n".join(lines))

    OUT_MD.write_text("\n\n".join(blocks) + "\n", encoding='utf-8')
    print(f"wrote {OUT_MD}")


if __name__ == '__main__':
    main()
