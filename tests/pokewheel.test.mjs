import { readFileSync } from 'fs';


const src = readFileSync(new URL('../apps/pokewheel/app.js', import.meta.url), 'utf8');

// extrae funciones puras del app.js real (sin DOM)
const grab = (name) => {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error('no encontrada: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
};
const TAU = Math.PI * 2;
const code = ['parseNames','dedupe','randomInt','indexUnderPointer'].map(grab).join('\n');
const mod = new Function('TAU','state', code + '; return {parseNames,dedupe,randomInt,indexUnderPointer};');

const state = { names: [], rotation: 0 };
const { parseNames, dedupe, randomInt, indexUnderPointer } = mod(TAU, state);

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

eq('comas',            parseNames('Ash, Misty, Brock'), ['Ash','Misty','Brock']);
eq('saltos de linea',  parseNames('Ash\nMisty\r\nBrock'), ['Ash','Misty','Brock']);
eq('solo espacios',    parseNames('Ash Misty Brock'), ['Ash','Misty','Brock']);
eq('nombre compuesto', parseNames('Ana Maria, Jose Luis'), ['Ana Maria','Jose Luis']);
eq('punto y coma+tab', parseNames('Ash;Misty\tBrock'), ['Ash','Misty','Brock']);
eq('csv con comillas', parseNames('"Ash","Misty"\n"Brock"'), ['Ash','Misty','Brock']);
eq('vinetas',          parseNames('1. Ash\n2) Misty\n- Brock\n• Gary'), ['Ash','Misty','Brock','Gary']);
eq('separadores dobles', parseNames('Ash,,  ,Misty,\n\n,Brock'), ['Ash','Misty','Brock']);
eq('vacio',            parseNames('   \n  '), []);
eq('dedupe insensible', dedupe(['Ash','ash','ASH','Misty']), ['Ash','Misty']);

// randomInt: rango + cobertura
let bad = 0; const hits = new Set();
for (let i = 0; i < 20000; i++) { const v = randomInt(7); if (v < 0 || v > 6 || !Number.isInteger(v)) bad++; hits.add(v); }
eq('randomInt en rango', bad, 0);
eq('randomInt cubre 0..6', hits.size, 7);
eq('randomInt(1)', randomInt(1), 0);

// chi-cuadrado grosero: ninguna cara se desvia >15% de lo esperado
const counts = new Array(10).fill(0);
for (let i = 0; i < 60000; i++) counts[randomInt(10)]++;
const dev = Math.max(...counts.map(c => Math.abs(c - 6000) / 6000));
eq('reparto uniforme (<8% desvio)', dev < 0.08, true);

// matematica del giro: el segmento que queda bajo la flecha == el elegido
let mismatch = 0;
for (let n = 1; n <= 40; n++) {
  state.names = new Array(n).fill('x');
  for (let trial = 0; trial < 40; trial++) {
    const winner = randomInt(n);
    const step = TAU / n;
    const center = winner * step + step / 2;
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const target = (-Math.PI / 2) - center + jitter;
    const from = Math.random() * TAU;
    state.rotation = from + (6 + randomInt(4)) * TAU + ((target - from) % TAU + TAU) % TAU;
    if (indexUnderPointer() !== winner) mismatch++;
  }
}
eq('flecha apunta al ganador (1600 casos)', mismatch, 0);

console.log(fail ? `\n${fail} FALLOS` : '\nTodo verde');
process.exit(fail ? 1 : 0);
