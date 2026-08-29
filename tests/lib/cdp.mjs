/**
 * Arnés compartido de los tests de navegador: sirve el repo, abre Chrome
 * headless por CDP y devuelve helpers. Sin dependencias.
 */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import { extname, join, normalize } from 'path';
import { tmpdir } from 'os';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

export function findChrome() {
  return process.env.CHROME || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(p => existsSync(p));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export { sleep };

// Tamaño de ventana de todas las suites. La emulación de móvil de cada test se
// monta encima de este y desaparece al cerrar, porque el perfil se borra.
const WIN = { w: 1280, h: 900 };

export async function launch({ root, port }) {
  const chromePath = findChrome();
  if (!chromePath) return null;

  const server = createServer(async (req, res) => {
    let p = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end('404'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Chrome guarda el tamaño de la ventana en su perfil, así que una suite que
  // emula un móvil deja esa ventana puesta para la corrida *siguiente*: se abre
  // con 390 px de alto y los clics por coordenadas caen fuera de pantalla,
  // fallando checks que no tienen nada que ver. El perfil se borra al arrancar.
  const profile = join(tmpdir(), 'miniapps-chrome-' + port);
  rmSync(profile, { recursive: true, force: true });

  const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    // El perfil va al tmp del sistema, no al repo: si no, ensucia el árbol de git
    // y una escritura de Chrome a mitad de un `git add` lo hace fallar.
    `--user-data-dir=${profile}`, `--window-size=${WIN.w},${WIN.h}`, 'about:blank'],
    { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); }
    catch { await sleep(250); }
  }
  if (!target) { chrome.kill(); server.close(); throw new Error('Chrome no expuso DevTools'); }

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
    const r = await send('Runtime.evaluate',
      { expression: `(async () => { ${expr} })()`, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'error en evaluate');
    return r.result?.result?.value;
  };
  const goto = async (path, { fresh = true } = {}) => {
    await send('Page.navigate', { url: base + path });
    await sleep(1100);
    if (fresh) {
      await evalJs('localStorage.clear(); return 1;');
      await send('Page.navigate', { url: base + path });
      await sleep(1100);
    }
  };
  // Pulsa por coordenadas de ventana, así que lo primero es asegurarse de que el
  // elemento está a la vista: si no, el clic aterriza en el que esté en ese punto
  // y el test falla por algo que no es el bug.
  const clickReal = async (sel) => {
    // `nearest` no mueve nada cuando el elemento ya se ve entero, para no alterar
    // los tests que miden la posición del scroll. Devuelve además si el punto de
    // clic pertenece de verdad al elemento.
    const aim = (block) => evalJs(`const el = document.querySelector('${sel}');
      if (!el) return null;
      el.scrollIntoView({ block: '${block}', inline: 'nearest' });
      return new Promise(res => requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const at = document.elementFromPoint(x, y);
        res({ x, y, covered: !(at && (at === el || el.contains(at) || at.contains(el))) });
      }));`);
    let box = await aim('nearest');
    if (!box) return null;
    // `nearest` lo deja pegado al borde de arriba, que es donde vive la cabecera
    // sticky de todas las apps: el elemento cuenta como visible y aun así el clic
    // cae en la cabecera. Si el punto no es suyo, se centra y se vuelve a mirar.
    if (box.covered) box = await aim('center');
    if (!box) return null;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    return await evalJs(`const el = document.elementFromPoint(${box.x}, ${box.y});
      return el ? (el.id || el.className || el.tagName) : 'nada';`);
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  const close = () => {
    try { send('Emulation.clearDeviceMetricsOverride'); } catch { /* ya se va igual */ }
    try { ws.close(); } catch {}
    try { chrome.kill(); } catch {}
    server.close();
  };
  return { base, send, evalJs, goto, clickReal, errors, close, sleep };
}

export function reporter() {
  let failed = 0;
  const check = (label, ok, detail = '') => {
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `\n      ${detail}`}`);
  };
  const done = () => {
    console.log(failed ? `\n${failed} FALLOS` : '\nTodo verde');
    return failed;
  };
  return { check, done };
}
