// 데이터 모델 diagram(```diagram 의 "종류: 데이터 모델", BD1-3 2026-11-16, BD1 문제 #4 "칸 · Key · 관계 차수를 그릴 길이 없다. 어느 칸이 무엇을 가리키는지 라벨로만 적는다"):
// 카드 = 칸 표(머리 + 칸 줄), 관계 끝점은 칸 줄(카드.칸)에 붙고 끝에 차수 표(1 · n · 0..1 · 1..n · n..1). 묶음(@)은 세로 열 하나, 묶음이 없으면 가리키는 쪽에서 가리켜지는 쪽으로 열.
// flow.js 의 memoFlowHtml 이 종류가 데이터 모델이면 flowModelHtml 로 넘긴다. 카드 머리 · 관계 줄은 flowParse 그대로 읽고, 칸 줄 · 카드.칸 끝점 · 차수만 여기서 읽는다.
// 틀(figure · 범례 · 꺾쇠 · 카드 · CSS)은 flow-seq.js 의 flowAlt* 를 쓴다(flow.js · flow-seq.js 뒤에 읽는다).
// 순수 함수(flowModelParse · flowModelLayout)는 시험(web/flow-model.test.mjs)이 vm 으로 읽는다.

/**
 * 크기: row 칸 줄 높이(꼴이 길어 두 줄이면 row2), rowMax 한 줄 칸 줄의 가장 넓은 폭(넘으면 꼴을 다음 줄로), gapY 열 안 표 사이, gapX 열 사이 가장 좁게,
 * track 열 사이 세로 길 간격, zone 묶음 영역 여백, head 표 머리 글 폭, label 관계 라벨 감는 폭,
 * fit 그림 폭 어림(BD1-4: 넓은 화면 칸 770 에서 0.8 배 이상. 넘으면 묶음을 옆 묶음 열 아래에 쌓는다), min 칸 폭 맞춤 하한(휴대폰은 칸 폭 ÷ min 안으로 쌓는다)
 */
const FLOW_MODEL = { row: 20, row2: 34, rowMax: 210, gapY: 30, gapX: 44, track: 9, zone: 12, head: 170, label: 84, fit: 960, min: 0.5 };
/** Key 표: 칸 줄의 #PK · #FK · #UK(크고 작은 글자 상관없음) */
const FLOW_MODEL_KEY_RE = /(^|\s)#(PK|FK|UK)(?=\s|$)/gi;
/** 차수 표: 라벨 맨 앞 1 · n · 0..1 · 1..n · n..1 · 1:n 꼴(뒤에 빈칸 + 라벨 글이 와도 된다) */
const FLOW_MODEL_CARD_RE = /^((?:\d+|[nNmM*])(?:\s*(?:\.\.|:)\s*(?:\d+|[nNmM*]))?)(?:\s+(.+))?$/;
/** 범례: 켬 의 데이터 모델 기본 뜻 */
const FLOW_MODEL_OP_TEXT = { "->": "가리킴", "-->": "따라 씀 · 사본", "=>": "씀", "~>": "외부 참조", "<->": "서로 가리킴", "<-->": "서로 가리킴(느슨)", "---": "연결", "-.-": "느슨한 연결" };

/**
 * 차수 글 → { from, to, text }. 쌍점(1:n) · 앞이 n · m · * 인 범위(n..1 · n..n)는 두 끝(출발 칸 쪽 · 도착 카드 쪽),
 * 그 밖(1 · n · 0..1 · 1..n)은 도착 쪽 끝 하나
 */
function flowModelCard(tok) {
  const t = String(tok).replace(/\s+/g, "");
  const m = /^(.+?)(\.\.|:)(.+)$/.exec(t);
  if (m && (m[2] === ":" || /^[nNmM*]$/.test(m[1]))) return { from: m[1], to: m[3], text: t };
  return { from: "", to: t, text: t };
}

/** 카드 본문 줄 → { fields: [{ name, type, keys }], desc: [글] }. "칸: 꼴" · "- 칸: 꼴" · "- 칸"(꼴 없이) · Key 표가 있는 줄은 칸, 나머지는 설명 줄 */
function flowModelFields(lines) {
  const fields = [];
  const desc = [];
  for (const raw of lines) {
    const dot = /^[-*]\s+/.test(raw);
    const keys = [];
    const t = raw
      .replace(/^[-*]\s+/, "")
      .replace(FLOW_MODEL_KEY_RE, (_, sp, k) => {
        keys.push(k.toUpperCase());
        return " ";
      })
      .replace(/\s+/g, " ")
      .trim();
    const m = /^([^:]{1,40}?)\s*:\s*(.*)$/.exec(t);
    if (m && m[1].trim()) fields.push({ name: m[1].trim(), type: m[2].trim(), keys });
    else if (dot || keys.length) fields.push({ name: t, type: "", keys });
    else desc.push(raw);
  }
  return { fields, desc };
}

// MARK: 데이터 모델 읽기

/**
 * 블록 글 → flowParse 결과 + { cards: [{ …카드, fields, desc }], rels: [{ from: { card, field }, to: { card, field }, op, label, hot, card: 차수 | null, line }] }.
 * 관계 끝 "카드.칸" 은 적은 카드 이름(가장 긴 것) + . + 그 카드의 칸 이름. 칸이 없으면 빨간 글. 적지 않은 이름은 칸 없는 카드(흐름도처럼)
 */
function flowModelParse(text) {
  const g = flowParse(text);
  const declared = new Set();
  const rels0 = [];
  let open = false;
  String(text ?? "")
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) return;
      if (open && /^\s/.test(line)) return;
      open = false;
      const t = line.trim();
      if (t.startsWith("//")) return;
      const rel = FLOW_OP_RE.test(` ${t} `);
      const head = !rel && /^\[(\[?)([^\]]+)\]/.exec(t);
      if (head) {
        if (!head[1]) declared.add(head[2].trim());
        open = true;
        return;
      }
      if (rel) for (const e of flowParse(t).edges) rels0.push({ ...e, line: i + 1, text: t });
    });
  const cards = g.nodes.filter((n) => declared.has(n.name)).map((n) => ({ ...n, ...flowModelFields(n.lines) }));
  const byName = new Map(cards.map((c) => [c.name, c]));
  const longest = [...declared].sort((a, b) => b.length - a.length);
  const errors = [...g.errors];
  const end = (x, e) => {
    if (byName.has(x)) return { card: x, field: null };
    const c = longest.find((n) => x.startsWith(`${n}.`));
    if (c) {
      const f = x.slice(c.length + 1).replace(/\s+/g, " ").trim();
      if (byName.get(c).fields.some((d) => d.name === f)) return { card: c, field: f };
      errors.push({ line: e.line, text: e.text, why: `${c} 에 ${f} 칸이 없습니다` });
      return null;
    }
    const n = g.nodes.find((m) => m.name === x) ?? { name: x, kind: "task", group: "", tag: "", focal: false, ref: "", link: "", lines: [] };
    const card = { ...n, fields: [], desc: [] };
    cards.push(card);
    byName.set(x, card);
    return { card: x, field: null };
  };
  const rels = [];
  for (const e of rels0) {
    const from = end(e.from, e);
    const to = end(e.to, e);
    if (!from || !to) continue;
    const m = FLOW_MODEL_CARD_RE.exec(e.label ?? "");
    rels.push({ op: e.op, hot: e.hot, line: e.line, from, to, card: m ? flowModelCard(m[1]) : null, label: m ? (m[2] ?? "").trim() : e.label ?? "" });
  }
  return { ...g, cards, rels, errors };
}

// MARK: 데이터 모델 배치

/**
 * 칸 표 · 관계 → { width, height, tables: [{ …카드, x, y, w, h, hh, rows }], links: [{ …관계, pts, sx, sy, tx, ty, sd, td, lbox }], zones }.
 * 열: 묶음마다 하나(관계가 잇는 묶음끼리 가깝게, 가리키는 쪽이 왼쪽), 묶음이 없으면 가리키는 쪽에서 가리켜지는 쪽으로 단.
 * 열 안 차례는 이어진 표의 높이 평균으로 맞춘다. 선은 직각: 칸 줄 옆 → 열 사이 세로 길(겹치지 않게 줄을 나눔) → 도착 표 옆.
 * 열을 건너뛰는 선은 사이 열의 표 사이 빈 줄로 지난다(표를 뚫지 않는다).
 * stacks(BD1-4, flowModelFit 이 준다): 열마다 묶음 차례(위에서 아래) [[묶음 번호 …] …]. 한 열에 묶음이 둘 이상이면 묶음마다 표를 모아 위아래로 쌓고 영역도 따로.
 * 돌려주는 stacks · relCost(관계마다 열 거리, 같은 열의 다른 묶음 사이는 2)는 쌓기 고르기에 쓴다
 */
function flowModelLayout(md, stacks = null) {
  const PAD = 8;
  const Z = FLOW_MODEL.zone;
  const ROW = FLOW_MODEL.row;
  const tables = md.cards.map((c) => {
    const head = flowAltMeasure(c, FLOW_MODEL.head, c.desc);
    // 칸 줄: Key 표 · 이름 · 꼴(오른쪽 맞춤). 한 줄이 rowMax 보다 넓으면 꼴을 다음 줄로(표가 넓어지지 않게)
    let dy = 3;
    const rows = c.fields.map((f) => {
      const keyW = f.keys.length * 24;
      const nameW = flowTextW(flowCodeMarks(f.name), 11);
      const typeW = f.type ? flowTextW(flowCodeMarks(f.type), 10) : 0;
      const one = FLOW.padX * 2 + keyW + nameW + (f.type ? 16 + typeW : 0);
      const two = one > FLOW_MODEL.rowMax && f.type;
      const r = { ...f, keyW, two: Boolean(two), dy, h: two ? FLOW_MODEL.row2 : ROW, w: Math.ceil(two ? FLOW.padX * 2 + Math.max(keyW + nameW, 12 + typeW) : one), on: false };
      dy += r.h;
      return r;
    });
    const w = Math.ceil(Math.max(head.w, 110, ...rows.map((r) => r.w)));
    const hh = head.h;
    return { ...c, title: head.title, body: head.body, tagW: head.tagW, rows, w, hh, h: hh + (rows.length ? dy + 3 : 0) };
  });
  const N = tables.length;
  const idx = new Map(tables.map((t, i) => [t.name, i]));
  const rels = md.rels.map((r) => ({ ...r, a: idx.get(r.from.card), b: idx.get(r.to.card) }));
  // 열
  const groups = [];
  for (const t of tables) if (!groups.includes(t.group)) groups.push(t.group);
  const grouped = groups.some(Boolean);
  let col;
  let slot = new Array(N).fill(0);
  let stacksOut = null;
  if (grouped) {
    // 묶음 차례: 관계마다 열 거리(+ 왼쪽을 가리키면 0.3)가 가장 작은 차례. 6 묶음까지 모든 차례를 본다(같으면 적은 차례)
    const gi = (i) => groups.indexOf(tables[i].group);
    const cost = (perm) => {
      const at = new Map(perm.map((x, k) => [x, k]));
      return rels.reduce((s, r) => {
        const p = at.get(gi(r.a));
        const q = at.get(gi(r.b));
        return s + Math.abs(p - q) + (q < p ? 0.3 : 0);
      }, 0);
    };
    let best = groups.map((_, k) => k);
    if (groups.length <= 6) {
      let bestCost = cost(best);
      const perm = (list, rest) => {
        if (!rest.length) {
          const c = cost(list);
          if (c < bestCost - 1e-9) {
            bestCost = c;
            best = list;
          }
          return;
        }
        rest.forEach((x, k) => perm([...list, x], [...rest.slice(0, k), ...rest.slice(k + 1)]));
      };
      perm([], best);
    }
    stacksOut = stacks ?? best.map((x) => [x]);
    const gcol = new Map();
    const gslot = new Map();
    stacksOut.forEach((c, k) => c.forEach((x, j) => gcol.set(x, k) && gslot.set(x, j)));
    col = tables.map((_, i) => gcol.get(gi(i)));
    slot = tables.map((_, i) => gslot.get(gi(i)));
  } else {
    // 가리키는 쪽 → 가리켜지는 쪽 가장 긴 길(고리는 DFS 로 끊는다)
    const outs = tables.map(() => []);
    for (const r of rels) if (r.a !== r.b) outs[r.a].push(r.b);
    const st = new Array(N).fill(0);
    const back = new Set();
    const dfs = (v) => {
      st[v] = 1;
      for (const u of outs[v]) {
        if (st[u] === 1) back.add(`${v}>${u}`);
        else if (!st[u]) dfs(u);
      }
      st[v] = 2;
    };
    for (let v = 0; v < N; v++) if (!st[v]) dfs(v);
    col = new Array(N).fill(-1);
    const rankOf = (v, seen = new Set()) => {
      if (col[v] >= 0) return col[v];
      if (seen.has(v)) return 0;
      seen.add(v);
      const ins = rels.filter((r) => r.b === v && r.a !== v && !back.has(`${r.a}>${v}`)).map((r) => r.a);
      col[v] = ins.length ? Math.max(...ins.map((u) => rankOf(u, seen) + 1)) : 0;
      return col[v];
    };
    for (let v = 0; v < N; v++) rankOf(v);
  }
  const C = Math.max(0, ...col) + 1;
  const cols = Array.from({ length: C }, () => []);
  tables.forEach((t, i) => cols[col[i]].push(i));
  cols.forEach((L) => L.sort((p, q) => slot[p] - slot[q] || p - q));
  const top = PAD + (grouped ? 34 : 0);
  const pos = new Array(N).fill(0);
  // 한 열에 쌓은 묶음 사이: 위 묶음 영역 아래 여백 + 10 + 아래 묶음 뱃지 자리(34)
  const SLOT_GAP = Z + 10 + 34 - FLOW_MODEL.gapY;
  const stack = () =>
    cols.forEach((L) => {
      let y = top;
      L.forEach((i, k) => {
        if (k && slot[i] !== slot[L[k - 1]]) y += SLOT_GAP;
        pos[i] = y;
        y += tables[i].h + FLOW_MODEL.gapY;
      });
    });
  stack();
  // 칸 줄 가운데 높이(칸이 없는 끝은 머리 가운데)
  const yOf = (i, f) => {
    const t = tables[i];
    const row = f == null ? null : t.rows.find((r) => r.name === f);
    return row ? pos[i] + t.hh + row.dy + ROW / 2 : pos[i] + Math.min(t.hh / 2, 18);
  };
  // 열 안 차례: 다른 열의 이어진 끝 높이 평균(4번 오간다)
  for (let it = 0; it < 4; it++) {
    for (const L of it % 2 ? [...cols].reverse() : cols) {
      const key = new Map(
        L.map((i) => {
          const ys = [];
          for (const r of rels) {
            if (r.a === i && col[r.b] !== col[i]) ys.push(yOf(r.b, r.to.field) - (yOf(i, r.from.field) - pos[i]));
            if (r.b === i && col[r.a] !== col[i]) ys.push(yOf(r.a, r.from.field) - (yOf(i, r.to.field) - pos[i]));
          }
          return [i, ys.length ? ys.reduce((a, y) => a + y, 0) / ys.length : pos[i]];
        }),
      );
      L.sort((p, q) => slot[p] - slot[q] || key.get(p) - key.get(q) || pos[p] - pos[q]);
    }
    stack();
  }
  for (const r of rels) {
    if (r.from.field) tables[r.a].rows.find((x) => x.name === r.from.field).on = true;
    if (r.to.field) tables[r.b].rows.find((x) => x.name === r.to.field).on = true;
  }
  const bottom0 = Math.max(top, ...tables.map((t, i) => pos[i] + t.h));
  // 선 길: 세로 조각을 열 사이(gap k = 열 k 오른쪽)에 둔다. 열을 건너뛰면 사이 열의 빈 줄(가로 길)로
  const blocked = (c) => cols[c].map((i) => [pos[i] - 10, pos[i] + tables[i].h + 10]);
  const corridors = [];
  // 다른 선의 가로 조각(칸 줄 높이)과 붙어 한 선처럼 보이지 않게, 되도록 그 높이에서 8 넘게 띄운다
  const busyY = rels.flatMap((r) => [yOf(r.a, r.from.field), yOf(r.b, r.to.field)]);
  const corridor = (c0, c1, want) => {
    const iv = [];
    for (let c = c0; c <= c1; c++) iv.push(...blocked(c));
    const free = (y) => iv.every(([lo, hi]) => y <= lo || y >= hi) && corridors.every((k) => k.c1 < c0 || k.c0 > c1 || Math.abs(k.y - y) >= 8);
    const cands = [want, ...iv.flat(), ...iv.flatMap(([lo, hi]) => [lo - 8, hi + 8, lo - 16, hi + 16, lo - 4, hi + 4]), bottom0 + 14, bottom0 + 22, bottom0 + 30, bottom0 + 38];
    const ok0 = cands.filter((y) => y >= top - 4 && free(y));
    const calm = ok0.filter((y) => busyY.every((b) => Math.abs(b - y) >= 8));
    const ok = calm.length ? calm : ok0;
    const y = ok.length ? ok.reduce((b, y2) => (Math.abs(y2 - want) < Math.abs(b - want) ? y2 : b), ok[0]) : bottom0 + 14 + corridors.length * 8;
    corridors.push({ c0, c1, y });
    return y;
  };
  const segs = [];
  const links = rels.map((r, k) => {
    const ca = col[r.a];
    const cb = col[r.b];
    const ys = yOf(r.a, r.from.field);
    // 자기 자신의 같은 줄로 가는 관계는 고리가 보이게 도착을 조금 아래로
    const yt = yOf(r.b, r.to.field) + (r.a === r.b && Math.abs(yOf(r.b, r.to.field) - ys) < 8 ? 12 : 0);
    const L = { ...r, k, ys, yt };
    if (ca < cb) {
      L.sd = 1;
      L.td = -1;
      if (cb === ca + 1) L.v = [{ gap: ca, y0: ys, y1: yt }];
      else {
        const yc = corridor(ca + 1, cb - 1, (ys + yt) / 2);
        L.v = [{ gap: ca, y0: ys, y1: yc }, { gap: cb - 1, y0: yc, y1: yt }];
      }
    } else if (ca > cb) {
      L.sd = -1;
      L.td = 1;
      if (ca === cb + 1) L.v = [{ gap: cb, y0: ys, y1: yt }];
      else {
        const yc = corridor(cb + 1, ca - 1, (ys + yt) / 2);
        L.v = [{ gap: ca - 1, y0: ys, y1: yc }, { gap: cb, y0: yc, y1: yt }];
      }
    } else {
      // 같은 열(자기 자신 포함): 오른쪽으로 나가 오른쪽으로 들어온다
      L.sd = 1;
      L.td = 1;
      L.v = [{ gap: ca, y0: ys, y1: yt, loop: true }];
    }
    segs.push(...L.v);
    return L;
  });
  // 세로 길 줄 나누기: 같은 열 사이에서 높이가 겹치는 세로 조각은 다른 줄
  const tracks = new Array(C).fill(0);
  for (let c = 0; c < C; c++) {
    const list = segs.filter((s) => s.gap === c).sort((p, q) => Math.min(p.y0, p.y1) - Math.min(q.y0, q.y1) || Math.abs(p.y1 - p.y0) - Math.abs(q.y1 - q.y0));
    const lanes = [];
    for (const s of list) {
      const lo = Math.min(s.y0, s.y1) - 6;
      const hi = Math.max(s.y0, s.y1) + 6;
      let t = lanes.findIndex((busy) => busy.every(([a, b]) => hi <= a || lo >= b));
      if (t < 0) {
        t = lanes.length;
        lanes.push([]);
      }
      lanes[t].push([lo, hi]);
      s.track = t;
    }
    tracks[c] = lanes.length;
  }
  // 라벨(차수 아닌 글): 첫 세로 조각 옆(길면 가운데, 짧으면 출발 가로 조각 위)
  const base = grouped ? Z + 10 : 14;
  const off = (s) => base + s.track * FLOW_MODEL.track;
  const labelNeed = new Array(C).fill(0);
  for (const L of links) {
    if (!L.label) continue;
    const s = L.v[0];
    // 라벨은 FLOW_MODEL.label 폭으로 감는다(열 사이가 라벨만큼 넓어지니 짧게)
    L.lines = flowWrap(L.label, 11, FLOW_MODEL.label);
    L.lw = Math.ceil(Math.max(...L.lines.map((x) => flowTextW(x, 11))) + 10);
    labelNeed[s.gap] = Math.max(labelNeed[s.gap], off(s) + 6 + L.lw + 8);
  }
  // 차수 표 자리(끝마다 글 폭 + 꺾쇠)
  const cardNeed = new Array(C).fill(0);
  for (const L of links) {
    if (!L.card) continue;
    const w = Math.max(flowTextW(L.card.from, 10), flowTextW(L.card.to, 10)) + 22;
    for (const s of L.v) cardNeed[s.gap] = Math.max(cardNeed[s.gap], w + 18);
  }
  const gw = tracks.map((n, c) => Math.max(c < C - 1 ? FLOW_MODEL.gapX + (grouped ? Z * 2 : 0) : n ? 0 : grouped ? Z : 0, n ? base + n * FLOW_MODEL.track + (grouped ? Z : 8) : 0, labelNeed[c], cardNeed[c]));
  const colW = cols.map((L) => Math.max(0, ...L.map((i) => tables[i].w)));
  const colX = [PAD + (grouped ? Z : 0)];
  for (let c = 1; c < C; c++) colX[c] = colX[c - 1] + colW[c - 1] + gw[c - 1];
  tables.forEach((t, i) => {
    t.x = Math.round(colX[col[i]] + (colW[col[i]] - t.w) / 2);
    t.y = pos[i];
  });
  const gapX = (s) => colX[s.gap] + colW[s.gap] + off(s);
  const r1 = (n) => Math.round(n * 10) / 10;
  for (const L of links) {
    const A = tables[L.a];
    const B = tables[L.b];
    L.sx = L.sd > 0 ? A.x + A.w : A.x;
    L.tx = L.td < 0 ? B.x : B.x + B.w;
    const pts = [[L.sx, L.ys]];
    for (const s of L.v) {
      const x = gapX(s);
      pts.push([x, s.y0], [x, s.y1]);
    }
    pts.push([L.tx, L.yt]);
    L.pts = pts.map(([x, y]) => [r1(x), r1(y)]);
    if (L.label) {
      const s = L.v[0];
      const x = gapX(s) + 6;
      const long = Math.abs(s.y1 - s.y0) >= 30;
      const h = L.lines.length * 14 + 4;
      L.lbox = { x: r1(x), y: r1((long ? (s.y0 + s.y1) / 2 - h / 2 : s.y0 - 3 - h)), w: L.lw, h };
    }
  }
  // 라벨끼리 겹치면 아래로 민다(같은 열 사이)
  const placed = [];
  for (const L of [...links].filter((x) => x.lbox).sort((p, q) => p.lbox.y - q.lbox.y)) {
    for (let guard = 0; guard < 20; guard++) {
      const hit = placed.find((b) => b.x < L.lbox.x + L.lbox.w && L.lbox.x < b.x + b.w && b.y < L.lbox.y + L.lbox.h && L.lbox.y < b.y + b.h);
      if (!hit) break;
      L.lbox.y = r1(hit.y + hit.h + 2);
    }
    placed.push(L.lbox);
  }
  const lastX = colX[C - 1] + colW[C - 1] + gw[C - 1];
  const width = Math.ceil(Math.max(lastX + PAD, ...placed.map((b) => b.x + b.w + PAD)));
  const height = Math.ceil(Math.max(bottom0, ...corridors.map((k) => k.y + 10), ...placed.map((b) => b.y + b.h)) + PAD + (grouped ? Z : 0));
  // 묶음 영역: 열마다 위에서 아래 끝까지(한 열에 쌓은 묶음은 묶음마다: 맨 위 묶음은 위 끝부터, 맨 아래 묶음은 아래 끝까지)
  const zones = [];
  if (grouped)
    cols.forEach((L, c) => {
      const segs = [];
      for (const i of L) {
        const sg = segs.at(-1);
        if (sg && sg.slot === slot[i]) sg.ids.push(i);
        else segs.push({ slot: slot[i], ids: [i] });
      }
      segs.forEach((sg, k) => {
        const name = tables[sg.ids[0]].group;
        if (!name) return;
        const y0 = k === 0 ? PAD : Math.min(...sg.ids.map((i) => pos[i])) - 34;
        const y1 = k === segs.length - 1 ? height - PAD : Math.max(...sg.ids.map((i) => pos[i] + tables[i].h)) + Z;
        zones.push({ name, i: groups.indexOf(name), x: Math.round(colX[c] - Z), y: Math.round(y0), w: Math.round(colW[c] + Z * 2), h: Math.round(y1 - y0) });
      });
    });
  const relCost = rels.reduce((a, r) => a + (col[r.a] === col[r.b] ? (r.a !== r.b && tables[r.a].group !== tables[r.b].group ? 2 : 0) : Math.abs(col[r.a] - col[r.b]) + (col[r.b] < col[r.a] ? 0.3 : 0)), 0);
  return { width, height, tables, links, zones, cols: cols.map((L) => L.map((i) => tables[i].name)), stacks: stacksOut, relCost };
}

/**
 * 칸 폭에 맞춘 데이터 모델 배치(BD1-4 "2-2 데이터 모델 폭 1196, 넓은 화면 0.64 배"): 폭이 FLOW_MODEL.fit(휴대폰은 칸 폭 ÷ FLOW_MODEL.min)보다 넓으면
 * 묶음 열 하나를 다른 묶음 열의 위나 아래에 쌓아 열을 줄인다. 쌓을 짝은 다 그려 보고 고른다: 폭 안에 드는 판 중 관계 열 거리(relCost) + 높이가 가장 작은 것.
 * 들지 않으면 폭이 가장 많이 주는 쪽으로 하나 쌓고 다시 본다. 묶음이 없거나 열이 하나면 그대로. colW: 칸 폭(기본은 그릴 때 화면 폭에서 어림)
 */
function flowModelFit(md, colW = flowAltColW()) {
  let L = flowModelLayout(md);
  const target = Math.min(FLOW_MODEL.fit, colW / FLOW_MODEL.min);
  while (L.stacks && L.width > target && L.stacks.length > 1) {
    let pick = null;
    for (let i = 0; i < L.stacks.length; i++)
      for (let j = 0; j < L.stacks.length; j++) {
        if (i === j) continue;
        for (const under of [true, false]) {
          const st = L.stacks.map((c) => [...c]);
          st[i] = under ? [...st[i], ...st[j]] : [...st[j], ...st[i]];
          st.splice(j, 1);
          const M = flowModelLayout(md, st);
          const fits = M.width <= target;
          const score = M.relCost + (3 * M.height) / L.height + (fits ? 0 : (8 * M.width) / L.width);
          if (!pick || (fits && !pick.fits) || (fits === pick.fits && score < pick.score - 1e-9)) pick = { M, fits, score };
        }
      }
    if (!pick || pick.M.width >= L.width) break;
    L = pick.M;
  }
  return L;
}

// MARK: 데이터 모델 그리기

/** 꺾이는 점들 → 모서리를 둥글린 길(r) */
function flowModelPath(pts, r = 6) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0);
    const l2 = Math.hypot(x2 - x1, y2 - y1);
    if (!l1 || !l2) continue;
    const k = Math.min(r, l1 / 2, l2 / 2);
    const a = [x1 - ((x1 - x0) / l1) * k, y1 - ((y1 - y0) / l1) * k];
    const b = [x1 + ((x2 - x1) / l2) * k, y1 + ((y2 - y1) / l2) * k];
    d += ` L ${Math.round(a[0] * 10) / 10} ${Math.round(a[1] * 10) / 10} Q ${x1} ${y1} ${Math.round(b[0] * 10) / 10} ${Math.round(b[1] * 10) / 10}`;
  }
  const [xe, ye] = pts.at(-1);
  return `${d} L ${xe} ${ye}`;
}

/** ```diagram 블록(종류: 데이터 모델) → HTML. memoFlowHtml 이 넘긴다 */
function flowModelHtml(text, seq = 0) {
  flowStyle();
  flowAltStyle();
  const md = flowModelParse(text);
  const { cls, err } = flowAltHead(md);
  if (!md.cards.length) return flowAltEmpty(md, text, seq, cls, err, "표가 없습니다. [이름] 줄 아래 들여 쓴 \"칸: 꼴\" 줄로 표를, 카드.칸 -> 카드 : n..1 줄로 관계를 적습니다");
  const L = flowModelFit(md);
  const id = `fl${seq}-${Math.random().toString(36).slice(2, 7)}`;
  const ed = md.style === "editorial";
  const used = [];
  const edges = L.links
    .map((l) => {
      used.push(l.op);
      const o = flowAltOp(l);
      const tip = `${l.from.card}${l.from.field ? `.${l.from.field}` : ""} ${l.op} ${l.to.card}${l.to.field ? `.${l.to.field}` : ""}${l.card ? ` : ${l.card.text}` : ""}${l.label ? ` ${l.label}` : ""}`;
      return `<path class="${flowAltEdgeCls(o)}" d="${flowModelPath(l.pts)}"${flowAltEnds(o, id)}><title>${esc(flowPlain(tip))}</title></path>`;
    })
    .join("");
  // 출발 점(칸 줄 옆)
  const dots = L.links.map((l) => `<circle class="fl-md-dot${l.hot ? " hot" : ""}" cx="${l.sx}" cy="${l.ys}" r="2.6"/>`).join("");
  // 차수 표: 출발 쪽 · 도착 쪽 끝 위
  const cardTxt = (x, y, s, anchor) => {
    const w = flowTextW(s, 10) + 6;
    const bx = anchor === "end" ? x - w : x;
    return `<g class="fl-md-c"><rect x="${Math.round(bx * 10) / 10}" y="${y - 10}" width="${w}" height="13" rx="2"/><text x="${Math.round((bx + 3) * 10) / 10}" y="${y}">${esc(s)}</text></g>`;
  };
  const cards = L.links
    .filter((l) => l.card)
    .map((l) => (l.card.from ? cardTxt(l.sx + l.sd * 5, l.ys - 4, l.card.from, l.sd > 0 ? "start" : "end") : "") + (l.card.to ? cardTxt(l.tx + l.td * 13, l.yt - 4, l.card.to, l.td < 0 ? "end" : "start") : ""))
    .join("");
  const labels = L.links
    .filter((l) => l.lbox)
    .map((l) => `<g class="fl-md-l"><rect x="${l.lbox.x}" y="${l.lbox.y}" width="${l.lbox.w}" height="${l.lbox.h}" rx="${ed ? 2 : l.lines.length > 1 ? 6 : 9}"/>${l.lines.map((x, k) => `<text x="${l.lbox.x + l.lbox.w / 2}" y="${l.lbox.y + 13 + k * 14}" text-anchor="middle">${flowTextSvg(x)}</text>`).join("")}</g>`)
    .join("");
  const legend = flowAltLegend(md, used, FLOW_MODEL_OP_TEXT, L.tables.some((t) => t.focal), id, L.width, L.height);
  const A = flowAttach(md, legend.W, legend.H);
  // 표: 카드 꼴(머리) + 칸 줄(Key 표 · 이름 · 꼴, 관계 끝인 줄은 옅은 바탕)
  const tables = L.tables
    .map((t) => {
      const y0 = t.y + t.hh;
      const rows = t.rows
        .map((r) => {
          const ry = y0 + r.dy;
          const bg = r.on ? `<rect class="fl-md-row on" x="${t.x + 1}" y="${ry}" width="${t.w - 2}" height="${r.h}"/>` : "";
          const keys = r.keys.map((key, j) => `<g class="fl-md-key ${key.toLowerCase()}"><rect x="${t.x + FLOW.padX + j * 24}" y="${ry + 4}" width="20" height="12" rx="2"/><text x="${t.x + FLOW.padX + j * 24 + 10}" y="${ry + 13}" text-anchor="middle">${key}</text></g>`).join("");
          const name = `<text class="fl-md-f" x="${t.x + FLOW.padX + r.keyW}" y="${ry + 14}">${flowTextSvg(flowCodeMarks(r.name))}</text>`;
          const type = r.type ? `<text class="fl-md-ty" x="${t.x + t.w - FLOW.padX}" y="${ry + (r.two ? 28 : 14)}" text-anchor="end">${flowTextSvg(flowCodeMarks(r.type))}</text>` : "";
          return `${bg}${keys}${name}${type}`;
        })
        .join("");
      const sep = t.rows.length ? `<line class="fl-md-sep" x1="${t.x}" y1="${y0}" x2="${t.x + t.w}" y2="${y0}"/>` : "";
      return flowAltCard(t, { x: t.x, y: t.y, w: t.w, h: t.h }, A, ed, sep + rows);
    })
    .join("");
  const zones = L.zones.map(flowZoneSvg).join("");
  const badges = L.zones.map(flowBadgeSvg).join("");
  const inner = `${flowAltDefs(id)}<g${A.dx || A.dy ? ` transform="translate(${A.dx} ${A.dy})"` : ""}>${zones}${edges}${tables}${dots}${labels}${cards}${badges}${legend.svg}</g>${A.html}`;
  return flowAltFigure(md, text, seq, cls, err, A.W, A.H, inner, FLOW_MODEL.min);
}
