// Thin-line lingonberry drawing: a frame of sprigs for any w×h box, plus the stamp and postmark.
// Everything returns SVG markup; colours come from CSS classes (.stem .leaf .rib .berry .shine .stamp-ink).
(function () {
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  const f = (n) => Math.round(n * 10) / 10;

  function leaf(x, y, ang, len) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, w = len * 0.42;
    const tx = x + dx * len, ty = y + dy * len;
    // lingonberry leaves are rounder towards the tip
    const a1 = [x + dx * len * 0.25 + nx * w, y + dy * len * 0.25 + ny * w];
    const a2 = [x + dx * len * 0.95 + nx * w * 0.9, y + dy * len * 0.95 + ny * w * 0.9];
    const b1 = [x + dx * len * 0.95 - nx * w * 0.9, y + dy * len * 0.95 - ny * w * 0.9];
    const b2 = [x + dx * len * 0.25 - nx * w, y + dy * len * 0.25 - ny * w];
    return `<path class="leaf" d="M${f(x)} ${f(y)}C${f(a1[0])} ${f(a1[1])} ${f(a2[0])} ${f(a2[1])} ${f(tx)} ${f(ty)}` +
      `C${f(b1[0])} ${f(b1[1])} ${f(b2[0])} ${f(b2[1])} ${f(x)} ${f(y)}Z"/>` +
      `<path class="rib" d="M${f(x + dx * 2)} ${f(y + dy * 2)}L${f(x + dx * len * 0.75)} ${f(y + dy * len * 0.75)}"/>`;
  }

  function berries(r, x, y, ang, n, size) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * 0.62 + (r() - 0.5) * 0.3;
      const d = size * (1.5 + r() * 0.9);
      const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d, br = size * (0.8 + r() * 0.35);
      out += `<path class="stem" d="M${f(x)} ${f(y)}L${f(bx)} ${f(by)}"/>` +
        `<circle class="berry" cx="${f(bx)}" cy="${f(by)}" r="${f(br)}"/>` +
        `<circle class="shine" cx="${f(bx - br * 0.35)}" cy="${f(by - br * 0.38)}" r="${f(br * 0.24)}"/>`;
    }
    return out;
  }

  // One sprig from (x, y) along dir, bowing towards the inside (normal n).
  function sprig(r, x, y, dir, n, len, opts = {}) {
    const steps = Math.max(8, Math.round(len / 4)), bow = opts.bow ?? 6, pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, off = bow * Math.sin(Math.PI * t * 0.9) + Math.sin(t * 9 + len) * 1.2;
      pts.push([x + dir[0] * len * t + n[0] * off, y + dir[1] * len * t + n[1] * off]);
    }
    let out = `<path class="stem" d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L')}"/>`;
    const gap = opts.gap ?? 15, lsize = opts.leaf ?? 12;
    let side = r() < 0.5 ? 1 : -1;
    for (let d = gap * 0.8; d < len - 6; d += gap * (0.8 + r() * 0.4)) {
      const i = Math.min(steps - 1, Math.round(d / len * steps));
      const p = pts[i], q = pts[i + 1], ta = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const tip = 1 - d / len;
      out += leaf(p[0], p[1], ta + side * (0.7 + r() * 0.35), lsize * (0.6 + 0.45 * tip) * (0.9 + r() * 0.2));
      side = -side;
    }
    const end = pts[steps], pre = pts[steps - 2];
    const ea = Math.atan2(end[1] - pre[1], end[0] - pre[0]);
    const inward = Math.atan2(n[1], n[0]);
    out += berries(r, end[0], end[1], (ea + inward) / 2 + (Math.abs(ea - inward) > Math.PI ? Math.PI : 0), opts.berries ?? 3, opts.berry ?? 4.4);
    if (opts.twig) {
      const i = Math.round(steps * (0.4 + r() * 0.2)), p = pts[i], q = pts[i + 1];
      const ta = Math.atan2(q[1] - p[1], q[0] - p[0]) + (r() < 0.5 ? 0.55 : -0.55);
      const td = [Math.cos(ta), Math.sin(ta)];
      out += sprig(r, p[0], p[1], td, n, len * (0.18 + r() * 0.08), { bow: 2, gap: 11, leaf: lsize * 0.8, berries: 2, berry: (opts.berry ?? 4.4) * 0.9 });
    }
    return out;
  }

  // Frame for a w×h box. m = distance of the stems from the edge.
  function frame(w, h, opts = {}) {
    const r = rng(opts.seed || 1127), m = opts.margin ?? 24, s = opts.scale ?? 1;
    const o = { leaf: 15 * s, gap: 11 * s, berry: 4.4 * s, bow: 8 * s };
    const reach = (edge) => Math.min(opts.maxReach ?? 1e9, Math.max(40, (edge - 2 * m) * (opts.reach ?? 0.4)));
    const corners = [
      [m, m, [1, 0], [0, 1], [0, 1], [1, 0]],
      [w - m, m, [-1, 0], [0, 1], [0, 1], [-1, 0]],
      [m, h - m, [1, 0], [0, -1], [0, -1], [1, 0]],
      [w - m, h - m, [-1, 0], [0, -1], [0, -1], [-1, 0]],
    ];
    let out = '';
    for (const [x, y, hd, hn, vd, vn] of corners) {
      out += sprig(r, x, y, hd, hn, reach(w), { ...o, twig: true, berries: 3 });
      out += sprig(r, x, y, vd, vn, reach(h), { ...o, twig: h > 500, berries: 3 });
      // a bunch of berries in the corner itself
      const ia = Math.atan2(hn[1] + vn[1], hn[0] + vn[0]);
      out += leaf(x, y, ia + 0.9, o.leaf * 1.1) + leaf(x, y, ia - 0.9, o.leaf * 1.1);
      out += berries(r, x, y, ia, 4, o.berry * 1.05);
      // and a short bushy sprig growing diagonally into the card
      const dd = [Math.cos(ia), Math.sin(ia)];
      out += sprig(r, x, y, dd, [-dd[1], dd[0]], 46 * s, { ...o, bow: 4 * s, gap: 9 * s, leaf: o.leaf * 0.9, berries: 3 });
    }
    return `<svg class="lingon" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${out}</svg>`;
  }

  // Stamp with a little glögg mug, w×h, perforated edge.
  function stamp(w, h, label) {
    const holes = [];
    const R = 3.2;
    for (let x = R * 1.5; x < w; x += R * 3) holes.push([x, 0], [x, h]);
    for (let y = R * 1.5; y < h; y += R * 3) holes.push([0, y], [w, y]);
    const cx = w / 2, cy = h * 0.52;
    return `<svg class="stamp" viewBox="-4 -4 ${w + 8} ${h + 8}" aria-hidden="true">
      <defs><mask id="perf"><rect x="-4" y="-4" width="${w + 8}" height="${h + 8}" fill="#fff"/>
      ${holes.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="#000"/>`).join('')}</mask></defs>
      <rect class="stamp-paper" x="0" y="0" width="${w}" height="${h}" mask="url(#perf)"/>
      <rect class="stamp-ink" x="7" y="7" width="${w - 14}" height="${h - 14}" fill="none"/>
      <g transform="translate(${cx - 26} ${cy - 22})">
        <path class="stamp-ink" d="M6 14h34l-3 30q-1 6-7 6H16q-6 0-7-6Z" fill="none"/>
        <path class="glogg" d="M8.2 22h29.6l-1.9 20.6q-0.8 5.4-6 5.4H16.1q-5.2 0-6-5.4Z"/>
        <path class="stamp-ink" d="M39.5 21q9 0 8.5 8.5T38 37.5" fill="none"/>
        <path class="stamp-ink" d="M16 9q-4-4 0-8M23 9q-4-4 0-8M30 9q-4-4 0-8" fill="none"/>
      </g>
      ${leaf(cx + 14, cy + 30, -0.4, 13)}${leaf(cx + 14, cy + 30, 0.6, 11)}
      <circle class="berry" cx="${cx + 31}" cy="${cy + 25}" r="4"/><circle class="berry" cx="${cx + 27}" cy="${cy + 33}" r="3.6"/>
      <text class="stamp-text" x="${cx}" y="${h - 14}" text-anchor="middle">${label}</text>
    </svg>`;
  }

  // Round postmark with wavy cancellation lines to its left.
  function postmark(text, centre) {
    const waves = [0, 1, 2, 3].map(i => {
      let d = `M0 ${20 + i * 9}`;
      for (let x = 0; x <= 90; x += 10) d += `Q${x + 5} ${20 + i * 9 + (x / 10 % 2 ? 4 : -4)} ${x + 10} ${20 + i * 9}`;
      return `<path d="${d}"/>`;
    }).join('');
    return `<svg class="postmark" viewBox="0 0 190 100" aria-hidden="true"><g fill="none">${waves}
      <circle cx="140" cy="50" r="40"/><circle cx="140" cy="50" r="29"/>
      <path id="pmring" d="M108 50a32 32 0 1 1 64 0a32 32 0 1 1 -64 0" stroke="none"/></g>
      <text><textPath href="#pmring" startOffset="2%">${text}</textPath></text>
      <text class="pm-centre" x="140" y="54" text-anchor="middle">${centre}</text></svg>`;
  }

  window.Lingon = { frame, stamp, postmark };
})();
