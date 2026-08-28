/**
 * Tabla de efectividad de tipos (gen 6 en adelante, 18 tipos).
 * Solo se listan los valores distintos de 1: lo que no aparece es neutral.
 * Datos, no assets: la tabla es un hecho del juego, se escribe a mano y no
 * depende de ninguna API.
 */
export const TYPES = [
  'normal', 'fuego', 'agua', 'electrico', 'planta', 'hielo', 'lucha', 'veneno', 'tierra',
  'volador', 'psiquico', 'bicho', 'roca', 'fantasma', 'dragon', 'siniestro', 'acero', 'hada',
];

export const LABELS = {
  normal: 'Normal', fuego: 'Fuego', agua: 'Agua', electrico: 'Eléctrico', planta: 'Planta',
  hielo: 'Hielo', lucha: 'Lucha', veneno: 'Veneno', tierra: 'Tierra', volador: 'Volador',
  psiquico: 'Psíquico', bicho: 'Bicho', roca: 'Roca', fantasma: 'Fantasma', dragon: 'Dragón',
  siniestro: 'Siniestro', acero: 'Acero', hada: 'Hada',
};

export const COLORS = {
  normal: '#9FA19F', fuego: '#E62829', agua: '#2980EF', electrico: '#FAC000', planta: '#3FA129',
  hielo: '#3FD8FF', lucha: '#FF8000', veneno: '#9141CB', tierra: '#915121', volador: '#81B9EF',
  psiquico: '#EF4179', bicho: '#91A119', roca: '#AFA981', fantasma: '#704170', dragon: '#5060E1',
  siniestro: '#624D4E', acero: '#60A1B8', hada: '#EF70EF',
};

/** ATTACK[atacante][defensor] = multiplicador (los ausentes valen 1). */
export const ATTACK = {
  normal:    { roca: 0.5, fantasma: 0, acero: 0.5 },
  fuego:     { fuego: 0.5, agua: 0.5, planta: 2, hielo: 2, bicho: 2, roca: 0.5, dragon: 0.5, acero: 2 },
  agua:      { fuego: 2, agua: 0.5, planta: 0.5, tierra: 2, roca: 2, dragon: 0.5 },
  electrico: { agua: 2, electrico: 0.5, planta: 0.5, tierra: 0, volador: 2, dragon: 0.5 },
  planta:    { fuego: 0.5, agua: 2, planta: 0.5, veneno: 0.5, tierra: 2, volador: 0.5, bicho: 0.5, roca: 2, dragon: 0.5, acero: 0.5 },
  hielo:     { fuego: 0.5, agua: 0.5, planta: 2, hielo: 0.5, tierra: 2, volador: 2, dragon: 2, acero: 0.5 },
  lucha:     { normal: 2, hielo: 2, veneno: 0.5, volador: 0.5, psiquico: 0.5, bicho: 0.5, roca: 2, fantasma: 0, siniestro: 2, acero: 2, hada: 0.5 },
  veneno:    { planta: 2, veneno: 0.5, tierra: 0.5, roca: 0.5, fantasma: 0.5, acero: 0, hada: 2 },
  tierra:    { fuego: 2, electrico: 2, planta: 0.5, veneno: 2, volador: 0, bicho: 0.5, roca: 2, acero: 2 },
  volador:   { electrico: 0.5, planta: 2, lucha: 2, bicho: 2, roca: 0.5, acero: 0.5 },
  psiquico:  { lucha: 2, veneno: 2, psiquico: 0.5, siniestro: 0, acero: 0.5 },
  bicho:     { fuego: 0.5, planta: 2, lucha: 0.5, veneno: 0.5, volador: 0.5, psiquico: 2, fantasma: 0.5, siniestro: 2, acero: 0.5, hada: 0.5 },
  roca:      { fuego: 2, hielo: 2, lucha: 0.5, tierra: 0.5, volador: 2, bicho: 2, acero: 0.5 },
  fantasma:  { normal: 0, psiquico: 2, fantasma: 2, siniestro: 0.5 },
  dragon:    { dragon: 2, acero: 0.5, hada: 0 },
  siniestro: { lucha: 0.5, psiquico: 2, fantasma: 2, siniestro: 0.5, hada: 0.5 },
  acero:     { fuego: 0.5, agua: 0.5, electrico: 0.5, hielo: 2, roca: 2, acero: 0.5, hada: 2 },
  hada:      { fuego: 0.5, lucha: 2, veneno: 0.5, dragon: 2, siniestro: 2, acero: 0.5 },
};

/** Multiplicador de `attacker` contra un defensor de uno o dos tipos. */
export function multiplier(attacker, defenders) {
  return defenders.filter(Boolean).reduce((m, d) => m * (ATTACK[attacker]?.[d] ?? 1), 1);
}

/** Lo que hace un tipo al atacar: {mult: [tipos]}. */
export function offense(attacker) {
  const out = {};
  for (const d of TYPES) {
    const m = multiplier(attacker, [d]);
    if (m === 1) continue;
    (out[m] ||= []).push(d);
  }
  return out;
}

/** Lo que recibe un defensor de uno o dos tipos: {mult: [tipos atacantes]}. */
export function defense(defenders) {
  const out = {};
  for (const a of TYPES) {
    const m = multiplier(a, defenders);
    (out[m] ||= []).push(a);
  }
  return out;
}
