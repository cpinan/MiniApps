/* Cotizador PokeMMO — entrenamiento por experiencia y crianza 2×31. Todo local. */
import { $, storage, applyTheme, initShell, THEMES, escapeHtml } from '../../assets/shared/core.js';
import {
  GROUPS, GROUP_LABELS, GROUP_TOTALS, SERVICE_CAP, TIER_LABELS,
  totalExp, levelFromExp, trainingPrice, levelForBudget, trainedDeliveryPrice,
  breedingPrice, orderTotal,
  findSpecies, searchSpecies,
} from './exp.js';

const BUILD = '2026-08-30.1';
const store = storage('pokeprice.v1');

const DEFAULT_RATES = {
  currency: '$',
  pricePer: 5000, expPer: 50000, rounding: 'bloque', min: 0,
  breedBase: 150000, tierComun: 0, tierRaro: 50000, tierSin: 80000,
  nature: 20000, gender: 15000, move: 15000, iv: 60000,
};

// Negritas del mensaje. WhatsApp pone en negrita lo que va entre asteriscos;
// por defecto resalta lo que el cliente busca de un vistazo — qué Pokémon y
// cuánto — y cada parte se puede apagar desde el pedido.
const DEFAULT_BOLD = { name: true, price: true, total: true, deposit: true, discount: true };

const state = {
  tab: 'train',
  train: { species: '', group: 'medio_lento', fromMode: 'nivel', from: 1, to: SERVICE_CAP, qty: 1, budget: '' },
  breed: {
    species: '', group: 'medio_lento', surcharge: 0,
    nature: false, gender: false, trained: false, moves: 0, ivs: 0, qty: 1,
  },
  order: { client: '', items: [], discount: 0, deposit: 0, bold: { ...DEFAULT_BOLD } },
  rates: { ...DEFAULT_RATES },
};

let nextId = 1;

/* ================= formato ================= */

const nf = new Intl.NumberFormat('es-PE');
const n0 = (v) => nf.format(Math.round(Number(v) || 0));
const money = (v) => `${state.rates.currency}${n0(v)}`;
const num = (id, fallback = 0) => {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : fallback;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// En el juego la curva se reconoce por su total al nivel 100, no por su nombre.
const curveName = (g) => `${GROUP_LABELS[g]} · ${n0(GROUP_TOTALS[g])}`;

/* ================= tarifas ================= */

const RATE_FIELDS = [
  ['rtPricePer', 'pricePer'], ['rtExpPer', 'expPer'], ['rtMin', 'min'],
  ['rtBreedBase', 'breedBase'], ['rtTierComun', 'tierComun'], ['rtTierRaro', 'tierRaro'],
  ['rtTierSin', 'tierSin'], ['rtNature', 'nature'], ['rtGender', 'gender'],
  ['rtMove', 'move'], ['rtIv', 'iv'],
];

const tariff = () => ({
  pricePer: state.rates.pricePer, expPer: state.rates.expPer,
  rounding: state.rates.rounding, min: state.rates.min,
});

const tierAmount = (tier) =>
  tier === 'sin_genero' ? state.rates.tierSin : tier === 'raro' ? state.rates.tierRaro : state.rates.tierComun;

function ratesToForm() {
  for (const [id, key] of RATE_FIELDS) $(id).value = state.rates[key];
  $('rtRounding').value = state.rates.rounding;
  $('rtCurrency').value = state.rates.currency;
}

function ratesFromForm() {
  for (const [id, key] of RATE_FIELDS) state.rates[key] = Math.max(0, num(id, DEFAULT_RATES[key]));
  state.rates.expPer = Math.max(1, state.rates.expPer);
  state.rates.rounding = $('rtRounding').value === 'exacto' ? 'exacto' : 'bloque';
  state.rates.currency = ($('rtCurrency').value || '$').slice(0, 4);
  save();
  renderAll();
}

/* ================= buscador de especies =================
 * El <datalist> nativo no sirve aquí: Chrome esconde las sugerencias cuando el
 * input lleva autocomplete="off", y Safari apenas filtra. Este combobox se
 * comporta igual en todos y encima puede enseñar la curva junto al nombre.
 */

function initCombo(inputId, listId, onPick) {
  const input = $(inputId), list = $(listId);
  let items = [], active = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };

  const paint = () => {
    [...list.children].forEach((li, i) => {
      li.classList.toggle('is-active', i === active);
      li.setAttribute('aria-selected', String(i === active));
    });
    if (active >= 0) list.children[active]?.scrollIntoView({ block: 'nearest' });
  };

  const open = (query) => {
    items = searchSpecies(query, 12);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((s, i) => `
      <li role="option" id="${listId}-${i}" aria-selected="false" data-i="${i}">
        <span class="cs-name">${escapeHtml(s.name)}</span>
        <span class="cs-curve">${n0(GROUP_TOTALS[s.group])}</span>
      </li>`).join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    paint();
  };

  const choose = (i) => {
    const s = items[i];
    if (!s) return;
    input.value = s.name;
    close();
    onPick(s.name);
  };

  input.addEventListener('input', () => open(input.value));
  input.addEventListener('focus', () => open(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) { open(input.value); return; }
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1) + items.length) % items.length;
      paint();
    } else if (e.key === 'Enter') {
      if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); }
      else close();
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // mousedown y no click: el clic dentro de la lista quitaría el foco al input
  // y el blur cerraría la lista antes de que llegue el click.
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.i));
  });
  input.addEventListener('blur', () => setTimeout(close, 120));

  const toggle = document.querySelector(`.combo-toggle[data-combo="${inputId}"]`);
  toggle?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (list.hidden) { input.focus(); open(input.value); } else close();
  });
}

/* ================= entrenamiento ================= */

// Lo que el cliente ya tiene: la EXP exacta si la dio, o la del nivel que dijo.
function trainInput() {
  const t = state.train;
  const group = t.group;
  const currentExp = t.fromMode === 'exp'
    ? clamp(Math.floor(t.from), 0, totalExp(group, SERVICE_CAP))
    : totalExp(group, clamp(Math.floor(t.from), 1, SERVICE_CAP));
  const fromLevel = levelFromExp(group, currentExp);
  const to = clamp(Math.floor(t.to), 2, SERVICE_CAP);
  const targetExp = totalExp(group, to);
  const exp = Math.max(0, targetExp - currentExp);
  return { group, currentExp, fromLevel, to, targetExp, exp };
}

/**
 * La curva es un dato de la especie, no una opción: si el Pokémon está en la
 * tabla manda él y el desplegable queda bloqueado. Solo se elige a mano cuando
 * la especie no está (o no se ha escrito ninguna). Vale para las dos pestañas:
 * en crianza la curva decide lo que cuesta entregarlo entrenado.
 */
function lockCurveToSpecies(slice, selectId, noteId) {
  const sp = findSpecies(slice.species);
  if (sp) slice.group = sp.group;
  $(selectId).value = slice.group;
  $(selectId).disabled = !!sp;
  $(noteId).textContent = sp
    ? `Curva de ${sp.name}: ${curveName(sp.group)} al nivel 100. Viene con la especie.`
    : slice.species.trim()
      ? `"${slice.species.trim()}" no está en la tabla: elige tú la curva.`
      : 'Sin especie: elige la curva a mano, o escribe el Pokémon y se pone sola.';
  return sp;
}

function renderTrain() {
  const t = state.train;
  lockCurveToSpecies(state.train, 'trGroup', 'trCurveNote');
  const { group, currentExp, fromLevel, to, targetExp, exp } = trainInput();
  const { blocks, charged, price } = trainingPrice(exp, tariff());
  const qty = clamp(Math.floor(t.qty), 1, 99);

  $('trFromLabel').textContent = t.fromMode === 'exp' ? 'Experiencia total actual' : 'Nivel actual';
  $('trFrom').max = t.fromMode === 'exp' ? totalExp(group, SERVICE_CAP) : SERVICE_CAP - 1;
  $('trFrom').step = t.fromMode === 'exp' ? 1000 : 1;
  $('trFromNote').textContent = t.fromMode === 'exp'
    ? `${n0(currentExp)} EXP = nivel ${fromLevel}.`
    : `Nivel ${fromLevel} = ${n0(currentExp)} EXP acumulada.`;

  $('leadRate').textContent = `${money(state.rates.pricePer)} por cada ${n0(state.rates.expPer)} de EXP`;

  if (exp <= 0) {
    $('trResult').innerHTML = `<p class="price">Sin trabajo que cobrar<small>Ya tiene la experiencia del nivel ${to}. Sube el nivel objetivo.</small></p>`;
    $('trAdd').disabled = true;
  } else {
    $('trAdd').disabled = false;
    const rows = [
      ['Experiencia que falta', `${n0(exp)} EXP`],
      ['Bloques de ' + n0(state.rates.expPer), state.rates.rounding === 'bloque'
        ? `${n0(charged)} (de ${blocks.toFixed(2)})`
        : blocks.toFixed(2)],
      ['Precio por Pokémon', money(price)],
    ];
    if (qty > 1) rows.push([`Cantidad`, `×${qty}`]);
    $('trResult').innerHTML = `
      <p class="price">${money(price * qty)}
        <small>Nivel ${fromLevel} → ${to} · meta ${n0(targetExp)} EXP · curva ${curveName(group)}</small></p>
      <div class="breakdown">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      ${state.rates.min > 0 && price === Math.round(state.rates.min) && exp > 0
        ? `<p class="warn">Se aplicó el mínimo de ${money(state.rates.min)}.</p>` : ''}`;
  }

  const budget = Number(t.budget);
  $('trBudgetOut').textContent = t.budget === '' || !Number.isFinite(budget) || budget <= 0
    ? 'Escribe un monto y te digo hasta qué nivel llega desde el nivel actual.'
    : (() => {
        const lv = levelForBudget(group, currentExp, budget, tariff());
        if (lv <= fromLevel) return `Con ${money(budget)} no alcanza ni para un nivel más.`;
        const gasto = trainingPrice(totalExp(group, lv) - currentExp, tariff()).price;
        return `Con ${money(budget)} llega al nivel ${lv} (cuesta ${money(gasto)}).`;
      })();
}

function addTraining() {
  const { group, currentExp, fromLevel, to, exp } = trainInput();
  if (exp <= 0) return;
  const { price } = trainingPrice(exp, tariff());
  const qty = clamp(Math.floor(state.train.qty), 1, 99);
  const name = state.train.species.trim() || 'Pokémon';
  state.order.items.push({
    id: nextId++, kind: 'train', title: `${name} · entrenamiento`,
    detail: `Nv ${fromLevel} → ${to} · ${n0(exp)} EXP · curva ${curveName(group)}`,
    // `short` es lo que ve el cliente: sin EXP ni curva, que son cuenta nuestra.
    // El rango va siempre entero ("del 1 al 100"): el cliente quiere saber desde
    // dónde se empieza, y "hasta nivel 100" se leía como si ya viniera a medias.
    short: `entrenar del ${fromLevel} al ${to}`,
    qty, unit: price, price: price * qty,
  });
  flash(`Añadido: ${name} Nv ${fromLevel} → ${to}.`);
  save();
  renderOrder();
}

/* ================= crianza ================= */

function breedInput() {
  const b = state.breed;
  // La cría sale del huevo en el nivel 1: entregarla entrenada cuesta la curva
  // entera de su especie, con la tarifa de entrenamiento. No hay precio plano.
  const curveExp = totalExp(b.group, SERVICE_CAP);
  const trained = trainedDeliveryPrice(b.group, tariff());
  const extras = [];
  if (b.nature) extras.push({ label: 'naturaleza', amount: state.rates.nature });
  if (b.gender) extras.push({ label: 'sexo', amount: state.rates.gender });
  if (b.trained) extras.push({ label: `entrenado a ${SERVICE_CAP} · ${n0(curveExp)} EXP`, amount: trained });
  const moves = clamp(Math.floor(b.moves), 0, 4);
  const ivs = clamp(Math.floor(b.ivs), 0, 4);
  if (moves > 0) extras.push({ label: `${moves} mov. huevo`, amount: state.rates.move * moves });
  if (ivs > 0) extras.push({ label: `${ivs} IV extra`, amount: state.rates.iv * ivs });
  const qty = clamp(Math.floor(b.qty), 1, 99);
  const q = breedingPrice({ base: state.rates.breedBase, surcharge: b.surcharge, extras, qty });
  return { extras, moves, ivs, qty, trained, curveExp, ...q };
}

function renderBreed() {
  const b = state.breed;
  const sp = lockCurveToSpecies(state.breed, 'brGroup', 'brCurveNote');
  const { extras, moves, ivs, qty, unit, price, trained } = breedInput();
  $('leadBreed').textContent = money(state.rates.breedBase);
  $('tagNature').textContent = `+${money(state.rates.nature)}`;
  $('tagGender').textContent = `+${money(state.rates.gender)}`;
  $('tagTrained').textContent = `+${money(trained)}`;

  $('brTierNote').textContent = sp
    ? `${sp.name}: ${TIER_LABELS[sp.tier]} → recargo sugerido ${money(tierAmount(sp.tier))}. Puedes cambiarlo a mano.`
    : 'El recargo se rellena solo según la dificultad que tenga la especie en Tarifas; puedes cambiarlo a mano.';

  const rows = [['Base 2×31', money(state.rates.breedBase)]];
  if (b.surcharge) rows.push(['Recargo por especie', money(b.surcharge)]);
  for (const e of extras) rows.push([e.label[0].toUpperCase() + e.label.slice(1), money(e.amount)]);
  if (qty > 1) rows.push(['Cantidad', `×${qty}`]);

  const label = [`2×31`, moves ? `${moves} mov. huevo` : '', ivs ? `${ivs} IV extra` : '']
    .filter(Boolean).join(' · ');
  $('brResult').innerHTML = `
    <p class="price">${money(price)}<small>${escapeHtml(sp?.name || b.species.trim() || 'Especie sin indicar')} · ${label}${qty > 1 ? ` · ${money(unit)} c/u` : ''}</small></p>
    <div class="breakdown">${rows.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${v}</b></div>`).join('')}</div>`;
}

function addBreeding() {
  const { moves, ivs, qty, unit, price } = breedInput();
  const name = findSpecies(state.breed.species)?.name || state.breed.species.trim() || 'Pokémon';
  const bits = ['2×31'];
  if (state.breed.nature) bits.push('naturaleza');
  if (state.breed.gender) bits.push('sexo');
  if (moves) bits.push(`${moves} mov. huevo`);
  if (ivs) bits.push(`${ivs} IV extra`);
  const short = bits.slice();
  if (state.breed.trained) {
    bits.push(`entrenado a ${SERVICE_CAP} (${n0(totalExp(state.breed.group, SERVICE_CAP))} EXP)`);
    short.push(`entrenado del 1 al ${SERVICE_CAP}`);
  }
  state.order.items.push({
    id: nextId++, kind: 'breed', title: `${name} · crianza`,
    detail: bits.join(' · '),
    short: `crianza ${short.join(', ')}`,
    qty, unit, price,
  });
  flash(`Añadido: ${name} 2×31.`);
  save();
  renderOrder();
}

/* ================= pedido ================= */

function renderOrder() {
  const items = state.order.items;
  $('orderCount').textContent = String(items.length);
  $('orderList').innerHTML = items.length
    ? items.map(i => `
      <div class="item" data-id="${i.id}">
        <div class="what"><strong>${escapeHtml(i.title)}${i.qty > 1 ? ` ×${i.qty}` : ''}</strong>
          <span>${escapeHtml(i.detail)}</span></div>
        <span class="money">${money(i.price)}</span>
        <button class="ghost danger" type="button" data-del="${i.id}" aria-label="Quitar">✕</button>
      </div>`).join('')
    : '<p class="empty">Todavía no hay nada. Añade entrenamientos o crianzas desde sus pestañas.</p>';
  $('orderList').querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      state.order.items = state.order.items.filter(i => String(i.id) !== b.dataset.del);
      save(); renderOrder();
    }));

  const t = orderTotal(items, { discountPct: state.order.discount, depositPct: state.order.deposit });
  const rows = [['Subtotal', money(t.subtotal)]];
  if (t.discount > 0) rows.push([`Descuento (${state.order.discount}%)`, `−${money(t.discount)}`]);
  $('orderTotals').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')
    + `<div class="grand"><span>Total</span><b>${money(t.total)}</b></div>`
    + (t.deposit > 0
      ? `<div><span>Adelanto (${state.order.deposit}%)</span><b>${money(t.deposit)}</b></div>
         <div><span>Contra entrega</span><b>${money(t.rest)}</b></div>` : '');

  $('quoteText').value = quoteText(t);
  $('copyQuote').disabled = items.length === 0;
  $('shareQuote').disabled = items.length === 0;
}

/**
 * El texto que se le manda al cliente. Es un mensaje de WhatsApp, no una
 * factura: una línea por servicio, en palabras, y el total. La experiencia, la
 * curva y el desglose de tarifas se quedan en la pantalla, que es donde le
 * sirven a quien cotiza; repetirlos aquí solo hacía el mensaje ilegible.
 */
function quoteText(t) {
  const items = state.order.items;
  if (!items.length) return 'Añade algo al pedido y aquí aparece el texto listo para copiar.';
  const client = state.order.client.trim();
  const b = state.order.bold;
  const strong = (text, on) => (on ? `*${text}*` : text);
  // WhatsApp no tiene manera de escapar sus marcadores: un asterisco suelto
  // dentro de un nombre escrito a mano corta la negrita a media palabra y el
  // resto del mensaje se ve torcido. Se cae del mensaje, no de la pantalla.
  const clean = (text) => text.replace(/\*/g, '').trim();
  const lines = [];
  lines.push(`Cotización · servicios PokeMMO${client ? ` · para ${clean(client)}` : ''}`);
  lines.push(new Date().toLocaleDateString('es-PE'));
  lines.push('');
  for (const i of items) {
    // El título ya trae " · entrenamiento"/" · crianza": la línea corta lo dice mejor.
    const name = clean(i.title.split(' · ')[0]) || 'Pokémon';
    const what = i.short || i.detail;
    // La cantidad se queda fuera de los asteriscos: WhatsApp no cierra la
    // negrita si el marcador queda pegado a un espacio.
    lines.push(`• ${strong(name, b.name)}${i.qty > 1 ? ` ×${i.qty}` : ''} — ${what}: `
      + strong(money(i.price), b.price)
      + (i.qty > 1 ? ` (${money(i.unit)} c/u)` : ''));
  }
  lines.push('');
  if (t.discount > 0) {
    // El subtotal es de dónde viene el número; lo que se resalta es la rebaja,
    // que es la parte que el cliente agradece.
    lines.push(`Subtotal: ${money(t.subtotal)}`);
    lines.push(`Descuento ${state.order.discount}%: `
      + strong(`−${money(t.discount)}`, b.discount));
  }
  lines.push(strong(`TOTAL: ${money(t.total)}`, b.total));
  if (t.deposit > 0) {
    // Lo que el cliente paga hoy va en negrita aparte del total: es la cifra
    // que tiene que mirar cuando abre el mensaje.
    lines.push(`Adelanto ${state.order.deposit}%: ${strong(money(t.deposit), b.deposit)}`
      + ` · el resto al entregar: ${money(t.rest)}`);
  }
  return lines.join('\n');
}

async function copyQuote() {
  const text = $('quoteText').value;
  try {
    await navigator.clipboard.writeText(text);
    flash('Cotización copiada.');
  } catch {
    $('quoteText').removeAttribute('readonly');
    $('quoteText').select();
    const ok = document.execCommand?.('copy');
    $('quoteText').setAttribute('readonly', '');
    flash(ok ? 'Cotización copiada.' : 'Copia el texto a mano: el navegador no dejó.');
  }
}

/* ================= pestañas y render ================= */

const TABS = [['train', 'tabTrain', 'panelTrain'], ['breed', 'tabBreed', 'panelBreed'],
  ['order', 'tabOrder', 'panelOrder'], ['rates', 'tabRates', 'panelRates']];

const BOLD_FIELDS = [['boldName', 'name'], ['boldPrice', 'price'], ['boldTotal', 'total'],
  ['boldDeposit', 'deposit'], ['boldDiscount', 'discount']];

function setTab(name) {
  state.tab = name;
  for (const [key, tab, panel] of TABS) {
    const on = key === name;
    $(tab).classList.toggle('is-on', on);
    $(tab).setAttribute('aria-selected', String(on));
    $(panel).hidden = !on;
  }
  save();
}

function renderAll() { renderTrain(); renderBreed(); renderOrder(); }

let flashTimer = 0;
function flash(msg) {
  $('statusLine').textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { $('statusLine').textContent = ''; }, 3500);
}

/* ================= arranque de los controles ================= */

function fillStatic() {
  const curveOptions = GROUPS.map(g => `<option value="${g}">${curveName(g)}</option>`).join('');
  $('trGroup').innerHTML = curveOptions;
  $('brGroup').innerHTML = curveOptions;
  // El tope del servicio se escribe una sola vez, en exp.js: de ahí salen tanto el
  // texto de la pantalla como los límites de los campos de nivel.
  for (const el of document.querySelectorAll('[data-cap]')) el.textContent = String(SERVICE_CAP);
  $('trTo').max = SERVICE_CAP;
  $('trTo').value = SERVICE_CAP;
  $('trFrom').max = SERVICE_CAP - 1;
}

function bind() {
  // Al cambiar de pestaña se vuelve arriba: en móvil, si no, se cae a media
  // sección y no se ve ni qué pestaña quedó activa.
  for (const [key, tab] of TABS) $(tab).addEventListener('click', () => { setTab(key); window.scrollTo(0, 0); });

  // --- entrenamiento
  const onSpeciesTyped = () => { state.train.species = $('trSpecies').value; save(); renderTrain(); };
  $('trSpecies').addEventListener('input', onSpeciesTyped);
  initCombo('trSpecies', 'trSpeciesList', onSpeciesTyped);
  $('trGroup').addEventListener('change', () => {
    state.train.group = $('trGroup').value; save(); renderTrain();
  });
  $('trFromMode').addEventListener('change', () => {
    const prev = trainInput();
    state.train.fromMode = $('trFromMode').value;
    // al cambiar de modo se conserva el mismo punto: nivel ⇄ experiencia
    state.train.from = state.train.fromMode === 'exp' ? prev.currentExp : prev.fromLevel;
    $('trFrom').value = state.train.from;
    save(); renderTrain();
  });
  $('trFrom').addEventListener('input', () => { state.train.from = num('trFrom', 1); save(); renderTrain(); });
  $('trTo').addEventListener('input', () => { state.train.to = num('trTo', SERVICE_CAP); save(); renderTrain(); });
  $('trQty').addEventListener('input', () => { state.train.qty = num('trQty', 1); save(); renderTrain(); });
  $('trBudget').addEventListener('input', () => { state.train.budget = $('trBudget').value; save(); renderTrain(); });
  $('trAdd').addEventListener('click', addTraining);

  // --- crianza
  const onBreedSpeciesTyped = () => {
    state.breed.species = $('brSpecies').value;
    const sp = findSpecies(state.breed.species);
    if (sp) { state.breed.surcharge = tierAmount(sp.tier); $('brSurcharge').value = state.breed.surcharge; }
    save(); renderBreed();
  };
  $('brSpecies').addEventListener('input', onBreedSpeciesTyped);
  initCombo('brSpecies', 'brSpeciesList', onBreedSpeciesTyped);
  $('brGroup').addEventListener('change', () => {
    state.breed.group = $('brGroup').value; save(); renderBreed();
  });
  $('brSurcharge').addEventListener('input', () => { state.breed.surcharge = Math.max(0, num('brSurcharge')); save(); renderBreed(); });
  for (const [id, key] of [['brNature', 'nature'], ['brGender', 'gender'], ['brTrained', 'trained']]) {
    $(id).addEventListener('change', () => { state.breed[key] = $(id).checked; save(); renderBreed(); });
  }
  for (const [id, key] of [['brMoves', 'moves'], ['brIvs', 'ivs'], ['brQty', 'qty']]) {
    $(id).addEventListener('input', () => { state.breed[key] = num(id, key === 'qty' ? 1 : 0); save(); renderBreed(); });
  }
  $('brAdd').addEventListener('click', addBreeding);

  // --- pedido
  $('clientName').addEventListener('input', () => { state.order.client = $('clientName').value; save(); renderOrder(); });
  $('orderDiscount').addEventListener('input', () => { state.order.discount = clamp(num('orderDiscount'), 0, 100); save(); renderOrder(); });
  $('orderDeposit').addEventListener('input', () => { state.order.deposit = clamp(num('orderDeposit'), 0, 100); save(); renderOrder(); });
  for (const [id, key] of BOLD_FIELDS) {
    $(id).addEventListener('change', () => { state.order.bold[key] = $(id).checked; save(); renderOrder(); });
  }
  $('copyQuote').addEventListener('click', copyQuote);
  $('shareQuote').addEventListener('click', async () => {
    const text = $('quoteText').value;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelado */ } }
    copyQuote();
  });
  $('clearOrder').addEventListener('click', () => {
    state.order.items = []; save(); renderOrder(); flash('Pedido vaciado.');
  });

  // --- tarifas
  for (const [id] of RATE_FIELDS) $(id).addEventListener('input', ratesFromForm);
  $('rtRounding').addEventListener('change', ratesFromForm);
  $('rtCurrency').addEventListener('input', ratesFromForm);
  $('rtReset').addEventListener('click', () => {
    state.rates = { ...DEFAULT_RATES };
    ratesToForm(); save(); renderAll(); flash('Tarifas restablecidas.');
  });

  $('themeBtn').addEventListener('click', () => {
    const i = THEMES.indexOf(document.body.dataset.theme);
    const next = THEMES[(i + 1) % THEMES.length];
    applyTheme(next === 'custom' ? 'pokemon' : next);
    save();
  });
}

/* ================= persistencia ================= */

function save() {
  store.write({
    tab: state.tab, train: state.train, breed: state.breed,
    order: state.order, rates: state.rates, theme: document.body.dataset.theme,
  });
}

function restore() {
  const c = store.read();
  if (!c) return;
  // Solo se recuperan las tarifas que siguen existiendo: así una copia vieja no
  // revive un campo que ya no se cobra (p. ej. el precio plano de "entrenado").
  if (c.rates) for (const k of Object.keys(DEFAULT_RATES)) {
    if (c.rates[k] !== undefined) state.rates[k] = c.rates[k];
  }
  if (c.train) Object.assign(state.train, c.train);
  if (c.breed) Object.assign(state.breed, c.breed);
  if (c.order) {
    Object.assign(state.order, c.order);
    state.order.items = Array.isArray(c.order.items) ? c.order.items : [];
    state.order.bold = { ...DEFAULT_BOLD };
    for (const [, key] of BOLD_FIELDS) {
      if (typeof c.order.bold?.[key] === 'boolean') state.order.bold[key] = c.order.bold[key];
    }
    nextId = state.order.items.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0) + 1;
  }
  if (!GROUPS.includes(state.train.group)) state.train.group = 'medio_lento';
  if (!GROUPS.includes(state.breed.group)) state.breed.group = 'medio_lento';
  if (TABS.some(([k]) => k === c.tab)) state.tab = c.tab;
  if (THEMES.includes(c.theme)) applyTheme(c.theme);
}

function stateToForm() {
  $('trSpecies').value = state.train.species;
  $('trGroup').value = state.train.group;
  $('trFromMode').value = state.train.fromMode;
  $('trFrom').value = state.train.from;
  $('trTo').value = state.train.to;
  $('trQty').value = state.train.qty;
  $('trBudget').value = state.train.budget;
  $('brSpecies').value = state.breed.species;
  $('brGroup').value = state.breed.group;
  $('brSurcharge').value = state.breed.surcharge;
  $('brNature').checked = state.breed.nature;
  $('brGender').checked = state.breed.gender;
  $('brTrained').checked = state.breed.trained;
  $('brMoves').value = state.breed.moves;
  $('brIvs').value = state.breed.ivs;
  $('brQty').value = state.breed.qty;
  $('clientName').value = state.order.client;
  $('orderDiscount').value = state.order.discount;
  $('orderDeposit').value = state.order.deposit;
  for (const [id, key] of BOLD_FIELDS) $(id).checked = state.order.bold[key];
  ratesToForm();
}

/* ================= arranque ================= */

fillStatic();
restore();
stateToForm();
bind();
applyTheme(document.body.dataset.theme);
setTab(state.tab);
renderAll();
initShell({ build: BUILD, name: 'Cotizador PokeMMO' });
