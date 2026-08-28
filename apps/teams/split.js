/** Reparto de equipos. Sin DOM, para poder testearlo directo. */
import { parseNames, shuffle } from '../../assets/shared/core.js';

export const norm = (s) => s.trim().toLocaleLowerCase('es');

/** Parejas que no pueden coincidir: una por línea, "A, B". */
export function parseApart(raw) {
  return String(raw || '').split(/\r?\n/)
    .map(line => parseNames(line))
    .filter(pair => pair.length >= 2)
    .map(pair => [norm(pair[0]), norm(pair[1])]);
}

function violates(teams, apart) {
  for (const [a, b] of apart) {
    for (const team of teams) {
      const set = team.map(norm);
      if (set.includes(a) && set.includes(b)) return true;
    }
  }
  return false;
}

function deal(names, teamCount, captains, balance) {
  const teams = Array.from({ length: teamCount }, () => []);
  const capSet = new Set(captains.map(norm));

  // Un capitán por equipo, repartidos al azar; los que sobren van al montón común.
  const caps = shuffle(names.filter(n => capSet.has(norm(n)))).slice(0, teamCount);
  caps.forEach((c, i) => teams[i].push(c));

  const capsUsed = new Set(caps.map(norm));
  const rest = shuffle(names.filter(n => !capsUsed.has(norm(n))));

  if (balance) {
    // Siempre al equipo más pequeño: el sobrante se reparte uno a uno.
    for (const n of rest) {
      const order = teams.map((t, idx) => ({ idx, len: t.length }))
        .sort((a, b) => a.len - b.len || a.idx - b.idx);
      teams[order[0].idx].push(n);
    }
  } else {
    const per = Math.ceil(rest.length / teamCount);
    rest.forEach((n, i) => teams[Math.min(teamCount - 1, Math.floor(i / per))].push(n));
  }
  return teams;
}

/**
 * Reparte respetando las restricciones. Si las parejas "no juntar" son imposibles,
 * reintenta y devuelve el mejor intento con aviso: más vale repartir y avisar que
 * quedarse sin repartir.
 */
export function split(names, opts) {
  const { mode = 'teams', amount = 2, balance = true, captains = [], apart = [] } = opts || {};
  const warnings = [];
  if (!names.length) return { teams: [], warnings: ['No hay nadie en la lista.'] };

  const teamCount = mode === 'size'
    ? Math.max(1, Math.ceil(names.length / Math.max(1, amount)))
    : Math.max(1, Math.min(amount, names.length));

  if (mode === 'teams' && amount > names.length) {
    warnings.push(`Solo hay ${names.length} personas: se hacen ${teamCount} equipos.`);
  }

  let teams = deal(names, teamCount, captains, balance);
  if (apart.length) {
    let tries = 0;
    while (violates(teams, apart) && tries < 300) { teams = deal(names, teamCount, captains, balance); tries++; }
    if (violates(teams, apart)) {
      warnings.push('No se pudieron respetar todas las parejas separadas; este es el mejor intento.');
    }
  }
  return { teams, warnings };
}
