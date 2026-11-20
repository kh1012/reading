// 전체 화면(index.html)과 작은 창(compact.html)이 같이 쓰는 시각 표시 · 상태 · 서버 호출.

// Apple 기기가 아니면(Windows 등) 한글을 Pretendard 웹폰트로 그린다. 글꼴 목록의 Apple SD Gothic Neo 가 없는 기기에서
// 한글이 굴림체로 떨어지지 않게 CDN CSS 를 붙인다. 동적 부분집합이라 화면에 든 글자의 조각만 받는다.
// CDN 을 못 받으면 목록의 다음 글꼴(맑은 고딕)로 그린다. Apple 기기는 Apple SD Gothic Neo 가 먼저라 받지 않는다.
const PRETENDARD_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
if (typeof navigator !== "undefined" && document.head && !/mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? "")) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PRETENDARD_CSS;
  link.crossOrigin = "anonymous";
  document.head.append(link);
}
const TZ = "Asia/Seoul";
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const REMOTE_POLL_MS = 15_000;

// 초기화 시각이 14:59:59.9 처럼 1초 모자라게 온다. 분으로 반올림해야 날짜가 어긋나지 않는다.
const toMin = (t) => Math.round(t / MIN) * MIN;
// 형식은 한 번만 만들어 쓴다. 부를 때마다 만들면 한 번에 0.1ms 쯤 걸려, 메모 목록 줄 수천 개의 시각을 그릴 때 0.5초가 된다
const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const HM_FMT = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const WEEKDAY_FMT = new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, weekday: "short" });
const dayKey = (t) => DAY_FMT.format(toMin(t));
const hm = (t) => HM_FMT.format(toMin(t));
const weekday = (t) => WEEKDAY_FMT.format(toMin(t));

/** 다가올 시각. 오늘 23:59 · 내일 14:00 · 10/29(목) 14:00 */
function when(t, now) {
  const d = dayKey(t);
  if (d === dayKey(now)) return `오늘 ${hm(t)}`;
  if (d === dayKey(now + DAY)) return `내일 ${hm(t)}`;
  const [, m, dd] = d.split("-").map(Number);
  return `${m}/${dd}(${weekday(t)}) ${hm(t)}`;
}

/** 작은 창용. 15:10 · 내일 00:00 · 수 06:00 (7일 창은 일주일 안이라 요일이면 충분하다) */
function whenShort(t, now) {
  const d = dayKey(t);
  if (d === dayKey(now)) return hm(t);
  if (d === dayKey(now + DAY)) return `내일 ${hm(t)}`;
  return `${weekday(t)} ${hm(t)}`;
}

/** 날짜 · 요일 · 시각. 11/14 토 06:00 (미니 카드의 7일 초기화) */
function mdhm(t) {
  const [, m, dd] = dayKey(t).split("-").map(Number);
  return `${m}/${dd} ${weekday(t)} ${hm(t)}`;
}

/** 지난 시각. 14:37 · 어제 14:37 · 10/24 14:37 */
function stamp(t, now) {
  const d = dayKey(t);
  if (d === dayKey(now)) return hm(t);
  if (d === dayKey(now - DAY)) return `어제 ${hm(t)}`;
  const [, m, dd] = d.split("-").map(Number);
  return `${m}/${dd} ${hm(t)}`;
}

/** 메모 목록 시각. 24시간 안은 14:37 · 어제 14:37, 넘으면 대강: 1일 전(~6일) · 1주일 전(~4주일) · 1달 전(30일 단위, ~12달) · 1년 전 */
function memoStamp(t, now) {
  const ms = now - t;
  if (ms < DAY) return stamp(t, now);
  const d = Math.floor(ms / DAY);
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주일 전`;
  if (d < 365) return `${Math.floor(d / 30)}달 전`;
  return `${Math.floor(d / 365)}년 전`;
}

/** 지난 시간에 따른 밝기 0 ~ 100(메모 목록 시각 · 저장됨 글자). 방금 100, 분 단위 로그 눈금으로 줄어 7일이면 0 */
function ageGlow(t, now) {
  const min = Math.max(0, now - t) / MIN;
  return Math.round(100 * Math.max(0, 1 - Math.log1p(min) / Math.log1p((7 * DAY) / MIN)));
}

/** 3일 4시간 뒤 · 2시간 59분 뒤 · 35분 뒤 */
function until(t, now) {
  const ms = Math.max(0, toMin(t) - now);
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / MIN);
  if (d) return h ? `${d}일 ${h}시간 뒤` : `${d}일 뒤`;
  if (h) return m ? `${h}시간 ${m}분 뒤` : `${h}시간 뒤`;
  return `${Math.max(m, 1)}분 뒤`;
}

/** 지난 시각을 짧게. 방금 · 5분 전 · 2시간 전 · 3일 전 */
function ago(t, now) {
  const ms = Math.max(0, now - t);
  if (ms < MIN) return "방금";
  if (ms < HOUR) return `${Math.floor(ms / MIN)}분 전`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}시간 전`;
  return `${Math.floor(ms / DAY)}일 전`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** 바로 가기 아이콘(simple-icons, CC0). jira · bitbucket 이 아니면 링크 모양. */
const SHORTCUT_ICONS = {
  jira: '<path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"/>',
  bitbucket:
    '<path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>',
  // simple-icons 10.4.0 microsoftteams(CC0)
  teams: '<path d="M20.625 8.127q-.55 0-1.025-.205-.475-.205-.832-.563-.358-.357-.563-.832Q18 6.053 18 5.502q0-.54.205-1.02t.563-.837q.357-.358.832-.563.474-.205 1.025-.205.54 0 1.02.205t.837.563q.358.357.563.837.205.48.205 1.02 0 .55-.205 1.025-.205.475-.563.832-.357.358-.837.563-.48.205-1.02.205zm0-3.75q-.469 0-.797.328-.328.328-.328.797 0 .469.328.797.328.328.797.328.469 0 .797-.328.328-.328.328-.797 0-.469-.328-.797-.328-.328-.797-.328zM24 10.002v5.578q0 .774-.293 1.46-.293.685-.803 1.194-.51.51-1.195.803-.686.293-1.459.293-.445 0-.908-.105-.463-.106-.85-.329-.293.95-.855 1.729-.563.78-1.319 1.336-.756.557-1.67.861-.914.305-1.898.305-1.148 0-2.162-.398-1.014-.399-1.805-1.102-.79-.703-1.312-1.664t-.674-2.086h-5.8q-.411 0-.704-.293T0 16.881V6.873q0-.41.293-.703t.703-.293h8.59q-.34-.715-.34-1.5 0-.727.275-1.365.276-.639.75-1.114.475-.474 1.114-.75.638-.275 1.365-.275t1.365.275q.639.276 1.114.75.474.475.75 1.114.275.638.275 1.365t-.275 1.365q-.276.639-.75 1.113-.475.475-1.114.75-.638.276-1.365.276-.188 0-.375-.024-.188-.023-.375-.058v1.078h10.875q.469 0 .797.328.328.328.328.797zM12.75 2.373q-.41 0-.78.158-.368.158-.638.434-.27.275-.428.639-.158.363-.158.773 0 .41.158.78.159.368.428.638.27.27.639.428.369.158.779.158.41 0 .773-.158.364-.159.64-.428.274-.27.433-.639.158-.369.158-.779 0-.41-.158-.773-.159-.364-.434-.64-.275-.275-.639-.433-.363-.158-.773-.158zM6.937 9.814h2.25V7.94H2.814v1.875h2.25v6h1.875zm10.313 7.313v-6.75H12v6.504q0 .41-.293.703t-.703.293H8.309q.152.809.556 1.5.405.691.985 1.19.58.497 1.318.779.738.281 1.582.281.926 0 1.746-.352.82-.351 1.436-.966.615-.616.966-1.43.352-.815.352-1.752zm5.25-1.547v-5.203h-3.75v6.855q.305.305.691.452.387.146.809.146.469 0 .879-.176.41-.175.715-.48.304-.305.48-.715t.176-.879Z"/>',
  link: '<path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"/>',
  // 폴더 바로 가기: 다운로드(트레이 + 화살표) · 저장소(브랜치) · 그 밖의 폴더
  download: '<path d="M11 3h2v9.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V3Z"/><path d="M4 15h2v4h12v-4h2v6H4v-6Z"/>',
  repo: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 7.2v9.6M18 9.2c0 5.3-12 2.8-12 7.6"/></g>',
  folder: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/>',
  // 터미널: 창 안에 >_ (구멍으로 뚫는다)
  terminal:
    '<path fill-rule="evenodd" d="M2 6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6Zm4.3 3.2 2.8 2.8-2.8 2.8 1.2 1.2 4-4-4-4-1.2 1.2ZM12.5 15v1.7h5.5V15h-5.5Z"/>',
};
function shortcutIcon(icon) {
  const kind = SHORTCUT_ICONS[icon] ? icon : "link";
  return `<svg class="ico ${kind}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SHORTCUT_ICONS[kind]}</svg>`;
}

/** 주소를 기본 브라우저로 연다. 앱 안이면 앱이 열고(웹 화면 안에서 이동하지 않게), 브라우저면 새 탭. http · https 만. */
function openLink(url) {
  if (!/^https?:\/\//i.test(String(url))) return;
  const app = window.webkit?.messageHandlers?.app;
  if (app) app.postMessage({ open: url });
  else window.open(url, "_blank", "noopener");
}

/** 잔여에 따른 색 단계(사용자 결정 2026-10-26). 50% 이상 초록, 25~49% 주황, 25% 미만 빨강. */
const toneOf = (left) => (left >= 50 ? "good" : left >= 25 ? "warn" : "crit");

/**
 * 초기화가 얼마나 가까운지(사용자 결정 2026-10-26). 창 길이의 약 10% 안이면 soon, 그 두 배 안이면 near.
 * 5시간 창은 30분 · 1시간, 7일 창은 24시간 · 48시간. 화면은 청록으로 칠하고 soon 이면 남은 시간으로 적는다.
 */
const RESET_STEPS = { session: [30 * MIN, HOUR], weekly: [24 * HOUR, 48 * HOUR] };
function resetTone(kind, resetsAt, now) {
  if (resetsAt == null) return "";
  const left = resetsAt - now;
  const [soon, near] = RESET_STEPS[kind];
  return left <= soon ? "soon" : left <= near ? "near" : "";
}

/**
 * 미니 카드 초기화 시각의 불투명도(사용자 결정 2026-11-17). 5시간 창은 시간 단위(5칸), 7일 창은 일 단위(7칸)로 끊어
 * 남은 시간이 가장 짧은 칸이 1, 가장 긴 칸이 0.3. 그 사이는 고르게 나눈다.
 */
const RESET_UNIT = { session: [HOUR, 5], weekly: [DAY, 7] };
function resetGlow(kind, resetsAt, now) {
  const [unit, n] = RESET_UNIT[kind];
  const step = Math.min(n, Math.max(1, Math.ceil((resetsAt - now) / unit)));
  return Math.round((1 - ((step - 1) / (n - 1)) * 0.7) * 100) / 100;
}

/** `lsappinfo info -only StatusLabel` 출력의 Dock 숫자. "label"="3" → 3, 숫자가 아닌 글자(•) → 1, kCFNULL · 빈 값 → 0 */
function parseDockBadge(text) {
  const m = /"label"="([^"]*)"/.exec(String(text ?? ""));
  if (!m || !m[1].trim()) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 1;
}

/** 계정 상태 설명. short 는 작은 창의 이름 옆 꼬리표, text 는 전체 문장. ok 는 둘 다 비운다. */
function statusOf(a, now) {
  const at = a.fetchedAt ? `${stamp(a.fetchedAt, now)} 값` : null;
  switch (a.status) {
    case "ok":
      return { short: "", text: "", bad: false };
    case "expired":
      return at
        ? { short: "만료", text: `토큰 만료 · ${at}`, bad: false }
        : { short: "만료", text: "토큰 만료 · 이 계정으로 claude를 한 번 켜면 읽힙니다", bad: false };
    case "no-login":
      return { short: "로그인 없음", text: "이 PC에 로그인이 없습니다", bad: true };
    case "error": {
      const why = a.error === "rate-limited" ? "요청 제한" : a.error === "network" ? "네트워크 오류" : a.error?.replace("http-", "HTTP ");
      return { short: "실패", text: `조회 실패(${why})${at ? ` · ${at}` : ""}`, bad: true };
    }
    default:
      return { short: "…", text: "아직 조회 전", bad: false };
  }
}

// MARK: 작은 창 계정 목록의 필터 · 순서. 둘 다 그 브라우저(앱 창)의 localStorage 에 둔다.

/** 저장한 필터 { day, emails } 가 오늘(서울 기준) 고른 것이면 보일 계정 email 목록, 아니면 null(필터 없음). */
function accountFilter(saved, now) {
  if (!saved || !Array.isArray(saved.emails) || saved.day !== dayKey(now)) return null;
  return saved.emails;
}

/**
 * 필터 체크 상자를 누른 뒤의 필터. email 이 null 이면 "전체": 필터가 없으면 모두 끄고([]), 있으면 필터를 없앤다(null).
 * 계정 하나를 누르면 그 계정만 끄고 켠다. 모두 켜지면 null.
 */
function nextFilter(cur, all, email) {
  if (email == null) return cur ? null : [];
  const on = new Set(cur ?? all);
  if (!on.delete(email)) on.add(email);
  return all.every((e) => on.has(e)) ? null : all.filter((e) => on.has(e));
}

/** 필터에 고른 계정만. 하한 아래인데 세션이 떠 있는 계정(창 전체가 깜박이는 원인)은 필터와 관계없이 보인다. */
function visibleAccounts(accounts, emails) {
  if (!emails) return accounts;
  const on = new Set(emails);
  return accounts.filter((a) => on.has(a.email) || a.alert === "active");
}

/** 저장한 순서(email 목록)대로. 순서에 없는 계정은 받은 순서(7일 초기화 순) 그대로 뒤에. */
function orderAccounts(accounts, order) {
  if (!order?.length) return accounts;
  const rank = new Map(order.map((e, i) => [e, i]));
  const at = (a, i) => rank.get(a.email) ?? order.length + i;
  return accounts
    .map((a, i) => [a, at(a, i)])
    .sort((x, y) => x[1] - y[1])
    .map(([a]) => a);
}

/**
 * 계정 정렬(작은 창 계정 목록 · 미니 카드가 같이 쓴다). key: session · weekly 는 잔여 %, reset 은 7일 초기화 시각, 없으면 받은 순서 그대로.
 * 값을 모르는 계정은 방향과 관계없이 맨 뒤, 같은 값이면 받은 순서를 지킨다(sort 는 안정 정렬)
 */
function sortAccounts(accounts, sort) {
  if (!sort?.key) return accounts;
  const sign = sort.dir === "asc" ? 1 : -1;
  const val = sort.key === "reset" ? (a) => a.weekly?.resetsAt : (a) => a[sort.key]?.left;
  return [...accounts].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null || y == null) return (x == null) - (y == null);
    return (x - y) * sign;
  });
}

/** 미니 카드 정렬 단추(2026-11-18 사용자): 다른 기준을 누르면 그 기준(리셋은 빠른 순, 잔여는 많은 순부터), 같은 기준을 누르면 오름 ↔ 내림 */
function nextMiniSort(sort, key) {
  if (sort?.key !== key) return { key, dir: key === "reset" ? "asc" : "desc" };
  return { key, dir: sort.dir === "asc" ? "desc" : "asc" };
}

/** 순서 목록에서 email 을 target 앞(after 면 뒤)으로 옮긴다. 나머지 계정의 앞뒤 관계는 그대로. */
function reorder(order, email, target, after) {
  if (email === target) return order;
  const rest = order.filter((e) => e !== email);
  const i = rest.indexOf(target);
  if (i < 0) return order;
  rest.splice(after ? i + 1 : i, 0, email);
  return rest;
}

/** 서버에 JSON 을 보낸다. 서버는 JSON 이 아닌 POST 를 거절한다(다른 사이트의 폼 요청을 막으려고). */
async function postJson(path, body = {}) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/**
 * 서버 상태를 읽고, 「지금 갱신」을 부르고, 갱신 단추 문구를 정한다. 화면마다 render 만 다르다.
 * 돌려주는 apply(data) 는 다른 POST 의 응답(같은 모양의 상태)을 화면에 바로 반영할 때 쓴다.
 */
function startPage({ render, button, renderButton, onError }) {
  let data = null;
  let busy = false;
  const paintButton = () => renderButton(button, { data, busy, wait: data ? data.cooldownUntil - Date.now() : 0 });
  const apply = (next) => {
    if (!next?.accounts) return;
    data = next;
    render(data, Date.now());
    paintButton();
  };

  async function load() {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      apply(await res.json());
    } catch {
      onError();
    }
  }

  button.addEventListener("click", async () => {
    busy = true;
    paintButton();
    try {
      apply((await postJson("/api/refresh")).data);
    } catch {
      onError();
    } finally {
      busy = false;
      paintButton();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load();
  });
  setInterval(load, MIN);
  // 휴대폰 · iPad(원격)는 Mac 앱처럼 상태를 밀어 주는 쪽이 없어 1분이면 세션 작업 시작 · 끝(계정 고양이)이 늦게 보인다. 보이는 동안 15초마다 더 읽는다
  setInterval(() => data?.remote && document.visibilityState === "visible" && load(), REMOTE_POLL_MS);
  setInterval(paintButton, 1000);
  load();
  return { apply, load };
}

// MARK: Web Push(휴대폰 홈 화면 웹 앱, iOS 16.4+). 새 읽을거리 · 질문 답 · 일정 30분 전 · 세션 상태를 받는다(아래 탭 막대 위 알림 받기 배너).
// Mac 앱(WKWebView)은 Mac 알림 · 배너를 쓰므로 쓰지 않는다. 구독은 기기마다 하나라 어느 화면에서 켜도 같다

/** 이 브라우저에서 구독할 수 있는가 */
const pushable = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !window.webkit?.messageHandlers?.app;

/**
 * 이 기기가 구독 중인가. 이 기기에 구독이 있어도 서버가 모르면(지웠거나 잃었으면) 이 기기 구독을 풀고 false(알림 받기 배너가 다시 뜬다).
 * 서버에 못 닿으면 이 기기 구독을 그대로 믿는다
 */
async function pushOn() {
  if (!pushable()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub || Notification.permission !== "granted") return false;
  const r = await postJson("/api/push/check", { endpoint: sub.endpoint }).catch(() => null);
  if (r?.ok && r.data?.known === false) {
    await sub.unsubscribe().catch(() => {});
    return false;
  }
  return true;
}

/**
 * 앱을 열면(보이면) 홈 화면 앱 아이콘 숫자 배지를 지우고, service worker(/sw.js)에 안 본 알림 목록을 비우라고 알린다.
 * 새 sw.js 가 있는지도 본다(iOS 는 홈 화면 앱을 완전히 닫았다 다시 띄우지 않으면 옛 service worker 로 돈다)
 */
async function badgeSeen() {
  if (!pushable()) return;
  navigator.clearAppBadge?.().catch(() => {});
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
  reg?.active?.postMessage({ type: "seen" });
  reg?.update?.().catch(() => {});
}

/**
 * 알림 받기 배너(휴대폰 아래 탭 막대 위, 어느 탭이든)를 보일까: 좁은 화면 · 구독할 수 있는 브라우저 · 아직 구독하지 않음 · ✕ 로 미룬 때(laterUntil)가 지남.
 * iOS 가 구독을 거두면(알림이 끊기면) 다시 보인다
 */
const pushAskShow = ({ narrow, pushable, on, laterUntil, now }) => Boolean(narrow && pushable && !on && now >= laterUntil);

/**
 * 휴대폰 키보드가 올라와 있나: 보이는 높이(visualViewport)가 창 높이보다 120px 넘게 작고, 글 칸에 포커스가 있을 때만.
 * 포커스가 없는데 높이가 줄어 있으면 키보드를 띄운 채 앱을 바꿨다가 돌아온 뒤 남은 옛 값이다(iOS 가 resize 를 주지 않는다)
 */
const vvKeyboard = ({ inner, vvH, editing }) => Boolean(editing && vvH != null && inner - vvH > 120);

/** 메모 목록 갱신 시각 필터(2026-11-15 사용자 "1시간 이내, 6시간 이내, 오늘, 어제, 지난 주"). 지난 주는 최근 7일 */
const MEMO_WHEN = [
  ["h1", "1시간"],
  ["h6", "6시간"],
  ["today", "오늘"],
  ["yday", "어제"],
  ["week", "지난 주"],
];
/** 필터 key 의 [시작, 끝) ms(이 기기 시각 기준 자정). 전체 · 모르는 key 면 null */
function memoWhenRange(key, now) {
  const mid = new Date(now);
  mid.setHours(0, 0, 0, 0);
  const today = mid.getTime();
  const yday = new Date(mid.getFullYear(), mid.getMonth(), mid.getDate() - 1).getTime();
  if (key === "h1") return [now - 3600_000, Infinity];
  if (key === "h6") return [now - 6 * 3600_000, Infinity];
  if (key === "today") return [today, Infinity];
  if (key === "yday") return [yday, today];
  if (key === "week") return [now - 7 * 86_400_000, Infinity];
  return null;
}

/**
 * 왼쪽 끝 스와이프(목록 화면으로)를 손을 뗀 때 끝낼까: 폭의 1/3 넘게 끌었거나, 오른쪽으로 빠르게(0.35px/ms 넘게) 20px 넘게 튕겼을 때.
 * 왼쪽으로 되돌리며 뗐으면(vx < 0) 그만둔다
 */
const edgeSwipeDone = ({ dx, vx, width }) => dx > 0 && vx >= -0.05 && (dx > width / 3 || (vx > 0.35 && dx > 20));

/** 지금 포커스가 글 칸(input · textarea · contenteditable)에 있나. 단추 · 체크 칸은 키보드를 띄우지 않는다 */
function editingNow() {
  const a = document.activeElement;
  if (!a || a === document.body) return false;
  if (a.isContentEditable || a.tagName === "TEXTAREA") return true;
  return a.tagName === "INPUT" && !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/.test(a.type);
}

/**
 * 구독한다: 알림 권한을 묻고(누른 순간에 물어야 iOS 가 받는다), service worker(/sw.js)를 등록해 서버의 공개 열쇠로 구독한 뒤 서버에 맡긴다.
 * 안 되면 throw
 */
async function pushSubscribe() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("알림을 허용하지 않았습니다(설정 › 알림에서 바꿉니다)");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const { key } = await fetch("/api/push/key", { cache: "no-store" }).then((x) => x.json());
  const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const r = await postJson("/api/push/subscribe", { subscription: sub.toJSON() });
  if (!r.ok) throw new Error(r.data?.error ?? "구독을 저장하지 못했습니다");
}

/**
 * 다시 그린 뒤 스크롤 자리 top 을 지킨다: 바로, 그리고 다음 그림 두 번까지 옮겨졌으면 되돌린다.
 * 미리보기에서 블록(할 일 · 그래프 · 결정)을 고쳐 다시 그릴 때 쓴다(WebKit 앱 창은 내용을 갈아 끼우거나 칸에 포커스를 되돌리면 스크롤을 위로 옮길 수 있다)
 */
/** el 을 실제로 스크롤하는 칸(스스로 넘치고 overflow 가 auto · scroll 인 가장 가까운 조상, 없으면 문서). 휴대폰은 칸이 아니라 바깥이 스크롤된다 */
function scrollerOf(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return document.scrollingElement ?? document.documentElement;
}

/**
 * el 안을 html 로 바꾸되 같은 꼴(태그 · 차례)인 노드는 그대로 두고 속성 · 글만 고친다(2026-11-16 사용자 "아이패드 · 모바일 스크롤이 바로 반응하지 않는다":
 * innerHTML 로 통째로 갈아 끼우면 WebKit 은 그 칸의 관성 스크롤을 멈추고 다시 배치한다). 입력칸이 없는 칸(진행판 흐름 탭)에 쓴다
 */
function morphInner(el, html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  morphKids(el, t.content);
}
function morphKids(a, b) {
  const an = [...a.childNodes];
  const bn = [...b.childNodes];
  bn.forEach((y, i) => {
    const x = an[i];
    if (!x) return void a.append(y);
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) return void x.replaceWith(y);
    if (x.nodeType !== 1) {
      if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
      return;
    }
    for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
    for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
    morphKids(x, y);
  });
  for (let i = an.length - 1; i >= bn.length; i--) an[i].remove();
}

function holdScroll(el, top) {
  if (!el) return;
  const put = () => {
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
  };
  put();
  requestAnimationFrame(() => {
    put();
    requestAnimationFrame(put);
  });
}

// MARK: 목록에서 찾기(메모 목록 머리 찾기 칸, 2026-11-20 사용자 "SNB 노출된 항목들 중 문자열 검색")

/** 찾을 글 → 낱말들(빈칸으로 나눔, 대소문자 무시) */
const memoListTerms = (q) => String(q ?? "").toLowerCase().split(/\s+/).filter(Boolean);

/** 글에 낱말이 모두 들었나(대소문자 무시) */
const memoListMatch = (text, terms) => {
  const t = String(text ?? "").toLowerCase();
  return terms.every((w) => t.includes(w));
};

/** 글을 HTML 로(esc), 낱말이 든 곳은 <mark class="memo-hit"> 로 감싼다. 겹치거나 붙은 자리는 하나로 */
function memoHitHtml(text, terms) {
  const s = String(text ?? "");
  const low = s.toLowerCase();
  const spans = [];
  for (const w of terms) {
    if (!w) continue;
    for (let i = low.indexOf(w); i >= 0; i = low.indexOf(w, i + 1)) spans.push([i, i + w.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b] of spans) {
    const last = merged.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  let out = "";
  let at = 0;
  for (const [a, b] of merged) {
    out += `${esc(s.slice(at, a))}<mark class="memo-hit">${esc(s.slice(a, b))}</mark>`;
    at = b;
  }
  return out + esc(s.slice(at));
}
