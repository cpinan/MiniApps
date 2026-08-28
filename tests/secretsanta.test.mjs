/** Amigo secreto: propiedades del sorteo + navegador (organizador y sobre). */
import { launch, reporter, sleep } from './lib/cdp.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const { check, done } = reporter();

/* ---------------- lógica pura ---------------- */
import { draw, parsePairs } from '../apps/secretsanta/draw.js';

const names = (n) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

let selfGift = false, missing = false, mutual = false;
for (let i = 0; i < 300; i++) {
  const { pairsOut } = draw(names(6));
  if (pairsOut.some(p => p.from === p.to)) selfGift = true;
  const gets = pairsOut.map(p => p.to).sort();
  if (JSON.stringify(gets) !== JSON.stringify(names(6).sort())) missing = true;
  const map = new Map(pairsOut.map(p => [p.from, p.to]));
  for (const [f, t] of map) if (map.get(t) === f) mutual = true;
}
check('nadie se regala a sí mismo (300 sorteos)', !selfGift);
check('todos reciben exactamente un regalo', !missing);
check('no hay parejas mutuas A→B y B→A', !mutual);

const two = draw(names(2)).pairsOut;
check('con 2 personas se regalan entre ellas', two.length === 2 && two[0].to === two[1].from);
check('con 1 persona avisa y no sortea', draw(names(1)).warnings.length > 0);
check('con 0 personas no revienta', draw([]).pairsOut.length === 0);

let excluded = true;
for (let i = 0; i < 200; i++) {
  const { pairsOut } = draw(['Ash', 'Misty', 'Brock', 'Gary'], [['ash', 'misty']]);
  const map = new Map(pairsOut.map(p => [p.from, p.to]));
  if (map.get('Ash') === 'Misty' || map.get('Misty') === 'Ash') excluded = false;
}
check('la exclusión se respeta en ambos sentidos (200 sorteos)', excluded);

check('las exclusiones se leen línea a línea',
  JSON.stringify(parsePairs('Ash, Misty\nGary; Brock')) === JSON.stringify([['ash', 'misty'], ['gary', 'brock']]));

// reparto uniforme: con 4 personas, a quién le toca cada uno debe estar repartido
const tally = {};
for (let i = 0; i < 600; i++) {
  const map = new Map(draw(['A', 'B', 'C', 'D']).pairsOut.map(p => [p.from, p.to]));
  tally[map.get('A')] = (tally[map.get('A')] || 0) + 1;
}
check('a A no le toca siempre el mismo', Object.keys(tally).length === 3, JSON.stringify(tally));
const spread = Math.max(...Object.values(tally)) / Math.min(...Object.values(tally));
check('y el reparto es parejo (desvío < 1.3x)', spread < 1.3, `ratio ${spread.toFixed(2)}`);

/* ---------------- navegador ---------------- */
const app = await launch({ root: ROOT, port: 9520 });
if (!app) { console.log('SKIP  No se encontró Chrome.'); process.exit(done() ? 1 : 0); }

await app.goto('/apps/secretsanta/');
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


await app.evalJs("document.getElementById('demoBtn').click(); return 1;");
await app.evalJs("document.getElementById('noteInput').value = 'Tope 20 soles'; return 1;");
await app.clickReal('#drawBtn');
await sleep(600);
const org = await app.evalJs(`return {
  cards: document.querySelectorAll('.person').length,
  privacy: !document.getElementById('privacyNote').hidden,
  summary: document.getElementById('summaryLine').textContent,
  fx: (() => { const f = document.getElementById('fx');
    const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 8) n++; return n; })() };`);
check('salen 6 sobres, uno por persona', org.cards === 6, JSON.stringify(org));
check('se explica que cada link es privado', org.privacy === true);
check('el sorteo se celebra', org.fx > 0, `píxeles: ${org.fx}`);
check('ningún nombre de destino se muestra al organizador',
  await app.evalJs(`const txt = document.getElementById('people').textContent;
    return !/→|regala|le toca/i.test(txt);`));

// el link personal: se genera en la propia página y se abre como sobre
const link = await app.evalJs(`const mod = await import('./app.js').catch(() => null);
  const btn = document.querySelector('.person button');
  const name = document.querySelector('.person .name').textContent;
  return { name, href: location.href.split('#')[0] };`);
const personalHash = await app.evalJs(`const enc = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  return '#p=' + enc({ f: 'Ash', t: 'Serena', n: 'Tope 20 soles' });`);

await app.send('Page.navigate', { url: `${app.base}/apps/secretsanta/${personalHash}` });
await sleep(1200);
const env = await app.evalJs(`return {
  organizerHidden: document.getElementById('organizer').hidden,
  who: document.getElementById('whoLine').textContent,
  resultHidden: document.getElementById('result').hidden,
  title: document.title };`);
check('el link personal abre en modo sobre', env.organizerHidden === true, JSON.stringify(env));
const vis = await app.evalJs(`const org = document.getElementById('organizer');
  const e = document.getElementById('envelope').getBoundingClientRect();
  return { orgVisible: org.offsetParent !== null || org.getBoundingClientRect().height > 0,
           inView: e.top >= 0 && e.bottom <= window.innerHeight + 1 };`);
check('en modo sobre el organizador no ocupa pantalla', vis.orgVisible === false, JSON.stringify(vis));
check('el sobre entra en la primera pantalla', vis.inView === true, JSON.stringify(vis));
check('el sobre dice de quién es', /Ash/.test(env.who), env.who);
check('el nombre no se ve antes de abrir', env.resultHidden === true);

await app.clickReal('#envelope');
await sleep(700);
const opened = await app.evalJs(`return {
  name: document.getElementById('revealName').textContent,
  note: document.getElementById('revealNote').textContent,
  fx: (() => { const f = document.getElementById('fx');
    const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 8) n++; return n; })() };`);
check('al abrir el sobre sale el nombre', opened.name === 'Serena', JSON.stringify(opened));
check('y el mensaje del organizador', opened.note === 'Tope 20 soles', opened.note);
check('la apertura se celebra a lo grande', opened.fx > 0, `píxeles: ${opened.fx}`);

check('un link corrupto no rompe la app',
  await (async () => {
    await app.send('Page.navigate', { url: `${app.base}/apps/secretsanta/#p=noesbase64!!` });
    await sleep(1000);
    return await app.evalJs("return !document.getElementById('organizer').hidden;");
  })());

/* ---------------- móvil ---------------- */
await app.send('Page.navigate', { url: `${app.base}/apps/secretsanta/` });
await sleep(1000);
await app.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await app.evalJs("document.getElementById('demoBtn').click(); document.getElementById('drawBtn').click(); return 1;");
await sleep(500);
const mob = await app.evalJs(`const doc = document.documentElement;
  return { overflow: doc.scrollWidth - doc.clientWidth,
    btn: Math.round(document.getElementById('drawBtn').getBoundingClientRect().height),
    copy: Math.round(document.querySelector('.person button').getBoundingClientRect().height),
    cols: getComputedStyle(document.getElementById('people')).gridTemplateColumns.split(' ').length,
    font: parseFloat(getComputedStyle(document.getElementById('namesInput')).fontSize) };`);
check('móvil: sin scroll horizontal', mob.overflow <= 0, `desborde ${mob.overflow}px`);
const donateTap = await app.evalJs(`const r = document.querySelector('.donate').getBoundingClientRect();
  return { h: Math.round(r.height), w: Math.round(r.width) };`);
check('móvil: el enlace de donación es tocable',
  donateTap.h >= 44 && donateTap.w >= 44, JSON.stringify(donateTap));

check('móvil: botón de sortear tocable', mob.btn >= 44, `${mob.btn}px`);
check('móvil: botones de copiar tocables', mob.copy >= 44, `${mob.copy}px`);
check('móvil: sobres en una columna', mob.cols === 1, `columnas: ${mob.cols}`);
check('móvil: el textarea no fuerza zoom en iOS', mob.font >= 16, `${mob.font}px`);

await app.send('Page.navigate', { url: `${app.base}/apps/secretsanta/${personalHash}` });
await sleep(1000);
const mobEnv = await app.evalJs(`const doc = document.documentElement;
  const e = document.getElementById('envelope').getBoundingClientRect();
  return { overflow: doc.scrollWidth - doc.clientWidth, w: Math.round(e.width), vw: window.innerWidth };`);
check('móvil: el sobre cabe en pantalla', mobEnv.w <= mobEnv.vw && mobEnv.overflow <= 0, JSON.stringify(mobEnv));

await app.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await sleep(400);
check('apaisado: sin scroll horizontal',
  await app.evalJs("const d = document.documentElement; return d.scrollWidth - d.clientWidth <= 0;"));

app.close();
process.exit(done() ? 1 : 0);
