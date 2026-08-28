/* Amigo secreto — sorteo con un link por persona, sin servidor. */
import {
  $, parseNames, dedupe, shuffle, storage, escapeHtml,
  currentPalette, applyTheme, initThemePicker, initFx, celebrate, fanfare, blip,
  initShell, THEMES,
} from '../../assets/shared/core.js';

const BUILD = '2026-08-28.1';
const store = storage('secretsanta.v1');
const norm = (s) => s.trim().toLocaleLowerCase('es');

/* ================= sorteo ================= */

// Pares prohibidos, en ambos sentidos: si A no le regala a B, B tampoco a A.
export function parsePairs(raw) {
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const p = parseNames(line);
    if (p.length >= 2) out.push([norm(p[0]), norm(p[1])]);
  }
  return out;
}

const forbidden = (pairs, a, b) =>
  pairs.some(([x, y]) => (x === norm(a) && y === norm(b)) || (x === norm(b) && y === norm(a)));

/**
 * Reparte en un único ciclo: cada uno regala al siguiente y el último al primero.
 * Un ciclo garantiza tres cosas de golpe — nadie se toca a sí mismo, nadie queda
 * fuera, y con 3 o más no hay parejas mutuas (A→B y B→A), que es lo que arruina
 * la gracia del juego.
 */
export function draw(names, pairs = []) {
  const warnings = [];
  if (names.length < 2) return { pairsOut: [], warnings: ['Hacen falta al menos 2 participantes.'] };

  const ok = (order) => order.every((n, i) => !forbidden(pairs, n, order[(i + 1) % order.length]));

  let order = shuffle(names), tries = 0;
  while (pairs.length && !ok(order) && tries < 500) { order = shuffle(names); tries++; }
  if (pairs.length && !ok(order)) {
    warnings.push('No se pudieron respetar todas las exclusiones; este es el mejor intento.');
  }
  const pairsOut = order.map((from, i) => ({ from, to: order[(i + 1) % order.length] }));
  return { pairsOut, warnings };
}

/* ================= links ================= */

const b64 = {
  encode: (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (s) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
  },
};

export const linkFor = (base, from, to, note) =>
  `${base}#p=${b64.encode({ f: from, t: to, n: note || '' })}`;

const baseUrl = () => location.href.split('#')[0];

/* ================= modo organizador ================= */

const state = { assign: [], warnings: [] };

function readNames() {
  let list = parseNames($('namesInput').value);
  if ($('dedupe').checked) list = dedupe(list);
  $('countBadge').textContent = list.length;
  return list;
}

function render() {
  const palette = currentPalette();
  const note = $('noteInput').value.trim();
  $('people').innerHTML = state.assign.map((p, i) => `
    <div class="person" style="--pc:${palette[i % palette.length]};animation-delay:${Math.min(i * 60, 600)}ms">
      <span class="name">${escapeHtml(p.from)}</span>
      <button class="ghost" type="button" data-i="${i}">Copiar link</button>
    </div>`).join('');

  $('privacyNote').hidden = state.assign.length === 0;
  $('summaryLine').textContent = state.assign.length
    ? `${state.assign.length} sobres listos · manda a cada quien el suyo`
    : 'Nadie sorteado todavía.';
  $('statusLine').textContent = state.warnings.length ? state.warnings.join(' ') : 'Listo.';

  $('people').querySelectorAll('button[data-i]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = state.assign[Number(btn.dataset.i)];
      const link = linkFor(baseUrl(), p.from, p.to, note);
      try {
        await navigator.clipboard.writeText(link);
        btn.textContent = '¡Copiado!';
        btn.closest('.person').classList.add('copied');
        $('statusLine').textContent = `Link de ${p.from} copiado. Mándaselo solo a ${p.from}.`;
      } catch {
        $('statusLine').textContent = 'No se pudo copiar; el navegador bloqueó el portapapeles.';
      }
      setTimeout(() => { btn.textContent = 'Copiar link'; }, 1800);
      blip(720, 'triangle', 0.04, 0.05);
    });
  });
}

function doDraw() {
  const names = readNames();
  if (names.length < 2) { $('statusLine').textContent = 'Hacen falta al menos 2 participantes.'; return; }
  const res = draw(names, parsePairs($('apartInput').value));
  state.assign = res.pairsOut;
  state.warnings = res.warnings;
  render();
  save();
  fanfare('round');
  celebrate('round', { x: window.innerWidth / 2, y: window.innerHeight * 0.3 });
}

/* ================= modo sobre ================= */

function openEnvelope(payload) {
  $('organizer').hidden = true;
  $('reveal').hidden = false;
  $('whoLine').textContent = `Sobre de ${payload.f}`;
  document.title = `Amigo secreto de ${payload.f}`;

  const show = () => {
    if (!$('result').hidden) return;
    $('envelope').hidden = true;
    $('result').hidden = false;
    $('revealName').textContent = payload.t;
    $('revealNote').textContent = payload.n || '';
    fanfare('final');
    celebrate('final', { x: window.innerWidth / 2, y: window.innerHeight * 0.35 });
  };

  $('envelope').addEventListener('click', show);
  $('envelope').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
  $('hideBtn').addEventListener('click', () => {
    $('result').hidden = true;
    $('envelope').hidden = false;
  });
}

function readHash() {
  const m = location.hash.match(/p=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    const d = b64.decode(m[1]);
    return (d && d.f && d.t) ? d : null;
  } catch { return null; }
}

/* ================= persistencia ================= */

function save() {
  store.write({
    names: $('namesInput').value, apart: $('apartInput').value, note: $('noteInput').value,
    dedupe: $('dedupe').checked, sound: $('sound').checked,
    theme: document.body.dataset.theme, colors: ['col1', 'col2', 'col3'].map(id => $(id).value),
  });
}

function restore() {
  const c = store.read();
  if (!c) return;
  $('namesInput').value = c.names || '';
  $('apartInput').value = c.apart || '';
  $('noteInput').value = c.note || '';
  $('dedupe').checked = c.dedupe !== false;
  $('sound').checked = c.sound !== false;
  if (Array.isArray(c.colors)) ['col1', 'col2', 'col3'].forEach((id, i) => { if (c.colors[i]) $(id).value = c.colors[i]; });
  if (THEMES.includes(c.theme)) applyTheme(c.theme);
}

/* ================= arranque ================= */

// Pegar un link personal estando ya en la página es solo un cambio de hash: el
// documento no se recarga y la app se quedaba en modo organizador. Recargar es
// lo correcto — cada modo arranca desde cero.
window.addEventListener('hashchange', () => location.reload());

initFx();
initThemePicker({ onChange: () => render(), onSave: save });

const payload = readHash();
if (payload) {
  applyTheme(document.body.dataset.theme);
  openEnvelope(payload);
} else {
  restore();
  applyTheme(document.body.dataset.theme);
  readNames();
  render();

  $('drawBtn').addEventListener('click', doDraw);
  $('demoBtn').addEventListener('click', () => {
    $('namesInput').value = 'Ash, Misty, Brock, Gary, Serena, Clemont';
    readNames(); save();
    $('statusLine').textContent = '6 participantes de ejemplo cargados.';
  });
  $('clearBtn').addEventListener('click', () => {
    $('namesInput').value = ''; state.assign = []; state.warnings = [];
    readNames(); render(); save();
    $('statusLine').textContent = 'Lista vacía.';
  });
  ['namesInput', 'apartInput', 'noteInput', 'dedupe', 'sound'].forEach(id =>
    $(id).addEventListener('change', () => { readNames(); save(); }));
}

initShell({ build: BUILD, name: 'Amigo secreto' });
