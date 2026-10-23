const KEY = "build-chapter-v1";

const PAGES = [
  { id: "расписание", role: "оригинал", text: "городская больница публикует расписание приёма терапевта на следующей неделе в холле первого этажа у стойки регистрации пациентов" },
  { id: "зеркало", role: "точная копия", text: "городская больница публикует расписание приёма терапевта на следующей неделе в холле первого этажа у стойки регистрации пациентов" },
  { id: "перепечатка", role: "другая концовка", text: "городская больница публикует расписание приёма терапевта на следующей неделе в холле первого этажа у стойки информации для посетителей" },
  { id: "аптека-ц", role: "шаблон", text: "аптека центральная шаблон каталога цена препарата наличие на складе заказать онлайн доставка по городу пункт выдачи у метро" },
  { id: "аптека-ю", role: "тот же шаблон", text: "аптека южная шаблон каталога цена препарата наличие на складе заказать онлайн доставка по городу пункт выдачи у метро" },
  { id: "забор", role: "оригинал процедуры", text: "процедура забора крови начинается с проверки направления затем медсестра обрабатывает кожу и ставит жгут выше локтя пациента" },
  { id: "пересказ", role: "переписано начало", text: "перед анализом человек садится в кресло у окна затем медсестра обрабатывает кожу и ставит жгут выше локтя пациента" },
  { id: "архив", role: "другой текст", text: "в архиве хранят бумажные карты старше десяти лет в отдельном помещении с ограниченным доступом сотрудников" },
];

const PAIRS = [
  ["расписание", "зеркало"],
  ["расписание", "перепечатка"],
  ["аптека-ц", "аптека-ю"],
  ["забор", "пересказ"],
  ["расписание", "аптека-ц"],
];

const BANDS = [2, 4, 5, 10];
const HASHES = 20;

const CONCEPTS = [
  ["Данные", "Конвейер вытаскивает текст и выбрасывает большую его часть. Остаются триллионы токенов."],
  ["MinHash", "Почти копии ищут по шинглам и коротким эскизам, чтобы повтор не запоминался."],
  ["Смесь", "Веса источников и число эпох выбирают. До четырёх эпох повтор почти как новый текст."],
  ["16 байт", "Вес, градиент, мастер-копия и два момента Adam. Это состояние, не одни веса."],
  ["Активации", "Матрица внимания растёт как квадрат длины. Шардирование её не делит."],
  ["Четыре разреза", "Копии данных, шард состояния, разрез матрицы, конвейер слоёв."],
  ["6ND", "Операции обучения примерно 6 × параметры × токены. Время — деление на реальную скорость карт."],
  ["Бюджет", "При фиксированных операциях параметры и токены растят вместе. Около 20 токенов на параметр."],
];

const FITS = {
  bes: { name: "Besiroglu et al., 2024", E: 1.8172, A: 482.01, B: 2085.43, a: 0.3478, b: 0.3658 },
  rnd: { name: "Hoffmann et al., 2022, как напечатано", E: 1.69, A: 406.4, B: 410.7, a: 0.34, b: 0.28 },
};

const BUDGET = 6 * 70e9 * 1.4e12;
const GPU_CHOICES = [1, 8, 64, 512];

const state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      full: !!saved.full,
      research: !!saved.research,
      done: !!saved.done,
      concepts: saved.concepts || {},
    };
  } catch {
    return { full: false, research: false, done: false, concepts: {} };
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function applyMode() {
  document.body.classList.toggle("full", state.full);
  document.body.classList.toggle("research", state.research);
  document.getElementById("mode-core").setAttribute("aria-pressed", String(!state.full));
  document.getElementById("mode-full").setAttribute("aria-pressed", String(state.full));
  document.getElementById("mode-research").setAttribute("aria-pressed", String(state.research));
  document.getElementById("done-chapter").setAttribute("aria-pressed", String(state.done));
}

document.getElementById("mode-core").onclick = () => { state.full = false; save(); applyMode(); };
document.getElementById("mode-full").onclick = () => { state.full = true; save(); applyMode(); };
document.getElementById("mode-research").onclick = () => { state.research = !state.research; save(); applyMode(); };
document.getElementById("done-chapter").onclick = () => { state.done = !state.done; save(); applyMode(); };

function hash32(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function shingles(text) {
  const words = text.toLowerCase().split(/\s+/);
  const out = [];
  for (let i = 0; i + 3 <= words.length; i++) out.push(words.slice(i, i + 3).join(" "));
  return out;
}

function signature(text) {
  const grams = shingles(text);
  const out = [];
  for (let i = 0; i < HASHES; i++) {
    let min = 0xffffffff;
    const seed = (0x9e3779b9 + i * 0x85ebca6b) >>> 0;
    for (const gram of grams) {
      const h = hash32(gram, seed);
      if (h < min) min = h;
    }
    out.push(min);
  }
  return out;
}

function jaccard(a, b) {
  const left = new Set(shingles(a));
  const right = new Set(shingles(b));
  let inter = 0;
  left.forEach((item) => { if (right.has(item)) inter += 1; });
  return inter / (left.size + right.size - inter);
}

const SIGS = Object.fromEntries(PAGES.map((page) => [page.id, signature(page.text)]));

function bandsMatch(left, right, rows) {
  const bands = HASHES / rows;
  for (let band = 0; band < bands; band++) {
    let same = true;
    for (let row = 0; row < rows; row++) {
      if (left[band * rows + row] !== right[band * rows + row]) same = false;
    }
    if (same) return true;
  }
  return false;
}

function renderDedup() {
  const rows = BANDS[Number(document.getElementById("band").value)];
  document.getElementById("band-label").textContent = String(rows);
  document.getElementById("docs").innerHTML = PAGES.map((page) =>
    `<p class="doc"><b>${page.id}</b> · ${page.role}<br>${page.text}</p>`
  ).join("");
  document.getElementById("pairs").innerHTML = PAIRS.map(([a, b]) => {
    const hit = bandsMatch(SIGS[a], SIGS[b], rows);
    const score = jaccard(PAGES.find((page) => page.id === a).text, PAGES.find((page) => page.id === b).text);
    return `<div class="pair ${hit ? "yes" : "no"}"><span>${a} · ${b}</span><em>${hit ? "полоса совпала" : "не пара"} · Жаккар ${score.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}</em></div>`;
  }).join("");
}

document.getElementById("band").oninput = renderDedup;

const SEQS = [512, 1024, 2048, 4096, 8192];

function renderMemory() {
  const seq = SEQS[Number(document.getElementById("seq").value) - 9];
  const batch = Number(document.getElementById("batch").value);
  const gpuCount = GPU_CHOICES[Number(document.getElementById("gpus").value)];
  const sharded = document.getElementById("zero").checked;
  const recompute = document.getElementById("recompute").checked;
  document.getElementById("seq-label").textContent = seq.toLocaleString("ru-RU");
  document.getElementById("batch-label").textContent = String(batch);
  document.getElementById("gpu-label").textContent = gpuCount.toLocaleString("ru-RU");

  const layers = 32;
  const width = 4096;
  const heads = 32;
  const params = 6.7e9;
  const quadratic = recompute ? 0 : 5 * heads * seq / width;
  const elements = seq * batch * width * (34 + quadratic);
  const activations = layers * elements * 2;
  const fullState = 16 * params;
  const state = sharded ? fullState / gpuCount : fullState;
  const perGpu = (state + activations) / 1e9;
  const fits = perGpu <= 80;
  const gb = (bytes) => (bytes / 1e9).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  document.getElementById("mem-out").innerHTML =
    `Состояние на карту ${gb(state)} ГБ. Активации ${gb(activations)} ГБ. Вместе <b class="${fits ? "ok" : "bad"}">${perGpu.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ГБ</b>. ${fits ? "Влезает в 80 ГБ." : "В 80 ГБ не влезает."}`;
}

["seq", "batch", "gpus", "zero", "recompute"].forEach((id) => {
  document.getElementById(id).oninput = renderMemory;
});

const PAR = {
  data: {
    title: "Копии модели",
    holds: ["Все 4 слоя и свой кусок пакета", "Все 4 слоя и свой кусок пакета", "Все 4 слоя и свой кусок пакета", "Все 4 слоя и свой кусок пакета"],
    note: "Раз за шаг карты усредняют градиенты, all-reduce. Копии остаются одинаковыми. Состояние целиком должно лежать на каждой карте.",
  },
  zero: {
    title: "Шард состояния",
    holds: ["Четверть весов, градиентов и моментов", "Четверть весов, градиентов и моментов", "Четверть весов, градиентов и моментов", "Четверть весов, градиентов и моментов"],
    note: "Перед слоем картам собирают нужный кусок весов и сразу после слоя снова раздают. Память состояния падает пропорционально числу карт. Активации это не делит.",
  },
  tensor: {
    title: "Разрез матрицы",
    holds: ["Кусок каждой матрицы всех 4 слоёв", "Кусок каждой матрицы всех 4 слоёв", "Кусок каждой матрицы всех 4 слоёв", "Кусок каждой матрицы всех 4 слоёв"],
    note: "Слой считают вместе, поэтому карты переговариваются на каждом слое. Так режут внутри одного сервера, где связь быстрая.",
  },
  pipe: {
    title: "Конвейер слоёв",
    holds: ["Слой 1", "Слой 2", "Слой 3", "Слой 4"],
    note: "Микробатчи идут по слоям как по конвейеру. Пока первый микробатч не дошёл до конца, часть карт ждёт. Этот простой называют пузырём.",
  },
};

let parMode = "data";

function renderPar() {
  const mode = PAR[parMode];
  document.getElementById("par-modes").innerHTML = Object.entries(PAR).map(([id, item]) =>
    `<button type="button" class="step-btn" data-par="${id}" aria-pressed="${id === parMode}">${item.title}</button>`
  ).join("");
  document.getElementById("par-gpus").innerHTML = mode.holds.map((text, index) =>
    `<div class="gpu"><b>Карта ${index + 1}</b><span>${text}</span></div>`
  ).join("");
  document.getElementById("par-note").textContent = mode.note;
  document.querySelectorAll("[data-par]").forEach((button) => {
    button.onclick = () => { parMode = button.dataset.par; renderPar(); };
  });
}

function num(value, digits = 1) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function renderFlops() {
  const billions = Number(document.getElementById("n-b").value);
  const trillions = Number(document.getElementById("d-t").value);
  const cards = Number(document.getElementById("cards").value);
  const rate = Number(document.getElementById("rate").value);
  document.getElementById("n-label").textContent = num(billions, 0);
  document.getElementById("d-label").textContent = num(trillions, 1);
  document.getElementById("cards-label").textContent = cards.toLocaleString("ru-RU");
  document.getElementById("rate-label").textContent = rate.toLocaleString("ru-RU");
  const ops = 6 * billions * 1e9 * trillions * 1e12;
  const seconds = ops / (cards * rate * 1e12);
  const days = seconds / 86400;
  const exp = ops.toExponential(2).replace(".", ",").replace("e+", " × 10^");
  document.getElementById("flop-out").innerHTML =
    `6ND = ${exp.replace(" × 10^", " × 10<sup>")}</sup> операций. На ${cards.toLocaleString("ru-RU")} картах это ${num(days, 0)} суток без остановок.`;
}

["n-b", "d-t", "cards", "rate"].forEach((id) => {
  document.getElementById(id).oninput = renderFlops;
});

let fitId = "bes";

function lossAt(fit, params) {
  const tokens = BUDGET / (6 * params);
  return fit.E + fit.A / params ** fit.a + fit.B / tokens ** fit.b;
}

function bestParams(fit) {
  let best = Infinity;
  let at = 10e9;
  for (let log = 10; log <= 11.6; log += 0.005) {
    const params = 10 ** log;
    const loss = lossAt(fit, params);
    if (loss < best) {
      best = loss;
      at = params;
    }
  }
  return at;
}

function renderBudget() {
  const fit = FITS[fitId];
  const params = 10 ** Number(document.getElementById("size").value);
  const tokens = BUDGET / (6 * params);
  const loss = lossAt(fit, params);
  const floor = bestParams(fit);
  document.getElementById("size-label").textContent = num(params / 1e9, 0);
  document.querySelectorAll("[data-fit]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.fit === fitId));
  });

  const svg = document.getElementById("loss-chart");
  const xs = [];
  const ys = [];
  for (let log = 10; log <= 11.6; log += 0.02) {
    xs.push(10 ** log);
    ys.push(lossAt(fit, 10 ** log));
  }
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const X0 = 48;
  const Y0 = 16;
  const W = 560;
  const H = 180;
  const xOf = (value) => X0 + ((Math.log10(value) - 10) / 1.6) * W;
  const yOf = (value) => Y0 + (1 - (value - minY) / (maxY - minY || 1)) * H;
  const line = xs.map((value, index) => `${index ? "L" : "M"}${xOf(value).toFixed(1)},${yOf(ys[index]).toFixed(1)}`).join(" ");
  const marks = [
    [70e9, "70 млрд"],
    [280e9, "280 млрд"],
  ];
  svg.innerHTML = `
    <line x1="${X0}" y1="${Y0 + H}" x2="${X0 + W}" y2="${Y0 + H}" stroke="#d9d3c7"/>
    <line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y0 + H}" stroke="#d9d3c7"/>
    <path d="${line}" fill="none" stroke="#1c1915" stroke-width="2"/>
    <line x1="${xOf(floor)}" y1="${Y0}" x2="${xOf(floor)}" y2="${Y0 + H}" stroke="#1d5c96" stroke-dasharray="3 3"/>
    <circle cx="${xOf(params)}" cy="${yOf(loss)}" r="5" fill="#b42318"/>
    ${marks.map(([value, label]) => `<text x="${xOf(value)}" y="${Y0 + H + 18}" text-anchor="middle" font-size="11" fill="#5e6872" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${label}</text>`).join("")}
    <text x="${X0}" y="12" font-size="11" fill="#5e6872" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">ошибка</text>
  `;
  const per = tokens / params;
  document.getElementById("loss-out").textContent =
    `${fit.name}. При ${num(params / 1e9, 0)} млрд параметров на этот бюджет приходится ${num(tokens / 1e12, 2)} трлн токенов, ${num(per, 1)} токена на параметр. Ошибка ${num(loss, 3)}. Дно кривой около ${num(floor / 1e9, 0)} млрд.`;
}

document.getElementById("size").oninput = renderBudget;
document.getElementById("fit-modes").onclick = (event) => {
  const button = event.target.closest("[data-fit]");
  if (!button) return;
  fitId = button.dataset.fit;
  renderBudget();
};

function lr(step) {
  const warmup = 8000;
  const total = 1_200_000;
  const peak = 8e-5;
  const end = 8e-7;
  if (step <= warmup) return peak * step / warmup;
  const progress = (step - warmup) / (total - warmup);
  return end + (peak - end) * 0.5 * (1 + Math.cos(Math.PI * progress));
}

function drawLr(id, maxStep) {
  const svg = document.getElementById(id);
  const points = [];
  const steps = 80;
  for (let i = 0; i <= steps; i++) points.push(lr(maxStep * i / steps));
  const peak = 8e-5;
  const X0 = 28;
  const Y0 = 12;
  const W = 320;
  const H = 120;
  const d = points.map((value, index) => {
    const x = X0 + (index / steps) * W;
    const y = Y0 + (1 - value / peak) * H;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const warmX = X0 + (8000 / maxStep) * W;
  svg.innerHTML = `
    <line x1="${X0}" y1="${Y0 + H}" x2="${X0 + W}" y2="${Y0 + H}" stroke="#d9d3c7"/>
    <path d="${d}" fill="none" stroke="#1c1915" stroke-width="2"/>
    <line x1="${warmX}" y1="${Y0}" x2="${warmX}" y2="${Y0 + H}" stroke="#b42318" stroke-dasharray="3 3"/>
  `;
}

function renderConcepts() {
  const labels = ["Не начато", "Учу", "Понял", "Вернуться"];
  document.getElementById("concept-list").innerHTML = CONCEPTS.map(([title, text], index) => {
    const level = Number(state.concepts[index] || 0);
    return `<div class="item"><div><b>${title}.</b> ${text}</div><button type="button" class="ghost mark" data-level="${level}" data-concept="${index}">${labels[level]}</button></div>`;
  }).join("");
  document.querySelectorAll("[data-concept]").forEach((button) => {
    button.onclick = () => {
      const index = button.dataset.concept;
      state.concepts[index] = (Number(state.concepts[index] || 0) + 1) % 4;
      save();
      renderConcepts();
    };
  });
}

document.querySelectorAll("[data-quiz]").forEach((button) => {
  button.onclick = () => button.closest(".quiz").classList.toggle("open");
});

const sections = [...document.querySelectorAll("main section")];
const links = [...document.querySelectorAll(".toc a")];
function markToc() {
  const y = window.scrollY + 120;
  let current = sections[0];
  sections.forEach((section) => { if (section.offsetTop <= y) current = section; });
  links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${current.id}`));
}
window.addEventListener("scroll", markToc, { passive: true });

applyMode();
renderDedup();
renderMemory();
renderPar();
renderFlops();
renderBudget();
drawLr("lr-full", 1_200_000);
drawLr("lr-zoom", 20_000);
renderConcepts();
markToc();
