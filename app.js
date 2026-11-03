// The personal reply page. The link is …/glogg/?g=<name>-<code> (Swedish) or …/glogg/en/?g=… (English).
// Names and answers live in the Google Sheet; API is its Apps Script web app. Without API the page
// keeps answers in this browser only (for trying the page out locally).
const API = '';

const EVENT = { start: '20261127T180000', end: '20261127T220000' };
const T = {
  sv: {
    label: 'Brevkort', hi: (n) => n ? `Hej ${n}!` : 'Hej!',
    msg: 'Välkommen på glögg efter jobbet, fredagen före första advent. Det blir varm glögg, pepparkakor och levande ljus i mörkret – det vore så roligt om du kom!',
    sign: 'Kram, Sandra',
    rows: [['Datum', 'fredag 27 november'], ['Tid', 'från 18.00'], ['Plats', 'Hagagatan 50A, Stockholm'], ['OSA', 'senast fredag 20 november']],
    yes: 'Ja, jag kommer!', no: 'Nej, jag kan tyvärr inte',
    saidYes: 'Vad roligt! Vi ses den 27:e. Portkoden får du på dagen.', saidNo: 'Tråkigt! Tack för att du svarade.',
    change: 'Du kan ändra ditt svar när du vill.',
    note: 'Vill du skriva något till Sandra? (valfritt)', send: 'Skicka', sent: 'Tack, Sandra har fått det.',
    cal: 'Lägg in i kalendern', calTitle: 'Glögg hos Sandra',
    error: 'Det gick inte att spara. Försök igen om en stund.',
    unknown: 'Den här länken känns inte igen. Använd länken du fick av Sandra.',
    other: 'In English', stamp: 'SVERIGE',
  },
  en: {
    label: 'Postcard', hi: (n) => n ? `Hi ${n}!` : 'Hi!',
    msg: 'You’re invited to glögg (Swedish mulled wine) after work, on the Friday before the first of Advent. There’ll be warm glögg, gingerbread and candlelight in the dark – I’d love for you to come!',
    sign: 'Love, Sandra',
    rows: [['Date', 'Friday 27 November'], ['Time', 'from 6 pm'], ['Place', 'Hagagatan 50A, Stockholm'], ['RSVP', 'by Friday 20 November']],
    yes: 'Yes, I’m coming!', no: 'Sorry, I can’t make it',
    saidYes: 'How lovely! See you on the 27th. You’ll get the door code on the day.', saidNo: 'What a shame! Thanks for letting me know.',
    change: 'You can change your answer any time.',
    note: 'Anything you’d like to tell Sandra? (optional)', send: 'Send', sent: 'Thanks, Sandra has got it.',
    cal: 'Add to calendar', calTitle: 'Glögg at Sandra’s',
    error: 'Couldn’t save that. Please try again in a moment.',
    unknown: 'This link isn’t recognised. Please use the link Sandra sent you.',
    other: 'På svenska', stamp: 'SVERIGE',
  },
};

const lang = document.documentElement.lang === 'en' ? 'en' : 'sv';
const t = T[lang];
const slug = new URLSearchParams(location.search).get('g') || '';
const code = slug.split('-').pop().toLowerCase();
// First paint uses the name in the link; the sheet's spelling (å, ä, ö) replaces it when it arrives.
const guess = slug.includes('-') ? slug.slice(0, slug.lastIndexOf('-')).split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-') : '';
const state = { name: guess, answer: '', note: '', busy: false, msg: '' };

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tick = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 21 C11 24 14 28 16 32 C21 21 27 12 35 5"/></svg>';

function render() {
  const app = document.getElementById('app');
  const known = !!slug;
  app.innerHTML = `
    <header class="printed">${t.label}</header>
    <div class="post">${Lingon.postmark('STOCKHOLM · 27 NOV 2026 · ', '★')}${Lingon.stamp(96, 114, t.stamp)}</div>
    <section class="left hand">
      <h1>${esc(t.hi(state.name))}</h1>
      <p>${t.msg}</p>
      <p class="sign">${t.sign}</p>
    </section>
    <section class="right">
      <dl>${t.rows.map(([k, v]) => `<div class="rule"><dt class="printed">${k}</dt><dd class="hand">${v}</dd></div>`).join('')}</dl>
      ${known ? `
      <div class="ticks" role="radiogroup">
        ${['yes', 'no'].map(a => `<button class="tick hand${state.answer === a ? ' on' : ''}" role="radio" aria-checked="${state.answer === a}"
          data-a="${a}" ${state.busy ? 'disabled' : ''}><span class="box">${tick}</span>${t[a]}</button>`).join('')}
      </div>
      <p class="said hand" aria-live="polite">${state.msg || (state.answer === 'yes' ? t.saidYes : state.answer === 'no' ? t.saidNo : '')}</p>
      ${state.answer ? `
        ${state.answer === 'yes' ? `<a class="link printed-link" id="cal" href="#">▸ ${t.cal}</a>` : ''}
        <form class="note" id="note"><textarea class="hand rule" rows="2" maxlength="500" placeholder="${t.note}">${esc(state.note)}</textarea>
          <button class="link printed-link" ${state.busy ? 'disabled' : ''}>▸ ${t.send}</button></form>
        <p class="hint">${t.change}</p>` : ''}
      ` : `<p class="said hand">${t.unknown}</p>`}
    </section>
    <footer><a class="link printed-link" href="${lang === 'en' ? '../' : 'en/'}${location.search}">▸ ${t.other}</a></footer>`;
  drawFrame();
  app.querySelectorAll('.tick').forEach(b => b.onclick = () => answer(b.dataset.a));
  const note = document.getElementById('note');
  if (note) note.onsubmit = (e) => { e.preventDefault(); sendNote(note.querySelector('textarea').value); };
  const cal = document.getElementById('cal');
  if (cal) cal.onclick = (e) => { e.preventDefault(); calendar(); };
}

function drawFrame() {
  const sheet = document.getElementById('sheet');
  const w = sheet.clientWidth, h = sheet.clientHeight, small = w < 600;
  const old = sheet.querySelector(':scope > .lingon');
  if (old && old.dataset.size === `${w}x${h}`) return;
  const box = document.createElement('div');
  box.innerHTML = Lingon.frame(w, h, { margin: small ? 14 : 26, scale: small ? 0.72 : 1.1, reach: small ? 0.36 : 0.36, maxReach: small ? 230 : 1e9 });
  const svg = box.firstChild;
  svg.dataset.size = `${w}x${h}`;
  if (old) old.replaceWith(svg); else sheet.prepend(svg);
}

async function call(params) {
  if (!API) {
    const key = 'glogg:' + code, saved = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(saved, params.r ? { answer: params.r } : {}, params.m !== undefined ? { note: params.m } : {});
    localStorage.setItem(key, JSON.stringify(saved));
    return { ok: true, name: guess, answer: saved.answer || '', note: saved.note || '' };
  }
  const q = new URLSearchParams({ g: slug, ...params });
  const res = await fetch(`${API}?${q}`);
  return res.json();
}

function apply(d) {
  if (!d.ok) { state.msg = d.error === 'unknown' ? t.unknown : t.error; return; }
  Object.assign(state, { name: d.name || state.name, answer: d.answer || '', note: d.note || '', msg: '' });
}

async function answer(a) {
  if (state.busy || a === state.answer) return;
  const before = state.answer;
  Object.assign(state, { answer: a, busy: true, msg: '' });
  render();
  try { apply(await call({ r: a })); } catch { state.answer = before; state.msg = t.error; }
  state.busy = false;
  render();
}

async function sendNote(text) {
  state.busy = true; render();
  try { apply(await call({ m: text.trim() })); state.msg = state.msg || t.sent; } catch { state.msg = t.error; }
  state.busy = false; render();
}

function calendar() {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sandra//Glogg//SV', 'BEGIN:VEVENT',
    `UID:glogg-2026-${code}@sandra`, `DTSTAMP:20261101T000000Z`, `DTSTART:${EVENT.start}`, `DTEND:${EVENT.end}`,
    `SUMMARY:${t.calTitle}`, `LOCATION:Hagagatan 50A\\, Stockholm`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'glogg.ics';
  a.click();
}

render();
new ResizeObserver(drawFrame).observe(document.getElementById('sheet'));
document.fonts.ready.then(drawFrame);
if (slug) call({}).then(d => { apply(d); render(); }).catch(() => {});
