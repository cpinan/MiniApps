/** Tabla de tipos: exactitud de los datos + navegador. */
import { launch, reporter, sleep } from './lib/cdp.mjs';
import { TYPES, ATTACK, multiplier, offense, defense } from '../apps/typechart/types.js';

const ROOT = new URL('..', import.meta.url).pathname;
const { check, done } = reporter();

/* ---------------- los datos ---------------- */
check('hay 18 tipos', TYPES.length === 18, String(TYPES.length));
check('todos los tipos tienen fila de ataque', TYPES.every(t => ATTACK[t]), 
  TYPES.filter(t => !ATTACK[t]).join(','));

const badKeys = [];
for (const a of TYPES) for (const d of Object.keys(ATTACK[a])) if (!TYPES.includes(d)) badKeys.push(`${a}->${d}`);
check('ninguna entrada apunta a un tipo inexistente', badKeys.length === 0, badKeys.join(', '));

const badVals = [];
for (const a of TYPES) for (const [d, v] of Object.entries(ATTACK[a])) {
  if (![0, 0.5, 2].includes(v)) badVals.push(`${a}->${d}=${v}`);
}
check('los multiplicadores solo son 0, ½ o 2', badVals.length === 0, badVals.join(', '));

// casos que todo jugador conoce de memoria: si alguno falla, la tabla está mal
const known = [
  ['normal', ['fantasma'], 0], ['lucha', ['fantasma'], 0], ['tierra', ['volador'], 0],
  ['electrico', ['tierra'], 0], ['veneno', ['acero'], 0], ['psiquico', ['siniestro'], 0],
  ['dragon', ['hada'], 0], ['fuego', ['planta'], 2], ['agua', ['fuego'], 2],
  ['planta', ['agua'], 2], ['hielo', ['dragon'], 2], ['lucha', ['acero'], 2],
  ['hada', ['dragon'], 2], ['acero', ['hada'], 2], ['fuego', ['agua'], 0.5],
  ['bicho', ['fuego'], 0.5], ['roca', ['lucha'], 0.5],
];
const wrong = known.filter(([a, d, exp]) => multiplier(a, d) !== exp).map(([a, d, e]) => `${a}->${d}: ${multiplier(a, d)} != ${e}`);
check('17 relaciones conocidas son correctas', wrong.length === 0, wrong.join(' | '));

// tipos duales
const dual = [
  ['roca', ['fuego', 'volador'], 4], ['electrico', ['agua', 'volador'], 4],
  ['hielo', ['dragon', 'volador'], 4], ['tierra', ['acero', 'volador'], 0],
  ['lucha', ['acero', 'hada'], 1], ['fuego', ['acero', 'bicho'], 4],
  ['agua', ['tierra', 'roca'], 4], ['normal', ['fantasma', 'volador'], 0],
];
const dwrong = dual.filter(([a, d, exp]) => multiplier(a, d) !== exp).map(([a, d, e]) => `${a}->${d.join('/')}: ${multiplier(a, d)} != ${e}`);
check('los tipos duales multiplican bien', dwrong.length === 0, dwrong.join(' | '));

check('cada tipo recibe algo de los 18 al defender',
  TYPES.every(t => Object.values(defense([t])).flat().length === 18));
check('ofensiva: fuego pega doble a 4 tipos',
  (offense('fuego')[2] || []).length === 4, JSON.stringify(offense('fuego')[2]));
check('acero es el mejor defensor (más resistencias)',
  TYPES.map(t => ({ t, r: Object.entries(defense([t])).filter(([m]) => Number(m) < 1).flatMap(([, v]) => v).length }))
    .sort((a, b) => b.r - a.r)[0].t === 'acero');

/* ---------------- navegador ---------------- */
const app = await launch({ root: ROOT, port: 9540 });
if (!app) { console.log('SKIP  No se encontró Chrome.'); process.exit(done() ? 1 : 0); }

await app.goto('/apps/typechart/');
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

check('salen los 18 tipos para elegir',
  await app.evalJs("return document.querySelectorAll('#picker .type').length;") === 18);

await app.evalJs("document.querySelector('[data-t=fuego]').click(); return 1;");
await sleep(200);
const atk = await app.evalJs(`const b = [...document.querySelectorAll('.bucket')];
  return { buckets: b.length, dobles: [...b[0].querySelectorAll('.chip')].map(c => c.textContent).sort().join(',') };`);
check('modo atacar: tres bloques (x2, x½, x0)', atk.buckets === 3, JSON.stringify(atk));
check('fuego pega doble a planta, hielo, bicho y acero',
  atk.dobles === 'Acero,Bicho,Hielo,Planta', atk.dobles);

await app.clickReal('#tabDef');
await sleep(250);
check('al cambiar de modo se conserva el tipo elegido',
  await app.evalJs("return document.querySelectorAll('#picker .type.is-on').length;") === 1);
await app.clickReal('#clearTypes');
await sleep(200);
await app.evalJs("document.querySelector('[data-t=fuego]').click(); document.querySelector('[data-t=volador]').click(); return 1;");
await sleep(250);
const def = await app.evalJs(`const heads = [...document.querySelectorAll('.bucket h2')].map(h => h.textContent.trim());
  const x4 = [...document.querySelectorAll('.bucket')].find(b => /× 4/.test(b.textContent));
  return { heads, x4: x4 ? [...x4.querySelectorAll('.chip')].map(c => c.textContent).join(',') : null,
    picked: document.querySelectorAll('#picker .type.is-on').length };`);
check('modo defender acepta dos tipos', def.picked === 2, JSON.stringify(def));
check('fuego/volador recibe ×4 de roca', def.x4 === 'Roca', JSON.stringify(def));

await app.evalJs("document.querySelector('[data-t=agua]').click(); return 1;");
await sleep(200);
check('al marcar un tercer tipo se suelta el más viejo',
  await app.evalJs("return document.querySelectorAll('#picker .type.is-on').length;") === 2);

await app.clickReal('#tabAll');
await sleep(300);
const mat = await app.evalJs(`const t = document.querySelector('table.matrix');
  return { rows: t.querySelectorAll('tbody tr').length,
    cols: t.querySelectorAll('thead th').length - 1,
    cells: t.querySelectorAll('tbody td').length,
    pickerHidden: document.getElementById('picker').hidden };`);
check('la matriz es de 18×18', mat.rows === 18 && mat.cols === 18 && mat.cells === 324, JSON.stringify(mat));
check('en modo matriz se esconde el selector', mat.pickerHidden === true);

await app.send('Page.navigate', { url: `${app.base}/apps/typechart/` });
await sleep(1200);
check('la app recuerda el modo y la selección',
  await app.evalJs("return document.getElementById('tabAll').classList.contains('is-on');"));

/* ---------------- móvil ---------------- */
await app.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await sleep(400);
const mobMatrix = await app.evalJs(`const doc = document.documentElement;
  const w = document.getElementById('matrix');
  return { overflow: doc.scrollWidth - doc.clientWidth,
    scrollable: w.scrollWidth > w.clientWidth,
    contained: Math.round(w.getBoundingClientRect().width) <= window.innerWidth };`);
check('móvil: la matriz no desborda la página', mobMatrix.overflow <= 0, `desborde ${mobMatrix.overflow}px`);
check('móvil: la matriz scrollea dentro de su caja', mobMatrix.scrollable && mobMatrix.contained, JSON.stringify(mobMatrix));

await app.clickReal('#tabAtk');
await sleep(300);
const mob = await app.evalJs(`const doc = document.documentElement;
  const t = document.querySelector('#picker .type').getBoundingClientRect();
  const tab = document.getElementById('tabAtk').getBoundingClientRect();
  return { overflow: doc.scrollWidth - doc.clientWidth, tap: Math.round(t.height), tabTap: Math.round(tab.height) };`);
check('móvil: sin scroll horizontal', mob.overflow <= 0, `desborde ${mob.overflow}px`);
const donateTap = await app.evalJs(`const r = document.querySelector('.donate').getBoundingClientRect();
  return { h: Math.round(r.height), w: Math.round(r.width) };`);
check('móvil: el enlace de donación es tocable',
  donateTap.h >= 44 && donateTap.w >= 44, JSON.stringify(donateTap));

check('móvil: los tipos son tocables', mob.tap >= 44, `${mob.tap}px`);
check('móvil: las pestañas son tocables', mob.tabTap >= 44, `${mob.tabTap}px`);

await app.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await sleep(300);
check('apaisado: sin scroll horizontal',
  await app.evalJs("const d = document.documentElement; return d.scrollWidth - d.clientWidth <= 0;"));

app.close();
process.exit(done() ? 1 : 0);
