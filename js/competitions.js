// Copas, seleções, chaves, grupos e calendário da temporada.
// Tudo aqui roda tanto no navegador quanto no Node (sem DOM).

import {
  COUNTRIES, COUNTRY_BY_CODE, NATIONAL_TEAMS, NATION_BY_CODE, CONFEDERATIONS, GENERIC_NAMES,
} from './data.js';
import { clamp, ri, pick, hash, seededRng, poisson, expectedGoals, overall } from './core.js';

/* ------------------------------------------------------------------ */
/* Seleções                                                            */
/* ------------------------------------------------------------------ */

export function ensureNations(career) {
  if (career.nations) return career.nations;
  career.nations = {};
  for (const n of NATIONAL_TEAMS) {
    career.nations[n.code] = {
      code: n.code,
      name: n.name,
      flag: n.flag,
      confed: n.confed,
      rep: n.rep,
      strength: clamp(57 + n.rep * 5 + ri(-1, 2), 55, 95),
      roster: null,
    };
  }
  return career.nations;
}

export function nationalTeamOf(career, code) {
  ensureNations(career);
  return career.nations[code] || null;
}

export function nationStrength(career, code) {
  const n = nationalTeamOf(career, code);
  return n ? n.strength : 65;
}

export function nationalRoster(career, code) {
  const nat = nationalTeamOf(career, code);
  if (!nat) return [];
  if (nat.roster) return nat.roster;
  const names = (COUNTRY_BY_CODE[code] && COUNTRY_BY_CODE[code].names) || GENERIC_NAMES;
  const rng = seededRng(hash(`${career.seed}:${code}:national`));
  const plan = [['GOL', 3], ['ZAG', 5], ['LAT', 3], ['VOL', 3], ['MEI', 5], ['ATA', 4]];
  const out = [];
  for (const [position, count] of plan) {
    for (let i = 0; i < count; i++) {
      const first = names.first[Math.floor(rng() * names.first.length)];
      const last = names.last[Math.floor(rng() * names.last.length)];
      out.push({
        name: `${first} ${last}`,
        position,
        rating: clamp(Math.round(nat.strength + rng() * 10 - 5), 40, 96),
      });
    }
  }
  nat.roster = out;
  return out;
}

export function callupStatus(career) {
  const p = career.player;
  const nat = nationalTeamOf(career, p.countryCode);
  if (!nat) return null;
  const ov = overall(p);
  if (ov >= nat.strength + 2 || p.reputation >= 78) return 'titular';
  if (ov >= nat.strength - 3 || p.reputation >= 60) return 'rotacao';
  if (ov >= nat.strength - 7 || p.reputation >= 42) return 'reserva';
  return null;
}

export function nationalRole(career) {
  const p = career.player;
  if (!callupStatus(career)) return null;
  const roster = nationalRoster(career, p.countryCode);
  const same = roster.filter((s) => s.position === p.position).map((s) => s.rating);
  const best = same.length ? Math.max(...same) : 70;
  const ov = overall(p);
  if (ov >= best - 1) return 'titular';
  if (ov >= best - 6) return 'rotacao';
  return 'reserva';
}

function friendlyOpponent(career, me) {
  const others = NATIONAL_TEAMS.filter((n) => n.code !== me);
  const mine = nationStrength(career, me);
  const pool = others
    .filter((n) => Math.abs(nationStrength(career, n.code) - mine) <= 10)
    .map((n) => n.code);
  const list = pool.length ? pool : others.map((n) => n.code);
  return pick(list);
}

export function confedNations(career, confed) {
  return NATIONAL_TEAMS
    .filter((n) => n.confed === confed)
    .map((n) => n.code)
    .sort((a, b) => nationStrength(career, b) - nationStrength(career, a));
}

function continentalPool(career, confed) {
  const pool = confedNations(career, confed).slice(0, 16);
  if (pool.length < 16) {
    const invites = confedNations(career, confed === 'CONMEBOL' ? 'CONCACAF' : 'CONMEBOL')
      .filter((c) => !pool.includes(c));
    pool.push(...invites.slice(0, 16 - pool.length));
  }
  return pool;
}

function worldCupPool(career) {
  const quotas = { UEFA: 12, CONMEBOL: 5, CONCACAF: 4, AFC: 5, CAF: 5, OFC: 1 };
  const pool = [];
  for (const [confed, q] of Object.entries(quotas)) {
    pool.push(...confedNations(career, confed).slice(0, q));
  }
  return pool.slice(0, 32);
}

function confederationsPool(career) {
  const champs = Object.keys(CONFEDERATIONS)
    .map((confed) => confedNations(career, confed)[0])
    .filter(Boolean);
  const unique = [...new Set(champs)];
  const extra = confedNations(career, 'UEFA').filter((c) => !unique.includes(c));
  while (unique.length < 8 && extra.length) unique.push(extra.shift());
  return unique.slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Chaves                                                              */
/* ------------------------------------------------------------------ */

const GROUP_FIXTURES = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[0, 3], [1, 2]],
];

const STAGE_NAMES = { 1: 'Final', 2: 'Semifinais', 4: 'Quartas de final', 8: 'Oitavas de final', 16: 'Fase de 32' };

function nextPow2(n) {
  let s = 1;
  while (s < n) s *= 2;
  return s;
}

export function strengthOf(career, comp, id) {
  if (comp.kind === 'club') {
    const club = career.clubs[id];
    return club ? club.strength : 65;
  }
  return nationStrength(career, id);
}

function entityName(career, comp, id) {
  if (comp.kind === 'club') {
    const club = career.clubs[id];
    return club ? club.name : '—';
  }
  const nat = nationalTeamOf(career, id);
  return nat ? nat.name : '—';
}

function entityFlag(career, comp, id) {
  if (comp.kind === 'club') {
    const club = career.clubs[id];
    return club ? (COUNTRY_BY_CODE[club.countryCode] || {}).flag || '' : '';
  }
  const nat = nationalTeamOf(career, id);
  return nat ? nat.flag : '';
}

function makeTie(home, away) {
  return { home, away, hs: 0, as: 0, pens: null, winner: null, played: false };
}

function buildFirstRound(career, comp, ids) {
  const ordered = [...ids].sort((a, b) => strengthOf(career, comp, b) - strengthOf(career, comp, a));
  const size = nextPow2(ordered.length);
  const byes = size - ordered.length;
  const ties = [];
  for (let i = 0; i < byes; i++) {
    ties.push({ home: ordered[i], away: null, hs: 0, as: 0, pens: null, winner: ordered[i], played: true });
  }
  const rest = ordered.slice(byes);
  for (let i = 0; i < rest.length / 2; i++) {
    ties.push(makeTie(rest[i], rest[rest.length - 1 - i]));
  }
  return ties;
}

function pairUp(winners) {
  const n = winners.length;
  const ties = [];
  for (let i = 0; i < n / 2; i++) ties.push(makeTie(winners[i], winners[n - 1 - i]));
  return ties;
}

function simSimple(career, comp, home, away) {
  const a = strengthOf(career, comp, home);
  const b = strengthOf(career, comp, away);
  const adv = comp.kind === 'club' ? 2.4 : 1.4;
  return {
    hs: poisson(expectedGoals(a + adv, b)),
    as: poisson(expectedGoals(b, a + adv)),
  };
}

function simTie(career, comp, tie) {
  const r = simSimple(career, comp, tie.home, tie.away);
  tie.hs = r.hs;
  tie.as = r.as;
  if (r.hs === r.as) {
    const a = strengthOf(career, comp, tie.home);
    const b = strengthOf(career, comp, tie.away);
    const pWin = clamp(0.5 + (a - b) * 0.015, 0.18, 0.82);
    const homeWins = Math.random() < pWin;
    tie.pens = homeWins ? [4, 3] : [3, 4];
    tie.winner = homeWins ? tie.home : tie.away;
  } else {
    tie.winner = r.hs > r.as ? tie.home : tie.away;
  }
  tie.played = true;
}

function makeGroups(career, comp, ids, groupSize) {
  const ordered = [...ids].sort((a, b) => strengthOf(career, comp, b) - strengthOf(career, comp, a));
  const count = Math.max(1, Math.floor(ordered.length / groupSize));
  const groups = Array.from({ length: count }, (_, i) => ({ id: i, teams: [], results: [] }));
  let gi = 0;
  let dir = 1;
  for (const id of ordered) {
    groups[gi].teams.push(id);
    gi += dir;
    if (gi === count) { gi = count - 1; dir = -1; }
    else if (gi < 0) { gi = 0; dir = 1; }
  }
  return groups;
}

function groupTable(group) {
  const rows = new Map(group.teams.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const m of group.results) {
    const h = rows.get(m.home);
    const a = rows.get(m.away);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += m.hs; h.ga += m.as;
    a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as) { h.w++; h.pts += 3; a.l++; }
    else if (m.hs < m.as) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return [...rows.values()].sort(
    (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf,
  );
}

function qualifiers(career, comp) {
  const rows = [];
  for (const g of comp.groups) {
    const table = groupTable(g);
    const take = comp.advancePerGroup || 2;
    for (let i = 0; i < take && i < table.length; i++) rows.push(table[i]);
  }
  rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  return rows.map((r) => r.id);
}

function createComp(career, opts) {
  const comp = {
    id: opts.id,
    name: opts.name,
    icon: opts.icon || '🏆',
    kind: opts.kind,
    year: opts.year,
    participants: [...opts.participants],
    groups: null,
    groupRound: 0,
    groupRounds: 0,
    advancePerGroup: 2,
    knockout: null,
    champion: null,
    done: false,
    stageTotal: 0,
  };
  if (opts.groupSize) {
    comp.groups = makeGroups(career, comp, comp.participants, opts.groupSize);
    comp.groupRounds = 3;
    comp.advancePerGroup = opts.advance || 2;
    const qualified = comp.groups.length * comp.advancePerGroup;
    comp.stageTotal = comp.groupRounds + Math.round(Math.log2(qualified));
  } else {
    comp.knockout = { rounds: [buildFirstRound(career, comp, comp.participants)], roundIndex: 0 };
    comp.stageTotal = Math.round(Math.log2(nextPow2(comp.participants.length)));
  }
  return comp;
}

export function createGroupComp(career, opts) {
  return createComp(career, { ...opts, groupSize: opts.groupSize || 4, advance: opts.advance || 2 });
}

export function createKoComp(career, opts) {
  return createComp(career, { ...opts, groupSize: 0 });
}

/* ------------------------------------------------------------------ */
/* Estado e andamento                                                  */
/* ------------------------------------------------------------------ */

export function stageLabel(comp) {
  if (comp.done) return 'Encerrada';
  if (comp.groups && comp.groupRound < comp.groupRounds) {
    return `Fase de grupos · Rodada ${comp.groupRound + 1}`;
  }
  if (comp.knockout) {
    const ties = comp.knockout.rounds[comp.knockout.roundIndex];
    if (!ties) return 'Encerrada';
    return STAGE_NAMES[ties.length] || 'Fase final';
  }
  return 'Encerrada';
}

export function playerTie(comp, entity) {
  if (entity == null || comp.done) return null;
  if (comp.groups && comp.groupRound < comp.groupRounds) {
    const group = comp.groups.find((g) => g.teams.includes(entity));
    if (!group) return null;
    const fixtures = GROUP_FIXTURES[comp.groupRound];
    for (const [i, j] of fixtures) {
      if (group.teams[i] === entity || group.teams[j] === entity) {
        return { home: group.teams[i], away: group.teams[j], stage: stageLabel(comp), groupId: group.id };
      }
    }
    return null;
  }
  if (comp.knockout) {
    const ties = comp.knockout.rounds[comp.knockout.roundIndex];
    if (!ties) return null;
    const tie = ties.find((t) => !t.played && (t.home === entity || t.away === entity));
    if (!tie) return null;
    return { home: tie.home, away: tie.away, stage: stageLabel(comp), tie };
  }
  return null;
}

export function matchInfo(career, comp) {
  const entity = comp.kind === 'club' ? career.player.clubId : career.player.countryCode;
  const tie = playerTie(comp, entity);
  if (!tie) return null;
  return {
    homeId: tie.home,
    awayId: tie.away,
    homeName: entityName(career, comp, tie.home),
    awayName: entityName(career, comp, tie.away),
    homeFlag: entityFlag(career, comp, tie.home),
    awayFlag: entityFlag(career, comp, tie.away),
    stage: tie.stage,
    compName: comp.name,
    compIcon: comp.icon,
    isKnockout: !!(comp.knockout && !comp.groups),
    entity,
  };
}

/**
 * Avança uma fase da competição. `result` traz o placar do jogo do jogador
 * (quando houver). Retorna o campeão se a competição terminou nesta fase.
 */
export function playStage(career, comp, entity, result) {
  let champion = null;
  if (comp.groups && comp.groupRound < comp.groupRounds) {
    const fixtures = GROUP_FIXTURES[comp.groupRound];
    for (const g of comp.groups) {
      for (const [i, j] of fixtures) {
        const home = g.teams[i];
        const away = g.teams[j];
        const isMine = entity != null && (home === entity || away === entity) && result;
        const r = isMine ? { hs: result.hs, as: result.as } : simSimple(career, comp, home, away);
        g.results.push({ home, away, hs: r.hs, as: r.as });
      }
    }
    comp.groupRound++;
    if (comp.groupRound >= comp.groupRounds) {
      comp.knockout = { rounds: [pairUp(qualifiers(career, comp))], roundIndex: 0 };
    }
  } else if (comp.knockout && comp.knockout.roundIndex < comp.knockout.rounds.length) {
    const ties = comp.knockout.rounds[comp.knockout.roundIndex];
    for (const tie of ties) {
      if (tie.played) continue;
      const isMine = entity != null && (tie.home === entity || tie.away === entity) && result;
      if (isMine) {
        tie.hs = result.hs;
        tie.as = result.as;
        tie.pens = result.pens || null;
        tie.winner = result.winner || (result.hs > result.as ? tie.home : tie.away);
        tie.played = true;
      } else {
        simTie(career, comp, tie);
      }
    }
    comp.knockout.roundIndex++;
    if (comp.knockout.roundIndex >= comp.knockout.rounds.length) {
      champion = ties[0].winner;
      comp.champion = champion;
      comp.done = true;
    } else {
      const next = ties.map((t) => t.winner).filter((w) => w != null);
      comp.knockout.rounds.push(pairUp(next));
    }
  }
  return champion;
}

export function simCompToEnd(career, comp) {
  let guard = 0;
  while (!comp.done && guard++ < 14) playStage(career, comp, null, null);
  comp.done = true;
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

function clubPool(career, size) {
  const champs = career.leagues
    .map((l) => championOfLeague(career, l.id))
    .filter((id) => id != null);
  const unique = [...new Set(champs)].sort((a, b) => career.clubs[b].strength - career.clubs[a].strength);
  if (unique.length >= size) return unique.slice(0, size);
  const extras = career.clubs
    .filter((c) => !unique.includes(c.id))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, size - unique.length)
    .map((c) => c.id);
  return [...unique, ...extras];
}

export function championOfLeague(career, leagueId) {
  if (career.champions && career.champions[leagueId] != null) return career.champions[leagueId];
  const league = career.leagues.find((l) => l.id === leagueId);
  if (!league) return null;
  return league.clubIds.slice().sort((a, b) => career.clubs[b].strength - career.clubs[a].strength)[0];
}

export function planSeason(career, leagueRounds = 38) {
  ensureNations(career);
  const year = 2026 + career.seasonNo - 1;
  const comps = {};
  const slots = Array.from({ length: leagueRounds }, () => []);
  const post = [];

  const addSlots = (comp, windows) => {
    comps[comp.id] = comp;
    for (const w of windows) {
      const idx = clamp(w, 0, leagueRounds - 1);
      slots[idx].push({ type: 'comp', compId: comp.id });
    }
  };
  const addPost = (comp) => {
    comps[comp.id] = comp;
    for (let i = 0; i < comp.stageTotal; i++) post.push({ type: 'comp', compId: comp.id });
  };

  const me = career.player.countryCode;
  const nat = nationalTeamOf(career, me);
  const confed = nat ? nat.confed : 'UEFA';
  const cupYear = year % 4 === 0;
  const worldCupYear = year % 4 === 2;

  const friendlySlots = cupYear || worldCupYear ? [1, 3] : [2, 12, 22];
  for (const s of friendlySlots) {
    const idx = clamp(s, 0, leagueRounds - 1);
    slots[idx].push({ type: 'friendly', opponent: friendlyOpponent(career, me) });
  }

  if (cupYear) {
    const comp = createGroupComp(career, {
      id: `cont-${year}`, name: CONFEDERATIONS[confed].cup, icon: '🏅', kind: 'nation', year,
      participants: continentalPool(career, confed), groupSize: 4, advance: 2,
    });
    addSlots(comp, [4, 7, 10, 14, 17, 20]);
  }

  if (worldCupYear) {
    const comp = createGroupComp(career, {
      id: `wc-${year}`, name: 'Copa do Mundo', icon: '🌍', kind: 'nation', year,
      participants: worldCupPool(career), groupSize: 4, advance: 2,
    });
    addPost(comp);
  }

  if (year % 2 === 1 && confed === 'UEFA') {
    const comp = createGroupComp(career, {
      id: `nl-${year}`, name: 'Liga das Nações', icon: '🔷', kind: 'nation', year,
      participants: confedNations(career, 'UEFA').slice(0, 16), groupSize: 4, advance: 1,
    });
    addSlots(comp, [3, 6, 9, 13, 16]);
  }

  if (year % 4 === 1) {
    const comp = createGroupComp(career, {
      id: `conf-${year}`, name: 'Copa das Confederações', icon: '🏆', kind: 'nation', year,
      participants: confederationsPool(career), groupSize: 4, advance: 2,
    });
    addPost(comp);
  }

  addPost(createKoComp(career, {
    id: `cwc-${year}`, name: 'Mundial de Clubes', icon: '🌐', kind: 'club', year,
    participants: clubPool(career, 16),
  }));

  if (year % 4 === 1) {
    addPost(createKoComp(career, {
      id: `scwc-${year}`, name: 'Super Mundial de Clubes', icon: '🌟', kind: 'club', year,
      participants: clubPool(career, 32),
    }));
  }

  const calendar = [];
  for (let r = 0; r < leagueRounds; r++) {
    calendar.push(...slots[r]);
    calendar.push({ type: 'league', round: r });
  }
  calendar.push(...post);
  return { comps, calendar, year };
}

/**
 * Consome eventos do calendário em que o jogador não entra (competições sem
 * a seleção/clube dele, amistosos sem convocação, fases já encerradas).
 */
export function syncCalendar(career) {
  const season = career.season;
  if (!season || !season.calendar) return;
  const p = career.player;
  let guard = 0;
  while (season.calIndex < season.calendar.length && guard++ < 400) {
    const ev = season.calendar[season.calIndex];
    if (ev.type === 'league') return;

    if (ev.type === 'friendly') {
      if (callupStatus(career)) return;
      season.calIndex++;
      continue;
    }

    if (ev.type === 'comp') {
      const comp = season.comps[ev.compId];
      if (!comp || comp.done) { season.calIndex++; continue; }
      const entity = comp.kind === 'club' ? p.clubId : p.countryCode;
      const involved = comp.kind === 'nation' ? !!callupStatus(career) : true;
      if (!comp.participants.includes(entity) || !involved) {
        simCompToEnd(career, comp);
        season.calIndex++;
        continue;
      }
      const tie = playerTie(comp, entity);
      if (!tie) {
        playStage(career, comp, null, null);
        season.calIndex++;
        continue;
      }
      return;
    }

    season.calIndex++;
  }
}

export function playerEvent(career) {
  syncCalendar(career);
  const season = career.season;
  const ev = season.calendar[season.calIndex];
  if (!ev) return null;
  const p = career.player;

  if (ev.type === 'comp') {
    const comp = season.comps[ev.compId];
    const info = matchInfo(career, comp);
    if (info) return { type: 'comp', comp, ...info };
    return null;
  }

  if (ev.type === 'friendly') {
    const mine = nationalTeamOf(career, p.countryCode);
    const opp = nationalTeamOf(career, ev.opponent);
    if (!mine || !opp) return null;
    return {
      type: 'friendly',
      entity: p.countryCode,
      national: true,
      homeId: mine.code,
      awayId: opp.code,
      homeName: mine.name,
      awayName: opp.name,
      homeFlag: mine.flag,
      awayFlag: opp.flag,
      compName: 'Amistoso internacional',
      compIcon: '🤝',
      stage: 'Amistoso',
    };
  }

  return null;
}

export function competitionStatus(career) {
  const season = career.season;
  if (!season || !season.comps) return [];
  const p = career.player;
  const list = [];
  for (const comp of Object.values(season.comps)) {
    const entity = comp.kind === 'club' ? p.clubId : p.countryCode;
    const involved = comp.kind === 'nation' ? !!callupStatus(career) : true;
    let status;
    if (!comp.participants.includes(entity)) status = comp.kind === 'club' ? 'Não classificado' : 'Não classificado';
    else if (!involved) status = 'Não convocado';
    else if (comp.champion === entity) status = 'Campeão';
    else if (comp.done) status = 'Eliminado';
    else status = 'Em disputa';
    list.push({
      id: comp.id,
      name: comp.name,
      icon: comp.icon,
      kind: comp.kind,
      year: comp.year,
      stage: comp.done ? (comp.champion ? 'Encerrada' : 'Encerrada') : stageLabel(comp),
      status,
      championName: comp.champion != null ? entityName(career, comp, comp.champion) : null,
      round: comp.knockout ? comp.knockout.roundIndex : comp.groupRound,
      stages: comp.stageTotal,
    });
  }
  const order = (c) => (c.status === 'Em disputa' ? 0 : c.status === 'Campeão' ? 1 : 2);
  return list.sort((a, b) => order(a) - order(b) || (a.kind === b.kind ? 0 : a.kind === 'club' ? -1 : 1));
}

export { entityName, entityFlag, STAGE_NAMES };
