/**
 * Arnés compartido de los tests de navegador: sirve el repo, abre Chrome
 * headless por CDP y devuelve helpers. Sin dependencias.
 */
import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
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

  const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    // El perfil va al tmp del sistema, no al repo: si no, ensucia el árbol de git
    // y una escritura de Chrome a mitad de un `git add` lo hace fallar.
    `--user-data-dir=${join(tmpdir(), 'miniapps-chrome-' + port)}`, '--window-size=1280,900', 'about:blank'],
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

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  const close = () => { try { ws.close(); } catch {} try { chrome.kill(); } catch {} server.close(); };
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
