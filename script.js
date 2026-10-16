"use strict";

const $ = id => document.getElementById(id);
const STORE = "medicine-lab-fullscreen-v2";
const BASIC_IDS = ["water", "organic", "mineral"];

// 실제 성분명입니다. 아래 게임 조합은 실제 화학 반응과 무관합니다.
const DRUG_NAMES = [
  "아세트아미노펜", "이부프로펜", "아스피린", "나프록센",
  "덱시부프로펜", "케토프로펜", "디클로페낙", "멜록시캄",
  "셀레콕시브", "피록시캄", "인도메타신", "케토롤락",
  "로라타딘", "세티리진", "레보세티리진", "펙소페나딘",
  "데스로라타딘", "클로르페니라민", "디펜히드라민", "히드록시진",
  "덱스트로메토르판", "구아이페네신", "암브록솔", "브롬헥신",
  "아세틸시스테인", "카르보시스테인", "슈도에페드린", "옥시메타졸린",
  "파모티딘", "오메프라졸", "에스오메프라졸", "판토프라졸",
  "란소프라졸", "라베프라졸", "시메티딘", "수크랄페이트",
  "로페라미드", "비스무트차살리실산염", "락툴로오스", "비사코딜",
  "메트포르민", "아카보스", "글리메피리드", "시타글립틴",
  "리나글립틴", "다파글리플로진", "엠파글리플로진", "피오글리타존",
  "암로디핀", "로사르탄", "발사르탄", "텔미사르탄",
  "에날라프릴", "리시노프릴", "아테놀롤", "비스프로롤",
  "아토르바스타틴", "로수바스타틴", "심바스타틴", "에제티미브",
  "아목시실린", "암피실린", "세팔렉신", "세푸록심",
  "아지트로마이신", "클라리트로마이신", "독시사이클린", "메트로니다졸",
  "플루코나졸", "테르비나핀", "아시클로버", "발라시클로버",
  "히드로코르티손", "프레드니솔론", "덱사메타손", "트리암시놀론",
  "살부타몰", "몬테루카스트", "부데소니드", "플루티카손"
];

const ICONS = ["💊", "🧴", "⚕️", "🧪", "🔬", "⚗️"];

const ELEMENTS = {
  water:   { name: "물", emoji: "💧", basic: true },
  organic: { name: "유기물", emoji: "🌿", basic: true },
  mineral: { name: "무기물", emoji: "💎", basic: true }
};

const DRUG_IDS = DRUG_NAMES.map((name, index) => {
  const id = `drug${index}`;
  ELEMENTS[id] = { name, emoji: ICONS[index % ICONS.length], basic: false };
  return id;
});

const ALL_IDS = Object.keys(ELEMENTS);
const pairKey = (a, b) => [a, b].sort().join("|");

// 모든 재료 쌍의 결과를 시작할 때 데이터베이스로 생성합니다.
// 실행할 때마다 동일한 입력은 동일한 결과가 나옵니다.
function hash(text) {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

const RECIPES = new Map();

for (let i = 0; i < ALL_IDS.length; i++) {
  for (let j = i; j < ALL_IDS.length; j++) {
    const a = ALL_IDS[i];
    const b = ALL_IDS[j];
    const key = pairKey(a, b);

    // 결과가 입력과 같은 성분이 되는 경우는 제외합니다.
    const candidates = DRUG_IDS.filter(id => id !== a && id !== b);
    RECIPES.set(key, candidates[hash(key) % candidates.length]);
  }
}

// 모든 성분에 도달할 수 있도록 보장하는 탐험 경로.
// 이 역시 실제 제조법이 아닌 임의의 게임 규칙입니다.
RECIPES.set(pairKey("water", "organic"), DRUG_IDS[0]);
RECIPES.set(pairKey("water", "mineral"), DRUG_IDS[1]);
RECIPES.set(pairKey("organic", "mineral"), DRUG_IDS[2]);

for (let i = 0; i < DRUG_IDS.length - 1; i++) {
  RECIPES.set(
    pairKey(DRUG_IDS[i], BASIC_IDS[i % BASIC_IDS.length]),
    DRUG_IDS[i + 1]
  );
}

let found = new Set(BASIC_IDS);
let records = [];
let pieces = [];
let nextId = 1;
let activeTab = "discoveries";
let drag = null;
let saveTimer;
let toastTimer;
let storageOK = true;

function validId(id) {
  return typeof id === "string" && Object.hasOwn(ELEMENTS, id);
}

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;
    const data = JSON.parse(raw);

    if (Array.isArray(data.found)) {
      data.found.filter(validId).forEach(id => found.add(id));
    }

    if (Array.isArray(data.records)) {
      records = data.records.filter(record =>
        record &&
        validId(record.a) &&
        validId(record.b) &&
        validId(record.result) &&
        RECIPES.get(pairKey(record.a, record.b)) === record.result &&
        found.has(record.result)
      ).slice(0, 500);
    }

    if (Array.isArray(data.pieces)) {
      pieces = data.pieces
        .filter(piece =>
          piece && found.has(piece.element) &&
          Number.isFinite(piece.x) && Number.isFinite(piece.y)
        )
        .slice(0, 100)
        .map(piece => ({
          id: nextId++,
          element: piece.element,
          x: piece.x,
          y: piece.y
        }));
    }
  } catch {
    storageOK = false;
  }
}

function save() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORE, JSON.stringify({
      found: [...found],
      records,
      pieces
    }));
    storageOK = true;
  } catch {
    storageOK = false;
  }

  $("saveStatus").textContent = storageOK
    ? "✓ 自动保存".replace("自动保存", "자동 저장")
    : "저장 불가";
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 180);
}

function toast(text) {
  clearTimeout(toastTimer);
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3200);
}

function makeCard(id) {
  const card = document.createElement("div");
  card.className = "element";
  card.dataset.element = id;
  card.title = ELEMENTS[id].name;

  const icon = document.createElement("span");
  icon.className = "icon";
  icon.textContent = ELEMENTS[id].emoji;

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = ELEMENTS[id].name;

  card.append(icon, name);
  return card;
}

function renderInventory() {
  const query = $("search").value.trim();
  const container = $("inventory");
  container.replaceChildren();

  [...found].filter(id => ELEMENTS[id].name.includes(query)).forEach(id => {
    const card = makeCard(id);
    card.dataset.source = "inventory";
    container.append(card);
  });

  if (!container.childElementCount) {
    const message = document.createElement("p");
    message.className = "empty";
    message.textContent = "검색 결과가 없어.";
    container.append(message);
  }

  $("counter").textContent = `${found.size} / ${ALL_IDS.length}`;
}

// 툴바와 재료함이 차지하는 영역을 제외한 화면 전체가 작업 공간입니다.
function bounds() {
  return {
    left: 8,
    top: $("clearButton").getBoundingClientRect().bottom + 12,
    right: Math.max(8, innerWidth - 104),
    bottom: Math.max(
      80,
      $("inventory").closest(".shelf").getBoundingClientRect().top - 106
    )
  };
}

function clampPosition(x, y) {
  const b = bounds();
  return {
    x: Math.max(b.left, Math.min(x, b.right)),
    y: Math.max(b.top, Math.min(y, b.bottom))
  };
}

function renderWorkspace(highlightId = null) {
  $("workspace").replaceChildren();

  pieces.forEach(piece => {
    const position = clampPosition(piece.x, piece.y);
    piece.x = position.x;
    piece.y = position.y;

    const card = makeCard(piece.element);
    card.dataset.pieceId = piece.id;
    card.style.left = `${piece.x}px`;
    card.style.top = `${piece.y}px`;

    if (piece.id === highlightId) card.classList.add("new");
    $("workspace").append(card);
  });

  $("intro").classList.toggle("hidden", pieces.length > 0);
}

function addPiece(element, x, y) {
  if (pieces.length >= 100) {
    toast("작업대가 가득 찼어. 작업대 정리로 공간을 비워 줘.");
    return;
  }

  const piece = {
    id: nextId++,
    element,
    ...clampPosition(x, y)
  };

  pieces.push(piece);
  renderWorkspace();
  scheduleSave();
}

function combine(source, target, sourcePieceId) {
  const result = RECIPES.get(pairKey(source, target.element));
  if (!result) return;

  const isNew = !found.has(result);
  const resultPosition = { x: target.x, y: target.y };

  // 작업대 재료끼리 합치면 둘을 결과 하나로 바꿉니다.
  // 재료함에서 끌어온 경우에는 대상 재료만 교체합니다.
  pieces = pieces.filter(piece =>
    piece.id !== target.id && piece.id !== sourcePieceId
  );

  const resultPiece = {
    id: nextId++,
    element: result,
    ...clampPosition(resultPosition.x, resultPosition.y)
  };
  pieces.push(resultPiece);
  found.add(result);

  records.unshift({
    a: source,
    b: target.element,
    result,
    isNew,
    time: new Date().toISOString()
  });
  records = records.slice(0, 500);

  renderWorkspace(resultPiece.id);
  renderInventory();
  if ($("journal").open) renderJournal();
  save();

  toast(
    `${isNew ? "✨ 첫 발견!" : "↻ 다시 발견"} ` +
    `${ELEMENTS[source].name} + ${ELEMENTS[target.element].name}` +
    ` → ${ELEMENTS[result].name}` +
    (isNew && found.size === ALL_IDS.length ? " · 도감 완성! 🏆" : "")
  );
}

// Pointer Events로 마우스와 모바일 터치를 함께 지원합니다.
document.addEventListener("pointerdown", event => {
  if (drag || event.button !== 0 || $("journal").open) return;

  const card = event.target.closest(".element");
  if (!card || card.closest("#dragLayer")) return;

  const rect = card.getBoundingClientRect();
  const pieceId = card.dataset.pieceId
    ? Number(card.dataset.pieceId)
    : null;

  drag = {
    pointerId: event.pointerId,
    element: card.dataset.element,
    pieceId,
    card,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    moved: false,
    ghost: null,
    target: null
  };

  card.setPointerCapture(event.pointerId);
  event.preventDefault();
});

document.addEventListener("pointermove", event => {
  if (!drag || event.pointerId !== drag.pointerId) return;

  if (!drag.moved) {
    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY
    );
    if (distance < 5) return;

    drag.moved = true;
    drag.ghost = makeCard(drag.element);
    $("dragLayer").append(drag.ghost);
    if (drag.pieceId !== null) drag.card.classList.add("moving");
  }

  event.preventDefault();
  drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
  drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;

  document.querySelectorAll(".target").forEach(card =>
    card.classList.remove("target")
  );

  // 从指针位置检测目标；拖动层不拦截命中测试。
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const targetCard = hit?.closest("#workspace > .element");
  const targetId = targetCard ? Number(targetCard.dataset.pieceId) : null;

  drag.target = targetId !== drag.pieceId
    ? pieces.find(piece => piece.id === targetId) || null
    : null;

  if (drag.target) targetCard.classList.add("target");
}, { passive: false });

function finishDrag(event, cancelled = false) {
  if (!drag || (event && event.pointerId !== drag.pointerId)) return;

  const current = drag;
  drag = null;
  current.ghost?.remove();
  current.card.classList.remove("moving");

  document.querySelectorAll(".target").forEach(card =>
    card.classList.remove("target")
  );

  if (cancelled || !current.moved) return;

  const x = event.clientX;
  const y = event.clientY;
  const shelfTop = document.querySelector(".shelf").getBoundingClientRect().top;
  const toolbarBottom = $("clearButton").getBoundingClientRect().bottom;

  // 재료함이나 상단 버튼 영역 위에서 놓으면 이동을 취소합니다.
  if (y >= shelfTop || y <= toolbarBottom + 4) return;

  if (current.target) {
    combine(current.element, current.target, current.pieceId);
    return;
  }

  const position = clampPosition(
    x - current.offsetX,
    y - current.offsetY
  );

  if (current.pieceId !== null) {
    const piece = pieces.find(item => item.id === current.pieceId);
    if (piece) Object.assign(piece, position);
    renderWorkspace();
    scheduleSave();
  } else {
    addPiece(current.element, position.x, position.y);
  }
}

document.addEventListener("pointerup", event => finishDrag(event));
document.addEventListener("pointercancel", event => finishDrag(event, true));
window.addEventListener("blur", () => finishDrag(null, true));

function makeJournalRow(icon, title, subtitle, locked = false) {
  const row = document.createElement("div");
  row.className = `journal-row${locked ? " locked" : ""}`;

  const iconNode = document.createElement("span");
  iconNode.className = "row-icon";
  iconNode.textContent = icon;

  const text = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = subtitle;

  text.append(heading, detail);
  row.append(iconNode, text);
  return row;
}

function renderJournal() {
  const container = $("journalContent");
  container.replaceChildren();

  $("journalCount").textContent =
    `발견한 의약품 성분 ${found.size - BASIC_IDS.length} / ${DRUG_IDS.length}`;

  $("recipeCount").textContent =
    `조합 규칙 ${RECIPES.size.toLocaleString()}개`;

  $("discoveryTab").classList.toggle("active", activeTab === "discoveries");
  $("historyTab").classList.toggle("active", activeTab === "history");

  if (activeTab === "discoveries") {
    ALL_IDS.forEach(id => {
      if (!found.has(id)) {
        container.append(makeJournalRow("🔒", "미발견 성분", "조합해서 발견해 봐.", true));
        return;
      }

      // 가장 오래된 해당 성분의 첫 발견 기록
      const first = [...records].reverse().find(record =>
        record.result === id && record.isNew
      );

      const subtitle = ELEMENTS[id].basic
        ? "기본 원소"
        : first
          ? `${ELEMENTS[first.a].name} + ${ELEMENTS[first.b].name}`
          : "발견 완료";

      container.append(
        makeJournalRow(ELEMENTS[id].emoji, ELEMENTS[id].name, subtitle)
      );
    });
    return;
  }

  if (!records.length) {
    container.append(makeJournalRow("📖", "아직 조합 기록이 없어", "첫 번째 조합을 시도해 봐."));
  }

  records.forEach(record => {
    const date = new Date(record.time);
    const time = Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString("ko-KR");

    container.append(makeJournalRow(
      ELEMENTS[record.result].emoji,
      `${record.isNew ? "✨ " : ""}${ELEMENTS[record.result].name}`,
      `${ELEMENTS[record.a].name} + ${ELEMENTS[record.b].name} · ${time}`
    ));
  });
}

$("journalButton").addEventListener("click", () => {
  renderJournal();
  $("journal").showModal();
});

$("closeJournal").addEventListener("click", () => $("journal").close());

$("discoveryTab").addEventListener("click", () => {
  activeTab = "discoveries";
  renderJournal();
});

$("historyTab").addEventListener("click", () => {
  activeTab = "history";
  renderJournal();
});

$("search").addEventListener("input", renderInventory);

$("clearButton").addEventListener("click", () => {
  pieces = [];
  renderWorkspace();
  save();
  toast("작업대를 정리했어. 발견 기록은 그대로야.");
});

$("resetButton").addEventListener("click", () => {
  if (!confirm("발견한 성분과 조합 기록을 모두 지울까?")) return;

  found = new Set(BASIC_IDS);
  records = [];
  pieces = [];
  $("search").value = "";

  renderInventory();
  renderWorkspace();
  renderJournal();
  save();
  toast("새로운 실험실을 시작했어.");
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (drag) finishDrag(null, true);
    renderWorkspace();
    scheduleSave();
  }, 120);
});

window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});

load();
renderInventory();
renderWorkspace();
$("saveStatus").textContent = storageOK ? "✓ 자동 저장" : "저장 불가";