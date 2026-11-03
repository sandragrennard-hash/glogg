// The personal reply page: the invite card (site/card.html) with two RSVP buttons. "Ja" opens the
// second side of the card with the address, door code and a calendar link. Each guest has their own
// copy at …/glogg/t/<name>-<code>/ (made by tools/build_cards.py, with their card as the link
// preview); …/glogg/?g=<name>-<code> and …/glogg/en/?g=… also work.
// Names and answers live in the Google Sheet; API is its Apps Script web app, which hands out the
// door code only to guests who have said yes. Without API the page keeps answers in this browser.
const API = 'https://script.google.com/macros/s/AKfycbzq9BSsHxZs75XvONxqytS1da_rezUmx9V-U6BnQAuQjEaupzPpaZvo91zQ26lNmsfk/exec';

const EVENT = { start: '20261127T180000', end: '20261127T220000', address: 'Hagagatan 50A, Stockholm' };
const T = {
  sv: {
    to: 'Till', you: 'dig ♡', msg: 'Välkommen på <span class="nw">glögg-AW!</span>', when: 'Fredag 27 nov 18.00',
    osa: 'OSA senast 20 nov', yes: 'Ja, jag kommer!', no: 'Nej, tyvärr',
    saidNo: 'Tråkigt! Tack för att du svarade.',
    more: 'Adress och portkod', address: 'Adress', door: 'Portkod', map: 'Visa på karta',
    cal: 'Lägg till i kalendern', calTitle: 'Glögg-AW hos Sandra', change: 'Ändra svar',
    error: 'Det gick inte att spara. Försök igen om en stund.',
    unknown: 'Den här länken känns inte igen. Använd länken du fick av Sandra.',
    other: 'In English',
  },
  en: {
    to: 'To', you: 'you ♡', msg: 'Welcome to glögg after work!', when: 'Friday 27 Nov 6 pm',
    osa: 'RSVP by 20 Nov', yes: 'Yes, I’m coming!', no: 'Sorry, I can’t',
    saidNo: 'What a shame! Thanks for letting me know.',
    more: 'Address and door code', address: 'Address', door: 'Door code', map: 'Show on map',
    cal: 'Add to calendar', calTitle: 'Glögg after work at Sandra’s', change: 'Change answer',
    error: 'Couldn’t save that. Please try again in a moment.',
    unknown: 'This link isn’t recognised. Please use the link Sandra sent you.',
    other: 'På svenska',
  },
};

let lang = document.documentElement.lang === 'en' ? 'en' : 'sv';
let t = T[lang];
const slug = new URLSearchParams(location.search).get('g') || (location.pathname.match(/\/t\/([^/]+)\/?$/) || [])[1] || '';
const code = slug.split('-').pop().toLowerCase();
// First paint uses the name in the link; the sheet's spelling (å, ä, ö) replaces it when it arrives.
const guess = slug.includes('-') ? slug.slice(0, slug.lastIndexOf('-')).split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-') : '';
// view: 'card' (the invite with the buttons) or 'yes' (address and door code); fresh: the guest has
// just tapped "Ja", so the yes side opens with the tick being written.
const state = { name: guess, answer: '', door: '', busy: false, msg: '', view: 'card', fresh: false };

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tick = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 21 C11 24 14 28 16 32 C21 21 27 12 35 5"/></svg>';
// The "you're coming" mark on the yes side: a tick that writes itself, then a lingonberry on its tip.
const okMark = `<svg class="okmark" viewBox="0 0 140 110" role="img" aria-label="✓">
  <path class="ok-stroke" pathLength="100" d="M12 62 C19 64 27 72 35 84 C38 89 41 92 44 93 C56 64 76 37 104 20 C108 17 111 15 114 14"/>
  <g class="ok-berry">
    <path class="ok-leaf" d="M117 13 C121 3 131 0 136 2 C134 9 126 15 117 13 Z"/>
    <path class="ok-rib" d="M118 12 C123 8 128 5 133 3"/>
    <circle class="ok-fruit" cx="118" cy="20" r="8.5"/>
    <circle class="ok-shine" cx="115" cy="17" r="2.2"/>
  </g>
</svg>`;

function render() {
  const app = document.getElementById('app');
  const to = slug ? (state.name ? `${t.to}: ${esc(state.name)}` : `${t.to}:`) : `${t.to}: ${t.you}`;
  const top = `<div class="top"><div class="line hand fit">${to}</div><div class="post">${Lingon.stamp(112, 132, 'SVERIGE')}</div></div>`;
  const from = `<div class="from hand">Sandra ♡</div>`;
  if (state.view === 'yes') {
    app.innerHTML = `${top}
      <div class="body hand">
        ${state.fresh ? okMark : ''}
        <dl>
          <div><dt class="printed">${t.address}</dt><dd>${EVENT.address}
            <a class="small" href="https://maps.google.com/?q=${encodeURIComponent(EVENT.address)}" target="_blank" rel="noopener">${t.map} ▸</a></dd></div>
          <div><dt class="printed">${t.door}</dt><dd class="door">${esc(state.door) || '…'}</dd></div>
        </dl>
        <button class="rsvp cal" id="cal">${t.cal}</button>
        <a class="small change" href="#" id="change">${t.change}</a>
      </div>${from}`;
  } else {
    app.innerHTML = `${top}
      <div class="body hand">
        <p>${t.msg}</p>
        <p class="when fit">${t.when}</p>
        <p class="osa">${t.osa}</p>
        ${slug ? `<div class="buttons" role="radiogroup">
          ${['yes', 'no'].map(a => `<button class="rsvp${state.answer === a ? ' on' : ''}" role="radio" aria-checked="${state.answer === a}"
            data-a="${a}" ${state.busy ? 'disabled' : ''}><span class="box">${tick}</span>${t[a]}</button>`).join('')}
        </div>
        <p class="said" aria-live="polite">${state.msg || (state.answer === 'no' ? t.saidNo : '')}</p>
        ${state.answer === 'yes' && !state.busy ? `<a class="small more" href="#" id="more">${t.more} ▸</a>` : ''}`
        : `<p class="said">${t.unknown}</p>`}
      </div>${from}`;
  }
  document.getElementById('lang').innerHTML = `<a href="#" id="other">▸ ${t.other}</a>`;
  fit();
  drawFrame();
  app.querySelectorAll('.rsvp[data-a]').forEach(b => b.onclick = () => answer(b.dataset.a));
  const cal = document.getElementById('cal');
  if (cal) cal.onclick = calendar;
  const more = document.getElementById('more');
  if (more) more.onclick = (e) => { e.preventDefault(); state.fresh = false; show('yes'); };
  const change = document.getElementById('change');
  if (change) change.onclick = (e) => { e.preventDefault(); show('card'); };
  document.getElementById('other').onclick = (e) => {
    e.preventDefault();
    lang = lang === 'en' ? 'sv' : 'en'; t = T[lang]; document.documentElement.lang = lang;
    render();
  };
}

function show(view) {
  state.view = view;
  render();
  window.scrollTo(0, 0);
}

// One row each: shrink a line that doesn't fit (a long name) rather than wrap it.
function fit() {
  document.querySelectorAll('#app .fit').forEach(e => {
    e.style.fontSize = '';
    let size = parseFloat(getComputedStyle(e).fontSize);
    while (e.scrollWidth > e.clientWidth + 1 && size > 12) e.style.fontSize = `${size -= 1}px`;
  });
}

// The frame scales with the card, like the 1080 px wide invite (margin 40, scale 2).
function drawFrame() {
  const sheet = document.getElementById('sheet');
  const w = sheet.clientWidth, h = sheet.clientHeight, k = w / 1080;
  const old = sheet.querySelector(':scope > .lingon');
  if (old && old.dataset.size === `${w}x${h}`) return;
  const box = document.createElement('div');
  box.innerHTML = Lingon.frame(w, h, { margin: 40 * k, scale: 2 * k, reach: 0.36, maxReach: 0.36 * w });
  const svg = box.firstChild;
  svg.dataset.size = `${w}x${h}`;
  if (old) old.replaceWith(svg); else sheet.prepend(svg);
  const inset = `${Number(svg.dataset.depth) + Math.round(26 * k)}px`;
  if (sheet.style.getPropertyValue('--inset') !== inset) sheet.style.setProperty('--inset', inset);
}

async function call(params) {
  if (!API) {
    const key = 'glogg:' + code, saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (params.r) saved.answer = params.r;
    localStorage.setItem(key, JSON.stringify(saved));
    return { ok: true, name: guess, answer: saved.answer || '', door: saved.answer === 'yes' ? '0000' : '' };
  }
  const q = new URLSearchParams({ g: slug, ...params });
  const res = await fetch(`${API}?${q}`);
  return res.json();
}

function apply(d) {
  if (!d.ok) { state.msg = d.error === 'unknown' ? t.unknown : t.error; return; }
  Object.assign(state, { name: d.name || state.name, answer: d.answer || '', door: d.door || '', msg: '' });
}

async function answer(a) {
  if (state.busy) return;
  if (a === state.answer) { if (a === 'yes') { state.fresh = true; show('yes'); } return; }
  const before = state.answer;
  Object.assign(state, { answer: a, busy: true, msg: '' });
  render();
  try {
    apply(await call({ r: a }));
    state.busy = false;
    if (state.answer === 'yes') { state.fresh = true; show('yes'); return; }
  } catch { state.answer = before; state.msg = t.error; }
  state.busy = false;
  render();
}

function calendar() {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sandra//Glogg//SV', 'BEGIN:VEVENT',
    `UID:glogg-2026-${code}@sandra`, `DTSTAMP:20261101T000000Z`, `DTSTART:${EVENT.start}`, `DTEND:${EVENT.end}`,
    `SUMMARY:${t.calTitle}`, `LOCATION:${EVENT.address.replace(',', '\\,')}`,
    `DESCRIPTION:${t.door}: ${state.door}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'glogg-aw.ics';
  a.click();
}

const nav = document.createElement('nav');
nav.id = 'lang';
document.body.append(nav);
render();
new ResizeObserver(() => { fit(); drawFrame(); }).observe(document.getElementById('sheet'));
document.fonts.ready.then(() => { fit(); drawFrame(); });
if (slug) call({}).then(d => { apply(d); render(); }).catch(() => {});
