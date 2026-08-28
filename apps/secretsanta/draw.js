/** Sorteo del amigo secreto. Sin DOM, para poder testearlo directo. */
import { parseNames, shuffle } from '../../assets/shared/core.js';

export const norm = (s) => s.trim().toLocaleLowerCase('es');

/** Pares prohibidos, en ambos sentidos: si A no le regala a B, B tampoco a A. */
export function parsePairs(raw) {
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const p = parseNames(line);
    if (p.length >= 2) out.push([norm(p[0]), norm(p[1])]);
  }
  return out;
}

const forbidden = (pairs, a, b) =>
  pairs.some(([x, y]) => (x === norm(a) && y === norm(b)) || (x === norm(b) && y === norm(a)));

/**
 * Reparte en un único ciclo: cada uno regala al siguiente y el último al primero.
 * Un ciclo garantiza tres cosas de golpe — nadie se toca a sí mismo, nadie queda
 * fuera, y con 3 o más no hay parejas mutuas (A→B y B→A), que es lo que arruina
 * la gracia del juego.
 */
export function draw(names, pairs = []) {
  const warnings = [];
  if (names.length < 2) return { pairsOut: [], warnings: ['Hacen falta al menos 2 participantes.'] };

  const ok = (order) => order.every((n, i) => !forbidden(pairs, n, order[(i + 1) % order.length]));

  let order = shuffle(names), tries = 0;
  while (pairs.length && !ok(order) && tries < 500) { order = shuffle(names); tries++; }
  if (pairs.length && !ok(order)) {
    warnings.push('No se pudieron respetar todas las exclusiones; este es el mejor intento.');
  }
  return { pairsOut: order.map((from, i) => ({ from, to: order[(i + 1) % order.length] })), warnings };
}
