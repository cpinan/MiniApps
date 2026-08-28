/**
 * Test de navegador de PokéRuleta: Chrome headless por CDP, sin dependencias.
 * Comprueba lo que los tests puros no pueden — que la rueda GIRA de verdad
 * (píxeles del canvas cambiando), que el modal muestra un ganador, que se puede
 * volver a girar tras cerrar una tanda, y que en móvil nada se desborda.
 *
 *   node tests/browser.test.mjs
 */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, normalize } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => existsSync(p));

if (!CHROME) {
  console.log('SKIP  No se encontró Chrome/Chromium. Define CHROME=/ruta/al/binario para correr estos tests.');
  process.exit(0);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('404'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const PORT = 9400 + (process.pid % 300);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
  `--user-data-dir=${join(ROOT, '.tmp-chrome-profile')}`, '--window-size=1280,900', 'about:blank'],
  { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanup = () => { try { chrome.kill(); } catch {} server.close(); };
process.on('exit', cleanup);

let target;
for (let i = 0; i < 60 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); }
  catch { await sleep(250); }
}
if (!target) { console.error('FAIL  Chrome no expuso DevTools'); cleanup(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let msgId = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', m => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry.text);
});
const send = (method, params = {}) => new Promise(res => {
  const id = ++msgId; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'error en evaluate');
  return r.result?.result?.value;
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `\n      ${detail}`}`);
};

async function load(url = `${BASE}/apps/pokewheel/`) {
  await send('Page.navigate', { url });
  await sleep(1200);
  await evalJs('localStorage.clear(); return 1;');
  await send('Page.navigate', { url });
  await sleep(1200);
}

// hash barato de los píxeles del canvas: cambia si la rueda se movió
const HASH = `const c = document.getElementById('wheel'), g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) >>> 0; return h;`;

const setDuration = (sec) => evalJs(
  `const d = document.getElementById('duration'); d.value = ${sec};
   d.dispatchEvent(new Event('input')); return d.value;`);

/* ---------------- 1. carga limpia ---------------- */
await load();
check('la página carga sin errores de consola', errors.length === 0, errors.join(' | '));
check('la lista demo carga 10 nombres',
  await evalJs("document.getElementById('demoBtn').click(); return document.getElementById('countBadge').textContent;") === '10');

/* ---------------- 2. LA RUEDA GIRA ---------------- */
await setDuration(3);
const h0 = await evalJs(HASH);
await evalJs("document.getElementById('spinBtn').click(); return 1;");
await sleep(500);
const h1 = await evalJs(HASH);
await sleep(700);
const h2 = await evalJs(HASH);
check('la rueda se mueve al empezar el giro', h1 !== h0, `hash ${h0} -> ${h1}`);
check('la rueda sigue moviéndose a mitad del giro', h2 !== h1, `hash ${h1} -> ${h2}`);

await sleep(2600);
const winner = await evalJs("return document.getElementById('modal').hidden ? null : document.getElementById('modalTitle').textContent;");
check('al terminar sale el modal con un ganador', !!winner, `modal: ${winner}`);
check('el ganador pertenece a la lista',
  ['Ash','Misty','Brock','Gary','Serena','Clemont','Bonnie','May','Dawn','Iris'].includes(winner), `ganador: ${winner}`);
check('el seleccionado sale de la ruleta',
  await evalJs("return document.getElementById('countBadge').textContent;") === '9');
const h3 = await evalJs(HASH);
check('la rueda queda quieta tras el giro',
  h3 === await evalJs(HASH));

/* ---------------- 3. el bug: girar tras cerrar la tanda ---------------- */
await evalJs("document.getElementById('modal').hidden = true; return 1;");
const before = await evalJs(HASH);
await evalJs("document.getElementById('spinBtn').click(); return 1;");
await sleep(600);
check('vuelve a girar aunque la tanda anterior ya terminó', await evalJs(HASH) !== before);
await sleep(3200);
check('el segundo giro también corona ganador',
  await evalJs("return !document.getElementById('modal').hidden;"));

/* ---------------- 3b. cinco giros seguidos, con clics de ratón reales ---------------- */
// Clic real (no .click() de JS): así también se detecta si algo tapa la pokébola.
const clickReal = async (sel) => {
  const box = await evalJs(`const el = document.querySelector('${sel}');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  if (!box) return null;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  return await evalJs(`const el = document.elementFromPoint(${box.x}, ${box.y});
    return el ? (el.id || el.className || el.tagName) : 'nada';`);
};

await load();
await evalJs("document.getElementById('demoBtn').click(); return 1;");
await setDuration(2);
const seq = [];
let stuck = null;
for (let i = 1; i <= 5; i++) {
  await clickReal('#spinBtn');
  await sleep(2900);
  const r = await evalJs(`return {
    winner: document.getElementById('modal').hidden ? null : document.getElementById('modalTitle').textContent,
    disabled: document.getElementById('spinBtn').disabled,
    left: document.getElementById('countBadge').textContent };`);
  seq.push(r.winner);
  if (r.disabled) stuck = stuck || `giro ${i} dejó el botón bloqueado`;
  if (!r.winner) stuck = stuck || `giro ${i} no coronó ganador`;
  await clickReal('#closeBtn');
  await sleep(200);
}
check('cinco giros seguidos con ratón real, sin bloquearse', stuck === null, stuck || '');
check('cada giro corona a alguien', seq.filter(Boolean).length === 5, seq.join(', '));
check('tras cinco giros quedan 5 participantes',
  await evalJs("return document.getElementById('countBadge').textContent;") === '5');
check('el sello de build es visible',
  /build/.test(await evalJs("return document.getElementById('buildTag').textContent;")));

/* ---------------- 3c. celebración del ganador ---------------- */
await load();
await evalJs("document.getElementById('demoBtn').click(); return 1;");
await setDuration(2);
await evalJs(`const r = document.getElementById('rounds'); r.value = 2; r.dispatchEvent(new Event('change')); return 1;`);

await evalJs("document.getElementById('spinBtn').click(); return 1;");
await sleep(2600);
const party = await evalJs(`const f = document.getElementById('fx');
  const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
  let painted = 0; for (let i = 3; i < d.length; i += 40) if (d[i] > 8) painted++;
  return { painted,
    final: document.getElementById('modalCard').classList.contains('final'),
    trophy: !document.getElementById('trophy').hidden,
    letters: document.querySelectorAll('#modalTitle .ltr').length };`);
check('el confeti se dibuja al ganar una ronda', party.painted > 0, `píxeles pintados: ${party.painted}`);
check('el nombre entra letra a letra', party.letters > 0, `letras: ${party.letters}`);
check('ronda intermedia: sin trofeo ni tema dorado', !party.final && !party.trophy);

await evalJs("document.getElementById('againBtn').click(); return 1;");
await sleep(2800);
const grand = await evalJs(`const f = document.getElementById('fx');
  const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
  let painted = 0; for (let i = 3; i < d.length; i += 40) if (d[i] > 8) painted++;
  return { painted,
    final: document.getElementById('modalCard').classList.contains('final'),
    trophy: !document.getElementById('trophy').hidden,
    kicker: document.getElementById('modalKicker').textContent };`);
check('último giro: celebración final con trofeo', grand.final && grand.trophy, JSON.stringify(grand));
const legible = await evalJs(`const sp = document.querySelector('#modalTitle .ltr');
  const cs = sp ? getComputedStyle(sp) : null;
  return cs ? { fill: cs.webkitTextFillColor || cs.color, text: document.getElementById('modalTitle').textContent } : null;`);
check('el nombre del ganador se ve en la celebración final',
  !!legible && !/transparent|rgba\(0, 0, 0, 0\)/.test(legible.fill) && legible.text.length > 0,
  JSON.stringify(legible));
check('último giro: el cartel anuncia el final', /terminado/i.test(grand.kicker), grand.kicker);
check('la celebración final también pinta', grand.painted > 0, `píxeles: ${grand.painted}`);

/* ---------------- 4. ruleta vacía: avisa, no se cuelga ---------------- */
await evalJs(`document.getElementById('modal').hidden = true;
  document.getElementById('clearBtn').click();
  document.getElementById('spinBtn').click(); return 1;`);
check('con la ruleta vacía avisa bajo la rueda',
  /vacía/i.test(await evalJs("return document.getElementById('roundLine').textContent;")));

/* ---------------- 5. tema personalizado ---------------- */
await load();
await evalJs("document.getElementById('demoBtn').click(); return 1;");
const themed0 = await evalJs(HASH);
check('los selectores de color están ocultos con un tema de fábrica',
  await evalJs("return document.getElementById('customColors').offsetParent === null;"));
const applied = await evalJs(`const t = document.getElementById('theme');
  t.value = 'custom'; t.dispatchEvent(new Event('change'));
  const c = document.getElementById('col1'); c.value = '#00ff88'; c.dispatchEvent(new Event('input'));
  return document.body.dataset.theme + '|' + getComputedStyle(document.body).getPropertyValue('--accent').trim()
    + '|' + document.getElementById('customColors').hidden;`);
check('el tema personalizado aplica el color elegido', applied === 'custom|#00ff88|false', applied);
check('la ruleta se repinta con los colores del usuario', await evalJs(HASH) !== themed0);
check('los selectores de color aparecen con el tema personalizado',
  await evalJs("return document.getElementById('customColors').offsetParent !== null;"));
const rnd = await evalJs(`document.getElementById('randomColors').click();
  return document.getElementById('col1').value + document.getElementById('col2').value;`);
check('el botón "al azar" genera colores válidos', /^#[0-9a-f]{6}#[0-9a-f]{6}$/i.test(rnd), rnd);
check('el tema sobrevive a la recarga', await (async () => {
  await send('Page.navigate', { url: `${BASE}/apps/pokewheel/` });
  await sleep(1200);
  return await evalJs("return document.body.dataset.theme;");
})() === 'custom');

/* ---------------- 6. móvil ---------------- */
await send('Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `${BASE}/apps/pokewheel/` });
await sleep(1200);
await evalJs("document.getElementById('demoBtn').click(); return 1;");

const m = await evalJs(`const doc = document.documentElement;
  const wrap = document.querySelector('.wheel-wrap').getBoundingClientRect();
  const btn = document.getElementById('spinBtn').getBoundingClientRect();
  const load = document.getElementById('loadBtn').getBoundingClientRect();
  const ta = document.getElementById('namesInput');
  return {
    overflow: doc.scrollWidth - doc.clientWidth,
    wheelW: Math.round(wrap.width), wheelH: Math.round(wrap.height),
    viewportW: window.innerWidth, viewportH: window.innerHeight,
    spinTap: Math.round(Math.min(btn.width, btn.height)),
    btnTap: Math.round(load.height),
    inputFont: parseFloat(getComputedStyle(ta).fontSize),
    stageFirst: document.querySelector('.stage').getBoundingClientRect().top
                < document.querySelector('.panel').getBoundingClientRect().top,
  };`);

check('móvil 390x844: no hay scroll horizontal', m.overflow <= 0, `desborde: ${m.overflow}px`);
check('móvil: la ruleta cabe a lo ancho', m.wheelW <= m.viewportW, `${m.wheelW} > ${m.viewportW}`);
check('móvil: la ruleta cabe a lo alto', m.wheelH <= m.viewportH, `${m.wheelH} > ${m.viewportH}`);
check('móvil: la ruleta se ve antes que el panel', m.stageFirst === true);
check('móvil: el botón de girar es tocable (>=44px)', m.spinTap >= 44, `${m.spinTap}px`);
check('móvil: los botones del panel son tocables (>=44px)', m.btnTap >= 44, `${m.btnTap}px`);
check('móvil: el textarea no fuerza zoom en iOS (>=16px)', m.inputFont >= 16, `${m.inputFont}px`);

const tapped = await evalJs(`const r = document.getElementById('spinBtn').getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return el && (el.id === 'spinBtn' || el.closest('#spinBtn') ? 'spinBtn' : el.id || el.className);`);
check('móvil: el centro de la ruleta recibe el toque', tapped === 'spinBtn', `recibe: ${tapped}`);

/* ---------------- 7. apaisado ---------------- */
await send('Emulation.setDeviceMetricsOverride',
  { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await sleep(400);
const land = await evalJs(`const doc = document.documentElement;
  const wrap = document.querySelector('.wheel-wrap').getBoundingClientRect();
  return { overflow: doc.scrollWidth - doc.clientWidth, h: Math.round(wrap.height), vh: window.innerHeight };`);
check('apaisado 844x390: sin scroll horizontal', land.overflow <= 0, `desborde: ${land.overflow}px`);
check('apaisado: la ruleta cabe a lo alto', land.h <= land.vh, `${land.h} > ${land.vh}`);

/* ---------------- 8. el hub ---------------- */
await send('Emulation.clearDeviceMetricsOverride');
await send('Page.navigate', { url: `${BASE}/` });
await sleep(800);
check('el hub enlaza a la app',
  await evalJs("return !!document.querySelector('a[href=\"./apps/pokewheel/\"]');"));

console.log(failed ? `\n${failed} FALLOS` : '\nTodo verde');
cleanup();
process.exit(failed ? 1 : 0);
