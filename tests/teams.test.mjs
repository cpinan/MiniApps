/** Repartidor de equipos: lógica pura + navegador. */
import { launch, reporter, sleep } from './lib/cdp.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const { check, done } = reporter();

/* ---------------- lógica pura ---------------- */
import { split } from '../apps/teams/split.js';

const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);
const sizes = (teams) => teams.map(t => t.length).sort((a, b) => a - b);
const flat = (teams) => teams.flat().sort();

let r = split(names(10), { mode: 'teams', amount: 3 });
check('3 equipos con 10 personas quedan 4/3/3', JSON.stringify(sizes(r.teams)) === '[3,3,4]', JSON.stringify(sizes(r.teams)));
check('no se pierde ni se duplica a nadie', JSON.stringify(flat(r.teams)) === JSON.stringify(names(10).sort()));

r = split(names(10), { mode: 'size', amount: 4 });
check('por tamaño 4 con 10 personas salen 3 equipos', r.teams.length === 3, JSON.stringify(sizes(r.teams)));

r = split(names(7), { mode: 'teams', amount: 7 });
check('7 equipos con 7 personas: uno cada uno', sizes(r.teams).every(s => s === 1) && r.teams.length === 7);

r = split(names(3), { mode: 'teams', amount: 9 });
check('más equipos que personas: se recorta y se avisa',
  r.teams.length === 3 && r.warnings.length > 0, JSON.stringify(r.warnings));

r = split(['Ash', 'Misty', 'Brock', 'Gary', 'May', 'Dawn'], { mode: 'teams', amount: 2, captains: ['Ash', 'Gary'] });
const capsSeparated = !r.teams.some(t => t.includes('Ash') && t.includes('Gary'));
check('los capitanes caen en equipos distintos', capsSeparated, JSON.stringify(r.teams));

let apartOk = true;
for (let i = 0; i < 40; i++) {
  const t = split(['A', 'B', 'C', 'D', 'E', 'F'], { mode: 'teams', amount: 3, apart: [['a', 'b']] });
  if (t.teams.some(team => team.includes('A') && team.includes('B'))) apartOk = false;
}
check('"no juntar" se respeta en 40 repartos seguidos', apartOk);

r = split(['A', 'B'], { mode: 'teams', amount: 1, apart: [['a', 'b']] });
check('restricción imposible: reparte igual y avisa',
  r.teams.length === 1 && r.teams[0].length === 2 && r.warnings.length > 0, JSON.stringify(r));

check('lista vacía no revienta', split([], { mode: 'teams', amount: 3 }).teams.length === 0);

// reparto uniforme: con 4 personas y 2 equipos, nadie debería quedar fijo
const together = {};
for (let i = 0; i < 400; i++) {
  const t = split(['A', 'B', 'C', 'D'], { mode: 'teams', amount: 2 });
  const withA = t.teams.find(x => x.includes('A'));
  for (const n of withA) if (n !== 'A') together[n] = (together[n] || 0) + 1;
}
const spread = Math.max(...Object.values(together)) / Math.min(...Object.values(together));
check('el reparto no favorece a nadie (desvío < 1.35x)', spread < 1.35, `ratio ${spread.toFixed(2)}`);

/* ---------------- navegador ---------------- */
const app = await launch({ root: ROOT, port: 9500 });
if (!app) {
  console.log('SKIP  No se encontró Chrome; solo se corrió la lógica pura.');
  process.exit(done() ? 1 : 0);
}

await app.goto('/apps/teams/');
check('la app carga sin errores de consola', app.errors.length === 0, app.errors.join(' | '));

await app.evalJs("document.getElementById('demoBtn').click(); return 1;");
check('la demo carga 12 personas',
  await app.evalJs("return document.getElementById('countBadge').textContent;") === '12');

await app.evalJs("const a = document.getElementById('amount'); a.value = 4; a.dispatchEvent(new Event('change')); return 1;");
await app.clickReal('#splitBtn');
await sleep(700);
const ui = await app.evalJs(`return {
  cards: document.querySelectorAll('.team').length,
  people: [...document.querySelectorAll('.team li')].length,
  summary: document.getElementById('summaryLine').textContent,
  fx: (() => { const f = document.getElementById('fx');
    const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 8) n++; return n; })() };`);
check('salen 4 tarjetas de equipo', ui.cards === 4, JSON.stringify(ui));
check('las 12 personas aparecen repartidas', ui.people === 12, JSON.stringify(ui));
check('el resumen cuenta equipos y personas', /12 personas · 4 equipos/.test(ui.summary), ui.summary);
check('el reparto se celebra con confeti', ui.fx > 0, `píxeles: ${ui.fx}`);

// el color del equipo puede ser casi blanco: el número tiene que seguir leyéndose
const contrast = await app.evalJs(`const lum = (c) => { const m = c.match(/\\d+/g).map(Number);
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const bad = [...document.querySelectorAll('.team h2 .n')].filter(el => {
    const cs = getComputedStyle(el);
    return Math.abs(lum(cs.color) - lum(cs.backgroundColor)) < 60;
  });
  return bad.length;`);
check('el número de cada equipo contrasta con su color', contrast === 0, `ilegibles: ${contrast}`);

const again = await app.evalJs(`const before = [...document.querySelectorAll('.team li')].map(li => li.textContent).join('|');
  document.getElementById('splitBtn').click();
  await new Promise(r => setTimeout(r, 300));
  const after = [...document.querySelectorAll('.team li')].map(li => li.textContent).join('|');
  return { changed: before !== after, count: document.querySelectorAll('.team li').length };`);
check('repartir otra vez baraja de nuevo', again.changed === true);
check('y sigue habiendo 12 personas', again.count === 12);

const cap = await app.evalJs(`document.getElementById('captainsInput').value = 'Ash, Gary';
  document.getElementById('captainsInput').dispatchEvent(new Event('change'));
  const a = document.getElementById('amount'); a.value = 2; a.dispatchEvent(new Event('change'));
  document.getElementById('splitBtn').click();
  await new Promise(r => setTimeout(r, 300));
  const teams = [...document.querySelectorAll('.team')].map(t => [...t.querySelectorAll('li')].map(li => li.textContent));
  return { same: teams.some(t => t.includes('Ash') && t.includes('Gary')),
           marked: document.querySelectorAll('.team li.cap').length };`);
check('en la UI los capitanes van separados', cap.same === false, JSON.stringify(cap));
check('los capitanes salen marcados', cap.marked === 2, JSON.stringify(cap));

const share = await app.evalJs(`document.getElementById('shareBtn').click();
  await new Promise(r => setTimeout(r, 250));
  return location.hash.slice(0, 3);`);
check('el botón de link escribe el estado en la URL', share === '#d=', share);

const reload = await app.evalJs(`const hash = location.hash;
  localStorage.clear();
  location.hash = '';
  location.hash = hash;
  location.reload();
  return 1;`);
await sleep(1400);
check('abrir ese link restaura la lista',
  await app.evalJs("return document.getElementById('countBadge').textContent;") === '12');

await app.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await sleep(400);
const mob = await app.evalJs(`const doc = document.documentElement;
  return { overflow: doc.scrollWidth - doc.clientWidth,
    btn: Math.round(document.getElementById('splitBtn').getBoundingClientRect().height),
    cols: getComputedStyle(document.getElementById('teams')).gridTemplateColumns.split(' ').length };`);
check('móvil: sin scroll horizontal', mob.overflow <= 0, `desborde ${mob.overflow}px`);
check('móvil: el botón de repartir es tocable', mob.btn >= 44, `${mob.btn}px`);
check('móvil: los equipos van en una columna', mob.cols === 1, `columnas: ${mob.cols}`);

app.close();
process.exit(done() ? 1 : 0);
