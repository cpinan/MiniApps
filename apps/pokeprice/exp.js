/**
 * Cotizador PokeMMO — lógica pura: curvas de experiencia, tabla de especies y precios.
 * Sin DOM y sin red, para que los tests la puedan importar tal cual.
 */

/* ================= curvas de experiencia ================= */

export const GROUPS = ['erratico', 'rapido', 'medio_rapido', 'medio_lento', 'lento', 'fluctuante'];

export const GROUP_LABELS = {
  erratico: 'Errático',
  rapido: 'Rápido',
  medio_rapido: 'Medio rápido',
  medio_lento: 'Medio lento',
  lento: 'Lento',
  fluctuante: 'Fluctuante',
};

// Nivel tope del servicio: el formulario no deja pasar de aquí y es el mismo
// número que sale en la pantalla y en la cotización.
export const SERVICE_CAP = 100;
export const MAX_LEVEL = 100;

const cube = (n) => n * n * n;

// Fórmulas de gen 3+ (las que usa PokeMMO). Devuelven la EXP total acumulada
// para *estar* en ese nivel; el nivel 1 siempre es 0.
const CURVES = {
  erratico(n) {
    if (n < 50) return Math.floor(cube(n) * (100 - n) / 50);
    if (n < 68) return Math.floor(cube(n) * (150 - n) / 100);
    if (n < 98) return Math.floor(cube(n) * Math.floor((1911 - 10 * n) / 3) / 500);
    return Math.floor(cube(n) * (160 - n) / 100);
  },
  rapido: (n) => Math.floor(4 * cube(n) / 5),
  medio_rapido: (n) => cube(n),
  medio_lento: (n) => Math.floor(6 * cube(n) / 5 - 15 * n * n + 100 * n - 140),
  lento: (n) => Math.floor(5 * cube(n) / 4),
  fluctuante(n) {
    if (n < 15) return Math.floor(cube(n) * ((Math.floor((n + 1) / 3) + 24) / 50));
    if (n < 36) return Math.floor(cube(n) * ((n + 14) / 50));
    return Math.floor(cube(n) * ((Math.floor(n / 2) + 32) / 50));
  },
};

export function totalExp(group, level) {
  const f = CURVES[group];
  if (!f) throw new Error(`grupo de crecimiento desconocido: ${group}`);
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return n <= 1 ? 0 : f(n);
}

/**
 * Total de experiencia al nivel 100 de cada curva. En PokeMMO esta cifra es como
 * se nombra la curva: el jugador no dice "medio lento", dice "es de 1.059.860".
 */
export const GROUP_TOTALS = Object.fromEntries(GROUPS.map(g => [g, totalExp(g, 100)]));

/** EXP que falta para pasar de `from` a `to`. Nunca negativa. */
export function expBetween(group, from, to) {
  return Math.max(0, totalExp(group, to) - totalExp(group, from));
}

/** Nivel al que corresponde una EXP total dada (el mayor nivel ya alcanzado). */
export function levelFromExp(group, exp) {
  const e = Math.max(0, Math.floor(Number(exp) || 0));
  let lv = 1;
  for (let n = 2; n <= MAX_LEVEL; n++) {
    if (totalExp(group, n) <= e) lv = n; else break;
  }
  return lv;
}

/* ================= precios ================= */

/**
 * Entrenamiento: X monedas por cada Y de experiencia.
 * `rounding` 'bloque' cobra el bloque empezado; 'exacto' cobra proporcional.
 */
export function trainingPrice(exp, { pricePer, expPer, rounding = 'bloque', min = 0 } = {}) {
  const needed = Math.max(0, Math.floor(Number(exp) || 0));
  const per = Math.max(1, Math.floor(Number(expPer) || 1));
  const rate = Math.max(0, Number(pricePer) || 0);
  const blocks = needed / per;
  const charged = rounding === 'exacto' ? blocks : Math.ceil(blocks);
  let price = Math.round(charged * rate);
  if (needed > 0 && min > 0) price = Math.max(price, Math.round(min));
  if (needed === 0) price = 0;
  return { exp: needed, blocks, charged, price };
}

/**
 * Hasta qué nivel alcanza un presupuesto. Se parte de la EXP total que ya tiene
 * el Pokémon, no de su nivel, para que cuadre también cuando el cliente da la
 * experiencia exacta y está a medio nivel.
 */
export function levelForBudget(group, currentExp, budget, tariff, cap = SERVICE_CAP) {
  const have = Math.max(0, Math.floor(Number(currentExp) || 0));
  const money = Math.max(0, Number(budget) || 0);
  const from = levelFromExp(group, have);
  let best = from;
  for (let n = from + 1; n <= cap; n++) {
    const { price } = trainingPrice(Math.max(0, totalExp(group, n) - have), tariff);
    if (price <= money) best = n; else break;
  }
  return best;
}

/**
 * Entregar la cría ya entrenada al tope. Un Pokémon recién criado nace en el
 * nivel 1 con 0 de experiencia, así que lo que se cobra es la curva ENTERA de su
 * especie con la misma tarifa que el entrenamiento suelto: un Lento (1.250.000)
 * cuesta el doble que un Errático (600.000). No es una tarifa plana.
 */
export function trainedDeliveryPrice(group, tariff, cap = SERVICE_CAP) {
  return trainingPrice(totalExp(group, cap), tariff).price;
}

/** Crianza: base 2×31 + recargo de especie + extras, por cantidad. */
export function breedingPrice({ base = 0, surcharge = 0, extras = [], qty = 1 } = {}) {
  const unit = Math.max(0, Math.round(
    (Number(base) || 0) + (Number(surcharge) || 0)
    + extras.reduce((s, e) => s + (Number(e?.amount ?? e) || 0), 0)));
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  return { unit, qty: n, price: unit * n };
}

/** Totales del pedido: subtotal, descuento y adelanto. */
export function orderTotal(items, { discountPct = 0, depositPct = 0 } = {}) {
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const dp = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const discount = Math.round(subtotal * dp / 100);
  const total = subtotal - discount;
  const deposit = Math.round(total * Math.min(100, Math.max(0, Number(depositPct) || 0)) / 100);
  return { subtotal, discount, total, deposit, rest: total - deposit };
}

/* ================= especies ================= */

/**
 * Solo dos datos por especie: el grupo de crecimiento (dato del juego, es lo que
 * decide la EXP) y una sugerencia de dificultad de crianza (criterio de mercado,
 * editable en Tarifas). La lista es de las especies que más se piden; para
 * cualquier otra, el grupo se elige a mano en el formulario.
 * Dificultad: comun | raro | sin_genero
 */
export const TIERS = ['comun', 'raro', 'sin_genero'];
export const TIER_LABELS = { comun: 'Común', raro: 'Raro / caro de conseguir', sin_genero: 'Sin género (solo Ditto)' };

const S = (name, group, tier = 'comun') => ({ name, group, tier });

const SPECIES_RAW = [
  // iniciales (todos medio lento)
  S('Venusaur', 'medio_lento', 'raro'), S('Charizard', 'medio_lento', 'raro'), S('Blastoise', 'medio_lento', 'raro'),
  S('Meganium', 'medio_lento', 'raro'), S('Typhlosion', 'medio_lento', 'raro'), S('Feraligatr', 'medio_lento', 'raro'),
  S('Sceptile', 'medio_lento', 'raro'), S('Blaziken', 'medio_lento', 'raro'), S('Swampert', 'medio_lento', 'raro'),
  S('Torterra', 'medio_lento', 'raro'), S('Infernape', 'medio_lento', 'raro'), S('Empoleon', 'medio_lento', 'raro'),
  S('Serperior', 'medio_lento', 'raro'), S('Emboar', 'medio_lento', 'raro'), S('Samurott', 'medio_lento', 'raro'),

  // pseudolegendarios y dragones
  S('Dragonite', 'lento', 'raro'), S('Tyranitar', 'lento', 'raro'), S('Salamence', 'lento', 'raro'),
  S('Metagross', 'lento', 'sin_genero'), S('Garchomp', 'lento', 'raro'), S('Hydreigon', 'lento', 'raro'),
  S('Haxorus', 'lento', 'raro'), S('Flygon', 'medio_lento'), S('Kingdra', 'medio_rapido'),
  S('Altaria', 'erratico'), S('Druddigon', 'medio_rapido'),

  // muy pedidos en PvP
  S('Blissey', 'rapido'), S('Chansey', 'rapido'), S('Snorlax', 'lento', 'raro'),
  S('Gengar', 'medio_lento'), S('Alakazam', 'medio_lento'), S('Machamp', 'medio_lento'),
  S('Gyarados', 'lento'), S('Lapras', 'lento', 'raro'), S('Arcanine', 'lento'),
  S('Starmie', 'lento'), S('Cloyster', 'lento'), S('Aerodactyl', 'lento', 'raro'),
  S('Heracross', 'lento', 'raro'), S('Scizor', 'medio_rapido', 'raro'), S('Skarmory', 'lento', 'raro'),
  S('Crobat', 'medio_rapido'), S('Weezing', 'medio_rapido'), S('Ninetales', 'medio_rapido'),
  S('Slowbro', 'medio_rapido'), S('Slowking', 'medio_rapido'), S('Magnezone', 'medio_rapido', 'sin_genero'),
  S('Dugtrio', 'medio_rapido'), S('Rhyperior', 'lento'), S('Steelix', 'medio_rapido'),
  S('Tentacruel', 'lento'), S('Venomoth', 'medio_rapido'), S('Tangrowth', 'medio_rapido'),
  S('Porygon2', 'medio_rapido', 'sin_genero'), S('Porygon-Z', 'medio_rapido', 'sin_genero'),
  S('Clefable', 'rapido'), S('Wigglytuff', 'rapido'), S('Hitmonlee', 'medio_rapido'),
  S('Hitmonchan', 'medio_rapido'), S('Hitmontop', 'medio_rapido'), S('Sandslash', 'medio_rapido'),
  S('Golem', 'medio_lento'), S('Nidoking', 'medio_lento'), S('Nidoqueen', 'medio_lento'),
  S('Omastar', 'medio_rapido', 'raro'), S('Kabutops', 'medio_rapido', 'raro'), S('Ditto', 'medio_rapido', 'sin_genero'),

  // eeveelutions
  S('Eevee', 'medio_rapido'), S('Vaporeon', 'medio_rapido'), S('Jolteon', 'medio_rapido'),
  S('Flareon', 'medio_rapido'), S('Espeon', 'medio_rapido'), S('Umbreon', 'medio_rapido'),
  S('Leafeon', 'medio_rapido'), S('Glaceon', 'medio_rapido'),

  // Johto / Hoenn
  S('Togekiss', 'rapido', 'raro'), S('Azumarill', 'rapido'), S('Ampharos', 'medio_rapido'),
  S('Forretress', 'medio_rapido'), S('Ursaring', 'medio_rapido'), S('Donphan', 'medio_rapido'),
  S('Miltank', 'lento'), S('Houndoom', 'lento'), S('Magcargo', 'medio_rapido'),
  S('Mantine', 'medio_rapido'), S('Lanturn', 'lento'), S('Sudowoodo', 'medio_rapido'),
  S('Gardevoir', 'lento', 'raro'), S('Gallade', 'lento', 'raro'), S('Milotic', 'erratico', 'raro'),
  S('Breloom', 'fluctuante'), S('Hariyama', 'fluctuante'), S('Aggron', 'lento'),
  S('Manectric', 'lento'), S('Camerupt', 'medio_rapido'), S('Sharpedo', 'lento'),
  S('Ludicolo', 'medio_lento'), S('Shiftry', 'medio_lento'),
  S('Absol', 'medio_lento'), S('Sableye', 'medio_lento'), S('Torkoal', 'medio_rapido'),
  S('Walrein', 'medio_lento'), S('Crawdaunt', 'fluctuante'), S('Claydol', 'medio_rapido', 'sin_genero'),
  S('Glalie', 'medio_rapido'), S('Froslass', 'medio_rapido'), S('Banette', 'rapido'),
  S('Dusclops', 'medio_lento'), S('Dusknoir', 'medio_lento'), S('Cradily', 'erratico', 'raro'),
  S('Armaldo', 'erratico', 'raro'), S('Wobbuffet', 'medio_rapido'),

  // Sinnoh
  S('Lucario', 'medio_lento', 'raro'), S('Weavile', 'medio_lento', 'raro'), S('Mamoswine', 'lento'),
  S('Gliscor', 'medio_lento', 'raro'), S('Roserade', 'medio_lento'), S('Electivire', 'medio_lento', 'raro'),
  S('Magmortar', 'medio_lento', 'raro'), S('Toxicroak', 'medio_lento'), S('Hippowdon', 'lento'),
  S('Drapion', 'medio_rapido'), S('Bronzong', 'medio_rapido', 'sin_genero'), S('Lickilicky', 'medio_rapido'),
  S('Rotom', 'medio_rapido', 'sin_genero'), S('Staraptor', 'medio_lento'), S('Luxray', 'medio_lento'),
  S('Floatzel', 'medio_rapido'), S('Rampardos', 'erratico', 'raro'), S('Bastiodon', 'erratico', 'raro'),

  // Unova
  S('Volcarona', 'lento', 'raro'), S('Excadrill', 'medio_rapido'), S('Conkeldurr', 'medio_lento'),
  S('Ferrothorn', 'medio_rapido'), S('Chandelure', 'medio_lento', 'raro'), S('Reuniclus', 'medio_lento'),
  S('Krookodile', 'medio_lento'), S('Scrafty', 'medio_rapido'), S('Bisharp', 'medio_rapido'),
  S('Cofagrigus', 'medio_rapido'), S('Galvantula', 'medio_rapido'), S('Amoonguss', 'medio_rapido'),
  S('Jellicent', 'lento'), S('Braviary', 'lento'), S('Mandibuzz', 'lento'),
  S('Sigilyph', 'medio_rapido'), S('Zoroark', 'medio_lento', 'raro'), S('Whimsicott', 'medio_rapido'),
  S('Lilligant', 'medio_rapido'), S('Klinklang', 'medio_rapido', 'sin_genero'), S('Golurk', 'medio_lento', 'sin_genero'),
  S('Seismitoad', 'medio_lento'), S('Leavanny', 'medio_rapido'), S('Scolipede', 'medio_rapido'),
  S('Crustle', 'medio_rapido'), S('Zebstrika', 'medio_rapido'), S('Darmanitan', 'medio_lento'),
  S('Gigalith', 'medio_lento'), S('Carracosta', 'medio_rapido', 'raro'), S('Archeops', 'medio_rapido', 'raro'),
  S('Beartic', 'medio_rapido'), S('Cryogonal', 'medio_rapido', 'sin_genero'), S('Accelgor', 'medio_rapido'),
  S('Escavalier', 'medio_rapido'), S('Durant', 'medio_rapido'), S('Heatmor', 'medio_rapido'),
  S('Alomomola', 'rapido'), S('Eelektross', 'lento'), S('Vanilluxe', 'lento'),
];

// La lista se escribe agrupada por región para poder revisarla, pero se publica
// ordenada: es lo que ve el usuario en el desplegable.
export const SPECIES = SPECIES_RAW.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));

const fold = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const INDEX = new Map(SPECIES.map(s => [fold(s.name), s]));

/** Busca una especie por nombre exacto (sin tildes, sin guiones, sin mayúsculas). */
export const findSpecies = (name) => INDEX.get(fold(name)) || null;

/**
 * Sugerencias del buscador: primero las que empiezan por lo escrito, después las
 * que lo contienen. Con la caja vacía devuelve el principio de la lista, para
 * que el desplegable sirva también de catálogo.
 */
export function searchSpecies(query, limit = 10) {
  const q = fold(query);
  if (!q) return SPECIES.slice(0, limit);
  const starts = [], contains = [];
  for (const s of SPECIES) {
    const k = fold(s.name);
    if (k.startsWith(q)) starts.push(s);
    else if (k.includes(q)) contains.push(s);
  }
  return starts.concat(contains).slice(0, limit);
}
