(function () {
  const TOTAL = 16;
  const match = location.pathname.match(/slide-(\d+)\.html$/);
  const n = match ? Number(match[1]) : 1;

  const style = document.createElement("style");
  style.textContent = [
    ".deck-nav{position:fixed;left:0;right:0;bottom:0;z-index:20;min-height:64px;",
    "display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;",
    "column-gap:24px;padding:10px 28px;background:#f7f4ee;border-top:1px solid #d9d3c7;",
    "font-family:Helvetica Neue,Helvetica,Arial,sans-serif;}",
    ".deck-nav button{appearance:none;background:transparent;border:1px solid #d9d3c7;color:#1c1915;",
    "font:500 15px/1 Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;",
    "padding:12px 22px;cursor:pointer;}",
    ".deck-nav button:disabled{color:#b7b1a6;border-color:#e4dfd4;cursor:default;}",
    ".deck-pager{display:flex;align-items:center;justify-content:center;gap:28px;}",
    ".deck-count{min-width:92px;text-align:center;letter-spacing:.16em;font-size:15px;color:#5e6872;}"
  ].join("");
  document.head.appendChild(style);

  const nav = document.createElement("nav");
  nav.className = "deck-nav";
  nav.innerHTML = [
    "<div></div>",
    '<div class="deck-pager">',
    '<button type="button" id="deck-prev">Предыдущий</button>',
    '<div class="deck-count" id="deck-count"></div>',
    '<button type="button" id="deck-next">Следующий</button>',
    "</div>",
    "<div></div>"
  ].join("");
  document.body.appendChild(nav);

  const prev = document.querySelector("#deck-prev");
  const next = document.querySelector("#deck-next");
  const count = document.querySelector("#deck-count");

  function href(i) {
    return "slide-" + String(i).padStart(2, "0") + ".html?v=1";
  }

  count.textContent = n + " / " + TOTAL;
  prev.disabled = n <= 1;
  next.disabled = n >= TOTAL;
  document.title = "Слайд " + n + " · Лекция 3. Агенты в цепочках, маршрутизация, параллельное выполнение";

  function go(i) {
    if (i < 1 || i > TOTAL || i === n) return;
    location.href = href(i);
  }

  prev.addEventListener("click", function () { go(n - 1); });
  next.addEventListener("click", function () { go(n + 1); });

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      go(n + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      go(n - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(1);
    } else if (e.key === "End") {
      e.preventDefault();
      go(TOTAL);
    }
  });
})();
