// 다이어그램(```diagram 블록, 옛 이름 ```flow, 2026-11-13 사용자 "순서가 있는 조건부 흐름, 엣지에 화살표 · 점선, 여러 줄 카드, 관계 · 조건 · 루프 · 상태").
// 메모 미리보기 · 큰 화면 · 인쇄가 markdown.js 의 코드 블록 그리기에서 memoFlowHtml 을 부른다. 문법 안내는 server/flow-guide.mjs(바꾸면 같이 고친다).
//
// 문법(줄 단위):
//   제목: 주문 처리            방향: 아래 | 오른쪽            번호: 켬(카드 앞에 흐름 차례 번호)
//   [이름] 종류                카드 머리. 종류는 작업(기본) · 조건 · 시작 · 끝 · 상태 · 메모. 아래 들여 쓴 줄들이 카드 본문(- 는 점 목록)
//   이름 -> 이름 : 라벨         관계 줄. 한 줄에 여러 개 이을 수 있다(A -> B -> C). 라벨은 줄 끝 ": 글" 또는 화살표 뒤 |글|
//   화살표: -> 실선 · --> 점선 · => 굵은 실선 · <-> 양쪽 · <--> 양쪽 점선 · --- 선만 · -.- 점선만(화살표 기호 앞뒤에 빈칸)
//   // 로 시작하는 줄은 주석. 관계 줄에만 나온 이름은 본문 없는 작업 카드가 된다
//   @dir down | right(세로 · 가로)       방향(방향: 과 같다)
//   @align center | left | right | top | bottom   단 안 카드 정렬(기본 가운데). 세로면 left · right, 가로면 top · bottom 이 뜻이 있고
//                                       left · top 은 앞쪽, right · bottom 은 뒤쪽 끝에 맞춘다(2026-11-13 사용자)
//   관계 줄 끝 !! 또는 #강조 · #critical · #핵심 · #hot   그 관계를 네온 형광으로(크리티컬 패스 등)
//   [[이름]] + 들여 쓴 줄              곁 설명 카드(그림 밖, 관계에 끼지 않는다. 범례처럼, 2026-11-13 사용자)
//   @align-attachment left | right | top | bottom   곁 카드 자리(기본 right). 여럿이면 바깥 끝에서 안쪽으로:
//                                       left 왼→오 · right 오→왼 · top 위→아래 · bottom 아래→위
//   [이름] ^k3x9a2                     노드 주소(카드 머리 끝 ^ + 소문자 · 숫자 6자, 그림에는 보이지 않는다, 2026-11-16)
//     링크: ^k3x9a2                    카드 본문 줄: 그 주소의 카드로 가는 링크(↗ 표시, 미리보기에서 누르면 이 칸만 그 그림 · 카드로)
//   [ ] 이름 · [x] 이름                체크 카드(이름 왼쪽 체크 칸, 미리보기에서 누르면 [ ] ↔ [x], 2026-11-16)
//     [하위] · [ ] 하위                하위 카드(카드 머리 아래 들여 쓴 줄, 더 들여 쓰면 하위의 하위). 상위 카드 아래 차례로 쌓고 관계 줄에는 쓰지 않는다.
//                                       [이름] 뒤에 글이 이어지면(종류 · @ · # · ! · ^id 꾸밈이 아니면) 본문 줄 그대로. 시퀀스 · 데이터 모델은 하위 카드 없이 본문
// 그리기: 앞 단계에서 뒤 단계로 가는 관계로 단(층)을 나눈다(가장 긴 길). 되돌아가는 관계(루프)는 단을 거스르는 엣지로 보고 오른쪽(방향이
// 오른쪽이면 아래) 바깥으로 돌려 그리고, 자기 자신으로 가는 관계(재시도)는 카드 옆 고리로 그린다. 단 안의 차례는 이웃 평균(barycenter)으로 맞춘다.
// common.js(esc) 뒤에 읽는다. 순수 함수(flowParse · flowLayout)는 시험(web/flow.test.mjs)이 vm 으로 읽는다.

const FLOW_KINDS = { 작업: "task", 조건: "cond", 시작: "start", 끝: "end", 상태: "state", 메모: "note", 저장소: "store", 외부: "ext" };
/** 종류(diagram-design 스킬의 카드 · 관계 꼴 종류, 2026-11-13). 종류마다 기본 카드 종류 · 방향 · 연결선 모양이 다르다 */
const FLOW_TYPES = { 흐름도: "flow", flow: "flow", flowchart: "flow", 상태도: "state", state: "state", 스윔레인: "swimlane", 스웜레인: "swimlane", swimlane: "swimlane", swim: "swimlane", 레인: "swimlane", 아키텍처: "arch", architecture: "arch", "데이터 흐름": "dataflow", 데이터흐름: "dataflow", dataflow: "dataflow", 트리: "tree", tree: "tree", 시퀀스: "seq", sequence: "seq", "데이터 모델": "model", 데이터모델: "model", "data model": "model", erd: "model" };
/** 범례 기본 뜻(범례: 켬) */
const FLOW_OP_TEXT = { "->": "흐름", "-->": "되돌림 · 비동기", "=>": "주 흐름", "<->": "양방향", "<-->": "양방향(비동기)", "---": "연결", "-.-": "느슨한 연결", "~>": "외부 호출 · API" };
const FLOW_OPS = {
  "->": { arrow: "end", dash: false, bold: false },
  "-->": { arrow: "end", dash: true, bold: false },
  "=>": { arrow: "end", dash: false, bold: true },
  "<->": { arrow: "both", dash: false, bold: false },
  "<-->": { arrow: "both", dash: true, bold: false },
  "---": { arrow: "none", dash: false, bold: false },
  "-.-": { arrow: "none", dash: true, bold: false },
  "~>": { arrow: "end", dash: false, bold: false, link: true },
};
const FLOW_OP_RE = /\s(<-->|<->|-->|->|=>|~>|---|-\.-)\s/;
/** 노드 주소: 카드 머리 끝 ^ + 소문자 · 숫자 6자(2026-11-16). 메모 이름 · 카드 이름이 바뀌어도 그대로다 */
const FLOW_REF_RE = /(?:^|\s)\^([a-z0-9]{6})(?=\s|$)/;
/** 카드 본문의 링크 줄: "링크: ^id" · "link: ^id" */
const FLOW_LINK_RE = /^(?:링크|link|Link|LINK)\s*:\s*\^([a-z0-9]{6})\s*$/;
const FLOW_KIND_WORD = /^(작업|조건|시작|끝|상태|메모|저장소|외부)(?=\s|$|[@#!])/;

/** 카드 머리 꾸밈(종류 뒤 글: @묶음 · #태그 · !)을 카드에 입힌다 */
function flowDeco(card, rest) {
  const grp = /@\s*([^#!]+?)\s*(?=[#!]|$)/.exec(rest);
  if (grp) card.group = grp[1].trim();
  const tag = /#(\S+)/.exec(rest);
  if (tag) card.tag = tag[1];
  if (/(^|\s)!(\s|$)/.test(rest) || /!\s*$/.test(rest)) card.focal = true;
}

/** 머리 뒤 글에서 주소 ^id 를 뺀다 → { rest, ref } */
function flowCutRef(s) {
  const ref = FLOW_REF_RE.exec(s);
  return ref ? { rest: `${s.slice(0, ref.index)} ${s.slice(ref.index + ref[0].length)}`.trim(), ref: ref[1] } : { rest: s, ref: "" };
}

/**
 * 체크 카드 머리(2026-11-16 사용자 "체크박스 카드로 추가"): "[ ] 이름" · "[x] 이름" · "[X] 이름" → { name, done, rest 꾸밈 글, ref } | null.
 * 이름은 첫 " @" · " #글" · " !" 앞까지(이름 안 빈칸은 그대로)
 */
function flowCheckHead(t) {
  const m = /^\[( |x|X)\]\s+(\S.*)$/.exec(String(t).trim());
  if (!m) return null;
  const { rest, ref } = flowCutRef(m[2]);
  const at = /\s(?=@|#\S|!(?:\s|$))/.exec(` ${rest}`);
  const name = (at ? ` ${rest}`.slice(0, at.index) : rest).trim();
  if (!name || FLOW_OP_RE.test(` ${name} `)) return null;
  return { name, done: m[1] !== " ", rest: at ? ` ${rest}`.slice(at.index).trim() : "", ref };
}

/** 머리 뒤 글이 꾸밈(종류 · @묶음 · #태그 · ! · ^id)뿐인가. 하위 카드 줄([이름] 뒤에 글이 이어지면 본문 줄)을 가른다 */
function flowDecoOnly(rest) {
  let r = flowCutRef(String(rest ?? "")).rest.trim();
  r = r.replace(FLOW_KIND_WORD, "").trim();
  r = r.replace(/(^|\s)#\S+/g, " ").replace(/(^|\s)!(?=\s|$)/g, " ").trim();
  r = r.replace(/!$/, "").trim();
  return !r || /^@[^#!]*$/.test(r);
}

/**
 * 하위 카드 줄(들여 쓴 줄의 글) → { name, check: null | false | true, kind, rest, ref } | null.
 * "[ ] 이름" · "[x] 이름" 체크 카드, "[이름]" 뒤가 꾸밈뿐인 줄. 곁 카드 꼴([[ ]]) · 관계 줄은 아니다
 */
function flowSubHead(t) {
  const s = String(t ?? "").trim();
  if (!s.startsWith("[") || s.startsWith("[[") || FLOW_OP_RE.test(` ${s} `)) return null;
  const cb = flowCheckHead(s);
  if (cb) return { name: cb.name, check: cb.done, kind: null, rest: cb.rest, ref: cb.ref };
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(s);
  if (!m || !m[1].trim() || !flowDecoOnly(m[2])) return null;
  const { rest, ref } = flowCutRef(m[2]);
  const kindWord = FLOW_KIND_WORD.exec(rest.trim())?.[1];
  return { name: m[1].trim(), check: null, kind: kindWord ? FLOW_KINDS[kindWord] : null, rest, ref };
}

/** 들여쓰기 폭(탭은 4) */
const flowIndent = (line) => /^\s*/.exec(line)[0].replace(/\t/g, "    ").length;

/**
 * 카드 본문 줄들(raw: [{ ind, text, line }]) → 본문 · 링크 · 하위 카드(subs 가 참일 때). 하위 카드는 { name, kind, check, line(블록 안 0부터 줄 차례), depth, children, lines, … }.
 * 하위 카드 줄보다 더 들여 쓴 줄은 그 하위 카드의 것(본문 · 하위), 같거나 덜 들여 쓴 줄은 위 카드로 돌아간다
 */
function flowSubTree(n, subs) {
  const stack = [];
  for (const r of n.raw) {
    const h = subs ? flowSubHead(r.text) : null;
    while (stack.length && stack.at(-1).ind >= r.ind) stack.pop();
    const owner = stack.length ? stack.at(-1).node : n;
    if (h) {
      const c = { name: h.name, kind: h.kind ?? "task", kindSet: Boolean(h.kind), group: n.group, tag: "", focal: false, ref: h.ref, link: "", lines: [], check: h.check, line: r.line, depth: stack.length + 1, children: [] };
      flowDeco(c, h.rest);
      c.group = n.group;
      owner.children.push(c);
      stack.push({ ind: r.ind, node: c });
      continue;
    }
    // 링크 줄(2026-11-16): "링크: ^id" · "link: ^id" 는 본문 글이 아니라 그 카드의 링크(누르면 그 주소의 카드로 간다)
    const lk = FLOW_LINK_RE.exec(r.text);
    if (lk) owner.link ||= lk[1];
    else owner.lines.push(r.text);
  }
  delete n.raw;
}

/** 카드의 하위 카드 모두(쌓는 차례: 위에서 아래) */
const flowSubsOf = (n) => (n.children ?? []).flatMap((c) => [c, ...flowSubsOf(c)]);

/** 블록 글 → { title, dir, numbered, nodes: [{ name, kind, lines, children, check }], edges: [{ from, to, op, label }], errors: [{ line, text }] } */
function flowParse(text) {
  const out = { title: "", dir: "down", dirSet: false, align: null, attach: "right", attachments: [], numbered: false, type: "flow", style: "plain", legend: null, groupOrder: null, groupShape: "band", nodes: [], edges: [], errors: [] };
  const byName = new Map();
  const node = (name, kind = null) => {
    const key = name.trim();
    let n = byName.get(key);
    if (!n) {
      n = { name: key, kind: kind ?? "task", kindSet: Boolean(kind), group: "", tag: "", focal: false, ref: "", link: "", lines: [], raw: [], children: [], check: null, line: -1, head: false };
      byName.set(key, n);
      out.nodes.push(n);
    } else if (kind) {
      n.kind = kind;
      n.kindSet = true;
    }
    return n;
  };
  const clean = (s) => s.trim().replace(/^\[(.*)\]$/, "$1").trim();
  const lines = String(text ?? "").split("\n");
  /** 관계 차례 → 줄 번호(하위 카드를 쓴 관계 줄을 못 읽은 줄로) */
  const edgeLine = [];
  let card = null;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) return;
    // 카드 본문: 들여 쓴 줄은 바로 위 카드에 붙인다(본문 · 링크 · 하위 카드는 다 읽은 뒤 가른다, flowSubTree). 곁 카드는 글 그대로
    if (card && /^\s/.test(line)) {
      if (card.raw) card.raw.push({ ind: flowIndent(line), text: line.trim(), line: i });
      else card.lines.push(line.trim());
      return;
    }
    card = null;
    const t = line.trim();
    if (t.startsWith("//")) return;
    // 묶음 띠 차례(BD1-4, BD1 #5 "카드 하나를 더하면 묶음 자리가 뒤바뀐다"): @묶음 차례: 가 | 나 | 다(| , > → 로 가른다. 묶음 이름에 · 가 있어 · 로는 가르지 않는다)
    const go = /^@(묶음\s*차례|group-?order)\s*:?\s*(.+)$/i.exec(t);
    if (go) {
      out.groupOrder = go[2].split(/\s*[|,>→]\s*/).map((x) => x.trim()).filter(Boolean);
      return;
    }
    // 묶음 꼴(BD1-4, BD1 #6): @묶음 꼴: 덩어리 | 띠(기본)
    const gs = /^@(묶음\s*꼴|group-?shape)\s*:?\s*(\S+)\s*$/i.exec(t);
    if (gs) {
      out.groupShape = /^(덩어리|chunk|block|compact)$/i.test(gs[2]) ? "chunk" : "band";
      return;
    }
    // @dir · @align 지시어(2026-11-13 사용자 "방향 · 정렬을 맨 위에 @ 로")
    const side = /^@(align-attachments?|attachments?|attach|곁)\s*:?\s*(\S+)\s*$/i.exec(t);
    if (side) {
      const v = side[2].toLowerCase();
      out.attach = /^(left|왼쪽)$/.test(v) ? "left" : /^(top|위)$/.test(v) ? "top" : /^(bottom|아래)$/.test(v) ? "bottom" : "right";
      return;
    }
    const at = /^@(dir|direction|방향|align|정렬)\s*:?\s*(\S+)\s*$/i.exec(t);
    if (at) {
      const v = at[2].toLowerCase();
      if (/^(dir|direction|방향)$/i.test(at[1])) {
        out.dir = /^(right|lr|가로|오른쪽|좌우)$/.test(v) ? "right" : "down";
        out.dirSet = true;
      } else out.align = /^(left|top|왼쪽|위|start)$/.test(v) ? "start" : /^(right|bottom|오른쪽|아래|end)$/.test(v) ? "end" : /^(none|off|끔)$/.test(v) ? "none" : "center";
      return;
    }
    const head = /^(제목|title|방향|direction|dir|번호|numbers?|종류|type|스타일|style|범례|legend)\s*:\s*(.*)$/i.exec(t);
    if (head && (!FLOW_OP_RE.test(` ${t} `) || /^(범례|legend)$/i.test(head[1]))) {
      const [, k, raw] = head;
      const v = raw.trim();
      if (/^(제목|title)$/i.test(k)) out.title = v;
      else if (/^(방향|direction|dir)$/i.test(k)) {
        out.dir = /^(오른쪽|가로|right|lr)$/i.test(v) ? "right" : "down";
        out.dirSet = true;
      } else if (/^(종류|type)$/i.test(k)) out.type = FLOW_TYPES[v.toLowerCase()] ?? FLOW_TYPES[v] ?? "flow";
      else if (/^(스타일|style)$/i.test(k)) out.style = /^(에디토리얼|editorial)$/i.test(v) ? "editorial" : "plain";
      else if (/^(범례|legend)$/i.test(k)) {
        // 범례: 켬(쓴 화살표마다 기본 뜻) 또는 "-> 동기 · --> 비동기 · ~> 외부 API"
        if (/^(켬|켜기|on|true|yes|1)$/i.test(v)) out.legend = true;
        // 끔: 범례 없음(전에는 빈 목록이 되어 초점 카드가 있으면 "초점" 범례가 붙었다)
        else if (/^(끔|끄기|off|false|no|0)$/i.test(v)) out.legend = null;
        else
          out.legend = v
            .split(/\s+[·,]\s+/)
            .map((x) => /^(<-->|<->|-->|->|=>|~>|---|-\.-)\s+(.+)$/.exec(x.trim()))
            .filter(Boolean)
            .map((m) => ({ op: m[1], text: m[2].trim() }));
      } else out.numbered = /^(켬|켜기|on|true|yes|1)$/i.test(v);
      return;
    }
    // 곁 카드: [[이름]] 뒤 글은 첫 줄, 아래 들여 쓴 줄은 본문(카드와 같다)
    const att = !FLOW_OP_RE.test(` ${t} `) && /^\[\[([^\]]+)\]\]\s*(.*)$/.exec(t);
    if (att) {
      card = { name: att[1].trim(), lines: att[2].trim() ? [att[2].trim()] : [] };
      out.attachments.push(card);
      return;
    }
    // 체크 카드(2026-11-16): [ ] 이름 · [x] 이름 @묶음 #태그 ! ^id. 체크 칸을 누르면 그 줄의 [ ] ↔ [x]
    const cb = !FLOW_OP_RE.test(` ${t} `) && flowCheckHead(t);
    if (cb) {
      card = node(cb.name);
      card.check = cb.done;
      flowDeco(card, cb.rest);
      if (cb.ref) card.ref = cb.ref;
      if (!card.head) card.line = i;
      card.head = true;
      return;
    }
    // 카드 머리: [이름] 종류 @묶음 #태그 !(초점). 순서는 아무렇게나
    const cardHead = !FLOW_OP_RE.test(` ${t} `) && /^\[([^\]]+)\]\s*(.*)$/.exec(t);
    if (cardHead) {
      // 노드 주소 ^id(2026-11-16 사용자 "diagram 노드에 유니크한 주소값"): 머리 어디에 있어도 읽고 뺀 뒤 종류 · 묶음 · 태그를 읽는다
      const { rest, ref } = flowCutRef(cardHead[2]);
      const kindWord = FLOW_KIND_WORD.exec(rest.trim())?.[1];
      card = node(cardHead[1], kindWord ? FLOW_KINDS[kindWord] : null);
      flowDeco(card, rest);
      if (ref) card.ref = ref;
      if (!card.head) card.line = i;
      card.head = true;
      return;
    }
    if (FLOW_OP_RE.test(` ${t} `)) {
      // 줄 끝 ": 라벨"(이름 안의 : 와 헷갈리지 않게 앞뒤 빈칸이 있는 것만)
      // 강조(네온 형광) 표: !! · #강조 · #critical · #핵심 · #hot. 줄 어디에 있어도 그 줄의 관계 모두
      const HOT = /(^|\s)(!!|#(?:강조|핵심|critical|crit|hot))(?=\s|$)/gi;
      const hot = HOT.test(t);
      let body = ` ${t.replace(HOT, " ").replace(/\s+/g, " ").trim()} `;
      let tail = "";
      const lab = /\s:\s+(.+?)\s*$/.exec(body);
      if (lab && FLOW_OP_RE.test(body.slice(0, lab.index + 1))) {
        tail = lab[1].trim();
        body = `${body.slice(0, lab.index)} `;
      }
      const parts = body.split(FLOW_OP_RE);
      // parts: 이름, 화살표, 이름, 화살표, 이름 …
      let prev = clean(parts[0]);
      if (!prev) return out.errors.push({ line: i + 1, text: t });
      for (let k = 1; k < parts.length; k += 2) {
        let next = parts[k + 1] ?? "";
        let label = "";
        const inline = /^\s*\|([^|]*)\|\s*(.*)$/.exec(next);
        if (inline) {
          label = inline[1].trim();
          next = inline[2];
        }
        next = clean(next);
        if (!next) {
          out.errors.push({ line: i + 1, text: t });
          break;
        }
        out.edges.push({ from: node(prev).name, to: node(next).name, op: parts[k], label: label || tail, hot });
        edgeLine.push(i + 1);
        prev = next;
      }
      return;
    }
    out.errors.push({ line: i + 1, text: t });
  });
  // 하위 카드(2026-11-16 사용자 "한 노드의 하위 노드를 추가, 하위에 하위를 줄 수도"): 시퀀스 · 데이터 모델은 본문 줄 그대로(참여자 · 칸 줄을 읽는 쪽이 따로 있다)
  const subs = out.type !== "seq" && out.type !== "model";
  for (const n of out.nodes) {
    flowSubTree(n, subs);
    if (!subs) n.check = null;
  }
  // 하위 카드는 관계 줄에 쓰지 않는다: 머리 줄 없는 이름이 하위 카드 이름이면 그 관계는 버리고 그 줄을 못 읽은 줄로(상위 카드로 바꿔 잇지 않는다)
  const subNames = new Set(out.nodes.flatMap((n) => flowSubsOf(n).map((c) => c.name)));
  const bad = (x) => subNames.has(x) && !byName.get(x)?.head;
  if (out.edges.some((e) => bad(e.from) || bad(e.to))) {
    const lost = new Map();
    out.edges = out.edges.filter((e, k) => {
      const b = [e.from, e.to].find(bad);
      if (b && !lost.has(edgeLine[k])) lost.set(edgeLine[k], b);
      return !b;
    });
    for (const [ln, name] of lost) out.errors.push({ line: ln, text: lines[ln - 1].trim(), why: `하위 카드 "${name}" 는 관계 줄에 쓰지 않습니다(상위 카드로 잇습니다)` });
    out.errors.sort((a, b) => a.line - b.line);
    const used = new Set(out.edges.flatMap((e) => [e.from, e.to]));
    out.nodes = out.nodes.filter((n) => n.head || used.has(n.name));
  }
  // 종류별 기본: 상태도는 종류를 적지 않은 카드가 상태.
  // 방향(2026-11-16 BD1 #7 "스윔레인 기본 오른쪽은 2.1k ~ 2.7k px, 트리 기본 아래는 잎 17개에서 4082px"): 스윔레인은 적지 않으면 아래(전에는 오른쪽),
  // 트리는 적지 않으면 잎 카드 폭의 합이 메모 칸(약 760px)보다 넓을 때 오른쪽. 적은 @dir · 방향: 은 그대로
  if (out.type === "state") for (const n of out.nodes) if (!n.kindSet) n.kind = "state";
  if (out.type === "tree" && !out.dirSet) {
    const parents = new Set(out.edges.filter((e) => e.from !== e.to).map((e) => e.from));
    const leaves = out.nodes.filter((n) => !parents.has(n.name));
    const span = leaves.reduce((a, n) => a + flowMeasure(n, null, out).w, 0) + FLOW.gapCross * Math.max(0, leaves.length - 1);
    if (span > FLOW_TREE_WIDE) out.dir = "right";
  }
  return out;
}

// MARK: 크기(글 폭 어림: 한글 · 한자 1em, 그 밖 0.6em)

const FLOW = { title: 12.5, body: 11.5, lh: 16, padX: 12, padY: 9, maxText: 196, gapCross: 28, gapMain: 60, dummy: 10, loop: 30, linkW: 13, check: 17, subGap: 7, subInd: 16 };
/** 트리 기본 방향: 잎 카드 폭의 합이 이보다 넓으면 오른쪽(메모 미리보기 칸 폭 어림) */
const FLOW_TREE_WIDE = 760;
/** 카드 · 라벨 글의 `코드` 자리 표(짝 백틱을 이 글자로 바꿔 감고 잰다. 폭 0, 그릴 때 고정폭 tspan) */
const FLOW_CODE = "\u0001";
const flowCharW = (c, fs) => (c === FLOW_CODE ? 0 : /[ᄀ-ᇿ㄰-㆏가-힣一-鿿　-〿＀-￯]/.test(c) ? fs : fs * 0.6);
const flowTextW = (s, fs) => [...String(s)].reduce((a, c) => a + flowCharW(c, fs), 0);
/** 묶음 · 레인 이름 뱃지 폭(글 10.5px + 앞뒤 8) */
const flowBadgeW = (s) => Math.ceil(flowTextW(s, 10.5) + 16);
/** 짝 백틱(2개 이상 짝수)이면 코드 자리 표로 바꾼다(BD1 #12: 카드 글의 백틱이 그대로 찍혔다). 짝이 없으면 글 그대로 */
const flowCodeMarks = (s) => {
  const t = String(s ?? "");
  const n = (t.match(/`/g) ?? []).length;
  return n >= 2 && n % 2 === 0 ? t.replace(/`/g, FLOW_CODE) : t;
};
/** 그림 밖 글(title · 알림)에 쓰는 글: 짝 백틱을 뺀다 */
const flowPlain = (s) => flowCodeMarks(s).split(FLOW_CODE).join("");
/** 라벨 상자 폭(글 11px + 앞뒤 5) */
const flowLabelW = (s) => Math.ceil(flowTextW(flowCodeMarks(s), 11) + 10);
/** 자르기 좋은 자리: 이 글자 뒤(경로 · 파일 · 이름의 / . - _ · , : ;) */
const FLOW_BREAK = /[^/.\-_·,:;]*[/.\-_·,:;]+|[^/.\-_·,:;]+/g;
/**
 * 한 줄을 max 폭으로 감는다: 빈칸에서 먼저, 빈칸 없이 긴 낱말은 / . - _ · 뒤에서(BD1 #12 "plugin-builder-software.js / on" 처럼 글자 가운데에서 잘렸다),
 * 그래도 긴 조각은 hard(max 의 1.7배)까지 한 줄로 두어 카드를 넓히고, 그보다 길 때만 글자에서 자른다.
 * 감은 줄마다 코드 자리 표(FLOW_CODE)의 짝을 맞춘다(줄을 넘는 코드는 줄마다 닫고 연다)
 */
function flowWrap(s, fs, max, hard = max * 1.7) {
  const W = (x) => flowTextW(x, fs);
  const out = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  for (const word of flowCodeMarks(s).split(/(\s+)/)) {
    if (W(cur + word) <= max) {
      cur += word;
      continue;
    }
    if (!word.trim()) {
      push();
      continue;
    }
    if (W(word) <= max) {
      push();
      cur = word;
      continue;
    }
    // 한 줄보다 긴 낱말: 지금 줄 뒤에 조각을 이어 붙이며 감는다. 끝 조각이 4자 이하(.json · .md 같은 꼬리)면 앞 조각과 붙여 홀로 남지 않게
    const pieces = word.match(FLOW_BREAK) ?? [word];
    if (pieces.length > 1 && [...pieces.at(-1)].length <= 4) pieces.splice(-2, 2, pieces.at(-2) + pieces.at(-1));
    for (const p of pieces) {
      if (W(cur + p) <= max) {
        cur += p;
        continue;
      }
      push();
      if (W(p) <= hard) {
        cur = p;
        continue;
      }
      for (const c of p) {
        if (W(cur + c) > hard && cur) push();
        cur += c;
      }
    }
  }
  if (cur.trim() || !out.length) out.push(cur.trim());
  // 코드 자리 표 짝 맞추기
  let open = false;
  return out.map((line) => {
    const head = open ? FLOW_CODE : "";
    if ((line.split(FLOW_CODE).length - 1) % 2) open = !open;
    return `${head}${line}${open ? FLOW_CODE : ""}`;
  });
}
/** 한 줄 글(코드 자리 표 포함) → SVG 글(코드 조각은 고정폭 tspan) */
const flowTextSvg = (s) =>
  String(s)
    .split(FLOW_CODE)
    .map((part, i) => (i % 2 ? (part ? `<tspan class="fl-code">${esc(part)}</tspan>` : "") : esc(part)))
    .join("");
/** 상태도 시작 · 끝 점에서 이름을 보이지 않는 기본 이름 */
const FLOW_DOT_PLAIN = /^(시작|끝|처음|start|end|begin|finish|done)$/i;
/** 카드의 그릴 줄과 크기. 상태도의 시작 · 끝은 점(글 없이). 기본 이름(시작 · 끝 …)이 아니면 점 옆에 이름(dotLabel, BD1 #13 "지움" 같은 끝 이름이 사라졌다) */
function flowMeasure(n, no, g = {}) {
  if (g.type === "state" && (n.kind === "start" || n.kind === "end")) return { title: [], body: [], w: 20, h: 20, dot: true, dotLabel: FLOW_DOT_PLAIN.test(n.name.trim()) ? "" : flowPlain(n.name) };
  // 링크 표시(↗, 오른쪽 위, 태그가 있으면 그 왼쪽) 자리는 태그 자리에 더한다
  const tagW = (n.tag ? flowTextW(n.tag, 8.5) + 12 : 0) + (n.link ? FLOW.linkW + (n.tag ? 6 : 0) : 0);
  // 체크 카드: 이름 왼쪽 체크 칸 자리(FLOW.check)
  const ck = n.check != null ? FLOW.check : 0;
  const title = flowWrap(`${no ? `${no}. ` : ""}${n.name}`, FLOW.title, FLOW.maxText - tagW - ck);
  const body = n.lines.flatMap((l) => {
    const dot = /^[-*]\s+/.test(l);
    const t = dot ? l.replace(/^[-*]\s+/, "") : l;
    return flowWrap(t, FLOW.body, FLOW.maxText - (dot ? 12 : 0)).map((x, k) => ({ text: x, dot: dot && k === 0, indent: dot }));
  });
  const textW = Math.max(...title.map((t) => flowTextW(t, FLOW.title) + (n.kind === "cond" ? 14 : 0) + ck + (tagW ? tagW + 8 : 0)), ...body.map((b) => flowTextW(b.text, FLOW.body) + (b.indent ? 12 : 0)), 40);
  const w = Math.ceil(textW + FLOW.padX * 2);
  const h = Math.ceil(FLOW.padY * 2 + title.length * FLOW.lh + (body.length ? 6 + body.length * FLOW.lh : 0) + (n.kind === "store" ? 6 : 0));
  return { title, body, w, h, tagW };
}

// MARK: 배치

/**
 * 하위 카드 쌓음(2026-11-16 사용자 "하위 노드는 아래에 일렬로 순차적으로 채워지면 됨"): 상위 카드(pw × ph) 아래에 위에서부터 차례로 한 줄씩(사이 FLOW.subGap),
 * 깊이마다 왼쪽에서 FLOW.subInd 들여 쓴다. 좌표는 상위 카드 왼쪽 위 기준 화면 좌표(방향과 상관없이 늘 아래로 쌓는다).
 * → { items: [{ node, m(flowMeasure), x, y, depth }], tree: [{ x 세로 줄 자리, y0 위 카드 아래 끝, ys 하위 카드 가운데 높이들, x1 하위 카드 왼쪽 }], W, H 전체 상자, last 맨 아래 카드 }
 */
function flowSubStack(n, pw, ph) {
  const items = [];
  const tree = [];
  let y = ph;
  const walk = (p, px, py, h, depth) => {
    const kids = [];
    for (const k of p.children ?? []) {
      y += FLOW.subGap;
      const it = { node: k, m: flowMeasure(k, null, {}), x: px + FLOW.subInd, y, depth };
      items.push(it);
      kids.push(it);
      y += it.m.h;
      walk(k, it.x, it.y, it.m.h, depth + 1);
    }
    if (kids.length) tree.push({ x: px + FLOW.subInd / 2, y0: py + h, ys: kids.map((it) => it.y + it.m.h / 2), x1: px + FLOW.subInd });
  };
  walk(n, 0, 0, ph, 1);
  return { items, tree, W: Math.max(pw, ...items.map((it) => it.x + it.m.w)), H: y, last: items.at(-1) ?? null };
}

/** 칸(flowLayoutOnce 의 cells 하나)에 하위 카드 쌓음을 입힌다: c.sub, 칸의 가로(cross) · 주 축(main) 크기 */
function flowSubCell(c, down) {
  c.sub = flowSubStack(c.node, c.w, c.h);
  c.cross = down ? c.sub.W : c.sub.H;
  c.main = down ? c.sub.H : c.sub.W;
}

/** SVG 길(M · L · C · Q 절대 좌표, flowLayout 이 짓는 꼴) → 촘촘한 점 [[x, y, 누적 길이]] */
function flowPathPts(d) {
  const t = String(d).match(/[MLCQ]|-?\d+(?:\.\d+)?/g) ?? [];
  const out = [];
  let i = 0;
  let cmd = "M";
  let cur = [0, 0];
  let len = 0;
  const num = () => Number(t[i++]);
  const add = (p) => {
    if (out.length) len += Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]);
    out.push([p[0], p[1], len]);
  };
  while (i < t.length) {
    if (/^[MLCQ]$/.test(t[i])) cmd = t[i++];
    if (cmd === "M" || cmd === "L") add((cur = [num(), num()]));
    else if (cmd === "C") {
      const [a, b, c] = [[num(), num()], [num(), num()], [num(), num()]];
      const p = cur;
      for (let s = 1; s <= 12; s++) {
        const u = s / 12;
        const v = 1 - u;
        add([0, 1].map((j) => v * v * v * p[j] + 3 * v * v * u * a[j] + 3 * v * u * u * b[j] + u * u * u * c[j]));
      }
      cur = c;
    } else if (cmd === "Q") {
      const [a, c] = [[num(), num()], [num(), num()]];
      const p = cur;
      for (let s = 1; s <= 6; s++) {
        const u = s / 6;
        const v = 1 - u;
        add([0, 1].map((j) => v * v * p[j] + 2 * v * u * a[j] + u * u * c[j]));
      }
      cur = c;
    } else break;
  }
  return out;
}
/** 길 위 길이 비율 f(0 ~ 1) 자리 [x, y] */
function flowPathAt(pts, f) {
  if (!pts.length) return [0, 0];
  const want = pts.at(-1)[2] * f;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][2] < want) continue;
    const [x0, y0, l0] = pts[i - 1];
    const [x1, y1, l1] = pts[i];
    const u = l1 > l0 ? (want - l0) / (l1 - l0) : 0;
    return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
  }
  return [pts.at(-1)[0], pts.at(-1)[1]];
}
/**
 * 라벨 겹침 풀기(BD1 #2): 라벨 상자(e.lbox)가 막는 것(obs: 카드 · 점 이름 · 뱃지)이나 먼저 놓인 라벨과 겹치면 제 선을 따라 다른 자리(길이 50 · 38 · 62 … %)로 밀고,
 * 그래도 겹치면 그 자리들에서 위아래 · 옆으로 비킨 자리, 다 안 되면 겹침이 가장 적은 자리.
 * 자기 고리 라벨(BD1-4, 3-3 켬 "이름 바꾸기 …" 가 지나가는 남의 선에 붙었다)도 먼저 놓되, 남의 선이 상자 둘레 12 안에 들거나 제 고리를 덮으면 고리 둘레(위아래 · 바깥쪽)로 비킨다.
 * 차례: 자기 고리 → 강조(!!) · 굵은 선 → 적은 차례. 다른 선을 덮는 길이(5px 마다 25, 자기 고리 라벨 둘레 12 안은 4), W · H 밖으로 나가는 만큼도 벌점(그림이 그만큼 커진다)
 */
function flowUnclutter(edges, obs, W, H) {
  const r1 = (n) => Math.round(n * 10) / 10;
  const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + 3) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + 3);
  const hits = (a, b, m = 3) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
  /** 자기 고리 라벨이 남의 선과 띄울 거리 */
  const SELF_CLEAR = 12;
  // 선마다 5px 간격 점(라벨이 남의 선을 덮으면 어느 선 라벨인지 헷갈린다, BD1 #11)
  const dense = edges.map((e) => {
    const pts = flowPathPts(e.path);
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const n = Math.max(1, Math.ceil((pts[i][2] - pts[i - 1][2]) / 5));
      for (let j = 0; j < n; j++) out.push([pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * j) / n, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * j) / n]);
    }
    return out;
  });
  // 선마다 둘레 상자(라벨 상자와 닿지 않는 선은 점을 세지 않는다)
  const bbox = dense.map((pts) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return pts.length ? { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } : null;
  });
  const placed = [];
  /** 벌점(limit 를 넘으면 더 세지 않는다) */
  const cost = (b, me, limit = Infinity) => {
    let c = (Math.max(0, -b.x) + Math.max(0, b.x + b.w - W) + Math.max(0, -b.y) + Math.max(0, b.y + b.h - H)) * 6;
    for (const o of obs) if (hits(b, o) && (c += area(b, o)) >= limit) return c;
    for (const o of placed) if (hits(b, o) && (c += area(b, o)) >= limit) return c;
    // 자기 고리 라벨: 제 고리도 덮지 않게 세고(다른 라벨은 제 선을 세지 않는다), 남의 선이 둘레 SELF_CLEAR 안에 들면 점마다 4
    const m = me.self ? SELF_CLEAR : 0;
    for (let i = 0; i < dense.length; i++) {
      const own = edges[i] === me;
      if ((own && !me.self) || !bbox[i] || !hits(b, bbox[i], own ? 3 : m + 3)) continue;
      for (const [x, y] of dense[i]) {
        if (x > b.x - 1 && x < b.x + b.w + 1 && y > b.y - 1 && y < b.y + b.h + 1) {
          if ((c += 25) >= limit) return c;
        } else if (m && !own && x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m && (c += 4) >= limit) return c;
      }
    }
    return c;
  };
  const rank = (e) => (e.self ? 0 : e.hot || FLOW_OPS[e.op]?.bold ? 1 : 2);
  const list = edges.filter((e) => e.lbox).sort((a, b) => rank(a) - rank(b));
  const FR = [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8, 0.12, 0.88];
  for (const e of list) {
    const b0 = e.lbox;
    if (!cost(b0, e)) {
      placed.push(b0);
      continue;
    }
    let cands;
    if (e.self) {
      // 자기 고리 라벨: 고리 옆 자리에서 위아래로, 고리에서 먼 쪽으로(세로 방향은 왼쪽 · 가로 방향은 위 · 옆). 고리에서 멀어지지 않게 조금씩만
      const shift = (dx, dy) => ({ x: r1(b0.x + dx), y: r1(b0.y + dy), w: b0.w, h: 18 });
      const dys = [-12, 12, -22, 22, -32, 32];
      cands = e.anchor === "end" ? [...dys.map((dy) => shift(0, dy)), ...[0, ...dys].flatMap((dy) => [shift(-14, dy), shift(-28, dy)])] : [-22, -44].flatMap((dy) => [shift(0, dy), shift(-b0.w / 2 - 12, dy + 22), shift(b0.w / 2 + 12, dy + 22)]);
    } else {
      const pts = flowPathPts(e.path);
      const at = FR.map((f) => flowPathAt(pts, f));
      const box = ([x, y], dx = 0, dy = 0) => ({ x: r1(x - b0.w / 2 + dx), y: r1(y - 9 + dy), w: b0.w, h: 18 });
      cands = [...at.map((p) => box(p)), ...at.flatMap((p) => [box(p, 0, -22), box(p, 0, 22), box(p, b0.w / 2 + 12, 0), box(p, -b0.w / 2 - 12, 0)])];
    }
    let best = b0;
    let bestC = cost(b0, e);
    for (const b of cands) {
      const c = cost(b, e, bestC);
      if (c < bestC - 1e-6) {
        best = b;
        bestC = c;
        if (!c) break;
      }
    }
    e.lbox = best;
    placed.push(best);
  }
}

/**
 * 그래프 → { nodes: [{ name, kind, title, body, w, h, x, y }], edges: [{ …edge, path, lx, ly, back, self }], width, height }.
 * x · y 는 카드 왼쪽 위. 방향이 아래면 단이 y, 오른쪽이면 단이 x.
 * 묶음 띠 차례(BD1-4, BD1 #2 · #5 "긴 선이 묶음 띠 여럿을 가로지른다"): @묶음 차례 를 적지 않았고 띠가 셋 ~ 일곱이면, 묶음 사이 관계가 건너는 띠 수(관계 수 × 사이 띠 수)가
 * 가장 적은 차례를 다 세어 보고, 지금 차례보다 적으면 그 차례로 띠를 차례대로 놓은 판도 그려 본다. 남의 묶음 영역을 지나는 선이 줄고 그림이 1.2배 넘게 커지지 않으면 그 판.
 * g.bandAuto === false 면 고르지 않는다(시험)
 */
function flowLayout(g) {
  const L = flowLayoutOnce(g);
  const keys = L.bandKeys;
  if (!keys || g.groupOrder || g.bandAuto === false || keys.length < 3 || keys.length > 7) return L;
  const grp = new Map(g.nodes.map((n) => [n.name, n.group ?? ""]));
  const w = new Map();
  for (const e of g.edges) {
    const a = grp.get(e.from) ?? "";
    const b = grp.get(e.to) ?? "";
    if (a === b) continue;
    const k = [a, b].sort().join("\u0002");
    w.set(k, (w.get(k) ?? 0) + 1);
  }
  const cost = (order) => {
    const at = new Map(order.map((x, i) => [x, i]));
    let c = 0;
    for (const [k, n] of w) {
      const [a, b] = k.split("\u0002");
      c += n * Math.max(0, Math.abs(at.get(a) - at.get(b)) - 1);
    }
    return c;
  };
  // 차례 셈: 같은 값이면 지금 차례에 가까운 것(자리 차이 합)
  const near = (order) => order.reduce((a, x, i) => a + Math.abs(i - keys.indexOf(x)), 0);
  let best = keys;
  let bc = cost(keys);
  let bn = 0;
  const perm = (list, rest) => {
    if (!rest.length) {
      const c = cost(list);
      const d = near(list);
      if (c < bc || (c === bc && d < bn)) [best, bc, bn] = [list, c, d];
      return;
    }
    rest.forEach((x, i) => perm([...list, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  perm([], keys);
  if (best === keys) return L;
  const M = flowLayoutOnce({ ...g, bandOrder: best });
  return flowBandCross(M) < flowBandCross(L) && M.width * M.height <= L.width * L.height * 1.2 ? M : L;
}

/** 선마다 제 출발 · 도착 묶음이 아닌 묶음 영역을 몇 개 지나나(합). 묶음 띠 차례 고르기가 쓴다 */
function flowBandCross(L) {
  const grp = new Map(L.nodes.map((n) => [n.name, n.group]));
  let n = 0;
  for (const e of L.edges) {
    const pts = flowPathPts(e.path);
    const others = L.boxes.filter((b) => b.name !== grp.get(e.from) && b.name !== grp.get(e.to));
    const hit = new Set();
    for (let i = 1; i < pts.length; i++) {
      const k = Math.max(1, Math.ceil(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / 6));
      for (let j = 0; j <= k; j++) {
        const x = pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * j) / k;
        const y = pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * j) / k;
        for (const b of others) if (x > b.x + 2 && x < b.x + b.w - 2 && y > b.y + 2 && y < b.y + b.h - 2) hit.add(b.name);
      }
    }
    n += hit.size;
  }
  return n;
}

/** flowLayout 한 판(띠 차례는 g.groupOrder · g.bandOrder 가 있으면 그 차례, 없으면 위에서 끈 자리) */
function flowLayoutOnce(g) {
  const names = g.nodes.map((n) => n.name);
  const idx = new Map(names.map((n, i) => [n, i]));
  const N = names.length;
  const outs = names.map(() => []);
  const ins = names.map(() => []);
  g.edges.forEach((e, k) => {
    if (e.from === e.to) return;
    outs[idx.get(e.from)].push({ to: idx.get(e.to), k });
  });
  // 되돌아가는 관계(루프): 들어오는 관계가 없는 카드부터 DFS 하며 지금 길 위의 카드로 가는 관계
  const st = new Array(N).fill(0);
  const back0 = new Set();
  const order = [];
  const dfs = (v) => {
    st[v] = 1;
    order.push(v);
    for (const { to, k } of outs[v]) {
      if (st[to] === 1) back0.add(k);
      else if (!st[to]) dfs(to);
    }
    st[v] = 2;
  };
  const indeg = new Array(N).fill(0);
  g.edges.forEach((e) => e.from !== e.to && indeg[idx.get(e.to)]++);
  for (let v = 0; v < N; v++) if (!indeg[v] && !st[v]) dfs(v);
  for (let v = 0; v < N; v++) if (!st[v]) dfs(v);
  // 루프 고르기(2026-11-14 사용자 "선의 흐름이 가장 매끄럽게"): 굵은 · 강조 관계 → 보통 → 점선 차례로 넣고, 넣으면 고리가 생기는 관계만 루프로 본다.
  // DFS 만으로는 점선(--> 내려받아 고치기)을 먼저 따라가 주 흐름(=> !!)이 루프로 잡혀 그림 바깥을 돌았다. 같은 차례 안에서는 DFS 가 앞으로 본 관계 먼저
  const prio = (e) => {
    const o = FLOW_OPS[e.op] ?? FLOW_OPS["->"];
    return e.hot || o.bold ? 0 : o.dash ? 2 : 1;
  };
  const dag = names.map(() => []);
  const reaches = (s, t) => {
    const seen = new Set([s]);
    const stack = [s];
    while (stack.length) {
      const v = stack.pop();
      if (v === t) return true;
      for (const u of dag[v]) if (!seen.has(u)) seen.add(u) && stack.push(u);
    }
    return false;
  };
  const back = new Set();
  g.edges
    .map((e, k) => k)
    .filter((k) => g.edges[k].from !== g.edges[k].to)
    .sort((x, y) => prio(g.edges[x]) - prio(g.edges[y]) || back0.has(x) - back0.has(y) || x - y)
    .forEach((k) => {
      const a = idx.get(g.edges[k].from);
      const b = idx.get(g.edges[k].to);
      if (reaches(b, a)) back.add(k);
      else dag[a].push(b);
    });
  // 단: 앞으로 가는 관계로 가장 긴 길
  const fwd = g.edges.map((e, k) => e.from !== e.to && !back.has(k));
  g.edges.forEach((e, k) => fwd[k] && ins[idx.get(e.to)].push({ from: idx.get(e.from), k }));
  const rank = new Array(N).fill(-1);
  const rankOf = (v, seen = new Set()) => {
    if (rank[v] >= 0) return rank[v];
    if (seen.has(v)) return 0;
    seen.add(v);
    rank[v] = ins[v].length ? Math.max(...ins[v].map(({ from }) => rankOf(from, seen) + 1)) : 0;
    return rank[v];
  };
  for (let v = 0; v < N; v++) rankOf(v);
  // 묶음 꼴 덩어리(BD1-4, BD1 #6 "묶음 상자가 단 범위 전체를 차지해 큰 빈자리가 생기고 남의 선이 지나간다"): 묶음마다 앞으로 나가는 관계가 없는 카드
  // (외부 · 저장소처럼 받기만 하는 끝 카드)를 그 묶음 끝 카드 중 가장 뒤 단으로 모은다. 받기만 하니 단을 뒤로 미뤄도 흐름이 거꾸로 되지 않는다
  if (g.groupShape === "chunk") {
    const last = new Map();
    const sink = (v) => g.nodes[v].group && !outs[v].some(({ k }) => fwd[k]);
    for (let v = 0; v < N; v++) if (sink(v)) last.set(g.nodes[v].group, Math.max(last.get(g.nodes[v].group) ?? 0, rank[v]));
    for (let v = 0; v < N; v++) if (sink(v)) rank[v] = last.get(g.nodes[v].group);
  }
  // 트리 배치(2026-11-16 사용자 "트리는 각 위계에 맞춰 정렬, 나가는 선은 한곳에서 · 들어오는 선은 노드 중앙, 하위 노드가 2개면 양쪽 균일하게 상위 노드를 중앙에,
  // 홀수면 가운데 노드가 상위 노드와 정렬"): 종류가 트리이고 모든 카드의 위 카드가 하나 이하(숲)일 때만. 아니면 흐름도와 같은 배치
  const forest = g.type === "tree" && ins.every((x) => x.length <= 1);
  // 흐름 차례 번호(단 · DFS 차례)
  const seq = [...order].sort((a, b) => rank[a] - rank[b] || order.indexOf(a) - order.indexOf(b));
  const numbers = new Map();
  let no = 0;
  for (const v of seq) if (g.numbered && g.nodes[v].kind !== "note") numbers.set(v, ++no);
  const down = g.dir !== "right";
  // 칸(진짜 카드 + 여러 단을 건너는 관계의 중간 점)
  // 자기 자신으로 가는 관계(재시도) 고리는 카드 앞쪽(아래 방향이면 왼쪽, 오른쪽 방향이면 위)에 그린다. 그 자리(pre)를 비워 둔다
  // (뒤쪽은 루프 길이 지나가 고리 · 라벨과 겹치지 않게)
  // 자기 고리가 둘 이상이면(BD1 #10 "고리와 라벨이 겹친다") 카드 앞쪽 변을 고리 수만큼 칸으로 나눠 따로 그리고 라벨도 따로 놓는다
  const selfs = names.map(() => []);
  g.edges.forEach((e, k) => e.from === e.to && selfs[idx.get(e.from)].push(k));
  const selfLabel = selfs.map((ks) => (ks.length ? ks.map((k) => g.edges[k].label ?? "").reduce((a, x) => (flowLabelW(x) > flowLabelW(a) ? x : a), "") : null));
  const cells = g.nodes.map((n, v) => {
    const m = flowMeasure(n, numbers.get(v), g);
    const sl = selfLabel[v];
    const pre = sl == null ? 0 : FLOW.loop + 8 + (sl ? (down ? flowLabelW(sl) + 8 : 26 + 20 * (selfs[v].length - 1)) : 0);
    const c = { v, real: true, rank: rank[v], cross: down ? m.w : m.h, main: down ? m.h : m.w, pre, lpad: 0, ...m, node: n };
    // 상태도 점 이름 자리(BD1 #13): 끝은 점 뒤(아래 · 오른쪽), 시작은 점 앞(위 · 왼쪽). 주 축으로 칸을 늘리고,
    // 세로 방향은 이름이 점보다 넓은 만큼 양옆을 비운다(lpad, 옆 카드 · 옆 이름과 겹치지 않게. 선은 점 가운데로)
    if (m.dotLabel) {
      c.dlw = Math.ceil(flowTextW(m.dotLabel, 11.5) + 6);
      if (down) {
        c.main = 20 + 18;
        c.lpad = Math.max(0, (c.dlw - 20) / 2);
      } else c.main = 20 + 6 + c.dlw;
    }
    // 하위 카드가 있으면 상위 카드 + 쌓은 하위 카드를 한 칸으로(칸 크기 = 모두 감싼 상자). c.w · c.h 는 상위 카드 크기 그대로
    if (n.children?.length && !m.dot) flowSubCell(c, down);
    return c;
  });
  const segs = []; // 앞으로 가는 관계를 단 하나씩 잇는 조각
  const chains = new Map(); // 관계 k → 칸 번호들
  g.edges.forEach((e, k) => {
    if (!fwd[k]) return;
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    const chain = [a];
    for (let r = rank[a] + 1; r < rank[b]; r++) {
      cells.push({ v: cells.length, real: false, rank: r, cross: FLOW.dummy, main: 0, pre: 0 });
      chain.push(cells.length - 1);
    }
    chain.push(b);
    chains.set(k, chain);
    for (let i = 0; i + 1 < chain.length; i++) segs.push([chain[i], chain[i + 1]]);
  });
  // 한 변에 선이 여럿이면 꺾쇠끼리 겹치지 않게 카드 변을 늘린다(선 하나에 PORT, 2026-11-14 사용자 "노드 좌측에 3개 이상의 선이 겹친다").
  // 오른쪽 방향은 카드가 높아지므로 글을 세로 가운데로 내린다(oy)
  const PORT = 18;
  const nOut = cells.map(() => 0);
  const nIn = cells.map(() => 0);
  chains.forEach((chain) => {
    nOut[chain[0]]++;
    nIn[chain.at(-1)]++;
  });
  cells.forEach((c, v) => {
    if (!c.real || c.dot || forest) return;
    if (c.sub) {
      // 하위 카드가 있는 칸: 선이 붙는 상위 카드 변만 늘린다(세로 방향은 들어오는 위 변, 가로 방향은 왼쪽 · 오른쪽 변)
      const need = ((down ? nIn[v] : Math.max(nOut[v], nIn[v])) + 1) * PORT;
      if ((down ? c.w : c.h) >= need) return;
      if (down) c.w = need;
      else {
        c.oy = (need - c.h) / 2;
        c.h = need;
      }
      return flowSubCell(c, down);
    }
    const need = (Math.max(nOut[v], nIn[v]) + 1) * PORT;
    if (c.cross >= need) return;
    if (!down) c.oy = (need - c.cross) / 2;
    c.cross = need;
    if (down) c.w = need;
    else c.h = need;
  });
  const R = Math.max(0, ...cells.map((c) => c.rank)) + 1;
  const layers = Array.from({ length: R }, () => []);
  // 처음 차례: DFS 차례(중간 점은 만든 차례)
  const first = new Map(order.map((v, i) => [v, i]));
  cells.forEach((c) => layers[c.rank].push(c.v));
  layers.forEach((L) => L.sort((a, b) => (first.get(a) ?? 1e6 + a) - (first.get(b) ?? 1e6 + b)));
  const up = cells.map(() => []);
  const dn = cells.map(() => []);
  for (const [a, b] of segs) {
    dn[a].push(b);
    up[b].push(a);
  }
  // 묶음(@): 단 안에서 같은 묶음끼리 모은다(경계 상자 · 레인이 다른 카드를 품지 않게). 중간 점은 나가는 카드의 묶음
  const groupNames = [...new Set(g.nodes.map((n) => n.group).filter(Boolean))];
  // 띠 차례를 받았으면 단 안 묶음 차례도 그 차례(색은 groupNames 의 처음 나온 차례 그대로)
  const bandOrder = g.groupOrder ?? g.bandOrder ?? null;
  const gidx = new Map((bandOrder ? [...bandOrder.filter((x) => groupNames.includes(x)), ...groupNames.filter((x) => !bandOrder.includes(x))] : groupNames).map((x, i) => [x, i]));
  const groupOfCell = cells.map((c) => (c.real ? c.node.group : ""));
  chains.forEach((chain) => chain.slice(1, -1).forEach((v) => (groupOfCell[v] = groupOfCell[chain[0]])));
  const gKey = (v) => (groupOfCell[v] ? gidx.get(groupOfCell[v]) : -1);
  const lanes = g.type === "swimlane";
  if (groupNames.length) layers.forEach((L) => L.sort((a, b) => gKey(a) - gKey(b)));
  const pos = new Map();
  const reindex = () => layers.forEach((L) => L.forEach((v, i) => pos.set(v, i)));
  reindex();
  const bary = (v, nb) => (nb[v].length ? nb[v].reduce((a, u) => a + pos.get(u), 0) / nb[v].length : pos.get(v));
  // 루프 끝 카드는 단(묶음) 안 뒤 끝으로 보낸다(2026-11-14): 단의 바깥 끝이어야 루프가 카드 옆 변으로 나가 꺾임 둘로 돈다(아니면 꺾임 넷, 디귿자)
  const loopEnd = new Set(g.edges.flatMap((e, k) => (e.from !== e.to && back.has(k) ? [idx.get(e.from), idx.get(e.to)] : [])));
  for (let it = 0; it < 6; it++) {
    const goingDown = it % 2 === 0;
    const rs = goingDown ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const L of rs) {
      const key = new Map(L.map((v) => [v, bary(v, goingDown ? up : dn) + (loopEnd.has(v) ? 1e4 : 0)]));
      L.sort((a, b) => (groupNames.length ? gKey(a) - gKey(b) : 0) || key.get(a) - key.get(b));
      L.forEach((v, i) => pos.set(v, i));
    }
  }
  // 가로(단 안) 자리: 이웃 가운데로 끌되 겹치지 않게(왼쪽에서 밀고 오른쪽에서 당긴다)
  const at = new Map();
  // 칸 하나가 차지하는 폭 = 앞 빈자리(pre) + 카드. at 은 카드 가운데
  const box = (v) => cells[v].pre + cells[v].cross + 2 * (cells[v].lpad ?? 0);
  const off = (v) => cells[v].pre + (cells[v].lpad ?? 0) + cells[v].cross / 2;
  layers.forEach((L) => {
    let x = 0;
    for (const v of L) {
      at.set(v, x + off(v));
      x += box(v) + FLOW.gapCross;
    }
  });
  const place = (L, nb) => {
    const want = L.map((v) => (nb[v].length ? nb[v].reduce((a, u) => a + at.get(u), 0) / nb[v].length : at.get(v)));
    const s = L.map((v, i) => want[i] - off(v));
    for (let i = 1; i < L.length; i++) s[i] = Math.max(s[i], s[i - 1] + box(L[i - 1]) + gapOf(L[i - 1], L[i]));
    for (let i = L.length - 2; i >= 0; i--) s[i] = Math.min(s[i], s[i + 1] - gapOf(L[i], L[i + 1]) - box(L[i]));
    L.forEach((v, i) => at.set(v, s[i] + off(v)));
  };
  // 중간 점과 카드 사이는 좁게(FLOW.dummy). 다만 자기 고리 라벨 자리(pre)가 있는 칸 앞은 카드 사이보다 넓게(BD1-4: 중간 점으로 휘어 드는 선이 라벨에 붙었다, 3-3 켬)
  const gapOf = (a, b) => (groupOfCell[a] !== groupOfCell[b] && groupNames.length ? FLOW.gapCross + 28 : !cells[a].real && cells[b].pre ? FLOW.gapCross + 12 : cells[a].real && cells[b].real ? FLOW.gapCross : FLOW.dummy);
  for (let it = 0; it < 4; it++) {
    for (let r = 1; r < R; r++) place(layers[r], up);
    for (let r = R - 2; r >= 0; r--) place(layers[r], dn);
  }
  // 단 안 정렬(2026-11-13 사용자 "1-2-1-3-1 이어도 가운데"): 이웃 쪽으로 끈 자리를 단째 옮겨, 단마다 진짜 카드가 차지한 폭을
  // 가장 넓은 단 기준 가운데(center) · 앞 끝(start) · 뒤 끝(end)에 맞춘다(중간 점도 같이 옮긴다). 묶음이 있으면 정렬을 적었을 때만(경계 상자끼리 겹치지 않게)
  // 트리: 하위 묶음을 적은 차례대로 왼쪽부터 놓고(묶음끼리 겹치지 않게 각 묶음이 차지한 폭만큼 띄운다), 위 카드는 아래 카드가 홀수면 가운데 카드 위,
  // 짝수면 가운데 두 카드의 한가운데에 둔다. 단마다 따로 맞추는 정렬(align)은 쓰지 않는다(위계가 틀어진다)
  if (forest) {
    const kids = names.map(() => []);
    g.edges.forEach((e, k) => fwd[k] && kids[idx.get(e.from)].push(idx.get(e.to)));
    const rel = new Map();
    const SIB = FLOW.gapCross;
    const lay = (v) => {
      const own = [-(cells[v].cross / 2 + cells[v].pre), cells[v].cross / 2];
      const ks = [...new Set(kids[v])];
      if (!ks.length) return own;
      const ext = ks.map(lay);
      const x = [];
      ks.forEach((u, i) => (x[i] = i ? x[i - 1] + ext[i - 1][1] + SIB - ext[i][0] : -ext[0][0]));
      const n = ks.length;
      const mid = n % 2 ? x[(n - 1) / 2] : (x[n / 2 - 1] + x[n / 2]) / 2;
      ks.forEach((u, i) => rel.set(u, x[i] - mid));
      return [Math.min(own[0], ...ks.map((u, i) => x[i] + ext[i][0] - mid)), Math.max(own[1], ...ks.map((u, i) => x[i] + ext[i][1] - mid))];
    };
    const roots = names.map((_, v) => v).filter((v) => !ins[v].length);
    roots.sort((a, b) => (first.get(a) ?? a) - (first.get(b) ?? b));
    let x0 = 0;
    const put = (v, c) => {
      at.set(v, c);
      for (const u of new Set(kids[v])) put(u, c + rel.get(u));
    };
    for (const r of roots) {
      const e = lay(r);
      put(r, x0 - e[0]);
      x0 += e[1] - e[0] + SIB * 2;
    }
  }
  // 묶음 띠(2026-11-16 사용자 "아키텍처도 그룹으로 묶어둔 섹션이 겹치네, 겹치지 않고 정렬되게"): 묶음이 여러 단에 걸치면 단마다 자리가 달라 영역 상자끼리 겹쳤다.
  // 스윔레인처럼 묶음마다 가로(오른쪽 방향이면 세로) 띠 하나를 주고, 그 묶음 카드는 모든 단에서 제 띠 가운데에 놓는다. 띠 차례는 위에서 끈 자리의 평균 차례,
  // 띠 사이는 영역 여백(좌우 14 · 위 뱃지 32 · 아래 14)보다 넓게. 묶음 없는 카드도 띠 하나(영역은 그리지 않는다)
  const banded = !lanes && !forest && groupNames.length > 0;
  let bandKeys = null;
  if (banded) {
    const keys = [...groupNames, ...(cells.some((c) => !groupOfCell[c.v]) ? [""] : [])];
    const mean = new Map(keys.map((name) => {
      const vs = cells.filter((c) => groupOfCell[c.v] === name).map((c) => at.get(c.v));
      return [name, vs.reduce((a, x) => a + x, 0) / vs.length];
    }));
    keys.sort((a, b) => mean.get(a) - mean.get(b));
    const BG = down ? 44 : 60;
    const run = (list) => list.reduce((a, v, i) => a + box(v) + (i < list.length - 1 ? gapOf(v, list[i + 1]) : 0), 0);
    const bandW = new Map(keys.map((name) => [name, Math.max(...layers.map((L) => run(L.filter((v) => groupOfCell[v] === name))), down && name ? flowBadgeW(name) - 20 : 0)]));
    // 띠 자리(2026-11-16 사용자 "데이터 흐름이 가운데 → 오른쪽 → 왼쪽 끝으로 극단적"): 묶음마다 모든 단에 걸친 띠를 따로 주면 이어진 묶음도 계단처럼 멀어졌다.
    // 이제 묶음을 맨 위 단 차례로 하나씩 놓는다. 이미 놓인 이어진 묶음(관계 수만큼 무게)의 가운데에 서려 하고, 단이 겹치는 묶음과 부딪히면 그 옆 가장 가까운 자리로.
    // 단이 겹치지 않는 묶음은 같은 자리(위아래)를 쓴다(단 사이 60 이 영역 위아래 여백 46 보다 넓어 영역이 겹치지 않는다).
    // 묶음의 단 범위에는 그 묶음에서 나가는 선의 중간 점도 넣는다(선이 다른 묶음 카드를 뚫지 않게)
    const span = new Map(keys.map((name) => {
      const rs = cells.filter((c) => groupOfCell[c.v] === name).map((c) => c.rank);
      return [name, [Math.min(...rs), Math.max(...rs)]];
    }));
    const hits = (a, b) => !(span.get(a)[1] < span.get(b)[0] || span.get(b)[1] < span.get(a)[0]);
    const links = new Map();
    g.edges.forEach((e) => {
      const x = groupOfCell[idx.get(e.from)] ?? "";
      const y = groupOfCell[idx.get(e.to)] ?? "";
      if (e.from === e.to || x === y) return;
      for (const [p, q] of [[x, y], [y, x]]) links.set(`${p}|${q}`, (links.get(`${p}|${q}`) ?? 0) + 1);
    });
    const placeOrder = [...keys].sort((a, b) => span.get(a)[0] - span.get(b)[0] || keys.indexOf(a) - keys.indexOf(b));
    const center = new Map();
    if (bandOrder) {
      // 받은 차례(@묶음 차례 · 띠 차례 고르기): 띠를 차례대로 하나씩 이어 놓는다(적지 않은 묶음 · 묶음 없는 띠는 뒤에)
      let c = 0;
      for (const name of [...bandOrder.filter((x) => keys.includes(x)), ...keys.filter((x) => !bandOrder.includes(x))]) {
        center.set(name, c + bandW.get(name) / 2);
        c += bandW.get(name) + BG;
      }
    }
    for (const name of bandOrder ? [] : placeOrder) {
      const w = bandW.get(name);
      const near = [...center.keys()].filter((o) => links.has(`${name}|${o}`));
      const want = near.length ? near.reduce((a, o) => a + center.get(o) * links.get(`${name}|${o}`), 0) / near.reduce((a, o) => a + links.get(`${name}|${o}`), 0) : center.size ? Math.max(...[...center.keys()].map((o) => center.get(o) + bandW.get(o) / 2)) + BG + w / 2 : 0;
      const blocks = [...center.keys()].filter((o) => hits(name, o)).map((o) => [center.get(o) - bandW.get(o) / 2 - BG - w / 2, center.get(o) + bandW.get(o) / 2 + BG + w / 2]);
      const free = (c) => blocks.every(([lo, hi]) => c <= lo + 1e-6 || c >= hi - 1e-6);
      const cands = [want, ...blocks.flat()].filter(free);
      center.set(name, cands.reduce((best, c) => (Math.abs(c - want) < Math.abs(best - want) - 1e-6 ? c : best), cands[0]));
    }
    bandKeys = [...keys].sort((a, b) => center.get(a) - center.get(b));
    for (const name of keys) {
      const w = bandW.get(name);
      const c0 = center.get(name) - w / 2;
      for (const L of layers) {
        const mine = L.filter((v) => groupOfCell[v] === name);
        let x = c0 + (w - run(mine)) / 2;
        mine.forEach((v, i) => {
          at.set(v, x + off(v));
          x += box(v) + (i < mine.length - 1 ? gapOf(v, mine[i + 1]) : 0);
        });
      }
    }
  }
  const align = forest || banded ? "none" : (g.align ?? (groupNames.length ? "none" : "center"));
  if (!lanes && align !== "none") {
    const spans = layers.map((L) => {
      const real = L.filter((v) => cells[v].real);
      if (!real.length) return null;
      return [Math.min(...real.map((v) => at.get(v) - off(v))), Math.max(...real.map((v) => at.get(v) - off(v) + box(v)))];
    });
    const lo0 = Math.min(...spans.filter(Boolean).map((s) => s[0]));
    const W = Math.max(...spans.filter(Boolean).map((s) => s[1] - s[0]));
    layers.forEach((L, r) => {
      const s = spans[r];
      if (!s) return;
      const w = s[1] - s[0];
      const to = lo0 + (align === "start" ? 0 : align === "end" ? W - w : (W - w) / 2);
      L.forEach((v) => at.set(v, at.get(v) + to - s[0]));
    });
  }
  // 스윔레인: 묶음 하나가 레인 하나(가로 띠). 레인 폭은 그 레인에서 한 단에 쌓인 칸이 가장 많은 때, 칸은 레인 안 가운데에 쌓는다.
  // 묶음이 없는 카드는 이름 없는 마지막 레인. 레인은 묶음과 같은 꼴(옅은 색 바탕 + 왼쪽 위 이름 뱃지, 2026-11-15)이라 레인 사이를 LGAP 띄우고,
  // 세로 방향이면 레인 폭이 뱃지보다 좁지 않게 한다
  const laneList = lanes ? [...groupNames, ...(cells.some((c, v) => !groupOfCell[v]) ? [""] : [])] : [];
  const laneBand = [];
  if (lanes) {
    const LPAD = 14;
    const LGAP = 8;
    let c0 = 0;
    for (const ln of laneList) {
      const need = Math.max(36, down ? flowBadgeW(ln || "기타") + 16 - LPAD * 2 : 0, ...layers.map((L) => L.filter((v) => groupOfCell[v] === ln).reduce((a, v, i, arr) => a + box(v) + (i < arr.length - 1 ? FLOW.gapCross : 0), 0)));
      laneBand.push({ name: ln, c0, c1: c0 + need + LPAD * 2 });
      c0 += need + LPAD * 2 + LGAP;
    }
    layers.forEach((L) =>
      laneBand.forEach((b) => {
        const mine = L.filter((v) => groupOfCell[v] === b.name);
        const total = mine.reduce((a, v, i) => a + box(v) + (i < mine.length - 1 ? FLOW.gapCross : 0), 0);
        let x = (b.c0 + b.c1) / 2 - total / 2;
        for (const v of mine) {
          at.set(v, x + off(v));
          x += box(v) + FLOW.gapCross;
        }
      }),
    );
  }
  const elbow = g.style === "editorial" || g.type === "tree";
  const lo = (v) => at.get(v) - cells[v].cross / 2;
  const hi = (v) => at.get(v) + cells[v].cross / 2;
  // 하위 카드가 있는 칸에서 선이 붙는 자리(칸 앞 끝 기준, 2026-11-16): 들어오는 선은 상위 카드 앞 변(위 · 왼쪽).
  // 나가는 선은 세로 방향이면 맨 아래 하위 카드의 아래 변, 가로 방향이면 상위 카드 오른쪽 변(칸이 상위 카드보다 넓어도 그 변에서, 높이는 상위 카드 가운데)
  const subIn = (c) => [0, down ? c.w : c.h];
  const subOut = (c) => (down ? [c.sub.last.x, c.sub.last.x + c.sub.last.m.w] : [0, c.h]);
  const subOutM = (c) => (down ? c.main : c.w);
  /** 옆 변(s -1 앞 · +1 뒤): { m 주 축 범위, c 가로 자리 }. 세로 방향은 상위 카드 왼쪽 · 오른쪽 변, 가로 방향은 상위 카드 위 변 · 맨 아래 카드 아래 변 */
  const subSide = (c, s) => (down ? { m: [0, c.h], c: s > 0 ? c.w : 0 } : s < 0 ? { m: [0, c.w], c: 0 } : { m: [c.sub.last.x, c.sub.last.x + c.sub.last.m.w], c: c.cross });
  // 루프 길 고르기(2026-11-14 사용자 "디귿자 형태로 들어간다, 가장 매끄럽게"): 두 카드가 제 단에서 가장 바깥(가로 끝, 오른쪽 방향이면 위 · 아래 끝)이면
  // 카드 옆 변에서 나가 바깥 길을 따라 들어갈 카드 옆 변으로 들어간다(꺾임 둘, simple). 두 쪽 다 되면 가까운 쪽.
  // 바깥이 아니면 전처럼 나가는 카드 뒤 변 → 단 사이 빈 줄 → 바깥 길 → 들어갈 카드 단 앞 빈 줄 → 앞 변(꺾임 넷, 카드를 뚫지 않는다)
  const backEdges = g.edges.map((e, k) => (e.from !== e.to && !fwd[k] ? k : -1)).filter((k) => k >= 0);
  const realCells = cells.filter((c) => c.real);
  const LO = Math.min(...realCells.map((c) => lo(c.v) - c.pre), ...laneBand.map((b) => b.c0));
  const HI = Math.max(...realCells.map((c) => hi(c.v)), ...laneBand.map((b) => b.c1));
  const ext = layers.map((L) => {
    const r = L.filter((v) => cells[v].real);
    return r.length ? [Math.min(...r.map((v) => lo(v) - cells[v].pre)), Math.max(...r.map(hi))] : [0, 0];
  });
  const outerMin = (v) => !cells[v].pre && lo(v) <= ext[cells[v].rank][0] + 0.5;
  const outerMax = (v) => hi(v) >= ext[cells[v].rank][1] - 0.5;
  const loops = backEdges.map((k) => {
    const a = idx.get(g.edges[k].from);
    const b = idx.get(g.edges[k].to);
    const costMin = lo(a) + lo(b) - 2 * LO;
    const costMax = 2 * HI - hi(a) - hi(b);
    const opts = [];
    if (outerMin(a) && outerMin(b)) opts.push({ side: -1, cost: costMin });
    // 가로 방향에서 하위 카드가 있는 칸의 뒤쪽(아래) 변은 맨 아래 하위 카드라, 그 변으로 드나드는 루프는 하위 카드를 가리키는 것처럼 보인다(상위 카드 앞 · 뒤 변으로 돈다)
    const subBottom = (v) => !down && cells[v].sub;
    if (outerMax(a) && outerMax(b) && !subBottom(a) && !subBottom(b)) opts.push({ side: 1, cost: costMax });
    opts.sort((x, y) => x.cost - y.cost || y.side - x.side);
    return { k, a, b, side: opts[0]?.side ?? (costMin < costMax ? -1 : 1), simple: opts.length > 0, span: rank[a] - rank[b], fa: 0.5, fb: 0.5 };
  });
  // 같은 쪽 루프는 짧은 것이 안쪽 길. 오른쪽 방향은 라벨이 길 위에 얹혀(높이 18) 길 사이를 더 띄운다
  for (const s of [-1, 1])
    loops
      .filter((l) => l.side === s)
      .sort((x, y) => x.span - y.span || x.k - y.k)
      .forEach((l, i) => (l.L = s > 0 ? HI + 22 + i * (down ? 16 : 24) : LO - 22 - i * (down ? 16 : 24)));
  const loopLabW = (l) => (g.edges[l.k].label ? flowLabelW(g.edges[l.k].label) : 0);
  /** 루프 길 + 라벨이 차지하는 가로(단 안 방향) 범위 */
  const loopExt = (l) => (down ? (l.side > 0 ? [l.L, l.L + 10 + loopLabW(l)] : [l.L - 10 - loopLabW(l), l.L]) : [l.L - 12, l.L + 12]);
  // simple 루프가 한 카드 옆 변에 여럿이면 변을 따라 펼친다. 상대 카드가 먼 것일수록 뒤쪽(길끼리 엇갈리지 않게)
  const sideEnds = new Map();
  for (const l of loops.filter((x) => x.simple))
    for (const [v, o, end] of [[l.a, l.b, "fa"], [l.b, l.a, "fb"]]) {
      const key = `${v}:${l.side}`;
      if (!sideEnds.has(key)) sideEnds.set(key, []);
      sideEnds.get(key).push({ l, end, other: rank[o], lane: Math.abs(l.L) });
    }
  sideEnds.forEach((list) => list.sort((x, y) => y.other - x.other || x.lane - y.lane).forEach((it, j) => (it.l[it.end] = 0.2 + (0.6 * (j + 1)) / (list.length + 1))));
  // 카드 하나의 나가는 · 들어오는 관계를 카드 변을 따라 펼친다(조건에서 여러 갈래가 한 점에 모이지 않게)
  const spreadOut = new Map();
  const spreadIn = new Map();
  const spread = (map, v, list) => {
    list.sort((a, b) => a.x - b.x);
    list.forEach((e, i) => map.set(`${v}:${e.k}`, (i + 1) / (list.length + 1)));
  };
  realCells.forEach((c) => {
    const o = [];
    const n = [];
    chains.forEach((chain, k) => {
      if (chain[0] === c.v) o.push({ k, x: at.get(chain[1]) });
      if (chain.at(-1) === c.v) n.push({ k, x: at.get(chain.at(-2)) });
    });
    // 꺾임 넷 루프는 바깥 길(가로 끝 쪽)로 가므로 변의 그 끝 쪽 자리
    for (const l of loops) {
      if (l.simple) continue;
      if (l.a === c.v) o.push({ k: l.k, x: l.side * 1e9 });
      if (l.b === c.v) n.push({ k: l.k, x: l.side * 1e9 });
    }
    // 트리는 나가는 선이 위 카드 가운데 한 점에서, 들어오는 선은 아래 카드 가운데로(펼치지 않는다)
    if (forest) return;
    spread(spreadOut, c.v, o);
    spread(spreadIn, c.v, n);
  });
  const portAt = (v, r, f) => lo(v) + r[0] + (r[1] - r[0]) * f;
  const portOut = (v, k) => (cells[v].sub ? portAt(v, subOut(cells[v]), spreadOut.get(`${v}:${k}`) ?? 0.5) : lo(v) + cells[v].cross * (spreadOut.get(`${v}:${k}`) ?? 0.5));
  const portIn = (v, k) => (cells[v].sub ? portAt(v, subIn(cells[v]), spreadIn.get(`${v}:${k}`) ?? 0.5) : lo(v) + cells[v].cross * (spreadIn.get(`${v}:${k}`) ?? 0.5));
  // 직각 연결선이 단 사이 빈 줄에서 꺾는 자리(2026-11-14): 같은 빈 줄을 지나는 선마다 다른 줄을 준다(꺾는 줄이 겹쳐 한 선처럼 보이지 않게).
  // 같은 쪽으로 꺾는 선끼리는 엇갈리지 않는 차례(가로가 커지는 선은 출발이 큰 것 먼저, 작아지는 선은 출발이 작은 것 먼저)
  const track = new Map();
  const tracksIn = layers.map(() => 0);
  // 오른쪽 방향은 라벨을 출발 카드 바로 뒤 가로 조각에 얹는다. 그 빈 줄의 꺾는 줄은 라벨 뒤에서 시작한다(labelRoom, 라벨이 옆 선의 꺾인 조각에 섞이지 않게)
  const labelRoom = layers.map((_, r) =>
    elbow && !down ? Math.max(0, ...g.edges.filter((e, k) => fwd[k] && e.label && rank[idx.get(e.from)] === r).map((e) => flowLabelW(e.label) + 12)) : 0,
  );
  if (elbow) {
    const byGap = layers.map(() => []);
    chains.forEach((chain, k) => {
      for (let i = 0; i + 1 < chain.length; i++) {
        const pc = i === 0 ? portOut(chain[0], k) : at.get(chain[i]);
        const qc = i + 2 === chain.length ? portIn(chain.at(-1), k) : at.get(chain[i + 1]);
        if (Math.abs(pc - qc) >= 0.5) byGap[cells[chain[i]].rank].push({ key: `${k}:${i}`, pc, qc });
      }
    });
    byGap.forEach((list, r) => {
      const all = [...list.filter((s) => s.qc > s.pc).sort((x, y) => y.pc - x.pc), ...list.filter((s) => s.qc < s.pc).sort((x, y) => x.pc - y.pc)];
      // 트리는 같은 위 카드의 선이 한 줄에서 갈라진다(줄을 나누지 않는다. 위 카드끼리는 자리가 겹치지 않아 한 줄이어도 섞이지 않는다)
      all.forEach((s, j) => track.set(s.key, forest ? 0.5 : (j + 1) / (all.length + 1)));
      tracksIn[r] = forest ? Math.min(1, all.length) : all.length;
    });
  }
  // 단(주 축) 자리: 단마다 가장 큰 카드 높이(폭)
  const bandMain = layers.map((L) => Math.max(0, ...L.map((v) => cells[v].main)));
  // 꺾임 넷 루프는 단 사이 빈 줄을 지난다. 첫 단으로 들어가는 · 마지막 단에서 나오는 것이 있으면 위 · 아래에 빈 줄을 더 둔다
  const edge0 = FLOW.gapMain / 2;
  const fallback = loops.filter((l) => !l.simple);
  // 레인 이름 뱃지 자리: 세로 방향은 레인 위(뱃지 높이 18 + 위아래 8), 가로 방향은 레인 왼쪽(가장 긴 뱃지 + 앞뒤 빈칸)
  const laneLabel = lanes ? (down ? 30 : Math.max(...laneList.map((x) => flowBadgeW(x || "기타"))) + 14) : 0;
  const topM = Math.max(laneLabel, fallback.some((l) => rank[l.b] === 0) ? edge0 : 0);
  const botM = fallback.some((l) => rank[l.a] === R - 1) ? edge0 : 0;
  const bandStart = [];
  let m = topM;
  // 오른쪽 방향은 라벨이 단 사이에 가로로 놓여, 그 사이를 지나는 라벨 중 가장 긴 것만큼 띄운다. 꺾는 줄이 많으면 줄 사이 12 를 둔다
  const gapAfter = layers.map((_, r) =>
    Math.max(
      down ? FLOW.gapMain : Math.max(FLOW.gapMain, ...g.edges.filter((e, k) => fwd[k] && e.label && rank[idx.get(e.from)] === r).map((e) => flowLabelW(e.label) + 30)),
      labelRoom[r] + (tracksIn[r] + 1) * 12,
    ),
  );
  for (let r = 0; r < R; r++) {
    bandStart[r] = m;
    m += bandMain[r] + gapAfter[r];
  }
  // 오른쪽 방향 트리는 같은 열(단)의 카드 왼쪽 끝을 맞춘다(BD1 02 "같은 열의 카드가 가운데 맞춤이라 왼쪽 끝이 들쭉날쭉"). 나머지는 단 가운데
  const leftAlign = forest && !down;
  const mainC = (v) => bandStart[cells[v].rank] + (leftAlign && cells[v].real ? cells[v].main / 2 : bandMain[cells[v].rank] / 2);
  const minC = Math.min(lanes ? 0 : Math.min(...cells.map((c) => at.get(c.v) - c.cross / 2 - c.pre)), ...loops.map((l) => loopExt(l)[0]));
  const PAD = 8;
  const shift = PAD - minC;
  laneBand.forEach((b) => {
    b.c0 += shift;
    b.c1 += shift;
  });
  cells.forEach((c) => at.set(c.v, at.get(c.v) + shift));
  loops.forEach((l) => (l.L += shift));
  const crossMax = Math.max(...cells.map((c) => at.get(c.v) + c.cross / 2), ...laneBand.map((b) => b.c1), ...loops.map((l) => loopExt(l)[1]));
  // (주, 가로) → 화면 (x, y)
  const P = (main, cross) => (down ? [cross, main + PAD] : [main + PAD, cross]);
  const pt = (main, cross) => P(main, cross).map((n) => Math.round(n * 10) / 10).join(" ");
  const edges = [];
  /** 꺾이는 점들 → 모서리를 둥글린 길. r1 은 첫 꺾임만(트리의 갈라지는 자리는 0, 직각 T 자) */
  const roundPath = (pts, r = 8, r1 = r) => {
    let d = `M ${pt(...pts[0])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [m0, c0] = pts[i - 1];
      const [m1, c1] = pts[i];
      const [m2, c2] = pts[i + 1];
      const l1 = Math.hypot(m1 - m0, c1 - c0);
      const l2 = Math.hypot(m2 - m1, c2 - c1);
      const k = Math.min(i === 1 ? r1 : r, l1 / 2, l2 / 2);
      const a = l1 ? [m1 - ((m1 - m0) / l1) * k, c1 - ((c1 - c0) / l1) * k] : [m1, c1];
      const b = l2 ? [m1 + ((m2 - m1) / l2) * k, c1 + ((c2 - c1) / l2) * k] : [m1, c1];
      d += ` L ${pt(...a)} Q ${pt(m1, c1)} ${pt(...b)}`;
    }
    return `${d} L ${pt(...pts.at(-1))}`;
  };
  g.edges.forEach((e, k) => {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    const A = cells[a];
    const B = cells[b];
    if (a === b) {
      // 자기 자신(재시도): 카드 앞쪽 변의 고리(비워 둔 pre 자리), 라벨은 고리 바깥
      const c0 = at.get(a) - A.cross / 2;
      const o = FLOW.loop;
      // 고리가 여럿이면 앞쪽 변(카드 주 축 80%)을 고리 수만큼 칸으로 나눠 칸 가운데 60% 에 고리 하나씩. 라벨은 세로 방향이면 고리 왼쪽 칸 높이(20 이상 띄움),
      // 가로 방향이면 고리 위로 한 줄씩 쌓는다
      const list = selfs[a];
      const n = list.length;
      const i = list.indexOf(k);
      // 하위 카드가 있는 칸은 상위 카드 앞쪽 변(주 축 범위)에
      const sm = A.sub ? subSide(A, -1).m : null;
      const mc = sm ? mainC(a) - A.main / 2 + (sm[0] + sm[1]) / 2 : mainC(a);
      const ml = sm ? sm[1] - sm[0] : A.main;
      const w = (ml * 0.8) / n;
      const s0 = mc - ml * 0.4 + w * i;
      const m0 = n > 1 ? s0 + w * 0.2 : mc - ml / 4;
      const m1 = n > 1 ? s0 + w * 0.8 : mc + ml / 4;
      const bend = n > 1 ? 3 : 6;
      const path = `M ${pt(m0, c0)} C ${pt(m0 - bend, c0 - o)} ${pt(m1 + bend, c0 - o)} ${pt(m1, c0)}`;
      const lm = n > 1 && down ? (w >= 20 ? s0 + w / 2 : mc + (i - (n - 1) / 2) * 20) : n > 1 ? (m0 + m1) / 2 : mc;
      const [lx, ly] = P(lm, c0 - o - (down ? 6 : 14 + 20 * i));
      edges.push({ ...e, k, self: true, path, lx, ly, anchor: down ? "end" : "middle" });
      return;
    }
    if (!fwd[k]) {
      // 루프(되돌아감). 길 고르기는 위(loops). 라벨은 바깥 길 가운데(세로 방향이면 길 옆)
      const l = loops.find((x) => x.k === k);
      const s = l.side;
      let poly;
      let mid;
      if (l.simple) {
        // 꺾임 둘: 나가는 카드 옆 변 → 바깥 길 → 들어갈 카드 옆 변
        let eA = s > 0 ? at.get(a) + A.cross / 2 : at.get(a) - A.cross / 2;
        let eB = s > 0 ? at.get(b) + B.cross / 2 : at.get(b) - B.cross / 2;
        let mA = mainC(a) - A.main / 2 + A.main * l.fa;
        let mB = mainC(b) - B.main / 2 + B.main * l.fb;
        // 하위 카드가 있는 칸은 그 쪽 변(subSide)에서
        if (A.sub) {
          const sd = subSide(A, s);
          eA = lo(a) + sd.c;
          mA = mainC(a) - A.main / 2 + sd.m[0] + (sd.m[1] - sd.m[0]) * l.fa;
        }
        if (B.sub) {
          const sd = subSide(B, s);
          eB = lo(b) + sd.c;
          mB = mainC(b) - B.main / 2 + sd.m[0] + (sd.m[1] - sd.m[0]) * l.fb;
        }
        poly = [[mA, eA], [mA, l.L], [mB, l.L], [mB, eB]];
        mid = (mA + mB) / 2;
      } else {
        // 꺾임 넷: 카드를 뚫지 않게 카드가 없는 길만 지난다. 루프가 여럿이면 빈 줄 자리를 조금씩 비킨다
        const i = fallback.indexOf(l);
        const cS = A.sub ? portAt(a, subOut(A), spreadOut.get(`${a}:${k}`) ?? 0.8) : at.get(a) - A.cross / 2 + A.cross * (spreadOut.get(`${a}:${k}`) ?? 0.8);
        const cT = B.sub ? portAt(b, subIn(B), spreadIn.get(`${b}:${k}`) ?? 0.8) : at.get(b) - B.cross / 2 + B.cross * (spreadIn.get(`${b}:${k}`) ?? 0.8);
        const gA = bandStart[A.rank] + bandMain[A.rank] + 14 + (i % 3) * 8;
        const gB = bandStart[B.rank] - 14 - (i % 3) * 8;
        poly = [[A.sub ? mainC(a) - A.main / 2 + subOutM(A) : mainC(a) + A.main / 2, cS], [gA, cS], [gA, l.L], [gB, l.L], [gB, cT], [mainC(b) - B.main / 2, cT]];
        mid = (gA + gB) / 2;
      }
      const path = roundPath(poly, 10);
      const [lx, ly] = P(mid, l.L + (down ? s * 8 : 0));
      edges.push({ ...e, k, back: true, path, lx, ly, anchor: down ? (s > 0 ? "start" : "end") : "middle" });
      return;
    }
    const chain = chains.get(k);
    const pts = chain.map((v, i) => {
      const c = cells[v];
      if (i === 0 && c.sub) return [mainC(v) - c.main / 2 + subOutM(c), portOut(v, k)];
      if (i === chain.length - 1 && c.sub) return [mainC(v) - c.main / 2, portIn(v, k)];
      if (i === 0) return [mainC(v) + c.main / 2, at.get(v) - c.cross / 2 + c.cross * (spreadOut.get(`${v}:${k}`) ?? 0.5)];
      if (i === chain.length - 1) return [mainC(v) - c.main / 2, at.get(v) - c.cross / 2 + c.cross * (spreadIn.get(`${v}:${k}`) ?? 0.5)];
      return [mainC(v), at.get(v)];
    });
    // 두 카드 가운데가 조금만 어긋나면(6 안쪽) 들어가는 자리를 맞춰 곧게 잇는다(작은 꺾임이 남지 않게)
    const inMid = B.sub ? portAt(b, subIn(B), 0.5) : at.get(b);
    const inHalf = B.sub ? subIn(B)[1] / 2 : B.cross / 2;
    if (pts.length === 2 && Math.abs(pts[1][1] - pts[0][1]) < 6 && Math.abs(pts[0][1] - inMid) < inHalf - 4) pts[1][1] = pts[0][1];
    const [m0, c0] = pts[0];
    const [m1, c1] = pts[1];
    if (elbow) {
      // 둥근 직각 연결선(diagram-design: 대각선 금지, 꺾임 r=8). 단 사이 빈 줄에서 꺾는다
      const poly = [pts[0]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [, pc] = pts[i];
        const [, qc] = pts[i + 1];
        if (Math.abs(pc - qc) < 0.5) continue;
        // 꺾는 줄: 그 빈 줄에서 이 선에 준 자리(track)
        const r0 = cells[chain[i]].rank;
        const g0 = bandStart[r0] + bandMain[r0] + labelRoom[r0];
        const mid = g0 + (bandStart[r0 + 1] - g0) * (track.get(`${k}:${i}`) ?? 0.5);
        poly.push([mid, pc], [mid, qc]);
      }
      poly.push(pts.at(-1));
      const path = roundPath(poly, 8, forest ? 0 : 8);
      // 라벨: 첫 꺾임 뒤 가로(단 안 방향) 조각 가운데 위, 곧게 내려가면 선 옆(선에서 띄운다)
      // 오른쪽 방향은 출발 카드 바로 뒤 가로 조각 위(labelRoom 자리)
      const bend = poly.length > 2 ? poly[1] : null;
      if (!down) {
        const [lx, ly] = P(m0 + 8, c0);
        edges.push({ ...e, k, path, lx, ly, anchor: "start" });
        return;
      }
      const [lx, ly] = bend && Math.abs(poly[2][1] - bend[1]) > 24 ? P(bend[0] - 12, (bend[1] + poly[2][1]) / 2) : P((m0 + m1) / 2, c0 + 10);
      const anchor = bend && Math.abs(poly[2][1] - bend[1]) > 24 ? "middle" : "start";
      edges.push({ ...e, k, path, lx, ly, anchor });
      return;
    }
    let path = `M ${pt(...pts[0])}`;
    // 끝은 곧은 꼬리(STUB)로 들어간다: 곡선이 카드 바로 앞까지 휘면 꺾쇠(끝 접선 방향)가 보이는 선과 어긋나 보였다(2026-11-13 사용자)
    const STUB = 10;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [pm, pc] = pts[i];
      let [qm, qc] = pts[i + 1];
      const last = i + 2 === pts.length;
      const dir = Math.sign(qm - pm) || 1;
      const end = qm;
      if (last && Math.abs(qm - pm) > STUB * 2.5) qm -= dir * STUB;
      const d = (qm - pm) / 2;
      path += ` C ${pt(pm + d, pc)} ${pt(qm - d, qc)} ${pt(qm, qc)}`;
      if (qm !== end) path += ` L ${pt(end, qc)}`;
    }
    // 라벨: 첫 조각의 앞쪽(조건 갈래가 어디로 가는지 출발 쪽에서 읽히게).
    // 조건이 아닌 카드에서 갈라지는 선(BD1 #11 "시작 점 라벨이 두 선 사이")은 선이 벌어진 가운데 쪽(길이 55%)
    const t = 0.42;
    const bez = (p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
    const d = (m1 - m0) / 2;
    let [lx, ly] = P(bez(m0, m0 + d, m1 - d, m1), bez(c0, c0, c1, c1));
    if (e.label && A.node.kind !== "cond" && nOut[a] >= 2) [lx, ly] = flowPathAt(flowPathPts(path), 0.55);
    edges.push({ ...e, k, path, lx, ly, anchor: "middle" });
  });
  // 라벨 상자(BD1 #9): 그림 크기 · 밀기에 넣어 라벨이 그림 밖으로 나가 잘리지 않게. 그리기(memoFlowHtml)는 이 자리에 그린다
  const r1 = (n) => Math.round(n * 10) / 10;
  for (const e of edges) {
    if (!e.label) continue;
    const w = flowLabelW(e.label);
    e.lbox = { x: r1(e.anchor === "start" ? e.lx : e.anchor === "end" ? e.lx - w : e.lx - w / 2), y: r1(e.ly - 9), w, h: 18 };
  }
  /** 하위 카드 잇는 선(파일 트리 꼴): { x 세로 줄, y 위 카드 아래 끝, h 세로 줄 길이, stubs: [{ dy, w }] 하위 카드 왼쪽 가운데로 가는 가로 줄 } */
  const subs = [];
  const nodes = cells
    .filter((c) => c.real)
    .flatMap((c) => {
      // 이름이 있는 점: 끝은 칸 앞(head), 시작은 칸 뒤(tail)에 점, 나머지 자리에 이름
      const dotShift = c.dot && c.dlw && c.node.kind !== "end" ? c.main - 20 : 0;
      const [x, y] = P(mainC(c.v) - c.main / 2 + dotShift, at.get(c.v) - c.cross / 2);
      const n = c.node;
      let dlbox = null;
      if (c.dot && c.dlw) {
        const end = n.kind === "end";
        dlbox = down ? { x: r1(x + 10 - c.dlw / 2), y: end ? y + 23 : y - 18, w: c.dlw, h: 15 } : { x: end ? x + 26 : x - 6 - c.dlw, y: y + 2, w: c.dlw, h: 16 };
      }
      // 트리 뿌리(종류를 적지 않았고 들어오는 관계 없이 갈래만 나가는 카드)는 시작 카드와 같은 색 바탕(2026-11-15, 모두 회색 카드라 흐렸다)
      const root = g.type === "tree" && !n.kindSet && n.kind === "task" && !ins[c.v].length && outs[c.v].length > 0;
      const me = { name: n.name, kind: n.kind, title: c.title, body: c.body, w: c.w, h: c.h, x, y, group: n.group, tag: n.tag, focal: n.focal, tagW: c.tagW ?? 0, dot: Boolean(c.dot), oy: c.oy ?? 0, root, ref: n.ref ?? "", link: n.link ?? "", dl: c.dotLabel ?? "", dlbox };
      // 체크 카드 · 하위 카드: 체크(null 은 체크 카드 아님) · 블록 안 머리 줄 차례(체크 바꾸기 · 편집이 줄로 찾는다). 하위 카드가 없는 보통 카드는 그대로
      if (n.check != null) Object.assign(me, { check: n.check, line: n.line });
      if (!c.sub) return [me];
      for (const t of c.sub.tree) subs.push({ x: x + t.x, y: y + t.y0, h: Math.max(...t.ys) - t.y0, stubs: t.ys.map((yy) => ({ dy: yy - t.y0, w: t.x1 - t.x })) });
      const kids = c.sub.items.map((it) => {
        const k = it.node;
        return { name: k.name, kind: k.kind, title: it.m.title, body: it.m.body, w: it.m.w, h: it.m.h, x: x + it.x, y: y + it.y, group: n.group, tag: k.tag, focal: k.focal, tagW: it.m.tagW ?? 0, dot: false, oy: 0, root: false, ref: k.ref ?? "", link: k.link ?? "", dl: "", dlbox: null, sub: true, depth: it.depth, line: k.line, check: k.check };
      });
      return [me, ...kids];
    });
  const mainLen = m - gapAfter[R - 1] + botM + PAD * 2;
  const crossLen = crossMax + PAD;
  let width = Math.ceil(down ? crossLen : mainLen);
  let height = Math.ceil(down ? mainLen : crossLen);
  // 경계 상자(스윔레인이 아닐 때 @묶음): 묶음 카드를 둘러싼 옅은 바탕 영역, 왼쪽 위에 이름 뱃지 자리(i 는 묶음 차례, 색을 가른다)
  const boxes = lanes
    ? []
    : groupNames.map((name, i) => {
        const ms = nodes.filter((n) => n.group === name);
        const x0 = Math.min(...ms.map((n) => n.x)) - 14;
        const y0 = Math.min(...ms.map((n) => n.y)) - 32;
        const x1 = Math.max(...ms.map((n) => n.x + n.w)) + 14;
        const y1 = Math.max(...ms.map((n) => n.y + n.h)) + 14;
        return { name, i, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      });
  // 라벨 겹침 풀기(BD1 #2 "큰 그래프에서 라벨끼리 겹친다"): 카드 · 점 이름 · 묶음 · 레인 뱃지와 먼저 놓인 라벨을 피해 선을 따라 밀고, 그래도 안 되면 옆으로 쌓는다
  flowUnclutter(edges, [
    ...nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })),
    ...nodes.map((n) => n.dlbox).filter(Boolean),
    ...boxes.map((b) => ({ x: b.x + 8, y: b.y + 8, w: flowBadgeW(b.name), h: 18 })),
    ...laneBand.map((b) => (down ? { x: b.c0 + 8, y: 9, w: flowBadgeW(b.name || "기타"), h: 18 } : { x: 9, y: b.c0 + 8, w: flowBadgeW(b.name || "기타"), h: 18 })),
  ], width, height);
  // 상자 · 라벨(관계 라벨 · 점 이름)이 그림 밖으로 나가면 전체를 민다(라벨은 2 안쪽까지)
  const lboxes = [...edges.map((e) => e.lbox), ...nodes.map((n) => n.dlbox)].filter(Boolean);
  const dx = Math.max(0, ...boxes.map((b) => PAD - b.x), ...lboxes.map((b) => 2 - b.x));
  const dy = Math.max(0, ...boxes.map((b) => PAD - b.y), ...lboxes.map((b) => 2 - b.y));
  const laneRects = laneBand.map((b) => {
    const [x, y] = P(-PAD, b.c0);
    return down ? { name: b.name, x: b.c0, y: 0, w: b.c1 - b.c0, h: 0 } : { name: b.name, x: 0, y, w: 0, h: b.c1 - b.c0 };
  });
  if (dx || dy) {
    const mv = (o) => {
      o.x += dx;
      o.y += dy;
    };
    nodes.forEach(mv);
    subs.forEach(mv);
    boxes.forEach(mv);
    laneRects.forEach(mv);
    lboxes.forEach((b) => {
      b.x = r1(b.x + dx);
      b.y = r1(b.y + dy);
    });
    edges.forEach((e) => {
      e.lx += dx;
      e.ly += dy;
      e.path = e.path.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a, b) => `${Math.round((+a + dx) * 10) / 10} ${Math.round((+b + dy) * 10) / 10}`);
    });
  }
  width = Math.ceil(Math.max(width + dx, ...boxes.map((b) => b.x + b.w + PAD), ...lboxes.map((b) => b.x + b.w + 2)));
  height = Math.ceil(Math.max(height + dy, ...boxes.map((b) => b.y + b.h + PAD), ...lboxes.map((b) => b.y + b.h + 2)));
  // 레인은 그림 끝까지(주 축 전체)
  laneRects.forEach((r) => (down ? (r.h = height) : (r.w = width)));
  return { nodes, edges, boxes, lanes: laneRects, width, height, bandKeys, ...(subs.length ? { subs } : {}) };
}

// MARK: 그리기

function flowStyle() {
  if (typeof document?.getElementById !== "function" || document.getElementById("fl-style")) return;
  const st = document.createElement("style");
  st.id = "fl-style";
  st.textContent = flowCss();
  document.head.append(st);
}

/** 칸 폭 맞춤 · 코드 · 점 이름 · 인쇄 크기(BD1-2, 2026-11-16 #1 · #8 · #12 · #13) */
const FLOW_CSS_FIT = `
/* 확대 칸이 아닌 칸(손가락 기기 · 인쇄 화면 · HTML 내려받기): 칸 폭에 맞춘다(원래 크기의 --fl-min 배까지, 더 넓으면 가로 스크롤).
   하한은 종류마다(BD1-4, 글이 읽히는 배율): 기본 0.5, 시퀀스 · 데이터 모델은 그림 틀이 싣는다(flow-seq.js 의 flowAltFigure).
   링크 보기(.fl-ov)를 켜면 원래 크기(복사 단추 자리가 맞게) */
.fl-scroll:not(.zoom) .fl-stage:not(:has(> .fl-ov)) { width: max(min(100%, var(--fl-w)), calc(var(--fl-w) * var(--fl-min, 0.5))); }
.fl-scroll:not(.zoom) .fl-stage:not(:has(> .fl-ov)) .fl-svg { width: 100%; height: auto; }
/* 카드 · 라벨의 코드 조각(짝 백틱): 고정폭, 본문 글보다 진하게 */
.fl-code { font-family: var(--fl-mono); }
.fl-b .fl-code, .fl-l .fl-code { fill: var(--fl-ink); }
/* 라벨 테두리는 선 꼴(BD1 #11): 외부 호출 파랑 · 굵은 선 잉크 · 점선 */
.fl-l.link rect { stroke: var(--fl-link); }
.fl-l.bold rect { stroke: var(--fl-ink); }
.fl-l.dash rect { stroke-dasharray: 3 2; }
/* 상태도 시작 · 끝 점 이름 */
.fl-dl { fill: var(--fl-ink); font-size: 11.5px; font-weight: 600; }
.fl.ed .fl-dl { font-family: var(--fl-name); }
/* 인쇄: 쪽 높이에 맞춰 줄이고(앞 쪽을 비우고 다음 쪽에서 잘리지 않게), 가로로 긴 그림(.wide)은 가로 쪽(이름 쪽을 읽는 브라우저) */
@media print {
  .fl-scroll, .fl-scroll.zoom { height: auto !important; overflow: visible !important; }
  .fl-stage, .fl-scroll .fl-stage, .fl-scroll:not(.zoom) .fl-stage:not(:has(> .fl-ov)) { position: static !important; width: auto !important; }
  .fl-svg, .fl-scroll .fl-svg { width: auto !important; height: auto !important; max-width: 100%; max-height: 210mm; }
  .fl.wide { page: fl-wide; }
  .fl.wide .fl-svg { max-height: 145mm; }
}
@page fl-wide { size: A4 landscape; }
`;

/** diagram CSS(시험이 읽는다). 기본은 앱 색(메모 · 큰 화면 · 인쇄 변수), 에디토리얼(.ed)은 diagram-design 스킬의 종이 · 잉크 · 강조색 체계(.dk 는 어두운 판) */
function flowCss() {
  return `
.fl { --fl-card: var(--element, var(--panel, #f4f4f5)); --fl-line: var(--line-strong, #c8c8cc); --fl-ink: var(--text, #1a1a1a); --fl-mute: var(--muted, #6b6b70);
  --fl-edge: var(--muted, #6b6b70); --fl-bg: var(--bg, #fff); --fl-cond: var(--warn, #d68c27); --fl-start: var(--primary, #3b7dd8); --fl-state: var(--active, var(--primary, #4f8ff0));
  --fl-accent: var(--crit, #d1383d); --fl-accent-tint: color-mix(in srgb, var(--fl-accent) 10%, var(--fl-bg)); --fl-link: var(--active, #2e5aa8); --fl-rule: var(--line, #e5e5e5);
  --fl-name: inherit; --fl-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  /* 공통 토큰(2026-11-15): 기본 흐름도의 시각 언어. 모든 종류 · 곁 카드가 이 값으로 그린다(종류마다 따로 정한 색 · 굵기 없음).
     --fl-tint 시작 · 끝 · 트리 뿌리 카드 바탕 농도 · --fl-w-card 카드 테두리 · --fl-w-kind 종류 카드(조건 · 시작 · 끝 · 상태 · 외부) 테두리 · --fl-w-edge 연결선 · --fl-w-bold 굵은 선 */
  --fl-tint: 22%; --fl-w-card: 1; --fl-w-kind: 1.4; --fl-w-edge: 1.4; --fl-w-bold: 2.4;
  margin: 4px 0 12px; padding: 10px 12px; border: 1px solid var(--line, #e5e5e5); border-radius: 8px; }
.fl.ed { --fl-w-kind: 1; --fl-w-edge: 1.2; --fl-w-bold: 1.6; --fl-bg: #f5f5f5; --fl-card: #f5f5f5; --fl-line: #2d3142; --fl-ink: #2d3142; --fl-mute: #4f5d75; --fl-soft: #5a6580; --fl-edge: #4f5d75;
  --fl-cond: #2d3142; --fl-start: #2d3142; --fl-state: #2d3142; --fl-accent: #bf4520; --fl-accent-tint: rgba(191, 69, 32, 0.08); --fl-link: #2e5aa8;
  --fl-rule: rgba(45, 49, 66, 0.12);
  --fl-name: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard Variable", Pretendard, "Segoe UI", sans-serif;
  background: var(--fl-bg); border-color: var(--fl-rule); color: var(--fl-ink); }
.fl.ed.dk { --fl-bg: #2d3142; --fl-card: #2d3142; --fl-line: #f5f5f5; --fl-ink: #f5f5f5; --fl-mute: #bfc0c0; --fl-soft: #949eb2; --fl-edge: #bfc0c0;
  --fl-cond: #f5f5f5; --fl-start: #f5f5f5; --fl-state: #f5f5f5; --fl-accent: #f08a59; --fl-accent-tint: rgba(240, 138, 89, 0.10); --fl-link: #739fdf;
  --fl-rule: rgba(245, 245, 245, 0.12); }
.fl figcaption { margin-bottom: 8px; font-weight: 700; }
.fl.ed figcaption { font-family: var(--fl-name); font-weight: 600; }
.fl-scroll { overflow-x: auto; }
.fl-svg { display: block; max-width: none; margin: 0 auto; font-family: inherit; }
.fl-card { fill: var(--fl-card); stroke: var(--fl-line); stroke-width: var(--fl-w-card); }
.fl-cond .fl-card { stroke: var(--fl-cond); stroke-width: var(--fl-w-kind); }
.fl-cond .fl-dia { fill: var(--fl-cond); }
/* 시작 · 끝 · 트리 뿌리(.fl-root): 강조색 22% 바탕 + 강조색 테두리 */
.fl-start .fl-card, .fl-end .fl-card, .fl-root .fl-card { fill: color-mix(in srgb, var(--fl-start) var(--fl-tint), var(--fl-bg)); stroke: var(--fl-start); stroke-width: var(--fl-w-kind); }
.fl-state .fl-card { stroke: var(--fl-state); stroke-width: var(--fl-w-kind); }
/* 메모 · 외부: 점선 테두리는 연결선 색(전에는 카드 테두리 색 #d4d4d4 이라 흰 바탕에서 거의 안 보였다), 이름은 잉크 */
.fl-note .fl-card { fill: none; stroke: var(--fl-edge); stroke-dasharray: 4 3; }
.fl-note .fl-b { fill: var(--fl-mute); }
.fl-ext .fl-card { fill: none; stroke: var(--fl-edge); stroke-dasharray: 1.5 3; stroke-linecap: round; stroke-width: var(--fl-w-kind); }
.fl-store .fl-cap { fill: none; stroke: var(--fl-line); stroke-width: var(--fl-w-card); }
/* 에디토리얼 시작 · 끝 · 트리 뿌리: 잉크로 채우고 글은 종이색(2026-11-14 사용자 "회색 시작 카드가 뿌옇다, 진하게"). 초점(!)이면 아래 focal 이 이긴다 */
.fl.ed .fl-start .fl-card, .fl.ed .fl-end .fl-card, .fl.ed .fl-root .fl-card { fill: var(--fl-ink); stroke: var(--fl-ink); }
.fl.ed .fl-start .fl-t, .fl.ed .fl-end .fl-t, .fl.ed .fl-root .fl-t { fill: var(--fl-bg); }
.fl.ed :is(.fl-start, .fl-end, .fl-root) :is(.fl-b, .fl-dot, .fl-tag text) { fill: color-mix(in srgb, var(--fl-bg) 80%, var(--fl-ink)); }
.fl.ed :is(.fl-start, .fl-end, .fl-root) .fl-tag rect { stroke: color-mix(in srgb, var(--fl-bg) 60%, var(--fl-ink)); }
.fl-n.focal .fl-card { fill: var(--fl-accent-tint); stroke: var(--fl-accent); stroke-width: 1.6; }
.fl-n.focal .fl-t { fill: var(--fl-accent); }
.fl-pt { fill: var(--fl-ink); }
.fl-pt.ring { fill: none; stroke: var(--fl-ink); stroke-width: 1.5; }
.fl-tag rect { fill: none; stroke: color-mix(in srgb, var(--fl-ink) 40%, transparent); stroke-width: 0.8; }
.fl-tag text { fill: var(--fl-mute); font-family: var(--fl-mono); font-size: 8.5px; letter-spacing: 0.04em; }
.fl-t { fill: var(--fl-ink); font-size: ${FLOW.title}px; font-weight: 700; }
.fl.ed .fl-t { font-family: var(--fl-name); font-weight: 600; }
.fl-b { fill: var(--fl-mute); font-size: ${FLOW.body}px; }
.fl.ed .fl-b { font-family: var(--fl-mono); font-size: 10.5px; }
.fl-e { fill: none; stroke: var(--fl-edge); stroke-width: var(--fl-w-edge); }
.fl-e.dash { stroke-dasharray: 5 4; }
.fl-e.bold { stroke: var(--fl-ink); stroke-width: var(--fl-w-bold); }
.fl.ed .fl-e.bold { stroke: var(--fl-accent); }
.fl-e.link { stroke: var(--fl-link); }
.fl-ah { fill: none; stroke: var(--fl-edge); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.fl-ah.bold { stroke: var(--fl-ink); stroke-width: 2; }
.fl.ed .fl-ah.bold { stroke: var(--fl-accent); stroke-width: 1.6; }
.fl-ah.link { stroke: var(--fl-link); }
.fl-dot { fill: var(--fl-mute); }
.fl-l rect { fill: var(--fl-bg); stroke: var(--fl-line); }
.fl.ed .fl-l rect { stroke: none; }
.fl-l text { fill: var(--fl-ink); font-size: 11px; }
.fl.ed .fl-l text { fill: var(--fl-soft); font-family: var(--fl-mono); font-size: 10px; }
/* 묶음(경계 상자 · 스윔레인 레인 같이): 색마다 옅은 바탕(테두리는 더 옅게) + 왼쪽 위 이름 뱃지. 에디토리얼은 색을 조금 줄인다. 2026-11-14 사용자 "뿌연 느낌, 배경색 더 진하게": 바탕 7.5% → 22%(에디토리얼 20%).
   --fl-zone-a 바탕 농도 · --fl-zone-b 테두리 농도 · --fl-badge-a 뱃지 바탕 · --fl-badge-b 뱃지 테두리 · --fl-badge-ink 뱃지 글(색과 잉크를 섞는 비율). gn 은 이름 없는 레인(무채색) */
.fl { --fl-g0: #3d6fe0; --fl-g1: #17a08a; --fl-g2: #8b5cf6; --fl-g3: #d08a12; --fl-g4: #e0517a; --fl-g5: #5f9a2e; --fl-zone-a: 0.22; --fl-zone-b: 0.5; --fl-badge-a: 26%; --fl-badge-b: 55%; --fl-badge-ink: 62%; }
.fl.ed { --fl-zone-a: 0.2; --fl-zone-b: 0.45; }
.g0 { --fl-gc: var(--fl-g0); } .g1 { --fl-gc: var(--fl-g1); } .g2 { --fl-gc: var(--fl-g2); } .g3 { --fl-gc: var(--fl-g3); } .g4 { --fl-gc: var(--fl-g4); } .g5 { --fl-gc: var(--fl-g5); } .gn { --fl-gc: var(--fl-mute); }
.fl-zone { fill: var(--fl-gc); fill-opacity: var(--fl-zone-a); stroke: var(--fl-gc); stroke-opacity: var(--fl-zone-b); stroke-width: var(--fl-w-card); }
.fl-badge rect { fill: color-mix(in srgb, var(--fl-gc) var(--fl-badge-a), var(--fl-bg)); stroke: color-mix(in srgb, var(--fl-gc) var(--fl-badge-b), var(--fl-bg)); stroke-width: var(--fl-w-card); }
.fl-badge text { fill: color-mix(in srgb, var(--fl-gc) var(--fl-badge-ink), var(--fl-ink)); font-size: 10.5px; font-weight: 700; }
.fl.ed .fl-badge text { font-family: var(--fl-name); }
.fl-legend line.rule { stroke: var(--fl-rule); }
.fl-legend text { fill: var(--fl-mute); font-size: 10.5px; }
.fl-legend text.eye { font-family: var(--fl-mono); font-size: 9.5px; letter-spacing: 0.08em; }
.fl-err { margin: 8px 0 0; padding-left: 18px; color: var(--crit, #d1383d); font-size: 0.85em; }
/* 곁 카드([[이름]]): 그림 옆 설명. 카드와 같은 바탕 · 테두리 + 왼쪽 세로 줄(연결선 색), 이름은 잉크(2026-11-15: 전에는 3% 바탕 · 흐린 이름 · 반투명 줄이라 연했다) */
.fl-att-card { fill: var(--fl-card); stroke: var(--fl-line); stroke-width: var(--fl-w-card); }
.fl-att-bar { fill: var(--fl-edge); }
.fl-att .fl-t { font-size: 11.5px; }
/* 강조 관계(!! · #강조 · #critical): 네온 형광 선 · 꺾쇠 · 빛 번짐(크리티컬 패스 등, 2026-11-13 사용자). 다른 선 꼴 뒤에 둬서 이긴다 */
.fl { --fl-hot: #a6e000; --fl-hot-glow: rgba(196, 255, 0, 0.75); }
.fl-e.hot, .fl-e.hot.bold, .fl-e.hot.link { stroke: var(--fl-hot); stroke-width: 2.6; filter: drop-shadow(0 0 2.5px var(--fl-hot-glow)) drop-shadow(0 0 7px var(--fl-hot-glow)); }
.fl-ah.hot { stroke: var(--fl-hot); }
.fl-l.hot rect { stroke: var(--fl-hot); stroke-width: 1.4; }
/* 체크 카드 · 하위 카드(2026-11-16): 체크 칸(체크면 링크 색으로 채우고 ✓), 체크된 카드 이름은 흐리게 + 가운데 줄, 하위 카드 잇는 선은 1px */
.fl-ck-box { fill: var(--fl-bg); stroke: var(--fl-mute); stroke-width: 1.2; }
.fl-ck.on .fl-ck-box { fill: var(--fl-link); stroke: var(--fl-link); }
.fl-ck-mark { fill: none; stroke: var(--fl-bg); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.fl-n.done .fl-t { fill: var(--fl-mute); }
.fl-strike { stroke: var(--fl-mute); stroke-width: 1.1; }
.fl.wired .fl-ck { cursor: pointer; }
.fl.wired .fl-ck:hover .fl-ck-box { stroke: var(--fl-link); }
.fl-sub { fill: none; stroke: var(--fl-edge); stroke-width: 1; }
/* 링크 표시(↗, 카드 오른쪽 위): 링크 색 옅은 바탕 + 꺾인 화살 */
.fl-lk rect { fill: color-mix(in srgb, var(--fl-link) 12%, var(--fl-bg)); stroke: color-mix(in srgb, var(--fl-link) 50%, var(--fl-bg)); stroke-width: 0.8; }
.fl-lk path { fill: none; stroke: var(--fl-link); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.fl-stage { position: relative; width: max-content; margin: 0 auto; }
/* 확대 · 이동 · 링크(미리보기 · 큰 화면, flowMount): 오른쪽 위 작은 단추 줄(배율 · 링크), 왼쪽 위 이동 줄(이전 · 지금 보는 곳) */
.fl.wired { position: relative; }
/* 손가락 기기: 그림 글을 눌러도 iOS 글 고르기 · "복사" 말풍선이 뜨지 않게(누르기는 링크 따라가기 · 단추에 쓴다) */
@media (pointer: coarse) { .fl.wired .fl-svg, .fl.wired .fl-tools, .fl.wired .fl-ov, .fl.wired .fl-nav { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; } }
.fl.wired > .fl-tools + figcaption, .fl.wired > .fl-nav { padding-right: 124px; min-height: 22px; }
@media (pointer: fine) { .fl.wired > .fl-tools + figcaption, .fl.wired > .fl-nav { padding-right: 176px; } }
.fl-capsp { height: 22px; margin-bottom: 6px; }
.fl-tools { position: absolute; top: 8px; right: 10px; z-index: 2; display: flex; gap: 4px; }
.fl-tb { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 7px; border: 1px solid color-mix(in srgb, var(--fl-ink) 18%, transparent); border-radius: 6px;
  background: var(--fl-bg); color: var(--fl-mute); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; white-space: nowrap; }
.fl-tb:hover { color: var(--fl-ink); border-color: color-mix(in srgb, var(--fl-ink) 35%, transparent); }
.fl-tb svg { width: 12px; height: 12px; flex: none; }
.fl-tb[aria-pressed="true"] { color: var(--fl-link); border-color: color-mix(in srgb, var(--fl-link) 55%, transparent); background: color-mix(in srgb, var(--fl-link) 12%, var(--fl-bg)); }
.fl-zoom { min-width: 44px; justify-content: center; font-variant-numeric: tabular-nums; }
.fl-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--fl-mute); font-size: 12px; }
.fl-nav .where { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-nav .where b { color: var(--fl-ink); font-weight: 600; }
/* 마우스 기기: 칸 안에서 ⌘ + 휠 확대 · 축소(그냥 휠은 페이지 스크롤, 전체 화면은 이동), 휠 클릭 끌기 이동(스크롤 막대 없음). 그림은 칸을 채우고 viewBox 로 보는 곳을 바꾼다 */
.fl-scroll.zoom { position: relative; overflow: hidden; }
.fl-scroll.zoom .fl-stage { position: absolute; inset: 0; width: auto; margin: 0; }
.fl-scroll.zoom .fl-svg { width: 100%; height: 100%; margin: 0; }
.fl-scroll.panning { cursor: grabbing; }
/* 칸 높이 손잡이(아래 변): 칸에 올리면 가는 막대가 보인다 */
.fl-grip { position: absolute; z-index: 3; left: 0; right: 0; bottom: 0; height: 10px; cursor: ns-resize; touch-action: none; }
.fl-grip::after { content: ""; position: absolute; left: 50%; bottom: 3px; width: 40px; height: 4px; margin-left: -20px; border-radius: 2px; background: color-mix(in srgb, var(--fl-ink) 30%, transparent); opacity: 0; transition: opacity 0.15s; }
.fl-scroll:hover > .fl-grip::after, .fl-scroll.sizing > .fl-grip::after { opacity: 1; }
.fl-scroll.sizing { cursor: ns-resize; user-select: none; }
/* 전체 화면(flowFull): body 아래 덮개 층에 그림 칸 하나. 칸은 화면을 채우고 그림 칸(.fl-scroll)이 남은 높이를 다 쓴다. 손가락 기기는 칸 폭에 맞춰(FLOW_CSS_FIT) 세로로 스크롤 */
.fl-fullwrap { position: fixed; inset: 0; z-index: 85; display: flex; background: rgba(0, 0, 0, 0.4); }
.fl.fl-full { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; max-width: none; margin: 0; border-radius: 0;
  padding: calc(env(safe-area-inset-top) + 12px) calc(env(safe-area-inset-right) + 14px) calc(env(safe-area-inset-bottom) + 12px) calc(env(safe-area-inset-left) + 14px); background: var(--fl-bg); }
.fl.fl-full > .fl-tools { top: calc(env(safe-area-inset-top) + 10px); right: calc(env(safe-area-inset-right) + 14px); }
.fl.fl-full .fl-scroll { flex: 1; min-height: 0; height: auto !important; }
.fl.fl-full .fl-scroll:not(.zoom) { overflow: auto; }
.fl.fl-full .fl-scroll.zoom { touch-action: none; }
.fl-fullb[aria-pressed="true"] { color: var(--fl-link); border-color: color-mix(in srgb, var(--fl-link) 55%, transparent); }
html.fl-full-on, html.fl-full-on body { overflow: hidden; }
.fl.wired .fl-n.has-link { cursor: pointer; }
.fl.wired .fl-n.has-link:hover .fl-card { stroke: var(--fl-link); }
/* 링크 보기: 카드 오른쪽 위 복사 단추(주소가 있으면 링크 색 테두리) */
.fl-ov { position: absolute; inset: 0; pointer-events: none; }
.fl-cp { position: absolute; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; pointer-events: auto; cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--fl-ink) 25%, transparent); border-radius: 6px; background: var(--fl-bg); color: var(--fl-mute); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }
.fl-cp.has { color: var(--fl-link); border-color: color-mix(in srgb, var(--fl-link) 55%, transparent); }
.fl-cp:hover { color: var(--fl-ink); }
.fl-cp svg { width: 12px; height: 12px; }
/* 연결 모드(flowConn): 카드에 올리면(손가락은 누르는 동안) 링크 색 굵은 테두리, 출발 카드는 링크 색 점선 테두리 */
.fl-connecting .fl.wired .fl-svg .fl-n { cursor: crosshair; }
@media (hover: hover) { .fl-connecting .fl.wired .fl-n:hover .fl-card, .fl-connecting .fl.wired .fl-n:hover .fl-pt { stroke: var(--fl-link); stroke-width: 2.2; } }
.fl-connecting .fl.wired .fl-n:active .fl-card, .fl-connecting .fl.wired .fl-n:active .fl-pt { stroke: var(--fl-link); stroke-width: 2.2; }
.fl.wired .fl-n.fl-conn-from .fl-card, .fl.wired .fl-n.fl-conn-from .fl-pt { stroke: var(--fl-link); stroke-width: 2.2; stroke-dasharray: 5 3; }
/* 연결 막대: 화면 위 가운데(메모 · 탭을 바꿔도 남는다). 손가락 기기에서 글 고르기 · "복사" 말풍선이 뜨지 않게 */
#fl-connbar { --fl-link: var(--active, #2e5aa8); position: fixed; z-index: 1000; top: 8px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; max-width: calc(100vw - 24px); box-sizing: border-box; padding: 5px 6px 5px 10px; border: 1px solid color-mix(in srgb, var(--fl-link) 55%, transparent);
  border-radius: 8px; background: color-mix(in srgb, var(--fl-link) 10%, var(--bg, #fff)); color: var(--text, #1a1a1a); font-size: 12px; line-height: 1.3;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#fl-connbar[hidden] { display: none; }
/* 연결 중: 칸 끝에 막대 높이만큼 빈자리(막대가 마지막 글 · 카드를 가리지 않게 그 위로 스크롤된다) */
.fl-connecting::after { content: ""; display: block; height: 64px; }
#fl-connbar > svg { width: 14px; height: 14px; flex: none; color: var(--fl-link); }
#fl-connbar .t { display: flex; flex-direction: column; min-width: 0; }
#fl-connbar .t > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#fl-connbar .t b { color: var(--fl-link); font-weight: 700; }
#fl-connbar .t .m { color: var(--muted, #6b6b70); font-size: 11px; }
#fl-connbar button { flex: none; height: 24px; padding: 0 9px; border: 1px solid color-mix(in srgb, var(--text, #1a1a1a) 20%, transparent); border-radius: 6px;
  background: var(--bg, #fff); color: var(--text, #1a1a1a); font: inherit; font-size: 12px; cursor: pointer; }
#fl-connbar button:hover { border-color: color-mix(in srgb, var(--text, #1a1a1a) 40%, transparent); }
@media print { #fl-connbar { display: none; } }
/* 링크로 온 카드: 테두리 깜박임 1초 */
@keyframes fl-flash { from { stroke: var(--fl-link); stroke-width: 4; } to { stroke-width: 1; } }
.fl-n.fl-flash .fl-card, .fl-n.fl-flash .fl-pt { animation: fl-flash 0.25s ease-in-out 4 alternate; }
@media print { .fl { break-inside: avoid; } .fl-scroll { overflow: visible; } .fl-stage { width: auto; } .fl-svg { max-width: 100%; height: auto; } .fl-tools, .fl-ov, .fl-nav button, .fl-capsp, .fl-grip { display: none; } .fl-fullwrap { position: static; background: none; } }
${FLOW_CSS_FIT}`;
}

/** 그 화면 바탕이 어두운가(에디토리얼 판 고르기). 인쇄 · 시험은 밝은 판 */
function flowDark() {
  try {
    if (typeof getComputedStyle !== "function" || typeof document?.body === "undefined") return false;
    if (matchMedia?.("print").matches) return false;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor);
    return m ? (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255 < 0.45 : false;
  } catch {
    return false;
  }
}

// MARK: 공통 그리기(2026-11-15 사용자 "기본 diagram 의 배경 · 노드 모양 · 색이 마음에 든다, 스윔레인 · 다른 diagram 은 연하고 시인성이 떨어진다")
// 모든 종류(흐름도 · 상태도 · 스윔레인 · 아키텍처 · 데이터 흐름 · 트리)와 곁 카드가 같은 카드 글 · 묶음 영역 · 이름 뱃지 함수를 쓴다.
// 색 · 굵기 · 농도는 flowStyle 의 공통 토큰(--fl-tint · --fl-w-* · --fl-zone-* · --fl-badge-*)에서 온다

/** 카드 글: 제목 줄(tx 에서 시작) · 본문 줄 · 점 목록 점. x 는 카드 왼쪽, y 는 첫 제목 줄 기준선 */
function flowCardText(c, x, y, tx = x + FLOW.padX) {
  const title = c.title.map((t, i) => `<text class="fl-t" x="${tx}" y="${y + i * FLOW.lh}">${flowTextSvg(t)}</text>`).join("");
  const by = y + c.title.length * FLOW.lh + 6;
  const body = c.body
    .map((b, i) => `<text class="fl-b" x="${x + FLOW.padX + (b.indent ? 12 : 0)}" y="${by + i * FLOW.lh}">${flowTextSvg(b.text)}</text>${b.dot ? `<circle class="fl-dot" cx="${x + FLOW.padX + 4}" cy="${by + i * FLOW.lh - 4}" r="1.8"/>` : ""}`)
    .join("");
  return title + body;
}
/** 묶음 색 class: 차례 i 마다 6색을 돌려 쓴다. i 가 없으면(이름 없는 레인) 무채색 */
const flowZoneCls = (b) => (b.i == null ? "gn" : `g${b.i % 6}`);
/** 묶음 영역(옅은 색 바탕 + 같은 색 테두리). 경계 상자 · 스윔레인 레인이 같이 쓴다 */
const flowZoneSvg = (b) => `<rect class="fl-zone ${flowZoneCls(b)}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10"/>`;
/** 묶음 이름 뱃지(영역 왼쪽 위 안쪽). 선 위에 그려 가리지 않게 영역과 따로 그린다 */
function flowBadgeSvg(b) {
  const w = flowBadgeW(b.name);
  return `<g class="fl-badge ${flowZoneCls(b)}"><rect x="${b.x + 8}" y="${b.y + 8}" width="${w}" height="18" rx="5"/><text x="${b.x + 8 + w / 2}" y="${b.y + 21}" text-anchor="middle">${esc(b.name)}</text></g>`;
}

// MARK: 편집 힌트(메모 편집 칸의 ```flow 블록 안, memos.js 가 ``` 프리셋 팝오버로 띄운다, 2026-11-13 사용자 "IDE 프리셋처럼")
// [ (줄 처음) → 카드 꼴 · @ → 지시어 · "A -> " 뒤 → 이 블록의 카드 이름 · / (줄 처음) → 문법 모두. 고르면 { start, end } 를 insert 로 바꾸고 | 자리에 커서

const FLOW_HINT_DIRS = [
  ["@align center", "단 안 가운데 정렬(기본)"],
  ["@align left", "단 왼쪽 끝 정렬"],
  ["@align right", "단 오른쪽 끝 정렬"],
  ["@align top", "가로일 때 위 끝 정렬"],
  ["@align bottom", "가로일 때 아래 끝 정렬"],
  ["@dir down", "세로(위 → 아래, 기본)"],
  ["@dir right", "가로(왼쪽 → 오른쪽)"],
  ["@align-attachment right", "곁 카드 오른쪽(기본)"],
  ["@align-attachment left", "곁 카드 왼쪽"],
  ["@align-attachment top", "곁 카드 위"],
  ["@align-attachment bottom", "곁 카드 아래"],
  ["@묶음 차례: ", "묶음 띠 차례(가 | 나 | 다, 적지 않으면 선이 덜 건너는 차례)"],
  ["@묶음 꼴: 덩어리", "받기만 하는 끝 카드를 묶음 뒤 단으로 모아 묶음을 작게"],
].map(([label, note]) => ({ label, note, insert: `${label}|` }));
const FLOW_HINT_CARDS = [
  ["[이름]", "작업 카드(기본)", "[|]"],
  ["[이름] 조건", "갈래가 나뉘는 질문", "[|] 조건"],
  ["[이름] 시작", "시작", "[|] 시작"],
  ["[이름] 끝", "끝", "[|] 끝"],
  ["[이름] 상태", "상태도의 한 상태", "[|] 상태"],
  ["[이름] 메모", "곁들이는 설명(점선)", "[|] 메모"],
  ["[이름] 저장소", "DB · 파일", "[|] 저장소"],
  ["[이름] 외부", "바깥 시스템", "[|] 외부"],
  ["[[이름]]", "곁 카드(범례 · 참고, 그림 밖)", "[[|]]"],
].map(([label, note, insert]) => ({ label, note, insert }));
const FLOW_HINT_ALL = [
  ...FLOW_HINT_DIRS,
  ...FLOW_HINT_CARDS,
  { label: "이름 -> 이름 : 라벨", note: "관계(실선) · 라벨", insert: "| -> " },
  { label: "이름 --> 이름", note: "점선(예외 · 되돌림 · 비동기)", insert: "| --> " },
  { label: "이름 => 이름", note: "굵은 선(주된 흐름)", insert: "| => " },
  { label: "이름 ~> 이름", note: "외부 호출 · API", insert: "| ~> " },
  { label: "이름 -> 이름 !!", note: "네온 강조(크리티컬 패스)", insert: "| ->  !!" },
  { label: "제목: ", note: "그림 제목", insert: "제목: |" },
  { label: "번호: 켬", note: "카드 앞에 흐름 차례 번호", insert: "번호: 켬|" },
  { label: "종류: ", note: "흐름도 · 상태도 · 스윔레인 · 아키텍처 · 데이터 흐름 · 트리 · 시퀀스 · 데이터 모델", insert: "종류: |" },
  { label: "스타일: 에디토리얼", note: "종이 · 잉크 스타일", insert: "스타일: 에디토리얼|" },
  { label: "범례: 켬", note: "쓴 화살표마다 뜻", insert: "범례: 켬|" },
  { label: "// 주석", note: "그리지 않는 줄", insert: "// |" },
  { label: "링크: ^", note: "카드 본문: 그 주소(^id)의 카드로 이동", insert: "  링크: ^|" },
];

/**
 * 커서 자리의 편집 힌트 { kind, start, end, items: [{ label, note, insert }] }, 없으면 null. ```flow 블록 본문 안에서만
 * (memoFence 는 highlight.js). 다 친 것(고를 것이 그 글뿐)이면 띄우지 않는다
 */
function flowHintAt(text, pos) {
  if (typeof memoFence !== "function" || !/^(diagram|flow)$/.test(memoFence(text, pos) ?? "")) return null;
  const ls = text.lastIndexOf("\n", pos - 1) + 1;
  const nl = text.indexOf("\n", pos);
  const le = nl < 0 ? text.length : nl;
  const before = text.slice(ls, pos);
  const after = text.slice(pos, le);
  const ind = /^[ \t]*/.exec(before)[0];
  const start = ls + ind.length;
  const pick = (kind, s, e, items, query = "") => {
    const list = items.filter((x) => x.label !== query);
    return list.length ? { kind, start: s, end: e, items: list } : null;
  };
  // [ · [[ 만 친 줄(짝 ] 은 자동으로 들어온다): 카드 꼴
  let m = /^[ \t]*(\[\[?)$/.exec(before);
  if (m && /^\]*\s*$/.test(after)) return pick("card", start, le, m[1] === "[[" ? FLOW_HINT_CARDS.slice(-1) : FLOW_HINT_CARDS);
  if (after.trim()) return null;
  // @ 지시어(친 글로 거른다)
  m = /^[ \t]*(@[\w-]*(?: [\w-]*)?)$/.exec(before);
  if (m) return pick("dir", start, pos, FLOW_HINT_DIRS.filter((x) => x.label.startsWith(m[1].toLowerCase())), m[1]);
  // / 줄 처음: 문법 모두(친 글이 이름 · 설명에 든 것)
  m = /^[ \t]*\/(\S*)$/.exec(before);
  if (m) {
    const q = m[1].toLowerCase();
    return pick("all", start, pos, FLOW_HINT_ALL.filter((x) => !q || x.label.toLowerCase().includes(q) || x.note.includes(q)));
  }
  // 이 블록의 카드 이름(지금 줄은 빼고 읽는다). 친 글로 시작하는 것 먼저, 든 것 뒤에(대소문자 무시)
  const names = (q) => {
    const lines = text.split("\n");
    const row = text.slice(0, ls).split("\n").length - 1;
    let a = row;
    while (a > 0 && !/^\s*```/.test(lines[a - 1])) a--;
    let b = row;
    while (b < lines.length - 1 && !/^\s*```/.test(lines[b + 1])) b++;
    const g = flowParse(lines.slice(a, b + 1).filter((_, i) => a + i !== row).join("\n"));
    const k = q.trim().toLowerCase();
    const all = g.nodes.map((n) => n.name);
    const ranked = k ? [...all.filter((n) => n.toLowerCase().startsWith(k)), ...all.filter((n) => !n.toLowerCase().startsWith(k) && n.toLowerCase().includes(k))] : all;
    return ranked.map((n) => ({ label: n, note: "카드", insert: `${n}|` }));
  };
  // 관계 화살표 뒤 빈칸: 도착 카드 이름(친 글로 거른다)
  m = /\s(<-->|<->|-->|->|=>|~>|---|-\.-)\s([^:|!#]*)$/.exec(before);
  if (m && before.slice(0, m.index).trim()) return pick("name", pos - m[2].length, pos, names(m[2]), m[2]);
  // 줄 처음에 이름을 치는 중(들여쓰지 않은 줄, 화살표 · : 가 아직 없다): 출발 카드 이름(2026-11-13 사용자 "env 만 쳐도 environment")
  m = /^([^\s\[@\/#][^:|]*)$/.exec(before);
  if (m && !/\s(<-->|<->|-->|->|=>|~>|---|-\.-)(\s|$)/.test(` ${m[1]}`)) return pick("name", ls, pos, names(m[1]), m[1]);
  return null;
}

/**
 * 곁 카드 자리 → { W, H, dx, dy, html, cards: [{ name, x, y, w, h }] }. W · H 는 그림(w × h)을 품은 전체 크기, dx · dy 는 그림을 미는 양.
 * left · right 는 가로로 한 줄(위 끝 맞춤), top · bottom 은 세로로 한 줄(왼쪽 끝 맞춤). 첫 카드가 바깥 끝, 다음 카드가 그 안쪽
 */
function flowAttach(g, w, h) {
  const list = (g.attachments ?? []).map((a) => ({ name: a.name, ...flowMeasure({ name: a.name, kind: "task", lines: a.lines, tag: "" }, null, {}) }));
  if (!list.length) return { W: w, H: h, dx: 0, dy: 0, html: "", cards: [] };
  const GAP = 16;
  const PAD = 8;
  const side = g.attach ?? "right";
  const row = side === "left" || side === "right";
  const total = list.reduce((a, c) => a + (row ? c.w : c.h), 0) + GAP * (list.length - 1);
  const thick = Math.max(...list.map((c) => (row ? c.h : c.w)));
  let W = w;
  let H = h;
  let dx = 0;
  let dy = 0;
  if (side === "left") {
    dx = PAD + total + GAP;
    W = dx + w;
    H = Math.max(h, PAD * 2 + thick);
    let x = PAD;
    for (const c of list) Object.assign(c, { x, y: PAD }) && (x += c.w + GAP);
  } else if (side === "right") {
    W = w + GAP + total + PAD;
    H = Math.max(h, PAD * 2 + thick);
    let x = W - PAD;
    for (const c of list) Object.assign(c, { x: (x -= c.w), y: PAD }) && (x -= GAP);
  } else if (side === "top") {
    dy = PAD + total + GAP;
    H = dy + h;
    W = Math.max(w, PAD * 2 + thick);
    let y = PAD;
    for (const c of list) Object.assign(c, { x: PAD, y }) && (y += c.h + GAP);
  } else {
    H = h + GAP + total + PAD;
    W = Math.max(w, PAD * 2 + thick);
    let y = H - PAD;
    for (const c of list) Object.assign(c, { x: PAD, y: (y -= c.h) }) && (y -= GAP);
  }
  const html = list
    .map((c) => {
      const text = flowCardText(c, c.x, c.y + FLOW.padY + 12);
      return `<g class="fl-att"><rect class="fl-att-card" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="6"/><rect class="fl-att-bar" x="${c.x}" y="${c.y + 6}" width="3" height="${c.h - 12}" rx="1.5"/>${text}</g>`;
    })
    .join("");
  return { W, H, dx, dy, html, cards: list.map(({ name, x, y, w: cw, h: ch }) => ({ name, x, y, w: cw, h: ch })) };
}

/** 그림 제목 HTML: 짝 백틱은 <code> */
const flowCapHtml = (t) => flowCodeMarks(t).split(FLOW_CODE).map((x, i) => (i % 2 ? `<code>${esc(x)}</code>` : esc(x))).join("");
/** 인쇄 A4 쪽 안 크기(px, 96dpi): 세로 쪽 180mm × 210mm, 가로 쪽 267mm × 145mm(그림 제목 · 위 머리글 둘(h2 · h3, 다음 줄과 떼지 않는다) · 여백을 뺀 그림 자리) */
const FLOW_PRINT = { pw: 680, ph: 794, lw: 1009, lh: 548 };
/** 인쇄에서 가로 쪽이 세로 쪽보다 1.1배 넘게 크게 보이는 그림인가(BD1 #8: 구조도가 A4 세로에서 0.34배로 줄어 글이 안 보였다) */
const flowPrintWide = (W, H) => Math.min(1, FLOW_PRINT.lw / W, FLOW_PRINT.lh / H) > Math.min(1, FLOW_PRINT.pw / W, FLOW_PRINT.ph / H) * 1.1;

/**
 * 체크 카드의 체크 칸(이름 왼쪽, 체크면 채운 칸 + ✓) · 체크된 카드 이름 가운데 줄. tx: 이름이 놓일 자리(체크 칸 왼쪽), ty: 첫 이름 줄 기준선.
 * 누르는 자리(.fl-ck-hit)는 칸보다 넓게. 인쇄 · 그림 복사에서도 보이게 모두 SVG 도형(글 꾸밈 text-decoration 은 쓰지 않는다)
 */
function flowCheckSvg(tx, ty, n) {
  const x = tx;
  const y = ty - 10.5;
  const mark = n.check ? `<path class="fl-ck-mark" d="M ${x + 2.6} ${y + 6} L ${x + 4.8} ${y + 8.3} L ${x + 8.6} ${y + 3.4}"/>` : "";
  const strike = n.check ? n.title.map((t, i) => `<line class="fl-strike" x1="${tx + FLOW.check - 1}" y1="${ty + i * FLOW.lh - 4}" x2="${Math.round((tx + FLOW.check + flowTextW(t, FLOW.title) + 1) * 10) / 10}" y2="${ty + i * FLOW.lh - 4}"/>`).join("") : "";
  return `<g class="fl-ck${n.check ? " on" : ""}"><title>${n.check ? "체크 풀기" : "체크"}</title><rect class="fl-ck-hit" x="${x - 6}" y="${y - 6}" width="23" height="23" fill="transparent"/><rect class="fl-ck-box" x="${x}" y="${y}" width="11" height="11" rx="2.5"/>${mark}</g>${strike}`;
}

/** ```flow 블록 → HTML(그림 · 못 읽은 줄). seq 는 본문에서 몇째 flow 블록인지(화살표 표식 id 를 가른다) */
function memoFlowHtml(text, seq = 0) {
  // 시퀀스 · 데이터 모델(BD1-3, 2026-11-16): 그림은 flow-seq.js · flow-model.js 가 짓는다(figure 틀 · 칸 · 못 읽은 줄은 같은 꼴)
  const type = flowParse(text).type;
  if (type === "seq" && typeof flowSeqHtml === "function") return flowSeqHtml(text, seq);
  if (type === "model" && typeof flowModelHtml === "function") return flowModelHtml(text, seq);
  flowStyle();
  const g = flowParse(text);
  const cls = `fl${g.style === "editorial" ? ` ed${flowDark() ? " dk" : ""}` : ""}`;
  const err = g.errors.length ? `<ul class="fl-err">${g.errors.map((x) => `<li>${x.line}째 줄${x.why ? `: ${esc(x.why)}` : "을 읽지 못했습니다"}: ${esc(x.text)}</li>`).join("")}</ul>` : "";
  if (!g.nodes.length) return `<figure class="${cls}" data-flow-block="${seq}" data-flow-hash="${flowHash(text)}">${g.title ? `<figcaption>${flowCapHtml(g.title)}</figcaption>` : ""}<p class="fl-b">카드가 없습니다. [이름] 줄로 카드를, 이름 -> 이름 줄로 관계를 적습니다</p>${err}</figure>\n`;
  const L = flowLayout(g);
  const id = `fl${seq}-${Math.random().toString(36).slice(2, 7)}`;
  // 화살표 끝은 꺾쇠(선으로 그린 >, 2026-11-13 사용자 "삼각형 말고 꺾쇠, 조금 더 크게", 같은 날 "부채처럼 더 펼쳐": 반각 약 38°). 꼭짓점이 선 끝에 닿는다. 종류: 기본 · 굵은(강조) · 외부 호출(파랑)
  const marker = (name, cls2, start) =>
    `<marker id="${id}-${name}" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="${cls2 === "bold" ? 15 : 13}" markerHeight="${cls2 === "bold" ? 15 : 13}" orient="${start ? "auto-start-reverse" : "auto"}" markerUnits="userSpaceOnUse"><path class="fl-ah${cls2 ? ` ${cls2}` : ""}" d="M3.5 0.5 L10.5 6 L3.5 11.5"/></marker>`;
  const defs = `<defs>${marker("a", "", false)}${marker("ab", "bold", false)}${marker("al", "link", false)}${marker("ah", "hot", false)}${marker("s", "", true)}${marker("sb", "bold", true)}${marker("sl", "link", true)}${marker("sh", "hot", true)}</defs>`;
  // 강조(!! · #강조) 관계는 네온 형광 선 · 꺾쇠 · 빛 번짐(.hot)
  const edgeKey = (o) => (o.hot ? "h" : o.bold ? "b" : o.link ? "l" : "");
  const edgeCls = (o) => `fl-e${o.dash ? " dash" : ""}${o.bold ? " bold" : ""}${o.link ? " link" : ""}${o.hot ? " hot" : ""}`;
  const edges = L.edges
    .map((e) => {
      const o = { ...(FLOW_OPS[e.op] ?? FLOW_OPS["->"]), hot: Boolean(e.hot) };
      const end = o.arrow !== "none" ? ` marker-end="url(#${id}-a${edgeKey(o)})"` : "";
      const start = o.arrow === "both" ? ` marker-start="url(#${id}-s${edgeKey(o)})"` : "";
      // data-k: 관계 차례(flowParse 의 edges 차례, 미리보기 편집이 선을 고를 때 읽는다, flow-edit.js)
      return `<path class="${edgeCls(o)}" d="${e.path}"${end}${start} data-k="${e.k}"><title>${esc(flowPlain(`${e.from} ${e.op} ${e.to}${e.label ? ` : ${e.label}` : ""}`))}</title></path>`;
    })
    .join("");
  // 라벨: 배치가 잡은 상자(lbox, 그림 안) 자리에. `코드` 는 고정폭
  const labels = L.edges
    .filter((e) => e.label && e.lbox)
    .map((e) => {
      const b = e.lbox;
      // 라벨 테두리는 선 꼴(BD1 #11 "어느 선 라벨인지 모호하다"): 점선 · 굵은 · 외부 호출
      const o = FLOW_OPS[e.op] ?? FLOW_OPS["->"];
      return `<g class="fl-l${e.hot ? " hot" : ""}${o.dash ? " dash" : ""}${o.bold ? " bold" : ""}${o.link ? " link" : ""}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="18" rx="${g.style === "editorial" ? 2 : 9}" data-k="${e.k}"/><text x="${b.x + b.w / 2}" y="${b.y + 13}" text-anchor="middle">${flowTextSvg(flowCodeMarks(e.label))}</text></g>`;
    })
    .join("");
  // 곁 카드로 그림을 민 양(A.dx · A.dy)을 알아야 해서 곁 카드 자리를 잡은 뒤 그린다
  const nodesOf = (A) => L.nodes
    .map((n) => {
      const cls2 = `fl-n fl-${n.kind}${n.root ? " fl-root" : ""}${n.focal ? " focal" : ""}${n.link ? " has-link" : ""}${n.sub ? " fl-subn" : ""}${n.check ? " done" : ""}`;
      // 노드 주소 · 링크 · 이름 · 자리(곁 카드로 민 만큼 더한 그림 좌표): 미리보기의 링크 복사 · 따라가기 · 가운데로 옮기기가 읽는다(그림에는 주소 글을 보이지 않는다)
      // 하위 카드(data-sub) · 체크 카드는 블록 안 머리 줄 차례(data-line, 0부터): 같은 이름이 여럿이어도 체크 바꾸기 · 편집이 그 줄을 찾는다
      const attrs = ` data-name="${esc(n.name)}" data-box="${n.x + A.dx} ${n.y + A.dy} ${n.w} ${n.h}"${n.ref ? ` data-ref="${n.ref}"` : ""}${n.link ? ` data-link="${n.link}"` : ""}${n.sub ? ` data-sub="${n.depth}"` : ""}${n.line != null ? ` data-line="${n.line}"` : ""}`;
      if (n.dot) {
        // 상태도: 시작은 채운 점, 끝은 고리 점(diagram-design 상태도)
        const cx = n.x + n.w / 2;
        const cy = n.y + n.h / 2;
        const body = n.kind === "start" ? `<circle class="fl-pt" cx="${cx}" cy="${cy}" r="6"/>` : `<circle class="fl-pt ring" cx="${cx}" cy="${cy}" r="8"/><circle class="fl-pt" cx="${cx}" cy="${cy}" r="5"/>`;
        // 점 이름(BD1 #13): 기본 이름(시작 · 끝)이 아니면 점 옆 글
        const dl = n.dlbox ? `<text class="fl-dl" x="${n.dlbox.x + n.dlbox.w / 2}" y="${n.dlbox.y + n.dlbox.h - 4}" text-anchor="middle">${esc(n.dl)}</text>` : "";
        return `<g class="${cls2}"${attrs}><title>${esc(flowPlain(n.name))}</title>${body}${dl}</g>`;
      }
      const ed = g.style === "editorial";
      const rx = n.kind === "start" || n.kind === "end" ? Math.min(n.h / 2, 18) : n.kind === "state" ? (ed ? 8 : 14) : n.kind === "ext" ? 2 : ed ? 6 : 8;
      const ty = n.y + n.oy + FLOW.padY + 12 + (n.kind === "store" ? 6 : 0);
      const tx = n.x + FLOW.padX + (n.kind === "cond" ? 14 : 0);
      const text = flowCardText(n, n.x, ty, tx + (n.check != null ? FLOW.check : 0));
      const dia = n.kind === "cond" ? `<path class="fl-dia" d="M ${n.x + FLOW.padX + 5} ${n.y + n.oy + FLOW.padY + 3} l 5 5 l -5 5 l -5 -5 z"/>` : "";
      const ck = n.check != null ? flowCheckSvg(tx, ty, n) : "";
      // 저장소: 위쪽에 원통 뚜껑 줄
      const cap = n.kind === "store" ? `<path class="fl-cap" d="M ${n.x} ${n.y + 8} Q ${n.x + n.w / 2} ${n.y + 15} ${n.x + n.w} ${n.y + 8}"/>` : "";
      // 형식 표(#태그): 오른쪽 위 작은 네모(둥근 알약 아님)
      const tw = n.tag ? flowTextW(n.tag, 8.5) + 12 : 0;
      const tag = n.tag ? `<g class="fl-tag"><rect x="${n.x + n.w - tw - 8}" y="${n.y + 7}" width="${tw}" height="13" rx="2"/><text x="${n.x + n.w - tw / 2 - 8}" y="${n.y + 16.5}" text-anchor="middle">${esc(n.tag)}</text></g>` : "";
      // 링크 표시(↗, 2026-11-16): 오른쪽 위(태그가 있으면 그 왼쪽). 누르면 링크를 따라간다(flowWire)
      const lx = n.x + n.w - 8 - (tw ? tw + 6 : 0) - FLOW.linkW;
      const lk = n.link ? `<g class="fl-lk"><title>^${esc(n.link)} 로 이동</title><rect x="${lx - 1}" y="${n.y + 6}" width="${FLOW.linkW + 2}" height="${FLOW.linkW + 2}" rx="3"/><path d="M ${lx + 3} ${n.y + 17} L ${lx + 11} ${n.y + 9} M ${lx + 5} ${n.y + 9} L ${lx + 11} ${n.y + 9} L ${lx + 11} ${n.y + 15}"/></g>` : "";
      // 바탕 가림(선이 비치지 않게) 뒤 카드
      return `<g class="${cls2}"${attrs}><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="var(--fl-bg)"/><rect class="fl-card" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}"/>${cap}${dia}${tag}${lk}${text}${ck}</g>`;
    })
    .join("");
  // 묶음(2026-11-14 사용자 "점선 대신 opacity 배경 연하게, 뱃지로 그룹명만, 피그마처럼"): 묶음마다 다른 색의 옅은 바탕 영역(boxes),
  // 이름은 왼쪽 위 안쪽 뱃지(badges, 선 위에 그려 가리지 않게)
  // 스윔레인 레인도 같은 꼴(2026-11-15 사용자 "스윔레인은 색도 연하고 시인성이 떨어진다"): 전에는 3% 회색 띠 · 가는 줄 · 흐린 고정폭 이름이었다.
  // 레인마다 묶음 색(같은 이름이면 경계 상자와 같은 색) 바탕 + 왼쪽 위 이름 뱃지. 테두리가 잘리지 않게 주 축 양 끝을 1 안쪽으로
  const down = g.dir !== "right";
  const laneZones = L.lanes.map((r, i) => ({ name: r.name || "기타", i: r.name ? i : null, ...(down ? { x: r.x, y: r.y + 1, w: r.w, h: r.h - 2 } : { x: r.x + 1, y: r.y, w: r.w - 2, h: r.h }) }));
  const zones = [...laneZones, ...L.boxes];
  const boxes = zones.map(flowZoneSvg).join("");
  const badges = zones.map(flowBadgeSvg).join("");
  // 범례: 그림 아래 가로 띠(가는 줄 + "범례" + 항목). 범례: 켬 이면 쓴 화살표마다 기본 뜻, 초점 카드가 있으면 "초점"
  let legend = "";
  let H = L.height;
  const items = g.legend === true ? [...new Set(L.edges.map((e) => e.op))].map((op) => ({ op, text: FLOW_OP_TEXT[op] ?? op })) : Array.isArray(g.legend) ? g.legend : [];
  if (g.legend && L.nodes.some((n) => n.focal)) items.push({ focal: true, text: "초점" });
  if (items.length) {
    let x = 52;
    let y = L.height + 22;
    const parts = [];
    for (const it of items) {
      const w = 34 + flowTextW(it.text, 10.5) + 18;
      if (x + w > Math.max(L.width, 320) - 8) {
        x = 52;
        y += 20;
      }
      if (it.focal) parts.push(`<rect x="${x}" y="${y - 6}" width="24" height="12" rx="3" fill="var(--fl-accent-tint)" stroke="var(--fl-accent)" stroke-width="1.4"/>`);
      else {
        const o = FLOW_OPS[it.op] ?? FLOW_OPS["->"];
        const end = o.arrow !== "none" ? ` marker-end="url(#${id}-a${edgeKey(o)})"` : "";
        const start = o.arrow === "both" ? ` marker-start="url(#${id}-s${edgeKey(o)})"` : "";
        parts.push(`<path class="${edgeCls(o)}" d="M ${x} ${y} L ${x + 26} ${y}"${end}${start}/>`);
      }
      parts.push(`<text x="${x + 34}" y="${y + 3.5}">${esc(it.text)}</text>`);
      x += w;
    }
    H = y + 16;
    legend = `<g class="fl-legend"><line class="rule" x1="8" y1="${L.height + 6}" x2="${Math.max(L.width, 320) - 8}" y2="${L.height + 6}"/><text class="eye" x="8" y="${L.height + 25.5}">범례</text>${parts.join("")}</g>`;
  }
  let W = items.length ? Math.max(L.width, 320) : L.width;
  // 곁 카드: 그림 옆(@align-attachment)에 바깥 끝에서 안쪽으로 늘어놓고, 그만큼 그림을 민다
  const A = flowAttach(g, W, H);
  W = A.W;
  H = A.H;
  // 하위 카드 잇는 선(1px 직각, 상위 카드 왼쪽 아래에서 하위 카드 왼쪽 가운데로)
  const subs = (L.subs ?? []).map((t) => `<path class="fl-sub" d="M ${t.x} ${t.y} V ${t.y + t.h}${t.stubs.map((u) => ` M ${t.x} ${t.y + u.dy} H ${t.x + u.w}`).join("")}"/>`).join("");
  const svg = `<svg class="fl-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-w="${W}" data-h="${H}" role="img" aria-label="${esc(flowPlain(g.title) || "다이어그램")}">${defs}<g${A.dx || A.dy ? ` transform="translate(${A.dx} ${A.dy})"` : ""}>${boxes}${edges}${badges}${subs}${nodesOf(A)}${labels}${legend}</g>${A.html}</svg>`;
  // fl-stage: 그림과 링크 복사 단추 층(fl-ov)을 같이 담는다(flowMount). data-flow-hash: 다시 그려도 같은 블록의 배율 · 이동을 찾는 표.
  // --fl-w: 그림 폭(BD1 #1, 확대 칸이 아닌 칸은 칸 폭에 맞춘다), wide: 인쇄에서 가로 쪽이 더 크게 보이는 그림(BD1 #8)
  const wide = flowPrintWide(W, H);
  return `<figure class="${cls}${wide ? " wide" : ""}" data-flow-block="${seq}" data-flow-hash="${flowHash(text)}">${g.title ? `<figcaption>${flowCapHtml(g.title)}</figcaption>` : ""}<div class="fl-scroll"><div class="fl-stage" style="--fl-w: ${W}px">${svg}</div></div>${err}</figure>\n`;
}

// MARK: 노드 주소 · 링크(순수 함수, 2026-11-16 사용자 "diagram 노드에 유니크한 주소값을 부여하고, link로 해당 주소를 입력하면 diagram만 해당 섹션으로 이동")
// 주소는 카드 머리 끝 ^id(소문자 · 숫자 6자), 링크는 카드 본문 줄 "링크: ^id". 서버 색인(server/diagram-refs.mjs)이 같은 꼴로 읽는다

/** 글 → 짧은 표(FNV-1a 32비트, 36진). 다시 그려도 같은 블록을 찾는 데 쓴다 */
function flowHash(s) {
  let h = 0x811c9dc5;
  const t = String(s ?? "");
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 본문의 ```diagram · ```flow 블록들 [{ start, end }](블록 안 글 자리, end 는 닫는 줄 맨 앞). 마크다운이 그리는 차례(data-flow-block)와 같다.
 * 다른 코드 블록 안의 ```diagram 줄은 블록으로 보지 않는다. 닫지 않은 블록은 글 끝까지
 */
function flowBlocks(src) {
  const s = String(src ?? "");
  const out = [];
  let pos = 0;
  let open = null;
  for (const line of s.split("\n")) {
    const next = pos + line.length + 1;
    if (!open) {
      const m = /^[ \t]*(`{3,})[ \t]*([^`]*?)[ \t]*$/.exec(line);
      if (m) open = { fence: m[1].length, diagram: /^(diagram|flow)$/.test(m[2]), start: Math.min(next, s.length) };
    } else {
      const c = /^[ \t]*(`{3,})[ \t]*$/.exec(line);
      if (c && c[1].length >= open.fence) {
        if (open.diagram) out.push({ start: open.start, end: pos });
        open = null;
      }
    }
    pos = next;
  }
  if (open?.diagram) out.push({ start: open.start, end: s.length });
  return out;
}

/** 본문의 노드 주소들 Map(id → { block, name, source, title }). 같은 id 가 여럿이면 앞의 것 */
function flowRefsIn(src) {
  const out = new Map();
  const s = String(src ?? "");
  flowBlocks(s).forEach((b, block) => {
    const source = s.slice(b.start, b.end);
    const g = flowParse(source);
    for (const n of g.nodes.flatMap((x) => [x, ...flowSubsOf(x)])) if (n.ref && !out.has(n.ref)) out.set(n.ref, { block, name: n.name, source, title: g.title });
  });
  return out;
}

/** 쓰지 않은 새 주소(소문자 · 숫자 6자). taken: 이미 쓴 id 들 */
function flowNewId(taken = new Set(), rnd = Math.random) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (;;) {
    let id = "";
    for (let i = 0; i < 6; i++) id += abc[Math.floor(rnd() * abc.length) % abc.length];
    if (!taken.has(id)) return id;
  }
}

/**
 * 본문의 block 번째 diagram 블록에서 이름이 name 인 카드에 주소 ^id 를 붙인 새 본문. 카드 머리 줄([이름] …)이 있으면 그 줄 끝에 " ^id",
 * 관계 줄에만 나온 카드면 블록 끝에 "[이름] ^id" 줄을 더한다(관계 줄보다 뒤라 카드 차례 · 배치가 바뀌지 않는다).
 * 이미 주소가 있으면 본문 그대로, 블록 · 카드가 없으면 null
 */
function flowAddRef(src, block, name, id, line = null) {
  const s = String(src ?? "");
  const b = flowBlocks(s)[block];
  if (!b) return null;
  const key = String(name ?? "").trim();
  const lines = s.slice(b.start, b.end).split("\n");
  // 하위 카드 · 체크 카드(line: 블록 안 머리 줄 차례, 같은 이름이 여럿이어도 그 줄)
  if (line != null && line !== "") {
    const at = Number(line);
    if (flowLineHead(lines[at]) !== key) return null;
    if (flowCutRef(lines[at].trim()).ref) return s;
    lines[at] = `${lines[at].replace(/\s+$/, "")} ^${id}`;
    return s.slice(0, b.start) + lines.join("\n") + s.slice(b.end);
  }
  const head = flowHeadAt(lines, key);
  if (head >= 0) {
    if (FLOW_REF_RE.test(lines[head].trim().replace(/^\[[^\]]+\]/, ""))) return s;
    lines[head] = `${lines[head].replace(/\s+$/, "")} ^${id}`;
  } else {
    if (!flowParse(lines.join("\n")).nodes.some((n) => n.name === key)) return null;
    let at = lines.length;
    while (at > 0 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, `[${key}] ^${id}`);
  }
  return s.slice(0, b.start) + lines.join("\n") + s.slice(b.end);
}

/** 블록 줄들에서 이름이 key 인 카드 머리 줄([이름] …, 들여 쓰지 않고 관계 줄 · 곁 카드가 아닌 줄)의 차례. 없으면 -1 */
function flowHeadAt(lines, key) {
  return lines.findIndex((l) => !/^\s/.test(l) && flowLineHead(l) === key);
}

/**
 * 머리 줄의 카드 이름(카드 머리 [이름] · 체크 카드 [ ] 이름 · 들여 쓴 하위 카드 줄), 아니면 null.
 * 들여 쓴 줄은 하위 카드 꼴(flowSubHead: [이름] 뒤가 꾸밈뿐)일 때만
 */
function flowLineHead(l) {
  if (l == null) return null;
  const t = String(l).trim();
  if (!t.startsWith("[") || t.startsWith("[[") || FLOW_OP_RE.test(` ${t} `)) return null;
  if (/^\s/.test(l)) return flowSubHead(t)?.name ?? null;
  const cb = flowCheckHead(t);
  if (cb) return cb.name;
  return /^\[([^\]]+)\]/.exec(t)?.[1].trim() ?? null;
}

/**
 * 체크 바꾸기(2026-11-16 사용자 "체크박스 카드"): 본문의 block 번째 diagram 블록에서 line 째 줄(블록 안 0부터)이 체크 카드 머리면 [ ] ↔ [x](want 를 주면 그 값).
 * 같은 이름의 카드가 여럿이어도 줄 차례로 찾는다. 체크 카드 줄이 아니면 null
 */
function flowToggleCheck(src, block, line, want = null) {
  const s = String(src ?? "");
  const b = flowBlocks(s)[block];
  if (!b) return null;
  const lines = s.slice(b.start, b.end).split("\n");
  const l = lines[Number(line)];
  const m = l != null && /^(\s*)\[( |x|X)\](\s+\S.*)$/.exec(l);
  if (!m || !flowCheckHead(l.trim())) return null;
  const on = want ?? m[2] === " ";
  lines[Number(line)] = `${m[1]}[${on ? "x" : " "}]${m[3]}`;
  return s.slice(0, b.start) + lines.join("\n") + s.slice(b.end);
}

/**
 * 연결 모드(2026-11-16): 본문의 block 번째 diagram 블록에서 이름이 name 인 카드 본문에 링크 줄 "링크: ^id" 를 넣은 새 본문.
 * - 카드 머리 줄이 있으면 그 바로 아래 들여 쓴 줄로 넣는다(들여 쓰기는 본문 첫 줄을 따르고, 본문이 없으면 빈칸 2개)
 * - 본문에 이미 링크 줄이 있으면 그 줄(첫째)을 바꾼다(링크는 카드마다 하나, flowParse 가 첫째만 읽는다)
 * - 관계 줄에만 나온 카드면 블록 끝에 "[이름]" 머리 줄 + 링크 줄을 더한다(관계 줄보다 뒤라 카드 차례 · 배치가 바뀌지 않는다)
 * 블록 · 카드가 없으면 null
 */
function flowSetLink(src, block, name, id, line = null) {
  const s = String(src ?? "");
  const b = flowBlocks(s)[block];
  if (!b) return null;
  const key = String(name ?? "").trim();
  const lines = s.slice(b.start, b.end).split("\n");
  const linkLine = (ind) => `${ind}링크: ^${id}`;
  // 하위 카드(line): 그 줄보다 더 들여 쓴 본문에서(하위의 하위 줄 앞까지) 링크 줄을 바꾸거나 바로 아래에 넣는다
  if (line != null && line !== "" && /^\s/.test(lines[Number(line)] ?? "")) {
    const at0 = Number(line);
    if (flowLineHead(lines[at0]) !== key) return null;
    const ci = flowIndent(lines[at0]);
    let first = -1;
    let at = -1;
    for (let i = at0 + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) continue;
      if (flowIndent(l) <= ci || flowSubHead(l.trim())) break;
      if (first < 0) first = i;
      if (FLOW_LINK_RE.test(l.trim())) {
        at = i;
        break;
      }
    }
    if (at >= 0) lines[at] = linkLine(/^\s*/.exec(lines[at])[0]);
    else lines.splice(at0 + 1, 0, linkLine(first >= 0 ? /^\s*/.exec(lines[first])[0] : `${/^\s*/.exec(lines[at0])[0]}  `));
    return s.slice(0, b.start) + lines.join("\n") + s.slice(b.end);
  }
  const head = flowHeadAt(lines, key);
  if (head >= 0) {
    // 카드 본문: 머리 줄 뒤 들여 쓴 줄들(빈 줄은 건너뛰고, 들여 쓰지 않은 줄에서 끝난다, flowParse 와 같다)
    let first = -1;
    let at = -1;
    for (let i = head + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) continue;
      // 하위 카드 줄부터는 하위 카드의 것(그 링크 줄을 바꾸지 않는다)
      if (!/^\s/.test(l) || flowSubHead(l.trim())) break;
      if (first < 0) first = i;
      if (FLOW_LINK_RE.test(l.trim())) {
        at = i;
        break;
      }
    }
    if (at >= 0) lines[at] = linkLine(/^\s*/.exec(lines[at])[0]);
    else lines.splice(head + 1, 0, linkLine(first >= 0 ? /^\s*/.exec(lines[first])[0] : "  "));
  } else {
    if (!flowParse(lines.join("\n")).nodes.some((n) => n.name === key)) return null;
    let at = lines.length;
    while (at > 0 && !lines[at - 1].trim()) at--;
    lines.splice(at, 0, `[${key}]`, linkLine("  "));
  }
  return s.slice(0, b.start) + lines.join("\n") + s.slice(b.end);
}

// MARK: 확대 · 이동 · 링크 보기 · 링크 따라가기(메모 미리보기 · 큰 화면, 2026-11-16 사용자 "마우스 휠로 해당 영역만 확대축소, 휠클릭 후 드래그 시 화면 이동,
// 해당 영역의 스크롤은 없어도 될거 같아")
// flowWire(root, opts) 는 한 번(누르기 · 휠 · 끌기를 root 에서 받는다), flowMount(root, doc) 는 그릴 때마다(그린 figure 에 단추 줄 · 확대 칸을 단다).
// 마우스 기기(pointer: fine)만 확대 칸(.fl-scroll.zoom, 그림은 칸을 채우고 viewBox 로 보는 곳을 바꾼다), 손가락 기기는 전처럼 가로 스크롤.
// 칸마다 보기 상태 { s 배율, x0 · y0 보는 곳 왼쪽 위(그림 좌표), h 칸 높이, auto 처음 보기, links 링크 보기, stack 이전, cur 지금 보는 다른 그림 }는
// 문서(doc)마다 블록 차례 · 내용 표로 기억해 다시 그려도(고칠 때 · 바깥에서 바뀔 때) 그대로 둔다

const FLOW_ZOOM_MIN = 0.25;
const FLOW_ZOOM_MAX = 4;
/** 링크로 간 카드가 이보다 작게 보이면 100% 로 */
const FLOW_FOCUS_MIN = 0.6;
const FLOW_LINK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
const FLOW_COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
/** 서버가 아는 모든 노드 주소(새 주소가 겹치지 않게, 링크 보기를 켤 때 읽는다) */
const FLOW_IDS = new Set();
let flowIdsAt = 0;
let flowRo = null;

const flowFine = () => typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
const flowClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const flowR = (n) => Math.round(n * 100) / 100;
const flowViewNew = () => ({ seq: 0, hash: "", s: 1, x0: 0, y0: 0, h: 0, auto: true, links: false, stack: [], cur: null });

function flowLoadIds() {
  if (Date.now() - flowIdsAt < 30_000 || typeof fetch !== "function") return;
  flowIdsAt = Date.now();
  fetch("/api/diagram/ids", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.ids?.forEach((x) => FLOW_IDS.add(x)))
    .catch(() => {});
}

/**
 * 글을 클립보드로. 돌려줌: Promise<boolean>(복사했나).
 * 누른 순간 clipboard API(보안 출처). 없으면 그 자리에서 숨긴 글 칸 + execCommand("copy").
 * 2026-11-16 사용자 "링크 누르면 모바일에서 중앙에 클립보드 복사 버튼이 뜬다": 전에는 clipboard API 가 거절된 뒤(누른 순간이 지난 뒤) 화면 밖(left -9999)
 * 글 칸을 골라, iOS 가 화면 가운데에 "복사" 말풍선을 띄웠다. 이제 거절되면 글 칸을 쓰지 않고, 글 칸은 화면 안 1px 에 두고 고른 것을 바로 지운다
 */
function flowClip(text) {
  const old = () => {
    const t = document.createElement("textarea");
    t.value = text;
    t.readOnly = true;
    t.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none";
    document.body.append(t);
    t.focus({ preventScroll: true });
    t.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    t.blur();
    getSelection?.()?.removeAllRanges();
    t.remove();
    return ok;
  };
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
  } catch {}
  return Promise.resolve(old());
}

/** 칸 크기가 바뀌면(창 · 나눈 칸 폭, 편집 → 미리보기로 보이게 됨) 다시 맞춘다 */
function flowObserve(sc) {
  if (typeof ResizeObserver !== "function") return;
  flowRo ??= new ResizeObserver((list) => {
    for (const en of list) {
      const sc2 = en.target;
      if (!sc2.isConnected) {
        flowRo.unobserve(sc2);
        continue;
      }
      const w = Math.round(en.contentRect.width);
      if (sc2._flW === w) continue;
      sc2._flW = w;
      // 다음 그림 차례에(칸 높이를 바꾸면 같은 차례에 다시 알려 ResizeObserver loop 오류가 난다)
      requestAnimationFrame(() => {
        const fig = sc2.closest("figure.fl");
        if (fig?._fl) flowApply(fig);
      });
    }
  });
  flowRo.observe(sc);
}

/** 보기 상태를 칸에 입힌다: 확대 칸이면 칸 높이 · viewBox · 배율 글, 링크 보기면 복사 단추 자리 */
function flowApply(fig) {
  const st = fig._fl;
  const sc = fig.querySelector(".fl-scroll");
  const svg = sc?.querySelector(".fl-svg");
  if (!st || !svg) return;
  const W = Number(svg.dataset.w);
  const H = Number(svg.dataset.h);
  if (sc.classList.contains("zoom")) {
    const vw = sc.clientWidth;
    // 안 보이는 칸(편집 화면)은 폭이 0: 보이게 되면 ResizeObserver 가 다시 부른다
    if (!vw) return;
    if (st.full) {
      // 전체 화면: 칸 높이는 화면이 정한다(flex). 처음 보기는 그림 전체가 화면에 들게 가로 · 세로 둘 다 맞춘다(작은 그림은 2배까지 키운다)
      const vh = sc.clientHeight;
      if (!vh) return;
      if (st.auto) {
        st.s = Math.min(2, vw / W, vh / H);
        st.x0 = -(vw / st.s - W) / 2;
        st.y0 = -(vh / st.s - H) / 2;
      }
      st.h = vh;
      svg.setAttribute("viewBox", `${flowR(st.x0)} ${flowR(st.y0)} ${flowR(vw / st.s)} ${flowR(vh / st.s)}`);
      const z = fig.querySelector(":scope > .fl-tools .fl-zoom");
      if (z) z.textContent = `${Math.round(st.s * 100)}%`;
      return flowOverlay(fig);
    }
    if (st.auto || !st.h) {
      // 처음 보기: 칸 폭보다 넓으면 폭에 맞춤, 아니면 100%. 칸 높이는 그 높이(긴 그림은 화면 높이의 75% 까지, 나머지는 끌어서 본다)
      st.s = Math.min(1, vw / W);
      st.h = Math.ceil(Math.min(H * st.s, Math.max(260, (typeof innerHeight === "number" ? innerHeight : 800) * 0.75)));
      st.x0 = W * st.s < vw ? -(vw / st.s - W) / 2 : 0;
      st.y0 = 0;
    }
    if (st.hUser) st.h = st.hUser;
    sc.style.height = `${st.h}px`;
    svg.setAttribute("viewBox", `${flowR(st.x0)} ${flowR(st.y0)} ${flowR(vw / st.s)} ${flowR(st.h / st.s)}`);
    const z = fig.querySelector(":scope > .fl-tools .fl-zoom");
    if (z) z.textContent = `${Math.round(st.s * 100)}%`;
  }
  flowOverlay(fig);
}

/** 링크 보기: 카드마다 오른쪽 위 복사 단추(확대 칸이면 보는 곳 · 배율로 옮긴 자리) */
function flowOverlay(fig) {
  const st = fig._fl;
  const stage = fig.querySelector(".fl-stage");
  if (!stage) return;
  let ov = stage.querySelector(":scope > .fl-ov");
  if (!st?.links) return ov?.remove();
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "fl-ov";
    stage.append(ov);
  }
  const zoom = fig.querySelector(".fl-scroll.zoom");
  const s = zoom ? st.s : 1;
  const x0 = zoom ? st.x0 : 0;
  const y0 = zoom ? st.y0 : 0;
  const svg = stage.querySelector(".fl-svg");
  const maxL = zoom ? Infinity : Number(svg?.dataset.w ?? 0) - 22;
  const nodes = [...stage.querySelectorAll(".fl-svg .fl-n[data-box]")];
  ov.innerHTML = nodes
    .map((n, i) => {
      const [x, y, w] = n.dataset.box.split(" ").map(Number);
      // 손가락 기기(가로 스크롤 칸)는 단추가 칸 밖으로 나가 세로 스크롤이 생기지 않게 그림 안으로
      // 카드 오른쪽 위 모서리 바깥쪽(카드 안 ↗ 표시 · #태그를 가리지 않게)
      const left = Math.min(maxL, (x + w - x0) * s - 8);
      const top = zoom ? (y - y0) * s - 14 : Math.max(0, y - 14);
      const ref = n.dataset.ref;
      const tip = ref ? `주소 ^${ref} 복사` : "주소를 만들어 복사";
      return `<button type="button" class="fl-cp${ref ? " has" : ""}" data-fl="copy" data-i="${i}" style="left:${flowR(left)}px;top:${flowR(top)}px" title="${esc(`${n.dataset.name} · ${tip}`)}" aria-label="${esc(`${n.dataset.name} ${tip}`)}">${FLOW_COPY_ICON}</button>`;
    })
    .join("");
}

/** 단추 줄 · 이동 줄 · 확대 칸을 단다(다시 불러도 된다) */
/**
 * 그림 복사(2026-11-16 사용자 "diagram 이미지로 클립보드 복사 가능한가?"): 그린 SVG 를 복제해 요소마다 지금 계산된 색 · 선 · 글꼴을 style 로 적고
 * (그림으로 바꾸면 페이지 CSS 가 먹지 않는다) 그림 전체(viewBox 0 0 W H) · 칸 바탕색으로 2배 PNG. 누른 순간 ClipboardItem 에 약속을 넘겨 WebKit 도 받는다
 */
const FLOW_PNG_PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "filter",
  "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "dominant-baseline", "paint-order", "visibility", "display"];
function flowPng(fig, scale = 2) {
  return new Promise((resolve, reject) => {
    const svg = fig.querySelector(".fl-svg");
    if (!svg) return reject(new Error("그림 없음"));
    const W = Number(svg.dataset.w) || svg.getBBox().width;
    const H = Number(svg.dataset.h) || svg.getBBox().height;
    const clone = svg.cloneNode(true);
    const from = [svg, ...svg.querySelectorAll("*")];
    const to = [clone, ...clone.querySelectorAll("*")];
    from.forEach((el, i) => {
      const cs = getComputedStyle(el);
      to[i].setAttribute("style", `${FLOW_PNG_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";")};animation:none`);
    });
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox", `0 0 ${W} ${H}`);
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    const bg = getComputedStyle(fig).getPropertyValue("--fl-bg").trim() || getComputedStyle(fig).backgroundColor || "#fff";
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", String(W));
    rect.setAttribute("height", String(H));
    rect.setAttribute("style", `fill:${bg}`);
    clone.prepend(rect);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.round(W * scale);
      c.height = Math.round(H * scale);
      const g = c.getContext("2d");
      g.scale(scale, scale);
      g.drawImage(img, 0, 0, W, H);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG"))), "image/png");
    };
    img.onerror = () => reject(new Error("그림 읽기"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  });
}
function flowCopyPng(root, fig) {
  const say = root?._flOpts?.say ?? (() => {});
  if (!(window.ClipboardItem && navigator.clipboard?.write)) return say("이 브라우저는 그림을 클립보드에 넣지 못합니다", "err");
  navigator.clipboard
    .write([new ClipboardItem({ "image/png": flowPng(fig) })])
    .then(() => say("그림(PNG)으로 복사했습니다"))
    .catch(() => say("그림으로 복사하지 못했습니다", "err"));
}

/**
 * 전체 화면(2026-11-16 사용자 "diagram 미리보기 시 해당 diagram 을 전체 화면으로"): 그림 칸을 body 아래 덮개 층(.fl-fullwrap)으로 옮기고 원래 자리에는 같은 높이 자리표.
 * 메모 칸(나눈 칸은 container-type)이 position: fixed 의 기준이 되어 제자리에서는 화면을 덮지 못한다. 덮개 층에도 같은 누르기 · 휠 · 끌기(flowWire, 같은 opts)를 단다.
 * 닫으면(다시 누르기 · Esc) 원래 자리 · 배율로. 그사이 미리보기가 다시 그려져 자리표가 없어졌으면 덮개 층만 걷는다(새로 그린 칸이 이미 있다)
 */
let flowFullFig = null;
function flowFull(root, fig, on) {
  const st = fig._fl;
  if (on) {
    if (st.full) return;
    if (flowFullFig && flowFullFig !== fig) flowFull(null, flowFullFig, false);
    const ph = document.createElement("div");
    ph.className = "fl-fullph";
    ph.style.height = `${fig.offsetHeight}px`;
    fig.before(ph);
    const wrap = document.createElement("div");
    wrap.className = "fl-fullwrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "diagram 전체 화면");
    document.body.append(wrap);
    flowWire(wrap, root?._flOpts ?? {});
    wrap.append(fig);
    st.full = { ph, wrap, view: { s: st.s, x0: st.x0, y0: st.y0, h: st.h, auto: st.auto } };
    st.auto = true;
    fig.classList.add("fl-full");
    flowFullFig = fig;
    document.documentElement.classList.add("fl-full-on");
  } else {
    const f = st.full;
    if (!f) return;
    st.full = null;
    fig.classList.remove("fl-full");
    if (f.ph.isConnected) f.ph.replaceWith(fig);
    else fig.remove();
    f.wrap.remove();
    FLOW_ROOTS.delete(f.wrap);
    Object.assign(st, f.view);
    if (flowFullFig === fig) flowFullFig = null;
    document.documentElement.classList.remove("fl-full-on");
    if (!fig.isConnected) return;
  }
  const sc = fig.querySelector(".fl-scroll");
  if (sc && !on) sc.style.height = "";
  flowDecorate(fig);
}

function flowDecorate(fig) {
  const st = fig._fl;
  fig.classList.add("wired");
  fig.querySelectorAll(":scope > .fl-tools, :scope > .fl-nav, :scope > .fl-capsp, .fl-ov").forEach((x) => x.remove());
  const svg = fig.querySelector(".fl-svg");
  const sc = fig.querySelector(".fl-scroll");
  // 전체 화면은 손가락 기기도 확대 칸(한 손가락 끌기 이동 · 두 손가락 확대, flowWire)
  const fine = Boolean(svg) && (flowFine() || Boolean(st.full));
  if (st.stack.length) {
    const nav = document.createElement("div");
    nav.className = "fl-nav";
    const c = st.cur;
    const where = c ? `<b>${esc(c.memoTitle || "메모")}</b> · ${esc(c.title || "그림")}` : "처음 그림";
    nav.innerHTML = `<button type="button" class="fl-tb" data-fl="back" title="이전 그림으로(배율 · 보는 곳도 되돌린다)">‹ 이전</button><span class="where">${where}</span>`;
    fig.prepend(nav);
  } else if (svg && !fig.querySelector(":scope > figcaption")) {
    const sp = document.createElement("div");
    sp.className = "fl-capsp";
    fig.prepend(sp);
  }
  if (svg) {
    const tools = document.createElement("div");
    tools.className = "fl-tools";
    tools.innerHTML =
      (fine ? `<button type="button" class="fl-tb fl-zoom" data-fl="zoom" title="처음 보기로(⌘ + 휠: 확대 · 축소, 휠 클릭 끌기: 이동)">100%</button>` : "") +
      `<button type="button" class="fl-tb" data-fl="links" aria-pressed="${st.links}" title="링크 보기: 카드마다 주소(^id) 복사 단추">${FLOW_LINK_ICON}<span>링크</span></button>` +
      `<button type="button" class="fl-tb" data-fl="connect" aria-pressed="${Boolean(flowConn)}" title="연결: 출발 카드 → 도착 카드를 누르면 출발 카드 본문에 링크: ^주소(다른 그림 · 다른 메모도, Esc 취소)">${FLOW_CONN_ICON}<span>연결</span></button>` +
      `<button type="button" class="fl-tb" data-fl="png" title="그림(PNG)으로 클립보드에 복사(지금 배율과 상관없이 그림 전체)" aria-label="그림으로 복사">${FLOW_PNG_ICON}</button>` +
      `<button type="button" class="fl-tb fl-fullb" data-fl="full" aria-pressed="${Boolean(st.full)}" title="${st.full ? "전체 화면 닫기 (Esc)" : "전체 화면으로 보기"}" aria-label="${st.full ? "전체 화면 닫기" : "전체 화면"}">${FLOW_FULL_ICON}</button>`;
    fig.prepend(tools);
  }
  if (sc) {
    sc.classList.toggle("zoom", fine);
    if (fine) flowObserve(sc);
    else sc.style.height = "";
    // 칸 높이 손잡이(마우스 기기, 전체 화면 아님): 아래 변을 끌어 높이, 두 번 누르면 자동
    sc.querySelector(":scope > .fl-grip")?.remove();
    if (fine && !st.full) sc.insertAdjacentHTML("beforeend", '<div class="fl-grip" data-fl-grip title="끌어서 칸 높이 바꾸기 · 두 번 누르면 자동 높이" aria-hidden="true"></div>');
  }
  flowApply(fig);
  flowConnMark(fig);
  // 미리보기 편집(flow-edit.js): [편집] 단추 · 편집 줄 · 고른 카드
  if (typeof flowEditDecorate === "function") flowEditDecorate(fig);
}

/** 지금 보기 상태(st.cur)의 그림을 칸에 그린다: 다른 그림이면 그 글로 다시 그리고, 아니면 처음(메모의 그 블록) 그림 */
function flowShow(fig) {
  const st = fig._fl;
  if (st.cur) {
    fig._orig ??= { html: fig.innerHTML, cls: fig.className };
    const box = document.createElement("div");
    box.innerHTML = memoFlowHtml(st.cur.source, 900 + st.seq);
    const nf = box.firstElementChild;
    fig.className = nf.className;
    fig.innerHTML = nf.innerHTML;
  } else if (fig._orig) {
    fig.className = fig._orig.cls;
    fig.innerHTML = fig._orig.html;
    fig._orig = null;
  }
  flowDecorate(fig);
}

/** 그린 칸(root 안 diagram figure)마다 보기 상태를 찾아(블록 차례 · 내용 표) 단추 줄 · 확대 칸을 단다. doc: 지금 글 표(메모마다 따로 기억) */
function flowMount(root, doc = "") {
  if (!root?.querySelectorAll) return;
  const opts = root._flOpts ?? {};
  const figs = [...root.querySelectorAll("figure.fl[data-flow-block]")];
  // 칸 보기 상태들: 그리는 곳(root, 나눈 칸마다 따로) · 문서마다
  const views = (root._flViews ??= new Map());
  const prev = views.get(doc) ?? [];
  const used = new Set();
  const hashes = new Set(figs.map((f) => f.dataset.flowHash));
  const src = figs.length && opts.getSource ? opts.getSource() : null;
  const memoId = opts.memo?.()?.id ?? null;
  const states = figs.map((fig) => {
    if (fig._fl) return fig._fl;
    const seq = Number(fig.dataset.flowBlock);
    const hash = fig.dataset.flowHash;
    // 같은 차례 · 같은 내용 → 같은 내용(블록을 위에 더해 차례가 밀림) → 같은 차례(그 블록을 고침)
    let st =
      prev.find((s) => !used.has(s) && s.seq === seq && s.hash === hash) ??
      prev.find((s) => !used.has(s) && s.hash === hash) ??
      prev.find((s) => !used.has(s) && s.seq === seq && !hashes.has(s.hash));
    if (st) used.add(st);
    else st = flowViewNew();
    st.seq = seq;
    st.hash = hash;
    // 끌어서 정한 칸 높이(메모 · 블록 차례마다 이 기기에 기억, 2026-11-16 사용자 "diagram 미리보기 높이를 제어할 순 없나")
    st.hKey = `flowH:${memoId ?? doc}:${seq}`;
    if (st.hUser === undefined) {
      try {
        st.hUser = Number(localStorage.getItem(st.hKey)) || null;
      } catch {
        st.hUser = null;
      }
    }
    fig._fl = st;
    // 같은 메모의 다른 블록을 보던 중이면 지금 본문(저장 전 글까지)의 그 블록으로
    if (st.cur && src != null && memoId && st.cur.memoId === memoId) {
      const b = flowBlocks(src)[st.cur.block];
      if (b) st.cur.source = src.slice(b.start, b.end);
    }
    if (st.cur) flowShow(fig);
    else flowDecorate(fig);
    return st;
  });
  root.classList?.toggle("fl-connecting", Boolean(flowConn));
  views.delete(doc);
  views.set(doc, states);
  if (views.size > 60) views.delete(views.keys().next().value);
}

/** 지금 칸에서 상태 st 를 가진 figure(기다리는 동안 다시 그렸을 수 있다) */
const flowLive = (root, st) => [...root.querySelectorAll("figure.fl.wired")].find((f) => f._fl === st) ?? null;

/** 카드를 칸 가운데로(배율은 그대로, 너무 작으면 100%) + 테두리 깜박임. 그림 전체가 칸에 보이면 옮기지 않는다 */
function flowFocus(fig, n) {
  const st = fig._fl;
  const sc = fig.querySelector(".fl-scroll");
  const [x, y, w, h] = n.dataset.box.split(" ").map(Number);
  if (sc?.classList.contains("zoom") && sc.clientWidth) {
    const svg = sc.querySelector(".fl-svg");
    const vw = sc.clientWidth;
    const all = Number(svg.dataset.w) * st.s <= vw + 1 && Number(svg.dataset.h) * st.s <= st.h + 1;
    if (!all || st.s < FLOW_FOCUS_MIN) {
      if (st.s < FLOW_FOCUS_MIN) st.s = 1;
      st.x0 = x + w / 2 - vw / 2 / st.s;
      st.y0 = y + h / 2 - st.h / 2 / st.s;
      st.auto = false;
      flowApply(fig);
    }
  } else n.scrollIntoView?.({ block: "nearest", inline: "center" });
  n.classList.remove("fl-flash");
  void n.getBoundingClientRect();
  n.classList.add("fl-flash");
  setTimeout(() => n.classList.remove("fl-flash"), 1100);
}

/** 링크 ^id 따라가기: 지금 그림 → 지금 메모의 다른 블록(저장 전 글) → 서버 색인(다른 메모). 메모(편집 칸 · 탭 · 목록)는 그대로, 이 칸만 바꾼다 */
async function flowFollow(root, fig, id) {
  const opts = root._flOpts ?? {};
  const st = fig._fl;
  const here = fig.querySelector(`.fl-svg .fl-n[data-ref="${id}"]`);
  if (here) return flowFocus(fig, here);
  const memo = opts.memo?.() ?? {};
  let target = null;
  const src = opts.getSource?.();
  const local = src != null ? flowRefsIn(src).get(id) : null;
  if (local) target = { memoId: memo.id ?? null, memoTitle: memo.title ?? "", block: local.block, source: local.source, title: local.title };
  if (!target) {
    try {
      const r = await fetch(`/api/diagram/ref?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (r.ok) target = await r.json();
    } catch {}
  }
  if (!target?.source) return opts.say?.(`^${id} 를 찾지 못했습니다`, "err");
  const live = fig.isConnected ? fig : flowLive(root, st);
  if (!live) return;
  st.stack.push({ cur: st.cur, s: st.s, x0: st.x0, y0: st.y0, h: st.h, auto: st.auto });
  st.cur = { id, memoId: target.memoId ?? null, memoTitle: target.memoTitle ?? "", block: Number(target.block) || 0, source: target.source, title: target.title ?? "" };
  st.auto = true;
  flowShow(live);
  const n = live.querySelector(`.fl-svg .fl-n[data-ref="${id}"]`);
  if (n) flowFocus(live, n);
}

function flowBack(fig) {
  const st = fig._fl;
  const p = st.stack.pop();
  if (!p) return;
  Object.assign(st, { cur: p.cur, s: p.s, x0: p.x0, y0: p.y0, h: p.h, auto: p.auto });
  flowShow(fig);
}

/** 링크 보기 복사 단추: 주소가 있으면 복사, 없으면 새 주소를 만들어 메모 글의 그 카드 머리 줄에 붙이고(저장) 복사 */
function flowCopy(root, fig, i) {
  const opts = root._flOpts ?? {};
  const st = fig._fl;
  const n = fig.querySelectorAll(".fl-svg .fl-n[data-box]")[Number(i)];
  if (!n) return;
  const note = (ref) => `^${ref} 복사함 · 다른 카드 본문에 링크: ^${ref}`;
  // 복사가 안 되면(브라우저가 거절) 주소를 알림에 보여 직접 적게 한다
  const done = (ref, ok) => opts.say?.(ok ? note(ref) : `복사하지 못했습니다 · 주소는 ^${ref}(다른 카드 본문에 링크: ^${ref})`, ok ? undefined : "err");
  let ref = n.dataset.ref;
  if (ref) {
    flowClip(`^${ref}`).then((ok) => done(ref, ok));
    return;
  }
  const memo = opts.memo?.() ?? {};
  const own = !st.cur || (st.cur.memoId != null && st.cur.memoId === memo.id);
  if (!own || !opts.setSource || !opts.getSource || !(opts.editable?.() ?? false)) return opts.say?.("이 카드는 주소가 없고, 고칠 수 없는 메모라 주소를 붙이지 못했습니다", "err");
  const src = opts.getSource();
  ref = flowNewId(new Set([...FLOW_IDS, ...flowRefsIn(src).keys()]));
  const next = flowAddRef(src, st.cur ? st.cur.block : st.seq, n.dataset.name, ref, n.dataset.line ?? null);
  if (next == null) return opts.say?.("본문에서 이 카드 줄을 찾지 못했습니다", "err");
  const copied = flowClip(`^${ref}`);
  FLOW_IDS.add(ref);
  // 알림은 바로 한 번, 저장이 끝난 뒤 한 번 더(저장 상태 글이 덮지 않게)
  copied.then((ok) => {
    done(ref, ok);
    opts.setSource(next, ok ? note(ref) : `^${ref} 주소를 붙였습니다(복사는 하지 못했습니다)`);
  });
}

// MARK: 연결 모드(2026-11-16 사용자 "다른 diagram에서 미리보기에서 연결 클릭 > 다른 diagram 노드 클릭 으로 연동 가능한가?")
// [연결] → 출발 카드 A → 도착 카드 B(같은 그림 · 같은 메모의 다른 그림 · 다른 메모). B 에 주소가 없으면 B 머리 줄에 ^id 를 붙이고, A 본문에 "링크: ^B주소".
// 상태(flowConn)는 칸(root)마다가 아니라 화면에 하나: 메모 · 탭을 바꿔도, 다시 읽어도(sessionStorage) 남는다.
// 고칠 메모가 어느 칸에 열려 있으면 그 칸의 setSource(저장 전 글 · 저장 차례를 그 칸이 맡는다), 아니면 서버에서 읽어 고쳐 저장(base 로 409 를 받으면 덮어쓰지 않는다)

const FLOW_CONN_KEY = "flowConn";
/** 그림 복사 아이콘(겹친 네모 + 산) */
const FLOW_PNG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/><path d="m11 18 3-3 2 2 2-2 3 3"/></svg>';
/** 전체 화면 아이콘(네 모서리) */
const FLOW_FULL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const FLOW_CONN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.6 6H13a5 5 0 0 1 5 5v4.4"/></svg>';
/** null | { step: "from" } 출발 고르기 | { step: "to", a: { memoId, memoTitle, block, name, title } } 도착 고르기 */
let flowConn = null;
let flowConnRead = false;
let flowConnBusy = false;
/** 마지막으로 연결 모드를 쓴 칸의 알림(Esc · 막대 [취소] 가 쓴다) · 그 칸(막대 자리) */
let flowConnSay = null;
let flowConnRoot = null;
/** flowWire 한 칸들(미리보기 · 나눈 칸 · 큰 화면 본문) */
const FLOW_ROOTS = new Set();

function flowConnLoad() {
  if (flowConnRead) return;
  flowConnRead = true;
  try {
    const v = JSON.parse(sessionStorage.getItem(FLOW_CONN_KEY) ?? "null");
    if (v?.step === "from" || (v?.step === "to" && v.a?.memoId && typeof v.a.name === "string")) flowConn = v;
  } catch {}
}

function flowConnSave() {
  try {
    if (flowConn) sessionStorage.setItem(FLOW_CONN_KEY, JSON.stringify(flowConn));
    else sessionStorage.removeItem(FLOW_CONN_KEY);
  } catch {}
}

/** fig 를 그린 칸(flowWire 한 root) */
function flowRootOf(fig) {
  let r = fig;
  while (r && !r._flOpts) r = r.parentElement;
  return r ?? null;
}

/** fig 가 지금 보이는 그림의 자리 { memoId, memoTitle, block, title, own(이 칸의 메모), editable(own 일 때만, 아니면 서버가 정한다) } */
function flowWhere(root, fig) {
  const opts = root?._flOpts ?? {};
  const st = fig._fl;
  const memo = opts.memo?.() ?? {};
  const title = fig.querySelector(":scope > figcaption")?.textContent.trim() ?? "";
  if (!st.cur || (st.cur.memoId != null && st.cur.memoId === memo.id))
    return { memoId: memo.id ?? null, memoTitle: memo.title ?? "", block: st.cur ? st.cur.block : st.seq, title, own: true, editable: Boolean(opts.getSource && opts.setSource && (opts.editable?.() ?? false)) };
  return { memoId: st.cur.memoId ?? null, memoTitle: st.cur.memoTitle ?? "", block: st.cur.block, title, own: false, editable: null };
}

/** 칸 하나: [연결] 단추 눌림 표시, 출발 카드 표시(링크 색 점선 테두리) */
function flowConnMark(fig) {
  fig.querySelectorAll(".fl-n.fl-conn-from").forEach((n) => n.classList.remove("fl-conn-from"));
  fig.querySelector(':scope > .fl-tools [data-fl="connect"]')?.setAttribute("aria-pressed", String(Boolean(flowConn)));
  const a = flowConn?.a;
  const root = a && flowRootOf(fig);
  if (!root || !fig._fl) return;
  const w = flowWhere(root, fig);
  if (w.memoId !== a.memoId || w.block !== a.block) return;
  for (const n of fig.querySelectorAll(".fl-svg .fl-n[data-name]")) if (n.dataset.name === a.name && (a.line == null || n.dataset.line === String(a.line))) n.classList.add("fl-conn-from");
}

/** 화면 위 연결 막대(연결 중일 때만). 손가락 기기에서 글 고르기 말풍선이 뜨지 않게 CSS 로 글 고르기를 끈다 */
function flowConnBar() {
  if (typeof document?.getElementById !== "function" || !document.body) return;
  let bar = document.getElementById("fl-connbar");
  if (!flowConn) return bar?.remove();
  flowStyle();
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "fl-connbar";
    bar.setAttribute("role", "status");
    bar.addEventListener("click", (e) => {
      if (e.target.closest("[data-fl-conn='cancel']")) flowConnEnd("연결을 그만뒀습니다");
    });
    document.body.append(bar);
  }
  const a = flowConn.a;
  const where = a ? `${a.memoTitle || "메모"} · ${a.title || "그림"}` : "";
  bar.innerHTML =
    `${FLOW_CONN_ICON}<span class="t">` +
    (a ? `<span>연결 중: <b>${esc(a.name)}</b> → 도착 카드를 누르세요</span><span class="m">${esc(where)}</span>` : "<span>연결할 출발 카드를 누르세요 · Esc 취소</span>") +
    `</span><button type="button" data-fl-conn="cancel">취소</button>`;
  bar.title = a ? `출발: ${a.name} · ${where}` : "";
  flowConnPlace();
}

/**
 * 연결 막대 자리: 보이는 미리보기 칸(마지막으로 연결을 쓴 칸, 없으면 처음 보이는 칸)의 보이는 영역 아래 가운데.
 * 화면 위에 두면 휴대폰 머리 줄(목록 · 저장 단추)을 가려서 칸 아래로 둔다. 보이는 칸이 없으면(다른 탭 · 편집 보기) 숨긴다(연결 상태는 그대로)
 */
function flowConnPlace() {
  const bar = typeof document?.getElementById === "function" ? document.getElementById("fl-connbar") : null;
  if (!bar) return;
  const box = (el) => {
    if (!el?.isConnected) return null;
    let r = el.getBoundingClientRect();
    let { left, top, right, bottom } = r;
    // 잘라 보이는 조상(스크롤 칸)과 겹친 곳만
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      r = p.getBoundingClientRect();
      left = Math.max(left, r.left);
      top = Math.max(top, r.top);
      right = Math.min(right, r.right);
      bottom = Math.min(bottom, r.bottom);
    }
    bottom = Math.min(bottom, innerHeight);
    return right - left > 40 && bottom - top > 40 ? { left, top, right, bottom } : null;
  };
  const roots = [...FLOW_ROOTS];
  const v = box(flowConnRoot) ?? roots.map(box).find(Boolean);
  bar.hidden = !v;
  if (!v) return;
  bar.style.left = `${Math.round((v.left + v.right) / 2)}px`;
  bar.style.top = `${Math.round(v.bottom - bar.offsetHeight - 10)}px`;
  bar.style.maxWidth = `${Math.round(Math.max(200, v.right - v.left - 16))}px`;
}

/** 연결 상태를 모든 칸 · 막대에 입힌다 */
function flowConnPaint() {
  for (const r of FLOW_ROOTS) {
    if (!r.isConnected) continue;
    r.classList.toggle("fl-connecting", Boolean(flowConn));
    r.querySelectorAll("figure.fl.wired").forEach(flowConnMark);
  }
  flowConnBar();
}

function flowConnEnd(note, say = flowConnSay) {
  flowConn = null;
  flowConnSave();
  flowConnPaint();
  if (note) say?.(note);
}

/** [연결]: 꺼져 있으면 출발 고르기로, 연결 중이면 그만둔다 */
function flowConnToggle(root) {
  const say = root._flOpts?.say;
  flowConnSay = say ?? null;
  flowConnRoot = root;
  if (flowConn) return flowConnEnd("연결을 그만뒀습니다", say);
  flowConn = { step: "from" };
  flowConnSave();
  flowLoadIds();
  flowConnPaint();
  say?.("연결할 출발 카드를 누르세요 · Esc 취소");
}

/** 메모 memoId 의 글이 next 로 바뀌었다: 그 메모의 그림을 보던 칸(링크로 간 다른 메모 그림)을 새 글로 다시 그린다 */
function flowRefresh(memoId, next) {
  const blocks = flowBlocks(next);
  for (const r of FLOW_ROOTS) {
    if (!r.isConnected) continue;
    for (const fig of r.querySelectorAll("figure.fl.wired")) {
      const st = fig._fl;
      const b = st?.cur && st.cur.memoId === memoId ? blocks[st.cur.block] : null;
      if (!b) continue;
      st.cur.source = next.slice(b.start, b.end);
      flowShow(fig);
    }
  }
}

/**
 * 메모 memoId 의 글을 fns(글 → 새 글 | null) 차례로 고쳐 저장한다. 돌려줌: 오류 글 | null(됨).
 * 어느 칸에 열려 있으면 그 칸의 setSource, 아니면 GET /api/memos/<id> 로 읽고 POST /api/memos { id, title, body, folder, base }(409 면 덮어쓰지 않는다)
 */
async function flowEditMemo(memoId, fns, note) {
  const run = (s) => fns.reduce((acc, fn) => (acc == null ? null : fn(acc)), s);
  const miss = "본문에서 그 카드 줄을 찾지 못했습니다";
  for (const r of FLOW_ROOTS) {
    const o = r._flOpts;
    if (!r.isConnected || !o?.getSource || !o.setSource || o.memo?.()?.id !== memoId) continue;
    if (!(o.editable?.() ?? false)) return "연결 파일 · 읽을거리 · 고칠 수 없는 메모라 연결하지 못했습니다";
    const src = o.getSource();
    const next = run(src);
    if (next == null) return miss;
    if (next !== src) o.setSource(next, note);
    flowRefresh(memoId, next);
    return null;
  }
  if (typeof fetch !== "function") return "메모를 읽지 못했습니다";
  let memo = null;
  try {
    const r = await fetch(`/api/memos/${encodeURIComponent(memoId)}`, { cache: "no-store" });
    if (r.ok) memo = await r.json();
  } catch {}
  if (!memo) return "그 메모를 읽지 못했습니다";
  if (memo.link?.inDir) return "연결 폴더의 파일이라 연결하지 못했습니다";
  const body = String(memo.body ?? "");
  const next = run(body);
  if (next == null) return miss;
  if (next !== body) {
    const i = memoId.indexOf("/");
    let r = null;
    try {
      r = await fetch("/api/memos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: memoId, title: memo.title, body: next, folder: i >= 0 ? memoId.slice(0, i) : "", base: memo.updatedAt ?? null }),
      });
    } catch {}
    if (r?.status === 409) return `"${memo.title}" 을(를) 그 사이 다른 곳에서 고쳐 연결하지 않았습니다 · 다시 누르세요`;
    if (!r?.ok) return (await r?.json().catch(() => null))?.error ?? "저장하지 못했습니다";
  }
  flowRefresh(memoId, next);
  return null;
}

/** 연결 중 카드 누르기: 출발 고르기 → 도착 고르기(같은 카드면 그만둔다) → 주소 · 링크 줄 넣기 */
async function flowPick(root, fig, n) {
  const say = root._flOpts?.say ?? (() => {});
  flowConnSay = say;
  flowConnRoot = root;
  if (flowConnBusy || !flowConn) return;
  const w = flowWhere(root, fig);
  const name = n.dataset.name;
  if (flowConn.step !== "to") {
    if (!w.memoId) return say("저장한 메모의 카드만 출발로 고를 수 있습니다", "err");
    if (w.own && !w.editable) return say("연결 파일 · 읽을거리 · 고칠 수 없는 메모의 카드는 출발로 고를 수 없습니다", "err");
    flowConn = { step: "to", a: { memoId: w.memoId, memoTitle: w.memoTitle, block: w.block, name, title: w.title, line: n.dataset.line ?? null } };
    flowConnSave();
    flowConnPaint();
    return say(`출발: ${name} · 도착 카드를 누르세요(다른 그림 · 다른 메모도 됩니다)`);
  }
  const a = flowConn.a;
  if (w.memoId === a.memoId && w.block === a.block && name === a.name && (a.line ?? null) === (n.dataset.line ?? null)) return flowConnEnd("연결을 그만뒀습니다", say);
  if (!w.memoId) return say("저장한 메모의 카드만 도착으로 고를 수 있습니다", "err");
  let ref = n.dataset.ref || "";
  /** 메모마다 고칠 차례(같은 메모면 한 번에 고쳐 한 번 저장) */
  const jobs = new Map();
  const add = (id, fn) => jobs.set(id, [...(jobs.get(id) ?? []), fn]);
  if (!ref) {
    if (w.own && !w.editable) return say("도착 카드에 주소가 없고, 고칠 수 없는 메모라 주소를 붙이지 못했습니다", "err");
    const taken = new Set(FLOW_IDS);
    for (const r of FLOW_ROOTS) {
      const s = r.isConnected ? r._flOpts?.getSource?.() : null;
      if (s) for (const k of flowRefsIn(s).keys()) taken.add(k);
    }
    ref = flowNewId(taken);
    add(w.memoId, (s) => flowAddRef(s, w.block, name, ref, n.dataset.line ?? null));
  }
  add(a.memoId, (s) => flowSetLink(s, a.block, a.name, ref, a.line ?? null));
  const note = `${a.name} → ${name} 연결함`;
  flowConnBusy = true;
  try {
    for (const [id, fns] of jobs) {
      const err = await flowEditMemo(id, fns, note);
      // 연결 모드는 그대로(다시 누르거나 그만둔다)
      if (err) return say(err, "err");
    }
  } finally {
    flowConnBusy = false;
  }
  FLOW_IDS.add(ref);
  flowConnEnd(note, say);
}

/**
 * 체크 칸 누르기: 그 카드 머리 줄(data-line)의 [ ] ↔ [x] 를 바꿔 저장한다. 이 칸의 메모면 setSource, 링크로 간 다른 메모 그림이면 flowEditMemo(서버에 저장).
 * 고칠 수 없는 메모(연결 폴더 파일 · 읽을거리)는 알림만
 */
function flowCheck(root, fig, n) {
  const opts = root._flOpts ?? {};
  const say = opts.say ?? (() => {});
  const w = flowWhere(root, fig);
  const line = Number(n.dataset.line);
  const on = !n.classList.contains("done");
  const note = `"${n.dataset.name}" ${on ? "체크" : "체크 풀기"}`;
  const fn = (s) => flowToggleCheck(s, w.block, line, on);
  if (w.own) {
    if (!w.editable) return say("고칠 수 없는 메모라 체크를 바꾸지 못했습니다", "err");
    const src = opts.getSource();
    const next = fn(src);
    if (next == null) return say("본문에서 그 체크 카드 줄을 찾지 못했습니다", "err");
    opts.setSource(next, note);
    if (fig._fl?.cur && w.memoId) flowRefresh(w.memoId, next);
    return;
  }
  if (!w.memoId) return say("저장한 메모의 카드만 체크를 바꿀 수 있습니다", "err");
  flowEditMemo(w.memoId, [fn], note).then((err) => say(err ?? note, err ? "err" : undefined));
}

/**
 * root(미리보기 · 큰 화면 본문)의 diagram 칸에 확대 · 이동 · 링크를 단다(한 번). opts:
 * { getSource() 본문, setSource(새 본문, 저장 뒤 알림) 고쳐 저장, editable() 주소를 붙일 수 있는가, memo() { id, title }, say(글, "err") 알림 }
 */
function flowWire(root, opts = {}) {
  if (!root || root._flOpts) return;
  root._flOpts = opts;
  FLOW_ROOTS.add(root);
  flowConnLoad();
  // 미리보기 편집(flow-edit.js): 편집 중 누르기 · 점 끌기를 링크 따라가기 · 연결 고르기보다 먼저 받는다
  if (typeof flowEditWire === "function") flowEditWire(root);
  // 연결 중 Esc: 그만둔다(다른 Esc 동작보다 먼저, 한 번만 단다)
  if (!flowWire.keyOn && typeof document?.addEventListener === "function") {
    flowWire.keyOn = true;
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || (!flowConn && !flowFullFig)) return;
        e.preventDefault();
        e.stopPropagation();
        // 연결 중이면 연결을 먼저 그만두고, 아니면 전체 화면을 닫는다
        if (flowConn) flowConnEnd("연결을 그만뒀습니다");
        else flowFull(null, flowFullFig, false);
      },
      true,
    );
  }
  const figOf = (e) => {
    const fig = e.target.closest?.("figure.fl.wired");
    return fig && root.contains(fig) && fig._fl ? fig : null;
  };
  root.addEventListener("click", (e) => {
    const fig = figOf(e);
    if (!fig) return;
    const b = e.target.closest("[data-fl]");
    if (b) {
      e.preventDefault();
      const st = fig._fl;
      const what = b.dataset.fl;
      if (what === "zoom") {
        st.auto = true;
        flowApply(fig);
      } else if (what === "links") {
        st.links = !st.links;
        b.setAttribute("aria-pressed", String(st.links));
        if (st.links) flowLoadIds();
        flowOverlay(fig);
      } else if (what === "back") flowBack(fig);
      else if (what === "copy") flowCopy(root, fig, b.dataset.i);
      else if (what === "connect") flowConnToggle(root);
      else if (what === "full") flowFull(root, fig, !st.full);
      else if (what === "png") flowCopyPng(root, fig);
      return;
    }
    // 체크 칸(체크 카드): 그 줄의 [ ] ↔ [x] 를 바꿔 저장(연결 고르기 · 링크 따라가기보다 먼저. 편집 중에도 바꾸기, flow-edit.js 가 지나보낸다)
    const ck = e.target.closest(".fl-svg .fl-ck");
    const ckn = ck?.closest(".fl-n[data-line]");
    if (ckn) {
      e.preventDefault();
      flowCheck(root, fig, ckn);
      return;
    }
    // 연결 중: 카드 누르기는 링크 따라가기 대신 출발 · 도착 고르기
    const pick = flowConn && e.target.closest(".fl-svg .fl-n[data-box]");
    if (pick) {
      e.preventDefault();
      flowPick(root, fig, pick);
      return;
    }
    const n = e.target.closest(".fl-n[data-link]");
    if (n) {
      e.preventDefault();
      flowFollow(root, fig, n.dataset.link);
    }
  });
  // 휠(2026-11-16 사용자 "Cmd + 휠로 확대/축소, 그냥 휠은 스크롤에 쓰여야"): ⌘ + 휠 · 트랙패드 두 손가락 벌리기(ctrl + 휠로 온다)는 포인터 자리를 두고 확대 · 축소.
  // 그냥 휠은 막지 않아 페이지가 스크롤된다. 전체 화면은 스크롤할 페이지가 없어 그냥 휠 · 가로 굴림을 그림 이동으로 쓴다
  root.addEventListener(
    "wheel",
    (e) => {
      const sc = e.target.closest?.(".fl-scroll.zoom");
      const fig = sc && figOf(e);
      if (!fig) return;
      const st = fig._fl;
      const zoomKey = e.metaKey || e.ctrlKey;
      if (!zoomKey && !st.full) return;
      e.preventDefault();
      if (!zoomKey) {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? sc.clientHeight : 1;
        st.x0 += (e.deltaX * unit) / st.s;
        st.y0 += (e.deltaY * unit) / st.s;
        st.auto = false;
        return void flowApply(fig);
      }
      const r = sc.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (Math.abs(dx) > Math.abs(dy) && !e.ctrlKey) {
        st.x0 += dx / st.s;
      } else {
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const s = flowClamp(st.s * Math.exp(-flowClamp(dy, -120, 120) * (e.ctrlKey ? 0.01 : 0.0015)), FLOW_ZOOM_MIN, FLOW_ZOOM_MAX);
        st.x0 += px / st.s - px / s;
        st.y0 += py / st.s - py / s;
        st.s = s;
      }
      st.auto = false;
      flowApply(fig);
    },
    { passive: false },
  );
  // 칸 높이 손잡이: 끄는 만큼 칸 높이(140 ~ 화면 높이 3배), 놓으면 기억. 두 번 누르면 자동 높이로
  root.addEventListener("pointerdown", (e) => {
    const grip = e.button === 0 && e.target.closest?.("[data-fl-grip]");
    const fig = grip && figOf(e);
    if (!fig) return;
    e.preventDefault();
    const st = fig._fl;
    const sc = grip.parentElement;
    const y0 = e.clientY;
    const h0 = sc.clientHeight;
    sc.classList.add("sizing");
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {}
    const move = (m) => {
      st.hUser = Math.round(flowClamp(h0 + m.clientY - y0, 140, Math.max(600, (typeof innerHeight === "number" ? innerHeight : 800) * 3)));
      flowApply(fig);
    };
    const up = () => {
      sc.classList.remove("sizing");
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      try {
        if (st.hUser) localStorage.setItem(st.hKey, String(st.hUser));
      } catch {}
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  });
  root.addEventListener("dblclick", (e) => {
    const grip = e.target.closest?.("[data-fl-grip]");
    const fig = grip && figOf(e);
    if (!fig) return;
    const st = fig._fl;
    st.hUser = null;
    st.auto = true;
    try {
      localStorage.removeItem(st.hKey);
    } catch {}
    flowApply(fig);
  });
  // 휠 클릭 누르고 끌기: 이동(자동 스크롤 커서 · 붙여 넣기가 뜨지 않게 기본 동작을 막는다)
  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 1) return;
    const sc = e.target.closest?.(".fl-scroll.zoom");
    const fig = sc && figOf(e);
    if (!fig) return;
    e.preventDefault();
    const st = fig._fl;
    let lx = e.clientX;
    let ly = e.clientY;
    sc.classList.add("panning");
    try {
      sc.setPointerCapture(e.pointerId);
    } catch {}
    const move = (m) => {
      st.x0 -= (m.clientX - lx) / st.s;
      st.y0 -= (m.clientY - ly) / st.s;
      lx = m.clientX;
      ly = m.clientY;
      st.auto = false;
      flowApply(fig);
    };
    const up = () => {
      sc.classList.remove("panning");
      sc.removeEventListener("pointermove", move);
      sc.removeEventListener("pointerup", up);
      sc.removeEventListener("pointercancel", up);
    };
    sc.addEventListener("pointermove", move);
    sc.addEventListener("pointerup", up);
    sc.addEventListener("pointercancel", up);
  });
  for (const type of ["mousedown", "auxclick"])
    root.addEventListener(type, (e) => {
      if (e.button === 1 && e.target.closest?.(".fl-scroll.zoom")) e.preventDefault();
    });
  // 전체 화면 손가락: 한 손가락 끌기 = 이동, 두 손가락 = 두 점 가운데를 두고 확대 · 축소. 6px 넘게 움직여야 끌기로 본다(톡 누르기는 링크 따라가기 · 연결 그대로)
  const touches = new Map();
  let gesture = null;
  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const sc = e.target.closest?.(".fl.fl-full .fl-scroll.zoom");
    const fig = sc && figOf(e);
    if (!fig) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture || gesture.fig !== fig) gesture = { fig, sc, moved: false };
  });
  const tmove = (e) => {
    if (!gesture || !touches.has(e.pointerId)) return;
    const { fig, sc } = gesture;
    const st = fig._fl;
    const prev = [...touches.values()].map((p) => ({ ...p }));
    const old = touches.get(e.pointerId);
    if (!gesture.moved && Math.hypot(e.clientX - old.x, e.clientY - old.y) < 6) return;
    gesture.moved = true;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = [...touches.values()];
    const r = sc.getBoundingClientRect();
    if (now.length >= 2) {
      const mid = (ps) => [(ps[0].x + ps[1].x) / 2 - r.left, (ps[0].y + ps[1].y) / 2 - r.top];
      const dist = (ps) => Math.max(1, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y));
      const [mx, my] = mid(prev);
      const [nx, ny] = mid(now);
      const s = flowClamp(st.s * (dist(now) / dist(prev)), FLOW_ZOOM_MIN, FLOW_ZOOM_MAX);
      st.x0 += mx / st.s - nx / s;
      st.y0 += my / st.s - ny / s;
      st.s = s;
    } else {
      st.x0 -= (e.clientX - old.x) / st.s;
      st.y0 -= (e.clientY - old.y) / st.s;
    }
    st.auto = false;
    flowApply(fig);
  };
  const tup = (e) => {
    touches.delete(e.pointerId);
    if (!touches.size) gesture = null;
  };
  root.addEventListener("pointermove", tmove);
  root.addEventListener("pointerup", tup);
  root.addEventListener("pointercancel", tup);
  // 연결 막대 자리: 칸 크기가 바뀌거나(탭 · 보기를 바꿔 숨음 · 보임) 창 크기 · 스크롤이 바뀌면 다시 잡는다
  const place = () => flowConn && requestAnimationFrame(flowConnPlace);
  if (typeof ResizeObserver === "function") new ResizeObserver(place).observe(root);
  if (!flowWire.placeOn && typeof addEventListener === "function") {
    flowWire.placeOn = true;
    addEventListener("resize", place);
    document.addEventListener("scroll", place, { capture: true, passive: true });
  }
  // 다시 읽은 화면 · 새 칸도 연결 중이면 막대 · 표시를 단다
  flowConnPaint();
}

/** HTML 내려받기 사본(clone)의 diagram 을 그린 그대로(단추 · 확대 칸 없이, 처음 그림 · 원래 크기)로. live: 지금 화면(다른 그림을 보던 칸은 처음 그림으로) */
function flowStatic(clone, live) {
  const lf = live ? [...live.querySelectorAll("figure.fl")] : [];
  [...clone.querySelectorAll("figure.fl")].forEach((f, i) => {
    const o = lf[i]?._orig;
    if (o) {
      f.className = o.cls;
      f.innerHTML = o.html;
    }
    f.classList.remove("wired");
    f.querySelectorAll(":scope > .fl-tools, :scope > .fl-nav, :scope > .fl-capsp, .fl-ov, .fl-grip").forEach((x) => x.remove());
    const sc = f.querySelector(".fl-scroll");
    if (sc) {
      sc.classList.remove("zoom", "panning");
      sc.removeAttribute("style");
    }
    const svg = f.querySelector(".fl-svg");
    if (svg?.dataset.w) {
      svg.setAttribute("viewBox", `0 0 ${svg.dataset.w} ${svg.dataset.h}`);
      svg.removeAttribute("style");
    }
    f.querySelectorAll(".fl-flash, .fl-conn-from").forEach((x) => x.classList.remove("fl-flash", "fl-conn-from"));
  });
  clone.classList?.remove("fl-connecting");
}
