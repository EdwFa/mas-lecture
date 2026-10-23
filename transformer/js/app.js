(function () {
  const KEY = "transformer-chapter-v1";
  const state = Object.assign(
    {
      mode: "core",
      research: false,
      chapter: false,
      marks: {},
      lab: false,
      papers: {},
      videos: {},
      highlights: [],
      textSize: "m",
      opened: {},
    },
    JSON.parse(localStorage.getItem(KEY) || "{}")
  );
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  const words = TF.WORDS;

  function pct(x) {
    return Math.round(x * 1000) / 10;
  }

  function bars(query, projected, mount) {
    const { weights } = TF.attend(query, projected);
    const best = weights.indexOf(Math.max.apply(null, weights));
    mount.innerHTML = weights
      .map(
        (w, i) =>
          `<div class="attn-row"><span>${words[i]}</span><div class="track"><div class="fill" style="width:${pct(w)}%"></div></div><span>${pct(w).toFixed(0)}%</span></div>`
      )
      .join("");
    return best;
  }

  function wordButtons(mount, selected, onPick) {
    mount.innerHTML = words
      .map(
        (w, i) =>
          `<button type="button" class="word" data-i="${i}" aria-pressed="${i === selected}">${w}</button>`
      )
      .join("");
    mount.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => onPick(Number(btn.dataset.i)));
    });
  }

  let hero = words.indexOf("он");
  const heroWords = document.getElementById("hero-words");
  const heroBars = document.getElementById("hero-bars");
  const heroCaption = document.getElementById("hero-caption");
  function drawHero() {
    wordButtons(heroWords, hero, (i) => {
      hero = i;
      drawHero();
    });
    bars(hero, false, heroBars);
    requestAnimationFrame(drawHeroArcs);
    const weights = TF.attend(hero, false).weights;
    const order = weights.map((w, i) => ({ w: w, i: i })).sort((a, b) => b.w - a.w);
    const top = order[0];
    const next = order[1];
    heroCaption.textContent = next.w > top.w * 0.6
      ? "«" + words[hero] + "» смотрит сразу на «" + words[top.i] + "» (" + pct(top.w).toFixed(0) + "%) и «" + words[next.i] + "» (" + pct(next.w).toFixed(0) + "%). Выберите любое слово."
      : "«" + words[hero] + "» сильнее всего смотрит на «" + words[top.i] + "» (" + pct(top.w).toFixed(0) + "%). Выберите любое слово.";
  }
  function drawHeroArcs() {
    const stage = document.querySelector(".arc-stage");
    const svg = document.getElementById("hero-arcs");
    const buttons = Array.from(document.querySelectorAll("#hero-words .word"));
    if (!stage || !svg || !buttons.length) return;
    const root = stage.getBoundingClientRect();
    const pts = buttons.map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.left - root.left + r.width / 2, y: r.top - root.top };
    });
    const weights = TF.attend(hero, false).weights;
    const w = Math.max(stage.clientWidth, 1);
    const h = 120;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = weights
      .map((weight, i) => {
        if (i === hero) return "";
        const lift = 18 + 78 * weight;
        const x1 = pts[i].x;
        const x2 = pts[hero].x;
        const y = Math.min(pts[i].y, h - 4);
        return `<path d="M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - lift} ${x2} ${y}" fill="none" stroke="#1c1915" stroke-width="${(1.2 + 9 * weight).toFixed(2)}" stroke-opacity="${(0.2 + 0.8 * weight).toFixed(2)}" stroke-linecap="round"/>`;
      })
      .join("");
  }
  drawHero();
  window.addEventListener("resize", drawHeroArcs);

  const rnnSteps = [
    {
      title: "01 · Одно слово за раз",
      body: "Сеть читает слева направо. Каждое слово обновляет один скрытый вектор и отдаёт его следующему.",
      seen: 5,
    },
    {
      title: "02 · Единственная дорога",
      body: "«Он» может относиться и к врачу, и к снимку: оба слова мужского рода. Дорога всё равно одна — скрытое состояние.",
      seen: 4,
    },
    {
      title: "03 · Расстояние",
      body: "След «врача» и след «снимка» проходят через «принёс», прежде чем дойдут до «он». На каждом шаге след слабее. Это схема, не измерение.",
      seen: 4,
    },
    {
      title: "04 · Скорость",
      body: "Каждое обновление ждёт предыдущее. Четыре шага идут друг за другом, сколько бы ядер ни простаивало.",
      seen: 4,
    },
    {
      title: "05 · Один прямой шаг",
      body: "Самовнимание за один шаг видит и «врача», и «снимок». Вес «он» делится между ними. Все позиции считают вместе. Цена — сравнение всех пар, квадрат длины.",
      seen: 5,
    },
  ];
  let rnn = 0;
  const rnnTitle = document.getElementById("rnn-title");
  const rnnBody = document.getElementById("rnn-body");
  const rnnDots = document.getElementById("rnn-dots");
  function rnnPicture(step) {
    const n = words.length;
    const W = 720;
    const y = 112;
    const gap = (W - 100) / (n - 1);
    const x = (i) => 50 + i * gap;
    const parts = [
      '<defs><marker id="rnn-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#1c1915"/></marker></defs>',
    ];
    if (step < 4) {
      for (let i = 0; i < n - 1; i++) {
        const fade = step === 2 ? Math.max(0.18, 1 - i * 0.2) : 0.9;
        parts.push(`<line x1="${(x(i) + 48).toFixed(1)}" y1="${y}" x2="${(x(i + 1) - 50).toFixed(1)}" y2="${y}" stroke="#1c1915" stroke-width="${step === 3 ? 2.6 : 1.6}" stroke-opacity="${fade.toFixed(2)}" marker-end="url(#rnn-arr)"/>`);
        if (step !== 1) {
          parts.push(`<text x="${((x(i) + x(i + 1)) / 2).toFixed(1)}" y="${y - 18}" text-anchor="middle" fill="#5e6872" font-size="12" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${i + 1}</text>`);
        }
      }
    } else {
      const q = words.indexOf("он");
      TF.attend(q, false).weights.forEach((weight, i) => {
        if (i === q) return;
        const lift = 22 + 62 * weight;
        parts.push(`<path d="M ${x(i).toFixed(1)} ${y - 22} Q ${((x(i) + x(q)) / 2).toFixed(1)} ${(y - 22 - lift).toFixed(1)} ${x(q).toFixed(1)} ${y - 26}" fill="none" stroke="#1c1915" stroke-width="${(1 + 8 * weight).toFixed(2)}" stroke-opacity="${(0.25 + 0.75 * weight).toFixed(2)}" stroke-linecap="round"/>`);
      });
    }
    words.forEach((word, i) => {
      const query = word === "он" && step >= 1;
      const hot = (step === 1 || step === 4) && (word === "врач" || word === "снимок" || word === "он");
      const fade = step === 2 ? Math.max(0.4, 1 - i * 0.12) : 1;
      parts.push(`<g opacity="${fade.toFixed(2)}"><rect x="${(x(i) - 46).toFixed(1)}" y="${y - 16}" width="92" height="36" rx="8" fill="${query ? "#1c1915" : "#f7f4ee"}" stroke="${hot ? "#1c1915" : "#d9d3c7"}" stroke-width="${hot ? 2 : 1}"/><text x="${x(i).toFixed(1)}" y="${y + 8}" text-anchor="middle" font-size="16" font-family="Georgia, serif" fill="${query ? "#f7f4ee" : "#1c1915"}">${word}</text></g>`);
    });
    return `<svg class="diagram" viewBox="0 0 ${W} 168" role="img" aria-label="Схема шага ${step + 1}">${parts.join("")}</svg>`;
  }
  function drawRnn() {
    const step = rnnSteps[rnn];
    rnnTitle.textContent = step.title;
    rnnBody.textContent = step.body;
    document.getElementById("rnn-svg").innerHTML = rnnPicture(rnn);
    document.querySelectorAll("[data-rnn]").forEach((b) => {
      b.setAttribute("aria-pressed", Number(b.dataset.rnn) === rnn ? "true" : "false");
    });
    rnnDots.innerHTML = rnnSteps
      .map(
        (s, i) =>
          `<button type="button" class="step-btn" data-i="${i}" aria-pressed="${i === rnn}">${i + 1}</button>`
      )
      .join("");
    rnnDots.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        rnn = Number(b.dataset.i);
        drawRnn();
      });
    });
  }
  document.getElementById("rnn-prev").onclick = () => {
    rnn = Math.max(0, rnn - 1);
    drawRnn();
  };
  document.getElementById("rnn-next").onclick = () => {
    rnn = Math.min(rnnSteps.length - 1, rnn + 1);
    drawRnn();
  };
  drawRnn();
  document.querySelectorAll("[data-rnn]").forEach((b) => {
    b.addEventListener("click", () => {
      rnn = Number(b.dataset.rnn);
      drawRnn();
      document.getElementById("rnn-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  const labMeta = [
    { title: "1 · Сходство", lead: "Скалярные произведения выбранного слова со всеми. У «он» два больших сходства: с «врачом» и со «снимком»." },
    { title: "2 · Softmax", lead: "Оценки, умноженные на учебный масштаб " + TF.TEMP + ", становятся весами. Сумма равна 1." },
    { title: "3 · Взвешенная сумма", lead: "Новый вектор — сумма эмбеддингов, взятых с этими весами." },
    { title: "4 · Запросы и ключи", lead: "Эта проекция усиливает первую координату и сдвигает вес «он» к «врачу». Другая голова может оставить «снимок»." },
    { title: "5 · Все токены", lead: "Каждая строка — слово, которое спрашивает. Каждая колонка — слово, на которое смотрят. Нажмите строку." },
  ];
  let labStep = 0;
  let labWord = words.indexOf("он");
  const labSteps = document.getElementById("lab-steps");
  const labOut = document.getElementById("lab-out");
  const labWords = document.getElementById("lab-words");
  function drawLab() {
    document.getElementById("lab-title").textContent = labMeta[labStep].title;
    document.getElementById("lab-lead").textContent = labMeta[labStep].lead;
    labSteps.innerHTML = labMeta
      .map(
        (s, i) =>
          `<button type="button" class="step-btn" data-i="${i}" aria-pressed="${i === labStep}">${i + 1}</button>`
      )
      .join("");
    labSteps.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        labStep = Number(b.dataset.i);
        drawLab();
      });
    });
    wordButtons(labWords, labWord, (i) => {
      labWord = i;
      drawLab();
    });
    const plain = TF.attend(labWord, false);
    const proj = TF.attend(labWord, true);
    if (labStep === 0) {
      labOut.innerHTML =
        "<table><tr><th>слово</th><th>произведение</th></tr>" +
        words
          .map((w, i) => `<tr><td>${w}</td><td>${TF.fmt(plain.raw[i])}</td></tr>`)
          .join("") +
        "</table>";
    } else if (labStep === 1) {
      labOut.innerHTML =
        "<table><tr><th>слово</th><th>вес</th></tr>" +
        words
          .map((w, i) => `<tr><td>${w}</td><td>${pct(plain.weights[i]).toFixed(1)}%</td></tr>`)
          .join("") +
        "</table>";
    } else if (labStep === 2) {
      const mixed = TF.mix(plain.weights);
      labOut.innerHTML = "<p>Новый вектор «" + words[labWord] + "»: " + mixed.map(TF.fmt).join(", ") + "</p>";
    } else if (labStep === 3) {
      labOut.innerHTML =
        "<table><tr><th>слово</th><th>до проекции</th><th>после</th></tr>" +
        words
          .map(
            (w, i) =>
              `<tr><td>${w}</td><td>${pct(plain.weights[i]).toFixed(1)}%</td><td>${pct(proj.weights[i]).toFixed(1)}%</td></tr>`
          )
          .join("") +
        "</table>";
    } else {
      const M = TF.matrix(false);
      let html = "<table><tr><th></th>" + words.map((w) => `<th>${w}</th>`).join("") + "</tr>";
      M.forEach((row, i) => {
        html += `<tr><td><button type="button" class="ghost" data-q="${i}">${words[i]}</button></td>`;
        row.forEach((w) => {
          html += `<td>${pct(w).toFixed(0)}</td>`;
        });
        html += "</tr>";
      });
      html += "</table>";
      labOut.innerHTML = html;
      labOut.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", () => {
          labWord = Number(b.dataset.q);
          labStep = 1;
          drawLab();
        });
      });
    }
  }
  document.getElementById("lab-prev").onclick = () => {
    labStep = Math.max(0, labStep - 1);
    drawLab();
  };
  document.getElementById("lab-next").onclick = () => {
    labStep = Math.min(labMeta.length - 1, labStep + 1);
    drawLab();
  };
  const labDone = document.getElementById("lab-done");
  function paintLabDone() {
    labDone.setAttribute("aria-pressed", state.lab ? "true" : "false");
    labDone.textContent = state.lab ? "Шаги отмечены" : "Шаги пройдены";
  }
  labDone.onclick = () => {
    state.lab = !state.lab;
    save();
    paintLabDone();
  };
  paintLabDone();
  drawLab();

  document.querySelectorAll(".more-toggle").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.open;
      state.opened[id] = !state.opened[id];
      save();
      paintOpened();
    });
  });
  function paintOpened() {
    document.querySelectorAll(".more-toggle").forEach((b) => {
      const on = !!state.opened[b.dataset.open];
      document.getElementById(b.dataset.open).classList.toggle("opened", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
      b.textContent = on ? "Свернуть · обратно к короткому" : b.dataset.open === "qkv" ? "Ещё в полном · √dk и маска" : b.dataset.open === "heads" ? "Ещё в полном · сжатие ключей" : "Ещё в полном · куда ставили норму";
    });
  }
  paintOpened();

  const exSteps = [
    ["Токены", (e) => e.tokens.join("  "), "индексы в словаре, длина n = 3"],
    ["Эмбеддинги", (e) => TF.fmtMat(e.X0), "форма n × d, d = 4"],
    ["Плюс позиция", (e) => TF.fmtMat(e.X), "к каждому вектору прибавлен вектор места"],
    ["Оценки QKᵀ / √d", (e) => TF.fmtMat(e.logits), e => "матрица n × n" + (e.causal ? ", будущее закрыто" : "")],
    ["Веса softmax", (e) => TF.fmtMat(e.A), "в каждой строке сумма 1"],
    ["Выход внимания", (e) => TF.fmtMat(e.heads), "взвешенная сумма значений"],
    ["Остаток", (e) => TF.fmtMat(e.resid1), "вход блока плюс внимание"],
    ["Сеть токена", (e) => TF.fmtMat(e.ffn), "расширение, ReLU, сжатие обратно в d"],
    ["Второй остаток", (e) => TF.fmtMat(e.resid2), "та же форма, что на входе блока"],
    ["Вероятности слова", (e) => e.tokens.map((t, i) => t + ": " + e.vocab.map((v, j) => v + " " + pct(e.out[i][j]).toFixed(0) + "%").join(", ")).join("\n"), "softmax по словарю на каждой позиции"],
  ];
  let ex = 0;
  let causal = false;
  function drawEx() {
    const run = TF.explorer(causal);
    const step = exSteps[ex];
    document.getElementById("ex-title").textContent = step[0];
    const shape = step[2];
    document.getElementById("ex-shape").textContent = typeof shape === "function" ? shape(run) : shape;
    document.getElementById("ex-mat").textContent = step[1](run);
    document.getElementById("ex-steps").innerHTML = exSteps
      .map(
        (s, i) =>
          `<button type="button" class="step-btn" data-i="${i}" aria-pressed="${i === ex}">${i + 1}</button>`
      )
      .join("");
    document.getElementById("ex-steps").querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        ex = Number(b.dataset.i);
        drawEx();
      });
    });
  }
  document.getElementById("ex-prev").onclick = () => {
    ex = Math.max(0, ex - 1);
    drawEx();
  };
  document.getElementById("ex-next").onclick = () => {
    ex = Math.min(exSteps.length - 1, ex + 1);
    drawEx();
  };
  document.getElementById("ex-causal").onchange = (ev) => {
    causal = ev.target.checked;
    drawEx();
  };
  drawEx();

  const families = {
    encoder: {
      name: "Энкодер",
      model: "BERT, 2018",
      text: "Токен видит всю фразу. Учат восстанавливать скрытые слова. Строится представление.",
      note: "Заполнен весь квадрат.",
      allow: () => true,
    },
    decoder: {
      name: "Декодер",
      model: "GPT, с 2018",
      text: "Токен видит себя и предыдущие. Каждая позиция предсказывает следующее слово.",
      note: "Верхний треугольник пуст: будущего нет.",
      allow: (r, c) => c <= r,
    },
    both: {
      name: "Энкодер–декодер",
      model: "2017 и T5, 2019",
      text: "Вход прочитан целиком. Выход пишется слева направо и смотрит на весь вход.",
      note: "Строки — слова перевода. Первые три колонки — вся русская фраза, она видна всегда.",
      allow: (r, c) => c < 3 || c - 3 <= r,
    },
  };
  let family = "decoder";
  let familyRow = 1;
  const famTabs = document.getElementById("family-tabs");
  function drawFamily() {
    famTabs.innerHTML = Object.keys(families)
      .map((id) => {
        const f = families[id];
        return `<button type="button" class="card" data-id="${id}" aria-pressed="${id === family}"><span>${f.name}</span><b>${f.model}</b><p>${f.text}</p></button>`;
      })
      .join("");
    famTabs.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        family = b.dataset.id;
        drawFamily();
      });
    });
    const spec = families[family];
    const labels = family === "both" ? ["врач", "смотрит", "снимок", "doctor", "views", "scan"] : words;
    const rows = family === "both" ? ["doctor", "views", "scan"] : labels;
    document.getElementById("family-lead").textContent = spec.text;
    let html = `<div class="grid" style="grid-template-columns: 112px repeat(${labels.length}, 108px)">`;
    html += `<span></span>` + labels.map((w) => `<span class="cell head">${w}</span>`).join("");
    rows.forEach((row, r) => {
      html += `<span class="cell head">${row}</span>`;
      labels.forEach((_, c) => {
        const on = spec.allow(r, c);
        html += `<button type="button" class="cell ${on ? "on" : ""}" data-r="${r}" aria-label="${row} ${on ? "видит" : "не видит"} ${labels[c]}"></button>`;
      });
      html += "";
    });
    html += "</div>";
    const grid = document.getElementById("family-grid");
    grid.innerHTML = html;
    document.getElementById("family-note").textContent = spec.note;
    grid.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        familyRow = Number(b.dataset.r);
        const seen = labels.filter((_, c) => spec.allow(familyRow, c));
        document.getElementById("family-note").textContent =
          "Строка «" + rows[familyRow] + "» видит: " + seen.join(", ") + ".";
      });
    });
  }
  drawFamily();

  const quiz = [
    ["Что делают запрос, ключ и значение?", "Запрос ищет, ключ находится, значение отдаёт содержание. Смешивают значения, а не ключи."],
    ["Зачем маска в декодере?", "Чтобы позиция не прочитала будущее слово. Обучение при этом идёт по всем позициям сразу."],
    ["К какому семейству относятся BERT и GPT?", "BERT — энкодер, он видит фразу целиком. GPT — декодер, он порождает продолжение."],
    ["Почему делят на корень из длины ключа?", "Иначе оценки разъезжаются и softmax оставляет один токен."],
  ];
  document.getElementById("quiz").innerHTML = quiz
    .map(
      (q, i) =>
        `<div class="quiz"><p>${q[0]}</p><button type="button" class="ghost" data-i="${i}">Показать ответ</button><p class="answer">${q[1]}</p></div>`
    )
    .join("");
  document.getElementById("quiz").querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => b.parentElement.classList.toggle("open"));
  });

  const concepts = [
    ["mask", "Причинная маска", "Закрывает будущие позиции, обучение остаётся параллельным."],
    ["ffn", "Сеть токена", "Считает внутри одного токена после того, как внимание собрало контекст."],
    ["ln", "Нормализация слоя", "Держит числа одного токена в устойчивом диапазоне."],
    ["mha", "Многоголовое внимание", "Несколько меньших вниманий параллельно, затем склейка."],
    ["pos", "Позиционное кодирование", "Внимание само по себе не знает порядка."],
    ["resid", "Остаточная связь", "Подслой учит поправку: x + f(x)."],
    ["sa", "Самовнимание", "Токен обновляется взвешенной смесью других токенов."],
    ["block", "Блок", "Внимание и сеть токена, каждая с нормой и остатком."],
    ["families", "Три семейства", "Энкодер, декодер, энкодер–декодер."],
  ];
  const STATUS = ["Не начато", "Учу", "Понял", "Вернуться"];
  function markLevel(id) {
    const v = state.marks[id];
    if (v === true) return 2;
    return typeof v === "number" ? ((v % 4) + 4) % 4 : 0;
  }
  function bumpMark(id) {
    state.marks[id] = (markLevel(id) + 1) % 4;
  }
  function drawConcepts() {
    document.getElementById("concept-list").innerHTML = concepts
      .map((c) => {
        const level = markLevel(c[0]);
        return `<div class="item"><div><b>${c[1]}</b><p>${c[2]}</p></div><button type="button" class="ghost mark" data-mark="${c[0]}" data-level="${level}" aria-pressed="${level === 2 ? "true" : "false"}">${STATUS[level]}</button></div>`;
      })
      .join("");
    bindMarks(document.getElementById("concept-list"));
  }

  const papers = [
    ["vaswani", "Attention Is All You Need", "Vaswani et al., 2017", "https://arxiv.org/abs/1706.03762", "Архитектура. Раздел 3 с рисунком 1, формула в 3.2."],
    ["bahdanau", "Neural Machine Translation by Jointly Learning to Align and Translate", "Bahdanau, Cho, Bengio, 2014", "https://arxiv.org/abs/1409.0473", "Внимание в переводе: на каждом шаге веса по состояниям энкодера."],
    ["sutskever", "Sequence to Sequence Learning with Neural Networks", "Sutskever, Vinyals, Le, 2014", "https://arxiv.org/abs/1409.3215", "Вся фраза сжимается в один вектор. На длинных фразах качество падает."],
    ["he", "Deep Residual Learning for Image Recognition", "He et al., 2015", "https://arxiv.org/abs/1512.03385", "Блок учит поправку x + F(x)."],
    ["ba", "Layer Normalization", "Ba, Kiros, Hinton, 2016", "https://arxiv.org/abs/1607.06450", "Нормируют признаки одного примера, не батч."],
    ["bert", "BERT", "Devlin et al., 2018", "https://arxiv.org/abs/1810.04805", "Энкодер читает в обе стороны и заполняет скрытые токены."],
    ["t5", "Exploring the Limits of Transfer Learning", "Raffel et al., 2019", "https://arxiv.org/abs/1910.10683", "Любая задача — текст на входе и текст на выходе."],
    ["xiong", "On Layer Normalization in the Transformer Architecture", "Xiong et al., 2020", "https://arxiv.org/abs/2002.04745", "Почему норму ставят до подслоя."],
  ];
  function drawPapers() {
    document.getElementById("paper-list").innerHTML = papers
      .map(
        (p) =>
          `<div class="item"><div><a href="${p[3]}"><b>${p[1]}</b></a><p class="eyebrow">${p[2]}</p><p>${p[4]}</p></div><button type="button" class="ghost paper" data-id="${p[0]}" aria-pressed="${state.papers[p[0]] ? "true" : "false"}">${state.papers[p[0]] ? "Прочитано" : "Отметить"}</button></div>`
      )
      .join("");
    document.getElementById("paper-list").querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        state.papers[b.dataset.id] = !state.papers[b.dataset.id];
        save();
        drawPapers();
      });
    });
  }

  const videos = [
    ["3b1", "3Blue1Brown. Трансформеры", "https://www.youtube.com/watch?v=wjZofJX0v4M", "От текста к вероятности следующего токена."],
    ["3b2", "3Blue1Brown. Внимание по шагам", "https://www.youtube.com/watch?v=eMlx5fFNoYc", "Запрос, ключ, значение, softmax."],
    ["karpathy", "Karpathy. GPT с нуля", "https://www.youtube.com/watch?v=kCc8FmEb1nY", "Тот же блок как программа."],
  ];
  function drawVideos() {
    document.getElementById("video-list").innerHTML = videos
      .map(
        (v) =>
          `<div class="item"><div><a href="${v[2]}"><b>${v[1]}</b></a><p>${v[3]}</p></div><button type="button" class="ghost video" data-id="${v[0]}" aria-pressed="${state.videos[v[0]] ? "true" : "false"}">${state.videos[v[0]] ? "Просмотрено" : "Отметить"}</button></div>`
      )
      .join("");
    document.getElementById("video-list").querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        state.videos[b.dataset.id] = !state.videos[b.dataset.id];
        save();
        drawVideos();
      });
    });
  }

  function bindMarks(root) {
    root.querySelectorAll(".mark").forEach((b) => {
      b.addEventListener("click", () => {
        bumpMark(b.dataset.mark);
        save();
        drawConcepts();
        paintLooseMarks();
      });
    });
  }
  document.querySelectorAll("button.loose").forEach((b) => {
    b.addEventListener("click", () => {
      bumpMark(b.dataset.mark);
      save();
      drawConcepts();
      paintLooseMarks();
    });
  });
  function paintLooseMarks() {
    const base = { mask: "Маска", pos: "Позиции", families: "Семейства" };
    document.querySelectorAll("button.loose").forEach((b) => {
      const level = markLevel(b.dataset.mark);
      b.dataset.level = String(level);
      b.setAttribute("aria-pressed", level === 2 ? "true" : "false");
      b.textContent = base[b.dataset.mark] + " · " + STATUS[level];
    });
  }
  drawConcepts();
  drawPapers();
  drawVideos();
  paintLooseMarks();

  function setMode(mode) {
    state.mode = mode;
    save();
    document.body.classList.toggle("full", mode === "full");
    document.body.classList.toggle("core", mode !== "full");
    document.getElementById("mode-core").setAttribute("aria-pressed", mode !== "full" ? "true" : "false");
    document.getElementById("mode-full").setAttribute("aria-pressed", mode === "full" ? "true" : "false");
  }
  document.getElementById("mode-core").onclick = () => setMode("core");
  document.getElementById("mode-full").onclick = () => setMode("full");
  document.getElementById("mode-research").onclick = () => {
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
  done.onclick = () => {
    state.chapter = !state.chapter;
    save();
    paintChapter();
  };
  paintChapter();

  document.querySelectorAll("[data-copy]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const url = location.origin + location.pathname + a.getAttribute("href");
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      history.replaceState(null, "", a.getAttribute("href"));
      a.textContent = "✓";
      setTimeout(() => {
        a.textContent = "#";
      }, 800);
    });
  });

  const links = Array.from(document.querySelectorAll(".toc a"));
  const heads = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  const spy = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + visible.target.id));
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.4] }
  );
  heads.forEach((h) => spy.observe(h));

  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches("input, textarea")) return;
    if (ev.key === "ArrowRight") document.getElementById("lab-next").click();
    if (ev.key === "ArrowLeft") document.getElementById("lab-prev").click();
  });

  function paintSize() {
    document.body.classList.remove("size-s", "size-m", "size-l");
    const size = state.textSize === "s" || state.textSize === "l" ? state.textSize : "m";
    state.textSize = size;
    document.body.classList.add("size-" + size);
    document.querySelectorAll("[data-size]").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.size === size ? "true" : "false");
    });
  }
  document.querySelectorAll("[data-size]").forEach((b) => {
    b.addEventListener("click", () => {
      state.textSize = b.dataset.size;
      save();
      paintSize();
      requestAnimationFrame(drawHeroArcs);
    });
  });
  paintSize();

  function wrapRange(range, color) {
    const mark = document.createElement("mark");
    mark.className = "hl";
    mark.dataset.color = String(color);
    try {
      range.surroundContents(mark);
    } catch (err) {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
  }
  function rememberHighlight(quote, color) {
    state.highlights = (state.highlights || []).filter((h) => h.quote !== quote);
    if (color) state.highlights.push({ quote: quote, color: String(color) });
    save();
  }
  (state.highlights || []).forEach((h) => {
    const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || node.parentElement.closest("mark, button, .panel, .sentence, pre, .eq")) continue;
      const at = node.data.indexOf(h.quote);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + h.quote.length);
      wrapRange(range, h.color);
      break;
    }
  });
  const pop = document.getElementById("hl-pop");
  let hlRange = null;
  document.querySelector("main").addEventListener("mouseup", () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const main = document.querySelector("main");
      if (!main.contains(range.commonAncestorContainer)) return;
      if (range.toString().trim().length < 2) return;
      hlRange = range.cloneRange();
      const rect = range.getBoundingClientRect();
      pop.hidden = false;
      pop.style.left = Math.max(8, rect.left) + "px";
      pop.style.top = Math.max(8, rect.top - 48) + "px";
    }, 0);
  });
  pop.addEventListener("mousedown", (ev) => ev.preventDefault());
  pop.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn || !hlRange) return;
    const quote = hlRange.toString();
    if (btn.dataset.c === "0") {
      const host = hlRange.commonAncestorContainer.nodeType === 1 ? hlRange.commonAncestorContainer : hlRange.commonAncestorContainer.parentElement;
      const mark = host && host.closest("mark.hl");
      if (mark) {
        rememberHighlight(mark.textContent, 0);
        mark.replaceWith.apply(mark, mark.childNodes);
      }
    } else {
      wrapRange(hlRange, btn.dataset.c);
      rememberHighlight(quote, btn.dataset.c);
    }
    pop.hidden = true;
    window.getSelection().removeAllRanges();
    hlRange = null;
  });
  document.addEventListener("mousedown", (ev) => {
    if (!pop.contains(ev.target)) pop.hidden = true;
  });
})();
