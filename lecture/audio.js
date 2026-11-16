/* Озвучка слайда: иконки «Слушать» и «Звук», регулятор скорости, если рядом есть audio/slide-NN.mp3.
   Файла нет (например, на опубликованном сайте) — кнопки не появляются. */
(function () {
  const m = location.pathname.match(/slide-(\d+)\.html$/);
  if (!m) return;
  const src = "audio/slide-" + m[1] + ".mp3";

  function get(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function set(store, key, val) { try { store.setItem(key, val); } catch (e) {} }
  function local() { try { return window.localStorage; } catch (e) { return null; } }
  function session() { try { return window.sessionStorage; } catch (e) { return null; } }

  const audio = new Audio();
  audio.preload = "metadata";
  audio.muted = get(local(), "deck-audio-muted") === "1";

  let shown = false;
  audio.addEventListener("loadedmetadata", show, { once: true });
  audio.src = src;

  function show() {
    if (shown) return;
    shown = true;
    const pager = document.querySelector(".deck-pager");
    if (!pager) return;

    const style = document.createElement("style");
    style.textContent = [
      ".deck-audio{display:flex;align-items:center;gap:10px;margin-left:12px;}",
      ".deck-audio .deck-ico{width:48px;height:42px;min-width:0;padding:0;display:inline-flex;align-items:center;justify-content:center;}",
      ".deck-audio .deck-ico svg{width:20px;height:20px;display:block;}",
      ".deck-audio .deck-ico[aria-pressed='true']{background:#1c1915;color:#f7f4ee;border-color:#1c1915;}",
      ".deck-audio .deck-speed{display:flex;align-items:center;gap:8px;font:500 13px/1 Helvetica Neue,Helvetica,Arial,sans-serif;",
      "letter-spacing:.06em;color:#5e6872;}",
      ".deck-audio input[type=range]{width:96px;accent-color:#1c1915;cursor:pointer;}",
      ".deck-audio .deck-rate{min-width:42px;color:#1c1915;}",
      ".deck-audio .deck-time{min-width:84px;font:13px/1 Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:.08em;color:#5e6872;}"
    ].join("");
    document.head.appendChild(style);

    const box = document.createElement("div");
    box.className = "deck-audio";
    const I = {
      play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
      pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15"/><rect x="14" y="4.5" width="4" height="15"/></svg>',
      on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
      off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9l6 6M22 9l-6 6"/></svg>'
    };
    box.innerHTML =
      '<button type="button" class="deck-ico" id="deck-play" aria-pressed="false"></button>' +
      '<button type="button" class="deck-ico" id="deck-mute" aria-pressed="false"></button>' +
      '<label class="deck-speed" title="Скорость ( [ медленнее, ] быстрее )">' +
      '<input type="range" id="deck-rate" min="0.5" max="2" step="0.25" aria-label="Скорость воспроизведения">' +
      '<span class="deck-rate" id="deck-rate-val"></span></label>' +
      '<span class="deck-time" id="deck-time"></span>';
    pager.appendChild(box);

    const play = box.querySelector("#deck-play");
    const mute = box.querySelector("#deck-mute");
    const time = box.querySelector("#deck-time");
    const rate = box.querySelector("#deck-rate");
    const rateVal = box.querySelector("#deck-rate-val");
    const saved = parseFloat(get(local(), "deck-audio-rate"));
    audio.playbackRate = saved >= 0.5 && saved <= 2 ? saved : 1;
    rate.value = String(audio.playbackRate);
    function setRate(v) {
      v = Math.min(2, Math.max(0.5, Math.round(v * 4) / 4));
      audio.playbackRate = v; rate.value = String(v);
      set(local(), "deck-audio-rate", String(v));
      render();
    }
    rate.addEventListener("input", function () { setRate(parseFloat(rate.value)); });
    rate.addEventListener("click", function (e) { e.stopPropagation(); });
    rate.addEventListener("keydown", function (e) { e.stopPropagation(); });

    function fmt(s) {
      s = Math.max(0, Math.floor(s || 0));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    function render() {
      const on = !audio.paused && !audio.ended;
      play.innerHTML = on ? I.pause : I.play;
      play.title = (on ? "Пауза" : "Слушать") + " (P)";
      play.setAttribute("aria-label", on ? "Пауза" : "Слушать");
      play.setAttribute("aria-pressed", on ? "true" : "false");
      mute.innerHTML = audio.muted ? I.off : I.on;
      mute.title = (audio.muted ? "Включить звук" : "Выключить звук") + " (M)";
      mute.setAttribute("aria-label", audio.muted ? "Звук выключен" : "Звук включён");
      mute.setAttribute("aria-pressed", audio.muted ? "true" : "false");
      rateVal.textContent = String(audio.playbackRate).replace(".", ",") + "×";
      time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
    }
    function toggle() {
      if (audio.paused || audio.ended) {
        set(session(), "deck-audio-playing", "1");
        audio.play().catch(function () {});
      } else {
        set(session(), "deck-audio-playing", "0");
        audio.pause();
      }
    }
    function toggleMute() {
      audio.muted = !audio.muted;
      set(local(), "deck-audio-muted", audio.muted ? "1" : "0");
      render();
    }

    play.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
    mute.addEventListener("click", function (e) { e.stopPropagation(); toggleMute(); });
    ["play", "pause", "ended", "timeupdate", "volumechange", "ratechange"].forEach(function (ev) {
      audio.addEventListener(ev, render);
    });
    audio.addEventListener("ended", function () { set(session(), "deck-audio-playing", "1"); });

    window.addEventListener("keydown", function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") { e.preventDefault(); toggle(); }
      if (e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") { e.preventDefault(); toggleMute(); }
      if (e.key === "]" || e.key === "ъ") { e.preventDefault(); setRate(audio.playbackRate + 0.25); }
      if (e.key === "[" || e.key === "х") { e.preventDefault(); setRate(audio.playbackRate - 0.25); }
    });

    render();
    // Если на прошлом слайде звук играл, продолжаем на этом.
    if (get(session(), "deck-audio-playing") === "1") audio.play().catch(render);
  }
})();
