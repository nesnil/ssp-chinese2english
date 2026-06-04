import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const startUrl = "http://zhixue.org/studydetail_50.html";
const outputDir = path.resolve("middle-school-wordlist/data");
const jsonPath = path.join(outputDir, "shanghai-zhongkao-vocab.json");
const csvPath = path.join(outputDir, "shanghai-zhongkao-vocab.csv");

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location &&
        redirects < 5
      ) {
        response.resume();
        resolve(fetchText(new URL(response.headers.location, url).toString(), redirects + 1));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${url}: HTTP ${response.statusCode}`));
        return;
      }

      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });

    request.setTimeout(30000, () => {
      request.destroy(new Error(`${url}: request timed out`));
    });
    request.on("error", reject);
  });
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function textContent(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractBlock(html, className) {
  const start = html.search(new RegExp(`<div[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>`, "i"));
  if (start === -1) return "";

  let cursor = start;
  let depth = 0;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = start;
  while (true) {
    const match = tagPattern.exec(html);
    if (!match) return html.slice(start);
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    cursor = tagPattern.lastIndex;
    if (depth === 0) return html.slice(start, cursor);
  }
}

function extractTitle(html) {
  const match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  return match ? textContent(match[1]) : "";
}

function extractNextUrl(html, currentUrl) {
  const chapter = extractBlock(html, "wznr-content-chapter");
  const match = chapter.match(/下一章：\s*<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const label = textContent(match[2]);
  if (!/^上海市中考英语考纲词汇表/.test(label)) return null;
  return new URL(match[1], currentUrl).toString();
}

function contentParagraphs(html) {
  const content = extractBlock(html, "wznr-content-con");
  const paragraphs = [];
  for (const match of content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = textContent(match[1])
      .replace(/\b([a-z])\s+\.\s+/gi, "$1. ")
      .replace(/\s+([,.;:])/g, "$1")
      .trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

const partOfSpeechPattern =
  /\b(?:abbr|adj|adv|art|aux|conj|det|int|interj|n|num|prep|pron|v|vi|vt)\s*\.?\b/i;

function firstPartOfSpeechIndex(text) {
  const match = text.match(partOfSpeechPattern);
  return match ? match.index : -1;
}

function cleanupHeadword(raw) {
  return raw
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .replace(/^[^A-Za-z]*(?=[A-Za-z])/, "")
    .replace(/[.;,，。:：]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addSplitVariants(set, value) {
  for (const part of value.split(/\s*(?:\/|=)\s*/)) {
    const cleaned = cleanupHeadword(part).replace(/^\(|\)$/g, "").trim();
    if (cleaned && /[A-Za-z]/.test(cleaned)) set.add(cleaned);
  }
}

function expandCompactVariant(value) {
  const match = value.match(/^([A-Za-z]+)\(([A-Za-z]+)\)([A-Za-z]+)$/);
  if (!match) return [];
  return [`${match[1]}${match[3]}`, `${match[1]}${match[2]}${match[3]}`];
}

function variantsForHeadword(headword) {
  const cleaned = cleanupHeadword(headword);
  if (!cleaned) return [];

  const variants = new Set();
  for (const variant of expandCompactVariant(cleaned)) variants.add(variant);
  if (variants.size === 0) {
    const base = cleanupHeadword(cleaned.replace(/\s*\([^)]*\)\s*$/g, ""));
    addSplitVariants(variants, base || cleaned);
  }

  const parenthetical = cleaned.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenthetical) {
    const inner = parenthetical[2].trim();
    if (/^=/.test(inner)) {
      addSplitVariants(variants, inner.replace(/^=/, ""));
    } else if (!/[,;]|\bpl\.?\b/i.test(inner)) {
      addSplitVariants(variants, inner);
    }
  }

  for (const variant of [...variants]) {
    if (/^the\s+/i.test(variant)) variants.add(variant.replace(/^the\s+/i, "").trim());
  }
  return [...variants].filter(Boolean);
}

function extractWordsFromPage(html, url) {
  const title = extractTitle(html);
  const words = [];

  for (const text of contentParagraphs(html)) {
    const posIndex = firstPartOfSpeechIndex(text);
    if (posIndex < 1) continue;

    const prefix = cleanupHeadword(text.slice(0, posIndex));
    if (!/[A-Za-z]/.test(prefix)) continue;
    if (/^(上海市|说明|表|words)$/i.test(prefix)) continue;

    const variants = variantsForHeadword(prefix);
    if (variants.length === 0) continue;
    words.push({
      word: variants[0],
      variants,
      sourceTitle: title,
      sourceUrl: url
    });
  }

  return words;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const pages = [];
  const seenUrls = new Set();
  let url = startUrl;

  while (url && !seenUrls.has(url)) {
    seenUrls.add(url);
    const html = await fetchText(url);
    const title = extractTitle(html);
    if (!/^上海市中考英语考纲词汇表/.test(title)) break;
    pages.push({ url, title, words: extractWordsFromPage(html, url) });
    url = extractNextUrl(html, url);
  }

  const byWord = new Map();
  for (const page of pages) {
    for (const entry of page.words) {
      for (const variant of entry.variants) {
        const key = variant.toLowerCase();
        if (!byWord.has(key)) {
          byWord.set(key, {
            word: variant,
            sourceWord: entry.word,
            sourceTitle: entry.sourceTitle,
            sourceUrl: entry.sourceUrl
          });
        }
      }
    }
  }

  const words = [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" }));
  const payload = {
    source: "zhixue.org 上海市中考英语考纲词汇表",
    startUrl,
    scrapedAt: new Date().toISOString(),
    pageCount: pages.length,
    totalWords: words.length,
    pages: pages.map((page) => ({
      title: page.title,
      url: page.url,
      wordCount: page.words.length
    })),
    words
  };

  const csv = [
    "word,source_word,source_title,source_url",
    ...words.map((entry) =>
      [entry.word, entry.sourceWord, entry.sourceTitle, entry.sourceUrl].map(csvEscape).join(",")
    )
  ].join("\n");

  await mkdir(outputDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${csv}\n`, "utf8");

  console.log(`Pages: ${payload.pageCount}`);
  console.log(`Words: ${payload.totalWords}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
