/* Repartidor de equipos — reparte una lista en equipos equilibrados. */
import {
  $, parseNames, dedupe, shuffle, randomInt, storage, escapeHtml,
  currentPalette, applyTheme, initThemePicker, initFx, celebrate, fanfare, blip,
  initShell, THEMES,
} from '../../assets/shared/core.js';

const BUILD = '2026-08-28.1';
const store = storage('teams.v1');

/* ================= reparto ================= */

const norm = (s) => s.trim().toLocaleLowerCase('es');

// Parejas que no pueden coincidir: una por línea, "A, B".
function parseApart(raw) {
  return String(raw || '').split(/\r?\n/)
    .map(line => parseNames(line))
    .filter(pair => pair.length >= 2)
    .map(pair => [norm(pair[0]), norm(pair[1])]);
}

function violates(teams, apart) {
  for (const [a, b] of apart) {
    for (const team of teams) {
      const set = team.map(norm);
      if (set.includes(a) && set.includes(b)) return true;
    }
  }
  return false;
}

function deal(names, teamCount, captains, balance) {
  const teams = Array.from({ length: teamCount }, () => []);
  const capSet = new Set(captains.map(norm));

  // Un capitán por equipo, repartidos al azar; los que sobren van al montón común.
  const caps = shuffle(names.filter(n => capSet.has(norm(n)))).slice(0, teamCount);
  caps.forEach((c, i) => teams[i].push(c));

  const capsUsed = new Set(caps.map(norm));
  const rest = shuffle(names.filter(n => !capsUsed.has(norm(n))));

  if (balance) {
    // Round-robin desde el equipo más pequeño: el sobrante se reparte uno a uno.
    let i = 0;
    for (const n of rest) {
      const order = teams.map((t, idx) => ({ idx, len: t.length }))
        .sort((a, b) => a.len - b.len || a.idx - b.idx);
      teams[order[0].idx].push(n);
      i++;
    }
  } else {
    const per = Math.ceil(rest.length / teamCount);
    rest.forEach((n, i) => teams[Math.min(teamCount - 1, Math.floor(i / per))].push(n));
  }
  return teams;
}

/**
 * Reparte respetando las restricciones. Si las parejas "no juntar" son
 * imposibles (o casi), reintenta y al final devuelve el mejor intento con aviso:
 * más vale repartir y avisar que quedarse sin repartir.
 */
export function split(names, opts) {
  const { mode = 'teams', amount = 2, balance = true, captains = [], apart = [] } = opts || {};
  const warnings = [];
  if (!names.length) return { teams: [], warnings: ['No hay nadie en la lista.'] };

  let teamCount = mode === 'size'
    ? Math.max(1, Math.ceil(names.length / Math.max(1, amount)))
    : Math.max(1, Math.min(amount, names.length));

  if (mode === 'teams' && amount > names.length) {
    warnings.push(`Solo hay ${names.length} personas: se hacen ${teamCount} equipos.`);
  }

  let teams = deal(names, teamCount, captains, balance);
  if (apart.length) {
    let tries = 0;
    while (violates(teams, apart) && tries < 300) { teams = deal(names, teamCount, captains, balance); tries++; }
    if (violates(teams, apart)) {
      warnings.push('No se pudieron respetar todas las parejas separadas; este es el mejor intento.');
    }
  }
  return { teams, warnings };
}

/* ================= estado y UI ================= */

const state = { names: [], teams: [], warnings: [] };

const amount = () => Math.max(1, parseInt($('amount').value, 10) || 2);
const captainsList = () => parseNames($('captainsInput').value);

function readNames() {
  let list = parseNames($('namesInput').value);
  if ($('dedupe').checked) list = dedupe(list);
  state.names = list;
  $('countBadge').textContent = list.length;
  return list;
}

function render() {
  const box = $('teams');
  const palette = currentPalette();
  const capSet = new Set(captainsList().map(norm));

  box.innerHTML = state.teams.map((team, i) => `
    <div class="team" style="--tc:${palette[i % palette.length]};animation-delay:${Math.min(i * 70, 700)}ms">
      <h2>Equipo ${i + 1} <span class="n">${team.length}</span></h2>
      <ol>${team.map(n => `<li class="${capSet.has(norm(n)) ? 'cap' : ''}">${escapeHtml(n)}</li>`).join('')}</ol>
    </div>`).join('');

  const sizes = state.teams.map(t => t.length);
  $('summaryLine').textContent = state.teams.length
    ? `${state.names.length} personas · ${state.teams.length} equipos · ${Math.min(...sizes)}–${Math.max(...sizes)} por equipo`
    : 'Sin reparto todavía.';

  $('statusLine').textContent = state.warnings.length ? state.warnings.join(' ') : 'Listo.';
}

function doSplit() {
  const names = readNames();
  if (!names.length) { $('statusLine').textContent = 'Pega primero una lista de personas.'; return; }

  const result = split(names, {
    mode: $('mode').value,
    amount: amount(),
    balance: $('balance').checked,
    captains: captainsList(),
    apart: parseApart($('apartInput').value),
  });
  state.teams = result.teams;
  state.warnings = result.warnings;
  render();
  save();

  blip(660, 'square', 0.05, 0.08);
  fanfare('round');
  celebrate('round', { x: window.innerWidth / 2, y: window.innerHeight * 0.3 });
}

const asText = () => state.teams
  .map((t, i) => `Equipo ${i + 1} (${t.length})\n${t.map(n => `  - ${n}`).join('\n')}`)
  .join('\n\n');

/* ================= link compartible ================= */

const b64 = {
  encode: (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (s) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
  },
};

function shareLink() {
  const payload = {
    n: $('namesInput').value, m: $('mode').value, a: amount(),
    c: $('captainsInput').value, x: $('apartInput').value,
  };
  const url = new URL(location.href);
  url.hash = 'd=' + b64.encode(payload);
  return url.toString();
}

function loadFromHash() {
  const m = location.hash.match(/d=([A-Za-z0-9\-_]+)/);
  if (!m) return false;
  try {
    const d = b64.decode(m[1]);
    $('namesInput').value = d.n || '';
    if (d.m) $('mode').value = d.m;
    if (d.a) $('amount').value = d.a;
    $('captainsInput').value = d.c || '';
    $('apartInput').value = d.x || '';
    readNames();
    return true;
  } catch { return false; }
}

/* ================= persistencia ================= */

function save() {
  store.write({
    names: $('namesInput').value, mode: $('mode').value, amount: $('amount').value,
    balance: $('balance').checked, dedupe: $('dedupe').checked, sound: $('sound').checked,
    captains: $('captainsInput').value, apart: $('apartInput').value,
    theme: document.body.dataset.theme, colors: ['col1', 'col2', 'col3'].map(id => $(id).value),
  });
}

function restore() {
  const c = store.read();
  if (!c) return;
  $('namesInput').value = c.names || '';
  if (c.mode) $('mode').value = c.mode;
  if (c.amount) $('amount').value = c.amount;
  $('balance').checked = c.balance !== false;
  $('dedupe').checked = c.dedupe !== false;
  $('sound').checked = c.sound !== false;
  $('captainsInput').value = c.captains || '';
  $('apartInput').value = c.apart || '';
  if (Array.isArray(c.colors)) ['col1', 'col2', 'col3'].forEach((id, i) => { if (c.colors[i]) $(id).value = c.colors[i]; });
  if (THEMES.includes(c.theme)) applyTheme(c.theme);
}

/* ================= eventos ================= */

$('splitBtn').addEventListener('click', doSplit);
$('demoBtn').addEventListener('click', () => {
  $('namesInput').value = 'Ash, Misty, Brock, Gary, Serena, Clemont, Bonnie, May, Dawn, Iris, Cynthia, Steven';
  readNames(); save();
  $('statusLine').textContent = '12 personas de ejemplo cargadas.';
});
$('clearBtn').addEventListener('click', () => {
  $('namesInput').value = ''; state.teams = []; state.warnings = [];
  readNames(); render(); save();
  $('statusLine').textContent = 'Lista vacía.';
});
$('copyBtn').addEventListener('click', async () => {
  if (!state.teams.length) { $('statusLine').textContent = 'Todavía no hay reparto que copiar.'; return; }
  try { await navigator.clipboard.writeText(asText()); $('statusLine').textContent = 'Equipos copiados.'; }
  catch { $('statusLine').textContent = 'No se pudo copiar (permiso del navegador).'; }
});
$('shareBtn').addEventListener('click', async () => {
  const link = shareLink();
  location.hash = link.split('#')[1] || '';
  try { await navigator.clipboard.writeText(link); $('statusLine').textContent = 'Link copiado: lleva la lista y la configuración.'; }
  catch { $('statusLine').textContent = 'Link puesto en la barra de direcciones.'; }
});
$('mode').addEventListener('change', () => {
  $('amountLabel').textContent = $('mode').value === 'teams' ? 'Cuántos equipos' : 'Personas por equipo';
  save();
});
['amount', 'balance', 'dedupe', 'sound', 'captainsInput', 'apartInput', 'namesInput'].forEach(id =>
  $(id).addEventListener('change', () => { readNames(); save(); }));
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) {
    e.preventDefault(); doSplit();
  }
});

/* ================= arranque ================= */

initFx();
initThemePicker({ onChange: () => render(), onSave: save });
restore();
if (loadFromHash()) $('statusLine').textContent = 'Lista cargada desde el link. Pulsa Repartir.';
applyTheme(document.body.dataset.theme);
readNames();
render();
initShell({ build: BUILD, name: 'Equipos' });
