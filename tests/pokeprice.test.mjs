/** Cotizador PokeMMO: exactitud de las curvas y de los precios + navegador. */
import { launch, reporter, sleep } from './lib/cdp.mjs';
import {
  GROUPS, GROUP_TOTALS, SERVICE_CAP, SPECIES, TIERS, MAX_LEVEL,
  totalExp, expBetween, levelFromExp, trainingPrice, levelForBudget,
  trainedDeliveryPrice, breedingPrice, orderTotal, findSpecies,
} from '../apps/pokeprice/exp.js';

const ROOT = new URL('..', import.meta.url).pathname;
const { check, done } = reporter();
const digits = (s) => String(s).replace(/[^\d]/g, '');

/* ---------------- las curvas ---------------- */

// Si estos seis totales no salen, toda la app cobra mal.
const AT_100 = { erratico: 600000, rapido: 800000, medio_rapido: 1000000,
  medio_lento: 1059860, lento: 1250000, fluctuante: 1640000 };
const badTop = Object.entries(AT_100).filter(([g, v]) => totalExp(g, 100) !== v)
  .map(([g, v]) => `${g}: ${totalExp(g, 100)} != ${v}`);
check('las seis curvas dan su total conocido al nivel 100', badTop.length === 0, badTop.join(' | '));
check('el total al 100 se publica para nombrar la curva',
  GROUPS.every(g => GROUP_TOTALS[g] === totalExp(g, 100)), JSON.stringify(GROUP_TOTALS));

// Valores sueltos de la tabla del juego, uno por curva.
const KNOWN = [
  ['erratico', 2, 15], ['erratico', 50, 125000], ['rapido', 2, 6], ['medio_rapido', 2, 8],
  ['medio_lento', 2, 9], ['medio_lento', 3, 57], ['lento', 2, 10], ['fluctuante', 2, 4],
  ['fluctuante', 15, 1957], ['fluctuante', 36, 46656], ['medio_rapido', 65, 274625],
];
const badKnown = KNOWN.filter(([g, n, v]) => totalExp(g, n) !== v)
  .map(([g, n, v]) => `${g} nv${n}: ${totalExp(g, n)} != ${v}`);
check('coinciden con valores sueltos de la tabla del juego', badKnown.length === 0, badKnown.join(' | '));

check('el nivel 1 es siempre 0 de experiencia', GROUPS.every(g => totalExp(g, 1) === 0));
check('las curvas nunca bajan', GROUPS.every(g => {
  for (let n = 2; n <= MAX_LEVEL; n++) if (totalExp(g, n) <= totalExp(g, n - 1)) return false;
  return true;
}));

// El nivel derivado de la experiencia tiene que ser el inverso exacto de la curva.
const badRound = [];
for (const g of GROUPS) for (let n = 2; n <= MAX_LEVEL; n++) {
  if (levelFromExp(g, totalExp(g, n)) !== n) badRound.push(`${g} nv${n} exacto`);
  if (levelFromExp(g, totalExp(g, n) - 1) !== n - 1) badRound.push(`${g} nv${n} -1`);
}
check('nivel ⇄ experiencia es reversible en los 6 grupos', badRound.length === 0, badRound.slice(0, 4).join(', '));

check('lo que falta de 100 a 100 es cero', GROUPS.every(g => expBetween(g, 100, 100) === 0));
check('lo que falta nunca es negativo', GROUPS.every(g => expBetween(g, 100, 30) === 0));
check('de nivel 1 a 100 sale la experiencia total de 100',
  GROUPS.every(g => expBetween(g, 1, 100) === totalExp(g, 100)));

/* ---------------- los precios ---------------- */

const T = { pricePer: 5000, expPer: 50000, rounding: 'bloque', min: 0 };

check('el bloque empezado se cobra entero',
  trainingPrice(50001, T).price === 10000, JSON.stringify(trainingPrice(50001, T)));
check('un bloque justo no cobra dos', trainingPrice(50000, T).price === 5000);
check('sin experiencia que subir no se cobra nada', trainingPrice(0, T).price === 0);
check('el modo proporcional cobra el detalle',
  trainingPrice(75000, { ...T, rounding: 'exacto' }).price === 7500,
  JSON.stringify(trainingPrice(75000, { ...T, rounding: 'exacto' })));
check('el mínimo por Pokémon se respeta',
  trainingPrice(1000, { ...T, min: 20000 }).price === 20000);
check('el mínimo no cobra un trabajo inexistente',
  trainingPrice(0, { ...T, min: 20000 }).price === 0);
check('Garchomp de 1 a 100 son 1.250.000 EXP y 25 bloques',
  (() => { const q = trainingPrice(expBetween('lento', 1, 100), T);
    return q.exp === 1250000 && q.charged === 25 && q.price === 125000; })(),
  JSON.stringify(trainingPrice(expBetween('lento', 1, 100), T)));

check('el tope del servicio es el nivel 100', SERVICE_CAP === 100, String(SERVICE_CAP));
check('el presupuesto nunca pasa del nivel 100',
  levelForBudget('lento', 0, 99999999, T) === SERVICE_CAP);
check('un presupuesto corto no sube ni un nivel',
  levelForBudget('lento', 0, 100, T) === 1, String(levelForBudget('lento', 0, 100, T)));
check('lo que dice el presupuesto sí se paga con ese presupuesto', (() => {
  for (const g of GROUPS) for (const money of [12000, 45000, 120000]) {
    const lv = levelForBudget(g, 0, money, T);
    if (trainingPrice(totalExp(g, lv), T).price > money) return false;
    if (lv < SERVICE_CAP && trainingPrice(totalExp(g, lv + 1), T).price <= money) return false;
  }
  return true;
})());
check('parte de la experiencia real, no del nivel redondeado',
  levelForBudget('lento', totalExp('lento', 40) + 5, 5000, T) >= 40);

check('la crianza suma base, recargo y extras',
  breedingPrice({ base: 150000, surcharge: 80000, extras: [20000, 15000] }).price === 265000);
check('la crianza multiplica por cantidad',
  breedingPrice({ base: 100000, qty: 3 }).price === 300000);
check('los extras aceptan {label, amount}',
  breedingPrice({ base: 0, extras: [{ label: 'x', amount: 7000 }] }).price === 7000);

// Entregar la cría entrenada no es una tarifa plana: nace en el nivel 1, así que
// se cobra la curva entera de su especie.
check('entregarla entrenada cobra la curva entera, no un precio fijo',
  trainedDeliveryPrice('lento', T) === trainingPrice(totalExp('lento', SERVICE_CAP), T).price
  && trainedDeliveryPrice('lento', T) === 125000, String(trainedDeliveryPrice('lento', T)));
check('y cada curva cuesta lo suyo',
  trainedDeliveryPrice('erratico', T) === 60000
  && trainedDeliveryPrice('medio_lento', T) === 110000
  && trainedDeliveryPrice('fluctuante', T) === 165000,
  JSON.stringify(GROUPS.map(g => [g, trainedDeliveryPrice(g, T)])));
check('la curva lenta cuesta más que la errática al entregarla entrenada',
  trainedDeliveryPrice('lento', T) > trainedDeliveryPrice('erratico', T));
check('sube con la tarifa de entrenamiento',
  trainedDeliveryPrice('lento', { ...T, pricePer: 9000 }) === 225000,
  String(trainedDeliveryPrice('lento', { ...T, pricePer: 9000 })));

// Cobrar la crianza entrenada y cobrar la crianza y el entrenamiento por
// separado tiene que dar lo mismo, o el cliente elige por dónde le sale barato.
const badPair = GROUPS.filter(g =>
  trainedDeliveryPrice(g, T) !== trainingPrice(expBetween(g, 1, SERVICE_CAP), T).price);
check('cuesta igual que pedir la crianza y el entrenamiento 1 → 100 por separado',
  badPair.length === 0, badPair.join(', '));
check('las curvas caras se cobran más caras', (() => {
  const p = GROUPS.map(g => trainedDeliveryPrice(g, T));
  return p.every((v, i) => i === 0 || p[i - 1] < v);
})(), JSON.stringify(GROUPS.map(g => trainedDeliveryPrice(g, T))));
check('el redondeo proporcional también manda aquí',
  trainedDeliveryPrice('medio_lento', { ...T, rounding: 'exacto' }) === 105986,
  String(trainedDeliveryPrice('medio_lento', { ...T, rounding: 'exacto' })));
check('el mínimo por Pokémon se respeta al entregarlo entrenado',
  trainedDeliveryPrice('erratico', { ...T, min: 200000 }) === 200000);
check('si el tope del servicio bajara, bajaría el precio', (() => {
  const half = trainedDeliveryPrice('lento', T, 50);
  return half === trainingPrice(totalExp('lento', 50), T).price && half < trainedDeliveryPrice('lento', T);
})(), String(trainedDeliveryPrice('lento', T, 50)));

// El extra entra en el unitario, así que la cantidad lo multiplica como al resto.
const bt = breedingPrice({
  base: 150000, surcharge: 80000,
  extras: [{ label: 'entrenado a 100', amount: trainedDeliveryPrice('lento', T) }], qty: 2,
});
check('dos crías entrenadas cobran el doble del unitario, curva incluida',
  bt.unit === 355000 && bt.price === 710000, JSON.stringify(bt));

const ORDER = [{ price: 100000 }, { price: 50000 }];
const t1 = orderTotal(ORDER, { discountPct: 10, depositPct: 50 });
check('el pedido suma, descuenta y parte el adelanto',
  t1.subtotal === 150000 && t1.discount === 15000 && t1.total === 135000
  && t1.deposit === 67500 && t1.rest === 67500, JSON.stringify(t1));
check('sin descuento ni adelanto el total es el subtotal',
  orderTotal(ORDER).total === 150000);
check('un pedido vacío da cero', orderTotal([]).total === 0);

/* ---------------- la tabla de especies ---------------- */

const names = SPECIES.map(s => s.name);
check('no hay especies repetidas',
  new Set(names).size === names.length, names.filter((n, i) => names.indexOf(n) !== i).join(', '));
check('todas las especies tienen una curva válida',
  SPECIES.every(s => GROUPS.includes(s.group)),
  SPECIES.filter(s => !GROUPS.includes(s.group)).map(s => s.name).join(', '));
check('todas las especies tienen una dificultad válida',
  SPECIES.every(s => TIERS.includes(s.tier)));
check('la búsqueda ignora mayúsculas, guiones, tildes y espacios',
  ['garchomp', 'GARCHOMP', ' Garchomp '].every(q => findSpecies(q)?.name === 'Garchomp')
  && ['PORYGON-Z', 'porygonz'].every(q => findSpecies(q)?.name === 'Porygon-Z'));
check('una especie que no está no rompe nada', findSpecies('Mewtwo') === null);
check('la lista de especies sale ordenada alfabéticamente', (() => {
  for (let i = 1; i < SPECIES.length; i++) {
    if (SPECIES[i - 1].name.localeCompare(SPECIES[i].name, 'es') > 0) return false;
  }
  return true;
})(), SPECIES.slice(0, 5).map(s => s.name).join(', '));
check('las curvas se ofrecen de menor a mayor experiencia', (() => {
  const totals = GROUPS.map(g => GROUP_TOTALS[g]);
  return totals.every((v, i) => i === 0 || totals[i - 1] < v);
})(), JSON.stringify(GROUPS.map(g => GROUP_TOTALS[g])));

// Curvas que cualquier jugador puede comprobar en el juego.
const SPOT = [['Garchomp', 'lento'], ['Blissey', 'rapido'], ['Milotic', 'erratico'],
  ['Breloom', 'fluctuante'], ['Gengar', 'medio_lento'], ['Eevee', 'medio_rapido'],
  ['Charizard', 'medio_lento'], ['Metagross', 'lento'], ['Ferrothorn', 'medio_rapido'],
  // curvas que la tabla escrita a mano tenía mal y la ROM corrigió
  ['Ampharos', 'medio_lento'], ['Dusclops', 'rapido'], ['Electivire', 'medio_rapido'],
  ['Magmortar', 'medio_rapido'], ['Toxicroak', 'medio_rapido'], ['Mantine', 'lento'],
  ['Drapion', 'lento'], ['Jellicent', 'medio_rapido'], ['Klinklang', 'medio_lento'],
  ['Golurk', 'medio_rapido'], ['Leavanny', 'medio_lento'], ['Scolipede', 'medio_lento']];
const badSpot = SPOT.filter(([n, g]) => findSpecies(n)?.group !== g)
  .map(([n, g]) => `${n}: ${findSpecies(n)?.group} != ${g}`);
check('las especies conocidas tienen la curva del juego', badSpot.length === 0, badSpot.join(' | '));

// La tabla es el Pokédex de las cinco regiones menos legendarios: 649 - 48 = 601.
check('están las 601 especies criables de PokeMMO', SPECIES.length === 601, String(SPECIES.length));
const PREEVOS = [['Growlithe', 'lento'], ['Gible', 'lento'], ['Dratini', 'lento'],
  ['Ralts', 'lento'], ['Riolu', 'medio_lento'], ['Larvitar', 'lento'],
  ['Magikarp', 'lento'], ['Feebas', 'erratico'], ['Nidoran hembra', 'medio_lento']];
const badPre = PREEVOS.filter(([n, g]) => findSpecies(n)?.group !== g)
  .map(([n, g]) => `${n}: ${findSpecies(n)?.group ?? 'no está'} != ${g}`);
check('las preevoluciones también están, con su curva', badPre.length === 0, badPre.join(' | '));
check('los legendarios se quedan fuera: no se crían en el juego',
  ['Mewtwo', 'Rayquaza', 'Zekrom', 'Celebi', 'Heatran'].every(n => findSpecies(n) === null));
check('las preevoluciones heredan la dificultad de la familia',
  findSpecies('Gible')?.tier === 'raro' && findSpecies('Beldum')?.tier === 'sin_genero'
  && findSpecies('Rattata')?.tier === 'comun',
  [findSpecies('Gible')?.tier, findSpecies('Beldum')?.tier, findSpecies('Rattata')?.tier].join(' | '));
check('cada nombre se encuentra a sí mismo: no hay dos que se plieguen igual',
  SPECIES.every(s => findSpecies(s.name) === s),
  SPECIES.filter(s => findSpecies(s.name) !== s).map(s => s.name).join(', '));

/* ---------------- navegador ---------------- */
const app = await launch({ root: ROOT, port: 9541 });
if (!app) { console.log('SKIP  No se encontró Chrome.'); process.exit(done() ? 1 : 0); }

await app.goto('/apps/pokeprice/');
check('la app carga sin errores de consola', app.errors.length === 0, app.errors.join(' | '));

const donate = await app.evalJs(`const a = document.querySelector('.donate');
  if (!a) return null;
  const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
  return { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'),
    aria: a.getAttribute('aria-label'), inHeader: !!a.closest('.topbar'), top: Math.round(r.top),
    area: Math.round(r.width * r.height), anim: cs.animationName };`);
check('la cabecera lleva enlace de donación',
  !!donate && /DONATE_ES\.md/.test(donate.href) && donate.inHeader, JSON.stringify(donate));
check('el enlace abre fuera y sin filtrar la sesión',
  donate?.target === '_blank' && /noopener/.test(donate?.rel || ''), JSON.stringify(donate));
check('el enlace de donación está arriba, se ve y late',
  donate.top < 120 && donate.area >= 2800 && donate.anim !== 'none' && !!donate.aria, JSON.stringify(donate));

check('arranca en la pestaña de entrenamiento',
  await app.evalJs("return document.getElementById('panelTrain').hidden === false && document.getElementById('panelRates').hidden === true;"));

const setVal = (sel, value, ev = 'input') =>
  app.evalJs(`const el = document.querySelector('${sel}');
    el.value = ${JSON.stringify(String(value))};
    el.dispatchEvent(new Event('${ev}', { bubbles: true })); return 1;`);

/* --- entrenamiento --- */
await setVal('#trSpecies', 'Garchomp');
await sleep(150);
const g1 = await app.evalJs(`return { group: document.getElementById('trGroup').value,
  price: document.querySelector('#trResult .price').textContent,
  rows: [...document.querySelectorAll('#trResult .breakdown div')].map(d => d.textContent) };`);
check('escribir la especie fija su curva', g1.group === 'lento', JSON.stringify(g1.group));
// En el juego la curva se reconoce por su total al 100, no por el nombre.
const curveLabels = await app.evalJs(`return [...document.querySelectorAll('#trGroup option')].map(o => o.textContent);`);
check('cada curva se nombra con su experiencia total a nivel 100',
  [600000, 800000, 1000000, 1059860, 1250000, 1640000]
    .every(v => curveLabels.some(l => digits(l) === String(v))), JSON.stringify(curveLabels));
check('y el resultado repite esa cifra',
  digits(g1.price).includes('1250000'), g1.price);

// La curva es un dato del Pokémon: con especie conocida no se puede tocar.
const locked = await app.evalJs(`return { disabled: document.getElementById('trGroup').disabled,
  note: document.getElementById('trCurveNote').textContent };`);
check('con una especie conocida la curva queda amarrada a ella',
  locked.disabled === true && /Garchomp/.test(locked.note), JSON.stringify(locked));

/* --- el buscador de especies --- */
// El <datalist> nativo no vale: Chrome lo esconde con autocomplete="off" y
// Safari no filtra. Estos checks cubren el combobox propio que lo sustituye.
await setVal('#trSpecies', '');
await app.evalJs("document.getElementById('trSpecies').focus(); return 1;");
await sleep(250);
const catalogue = await app.evalJs(`const l = document.getElementById('trSpeciesList');
  return { open: l.hidden === false, n: l.children.length,
    first: l.children[0]?.querySelector('.cs-name')?.textContent,
    curve: l.children[0]?.querySelector('.cs-curve')?.textContent,
    expanded: document.getElementById('trSpecies').getAttribute('aria-expanded') };`);
check('con la caja vacía el buscador enseña el catálogo ordenado',
  catalogue.open && catalogue.n > 0 && catalogue.first === SPECIES[0].name, JSON.stringify(catalogue));
check('y cada fila lleva la curva al lado del nombre',
  digits(catalogue.curve || '').length >= 6, JSON.stringify(catalogue));
check('el combobox se anuncia como abierto', catalogue.expanded === 'true', catalogue.expanded);

await setVal('#trSpecies', 'gar');
await sleep(250);
const typed = await app.evalJs(`const l = document.getElementById('trSpeciesList');
  return { names: [...l.children].map(li => li.querySelector('.cs-name').textContent) };`);
check('escribir filtra, con los que empiezan igual primero',
  typed.names[0] === 'Garbodor' && typed.names.indexOf('Garchomp') < typed.names.indexOf('Gengar')
  && typed.names.includes('Gengar'), JSON.stringify(typed.names));

await setVal('#trSpecies', 'chomp');
await sleep(250);
check('también encuentra por el trozo de en medio',
  await app.evalJs(`const l = document.getElementById('trSpeciesList');
    return l.children.length === 1 && l.children[0].querySelector('.cs-name').textContent === 'Garchomp';`));

// clic de verdad sobre la sugerencia: es el camino que usa el usuario
await app.evalJs(`const li = document.querySelector('#trSpeciesList li');
  li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 1;`);
await sleep(250);
const picked = await app.evalJs(`return { value: document.getElementById('trSpecies').value,
  listOpen: document.getElementById('trSpeciesList').hidden === false,
  group: document.getElementById('trGroup').value,
  disabled: document.getElementById('trGroup').disabled };`);
check('elegir una sugerencia rellena la caja y cierra la lista',
  picked.value === 'Garchomp' && picked.listOpen === false, JSON.stringify(picked));
check('y deja la curva de esa especie amarrada',
  picked.group === 'lento' && picked.disabled === true, JSON.stringify(picked));

await setVal('#trSpecies', 'gar');
await sleep(200);
await app.evalJs(`const i = document.getElementById('trSpecies');
  i.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  i.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1;`);
await sleep(250);
check('el teclado también elige: dos flechas abajo y Enter',
  await app.evalJs("return document.getElementById('trSpecies').value;") === 'Garchomp',
  await app.evalJs("return document.getElementById('trSpecies').value;"));

await app.evalJs(`const i = document.getElementById('trSpecies');
  i.focus(); i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1;`);
await sleep(200);
check('Escape cierra la lista',
  await app.evalJs("return document.getElementById('trSpeciesList').hidden === true;"));

check('la crianza tiene su propio buscador',
  await app.evalJs("return !!document.getElementById('brSpeciesList') && !!document.querySelector('.combo-toggle[data-combo=brSpecies]');"));

await setVal('#trSpecies', 'Mewtwo');
await sleep(200);
const freed = await app.evalJs(`return { disabled: document.getElementById('trGroup').disabled,
  note: document.getElementById('trCurveNote').textContent };`);
check('una especie fuera de la tabla libera la curva',
  freed.disabled === false && /elige/.test(freed.note), JSON.stringify(freed));

await setVal('#trGroup', 'fluctuante', 'change');
await sleep(200);
check('y entonces sí se puede elegir a mano',
  digits(await app.evalJs("return document.querySelector('#trResult .price').textContent;")).includes('1640000'));

await setVal('#trSpecies', 'Garchomp');
await sleep(200);
check('volver a una especie conocida vuelve a imponer su curva',
  await app.evalJs("return document.getElementById('trGroup').value === 'lento' && document.getElementById('trGroup').disabled;"));
check('Garchomp 1 → 100 cuesta 125.000 con la tarifa por defecto',
  digits(g1.price).startsWith('125000'), g1.price);
check('el desglose enseña la experiencia que falta',
  g1.rows.some(r => digits(r).includes('1250000')), JSON.stringify(g1.rows));

await setVal('#trSpecies', 'Blissey');
await sleep(150);
const g2 = await app.evalJs(`return { group: document.getElementById('trGroup').value,
  price: document.querySelector('#trResult .price').textContent.trim() };`);
check('cambiar de especie cambia la curva y el precio',
  g2.group === 'rapido' && digits(g2.price).startsWith('80000'), JSON.stringify(g2));

await setVal('#trFrom', '40');
await sleep(150);
const g3 = await app.evalJs(`return document.querySelector('#trResult .price').textContent;`);
check('partir del nivel 40 cobra menos que partir del 1',
  Number(digits(g3).slice(0, 5)) < 80000, g3);

// el modo por experiencia tiene que caer en el mismo punto
await setVal('#trFromMode', 'exp', 'change');
await sleep(200);
const g4 = await app.evalJs(`return { from: document.getElementById('trFrom').value,
  note: document.getElementById('trFromNote').textContent,
  price: document.querySelector('#trResult .price').textContent };`);
check('al pasar a experiencia se conserva el mismo punto de partida',
  Number(g4.from) === totalExp('rapido', 40) && /nivel 40/.test(g4.note), JSON.stringify(g4));
check('y el precio no se mueve', digits(g4.price) === digits(g3), `${g4.price} vs ${g3}`);

await setVal('#trTo', '40');
await sleep(150);
check('si ya llegó al objetivo no hay nada que cobrar',
  await app.evalJs("return document.getElementById('trAdd').disabled === true;"));

await setVal('#trFromMode', 'nivel', 'change');
await setVal('#trFrom', '1');
await setVal('#trTo', '100');
await setVal('#trSpecies', 'Garchomp');
await sleep(200);
check('el nivel objetivo no pasa de 100',
  await app.evalJs("return document.getElementById('trTo').max === '100';"));
check('el tope sale escrito en la pantalla, no a mano',
  await app.evalJs("return [...document.querySelectorAll('[data-cap]')].length >= 2 && [...document.querySelectorAll('[data-cap]')].every(el => el.textContent === '100');"));

const budget = await app.evalJs(`const el = document.getElementById('trBudget');
  el.value = '10000'; el.dispatchEvent(new Event('input', { bubbles: true }));
  return document.getElementById('trBudgetOut').textContent;`);
check('el presupuesto del cliente dice hasta qué nivel llega',
  /nivel \d+/.test(budget), budget);

await app.clickReal('#trAdd');
await sleep(250);
check('añadir al pedido sube el contador',
  await app.evalJs("return document.getElementById('orderCount').textContent === '1';"));

/* --- crianza --- */
await app.clickReal('#tabBreed');
await sleep(200);
const b0 = await app.evalJs("return document.querySelector('#brResult .price').textContent;");
check('la crianza parte del precio base 150.000', digits(b0).startsWith('150000'), b0);

await setVal('#brSpecies', 'Metagross');
await sleep(200);
const b1 = await app.evalJs(`return { price: document.querySelector('#brResult .price').textContent,
  surcharge: document.getElementById('brSurcharge').value,
  note: document.getElementById('brTierNote').textContent };`);
check('una especie sin género carga su recargo sola',
  Number(b1.surcharge) === 80000 && digits(b1.price).startsWith('230000'), JSON.stringify(b1));
check('y explica por qué sube', /Ditto/.test(b1.note), b1.note);

await app.evalJs(`const c = document.getElementById('brNature'); c.checked = true;
  c.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);
await sleep(200);
check('pedir naturaleza suma su tarifa',
  digits(await app.evalJs("return document.querySelector('#brResult .price').textContent;")).startsWith('250000'));

await setVal('#brMoves', '2');
await sleep(200);
check('cada movimiento huevo suma',
  digits(await app.evalJs("return document.querySelector('#brResult .price').textContent;")).startsWith('280000'));

// El extra "entregado entrenado" sale de la EXP total de la curva, no de una
// tarifa plana: Metagross es Lento (1.250.000) y con 5.000/50.000 son 125.000.
await app.evalJs(`const c = document.getElementById('brTrained'); c.checked = true;
  c.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);
await sleep(200);
const tr1 = await app.evalJs(`return { price: document.querySelector('#brResult .price').textContent,
  tag: document.getElementById('tagTrained').textContent,
  group: document.getElementById('brGroup').value,
  locked: document.getElementById('brGroup').disabled,
  rows: [...document.querySelectorAll('#brResult .breakdown div')].map(d => d.textContent) };`);
check('la crianza también amarra la curva a la especie',
  tr1.group === 'lento' && tr1.locked === true, JSON.stringify(tr1));
check('entregarlo entrenado a 100 cobra la curva entera de la especie',
  digits(tr1.tag).startsWith('125000') && digits(tr1.price).startsWith('405000'), JSON.stringify(tr1));
check('y el desglose dice de qué experiencia sale',
  tr1.rows.some(r => digits(r).includes('1250000')), JSON.stringify(tr1.rows));

await setVal('#brSpecies', 'Milotic');
await sleep(200);
const tr2 = await app.evalJs(`return { tag: document.getElementById('tagTrained').textContent,
  group: document.getElementById('brGroup').value };`);
check('otra curva cuesta otra cosa: Milotic es Errático y son 60.000',
  tr2.group === 'erratico' && digits(tr2.tag).startsWith('60000'), JSON.stringify(tr2));

// Especie que no está en la tabla: la curva se elige a mano y el extra la sigue.
await setVal('#brSpecies', 'Mewtwo');
await sleep(200);
const free = await app.evalJs(`return { locked: document.getElementById('brGroup').disabled,
  note: document.getElementById('brCurveNote').textContent };`);
check('una especie fuera de la tabla libera también la curva de la crianza',
  free.locked === false && /elige/.test(free.note), JSON.stringify(free));

await setVal('#brGroup', 'fluctuante', 'change');
await sleep(200);
const manual = await app.evalJs(`return { tag: document.getElementById('tagTrained').textContent,
  price: document.querySelector('#brResult .price').textContent };`);
check('con la curva elegida a mano cobra esa curva (Fluctuante: 165.000)',
  digits(manual.tag).startsWith('165000') && digits(manual.price).startsWith('415000'),
  JSON.stringify(manual));

await setVal('#brQty', '2');
await sleep(200);
const two = await app.evalJs("return document.querySelector('#brResult .price').textContent;");
check('la cantidad multiplica el entrenado igual que el resto',
  digits(two).startsWith('830000') && digits(two).includes('415000'), two);
await setVal('#brQty', '1');
await sleep(150);

await setVal('#brSpecies', 'Metagross');
await sleep(200);
check('volver a una especie conocida vuelve a amarrar la curva de la crianza',
  await app.evalJs("return document.getElementById('brGroup').value === 'lento' && document.getElementById('brGroup').disabled;"));

// La línea del pedido tiene que explicar de dónde sale el precio.
await app.clickReal('#brAdd');
await sleep(250);
const withTrained = await app.evalJs(`const last = document.querySelector('#orderList .item:last-child');
  return { count: document.getElementById('orderCount').textContent,
    detail: last?.querySelector('.what span')?.textContent,
    amount: last?.querySelector('.money')?.textContent,
    quote: document.getElementById('quoteText').value };`);
check('la crianza entrenada entra al pedido por 405.000',
  withTrained.count === '2' && digits(withTrained.amount).startsWith('405000'), JSON.stringify(withTrained));
// El separador de miles depende del locale del navegador: se compara por dígitos.
check('y la línea dice de qué experiencia sale',
  /entrenado a 100 \(/.test(withTrained.detail || '')
  && digits(withTrained.detail).includes('1250000'), withTrained.detail);
const quoteLine = withTrained.quote.split('\n').find(l => /entrenado del 1 al 100/.test(l)) || '';
check('el texto del cliente lo dice en una línea y con el precio',
  /^• \*Metagross\* — crianza .*entrenado del 1 al 100: /.test(quoteLine)
  && digits(quoteLine).includes('405000'), quoteLine || withTrained.quote.slice(0, 200));
check('y no le suelta al cliente la experiencia ni la curva',
  !/EXP|curva/.test(withTrained.quote) && !digits(quoteLine).includes('1250000'),
  withTrained.quote.slice(0, 200));
check('una línea de pedido es una línea de mensaje',
  withTrained.quote.split('\n').filter(l => l.startsWith('• ')).length === 2,
  withTrained.quote);

await app.evalJs("document.querySelector('#orderList .item:last-child [data-del]').click(); return 1;");
await sleep(250);
check('quitarla deja el pedido como estaba',
  await app.evalJs("return document.getElementById('orderCount').textContent === '1';"));

await app.evalJs(`const c = document.getElementById('brTrained'); c.checked = false;
  c.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);
await sleep(200);
check('desmarcarlo lo quita del precio',
  digits(await app.evalJs("return document.querySelector('#brResult .price').textContent;")).startsWith('280000'),
  await app.evalJs("return document.querySelector('#brResult .price').textContent;"));

await app.clickReal('#brAdd');
await sleep(250);
check('la crianza también entra al pedido',
  await app.evalJs("return document.getElementById('orderCount').textContent === '2';"));

/* --- pedido --- */
await app.clickReal('#tabOrder');
await sleep(200);
const ord = await app.evalJs(`return { items: document.querySelectorAll('#orderList .item').length,
  grand: document.querySelector('#orderTotals .grand').textContent,
  quote: document.getElementById('quoteText').value };`);
check('el pedido lista las dos líneas', ord.items === 2, String(ord.items));
check('el total suma entrenamiento y crianza',
  digits(ord.grand).includes('405000'), ord.grand);
check('el texto de la cotización nombra los dos servicios',
  /Garchomp/.test(ord.quote) && /Metagross/.test(ord.quote) && /TOTAL/.test(ord.quote),
  ord.quote.slice(0, 120));

// El mensaje va a WhatsApp: rango entero y negritas donde el cliente mira.
const waLine = ord.quote.split('\n').find(l => /Garchomp/.test(l)) || '';
check('el mensaje dice el rango entero, no solo el nivel de llegada',
  /entrenar del 1 al 100/.test(waLine), waLine || ord.quote.slice(0, 200));
check('por defecto el Pokémon y el precio van en negrita de WhatsApp',
  /^• \*Garchomp\* — /.test(waLine) && /: \*[^*]+\*$/.test(waLine), waLine);
check('y el total también sale en negrita', /^\*TOTAL: .+\*$/m.test(ord.quote),
  ord.quote.slice(-140));

await app.evalJs(`const c = document.getElementById('boldPrice'); c.checked = false;
  c.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);
await sleep(200);
const noBold = await app.evalJs("return document.getElementById('quoteText').value;");
check('se puede apagar la negrita del precio y dejar la del nombre',
  /\*Garchomp\*/.test(noBold) && !/: \*/.test(noBold), noBold.slice(0, 220));
await app.evalJs(`const c = document.getElementById('boldPrice'); c.checked = true;
  c.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);
await sleep(150);

await setVal('#orderDiscount', '10');
await sleep(200);
const disc = await app.evalJs(`return { grand: document.querySelector('#orderTotals .grand').textContent,
  quote: document.getElementById('quoteText').value };`);
check('el descuento baja el total a 364.500', digits(disc.grand).includes('364500'), disc.grand);
check('y el descuento sale en el texto', /Descuento 10%/.test(disc.quote));

await setVal('#orderDeposit', '50');
await sleep(200);
check('el adelanto parte el total en dos',
  /Adelanto 50%/.test(await app.evalJs("return document.getElementById('quoteText').value;")));

await app.clickReal('[data-del]');
await sleep(250);
check('se puede quitar una línea del pedido',
  await app.evalJs("return document.querySelectorAll('#orderList .item').length === 1;"));

/* --- tarifas --- */
await app.clickReal('#tabRates');
await sleep(200);
check('ya no hay tarifa plana de "entregado entrenado"',
  await app.evalJs("return document.getElementById('rtTrained') === null;"));
await setVal('#rtPricePer', '9000');
await sleep(200);
await app.clickReal('#tabTrain');
await sleep(200);
check('cambiar la tarifa recalcula el precio al vuelo',
  digits(await app.evalJs("return document.querySelector('#trResult .price').textContent;")).startsWith('225000'),
  await app.evalJs("return document.querySelector('#trResult .price').textContent;"));

await app.clickReal('#tabBreed');
await sleep(200);
check('subir la tarifa de entrenamiento sube también el entregado entrenado',
  digits(await app.evalJs("return document.getElementById('tagTrained').textContent;")).startsWith('225000'),
  await app.evalJs("return document.getElementById('tagTrained').textContent;"));

await app.clickReal('#tabRates');
await sleep(150);
await setVal('#rtCurrency', 'P$');
await sleep(200);
await app.clickReal('#tabTrain');
await sleep(200);
check('el símbolo de moneda se aplica en todas partes',
  /P\$/.test(await app.evalJs("return document.querySelector('#trResult .price').textContent;")));

/* --- persistencia --- */
await app.send('Page.navigate', { url: `${app.base}/apps/pokeprice/` });
await sleep(1300);
const kept = await app.evalJs(`return { count: document.getElementById('orderCount').textContent,
  price: document.getElementById('rtPricePer').value,
  currency: document.getElementById('rtCurrency').value,
  species: document.getElementById('trSpecies').value };`);
check('al recargar se conservan pedido, tarifas y formulario',
  kept.count === '1' && kept.price === '9000' && kept.currency === 'P$' && kept.species === 'Garchomp',
  JSON.stringify(kept));

const keptBreed = await app.evalJs(`return { species: document.getElementById('brSpecies').value,
  group: document.getElementById('brGroup').value, locked: document.getElementById('brGroup').disabled,
  tag: document.getElementById('tagTrained').textContent };`);
check('la crianza recuerda especie, curva y lo que cuesta entregarla entrenada',
  keptBreed.species === 'Metagross' && keptBreed.group === 'lento' && keptBreed.locked === true
  && digits(keptBreed.tag).startsWith('225000'), JSON.stringify(keptBreed));

await app.clickReal('#tabRates');
await sleep(150);
await app.clickReal('#rtReset');
await sleep(300);
check('restablecer devuelve las tarifas de fábrica',
  await app.evalJs("return document.getElementById('rtPricePer').value === '5000' && document.getElementById('rtCurrency').value === '$';"));

// La versión vieja guardaba "trained: 40000" como tarifa plana: al recuperar ese
// guardado no puede volver a cobrarse, tiene que salir la curva de la especie.
await app.evalJs(`const k = 'pokeprice.v1';
  const c = JSON.parse(localStorage.getItem(k) || '{}');
  c.rates = { ...(c.rates || {}), trained: 40000 };
  localStorage.setItem(k, JSON.stringify(c)); return 1;`);
await app.send('Page.navigate', { url: `${app.base}/apps/pokeprice/` });
await sleep(1300);
check('un guardado de la versión vieja no revive la tarifa plana de 40.000',
  digits(await app.evalJs("return document.getElementById('tagTrained').textContent;")).startsWith('125000'),
  await app.evalJs("return document.getElementById('tagTrained').textContent;"));

// Un pedido guardado antes de que existieran las negritas no trae la clave, y
// una copia manoseada puede traer cualquier cosa: en los dos casos se arranca
// con las tres marcadas, no con un checkbox en blanco.
await app.evalJs(`const k = 'pokeprice.v1';
  const c = JSON.parse(localStorage.getItem(k) || '{}');
  c.order = { ...(c.order || {}) };
  delete c.order.bold;
  localStorage.setItem(k, JSON.stringify(c)); return 1;`);
await app.send('Page.navigate', { url: `${app.base}/apps/pokeprice/` });
await sleep(1300);
check('un pedido guardado sin negritas arranca con las tres puestas',
  await app.evalJs(`return ['boldName', 'boldPrice', 'boldTotal']
    .every(id => document.getElementById(id).checked);`));

await app.evalJs(`const k = 'pokeprice.v1';
  const c = JSON.parse(localStorage.getItem(k) || '{}');
  c.order = { ...(c.order || {}), bold: { name: 'sí', price: false, total: 0 } };
  localStorage.setItem(k, JSON.stringify(c)); return 1;`);
await app.send('Page.navigate', { url: `${app.base}/apps/pokeprice/` });
await sleep(1300);
const junk = await app.evalJs(`return { name: document.getElementById('boldName').checked,
  price: document.getElementById('boldPrice').checked,
  total: document.getElementById('boldTotal').checked };`);
check('solo se recupera lo que sea sí o no: el resto vuelve a su valor de fábrica',
  junk.name === true && junk.price === false && junk.total === true, JSON.stringify(junk));

await app.evalJs(`const c = document.getElementById('boldPrice'); c.checked = true;
  c.dispatchEvent(new Event('change', { bubbles: true })); return 1;`);
await sleep(150);

/* --- el mensaje que se le pega al cliente --- */
await app.clickReal('#tabTrain');
await sleep(200);
await setVal('#trFrom', '40');
await setVal('#trQty', '2');
await sleep(200);
await app.clickReal('#trAdd');
await sleep(250);
await app.clickReal('#tabOrder');
await sleep(250);
const many = await app.evalJs("return document.getElementById('quoteText').value;");
const manyLine = many.split('\n').filter(l => /Garchomp/.test(l)).pop() || '';
check('el rango del mensaje respeta el nivel de partida',
  /entrenar del 40 al 100/.test(manyLine), manyLine || many.slice(0, 200));
// WhatsApp no cierra la negrita si el asterisco toca un espacio: el ×2 y el
// "c/u" tienen que quedarse fuera de los marcadores.
check('con cantidad, la negrita envuelve al Pokémon y no al ×2',
  /^• \*Garchomp\* ×2 — /.test(manyLine), manyLine);
check('el precio va en negrita y el "c/u" se queda fuera',
  /: \*[^*]+\* \([^*]+ c\/u\)$/.test(manyLine), manyLine);

await app.evalJs(`for (const id of ['boldName', 'boldTotal']) {
  const c = document.getElementById(id); c.checked = false;
  c.dispatchEvent(new Event('change', { bubbles: true }));
} return 1;`);
await sleep(200);
const plain = await app.evalJs("return document.getElementById('quoteText').value;");
check('apagar el nombre y el total les quita los asteriscos y deja los del precio',
  !/\*Garchomp\*/.test(plain) && /^TOTAL: /m.test(plain) && /: \*/.test(plain),
  plain.slice(0, 240));

await app.send('Page.navigate', { url: `${app.base}/apps/pokeprice/` });
await sleep(1300);
const keptBold = await app.evalJs(`return { name: document.getElementById('boldName').checked,
  price: document.getElementById('boldPrice').checked,
  total: document.getElementById('boldTotal').checked,
  quote: document.getElementById('quoteText').value };`);
check('las negritas elegidas sobreviven a la recarga',
  keptBold.name === false && keptBold.price === true && keptBold.total === false
  && !/\*Garchomp\*/.test(keptBold.quote) && /: \*/.test(keptBold.quote),
  JSON.stringify(keptBold).slice(0, 240));

await app.evalJs(`for (const id of ['boldName', 'boldTotal']) {
  const c = document.getElementById(id); c.checked = true;
  c.dispatchEvent(new Event('change', { bubbles: true }));
} return 1;`);
await sleep(200);
check('volver a marcarlas las devuelve al mensaje',
  /\*Garchomp\*/.test(await app.evalJs("return document.getElementById('quoteText').value;")));

/* ---------------- móvil ---------------- */
await app.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await sleep(400);
await app.clickReal('#tabTrain');
await sleep(300);
const mob = await app.evalJs(`const doc = document.documentElement;
  const tab = document.getElementById('tabTrain').getBoundingClientRect();
  const inp = document.getElementById('trFrom');
  const btn = document.getElementById('trAdd').getBoundingClientRect();
  return { overflow: doc.scrollWidth - doc.clientWidth, tabTap: Math.round(tab.height),
    btnTap: Math.round(btn.height), fontSize: getComputedStyle(inp).fontSize };`);
check('móvil: sin scroll horizontal', mob.overflow <= 0, `desborde ${mob.overflow}px`);
check('móvil: las pestañas son tocables', mob.tabTap >= 44, `${mob.tabTap}px`);
check('móvil: el botón de añadir es tocable', mob.btnTap >= 44, `${mob.btnTap}px`);
check('móvil: los campos no hacen zoom al enfocarlos', parseFloat(mob.fontSize) >= 16, mob.fontSize);
const donateTap = await app.evalJs(`const r = document.querySelector('.donate').getBoundingClientRect();
  return { h: Math.round(r.height), w: Math.round(r.width) };`);
check('móvil: el enlace de donación es tocable',
  donateTap.h >= 44 && donateTap.w >= 44, JSON.stringify(donateTap));

await app.clickReal('#tabOrder');
await sleep(300);
check('móvil: el pedido tampoco desborda',
  await app.evalJs("const d = document.documentElement; return d.scrollWidth - d.clientWidth <= 0;"));

await app.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await sleep(300);
check('apaisado: sin scroll horizontal',
  await app.evalJs("const d = document.documentElement; return d.scrollWidth - d.clientWidth <= 0;"));

check('sin errores de consola tras toda la sesión', app.errors.length === 0, app.errors.join(' | '));

app.close();
process.exit(done() ? 1 : 0);
