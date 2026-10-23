/* Учебные векторы и прямой проход. Числа на странице считаются отсюда. */
(function (root) {
  const WORDS = ["врач", "принёс", "снимок", "он", "готов"];
  const EMB = [
    [2.0, 0.10, 0.35],
    [0.10, 1.20, 0.05],
    [1.55, 0.10, 1.35],
    [1.10, 0.15, 0.55],
    [0.25, 0.45, 0.30],
  ];
  const TEMP = 3.2;
  const SCALE = [2.2, 0.25, 0.25];

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function softmax(xs) {
    const m = Math.max.apply(null, xs);
    const ex = xs.map((x) => Math.exp(x - m));
    const z = ex.reduce((a, b) => a + b, 0);
    return ex.map((v) => v / z);
  }

  function project(v) {
    return v.map((x, i) => x * SCALE[i]);
  }

  function scoresFor(query, projected) {
    const q = projected ? project(EMB[query]) : EMB[query];
    return EMB.map((e) => {
      const k = projected ? project(e) : e;
      return dot(q, k);
    });
  }

  function attend(query, projected) {
    const raw = scoresFor(query, projected);
    const scaled = projected ? raw : raw.map((s) => s * TEMP);
    return { raw, weights: softmax(scaled) };
  }

  function mix(weights) {
    const d = EMB[0].length;
    const out = Array(d).fill(0);
    weights.forEach((w, i) => {
      for (let k = 0; k < d; k++) out[k] += w * EMB[i][k];
    });
    return out;
  }

  function matrix(projected) {
    return WORDS.map((_, q) => attend(q, projected).weights);
  }

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

  function randMatrix(rng, rows, cols, scale) {
    const m = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push((rng() * 2 - 1) * scale);
      m.push(row);
    }
    return m;
  }

  function matvec(m, v) {
    return m.map((row) => dot(row, v));
  }

  function add(a, b) {
    return a.map((x, i) => x + b[i]);
  }

  function explorer(causal) {
    const rng = mulberry32(7);
    const tokens = ["врач", "смотрит", "снимок"];
    const n = tokens.length;
    const d = 4;
    const vocab = ["врач", "смотрит", "снимок", "лёгких", "пациента", "."];
    const table = randMatrix(rng, vocab.length, d, 0.8);
    const ids = [0, 1, 2];
    const pos = [
      [0.0, 0.4, 0.0, 0.2],
      [0.3, 0.0, 0.5, 0.0],
      [0.1, 0.2, 0.0, 0.6],
    ];
    const X0 = ids.map((id) => table[id].slice());
    const X = X0.map((e, i) => add(e, pos[i]));
    const Wq = randMatrix(rng, d, d, 0.5);
    const Wk = randMatrix(rng, d, d, 0.5);
    const Wv = randMatrix(rng, d, d, 0.5);
    const W1 = randMatrix(rng, d * 2, d, 0.5);
    const W2 = randMatrix(rng, d, d * 2, 0.5);
    const Q = X.map((x) => matvec(Wq, x));
    const K = X.map((x) => matvec(Wk, x));
    const V = X.map((x) => matvec(Wv, x));
    const dk = d;
    const logits = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(dk)));
    if (causal) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) logits[i][j] = -1e9;
      }
    }
    const A = logits.map(softmax);
    const heads = A.map((row) => {
      const y = Array(d).fill(0);
      row.forEach((w, j) => {
        for (let k = 0; k < d; k++) y[k] += w * V[j][k];
      });
      return y;
    });
    const resid1 = X.map((x, i) => add(x, heads[i]));
    const hidden = resid1.map((x) => matvec(W1, x).map((v) => Math.max(0, v)));
    const ffn = hidden.map((h) => matvec(W2, h));
    const resid2 = resid1.map((x, i) => add(x, ffn[i]));
    const out = resid2.map((x) => softmax(table.map((row) => dot(row, x))));
    return { tokens, vocab, d, n, X0, pos, X, logits, A, heads, resid1, hidden, ffn, resid2, out, causal };
  }

  function fmt(x) {
    if (Math.abs(x) >= 1e8) return "−∞";
    return (Math.round(x * 100) / 100).toFixed(2);
  }

  function fmtMat(rows) {
    return rows.map((r) => r.map(fmt).join("  ")).join("\n");
  }

  root.TF = {
    WORDS,
    EMB,
    TEMP,
    attend,
    mix,
    matrix,
    explorer,
    fmt,
    fmtMat,
    dot,
  };
})(window);
