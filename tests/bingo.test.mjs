/** Bolillero: sorteo sin repetición + navegador. */
import { launch, reporter, sleep } from './lib/cdp.mjs';
import { nextNumber, remaining } from '../apps/bingo/draw.js';

const ROOT = new URL('..', import.meta.url).pathname;
const { check, done } = reporter();

/* ---------------- lógica pura ---------------- */
check('quedan 90 al empezar', remaining(90, []).length === 90);
check('lo ya salido deja de estar disponible', remaining(90, [1, 2, 3]).length === 87);

// una partida completa: 90 extracciones, sin repetir, y salen todos
const drawn = [];
for (let i = 0; i < 90; i++) {
  const n = nextNumber(90, drawn);
  if (n !== null) drawn.push(n);
}
check('una partida saca los 90 números', drawn.length === 90, String(drawn.length));
check('nunca repite', new Set(drawn).size === 90, `únicos: ${new Set(drawn).size}`);
check('salen todos del 1 al 90',
  JSON.stringify([...drawn].sort((a, b) => a - b)) === JSON.stringify(Array.from({ length: 90 }, (_, i) => i + 1)));
check('agotado el bombo devuelve null', nextNumber(90, drawn) === null);
check('un bombo de 1 número funciona', nextNumber(1, []) === 1 && nextNumber(1, [1]) === null);

// uniformidad del primer número
const first = {};
for (let i = 0; i < 6000; i++) { const n = nextNumber(30, []); first[n] = (first[n] || 0) + 1; }
check('el primer número no está sesgado', Object.keys(first).length === 30, `distintos: ${Object.keys(first).length}`);
const spread = Math.max(...Object.values(first)) / Math.min(...Object.values(first));
check('y el reparto es parejo (desvío < 1.5x)', spread < 1.5, `ratio ${spread.toFixed(2)}`);

/* ---------------- navegador ---------------- */
const app = await launch({ root: ROOT, port: 9560 });
if (!app) { console.log('SKIP  No se encontró Chrome.'); process.exit(done() ? 1 : 0); }

await app.goto('/apps/bingo/');
check('la app carga sin errores de consola', app.errors.length === 0, app.errors.join(' | '));
// el enlace de donación vive en la cabecera de todas las apps
const donate = await app.evalJs(`const a = document.querySelector('.donate');
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'),
    aria: a.getAttribute('aria-label'), h: Math.round(r.height), w: Math.round(r.width),
    inHeader: !!a.closest('.topbar') };`);
check('la cabecera lleva enlace de donación',
  !!donate && /DONATE_ES\.md/.test(donate.href) && donate.inHeader, JSON.stringify(donate));
check('el enlace abre fuera y sin filtrar la sesión',
  donate?.target === '_blank' && /noopener/.test(donate?.rel || ''), JSON.stringify(donate));
check('el enlace de donación tiene etiqueta accesible', !!donate?.aria, JSON.stringify(donate));

check('el tablero arranca con 90 casillas',
  await app.evalJs("return document.querySelectorAll('#board i').length;") === 90);

await app.clickReal('#drawBtn');
await sleep(400);
const one = await app.evalJs(`return {
  current: document.getElementById('current').textContent,
  marked: document.querySelectorAll('#board i.out').length,
  badge: document.getElementById('drawnBadge').textContent,
  counter: document.getElementById('counterLine').textContent };`);
check('sacar marca un número en el tablero', one.marked === 1, JSON.stringify(one));
check('la bola muestra ese número', Number(one.current) >= 1 && Number(one.current) <= 90, one.current);
check('el contador baja los que quedan', /1 de 90 · quedan 89/.test(one.counter), one.counter);

const many = await app.evalJs(`for (let i = 0; i < 9; i++) document.getElementById('drawBtn').click();
  await new Promise(r => setTimeout(r, 200));
  const outs = [...document.querySelectorAll('#board i.out')].map(e => Number(e.textContent));
  return { marked: outs.length, unique: new Set(outs).size, last: document.querySelectorAll('.last span').length };`);
check('diez extracciones marcan diez casillas', many.marked === 10, JSON.stringify(many));
check('sin repetir ninguna', many.unique === 10, JSON.stringify(many));
check('se ven los últimos seis', many.last === 6, JSON.stringify(many));

await app.send('Page.navigate', { url: `${app.base}/apps/bingo/` });
await sleep(1200);
check('la partida sobrevive a la recarga',
  await app.evalJs("return document.getElementById('drawnBadge').textContent;") === '10');

await app.clickReal('#resetBtn');
await sleep(300);
check('reiniciar limpia el tablero',
  await app.evalJs("return document.querySelectorAll('#board i.out').length;") === 0);

const small = await app.evalJs(`const r = document.getElementById('range');
  r.value = '30'; r.dispatchEvent(new Event('change'));
  for (let i = 0; i < 30; i++) document.getElementById('drawBtn').click();
  await new Promise(r2 => setTimeout(r2, 400));
  return { cells: document.querySelectorAll('#board i').length,
    out: document.querySelectorAll('#board i.out').length,
    disabled: document.getElementById('drawBtn').disabled,
    status: document.getElementById('statusLine').textContent,
    fx: (() => { const f = document.getElementById('fx');
      const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 8) n++; return n; })() };`);
check('cambiar el rango redibuja el tablero', small.cells === 30, JSON.stringify(small));
check('agotado el bombo se marcan todos', small.out === 30, JSON.stringify(small));
check('y el botón se bloquea', small.disabled === true, JSON.stringify(small));
check('el final se avisa y se celebra', /acabaron/.test(small.status) && small.fx > 0, JSON.stringify(small));

const auto = await app.evalJs(`document.getElementById('resetBtn').click();
  const s = document.getElementById('autoSecs'); s.value = 2; s.dispatchEvent(new Event('input'));
  document.getElementById('auto').checked = true;
  document.getElementById('auto').dispatchEvent(new Event('change'));
  return document.getElementById('statusLine').textContent;`);
check('el modo automático arranca', /Autom/.test(auto), auto);
await sleep(2600);
check('el automático saca solo',
  Number(await app.evalJs("return document.getElementById('drawnBadge').textContent;")) >= 1);
await app.evalJs(`document.getElementById('auto').checked = false;
  document.getElementById('auto').dispatchEvent(new Event('change')); return 1;`);

/* ---------------- móvil ---------------- */
await app.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await sleep(400);
const mob = await app.evalJs(`const doc = document.documentElement;
  const b = document.getElementById('drawBtn').getBoundingClientRect();
  const board = document.getElementById('board').getBoundingClientRect();
  return { overflow: doc.scrollWidth - doc.clientWidth,
    ball: Math.round(b.width), fits: Math.round(board.width) <= window.innerWidth,
    cols: getComputedStyle(document.getElementById('board')).gridTemplateColumns.split(' ').length };`);
check('móvil: sin scroll horizontal', mob.overflow <= 0, `desborde ${mob.overflow}px`);
const donateTap = await app.evalJs(`const r = document.querySelector('.donate').getBoundingClientRect();
  return { h: Math.round(r.height), w: Math.round(r.width) };`);
check('móvil: el enlace de donación es tocable',
  donateTap.h >= 44 && donateTap.w >= 44, JSON.stringify(donateTap));

check('móvil: la bola es grande y tocable', mob.ball >= 44, `${mob.ball}px`);
check('móvil: el tablero cabe a lo ancho', mob.fits === true, JSON.stringify(mob));
check('móvil: el tablero pasa a 8 columnas', mob.cols === 8, `columnas: ${mob.cols}`);

await app.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await sleep(400);
const land = await app.evalJs(`const doc = document.documentElement;
  const b = document.getElementById('drawBtn').getBoundingClientRect();
  return { overflow: doc.scrollWidth - doc.clientWidth, ball: Math.round(b.height), vh: window.innerHeight };`);
check('apaisado: sin scroll horizontal', land.overflow <= 0, `desborde ${land.overflow}px`);
check('apaisado: la bola se encoge para caber', land.ball < land.vh, JSON.stringify(land));

app.close();
process.exit(done() ? 1 : 0);
