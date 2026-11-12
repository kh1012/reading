// 읽을거리 정적 사이트를 dist/ 에 만든다. posts/<YYMMDD 제목>.md 하나가 글 하나다(CC Usage 가 하루에 하나씩 올린다).
// - dist/index.html 목록(최신순, 날짜 · 제목 · 한 줄 요약 · 분야 · 읽는 시간)
// - dist/p/<YYMMDD>-<제목 해시 8자>.html 글(목록 · 이전 · 다음, 본문, 댓글)
// - dist/p/assets/ 그림(글이 assets/<이름> 으로 부른다)
// 모양은 Plugin Builder 내려받기 페이지(검은 바탕 · Pretendard · JetBrains Mono · 개발 일지 목록 · 글 쪽)를 따른다.
// ```mermaid 블록은 브라우저에서 mermaid 11 이 그린다. 댓글은 giscus(GitHub Discussions, site.json 의 giscus 값이 있을 때만)
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Marked } from "marked";

const SITE = JSON.parse(readFileSync("site.json", "utf8"));
const POSTS = "posts";
const OUT = "dist";
const FILE = /^(\d{2})(\d{2})(\d{2}) (.+)\.md$/;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const slugOf = (name) => `${name.slice(0, 6)}-${createHash("sha1").update(name).digest("hex").slice(0, 8)}`;

/** 글 머리: "# YYMMDD 제목" 다음 "> 요약 · 분야: … · Baseline: … · 읽는 시간 약 N분" */
function parse(name, text) {
  const [, yy, mm, dd, rest] = FILE.exec(name);
  const lines = text.split("\n");
  let i = 0;
  let title = rest;
  if (/^#\s/.test(lines[0] ?? "")) {
    title = lines[0].replace(/^#\s+/, "").replace(/^\d{6}\s+/, "").trim() || rest;
    i = 1;
  }
  while (i < lines.length && !lines[i].trim()) i++;
  const quote = [];
  while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
  // "요약 · 분야: A · B · Baseline: … · 읽는 시간 약 N분". 분야 값 안에도 " · " 가 있어 이름(분야: · Baseline:)으로 자른다
  const q = quote.join(" ");
  const area = /·\s*분야:\s*(.+?)\s*(?:·\s*Baseline:|·\s*읽는 시간|$)/.exec(q)?.[1]?.trim() ?? "";
  const minutes = /읽는 시간\s*약?\s*(\d+)\s*분/.exec(q)?.[1] ?? "";
  const summary = (q.split(/\s*·\s*분야:/)[0] ?? "")
    .replace(/^한 줄 요약\s*:?\s*/, "")
    .replace(/\s*\[\d+(?:[,\s]+\d+)*\]/g, "")
    .trim();
  return {
    name,
    slug: slugOf(name),
    date: `20${yy}-${mm}-${dd}`,
    title,
    summary,
    area,
    minutes,
    body: lines.slice(i).join("\n"),
  };
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${esc(text)}</pre>\n`;
      return `<pre><code${lang ? ` class="lang-${esc(lang)}"` : ""}>${esc(text)}</code></pre>\n`;
    },
    // 본문 HTML 은 그리지 않고 글자 그대로(CC Usage 미리보기와 같다)
    html({ text }) {
      return esc(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const out = /^https?:/.test(href) ? ' target="_blank" rel="noreferrer"' : "";
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${out}>${label}</a>`;
    },
    image({ href, title, text }) {
      return `<figure><img src="${esc(href)}" alt="${esc(text)}" loading="lazy"${title ? ` title="${esc(title)}"` : ""}>${text ? `<figcaption>${esc(text)}</figcaption>` : ""}</figure>`;
    },
  },
});

const STYLE = `
:root {
  color-scheme: dark;
  --bg: #000; --field: #1a1a1a; --line: #1f1f1f; --line-strong: #2e2e2e; --line-hover: #454545;
  --ink: #ededed; --ink-2: #a0a0a0; --ink-3: #8f8f8f; --ok: #00ca52;
  --sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --gutter: 32px;
}
*, *::before, *::after { box-sizing: border-box; }
html { background: var(--bg); scrollbar-color: var(--line-strong) var(--bg); -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 1rem/1.6 var(--sans); letter-spacing: -0.005em; -webkit-font-smoothing: antialiased; word-break: keep-all; overflow-wrap: break-word; }
::selection { background: var(--ink); color: var(--bg); }
a { color: inherit; text-decoration: none; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: 6px; }
.wrap { max-width: 1152px; margin: 0 auto; padding: 0 var(--gutter); }
.read { max-width: 760px; }
.bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; background: var(--bg); border-bottom: 1px solid var(--line); }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; white-space: nowrap; }
.brand svg { width: 22px; height: 22px; }
.bar .slash { color: var(--line-hover); }
.bar .here { font-weight: 700; }
.bar .gh { margin-left: auto; color: var(--ink-2); font-size: 0.875rem; transition: color 0.15s; }
.bar .gh:hover, .bar .print:hover { color: var(--ink); }
.bar .print { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 8px; background: none; color: var(--ink-2); font: inherit; font-size: 0.875rem; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.bar .print:hover { border-color: var(--line-hover); }
.bar .print svg { width: 16px; height: 16px; }
.hero { padding: 56px 0 32px; }
.hero h1 { margin: 0; font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
.hero p { max-width: 34em; margin: 8px 0 0; color: var(--ink-2); font-size: 1.125rem; line-height: 1.45; }
.count { margin-top: 16px; color: var(--ink-3); font-family: var(--mono); font-size: 0.8125rem; }
.list { margin: 0 0 96px; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.list a { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; align-items: baseline; gap: 4px 24px; padding: 16px; border-bottom: 1px solid var(--line); transition: background-color 0.15s; }
.list a:hover { background: var(--field); }
.list .date { color: var(--ink-3); font-family: var(--mono); font-size: 0.8125rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.list .t { font-weight: 600; }
.list .s { display: block; margin-top: 2px; color: var(--ink-2); font-size: 0.875rem; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.list .m { color: var(--ink-3); font-size: 0.8125rem; white-space: nowrap; }
.nav { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0 8px; margin-top: 24px; padding-bottom: 12px; font-size: 0.875rem; }
.nav a, .nav .off { display: inline-flex; align-items: center; min-height: 32px; padding: 0 10px; border-radius: 6px; color: var(--ink-2); white-space: nowrap; transition: color 0.15s, background-color 0.15s; }
.nav a:hover { background: var(--field); color: var(--ink); }
.nav .back { margin-left: -10px; }
.nav .step { display: flex; gap: 4px; min-width: 0; }
.nav .step a { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.nav .off { opacity: 0.35; }
.top { padding: 20px 0; border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line-strong); }
.top h1 { margin: 0; font-size: 1.75rem; font-weight: 700; line-height: 1.35; letter-spacing: -0.02em; }
.top .sub { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; color: var(--ink-3); font-size: 0.875rem; }
.top .sub .date { font-family: var(--mono); font-size: 0.8125rem; }
.top .sum { margin: 12px 0 0; color: var(--ink-2); }
.doc { margin: 8px 0 0; line-height: 1.75; }
.doc h2 { margin: 56px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--line); font-size: 1.25rem; font-weight: 700; line-height: 1.4; letter-spacing: -0.01em; }
.doc h3 { margin: 32px 0 8px; font-size: 1.0625rem; font-weight: 600; }
.doc h4 { margin: 24px 0 8px; font-size: 1rem; font-weight: 600; color: var(--ink-2); }
.doc p, .doc ul, .doc ol, .doc table, .doc pre, .doc blockquote, .doc figure { margin: 0 0 16px; }
.doc ul, .doc ol { padding-left: 22px; }
.doc li { margin: 4px 0; }
.doc li::marker { color: var(--ink-3); }
.doc a { text-decoration: underline; text-decoration-color: var(--line-hover); text-underline-offset: 4px; }
.doc a:hover { text-decoration-color: var(--ink); }
.doc strong { font-weight: 600; }
.doc code { padding: 1px 5px; border-radius: 4px; background: var(--field); font-family: var(--mono); font-size: 0.875em; }
.doc pre { padding: 14px 16px; overflow-x: auto; border: 1px solid var(--line-strong); border-radius: 8px; background: #0b0b0b; line-height: 1.6; }
.doc pre code { padding: 0; background: none; font-size: 0.8125rem; }
.doc pre.mermaid { display: flex; justify-content: center; background: var(--field); font-family: var(--mono); font-size: 0.75rem; color: var(--ink-3); }
.doc blockquote { padding: 2px 16px; border-left: 2px solid var(--line-hover); color: var(--ink-2); }
.doc table { display: block; width: max-content; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 0.875rem; }
.doc th, .doc td { padding: 8px 12px; border: 1px solid var(--line-strong); vertical-align: top; text-align: left; }
.doc th { background: var(--field); font-weight: 600; }
.doc figure img { display: block; max-width: 100%; height: auto; margin: 0 auto; padding: 12px; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; }
.doc figcaption { margin-top: 6px; color: var(--ink-3); font-size: 0.8125rem; text-align: center; }
.doc hr { margin: 40px 0; border: 0; border-top: 1px solid var(--line); }
.talk { margin: 64px 0 96px; padding-top: 24px; border-top: 1px solid var(--line-strong); }
.talk h2 { margin: 0 0 16px; font-size: 1rem; font-weight: 600; }
.talk .none { color: var(--ink-3); font-size: 0.875rem; }
footer { padding: 24px 0 48px; color: var(--ink-3); font-size: 0.8125rem; }
@media print {
  :root { --bg: #fff; --field: #f4f4f5; --line: #e4e4e7; --line-strong: #d4d4d8; --line-hover: #a1a1aa; --ink: #111; --ink-2: #3f3f46; --ink-3: #52525b; }
  @page { size: A4; margin: 16mm 14mm; }
  body { font-size: 10.5pt; }
  .bar, .nav, .talk { display: none; }
  .wrap { max-width: none; padding: 0; }
  .doc a { text-decoration: none; }
  .doc pre { background: var(--field); white-space: pre-wrap; overflow: visible; }
  .doc pre, .doc figure, .doc table, .doc blockquote { break-inside: avoid; }
  .doc h2, .doc h3 { break-after: avoid; }
  .doc table { display: table; width: 100%; }
  .doc pre.mermaid { background: #fff; }
}
@media (max-width: 640px) {
  :root { --gutter: 16px; }
  .bar .print span { display: none; }
  .bar .slash, .bar .here { display: none; }
  .hero { padding-top: 32px; }
  .hero h1 { font-size: 1.5rem; }
  .list a { grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 14px 4px; }
  .top h1 { font-size: 1.375rem; }
  .nav .step a { max-width: 150px; }
}
`;

const FONTS =
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">' +
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap">';
/** 펼친 책 한 권(선 그림). 머리줄 · 탭 아이콘 */
const MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>';
const ICON = `data:image/svg+xml,${encodeURIComponent(MARK.replace('stroke="currentColor"', 'stroke="#ededed"'))}`;

/** 인쇄 단추(글 쪽 머리줄 오른쪽 위). 인쇄 모양은 STYLE 의 @media print(흰 바탕 · 머리줄 · 댓글 없이) */
const PRINT =
  '<button type="button" class="print" onclick="window.print()" aria-label="인쇄"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg><span>인쇄</span></button>';

const page = (title, desc, root, body, extra = "", tools = "") => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#000">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="${ICON}">
${FONTS}
<style>${STYLE}</style>
</head>
<body>
<header class="bar"><a class="brand" href="${root}">${MARK}<span>${esc(SITE.title)}</span></a>${extra}<a class="gh" href="https://github.com/${esc(SITE.repo)}" target="_blank" rel="noreferrer">GitHub</a>${tools}</header>
${body}
</body>
</html>
`;

const metaLine = (p) => [p.area, p.minutes && `읽는 시간 ${p.minutes}분`].filter(Boolean).join(" · ");

function listPage(posts) {
  const rows = posts
    .map((p) => `<li><a href="p/${p.slug}.html"><span class="date">${p.date}</span><span><span class="t">${esc(p.title)}</span>${p.summary ? `<span class="s">${esc(p.summary)}</span>` : ""}</span><span class="m">${esc(metaLine(p))}</span></a></li>`)
    .join("");
  const body =
    `<main class="wrap"><section class="hero"><h1>${esc(SITE.title)}</h1><p>${esc(SITE.lead)}</p><div class="count">글 ${posts.length}개 · 마지막 ${posts[0]?.date ?? "-"}</div></section>` +
    `<ul class="list">${rows}</ul></main>`;
  return page(SITE.title, SITE.lead, "./", body);
}

function giscus() {
  const g = SITE.giscus;
  if (!g?.repoId || !g?.categoryId) return `<p class="none">댓글은 준비 중입니다</p>`;
  return (
    `<script src="https://giscus.app/client.js" data-repo="${esc(SITE.repo)}" data-repo-id="${esc(g.repoId)}" data-category="${esc(g.category)}" data-category-id="${esc(g.categoryId)}"` +
    ` data-mapping="pathname" data-strict="1" data-reactions-enabled="1" data-emit-metadata="0" data-input-position="top" data-theme="dark" data-lang="ko" data-loading="lazy" crossorigin="anonymous" async></script>`
  );
}

function postPage(p, newer, older) {
  const step = (q, word) => (q ? `<a href="${q.slug}.html" title="${esc(q.title)}">${word} ${esc(q.title)}</a>` : `<span class="off">${word}</span>`);
  const sub = [`<span class="date">${p.date}</span>`, p.area && `<span>${esc(p.area)}</span>`, p.minutes && `<span>읽는 시간 ${p.minutes}분</span>`].filter(Boolean).join("");
  const body =
    `<main class="wrap read"><nav class="nav" aria-label="글 이동"><a class="back" href="../">‹ 목록</a><span class="step">${step(older, "이전")}${step(newer, "다음")}</span></nav>` +
    `<article><header class="top"><h1>${esc(p.title)}</h1><div class="sub">${sub}</div>${p.summary ? `<p class="sum">${esc(p.summary)}</p>` : ""}</header>` +
    `<div class="doc">${marked.parse(p.body)}</div></article>` +
    `<section class="talk" aria-label="댓글"><h2>댓글</h2>${giscus()}</section></main>` +
    `<script type="module">import m from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";const els=[...document.querySelectorAll("pre.mermaid")],src=els.map((e)=>e.textContent);const draw=async(theme)=>{m.initialize({startOnLoad:false,theme,securityLevel:"strict",fontFamily:getComputedStyle(document.body).fontFamily});els.forEach((e,i)=>{e.removeAttribute("data-processed");e.textContent=src[i];});await m.run({nodes:els});};draw("dark");addEventListener("beforeprint",()=>draw("default"));addEventListener("afterprint",()=>draw("dark"));</script>`;
  return page(`${p.title} · ${SITE.title}`, p.summary || p.title, "../", body, `<span class="slash" aria-hidden="true">/</span><span class="here">${esc(p.date)}</span>`, PRINT);
}

const names = existsSync(POSTS) ? readdirSync(POSTS).filter((n) => FILE.test(n)) : [];
const posts = names.map((n) => parse(n, readFileSync(`${POSTS}/${n}`, "utf8"))).sort((a, b) => b.name.localeCompare(a.name, "ko"));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p`, { recursive: true });
if (existsSync(`${POSTS}/assets`)) cpSync(`${POSTS}/assets`, `${OUT}/p/assets`, { recursive: true });
writeFileSync(`${OUT}/index.html`, listPage(posts));
posts.forEach((p, i) => writeFileSync(`${OUT}/p/${p.slug}.html`, postPage(p, posts[i - 1], posts[i + 1])));
writeFileSync(`${OUT}/.nojekyll`, "");
console.log(`읽을거리 ${posts.length}개 → ${OUT}/`);
