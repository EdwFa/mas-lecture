(function () {
  const TOTAL = 31;
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
    ".deck-count{min-width:92px;text-align:center;letter-spacing:.16em;font-size:15px;color:#5e6872;}",
    ".deck-side{display:flex;align-items:center;min-width:0;}",
    ".deck-side.right{justify-content:flex-end;}",
    ".deck-quiet{color:#5e6872;text-decoration:none;font-size:13px;letter-spacing:.1em;text-transform:uppercase;}",
    ".deck-menu{position:relative;}",
    ".deck-pop{position:absolute;left:0;bottom:calc(100% + 12px);min-width:280px;margin:0;padding:6px 0;",
    "background:#f7f4ee;border:1px solid #d9d3c7;}",
    ".deck-pop a{display:block;padding:12px 18px;color:#1c1915;text-decoration:none;",
    "font-family:Georgia,'Iowan Old Style',serif;font-size:20px;}",
    ".deck-pop a:hover{background:#f3efe6;}"
  ].join("");
  document.head.appendChild(style);

  const nav = document.createElement("nav");
  nav.className = "deck-nav";
  nav.innerHTML = [
    '<div class="deck-side"><div class="deck-menu" id="deck-interactive">',
    '<button type="button" id="deck-btn" aria-expanded="false" aria-haspopup="true">Интерактив</button>',
    '<div class="deck-pop" id="deck-pop" hidden>',
    '<a href="chapters/index.html">Трансформеры</a>',
    '<a href="chapters/llm/">Языковые модели</a>',
    '<a href="chapters/build/">Сборка модели</a>',
    '<a href="chapters/assistant.html">Ассистент</a>',
    "</div></div></div>",
    '<div class="deck-pager">',
    '<button type="button" id="deck-prev">Предыдущий</button>',
    '<div class="deck-count" id="deck-count"></div>',
    '<button type="button" id="deck-next">Следующий</button>',
    "</div>",
    '<div class="deck-side right"><a class="deck-quiet" href="glossary.html">Глоссарий</a></div>'
  ].join("");
  document.body.appendChild(nav);

  const prev = document.querySelector("#deck-prev");
  const next = document.querySelector("#deck-next");
  const count = document.querySelector("#deck-count");
  const btn = document.querySelector("#deck-btn");
  const pop = document.querySelector("#deck-pop");

  function href(i) {
    return "slide-" + String(i).padStart(2, "0") + ".html?v=4";
  }

  count.textContent = n + " / " + TOTAL;
  prev.disabled = n <= 1;
  next.disabled = n >= TOTAL;
  document.title = "Слайд " + n + " · Лекция 1. Вводная";

  function go(i) {
    if (i < 1 || i > TOTAL || i === n) return;
    location.href = href(i);
  }

  prev.addEventListener("click", function () { go(n - 1); });
  next.addEventListener("click", function () { go(n + 1); });

  function setMenu(open) {
    pop.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setMenu(pop.hidden);
  });
  document.addEventListener("click", function () { setMenu(false); });

  window.addEventListener("keydown", function (e) {
    if (!pop.hidden) {
      if (e.key === "Escape") setMenu(false);
      return;
    }
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
