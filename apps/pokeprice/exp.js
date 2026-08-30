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
 * Dos datos por especie: el grupo de crecimiento (dato del juego, es lo que
 * decide la EXP) y una sugerencia de dificultad de crianza (criterio de mercado,
 * editable en Tarifas). La tabla es el Pokédex completo de las cinco regiones de
 * PokeMMO (Kanto a Teselia) menos los legendarios, que no se obtienen ni se
 * crían en el juego; los grupos salen de la tabla `personal` de la ROM de Black
 * (a/0/1/6, byte 0x15), así que son los mismos que usa PokeMMO.
 * Dificultad: comun | raro | sin_genero
 */
export const TIERS = ['comun', 'raro', 'sin_genero'];
export const TIER_LABELS = { comun: 'Común', raro: 'Raro / caro de conseguir', sin_genero: 'Sin género (solo cruza con Ditto)' };

const S = (name, group, tier = 'comun') => ({ name, group, tier });

const SPECIES_RAW = [
  // Kanto
  S('Bulbasaur', 'medio_lento', 'raro'), S('Ivysaur', 'medio_lento', 'raro'), S('Venusaur', 'medio_lento', 'raro'),
  S('Charmander', 'medio_lento', 'raro'), S('Charmeleon', 'medio_lento', 'raro'), S('Charizard', 'medio_lento', 'raro'),
  S('Squirtle', 'medio_lento', 'raro'), S('Wartortle', 'medio_lento', 'raro'), S('Blastoise', 'medio_lento', 'raro'),
  S('Caterpie', 'medio_rapido'), S('Metapod', 'medio_rapido'), S('Butterfree', 'medio_rapido'),
  S('Weedle', 'medio_rapido'), S('Kakuna', 'medio_rapido'), S('Beedrill', 'medio_rapido'),
  S('Pidgey', 'medio_lento'), S('Pidgeotto', 'medio_lento'), S('Pidgeot', 'medio_lento'),
  S('Rattata', 'medio_rapido'), S('Raticate', 'medio_rapido'), S('Spearow', 'medio_rapido'),
  S('Fearow', 'medio_rapido'), S('Ekans', 'medio_rapido'), S('Arbok', 'medio_rapido'),
  S('Pikachu', 'medio_rapido'), S('Raichu', 'medio_rapido'), S('Sandshrew', 'medio_rapido'),
  S('Sandslash', 'medio_rapido'), S('Nidoran hembra', 'medio_lento'), S('Nidorina', 'medio_lento'),
  S('Nidoqueen', 'medio_lento'), S('Nidoran macho', 'medio_lento'), S('Nidorino', 'medio_lento'),
  S('Nidoking', 'medio_lento'), S('Clefairy', 'rapido'), S('Clefable', 'rapido'),
  S('Vulpix', 'medio_rapido'), S('Ninetales', 'medio_rapido'), S('Jigglypuff', 'rapido'),
  S('Wigglytuff', 'rapido'), S('Zubat', 'medio_rapido'), S('Golbat', 'medio_rapido'),
  S('Oddish', 'medio_lento'), S('Gloom', 'medio_lento'), S('Vileplume', 'medio_lento'),
  S('Paras', 'medio_rapido'), S('Parasect', 'medio_rapido'), S('Venonat', 'medio_rapido'),
  S('Venomoth', 'medio_rapido'), S('Diglett', 'medio_rapido'), S('Dugtrio', 'medio_rapido'),
  S('Meowth', 'medio_rapido'), S('Persian', 'medio_rapido'), S('Psyduck', 'medio_rapido'),
  S('Golduck', 'medio_rapido'), S('Mankey', 'medio_rapido'), S('Primeape', 'medio_rapido'),
  S('Growlithe', 'lento'), S('Arcanine', 'lento'), S('Poliwag', 'medio_lento'),
  S('Poliwhirl', 'medio_lento'), S('Poliwrath', 'medio_lento'), S('Abra', 'medio_lento'),
  S('Kadabra', 'medio_lento'), S('Alakazam', 'medio_lento'), S('Machop', 'medio_lento'),
  S('Machoke', 'medio_lento'), S('Machamp', 'medio_lento'), S('Bellsprout', 'medio_lento'),
  S('Weepinbell', 'medio_lento'), S('Victreebel', 'medio_lento'), S('Tentacool', 'lento'),
  S('Tentacruel', 'lento'), S('Geodude', 'medio_lento'), S('Graveler', 'medio_lento'),
  S('Golem', 'medio_lento'), S('Ponyta', 'medio_rapido'), S('Rapidash', 'medio_rapido'),
  S('Slowpoke', 'medio_rapido'), S('Slowbro', 'medio_rapido'), S('Magnemite', 'medio_rapido', 'sin_genero'),
  S('Magneton', 'medio_rapido', 'sin_genero'), S('Farfetch\'d', 'medio_rapido'), S('Doduo', 'medio_rapido'),
  S('Dodrio', 'medio_rapido'), S('Seel', 'medio_rapido'), S('Dewgong', 'medio_rapido'),
  S('Grimer', 'medio_rapido'), S('Muk', 'medio_rapido'), S('Shellder', 'lento'),
  S('Cloyster', 'lento'), S('Gastly', 'medio_lento'), S('Haunter', 'medio_lento'),
  S('Gengar', 'medio_lento'), S('Onix', 'medio_rapido'), S('Drowzee', 'medio_rapido'),
  S('Hypno', 'medio_rapido'), S('Krabby', 'medio_rapido'), S('Kingler', 'medio_rapido'),
  S('Voltorb', 'medio_rapido', 'sin_genero'), S('Electrode', 'medio_rapido', 'sin_genero'), S('Exeggcute', 'lento'),
  S('Exeggutor', 'lento'), S('Cubone', 'medio_rapido'), S('Marowak', 'medio_rapido'),
  S('Hitmonlee', 'medio_rapido'), S('Hitmonchan', 'medio_rapido'), S('Lickitung', 'medio_rapido'),
  S('Koffing', 'medio_rapido'), S('Weezing', 'medio_rapido'), S('Rhyhorn', 'lento'),
  S('Rhydon', 'lento'), S('Chansey', 'rapido'), S('Tangela', 'medio_rapido'),
  S('Kangaskhan', 'medio_rapido'), S('Horsea', 'medio_rapido'), S('Seadra', 'medio_rapido'),
  S('Goldeen', 'medio_rapido'), S('Seaking', 'medio_rapido'), S('Staryu', 'lento', 'sin_genero'),
  S('Starmie', 'lento', 'sin_genero'), S('Mr. Mime', 'medio_rapido'), S('Scyther', 'medio_rapido', 'raro'),
  S('Jynx', 'medio_rapido'), S('Electabuzz', 'medio_rapido', 'raro'), S('Magmar', 'medio_rapido', 'raro'),
  S('Pinsir', 'lento'), S('Tauros', 'lento'), S('Magikarp', 'lento'),
  S('Gyarados', 'lento'), S('Lapras', 'lento', 'raro'), S('Ditto', 'medio_rapido', 'sin_genero'),
  S('Eevee', 'medio_rapido'), S('Vaporeon', 'medio_rapido'), S('Jolteon', 'medio_rapido'),
  S('Flareon', 'medio_rapido'), S('Porygon', 'medio_rapido', 'sin_genero'), S('Omanyte', 'medio_rapido', 'raro'),
  S('Omastar', 'medio_rapido', 'raro'), S('Kabuto', 'medio_rapido', 'raro'), S('Kabutops', 'medio_rapido', 'raro'),
  S('Aerodactyl', 'lento', 'raro'), S('Snorlax', 'lento', 'raro'), S('Dratini', 'lento', 'raro'),
  S('Dragonair', 'lento', 'raro'), S('Dragonite', 'lento', 'raro'),

  // Johto
  S('Chikorita', 'medio_lento', 'raro'), S('Bayleef', 'medio_lento', 'raro'), S('Meganium', 'medio_lento', 'raro'),
  S('Cyndaquil', 'medio_lento', 'raro'), S('Quilava', 'medio_lento', 'raro'), S('Typhlosion', 'medio_lento', 'raro'),
  S('Totodile', 'medio_lento', 'raro'), S('Croconaw', 'medio_lento', 'raro'), S('Feraligatr', 'medio_lento', 'raro'),
  S('Sentret', 'medio_rapido'), S('Furret', 'medio_rapido'), S('Hoothoot', 'medio_rapido'),
  S('Noctowl', 'medio_rapido'), S('Ledyba', 'rapido'), S('Ledian', 'rapido'),
  S('Spinarak', 'rapido'), S('Ariados', 'rapido'), S('Crobat', 'medio_rapido'),
  S('Chinchou', 'lento'), S('Lanturn', 'lento'), S('Pichu', 'medio_rapido'),
  S('Cleffa', 'rapido'), S('Igglybuff', 'rapido'), S('Togepi', 'rapido', 'raro'),
  S('Togetic', 'rapido', 'raro'), S('Natu', 'medio_rapido'), S('Xatu', 'medio_rapido'),
  S('Mareep', 'medio_lento'), S('Flaaffy', 'medio_lento'), S('Ampharos', 'medio_lento'),
  S('Bellossom', 'medio_lento'), S('Marill', 'rapido'), S('Azumarill', 'rapido'),
  S('Sudowoodo', 'medio_rapido'), S('Politoed', 'medio_lento'), S('Hoppip', 'medio_lento'),
  S('Skiploom', 'medio_lento'), S('Jumpluff', 'medio_lento'), S('Aipom', 'rapido'),
  S('Sunkern', 'medio_lento'), S('Sunflora', 'medio_lento'), S('Yanma', 'medio_rapido'),
  S('Wooper', 'medio_rapido'), S('Quagsire', 'medio_rapido'), S('Espeon', 'medio_rapido'),
  S('Umbreon', 'medio_rapido'), S('Murkrow', 'medio_lento'), S('Slowking', 'medio_rapido'),
  S('Misdreavus', 'rapido'), S('Unown', 'medio_rapido', 'sin_genero'), S('Wobbuffet', 'medio_rapido'),
  S('Girafarig', 'medio_rapido'), S('Pineco', 'medio_rapido'), S('Forretress', 'medio_rapido'),
  S('Dunsparce', 'medio_rapido'), S('Gligar', 'medio_lento', 'raro'), S('Steelix', 'medio_rapido'),
  S('Snubbull', 'rapido'), S('Granbull', 'rapido'), S('Qwilfish', 'medio_rapido'),
  S('Scizor', 'medio_rapido', 'raro'), S('Shuckle', 'medio_lento'), S('Heracross', 'lento', 'raro'),
  S('Sneasel', 'medio_lento', 'raro'), S('Teddiursa', 'medio_rapido'), S('Ursaring', 'medio_rapido'),
  S('Slugma', 'medio_rapido'), S('Magcargo', 'medio_rapido'), S('Swinub', 'lento'),
  S('Piloswine', 'lento'), S('Corsola', 'rapido'), S('Remoraid', 'medio_rapido'),
  S('Octillery', 'medio_rapido'), S('Delibird', 'rapido'), S('Mantine', 'lento'),
  S('Skarmory', 'lento', 'raro'), S('Houndour', 'lento'), S('Houndoom', 'lento'),
  S('Kingdra', 'medio_rapido'), S('Phanpy', 'medio_rapido'), S('Donphan', 'medio_rapido'),
  S('Porygon2', 'medio_rapido', 'sin_genero'), S('Stantler', 'lento'), S('Smeargle', 'rapido'),
  S('Tyrogue', 'medio_rapido'), S('Hitmontop', 'medio_rapido'), S('Smoochum', 'medio_rapido'),
  S('Elekid', 'medio_rapido', 'raro'), S('Magby', 'medio_rapido', 'raro'), S('Miltank', 'lento'),
  S('Blissey', 'rapido'), S('Larvitar', 'lento', 'raro'), S('Pupitar', 'lento', 'raro'),
  S('Tyranitar', 'lento', 'raro'),

  // Hoenn
  S('Treecko', 'medio_lento', 'raro'), S('Grovyle', 'medio_lento', 'raro'), S('Sceptile', 'medio_lento', 'raro'),
  S('Torchic', 'medio_lento', 'raro'), S('Combusken', 'medio_lento', 'raro'), S('Blaziken', 'medio_lento', 'raro'),
  S('Mudkip', 'medio_lento', 'raro'), S('Marshtomp', 'medio_lento', 'raro'), S('Swampert', 'medio_lento', 'raro'),
  S('Poochyena', 'medio_rapido'), S('Mightyena', 'medio_rapido'), S('Zigzagoon', 'medio_rapido'),
  S('Linoone', 'medio_rapido'), S('Wurmple', 'medio_rapido'), S('Silcoon', 'medio_rapido'),
  S('Beautifly', 'medio_rapido'), S('Cascoon', 'medio_rapido'), S('Dustox', 'medio_rapido'),
  S('Lotad', 'medio_lento'), S('Lombre', 'medio_lento'), S('Ludicolo', 'medio_lento'),
  S('Seedot', 'medio_lento'), S('Nuzleaf', 'medio_lento'), S('Shiftry', 'medio_lento'),
  S('Taillow', 'medio_lento'), S('Swellow', 'medio_lento'), S('Wingull', 'medio_rapido'),
  S('Pelipper', 'medio_rapido'), S('Ralts', 'lento', 'raro'), S('Kirlia', 'lento', 'raro'),
  S('Gardevoir', 'lento', 'raro'), S('Surskit', 'medio_rapido'), S('Masquerain', 'medio_rapido'),
  S('Shroomish', 'fluctuante'), S('Breloom', 'fluctuante'), S('Slakoth', 'lento'),
  S('Vigoroth', 'lento'), S('Slaking', 'lento'), S('Nincada', 'erratico'),
  S('Ninjask', 'erratico'), S('Shedinja', 'erratico', 'sin_genero'), S('Whismur', 'medio_lento'),
  S('Loudred', 'medio_lento'), S('Exploud', 'medio_lento'), S('Makuhita', 'fluctuante'),
  S('Hariyama', 'fluctuante'), S('Azurill', 'rapido'), S('Nosepass', 'medio_rapido'),
  S('Skitty', 'rapido'), S('Delcatty', 'rapido'), S('Sableye', 'medio_lento'),
  S('Mawile', 'rapido'), S('Aron', 'lento'), S('Lairon', 'lento'),
  S('Aggron', 'lento'), S('Meditite', 'medio_rapido'), S('Medicham', 'medio_rapido'),
  S('Electrike', 'lento'), S('Manectric', 'lento'), S('Plusle', 'medio_rapido'),
  S('Minun', 'medio_rapido'), S('Volbeat', 'erratico'), S('Illumise', 'fluctuante'),
  S('Roselia', 'medio_lento'), S('Gulpin', 'fluctuante'), S('Swalot', 'fluctuante'),
  S('Carvanha', 'lento'), S('Sharpedo', 'lento'), S('Wailmer', 'fluctuante'),
  S('Wailord', 'fluctuante'), S('Numel', 'medio_rapido'), S('Camerupt', 'medio_rapido'),
  S('Torkoal', 'medio_rapido'), S('Spoink', 'rapido'), S('Grumpig', 'rapido'),
  S('Spinda', 'rapido'), S('Trapinch', 'medio_lento'), S('Vibrava', 'medio_lento'),
  S('Flygon', 'medio_lento'), S('Cacnea', 'medio_lento'), S('Cacturne', 'medio_lento'),
  S('Swablu', 'erratico'), S('Altaria', 'erratico'), S('Zangoose', 'erratico'),
  S('Seviper', 'fluctuante'), S('Lunatone', 'rapido', 'sin_genero'), S('Solrock', 'rapido', 'sin_genero'),
  S('Barboach', 'medio_rapido'), S('Whiscash', 'medio_rapido'), S('Corphish', 'fluctuante'),
  S('Crawdaunt', 'fluctuante'), S('Baltoy', 'medio_rapido', 'sin_genero'), S('Claydol', 'medio_rapido', 'sin_genero'),
  S('Lileep', 'erratico', 'raro'), S('Cradily', 'erratico', 'raro'), S('Anorith', 'erratico', 'raro'),
  S('Armaldo', 'erratico', 'raro'), S('Feebas', 'erratico', 'raro'), S('Milotic', 'erratico', 'raro'),
  S('Castform', 'medio_rapido'), S('Kecleon', 'medio_lento'), S('Shuppet', 'rapido'),
  S('Banette', 'rapido'), S('Duskull', 'rapido'), S('Dusclops', 'rapido'),
  S('Tropius', 'lento'), S('Chimecho', 'rapido'), S('Absol', 'medio_lento'),
  S('Wynaut', 'medio_rapido'), S('Snorunt', 'medio_rapido'), S('Glalie', 'medio_rapido'),
  S('Spheal', 'medio_lento'), S('Sealeo', 'medio_lento'), S('Walrein', 'medio_lento'),
  S('Clamperl', 'erratico'), S('Huntail', 'erratico'), S('Gorebyss', 'erratico'),
  S('Relicanth', 'lento'), S('Luvdisc', 'rapido'), S('Bagon', 'lento', 'raro'),
  S('Shelgon', 'lento', 'raro'), S('Salamence', 'lento', 'raro'), S('Beldum', 'lento', 'sin_genero'),
  S('Metang', 'lento', 'sin_genero'), S('Metagross', 'lento', 'sin_genero'),

  // Sinnoh
  S('Turtwig', 'medio_lento', 'raro'), S('Grotle', 'medio_lento', 'raro'), S('Torterra', 'medio_lento', 'raro'),
  S('Chimchar', 'medio_lento', 'raro'), S('Monferno', 'medio_lento', 'raro'), S('Infernape', 'medio_lento', 'raro'),
  S('Piplup', 'medio_lento', 'raro'), S('Prinplup', 'medio_lento', 'raro'), S('Empoleon', 'medio_lento', 'raro'),
  S('Starly', 'medio_lento'), S('Staravia', 'medio_lento'), S('Staraptor', 'medio_lento'),
  S('Bidoof', 'medio_rapido'), S('Bibarel', 'medio_rapido'), S('Kricketot', 'medio_lento'),
  S('Kricketune', 'medio_lento'), S('Shinx', 'medio_lento'), S('Luxio', 'medio_lento'),
  S('Luxray', 'medio_lento'), S('Budew', 'medio_lento'), S('Roserade', 'medio_lento'),
  S('Cranidos', 'erratico', 'raro'), S('Rampardos', 'erratico', 'raro'), S('Shieldon', 'erratico', 'raro'),
  S('Bastiodon', 'erratico', 'raro'), S('Burmy', 'medio_rapido'), S('Wormadam', 'medio_rapido'),
  S('Mothim', 'medio_rapido'), S('Combee', 'medio_lento'), S('Vespiquen', 'medio_lento'),
  S('Pachirisu', 'medio_rapido'), S('Buizel', 'medio_rapido'), S('Floatzel', 'medio_rapido'),
  S('Cherubi', 'medio_rapido'), S('Cherrim', 'medio_rapido'), S('Shellos', 'medio_rapido'),
  S('Gastrodon', 'medio_rapido'), S('Ambipom', 'rapido'), S('Drifloon', 'fluctuante'),
  S('Drifblim', 'fluctuante'), S('Buneary', 'medio_rapido'), S('Lopunny', 'medio_rapido'),
  S('Mismagius', 'rapido'), S('Honchkrow', 'medio_lento'), S('Glameow', 'rapido'),
  S('Purugly', 'rapido'), S('Chingling', 'rapido'), S('Stunky', 'medio_rapido'),
  S('Skuntank', 'medio_rapido'), S('Bronzor', 'medio_rapido', 'sin_genero'), S('Bronzong', 'medio_rapido', 'sin_genero'),
  S('Bonsly', 'medio_rapido'), S('Mime Jr.', 'medio_rapido'), S('Happiny', 'rapido'),
  S('Chatot', 'medio_lento'), S('Spiritomb', 'medio_rapido'), S('Gible', 'lento', 'raro'),
  S('Gabite', 'lento', 'raro'), S('Garchomp', 'lento', 'raro'), S('Munchlax', 'lento', 'raro'),
  S('Riolu', 'medio_lento', 'raro'), S('Lucario', 'medio_lento', 'raro'), S('Hippopotas', 'lento'),
  S('Hippowdon', 'lento'), S('Skorupi', 'lento'), S('Drapion', 'lento'),
  S('Croagunk', 'medio_rapido'), S('Toxicroak', 'medio_rapido'), S('Carnivine', 'lento'),
  S('Finneon', 'erratico'), S('Lumineon', 'erratico'), S('Mantyke', 'lento'),
  S('Snover', 'lento'), S('Abomasnow', 'lento'), S('Weavile', 'medio_lento', 'raro'),
  S('Magnezone', 'medio_rapido', 'sin_genero'), S('Lickilicky', 'medio_rapido'), S('Rhyperior', 'lento'),
  S('Tangrowth', 'medio_rapido'), S('Electivire', 'medio_rapido', 'raro'), S('Magmortar', 'medio_rapido', 'raro'),
  S('Togekiss', 'rapido', 'raro'), S('Yanmega', 'medio_rapido'), S('Leafeon', 'medio_rapido'),
  S('Glaceon', 'medio_rapido'), S('Gliscor', 'medio_lento', 'raro'), S('Mamoswine', 'lento'),
  S('Porygon-Z', 'medio_rapido', 'sin_genero'), S('Gallade', 'lento', 'raro'), S('Probopass', 'medio_rapido'),
  S('Dusknoir', 'rapido'), S('Froslass', 'medio_rapido'), S('Rotom', 'medio_rapido', 'sin_genero'),

  // Teselia
  S('Snivy', 'medio_lento', 'raro'), S('Servine', 'medio_lento', 'raro'), S('Serperior', 'medio_lento', 'raro'),
  S('Tepig', 'medio_lento', 'raro'), S('Pignite', 'medio_lento', 'raro'), S('Emboar', 'medio_lento', 'raro'),
  S('Oshawott', 'medio_lento', 'raro'), S('Dewott', 'medio_lento', 'raro'), S('Samurott', 'medio_lento', 'raro'),
  S('Patrat', 'medio_rapido'), S('Watchog', 'medio_rapido'), S('Lillipup', 'medio_lento'),
  S('Herdier', 'medio_lento'), S('Stoutland', 'medio_lento'), S('Purrloin', 'medio_rapido'),
  S('Liepard', 'medio_rapido'), S('Pansage', 'medio_rapido'), S('Simisage', 'medio_rapido'),
  S('Pansear', 'medio_rapido'), S('Simisear', 'medio_rapido'), S('Panpour', 'medio_rapido'),
  S('Simipour', 'medio_rapido'), S('Munna', 'rapido'), S('Musharna', 'rapido'),
  S('Pidove', 'medio_lento'), S('Tranquill', 'medio_lento'), S('Unfezant', 'medio_lento'),
  S('Blitzle', 'medio_rapido'), S('Zebstrika', 'medio_rapido'), S('Roggenrola', 'medio_lento'),
  S('Boldore', 'medio_lento'), S('Gigalith', 'medio_lento'), S('Woobat', 'medio_rapido'),
  S('Swoobat', 'medio_rapido'), S('Drilbur', 'medio_rapido'), S('Excadrill', 'medio_rapido'),
  S('Audino', 'rapido'), S('Timburr', 'medio_lento'), S('Gurdurr', 'medio_lento'),
  S('Conkeldurr', 'medio_lento'), S('Tympole', 'medio_lento'), S('Palpitoad', 'medio_lento'),
  S('Seismitoad', 'medio_lento'), S('Throh', 'medio_rapido'), S('Sawk', 'medio_rapido'),
  S('Sewaddle', 'medio_lento'), S('Swadloon', 'medio_lento'), S('Leavanny', 'medio_lento'),
  S('Venipede', 'medio_lento'), S('Whirlipede', 'medio_lento'), S('Scolipede', 'medio_lento'),
  S('Cottonee', 'medio_rapido'), S('Whimsicott', 'medio_rapido'), S('Petilil', 'medio_rapido'),
  S('Lilligant', 'medio_rapido'), S('Basculin', 'medio_rapido'), S('Sandile', 'medio_lento'),
  S('Krokorok', 'medio_lento'), S('Krookodile', 'medio_lento'), S('Darumaka', 'medio_lento'),
  S('Darmanitan', 'medio_lento'), S('Maractus', 'medio_rapido'), S('Dwebble', 'medio_rapido'),
  S('Crustle', 'medio_rapido'), S('Scraggy', 'medio_rapido'), S('Scrafty', 'medio_rapido'),
  S('Sigilyph', 'medio_rapido'), S('Yamask', 'medio_rapido'), S('Cofagrigus', 'medio_rapido'),
  S('Tirtouga', 'medio_rapido', 'raro'), S('Carracosta', 'medio_rapido', 'raro'), S('Archen', 'medio_rapido', 'raro'),
  S('Archeops', 'medio_rapido', 'raro'), S('Trubbish', 'medio_rapido'), S('Garbodor', 'medio_rapido'),
  S('Zorua', 'medio_lento', 'raro'), S('Zoroark', 'medio_lento', 'raro'), S('Minccino', 'rapido'),
  S('Cinccino', 'rapido'), S('Gothita', 'medio_lento'), S('Gothorita', 'medio_lento'),
  S('Gothitelle', 'medio_lento'), S('Solosis', 'medio_lento'), S('Duosion', 'medio_lento'),
  S('Reuniclus', 'medio_lento'), S('Ducklett', 'medio_rapido'), S('Swanna', 'medio_rapido'),
  S('Vanillite', 'lento'), S('Vanillish', 'lento'), S('Vanilluxe', 'lento'),
  S('Deerling', 'medio_rapido'), S('Sawsbuck', 'medio_rapido'), S('Emolga', 'medio_rapido'),
  S('Karrablast', 'medio_rapido'), S('Escavalier', 'medio_rapido'), S('Foongus', 'medio_rapido'),
  S('Amoonguss', 'medio_rapido'), S('Frillish', 'medio_rapido'), S('Jellicent', 'medio_rapido'),
  S('Alomomola', 'rapido'), S('Joltik', 'medio_rapido'), S('Galvantula', 'medio_rapido'),
  S('Ferroseed', 'medio_rapido'), S('Ferrothorn', 'medio_rapido'), S('Klink', 'medio_lento', 'sin_genero'),
  S('Klang', 'medio_lento', 'sin_genero'), S('Klinklang', 'medio_lento', 'sin_genero'), S('Tynamo', 'lento'),
  S('Eelektrik', 'lento'), S('Eelektross', 'lento'), S('Elgyem', 'medio_rapido'),
  S('Beheeyem', 'medio_rapido'), S('Litwick', 'medio_lento', 'raro'), S('Lampent', 'medio_lento', 'raro'),
  S('Chandelure', 'medio_lento', 'raro'), S('Axew', 'lento', 'raro'), S('Fraxure', 'lento', 'raro'),
  S('Haxorus', 'lento', 'raro'), S('Cubchoo', 'medio_rapido'), S('Beartic', 'medio_rapido'),
  S('Cryogonal', 'medio_rapido', 'sin_genero'), S('Shelmet', 'medio_rapido'), S('Accelgor', 'medio_rapido'),
  S('Stunfisk', 'medio_rapido'), S('Mienfoo', 'medio_lento'), S('Mienshao', 'medio_lento'),
  S('Druddigon', 'medio_rapido'), S('Golett', 'medio_rapido', 'sin_genero'), S('Golurk', 'medio_rapido', 'sin_genero'),
  S('Pawniard', 'medio_rapido'), S('Bisharp', 'medio_rapido'), S('Bouffalant', 'medio_rapido'),
  S('Rufflet', 'lento'), S('Braviary', 'lento'), S('Vullaby', 'lento'),
  S('Mandibuzz', 'lento'), S('Heatmor', 'medio_rapido'), S('Durant', 'medio_rapido'),
  S('Deino', 'lento', 'raro'), S('Zweilous', 'lento', 'raro'), S('Hydreigon', 'lento', 'raro'),
  S('Larvesta', 'lento', 'raro'), S('Volcarona', 'lento', 'raro'),
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
