(function () {
  const KEY = "assistant-chapter-v1";
  const state = Object.assign(
    {
      mode: "core",
      research: false,
      chapter: false,
      marks: {},
      papers: {},
      textSize: "m",
      opened: {},
    },
    JSON.parse(localStorage.getItem(KEY) || "{}")
  );
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function pct(x) {
    return Math.round(x * 1000) / 10;
  }

  const lossTokens = [
    { text: "снимок", kind: "prompt", p: 0.4 },
    { text: "готов", kind: "prompt", p: 0.55 },
    { text: "?", kind: "prompt", p: 0.7 },
    { text: "Он", kind: "answer", p: 0.5 },
    { text: "готов", kind: "answer", p: 0.25 },
    { text: "конец", kind: "answer", p: 0.8 },
  ];
  let mask = "answer";
  const lossRows = document.getElementById("loss-rows");
  lossRows.innerHTML = lossTokens
    .map((tok, i) => `<label class="tok"><b>${tok.text}</b><input data-i="${i}" type="range" min="0.05" max="0.95" step="0.01" value="${tok.p}" /><span>${tok.p.toFixed(2)}</span></label>`)
    .join("");
  function drawLoss() {
    document.getElementById("mask-answer").setAttribute("aria-pressed", mask === "answer" ? "true" : "false");
    document.getElementById("mask-all").setAttribute("aria-pressed", mask === "all" ? "true" : "false");
    lossRows.querySelectorAll(".tok").forEach((row, i) => {
      const on = mask === "all" || lossTokens[i].kind === "answer";
      row.classList.toggle("off", !on);
      row.querySelector("span").textContent = lossTokens[i].p.toFixed(2);
    });
    const chosen = lossTokens.filter((tok) => mask === "all" || tok.kind === "answer");
    const nll = chosen.reduce((sum, tok) => sum - Math.log(tok.p), 0) / chosen.length;
    const promptMoves = mask === "answer" ? " Вероятности вопроса в потерю не входят." : " В счёт входят и вопрос, и ответ.";
    document.getElementById("loss-out").textContent =
      "Средняя потеря по " + chosen.length + " токенам: " + nll.toFixed(3) + " ната." + promptMoves;
  }
  lossRows.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      lossTokens[Number(input.dataset.i)].p = Number(input.value);
      drawLoss();
    });
  });
  document.getElementById("mask-answer").onclick = () => {
    mask = "answer";
    drawLoss();
  };
  document.getElementById("mask-all").onclick = () => {
    mask = "all";
    drawLoss();
  };
  drawLoss();

  let stray = false;
  function drawChat() {
    const lines = [
      ["система", "Готовь черновик передачи. Не ставь диагноз и не назначай."],
      ["врач", "Снимок готов?"],
      ["ассистент", stray ? "〈лишний〉 Он готов. Дата консилиума не назначена." : "Он готов. Дата консилиума не назначена."],
    ];
    document.getElementById("chat").innerHTML = lines
      .map((line, i) => `<div class="chat-line ${i === 2 ? "mask-on" : ""}"><b>${line[0]}</b><span>${line[1]}</span></div>`)
      .join("");
    document.getElementById("chat-stray").setAttribute("aria-pressed", stray ? "true" : "false");
    document.getElementById("chat-note").textContent = stray
      ? "Лишний токен попал в ответ. Маска по-прежнему учит эти позиции, но цель уже не та передача, которую хотели показать."
      : "Зелёным отмечен ответ: его токены входят в потерю. Вопрос остаётся в контексте и в потерю не входит.";
  }
  document.getElementById("chat-stray").onclick = () => {
    stray = !stray;
    drawChat();
  };
  drawChat();

  const drafts = [
    { title: "Два предложения", text: "Снимок готов. Дата консилиума не назначена.", faith: 3, conf: 1 },
    { title: "Уверенная дата", text: "Снимок готов, консилиум назначен на завтра.", faith: 0, conf: 3 },
    { title: "Пять предложений", text: "Пациент ждал снимок. Снимок готов. Дата не названа. Новых фактов нет. Это передача, не заключение.", faith: 3, conf: 1 },
    { title: "Лишний отказ", text: "Не могу готовить передачу по медицинским данным.", faith: 1, conf: 0 },
  ];
  let rubric = "faith";
  function rubricScore(draft) {
    return rubric === "faith" ? draft.faith : draft.conf;
  }
  function fitScores() {
    const pairs = [];
    for (let i = 0; i < drafts.length; i++) {
      for (let j = 0; j < drafts.length; j++) {
        if (rubricScore(drafts[i]) > rubricScore(drafts[j])) pairs.push([i, j]);
      }
    }
    let scores = drafts.map(() => 0);
    const lr = 0.35;
    for (let step = 0; step < 80; step++) {
      const grad = scores.map(() => 0);
      pairs.forEach((pair) => {
        const p = 1 / (1 + Math.exp(-(scores[pair[0]] - scores[pair[1]])));
        grad[pair[0]] += p - 1;
        grad[pair[1]] += 1 - p;
      });
      scores = scores.map((value, i) => value - (lr * grad[i]) / pairs.length);
    }
    return scores;
  }
  function drawJudge() {
    document.getElementById("rubric-faith").setAttribute("aria-pressed", rubric === "faith" ? "true" : "false");
    document.getElementById("rubric-conf").setAttribute("aria-pressed", rubric === "conf" ? "true" : "false");
    const learned = fitScores();
    const best = learned.indexOf(Math.max.apply(null, learned));
    document.getElementById("drafts").innerHTML = drafts
      .map((draft, i) => {
        return `<button type="button" class="draft" aria-pressed="${i === best}"><span>${draft.title} · счёт ${learned[i].toFixed(2)}</span>${draft.text}</button>`;
      })
      .join("");
    const gap = learned[0] - learned[1];
    const win = 1 / (1 + Math.exp(-gap));
    document.getElementById("judge-note").textContent =
      (rubric === "faith"
        ? "Рубрика «верность» ставит выше передачу без новой даты."
        : "Рубрика «уверенность» ставит выше выдуманную дату.") +
      " Сигмоида разности счетов «два предложения» и «уверенная дата» даёт " +
      pct(win).toFixed(0) +
      "% в пользу первого. Подгонка та же, разметка другая.";
  }
  document.getElementById("rubric-faith").onclick = () => {
    rubric = "faith";
    drawJudge();
  };
  document.getElementById("rubric-conf").onclick = () => {
    rubric = "conf";
    drawJudge();
  };
  drawJudge();

  const policyNames = ["Верный черновик", "Выдуманная дата", "Лишний отказ"];
  const policyRef = [0.5, 0.2, 0.3];
  const policyTruth = [1, 0, 0.2];
  const rewards = {
    flawed: [1, 2.265, 0.15],
    strict: [2.2, 0.2, 0.8],
  };
  let judgeKind = "flawed";
  function softmaxPolicy(beta) {
    const reward = rewards[judgeKind];
    const weights = policyRef.map((p, i) => p * Math.exp(reward[i] / beta));
    const z = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => w / z);
  }
  function drawPolicy() {
    const beta = Number(document.getElementById("beta").value);
    document.getElementById("beta-label").textContent = beta.toFixed(2);
    document.getElementById("judge-flawed").setAttribute("aria-pressed", judgeKind === "flawed" ? "true" : "false");
    document.getElementById("judge-strict").setAttribute("aria-pressed", judgeKind === "strict" ? "true" : "false");
    const pi = softmaxPolicy(beta);
    const reward = rewards[judgeKind];
    const expectedReward = pi.reduce((sum, p, i) => sum + p * reward[i], 0);
    const expectedTruth = pi.reduce((sum, p, i) => sum + p * policyTruth[i], 0);
    document.getElementById("policy-bars").innerHTML = pi
      .map((p, i) => {
        return `<div class="attn-row"><span>${policyNames[i]}</span><div class="track"><div class="fill" style="width:${pct(p)}%"></div></div><span>${pct(p).toFixed(0)}%</span></div>`;
      })
      .join("");
    document.getElementById("policy-note").textContent =
      "Опора выдуманной даты — 20%. Сейчас " +
      pct(pi[1]).toFixed(0) +
      "%. Ожидаемая награда " +
      expectedReward.toFixed(2) +
      ", ожидаемая верность " +
      expectedTruth.toFixed(2) +
      ". Верность: верный черновик 1, выдумка 0, отказ 0,2.";
  }
  document.getElementById("beta").addEventListener("input", drawPolicy);
  document.getElementById("judge-flawed").onclick = () => {
    judgeKind = "flawed";
    drawPolicy();
  };
  document.getElementById("judge-strict").onclick = () => {
    judgeKind = "strict";
    drawPolicy();
  };
  drawPolicy();

  const dpo = { lw: -3.5, ll: -3.2, rw: -4, rl: -3, beta: 0.5 };
  const dpoFields = [
    ["rw", "Опора, выбранный", -6, -0.5],
    ["rl", "Опора, отвергнутый", -6, -0.5],
    ["lw", "Политика, выбранный", -6, -0.5],
    ["ll", "Политика, отвергнутый", -6, -0.5],
    ["beta", "β", 0.1, 2],
  ];
  function dpoLoss() {
    const margin = dpo.beta * (dpo.lw - dpo.rw - (dpo.ll - dpo.rl));
    const sig = 1 / (1 + Math.exp(-margin));
    return { margin: margin, loss: -Math.log(sig) };
  }
  document.getElementById("dpo-rows").innerHTML = dpoFields
    .map((field) => `<label class="tok"><b>${field[1]}</b><input data-k="${field[0]}" type="range" min="${field[2]}" max="${field[3]}" step="0.1" value="${dpo[field[0]]}" /><span>${dpo[field[0]].toFixed(1)}</span></label>`)
    .join("");
  function drawDpo() {
    document.getElementById("dpo-rows").querySelectorAll("input").forEach((input) => {
      input.value = dpo[input.dataset.k];
      input.parentElement.querySelector("span").textContent = Number(dpo[input.dataset.k]).toFixed(1);
    });
    const got = dpoLoss();
    const chosenDrop = dpo.lw < dpo.rw;
    const rejectedDrop = dpo.ll < dpo.rl;
    const both = chosenDrop && rejectedDrop ? " Оба ответа стали менее вероятны, чем на опоре, а сравнение всё же улучшилось: отвергнутый просел сильнее." : "";
    document.getElementById("dpo-out").textContent =
      "Разность относительно опоры " +
      got.margin.toFixed(3) +
      ". Потеря пары " +
      got.loss.toFixed(3) +
      ". На самой опоре, при нулевой разности, потеря −log(0,5) = 0,693." +
      both;
  }
  document.getElementById("dpo-rows").querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      dpo[input.dataset.k] = Number(input.value);
      drawDpo();
    });
  });
  document.getElementById("dpo-napkin").onclick = () => {
    Object.assign(dpo, { lw: -3.5, ll: -3.2, rw: -4, rl: -3, beta: 0.5 });
    drawDpo();
  };
  document.getElementById("dpo-both").onclick = () => {
    Object.assign(dpo, { lw: -4.4, ll: -4, rw: -4, rl: -3, beta: 0.5 });
    drawDpo();
  };
  drawDpo();

  const routes = {
    ppo: {
      name: "Награда и PPO",
      model: "Три шага",
      text: "Отдельная модель награды и выборка ответов.",
      steps: [
        "Показать ответ. Показы учат политику. Опорную копию замораживают.",
        "Сравнить ответы. Судья ранжирует. Модель награды учится предсказывать эти сравнения.",
        "Выбрать и улучшить. Политика порождает ответы. PPO берёт награду и штраф за уход от опоры.",
      ],
    },
    dpo: {
      name: "DPO",
      model: "Короче на этом шаге",
      text: "Пары подгоняют саму модель относительно опоры.",
      steps: [
        "Показать ответ. Так же получают политику и замороженную опору.",
        "Сравнить ответы. Остаются пары «выбран / отвергнут» под явной рубрикой.",
        "Подогнать политику. Потеря смотрит, насколько логарифм выбранного вырос относительно опоры сильнее, чем логарифм отвергнутого.",
      ],
    },
  };
  let route = "ppo";
  function drawRoutes() {
    document.getElementById("route-tabs").innerHTML = Object.keys(routes)
      .map((id) => {
        const item = routes[id];
        return `<button type="button" class="card" data-id="${id}" aria-pressed="${id === route}"><span>${item.model}</span><b>${item.name}</b><p>${item.text}</p></button>`;
      })
      .join("");
    document.getElementById("route-tabs").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        route = button.dataset.id;
        drawRoutes();
      });
    });
    document.getElementById("route-steps").innerHTML = routes[route].steps.map((step) => `<li>${step}</li>`).join("");
  }
  drawRoutes();

  const quiz = [
    ["Чем пост-обучение отличается от предобучения?", "Механизм тот же: следующий токен. Другой сигнал того, какое продолжение считать удачным."],
    ["Прячет ли маска потерь вопрос?", "Нет. Вопрос остаётся в контексте. Маска лишь не награждает модель за то, что она повторила слова врача."],
    ["Почему высокий счёт судьи — ещё не экзамен?", "Поиск награды находит ошибки судьи. Верность источнику проверяют отдельно."],
    ["Что считает DPO на одной паре?", "Насколько логарифм выбранного ответа вырос относительно опоры сильнее, чем логарифм отвергнутого."],
  ];
  document.getElementById("quiz").innerHTML = quiz
    .map((item, i) => `<div class="quiz"><p>${item[0]}</p><button type="button" class="ghost" data-i="${i}">Показать ответ</button><p class="answer">${item[1]}</p></div>`)
    .join("");
  document.getElementById("quiz").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => button.parentElement.classList.toggle("open"));
  });

  const concepts = [
    ["sft", "Дообучение с учителем", "Те же веса, другая коллекция: показы ответов, которые модель должна воспроизводить."],
    ["mask", "Маска потерь", "Выбирает токены-цели и не убирает вопрос из контекста."],
    ["template", "Шаблон диалога", "Переводит роли в последовательность токенов конкретной модели."],
    ["pref", "Предпочтение", "Какой из двух ответов судья предпочёл на этом запросе и по этой рубрике."],
    ["rm", "Модель награды", "Число, которое предсказывает выбор судьи. Это не истина."],
    ["rlhf", "RLHF", "Политика улучшается наградой, часто со штрафом за уход от опоры."],
    ["dpo", "DPO", "Пары подгоняют саму модель по изменению логарифмов относительно опоры."],
    ["safety", "Отказ", "Нужны и уместный ответ, и уместный отказ. Доля отказов — не вся безопасность."],
    ["eval", "Проверка", "Успех задачи, верность, неопределённость, безопасность и сохранённое умение смотрят отдельно."],
  ];
  const STATUS = ["Не начато", "Учу", "Понял", "Вернуться"];
  function markLevel(id) {
    const value = state.marks[id];
    if (value === true) return 2;
    return typeof value === "number" ? ((value % 4) + 4) % 4 : 0;
  }
  function drawConcepts() {
    document.getElementById("concept-list").innerHTML = concepts
      .map((item) => {
        const level = markLevel(item[0]);
        return `<div class="item"><div><b>${item[1]}</b><p>${item[2]}</p></div><button type="button" class="ghost mark" data-mark="${item[0]}" data-level="${level}">${STATUS[level]}</button></div>`;
      })
      .join("");
    document.getElementById("concept-list").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.marks[button.dataset.mark] = (markLevel(button.dataset.mark) + 1) % 4;
        save();
        drawConcepts();
      });
    });
  }
  drawConcepts();

  const papers = [
    ["instruct", "InstructGPT", "Ouyang et al., 2022", "https://arxiv.org/abs/2203.02155", "Показы, модель награды, затем PPO."],
    ["dpo", "Direct Preference Optimization", "Rafailov et al., 2023", "https://arxiv.org/abs/2305.18290", "Пара подгоняется относительно опоры, уравнения 3 и 7."],
    ["christiano", "Deep RL from human preferences", "Christiano et al., 2017", "https://arxiv.org/abs/1706.03741", "Награда из попарных сравнений."],
    ["ppo", "Proximal Policy Optimization", "Schulman et al., 2017", "https://arxiv.org/abs/1707.06347", "Обрезка шага относительно политики, которая собрала выборку."],
    ["flan", "FLAN", "Wei et al., 2021", "https://arxiv.org/abs/2109.01652", "Много задач, записанных как инструкции."],
    ["stiennon", "Learning to summarize from human feedback", "Stiennon et al., 2020", "https://arxiv.org/abs/2009.01325", "Сравнения кратких пересказов до ассистентов."],
    ["t0", "T0", "Sanh et al., 2021", "https://arxiv.org/abs/2110.08207", "Приглашения и задачи, отложенные для проверки."],
    ["bai", "Helpful and harmless", "Bai et al., 2022", "https://arxiv.org/abs/2204.05862", "Полезность и безвредность не сводятся к одной доле отказов."],
    ["gao", "Reward model overoptimization", "Gao, Schulman, Hilton, 2022", "https://arxiv.org/abs/2210.10760", "Оптимизация против заместителя и отдельная награда."],
    ["cai", "Constitutional AI", "Bai et al., 2022", "https://arxiv.org/abs/2212.08073", "Принципы для правки и отдельный этап обратной связи."],
    ["self", "Self-Instruct", "Wang et al., 2022", "https://arxiv.org/abs/2212.10560", "Синтетические инструкции: затравка, фильтр, отложенная проверка."],
    ["lima", "LIMA", "Zhou et al., 2023", "https://arxiv.org/abs/2305.11206", "Тысяча отобранных показов без подкрепления."],
  ];
  function drawPapers() {
    document.getElementById("paper-list").innerHTML = papers
      .map((paper) => `<div class="item"><div><a href="${paper[3]}"><b>${paper[1]}</b></a><p class="eyebrow">${paper[2]}</p><p>${paper[4]}</p></div><button type="button" class="ghost" data-id="${paper[0]}" aria-pressed="${state.papers[paper[0]] ? "true" : "false"}">${state.papers[paper[0]] ? "Прочитано" : "Отметить"}</button></div>`)
      .join("");
    document.getElementById("paper-list").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.papers[button.dataset.id] = !state.papers[button.dataset.id];
        save();
        drawPapers();
      });
    });
  }
  drawPapers();

  document.querySelectorAll(".more-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.open;
      state.opened[id] = !state.opened[id];
      save();
      paintOpened();
    });
  });
  function paintOpened() {
    document.querySelectorAll(".more-toggle").forEach((button) => {
      const on = !!state.opened[button.dataset.open];
      const section = document.getElementById(button.dataset.open);
      if (section) section.classList.add("opened");
      if (section && !on) section.classList.remove("opened");
      button.setAttribute("aria-expanded", on ? "true" : "false");
      button.textContent = on ? "Свернуть · обратно к короткому" : "Ещё в полном · две старые модели в PPO";
    });
  }
  paintOpened();

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

  function paintSize() {
    document.body.classList.remove("size-s", "size-m", "size-l");
    const size = state.textSize === "s" || state.textSize === "l" ? state.textSize : "m";
    state.textSize = size;
    document.body.classList.add("size-" + size);
    document.querySelectorAll("[data-size]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.size === size ? "true" : "false");
    });
  }
  document.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      state.textSize = button.dataset.size;
      save();
      paintSize();
    });
  });
  paintSize();

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

  document.querySelectorAll("[data-copy]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const url = location.origin + location.pathname + link.getAttribute("href");
      if (navigator.clipboard) navigator.clipboard.writeText(url);
      history.replaceState(null, "", link.getAttribute("href"));
      link.textContent = "✓";
      setTimeout(() => {
        link.textContent = "#";
      }, 800);
    });
  });

  const links = Array.from(document.querySelectorAll(".toc a"));
  const heads = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === "#" + visible.target.id));
    },
    { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.4] }
  );
  heads.forEach((head) => spy.observe(head));

  bodyFullToc();
  function bodyFullToc() {
    const hide = document.querySelectorAll('.toc a[href="#feedback"], .toc a[href="#safety"], .toc a[href="#test"]');
    const apply = () => hide.forEach((link) => {
      link.style.display = document.body.classList.contains("full") ? "" : "none";
    });
    apply();
    document.getElementById("mode-core").addEventListener("click", apply);
    document.getElementById("mode-full").addEventListener("click", apply);
  }
})();
