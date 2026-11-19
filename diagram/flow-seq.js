// 시퀀스 diagram(```diagram 의 "종류: 시퀀스", BD1-3 2026-11-16, BD1 문제 #3 "차례를 그릴 종류가 없다. 스윔레인 번호는 이야기 차례가 아니라 단 · DFS 차례"):
// 참여자는 세로 줄(왼쪽에서 오른쪽, 처음 나온 차례), 관계 줄을 적은 차례가 위에서 아래. 같은 참여자 여러 번 · 자기 호출(고리) · --> 돌아오는 답(점선) · ~> 외부 호출 · !! 강조.
// flow.js 의 memoFlowHtml 이 종류가 시퀀스면 flowSeqHtml 로 넘긴다. 카드 · 관계 문법은 flowParse 그대로 읽고(참여자 = 카드 머리 [이름], 메시지 = 관계 줄),
// 이 파일은 구간 줄(== 글 ==) · @폭 줄만 먼저 빼서 읽는다. 카드 글 · 묶음 영역 · 뱃지 · 곁 카드 · 꺾쇠 · 색 토큰은 flow.js 의 함수 · CSS 를 불러 쓴다.
// 아래 flowAlt* 는 데이터 모델(flow-model.js)도 같이 쓰는 틀(figure · 범례 · 꺾쇠 · 카드 · CSS)이다. flow.js 뒤, flow-model.js 앞에 읽는다.
// 순수 함수(flowSeqParse · flowSeqLayout · flowSeqFit)는 시험(web/flow-seq.test.mjs)이 vm 으로 읽는다.

// MARK: 공통 틀(시퀀스 · 데이터 모델)

/** 시퀀스 · 데이터 모델 CSS. 색 · 굵기는 flow.js 의 flowCss 토큰(--fl-*)을 쓴다(에디토리얼 · 어두운 판도 그대로 따른다) */
const FLOW_ALT_CSS = `
/* 시퀀스(flow-seq.js): 세로 줄 · 메시지 라벨 · 차례 번호 · 구간 줄 */
.fl-sq-life { stroke: var(--fl-line); stroke-width: 1; stroke-dasharray: 3 4; }
.fl-sq-lb { fill: var(--fl-bg); fill-opacity: 0.92; }
.fl-sq-t { fill: var(--fl-ink); font-size: 11px; }
.fl.ed .fl-sq-t { fill: var(--fl-soft); font-family: var(--fl-mono); font-size: 10px; }
.fl-sq-no circle { fill: var(--fl-ink); }
.fl-sq-no text { fill: var(--fl-bg); font-size: 9px; font-weight: 700; }
.fl-sq-m.hot .fl-sq-no circle { fill: var(--fl-hot); }
.fl-sq-m.hot .fl-sq-no text { fill: #1a1a1a; }
.fl-sq-div line { stroke: var(--fl-mute); stroke-width: 1; stroke-dasharray: 6 4; }
.fl-sq-div rect { fill: var(--fl-bg); stroke: var(--fl-line); stroke-width: 1; }
.fl-sq-div text { fill: var(--fl-ink); font-size: 11px; font-weight: 700; }
.fl.ed .fl-sq-div text { font-family: var(--fl-name); font-weight: 600; }
/* 데이터 모델(flow-model.js): 칸 표 · Key 표 · 차수 표 */
.fl-md-sep { stroke: var(--fl-line); stroke-width: 1; }
.fl-md-row.on { fill: color-mix(in srgb, var(--fl-link) 9%, transparent); }
.fl-md-f { fill: var(--fl-ink); font-size: 11px; }
.fl-md-ty { fill: var(--fl-mute); font-family: var(--fl-mono); font-size: 10px; }
.fl-md-key rect { fill: none; stroke: color-mix(in srgb, var(--fl-ink) 45%, transparent); stroke-width: 0.8; }
.fl-md-key text { fill: var(--fl-ink); font-family: var(--fl-mono); font-size: 8px; font-weight: 700; letter-spacing: 0.04em; }
.fl-md-key.pk rect { fill: color-mix(in srgb, var(--fl-cond) 22%, var(--fl-bg)); stroke: var(--fl-cond); }
.fl-md-key.fk rect { fill: color-mix(in srgb, var(--fl-link) 14%, var(--fl-bg)); stroke: color-mix(in srgb, var(--fl-link) 60%, var(--fl-bg)); }
.fl-md-c text { fill: var(--fl-ink); font-family: var(--fl-mono); font-size: 10px; font-weight: 700; }
.fl-md-c rect { fill: var(--fl-bg); fill-opacity: 0.92; }
.fl-md-l rect { fill: var(--fl-bg); fill-opacity: 0.92; }
.fl-md-l text { fill: var(--fl-mute); font-size: 10.5px; }
.fl.ed .fl-md-l text { font-family: var(--fl-mono); font-size: 10px; }
.fl-md-dot { fill: var(--fl-edge); }
.fl-md-dot.hot { fill: var(--fl-hot); }
`;

/** 시퀀스 · 데이터 모델 CSS 를 한 번 붙인다(HTML 내려받기는 문서의 모든 style 을 담는다) */
function flowAltStyle() {
  if (typeof document?.getElementById !== "function" || document.getElementById("fl-alt-style")) return;
  const st = document.createElement("style");
  st.id = "fl-alt-style";
  st.textContent = FLOW_ALT_CSS;
  document.head.append(st);
}

/** figure class(에디토리얼 · 어두운 판) · 못 읽은 줄(빨간 글). flow.js 의 memoFlowHtml 과 같은 꼴 */
function flowAltHead(g) {
  const cls = `fl${g.style === "editorial" ? ` ed${flowDark() ? " dk" : ""}` : ""}`;
  const errs = [...g.errors].sort((a, b) => a.line - b.line);
  const err = errs.length ? `<ul class="fl-err">${errs.map((x) => `<li>${x.line}째 줄을 읽지 못했습니다${x.why ? `(${esc(x.why)})` : ""}: ${esc(x.text)}</li>`).join("")}</ul>` : "";
  return { cls, err };
}

/** 카드가 없을 때(memoFlowHtml 과 같은 글) */
function flowAltEmpty(g, text, seq, cls, err, hint) {
  return `<figure class="${cls}" data-flow-block="${seq}" data-flow-hash="${flowHash(text)}">${g.title ? `<figcaption>${flowCapHtml(g.title)}</figcaption>` : ""}<p class="fl-b">${esc(hint)}</p>${err}</figure>\n`;
}

/**
 * 그림 figure 틀(memoFlowHtml 끝과 같은 꼴: 제목 · 확대 칸 · --fl-w 칸 폭 맞춤 · 인쇄 가로 쪽 · 못 읽은 줄). inner 는 svg 안.
 * min: 칸 폭 맞춤 하한(--fl-min, BD1-4). 손가락 기기 칸은 원래 크기의 이 배까지만 줄이고 더 넓으면 가로 스크롤(글이 읽히는 하한, 없으면 flow.js 의 0.5)
 */
function flowAltFigure(g, text, seq, cls, err, W, H, inner, min = null) {
  const svg = `<svg class="fl-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-w="${W}" data-h="${H}" role="img" aria-label="${esc(flowPlain(g.title) || "다이어그램")}">${inner}</svg>`;
  const wide = flowPrintWide(W, H);
  return `<figure class="${cls}${wide ? " wide" : ""}" data-flow-block="${seq}" data-flow-hash="${flowHash(text)}">${g.title ? `<figcaption>${flowCapHtml(g.title)}</figcaption>` : ""}<div class="fl-scroll"><div class="fl-stage" style="--fl-w: ${W}px${min ? `; --fl-min: ${min}` : ""}">${svg}</div></div>${err}</figure>\n`;
}

/**
 * 그림을 놓을 칸 폭 어림(BD1-4 "휴대폰 390 에서 시퀀스가 가로 스크롤"): 그릴 때의 화면 폭에서 메모 칸 여백(양쪽 29: 쪽 16 + 그림 틀 13)을 뺀다.
 * 시퀀스 · 데이터 모델의 기본 폭(@폭 을 적지 않을 때)이 이것을 받는다. 화면을 모르면(시험 · 서버) Infinity
 */
function flowAltColW() {
  try {
    const vw = (typeof document !== "undefined" && document?.documentElement?.clientWidth) || (typeof innerWidth === "number" ? innerWidth : 0);
    return vw > 0 ? Math.max(240, vw - 58) : Infinity;
  } catch {
    return Infinity;
  }
}

/** 꺾쇠 표식(flow.js 와 같은 꼴: 기본 · 굵은 · 외부 호출 · 강조, 끝 · 앞) */
function flowAltDefs(id) {
  const marker = (name, cls2, start) =>
    `<marker id="${id}-${name}" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="${cls2 === "bold" ? 15 : 13}" markerHeight="${cls2 === "bold" ? 15 : 13}" orient="${start ? "auto-start-reverse" : "auto"}" markerUnits="userSpaceOnUse"><path class="fl-ah${cls2 ? ` ${cls2}` : ""}" d="M3.5 0.5 L10.5 6 L3.5 11.5"/></marker>`;
  return `<defs>${marker("a", "", false)}${marker("ab", "bold", false)}${marker("al", "link", false)}${marker("ah", "hot", false)}${marker("s", "", true)}${marker("sb", "bold", true)}${marker("sl", "link", true)}${marker("sh", "hot", true)}</defs>`;
}
/** 화살표 → 선 꼴 { arrow, dash, bold, link, hot } */
const flowAltOp = (e) => ({ ...(FLOW_OPS[e.op] ?? FLOW_OPS["->"]), hot: Boolean(e.hot) });
const flowAltKey = (o) => (o.hot ? "h" : o.bold ? "b" : o.link ? "l" : "");
const flowAltEdgeCls = (o) => `fl-e${o.dash ? " dash" : ""}${o.bold ? " bold" : ""}${o.link ? " link" : ""}${o.hot ? " hot" : ""}`;
/** 선 끝 꺾쇠 속성 */
const flowAltEnds = (o, id) => `${o.arrow !== "none" ? ` marker-end="url(#${id}-a${flowAltKey(o)})"` : ""}${o.arrow === "both" ? ` marker-start="url(#${id}-s${flowAltKey(o)})"` : ""}`;

/** 범례 띠(그림 아래, memoFlowHtml 과 같은 꼴) → { svg, W, H }. used: 쓴 화살표들, opText: 범례: 켬 의 기본 뜻 */
function flowAltLegend(g, used, opText, focal, id, W0, H0) {
  const items = g.legend === true ? [...new Set(used)].map((op) => ({ op, text: opText[op] ?? FLOW_OP_TEXT[op] ?? op })) : Array.isArray(g.legend) ? [...g.legend] : [];
  if (g.legend && focal) items.push({ focal: true, text: "초점" });
  if (!items.length) return { svg: "", W: W0, H: H0 };
  const right = Math.max(W0, 320);
  let x = 52;
  let y = H0 + 22;
  const parts = [];
  for (const it of items) {
    const w = 34 + flowTextW(it.text, 10.5) + 18;
    if (x + w > right - 8) {
      x = 52;
      y += 20;
    }
    if (it.focal) parts.push(`<rect x="${x}" y="${y - 6}" width="24" height="12" rx="3" fill="var(--fl-accent-tint)" stroke="var(--fl-accent)" stroke-width="1.4"/>`);
    else {
      const o = flowAltOp({ op: it.op });
      parts.push(`<path class="${flowAltEdgeCls(o)}" d="M ${x} ${y} L ${x + 26} ${y}"${flowAltEnds(o, id)}/>`);
    }
    parts.push(`<text x="${x + 34}" y="${y + 3.5}">${esc(it.text)}</text>`);
    x += w;
  }
  return { svg: `<g class="fl-legend"><line class="rule" x1="8" y1="${H0 + 6}" x2="${right - 8}" y2="${H0 + 6}"/><text class="eye" x="8" y="${H0 + 25.5}">범례</text>${parts.join("")}</g>`, W: right, H: y + 16 };
}

/** 카드 머리 글 크기(flowMeasure 와 같은 글 · 여백, 글 폭 max). 시퀀스 참여자 머리 · 데이터 모델 표 머리가 쓴다 */
function flowAltMeasure(n, max, lines = n.lines) {
  const tagW = (n.tag ? flowTextW(n.tag, 8.5) + 12 : 0) + (n.link ? FLOW.linkW + (n.tag ? 6 : 0) : 0);
  const title = flowWrap(n.name, FLOW.title, max - tagW);
  const body = lines.flatMap((l) => {
    const dot = /^[-*]\s+/.test(l);
    const t = dot ? l.replace(/^[-*]\s+/, "") : l;
    return flowWrap(t, FLOW.body, max - (dot ? 12 : 0)).map((x, k) => ({ text: x, dot: dot && k === 0, indent: dot }));
  });
  const textW = Math.max(...title.map((t) => flowTextW(t, FLOW.title) + (tagW ? tagW + 8 : 0)), ...body.map((b) => flowTextW(b.text, FLOW.body) + (b.indent ? 12 : 0)), 40);
  const w = Math.ceil(textW + FLOW.padX * 2);
  const h = Math.ceil(FLOW.padY * 2 + title.length * FLOW.lh + (body.length ? 6 + body.length * FLOW.lh : 0) + (n.kind === "store" ? 6 : 0));
  return { title, body, w, h, tagW };
}

/**
 * 카드 하나(flow.js 의 카드 그리기와 같은 꼴: 종류마다 모서리 · 저장소 뚜껑 · #태그 · 링크 표시 · 초점). c: { name, kind, tag, focal, ref, link, title, body },
 * b: { x, y, w, h } 그림 좌표, A: 곁 카드로 민 양(data-box 는 미리보기 링크 복사 단추 자리), extra: 카드 안에 더 그릴 것(데이터 모델 칸 표)
 */
function flowAltCard(c, b, A, ed, extra = "") {
  const cls2 = `fl-n fl-${c.kind}${c.focal ? " focal" : ""}${c.link ? " has-link" : ""}`;
  const attrs = ` data-name="${esc(c.name)}" data-box="${b.x + A.dx} ${b.y + A.dy} ${b.w} ${b.h}"${c.ref ? ` data-ref="${c.ref}"` : ""}${c.link ? ` data-link="${c.link}"` : ""}`;
  const rx = c.kind === "start" || c.kind === "end" ? Math.min(b.h / 2, 18) : c.kind === "state" ? (ed ? 8 : 14) : c.kind === "ext" ? 2 : ed ? 6 : 8;
  const text = flowCardText(c, b.x, b.y + FLOW.padY + 12 + (c.kind === "store" ? 6 : 0));
  const cap = c.kind === "store" ? `<path class="fl-cap" d="M ${b.x} ${b.y + 8} Q ${b.x + b.w / 2} ${b.y + 15} ${b.x + b.w} ${b.y + 8}"/>` : "";
  const tw = c.tag ? flowTextW(c.tag, 8.5) + 12 : 0;
  const tag = c.tag ? `<g class="fl-tag"><rect x="${b.x + b.w - tw - 8}" y="${b.y + 7}" width="${tw}" height="13" rx="2"/><text x="${b.x + b.w - tw / 2 - 8}" y="${b.y + 16.5}" text-anchor="middle">${esc(c.tag)}</text></g>` : "";
  const lx = b.x + b.w - 8 - (tw ? tw + 6 : 0) - FLOW.linkW;
  const lk = c.link ? `<g class="fl-lk"><title>^${esc(c.link)} 로 이동</title><rect x="${lx - 1}" y="${b.y + 6}" width="${FLOW.linkW + 2}" height="${FLOW.linkW + 2}" rx="3"/><path d="M ${lx + 3} ${b.y + 17} L ${lx + 11} ${b.y + 9} M ${lx + 5} ${b.y + 9} L ${lx + 11} ${b.y + 9} L ${lx + 11} ${b.y + 15}"/></g>` : "";
  return `<g class="${cls2}"${attrs}><title>${esc(flowPlain(c.name))}</title><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${rx}" fill="var(--fl-bg)"/><rect class="fl-card" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${rx}"/>${cap}${extra}${tag}${lk}${text}</g>`;
}

/** 블록 글에서 몇 줄을 빼고 flowParse 에 넘길 글(뺀 줄은 빈 줄: 못 읽은 줄 번호가 그대로). take(t, i) 가 참이면 뺀다(들여 쓴 줄은 늘 남긴다) */
function flowAltStrip(text, take) {
  return String(text ?? "")
    .split("\n")
    .map((raw, i) => (/^\s/.test(raw) || !take(raw.trim(), i) ? raw : ""));
}

// MARK: 시퀀스 읽기

/**
 * 크기: fit 메모 칸 폭 어림(이보다 넓으면 더 좁게 감는다), sizes [라벨 감는 폭, 참여자 머리 글 폭] 후보(넓은 것부터, 칸 폭에 드는 첫 판),
 * lh 라벨 줄 높이, gap 머리 사이 빈칸, zone 묶음 영역 여백, num 번호 동그라미 자리, loop 자기 호출 고리 폭,
 * foot 메시지가 이보다 많으면 아래 끝에도 참여자 이름(긴 그림에서 위로 올라가 보지 않게),
 * 좁은 칸(BD1-4 "휴대폰 390 에서 시퀀스가 가로 스크롤"): aim 그림을 지을 때 바라는 배율(칸 폭 ÷ aim 안으로 짓는다, 라벨 11px 이 8px 남짓),
 * min 칸 폭 맞춤 하한(그보다 넓으면 가로 스크롤. 전에는 모든 종류 0.5), narrow 좁은 칸 판의 참여자 머리 글 폭 후보 · narrowLabel 그 판의 라벨 감는 폭 ·
 * narrowGap 머리 사이 빈칸 · narrowLine 세로 줄 사이 가장 좁게
 */
const FLOW_SEQ = { foot: 12, fit: 760, aim: 0.75, min: 0.6, sizes: [[240, 150], [200, 136], [170, 124], [150, 112], [130, 100], [110, 90]], narrow: [100, 90, 80, 72, 64], narrowLabel: 200, narrowGap: 10, narrowLine: 44, lh: 14, gap: 20, zone: 10, num: 18, loop: 30 };
/** 구간 줄: == 글 ==(앞뒤 = 둘 이상). 그 자리 앞뒤 메시지를 가르는 가로 점선 + 이름 */
const FLOW_SEQ_DIV_RE = /^={2,}\s*(.*?)\s*={2,}$/;
/** 폭 지시어: @폭 600 · @width 600(그 폭에 맞춰 라벨을 감는다) · @폭 넓게(줄이지 않는다) */
const FLOW_SEQ_WIDTH_RE = /^@(폭|width)\s*:?\s*(\S+)\s*$/i;
/** 범례: 켬 의 시퀀스 기본 뜻 */
const FLOW_SEQ_OP_TEXT = { "->": "호출", "-->": "응답 · 비동기", "=>": "주 호출", "~>": "외부 호출 · API", "<->": "주고받음", "<-->": "주고받음(비동기)", "---": "연결", "-.-": "느슨한 연결" };

/**
 * 블록 글 → flowParse 결과 + { parts: 참여자(처음 나온 차례, 같은 @묶음은 붙여 모은다), msgs: 메시지(적은 차례, no 1부터), marks: 구간 [{ at: 앞 메시지 수, text }], width }.
 * 구간 줄 · @폭 줄은 빈 줄로 바꿔 flowParse 에 넘긴다(못 읽은 줄 번호가 그대로)
 */
function flowSeqParse(text) {
  const marks = [];
  const bad = [];
  let width = null;
  const kept = flowAltStrip(text, (t, i) => {
    const d = FLOW_SEQ_DIV_RE.exec(t);
    if (d) {
      marks.push({ line: i, text: d[1] });
      return true;
    }
    const w = FLOW_SEQ_WIDTH_RE.exec(t);
    if (!w) return false;
    const v = w[2].replace(/px$/i, "");
    if (/^(넓게|원래|wide|none|끔|off)$/i.test(v)) width = Infinity;
    else if (Number(v) >= 200) width = Number(v);
    else bad.push({ line: i + 1, text: t });
    return true;
  });
  const g = flowParse(kept.join("\n"));
  g.errors.push(...bad);
  const groups = [];
  for (const n of g.nodes) if (!groups.includes(n.group)) groups.push(n.group);
  const parts = groups.flatMap((x) => g.nodes.filter((n) => n.group === x));
  const msgs = g.edges.map((e, k) => ({ ...e, no: k + 1 }));
  const at = (i) => flowParse(kept.slice(0, i).join("\n")).edges.length;
  return { ...g, parts, msgs, marks: marks.map((m) => ({ at: at(m.line), text: m.text })), width };
}

// MARK: 시퀀스 배치

/**
 * 참여자 · 메시지 → { width, height, heads: [{ …참여자, x, y, w, h, cx }], top, bottom, rows: [{ …메시지, a, b, lines, w, ly, ay, lx, ty } | { self, y0, y1 } | { div, text, y }], zones }.
 * lw: 라벨 감는 폭. 참여자 사이(세로 줄 간격)는 머리 폭 · 그 사이를 지나는 라벨 폭으로 정한다(짧은 메시지부터 모자란 만큼 고르게 넓힌다).
 * fitW(좁은 칸 판, BD1-4): 주면 라벨은 FLOW_SEQ.narrowLabel(그림 폭 안)로 감아 제 줄에서 화살 가운데에 놓고(세로 줄을 넘어가도 된다, 그림 밖으로는 안 나간다),
 * 세로 줄 간격은 머리 폭 · 자기 호출 고리만으로 정한다. 자기 호출 라벨은 고리 위 제 줄. lx · ty 는 라벨 상자 왼쪽 · 첫 줄 위
 */
function flowSeqLayout(s, lw = FLOW_SEQ.sizes[0][0], hw = FLOW_SEQ.sizes[0][1], fitW = 0, stagger = false) {
  const narrow = fitW > 0;
  // 엇갈린 머리(좁은 칸 판, 참여자가 많을 때): 홀수 차례 머리는 한 줄 아래에 놓아 옆 머리와 가로로 겹쳐도 되게(세로 줄 간격이 머리 폭의 절반쯤까지 준다)
  const stag = narrow && stagger && s.parts.length > 2;
  const P = s.parts;
  const N = P.length;
  const PAD = 8;
  const Z = FLOW_SEQ.zone;
  const LH = FLOW_SEQ.lh;
  const idx = new Map(P.map((p, i) => [p.name, i]));
  const heads = P.map((p) => ({ ...p, ...flowAltMeasure(p, hw) }));
  const grouped = P.some((p) => p.group);
  const split = (i) => grouped && P[i].group !== P[i + 1].group;
  // 세로 줄 간격: 머리끼리 겹치지 않게 + 묶음이 바뀌면 영역 여백 둘
  const gap = P.slice(0, -1).map((p, i) => (heads[i].w + heads[i + 1].w) / 2 + FLOW_SEQ.gap + (split(i) ? Z * 2 + 6 : 0));
  // 라벨 감는 폭: lw, 머리 간격만으로 이미 넓은 사이(여러 참여자를 건너는 메시지)는 그 폭까지(줄 수를 줄인다, 그림은 넓어지지 않는다)
  const num = s.numbered ? FLOW_SEQ.num : 0;
  const room = (a, b) => (a === b ? (a < N - 1 ? gap[a] - FLOW_SEQ.loop - 20 : 0) : gap.slice(Math.min(a, b), Math.max(a, b)).reduce((x, d) => x + d, 0) - 24) - num - 8;
  const msgs = s.msgs.map((m) => {
    const a = idx.get(m.from);
    const b = idx.get(m.to);
    const lines = m.label ? flowWrap(m.label, 11, narrow ? Math.max(80, Math.min(FLOW_SEQ.narrowLabel, fitW - PAD * 2 - num - 8)) : Math.max(lw, Math.min(320, room(a, b)))) : [];
    const tw = Math.max(0, ...lines.map((l) => flowTextW(l, 11)));
    return { ...m, a, b, lines, num, w: Math.ceil(tw + num + (lines.length || num ? 8 : 0)) };
  });
  // 자기 호출 자리(세로 줄 오른쪽 고리 + 라벨)
  const selfRoom = P.map(() => 0);
  for (const m of msgs) if (m.a === m.b) selfRoom[m.a] = Math.max(selfRoom[m.a], FLOW_SEQ.loop + 8 + (narrow ? 0 : m.w));
  const need = [];
  for (const m of msgs) {
    if (m.a !== m.b) {
      if (!narrow) need.push({ lo: Math.min(m.a, m.b), hi: Math.max(m.a, m.b), d: m.w + 24 });
    }
    // 자기 호출 라벨은 다음 세로 줄 앞까지(다음 묶음 영역 바탕 위에 놓여도 된다. 라벨 바탕이 가린다)
    else if (m.a < N - 1) need.push({ lo: m.a, hi: m.a + 1, d: selfRoom[m.a] + 12 });
  }
  need.sort((x, y) => x.hi - x.lo - (y.hi - y.lo));
  for (const r of need) {
    let cur = 0;
    for (let k = r.lo; k < r.hi; k++) cur += gap[k];
    if (cur >= r.d) continue;
    const add = (r.d - cur) / (r.hi - r.lo);
    for (let k = r.lo; k < r.hi; k++) gap[k] += add;
  }
  const xs = [PAD + (grouped && P[0]?.group ? Z : 0) + (heads[0]?.w ?? 0) / 2];
  if (!narrow) gap.forEach((d, i) => xs.push(xs[i] + d));
  else
    for (let j = 1; j < N; j++) {
      // 좁은 칸 판: 머리 사이 빈칸은 FLOW_SEQ.narrowGap. 엇갈리면 같은 줄 머리(j - 2)끼리만 겹치지 않게 하고, 아래 줄 머리 카드는 옆 세로 줄에서 6 띄운다
      const G = FLOW_SEQ.narrowGap;
      let x = xs[j - 1] + Math.max(FLOW_SEQ.narrowLine, selfRoom[j - 1] ? selfRoom[j - 1] + 12 : 0);
      if (!stag) x = Math.max(x, xs[j - 1] + (heads[j - 1].w + heads[j].w) / 2 + G);
      else {
        x = Math.max(x, xs[j - 1] + heads[j % 2 ? j : j - 1].w / 2 + 6);
        if (j >= 2) x = Math.max(x, xs[j - 2] + (heads[j - 2].w + heads[j].w) / 2 + G);
      }
      // 묶음이 바뀌면 앞 묶음 머리 모두와 영역 여백만큼 띄운다(영역은 두 줄 머리를 다 품는다)
      for (let k = 0; k < j; k++) if (grouped && P[k].group !== P[j].group) x = Math.max(x, xs[k] + (heads[k].w + heads[j].w) / 2 + Z * 2 + 6);
      xs.push(x);
    }
  const rightEdge = N ? Math.max(...xs.map((x, i) => x + Math.max(heads[i].w / 2, i === N - 1 ? selfRoom[i] : 0))) + (grouped && P[N - 1].group ? Z : 0) + PAD : PAD * 2;
  // 세로: 묶음 뱃지 줄 → 머리 → 메시지(적은 차례) · 구간
  const top = PAD + (grouped ? 30 : 0);
  // 머리 높이는 줄마다 같게(엇갈리면 윗줄 · 아랫줄 따로)
  const rowOf = (i) => (stag ? i % 2 : 0);
  const rowH = [0, 1].map((r) => Math.max(0, ...heads.filter((_, i) => rowOf(i) === r).map((h) => h.h)));
  heads.forEach((h, i) => Object.assign(h, { cx: xs[i], x: Math.round((xs[i] - h.w / 2) * 10) / 10, y: rowOf(i) ? top + rowH[0] + 8 : top, h: rowH[rowOf(i)] }));
  const headH = stag ? rowH[0] + 8 + rowH[1] : rowH[0];
  let y = top + headH + 18;
  const rows = [];
  let mi = 0;
  const putMarks = (k) => {
    for (const mk of s.marks) {
      if (mk.at !== k) continue;
      rows.push({ div: true, text: mk.text, y: y + 8 });
      y += 30;
    }
  };
  for (const m of msgs) {
    putMarks(mi++);
    const textH = m.lines.length ? m.lines.length * LH : m.num ? LH : 0;
    if (m.a === m.b && narrow) {
      // 좁은 칸: 라벨 줄 → 고리
      const y0 = y + textH + (textH ? 4 : 2);
      const y1 = y0 + 20;
      rows.push({ ...m, self: true, y0, y1, ly: y, ty: y });
      y = y1 + 14;
    } else if (m.a === m.b) {
      const y0 = y + 2;
      const y1 = y0 + Math.max(20, textH);
      rows.push({ ...m, self: true, y0, y1, ly: y0, ty: y0 - 1 });
      y = y1 + 14;
    } else {
      const ay = y + textH + 6;
      rows.push({ ...m, ly: y, ty: y, ay });
      y = ay + 15;
    }
  }
  putMarks(mi);
  const bottom = y;
  // 아래 끝 참여자 이름(이름만 한 줄 상자). 링크 복사 · 따라가기는 위 머리만 쓴다
  const foot = msgs.length > FLOW_SEQ.foot ? heads.map((h) => ({ name: h.name, kind: h.kind, title: flowWrap(h.name, FLOW.title, h.w - FLOW.padX * 2), cx: h.cx, x: h.x, w: h.w })) : [];
  const footH1 = foot.length ? Math.max(...foot.map((f) => f.title.length)) * FLOW.lh + FLOW.padY * 2 - 4 : 0;
  foot.forEach((f, i) => Object.assign(f, { y: bottom + (rowOf(i) ? footH1 + 6 : 0), h: footH1 }));
  const footH = stag && foot.length ? footH1 * 2 + 6 : footH1;
  const height = Math.ceil(bottom + footH + (grouped ? Z : 0) + PAD);
  // 좁은 칸 판은 가장 넓은 라벨이 들 만큼(감는 폭이 그림 폭 안이라 fitW 를 넘지 않는다)
  const width = Math.ceil(Math.max(rightEdge, narrow ? Math.max(0, ...msgs.map((m) => m.w)) + PAD * 2 : 0));
  // 라벨 상자 왼쪽: 넓은 판은 두 세로 줄 가운데(자기 호출은 고리 오른쪽), 좁은 칸 판은 화살(고리) 가운데에서 그림 안으로 당긴다
  const r1 = (n) => Math.round(n * 10) / 10;
  for (const r of rows) {
    if (r.div) continue;
    if (!narrow) r.lx = r1(r.self ? xs[r.a] + FLOW_SEQ.loop + 8 : (xs[r.a] + xs[r.b]) / 2 - r.w / 2);
    else r.lx = r1(Math.min(Math.max(PAD, (r.self ? xs[r.a] + FLOW_SEQ.loop / 2 : (xs[r.a] + xs[r.b]) / 2) - r.w / 2), width - PAD - r.w));
  }
  // 묶음 영역: 그 묶음 참여자 머리를 품고 위에서 아래 끝까지(묶음 끝 참여자의 자기 호출 라벨은 영역 밖으로 나갈 수 있다)
  const zones = [];
  if (grouped)
    [...new Set(P.map((p) => p.group))].filter(Boolean).forEach((name, i) => {
      const ks = P.map((p, k) => (p.group === name ? k : -1)).filter((k) => k >= 0);
      const x0 = Math.min(...ks.map((k) => xs[k] - heads[k].w / 2)) - Z;
      const x1 = Math.max(...ks.map((k) => xs[k] + Math.max(heads[k].w / 2, k === N - 1 ? selfRoom[k] : 0))) + Z;
      zones.push({ name, i, x: Math.round(x0), y: PAD, w: Math.round(x1 - x0), h: height - PAD * 2 });
    });
  return { width, height, heads, foot, top, headH, bottom, rows, zones, lw, hw, narrow, stagger: stag };
}

/**
 * 메모 칸 폭(@폭, 기본은 FLOW_SEQ.fit 과 칸 폭 ÷ FLOW_SEQ.min 중 작은 것)에 들 때까지 라벨 · 머리 글을 좁게 감아 본다.
 * 칸이 좁으면(휴대폰 · @폭 이 fit 보다 작음, BD1-4) 라벨이 세로 줄을 넘어가도 되는 좁은 칸 판으로 머리 글을 더 좁게. 가장 좁게도 넘치면 가장 좁은 판(칸 폭 맞춤 · 가로 스크롤은 flow.js 의 칸이 한다).
 * colW: 칸 폭(기본은 그릴 때 화면 폭에서 어림, flowAltColW)
 */
function flowSeqFit(s, colW = flowAltColW()) {
  const target = s.width ?? Math.min(FLOW_SEQ.fit, colW / FLOW_SEQ.aim);
  const list = s.width === Infinity ? FLOW_SEQ.sizes.slice(0, 1) : FLOW_SEQ.sizes;
  let L = null;
  for (const [lw, hw] of list) {
    L = flowSeqLayout(s, lw, hw);
    if (L.width <= target) return L;
  }
  if (s.width === Infinity || target >= FLOW_SEQ.fit) return L;
  // 좁은 칸 판: 머리를 한 줄로 → 그래도 넓으면 엇갈린 머리로
  for (const stagger of [false, true])
    for (const hw of FLOW_SEQ.narrow) {
      const N = flowSeqLayout(s, 0, hw, target, stagger);
      if (N.width < L.width - 0.5) L = N;
      if (N.width <= target) return N;
    }
  return L;
}

// MARK: 시퀀스 그리기

/** ```diagram 블록(종류: 시퀀스) → HTML. memoFlowHtml 이 넘긴다(seq 는 본문에서 몇째 diagram 블록인지) */
function flowSeqHtml(text, seq = 0) {
  flowStyle();
  flowAltStyle();
  const s = flowSeqParse(text);
  const { cls, err } = flowAltHead(s);
  if (!s.parts.length) return flowAltEmpty(s, text, seq, cls, err, "참여자가 없습니다. [이름] 줄로 참여자를, 이름 -> 이름 : 메시지 줄로 차례를 적습니다");
  const L = flowSeqFit(s);
  const id = `fl${seq}-${Math.random().toString(36).slice(2, 7)}`;
  const ed = s.style === "editorial";
  const LH = FLOW_SEQ.lh;
  const r1 = (n) => Math.round(n * 10) / 10;
  const x0 = 8;
  const x1 = L.width - 8;
  const zones = L.zones.map(flowZoneSvg).join("");
  const badges = L.zones.map(flowBadgeSvg).join("");
  const lifes = L.heads.map((h) => `<line class="fl-sq-life" x1="${r1(h.cx)}" y1="${h.y + h.h}" x2="${r1(h.cx)}" y2="${L.bottom}"/>`).join("");
  // 라벨 상자: 줄들(왼쪽 맞춤) + 앞 차례 번호. bx 는 상자 왼쪽, ty 는 첫 줄 위
  const label = (m, bx, ty) => {
    const no = m.num ? `<g class="fl-sq-no"><circle cx="${r1(bx + 4 + 7)}" cy="${ty + 7}" r="7"/><text x="${r1(bx + 4 + 7)}" y="${ty + 10.2}" text-anchor="middle">${m.no}</text></g>` : "";
    const tx = bx + 4 + m.num;
    const lines = m.lines.map((l, k) => `<text class="fl-sq-t" x="${r1(tx)}" y="${ty + 11 + k * LH}">${flowTextSvg(l)}</text>`).join("");
    const h = Math.max(m.lines.length, m.num ? 1 : 0) * LH + 2;
    return `<rect class="fl-sq-lb" x="${r1(bx)}" y="${ty - 1}" width="${m.w}" height="${h}" rx="3"/>${no}${lines}`;
  };
  const used = [];
  const rows = L.rows
    .map((r) => {
      if (r.div) {
        const w = flowTextW(r.text, 11) + 16;
        return `<g class="fl-sq-div"><line x1="${x0}" y1="${r.y}" x2="${x1}" y2="${r.y}"/><rect x="${x0 + 6}" y="${r.y - 9}" width="${w}" height="18" rx="4"/><text x="${x0 + 14}" y="${r.y + 4}">${flowTextSvg(flowCodeMarks(r.text))}</text></g>`;
      }
      used.push(r.op);
      const o = flowAltOp(r);
      const tip = `<title>${esc(flowPlain(`${r.no}. ${r.from} ${r.op} ${r.to}${r.label ? ` : ${r.label}` : ""}`))}</title>`;
      if (r.self) {
        const x = L.heads[r.a].cx;
        const R = FLOW_SEQ.loop;
        const path = `M ${r1(x)} ${r.y0} L ${r1(x + R - 6)} ${r.y0} Q ${r1(x + R)} ${r.y0} ${r1(x + R)} ${r.y0 + 6} L ${r1(x + R)} ${r.y1 - 6} Q ${r1(x + R)} ${r.y1} ${r1(x + R - 6)} ${r.y1} L ${r1(x + 1)} ${r.y1}`;
        const lab = r.lines.length || r.num ? label(r, r.lx, r.ty) : "";
        return `<g class="fl-sq-m${r.hot ? " hot" : ""}"><path class="${flowAltEdgeCls(o)}" d="${path}"${flowAltEnds(o, id)}>${tip}</path>${lab}</g>`;
      }
      const xa = L.heads[r.a].cx;
      const xb = L.heads[r.b].cx;
      const path = `M ${r1(xa)} ${r.ay} L ${r1(xb)} ${r.ay}`;
      const lab = r.lines.length || r.num ? label(r, r.lx, r.ty) : "";
      return `<g class="fl-sq-m${r.hot ? " hot" : ""}"><path class="${flowAltEdgeCls(o)}" d="${path}"${flowAltEnds(o, id)}>${tip}</path>${lab}</g>`;
    })
    .join("");
  const legend = flowAltLegend(s, used, FLOW_SEQ_OP_TEXT, L.heads.some((h) => h.focal), id, L.width, L.height);
  const A = flowAttach(s, legend.W, legend.H);
  const heads = L.heads.map((h) => flowAltCard(h, { x: h.x, y: h.y, w: h.w, h: h.h }, A, ed)).join("");
  const foot = L.foot
    .map((f) => {
      const rx = f.kind === "ext" ? 2 : ed ? 6 : 8;
      const text = f.title.map((t, k) => `<text class="fl-t" x="${f.x + FLOW.padX}" y="${f.y + FLOW.padY + 10 + k * FLOW.lh}">${flowTextSvg(t)}</text>`).join("");
      return `<g class="fl-sq-foot fl-${f.kind}"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${rx}" fill="var(--fl-bg)"/><rect class="fl-card" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${rx}"/>${text}</g>`;
    })
    .join("");
  const inner = `${flowAltDefs(id)}<g${A.dx || A.dy ? ` transform="translate(${A.dx} ${A.dy})"` : ""}>${zones}${lifes}${rows}${badges}${heads}${foot}${legend.svg}</g>${A.html}`;
  return flowAltFigure(s, text, seq, cls, err, A.W, A.H, inner, FLOW_SEQ.min);
}
