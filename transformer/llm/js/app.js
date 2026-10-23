(function () {
  const KEY = "llm-chapter-v1";
  const state = Object.assign(
    { mode: "core", research: false, chapter: false, marks: {}, papers: {}, videos: {} },
    JSON.parse(localStorage.getItem(KEY) || "{}")
  );
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  const CORPUS = ["снимок", "снимок", "снимок", "снимок", "смотрит", "смотрит", "врач", "врач", "врач"];
  const UNSEEN = ["снимка", "врача"];
  let merges = [];

  function charsOf(word) {
    return word.split("").concat(["_"]);
  }
  function applyMerges(pieces, list) {
    let out = pieces.slice();
    list.forEach(function (pair) {
      const next = [];
      for (let i = 0; i < out.length; i++) {
        if (i < out.length - 1 && out[i] === pair.a && out[i + 1] === pair.b) {
          next.push(pair.a + pair.b);
          i++;
        } else next.push(out[i]);
      }
      out = next;
    });
    return out;
  }
  function bestPair(rows) {
    const counts = new Map();
    rows.forEach(function (pieces) {
      for (let i = 0; i < pieces.length - 1; i++) {
        const key = pieces[i] + "\0" + pieces[i + 1];
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    let best = null;
    let n = 1;
    counts.forEach(function (v, k) {
      if (v > n) {
        n = v;
        best = k;
      }
    });
    if (!best) return null;
    const parts = best.split("\0");
    return { a: parts[0], b: parts[1], n: n };
  }
  function pieceHtml(pieces) {
    return (
      '<span class="pieces">' +
      pieces
        .map(function (p) {
          return '<span class="piece">' + p.replace(/_/g, "·") + "</span>";
        })
        .join("") +
      "</span>"
    );
  }
  function drawBpe() {
    const rows = CORPUS.map(function (w) {
      return applyMerges(charsOf(w), merges);
    });
    const pair = bestPair(rows);
    document.getElementById("bpe-corpus").innerHTML = rows
      .map(function (pieces, i) {
        return '<div class="token-line"><span class="eyebrow" style="margin:0;min-width:72px">' + CORPUS[i] + "</span>" + pieceHtml(pieces) + "</div>";
      })
      .join("");
    document.getElementById("bpe-pair").textContent = pair
      ? "Самая частая пара: «" + pair.a + "» + «" + pair.b + "», встреч " + pair.n + ". Слияний уже " + merges.length + "."
      : "Дальше сливать нечего. Слияний: " + merges.length + ".";
    document.getElementById("bpe-step").disabled = !pair;
    document.getElementById("bpe-unseen").innerHTML = UNSEEN.map(function (w) {
      return '<div class="token-line"><span class="eyebrow" style="margin:0;min-width:72px">' + w + "</span>" + pieceHtml(applyMerges(charsOf(w), merges)) + "</div>";
    }).join("");
    drawCustom();
  }
  function drawCustom() {
    const raw = document.getElementById("bpe-input").value.trim();
    const words = raw ? raw.split(/\s+/) : [];
    document.getElementById("bpe-custom").innerHTML = words
      .map(function (w) {
        return '<div class="token-line"><span class="eyebrow" style="margin:0;min-width:72px">' + w + "</span>" + pieceHtml(applyMerges(charsOf(w), merges)) + "</div>";
      })
      .join("");
  }
  document.getElementById("bpe-step").onclick = function () {
    const rows = CORPUS.map(function (w) {
      return applyMerges(charsOf(w), merges);
    });
    const pair = bestPair(rows);
    if (!pair) return;
    merges.push(pair);
    drawBpe();
  };
  document.getElementById("bpe-reset").onclick = function () {
    merges = [];
    drawBpe();
  };
  document.getElementById("bpe-input").addEventListener("input", drawCustom);
  drawBpe();

  const VOCAB = ["пациент", "ждёт", "снимок", "врач", "смотрит", "карту", "готов", "и", "."];
  const SCORES = {
    "": { пациент: 2.4, врач: 2.1 },
    пациент: { ждёт: 2.6, смотрит: 1.2 },
    врач: { смотрит: 2.4, ждёт: 0.8, готов: 1.3 },
    ждёт: { снимок: 2.5, врач: 1.5, карту: 1.2 },
    смотрит: { снимок: 2.3, карту: 1.8 },
    снимок: { ".": 2.0, и: 1.2, готов: 0.9 },
    карту: { ".": 2.1, и: 1.0 },
    готов: { ".": 2.3, и: 0.6 },
    и: { врач: 1.6, пациент: 1.4, ждёт: 0.8 },
    ".": { пациент: 1.2, врач: 1.1 },
  };
  let spoken = [];
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function logitsFor(prev, temperature, topk, topp) {
    const table = SCORES[prev] || {};
    let scores = VOCAB.map(function (w) {
      return table[w] !== undefined ? table[w] : -4;
    });
    scores = scores.map(function (s) {
      return s / temperature;
    });
    const order = scores
      .map(function (s, i) {
        return { s: s, i: i };
      })
      .sort(function (a, b) {
        return b.s - a.s;
      });
    const keep = {};
    order.forEach(function (item, rank) {
      if (rank < topk) keep[item.i] = true;
    });
    scores = scores.map(function (s, i) {
      return keep[i] ? s : -1e9;
    });
    const probs = softmax(scores);
    const ranked = probs
      .map(function (p, i) {
        return { p: p, i: i };
      })
      .sort(function (a, b) {
        return b.p - a.p;
      });
    let mass = 0;
    const nucleus = {};
    for (let k = 0; k < ranked.length; k++) {
      if (ranked[k].p <= 0) break;
      nucleus[ranked[k].i] = true;
      mass += ranked[k].p;
      if (mass >= topp) break;
    }
    const cut = probs.map(function (p, i) {
      return nucleus[i] ? p : 0;
    });
    const z = cut.reduce(function (a, b) {
      return a + b;
    }, 0);
    return z ? cut.map(function (p) {
      return p / z;
    }) : probs;
  }
  function softmax(xs) {
    const m = Math.max.apply(null, xs);
    const ex = xs.map(function (x) {
      return Math.exp(x - m);
    });
    const z = ex.reduce(function (a, b) {
      return a + b;
    }, 0);
    return ex.map(function (v) {
      return v / z;
    });
  }
  function settings() {
    return {
      temperature: Number(document.getElementById("temp").value),
      topk: Number(document.getElementById("topk").value),
      topp: Number(document.getElementById("topp").value),
    };
  }
  function paintDials() {
    const s = settings();
    document.getElementById("temp-label").textContent = s.temperature.toFixed(2);
    document.getElementById("topk-label").textContent = String(s.topk);
    document.getElementById("topp-label").textContent = s.topp.toFixed(2);
  }
  function drawDecode() {
    paintDials();
    const s = settings();
    const prev = spoken.length ? spoken[spoken.length - 1] : "";
    const probs = logitsFor(prev, s.temperature, s.topk, s.topp);
    document.getElementById("decode-sentence").textContent = spoken.length ? spoken.join(" ") : "Пусто. Первое слово выбирается из начала.";
    document.getElementById("decode-bars").innerHTML = probs
      .map(function (p, i) {
        const pct = Math.round(p * 100);
        return '<div class="attn-row"><span>' + VOCAB[i] + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><span>' + pct + "%</span></div>";
      })
      .join("");
  }
  function sampleOne(probs, rng) {
    let r = rng();
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i];
      if (r <= 0) return i;
    }
    return probs.length - 1;
  }
  document.getElementById("temp").oninput = drawDecode;
  document.getElementById("topk").oninput = drawDecode;
  document.getElementById("topp").oninput = drawDecode;
  document.getElementById("decode-add").onclick = function () {
    const s = settings();
    const prev = spoken.length ? spoken[spoken.length - 1] : "";
    const probs = logitsFor(prev, s.temperature, s.topk, s.topp);
    spoken.push(VOCAB[sampleOne(probs, Math.random)]);
    if (spoken.length > 12) spoken = spoken.slice(-12);
    drawDecode();
  };
  document.getElementById("decode-reset").onclick = function () {
    spoken = [];
    drawDecode();
  };
  function rollout(s, seed) {
    const rng = mulberry32(seed);
    const words = [];
    let prev = "";
    for (let i = 0; i < 8; i++) {
      const probs = logitsFor(prev, s.temperature, s.topk, s.topp);
      const w = VOCAB[sampleOne(probs, rng)];
      words.push(w);
      prev = w;
      if (w === "." && i > 1) break;
    }
    return words.join(" ");
  }
  document.getElementById("decode-compare").onclick = function () {
    const s = settings();
    const seed = 11;
    const greedy = rollout({ temperature: 0.2, topk: 1, topp: 1 }, seed);
    const now = rollout(s, seed);
    document.getElementById("decode-compare-out").innerHTML =
      "<div><p class=\"eyebrow\">Жадно, top-k = 1</p><p>" + greedy + "</p></div><div><p class=\"eyebrow\">Текущие ручки, то же зерно</p><p>" + now + "</p></div>";
  };
  drawDecode();

  const ALPHA = 0.076;
  const NC = 8.8e13;
  function lossOf(n) {
    return Math.pow(NC / n, ALPHA);
  }
  function formatN(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + " трлн";
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + " млрд";
    return Math.round(n / 1e6) + " млн";
  }
  const MARKS = [
    { n: 1.17e8, name: "GPT-1" },
    { n: 1.5e9, name: "GPT-2" },
    { n: 7e10, name: "Chinchilla" },
    { n: 1.75e11, name: "GPT-3" },
  ];
  function drawScale() {
    const logn = Number(document.getElementById("scale-n").value);
    const n = Math.pow(10, logn);
    const loss = lossOf(n);
    document.getElementById("scale-label").textContent = formatN(n);
    document.getElementById("scale-loss").textContent =
      "L(N) = " + loss.toFixed(3) + " нат на токен. Удвоение отсюда даёт " + (loss * Math.pow(2, -ALPHA)).toFixed(3) + ".";
    const x0 = 8;
    const x1 = 12;
    const y0 = lossOf(1e8);
    const y1 = lossOf(1e12);
    function X(log) {
      return 48 + ((log - x0) / (x1 - x0)) * 560;
    }
    function Y(L) {
      return 28 + ((y0 - L) / (y0 - y1)) * 170;
    }
    let d = "";
    for (let i = 0; i <= 80; i++) {
      const log = x0 + ((x1 - x0) * i) / 80;
      const x = X(log);
      const y = Y(lossOf(Math.pow(10, log)));
      d += (i ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
    }
    const dots = MARKS.map(function (m) {
      const x = X(Math.log10(m.n));
      const y = Y(lossOf(m.n));
      return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="#b42318"/><text x="' + (x + 6).toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" font-size="12" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#5e6872">' + m.name + "</text>";
    }).join("");
    const cx = X(logn);
    const cy = Y(loss);
    document.getElementById("scale-chart").innerHTML =
      '<line x1="48" y1="200" x2="610" y2="200" stroke="#d9d3c7"/>' +
      '<line x1="48" y1="20" x2="48" y2="200" stroke="#d9d3c7"/>' +
      '<text x="52" y="16" font-size="12" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#5e6872">потеря</text>' +
      '<text x="520" y="218" font-size="12" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#5e6872">параметры, логарифм</text>' +
      '<path d="' + d + '" fill="none" stroke="#1c1915" stroke-width="2"/>' +
      dots +
      '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="6" fill="#1c1915"/>';
  }
  document.getElementById("scale-n").oninput = drawScale;
  drawScale();

  function emergeP(logn) {
    const x = (logn - 10) * 1.6;
    return 1 / (1 + Math.exp(-x));
  }
  function drawEmerge() {
    const logn = Number(document.getElementById("emerge-n").value);
    const n = Math.pow(10, logn);
    const p = emergeP(logn);
    const exact = p >= 0.8 ? 1 : 0;
    document.getElementById("emerge-label").textContent = formatN(n);
    document.getElementById("emerge-bars").innerHTML =
      '<div class="attn-row"><span>гладкая доля</span><div class="track"><div class="fill" style="width:' + Math.round(p * 100) + '%"></div></div><span>' + Math.round(p * 100) + '%</span></div>' +
      '<div class="attn-row"><span>точное совпадение</span><div class="track"><div class="fill" style="width:' + exact * 100 + '%"></div></div><span>' + exact + "</span></div>";
    document.getElementById("emerge-note").textContent = exact
      ? "Порог 0,8 уже пройден, метрика стала единицей."
      : "Доля уже " + Math.round(p * 100) + "%, а точное совпадение всё ещё 0. Порог стоит на 0,8.";
  }
  document.getElementById("emerge-n").oninput = drawEmerge;
  drawEmerge();

  const prompts = {
    straight: "кашель → ждёт приёма\nснимок готов → можно звать\nболь в груди → ждёт приёма",
    swapped: "кашель → можно звать\nснимок готов → ждёт приёма\nболь в груди → ждёт приёма",
  };
  let swapped = false;
  function drawPrompt() {
    document.getElementById("prompt-text").textContent = swapped ? prompts.swapped : prompts.straight;
    document.getElementById("prompt-swap").setAttribute("aria-pressed", swapped ? "true" : "false");
    document.getElementById("prompt-note").textContent = swapped
      ? "Ответы в примерах перепутаны, форма строк та же. Продолжение третьей строки оставлено прежним нарочно: формат не сказал, какой ответ верный."
      : "Примеры показывают формат: слева ситуация, справа что сделать дальше. Продолжение третьей строки дописано как иллюстрация формата, это не выход модели.";
  }
  document.getElementById("prompt-swap").onclick = function () {
    swapped = !swapped;
    drawPrompt();
  };
  drawPrompt();

  const rlhf = [
    { title: "01 · Показанные ответы", body: "Человек пишет, как следует отвечать на просьбы. Модель дообучают на этих парах. Веса меняются. Отдельная копия остаётся точкой отсчёта." },
    { title: "02 · Сравнения", body: "На одну просьбу собирают несколько ответов. Люди их упорядочивают. Отдельная модель награды учится предсказывать эти сравнения." },
    { title: "03 · Сдвиг к лучшему", body: "Политика порождает ответы. PPO поднимает те, у которых награда выше, и штрафует уход от копии-ориентира. В чат попадает уже эта политика, не базовая модель." },
  ];
  let rl = 0;
  function drawRlhf() {
    document.getElementById("rlhf-title").textContent = rlhf[rl].title;
    document.getElementById("rlhf-body").textContent = rlhf[rl].body;
    document.getElementById("rlhf-steps").innerHTML = rlhf
      .map(function (_, i) {
        return '<button type="button" class="step-btn" data-i="' + i + '" aria-pressed="' + (i === rl) + '">' + (i + 1) + "</button>";
      })
      .join("");
    document.getElementById("rlhf-steps").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        rl = Number(b.dataset.i);
        drawRlhf();
      };
    });
  }
  document.getElementById("rlhf-prev").onclick = function () {
    rl = Math.max(0, rl - 1);
    drawRlhf();
  };
  document.getElementById("rlhf-next").onclick = function () {
    rl = Math.min(rlhf.length - 1, rl + 1);
    drawRlhf();
  };
  drawRlhf();

  const quiz = [
    ["Откуда берётся ответ при предобучении?", "Из самого текста: следующий токен уже написан справа."],
    ["Что делает одно слияние BPE?", "Два соседних куска, которые чаще всего стоят рядом, становятся одним символом."],
    ["Меняет ли температура веса?", "Нет. Она делит оценки перед softmax и меняет только выбор."],
    ["Чем помощник отличается от базовой модели?", "Его дообучили на инструкциях и на человеческих сравнениях ответов."],
  ];
  document.getElementById("quiz").innerHTML = quiz
    .map(function (q, i) {
      return '<div class="quiz"><p>' + q[0] + '</p><button type="button" class="ghost">Показать ответ</button><p class="answer">' + q[1] + "</p></div>";
    })
    .join("");
  document.getElementById("quiz").querySelectorAll("button").forEach(function (b) {
    b.onclick = function () {
      b.parentElement.classList.toggle("open");
    };
  });

  const STATUS = ["Не начато", "Учу", "Понял", "Вернуться"];
  const concepts = [
    ["pretrain", "Предобучение и дообучение", "Сначала общий текст, потом короткая настройка на задаче."],
    ["bpe", "BPE", "Словарь частей слов растёт слиянием частых пар."],
    ["ntp", "Следующий токен", "Потеря текста — произведение условных шагов."],
    ["icl", "Обучение в контексте", "Задача задана примерами в подсказке, веса не трогают."],
    ["scale", "Степенной закон", "Потеря падает предсказуемо с ростом N, данных и вычислений."],
    ["nucleus", "Ядро", "Оставляют наименьший набор токенов с суммарной вероятностью p."],
    ["rlhf", "Три шага к помощнику", "Примеры, модель награды по сравнениям, затем PPO."],
  ];
  function markLevel(id) {
    const v = state.marks[id];
    if (v === true) return 2;
    return typeof v === "number" ? ((v % 4) + 4) % 4 : 0;
  }
  function drawConcepts() {
    document.getElementById("concept-list").innerHTML = concepts
      .map(function (c) {
        const level = markLevel(c[0]);
        return '<div class="item"><div><b>' + c[1] + "</b><p>" + c[2] + '</p></div><button type="button" class="ghost mark" data-mark="' + c[0] + '" data-level="' + level + '">' + STATUS[level] + "</button></div>";
      })
      .join("");
    document.getElementById("concept-list").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        state.marks[b.dataset.mark] = (markLevel(b.dataset.mark) + 1) % 4;
        save();
        drawConcepts();
      };
    });
  }
  drawConcepts();

  const papers = [
    ["gpt", "Improving Language Understanding by Generative Pre-Training", "Radford et al., 2018", "https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf"],
    ["gpt2", "Language Models are Unsupervised Multitask Learners", "Radford et al., 2019", "https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf"],
    ["gpt3", "Language Models are Few-Shot Learners", "Brown et al., 2020", "https://arxiv.org/abs/2005.14165"],
    ["kaplan", "Scaling Laws for Neural Language Models", "Kaplan et al., 2020", "https://arxiv.org/abs/2001.08361"],
    ["chinchilla", "Training Compute-Optimal Large Language Models", "Hoffmann et al., 2022", "https://arxiv.org/abs/2203.15556"],
    ["instruct", "Training language models to follow instructions with human feedback", "Ouyang et al., 2022", "https://arxiv.org/abs/2203.02155"],
  ];
  function drawPapers() {
    document.getElementById("paper-list").innerHTML = papers
      .map(function (p) {
        const on = !!state.papers[p[0]];
        return '<div class="item"><div><a href="' + p[3] + '"><b>' + p[1] + '</b></a><p class="eyebrow">' + p[2] + '</p></div><button type="button" class="ghost" data-id="' + p[0] + '" aria-pressed="' + on + '">' + (on ? "Прочитано" : "Отметить") + "</button></div>";
      })
      .join("");
    document.getElementById("paper-list").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        state.papers[b.dataset.id] = !state.papers[b.dataset.id];
        save();
        drawPapers();
      };
    });
  }
  drawPapers();

  const videos = [
    ["tok", "Karpathy. Токенизатор GPT", "https://www.youtube.com/watch?v=zduSFxRajkE", "BPE от символов до словаря."],
    ["deep", "Karpathy. Разбор больших языковых моделей", "https://www.youtube.com/watch?v=7xTGNNLPyMI", "От предобучения до помощника."],
    ["gpt2", "Karpathy. Воспроизведение GPT-2", "https://www.youtube.com/watch?v=l8pRSuU81PU", "Тот же рецепт как обучаемый запуск."],
  ];
  function drawVideos() {
    document.getElementById("video-list").innerHTML = videos
      .map(function (v) {
        const on = !!state.videos[v[0]];
        return '<div class="item"><div><a href="' + v[2] + '"><b>' + v[1] + "</b></a><p>" + v[3] + '</p></div><button type="button" class="ghost" data-id="' + v[0] + '" aria-pressed="' + on + '">' + (on ? "Просмотрено" : "Отметить") + "</button></div>";
      })
      .join("");
    document.getElementById("video-list").querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        state.videos[b.dataset.id] = !state.videos[b.dataset.id];
        save();
        drawVideos();
      };
    });
  }
  drawVideos();

  function setMode(mode) {
    state.mode = mode;
    save();
    document.body.classList.toggle("full", mode === "full");
    document.body.classList.toggle("core", mode !== "full");
    document.getElementById("mode-core").setAttribute("aria-pressed", mode !== "full" ? "true" : "false");
    document.getElementById("mode-full").setAttribute("aria-pressed", mode === "full" ? "true" : "false");
  }
  document.getElementById("mode-core").onclick = function () {
    setMode("core");
  };
  document.getElementById("mode-full").onclick = function () {
    setMode("full");
  };
  document.getElementById("mode-research").onclick = function () {
    state.research = !state.research;
    save();
    document.body.classList.toggle("research", state.research);
    document.getElementById("mode-research").setAttribute("aria-pressed", state.research ? "true" : "false");
  };
  setMode(state.mode === "full" ? "full" : "core");
  document.body.classList.toggle("research", !!state.research);
  document.getElementById("mode-research").setAttribute("aria-pressed", state.research ? "true" : "false");

  const done = document.getElementById("done-chapter");
  function paintChapter() {
    done.setAttribute("aria-pressed", state.chapter ? "true" : "false");
    done.textContent = state.chapter ? "Глава отмечена" : "Глава прочитана";
  }
  done.onclick = function () {
    state.chapter = !state.chapter;
    save();
    paintChapter();
  };
  paintChapter();

  document.querySelectorAll("[data-copy]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      const url = location.origin + location.pathname + a.getAttribute("href");
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });

  const links = Array.from(document.querySelectorAll(".toc a"));
  const heads = links.map(function (a) {
    return document.querySelector(a.getAttribute("href"));
  }).filter(Boolean);
  const spy = new IntersectionObserver(
    function (entries) {
      const visible = entries.filter(function (e) {
        return e.isIntersecting;
      }).sort(function (a, b) {
        return b.intersectionRatio - a.intersectionRatio;
      })[0];
      if (!visible) return;
      links.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + visible.target.id);
      });
    },
    { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4] }
  );
  heads.forEach(function (h) {
    spy.observe(h);
  });
})();
