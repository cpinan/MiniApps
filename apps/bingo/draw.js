/** Bolillero: qué queda en el bombo y qué sale. Sin DOM, para poder testearlo directo. */
import { randomInt } from '../../assets/shared/core.js';

export function remaining(max, drawn) {
  const out = new Set(drawn);
  const rest = [];
  for (let n = 1; n <= max; n++) if (!out.has(n)) rest.push(n);
  return rest;
}

/** Saca uno de los que quedan; null si ya salieron todos. */
export function nextNumber(max, drawn) {
  const rest = remaining(max, drawn);
  return rest.length ? rest[randomInt(rest.length)] : null;
}
