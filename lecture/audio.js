/* Озвучка слайда: кнопки «Слушать» и «Звук», если рядом есть audio/slide-NN.mp3.
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
      ".deck-audio button{min-width:132px;}",
      ".deck-audio button[aria-pressed='true']{background:#1c1915;color:#f7f4ee;border-color:#1c1915;}",
      ".deck-audio .deck-time{min-width:84px;font-size:13px;letter-spacing:.08em;color:#5e6872;",
      "font-family:Helvetica Neue,Helvetica,Arial,sans-serif;}"
    ].join("");
    document.head.appendChild(style);

    const box = document.createElement("div");
    box.className = "deck-audio";
    box.innerHTML =
      '<button type="button" id="deck-play" title="Слушать / пауза (P)" aria-pressed="false">▶ Слушать</button>' +
      '<button type="button" id="deck-mute" title="Звук вкл. / выкл. (M)" aria-pressed="false">Звук вкл.</button>' +
      '<span class="deck-time" id="deck-time"></span>';
    pager.appendChild(box);

    const play = box.querySelector("#deck-play");
    const mute = box.querySelector("#deck-mute");
    const time = box.querySelector("#deck-time");

    function fmt(s) {
      s = Math.max(0, Math.floor(s || 0));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    function render() {
      const on = !audio.paused && !audio.ended;
      play.textContent = on ? "❚❚ Пауза" : "▶ Слушать";
      play.setAttribute("aria-pressed", on ? "true" : "false");
      mute.textContent = audio.muted ? "Звук выкл." : "Звук вкл.";
      mute.setAttribute("aria-pressed", audio.muted ? "true" : "false");
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
    ["play", "pause", "ended", "timeupdate", "volumechange"].forEach(function (ev) {
      audio.addEventListener(ev, render);
    });
    audio.addEventListener("ended", function () { set(session(), "deck-audio-playing", "1"); });

    window.addEventListener("keydown", function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") { e.preventDefault(); toggle(); }
      if (e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") { e.preventDefault(); toggleMute(); }
    });

    render();
    // Если на прошлом слайде звук играл, продолжаем на этом.
    if (get(session(), "deck-audio-playing") === "1") audio.play().catch(render);
  }
})();
