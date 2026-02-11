# PDF -> Markdown workflow (C2E)

## 1) Extract page images from PDFs
```bash
python3 tools/extract_pdf_image_pages.py --input pdf --output tmp/extracted_pages
```

## 2) Open question/answer pages for transcription
- Question page: `*.p1.jpg`
- Answer page: `*.p3.jpg`

## 3) Write per-day markdown to `result/DayX.md`
Format aligns with `case/C2E-S2.md`:
- `### DayX`
- numbered Chinese sentence
- bullet English answer

## 4) Merge all days
```bash
bash tools/merge_day_markdown.sh result result/C2E-S1.md
```
