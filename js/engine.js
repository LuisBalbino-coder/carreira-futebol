// Motor de carreira: mundo, simulação de partidas, temporadas, mercado e evolução do jogador.
// Sem dependências de DOM — roda também no Node para testes.

import {
  COUNTRY_BY_CODE, COUNTRIES, POSITIONS, ATTRS, WEIGHTS, BASE_ATTRS,
  TRAININGS, FORMATIONS, FORMATION_KEYS,
} from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 12);
  return k - 1;
}

function expectedGoals(att, def) {
  return clamp(1.30 * Math.pow(att / def, 2.4), 0.22, 4.6);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* Jogador                                                             */
/* ------------------------------------------------------------------ */

export function overall(player) {
  const w = WEIGHTS[player.position] || WEIGHTS.MEI;
  let sum = 0;
  let total = 0;
  for (const a of ATTRS) {
    const weight = w[a.key] || 0;
    sum += (player.attrs[a.key] || 0) * weight;
    total += weight;
  }
  return Math.round(sum / total);
}

function startingAttrs(position) {
  const base = BASE_ATTRS[position] || BASE_ATTRS.MEI;
  const out = {};
  for (const a of ATTRS) out[a.key] = clamp(Math.round(base[a.key] + rnd(-4, 4)), 20, 80);
  return out;
}

export function marketValue(player) {
  const ov = overall(player);
  const age = player.age;
  const ageFactor = age <= 20 ? 0.95 : age <= 24 ? 1.15 : age <= 28 ? 1.0 : age <= 31 ? 0.6 : age <= 34 ? 0.28 : 0.1;
  const base = 1200000 * Math.exp((ov - 55) / 8) * ageFactor;
  const repFactor = 0.85 + player.reputation / 200;
  const value = base * repFactor;
  return clamp(Math.round(value / 50000) * 50000, 50000, 250000000);
}

export function wageFor(club, ov) {
  const power = Math.pow(clamp((club.strength - 45) / 45, 0.05, 1.2), 2);
  const skill = Math.pow(clamp(ov / 100, 0.2, 1.2), 1.5);
  return Math.max(2000, Math.round((1500 + power * skill * 400000) / 500) * 500);
}

export function formatMoney(v) {
  if (v >= 1000000) return `€ ${(v / 1000000).toFixed(v >= 10000000 ? 0 : 1).replace('.', ',')} M`;
  if (v >= 1000) return `€ ${Math.round(v / 1000)} mil`;
  return `€ ${Math.round(v)}`;
}

/* ------------------------------------------------------------------ */
/* Mundo                                                               */
/* ------------------------------------------------------------------ */

function buildWorld() {
  const clubs = [];
  const leagues = [];
  for (const c of COUNTRIES) {
    const clubIds = [];
    const n = c.cities.length;
    c.cities.forEach((city, i) => {
      const strength = clamp(
        Math.round(85 - (i * (23 / (n - 1))) + (c.rep - 4) * 2.2 + ((i * 7) % 3)),
        55, 92,
      );
      const id = clubs.length;
      clubs.push({
        id,
        city,
        name: `${city} ${c.suffixes[i % c.suffixes.length]}`,
        countryCode: c.code,
        countryName: c.name,
        leagueId: c.code,
        strength,
        stars: strength >= 84 ? 5 : strength >= 77 ? 4 : strength >= 70 ? 3 : strength >= 63 ? 2 : 1,
      });
      clubIds.push(id);
    });
    leagues.push({
      id: c.code,
      countryCode: c.code,
      countryName: c.name,
      flag: c.flag,
      name: c.league,
      rep: c.rep,
      clubIds,
    });
  }
  return { clubs, leagues };
}

export function squadFor(career, clubId) {
  if (career.squads[clubId]) return career.squads[clubId];
  const club = career.clubs[clubId];
  const country = COUNTRY_BY_CODE[club.countryCode] || COUNTRIES[0];
  const rng = seededRng(hash(`${career.seed}:${clubId}:squad`));
  const plan = [['GOL', 2], ['ZAG', 4], ['LAT', 2], ['VOL', 3], ['MEI', 4], ['ATA', 4]];
  const players = [];
  for (const [position, count] of plan) {
    for (let i = 0; i < count; i++) {
      const first = country.names.first[Math.floor(rng() * country.names.first.length)];
      const last = country.names.last[Math.floor(rng() * country.names.last.length)];
      players.push({
        name: `${first} ${last}`,
        position,
        rating: clamp(Math.round(club.strength + (rng() * 12 - 6)), 42, 95),
      });
    }
  }
  career.squads[clubId] = players;
  return players;
}

/* ------------------------------------------------------------------ */
/* Calendário                                                          */
/* ------------------------------------------------------------------ */

function buildFixtures(clubIds) {
  const order = shuffle(clubIds);
  const n = order.length;
  const arr = [...order];
  const first = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    first.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  const second = first.map((round) => round.map((m) => ({ home: m.away, away: m.home })));
  return [...first, ...second];
}

function startSeason(career, clubId) {
  career.player.clubId = clubId;
  const club = career.clubs[clubId];
  const league = career.leagues.find((l) => l.id === club.leagueId);
  career.season = {
    year: 2026 + (career.seasonNo - 1),
    leagueId: league.id,
    leagueName: league.name,
    countryName: league.countryName,
    flag: league.flag,
    rounds: buildFixtures(league.clubIds),
    roundIndex: 0,
    results: {},
    pstats: { apps: 0, goals: 0, assists: 0, minutes: 0, ratingSum: 0, motm: 0, wins: 0, draws: 0, losses: 0 },
    history: [],
  };
  career.seasonSummary = null;
  career.offers = [];
}

export function createCareer({ name, countryCode, position, seed }) {
  const world = buildWorld();
  const country = COUNTRY_BY_CODE[countryCode] || COUNTRIES[0];
  const league = world.leagues.find((l) => l.id === country.code);
  const player = {
    name: (name || '').trim() || 'Novo Craque',
    countryCode: country.code,
    countryName: country.name,
    position,
    positionName: (POSITIONS[position] || POSITIONS.MEI).name,
    age: 17,
    attrs: startingAttrs(position),
    potential: ri(78, 93),
    reputation: 6,
    form: 62,
    morale: 72,
    fitness: 100,
    injuryWeeks: 0,
    clubId: null,
    contract: { wage: 0, years: 2 },
    stats: { seasons: 0, apps: 0, goals: 0, assists: 0, minutes: 0, ratingSum: 0, motm: 0 },
    honours: [],
    awards: [],
    history: [],
  };

  const career = {
    seed: seed || Math.floor(Math.random() * 1e9),
    player,
    clubs: world.clubs,
    leagues: world.leagues,
    squads: {},
    seasonNo: 1,
    season: null,
    seasonSummary: null,
    offers: [],
    finished: false,
  };

  // Clube inicial: precisa ser pequeno e dar espaço para o jogador ser titular.
  const ov = overall(player);
  const leagueClubs = league.clubIds.map((id) => world.clubs[id]);
  const evaluated = leagueClubs.map((club) => {
    const squad = squadFor(career, club.id);
    const rivals = squad.filter((s) => s.position === player.position).map((s) => s.rating);
    return { club, best: rivals.length ? Math.max(...rivals) : 60 };
  });
  const startable = evaluated.filter((x) => ov >= x.best - 6).sort((a, b) => b.club.strength - a.club.strength);
  const startClub = startable.length
    ? startable[Math.min(startable.length - 1, ri(0, 2))].club
    : evaluated.sort((a, b) => a.club.strength - b.club.strength)[0].club;

  player.clubId = startClub.id;
  player.contract = { wage: wageFor(startClub, ov), years: 2 };
  startSeason(career, startClub.id);
  return career;
}

export function getClub(career, id) {
  return career.clubs[id];
}

export function currentLeague(career) {
  return career.leagues.find((l) => l.id === career.season.leagueId);
}

export function nextFixture(career) {
  const round = career.season.rounds[career.season.roundIndex];
  if (!round) return null;
  return round.find((m) => m.home === career.player.clubId || m.away === career.player.clubId) || null;
}

export function seasonOver(career) {
  return career.season.roundIndex >= career.season.rounds.length;
}

export function squadRole(career) {
  const p = career.player;
  const squad = squadFor(career, p.clubId);
  const same = squad.filter((s) => s.position === p.position).map((s) => s.rating);
  const best = same.length ? Math.max(...same) : 60;
  const ov = overall(p);
  if (ov >= best - 1) return 'titular';
  if (ov >= best - 6) return 'rotacao';
  return 'reserva';
}

export const ROLE_LABEL = { titular: 'Titular', rotacao: 'Rotação', reserva: 'Reserva' };

/* ------------------------------------------------------------------ */
/* Tabela / artilharia                                                 */
/* ------------------------------------------------------------------ */

export function standings(career) {
  const league = currentLeague(career);
  const rows = new Map();
  for (const id of league.clubIds) {
    rows.set(id, { clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  }
  career.season.rounds.forEach((round, ri) => {
    round.forEach((m, mi) => {
      const r = career.season.results[`${ri}:${mi}`];
      if (!r) return;
      const h = rows.get(m.home);
      const a = rows.get(m.away);
      h.p++; a.p++;
      h.gf += r.hs; h.ga += r.as;
      a.gf += r.as; a.ga += r.hs;
      if (r.hs > r.as) { h.w++; h.pts += 3; a.l++; }
      else if (r.hs < r.as) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    });
  });
  return [...rows.values()].sort(
    (x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf,
  );
}

export function topScorers(career) {
  const league = currentLeague(career);
  const table = standings(career);
  const rows = [];
  for (const row of table) {
    const squad = squadFor(career, row.clubId);
    const forwards = squad.filter((s) => s.position === 'ATA').sort((a, b) => b.rating - a.rating);
    const star = forwards[0] || squad.slice().sort((a, b) => b.rating - a.rating)[0];
    rows.push({
      name: star.name,
      clubId: row.clubId,
      goals: Math.round(row.gf * 0.34),
      isPlayer: false,
    });
  }
  const p = career.player;
  if (career.season.pstats.goals > 0) {
    rows.push({ name: p.name, clubId: p.clubId, goals: career.season.pstats.goals, isPlayer: true });
  }
  rows.sort((a, b) => b.goals - a.goals);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Partida                                                             */
/* ------------------------------------------------------------------ */

function formationFor(career, clubId) {
  return FORMATION_KEYS[hash(`${career.seed}:${clubId}:form`) % FORMATION_KEYS.length];
}

function strikerName(career, clubId) {
  const squad = squadFor(career, clubId);
  const groups = { ATA: 4, MEI: 2, VOL: 1, LAT: 1, ZAG: 1, GOL: 0 };
  const pool = [];
  for (const s of squad) {
    for (let i = 0; i < (groups[s.position] || 0); i++) pool.push(s.name);
  }
  return pool.length ? pick(pool) : squad[0].name;
}

function playDetailed(career, match) {
  const p = career.player;
  const homeClub = career.clubs[match.home];
  const awayClub = career.clubs[match.away];
  const playerHome = match.home === p.clubId;
  const myClub = playerHome ? homeClub : awayClub;
  const oppClub = playerHome ? awayClub : homeClub;
  const role = squadRole(career);

  let minutes = 0;
  if (p.injuryWeeks <= 0 && p.fitness > 32) {
    const base = role === 'titular' ? 88 : role === 'rotacao' ? 64 : (p.age <= 19 ? 30 : 20);
    minutes = clamp(Math.round(base + rnd(-8, 8)), 0, 90);
    if (minutes < 25 && Math.random() < 0.45) minutes = 0;
  }

  const ov = overall(p);
  const impact = minutes > 0 ? (ov - myClub.strength) * 0.24 * (minutes / 90) : 0;
  const myStr = myClub.strength + impact;
  const oppStr = oppClub.strength;
  let myGoals = poisson(expectedGoals(myStr + (playerHome ? 3 : 0), oppStr + (playerHome ? 0 : 3)));
  let oppGoals = poisson(expectedGoals(oppStr + (playerHome ? 0 : 3), myStr + (playerHome ? 3 : 0)));

  const goalProb = clamp({ GOL: 0, ZAG: 0.04, LAT: 0.06, VOL: 0.09, MEI: 0.2, ATA: 0.38 }[p.position] *
    (0.55 + ov / 110) * (minutes / 90), 0, 0.85);
  const assistProb = goalProb * 0.85;

  let pGoals = 0;
  let pAssists = 0;
  const slots = [];
  for (let i = 0; i < myGoals; i++) {
    const r = Math.random();
    if (r < goalProb) { pGoals++; slots.push('goal'); }
    else if (r < goalProb + assistProb) { pAssists++; slots.push('assist'); }
    else slots.push(null);
  }

  const rating = Math.round(clamp(
    6.15 + pGoals * 0.9 + pAssists * 0.55 +
    (ov - oppClub.strength) * 0.015 +
    (myGoals - oppGoals) * 0.12 + rnd(-0.55, 0.55),
    4.0, 10,
  ) * 10) / 10;

  // eventos
  const events = [{ minute: 0, type: 'info', side: 'none', text: 'Bola rolando' }];
  const goalMinutes = [];
  for (let i = 0; i < myGoals; i++) goalMinutes.push({ minute: ri(1, 90), side: 'mine' });
  for (let i = 0; i < oppGoals; i++) goalMinutes.push({ minute: ri(1, 90), side: 'opp' });
  goalMinutes.sort((a, b) => a.minute - b.minute);

  const slotCopy = [...slots];
  for (const goal of goalMinutes) {
    const scorer = goal.side === 'mine' ? strikerName(career, myClub.id) : strikerName(career, oppClub.id);
    let text;
    if (goal.side === 'mine') {
      const key = slotCopy.pop();
      if (key === 'goal') text = `⚽ GOL! ${p.name} marcou para o ${myClub.name}!`;
      else if (key === 'assist') text = `⚽ GOL de ${scorer} — assistência de ${p.name}!`;
      else text = `⚽ GOL do ${myClub.name}, ${scorer} marcou.`;
    } else {
      text = `⚽ Gol do ${oppClub.name}, ${scorer}.`;
    }
    events.push({ minute: goal.minute, type: 'goal', side: goal.side === 'mine' ? (playerHome ? 'home' : 'away') : (playerHome ? 'away' : 'home'), text });
  }

  // chances e cartões
  const chanceCount = ri(2, 4);
  for (let i = 0; i < chanceCount; i++) {
    const mine = Math.random() < clamp(myStr / (myStr + oppStr), 0.3, 0.7);
    const who = mine ? myClub : oppClub;
    const names = [`${who.name} assusta com um chute de fora da área.`, `${who.name} chega com perigo de cabeça.`, `${who.name} desperdiça uma grande chance.`, `Defesaça do goleiro evita o gol do ${who.name}.`];
    let text = pick(names);
    if (mine && minutes > 20 && Math.random() < 0.35) {
      text = pick([
        `${p.name} finaliza e a bola passa raspando a trave!`,
        `${p.name} arrisca de longe e o goleiro espalma.`,
        `${p.name} aparece bem na área, mas finaliza por cima.`,
      ]);
    }
    events.push({ minute: ri(2, 89), type: 'chance', side: mine ? (playerHome ? 'home' : 'away') : (playerHome ? 'away' : 'home'), text });
  }
  for (let i = 0; i < ri(0, 2); i++) {
    const mine = Math.random() < 0.5;
    events.push({ minute: ri(10, 85), type: 'card', side: mine ? (playerHome ? 'home' : 'away') : (playerHome ? 'away' : 'home'), text: `Cartão amarelo para o ${(mine ? myClub : oppClub).name}.` });
  }
  events.push({ minute: 45, type: 'info', side: 'none', text: 'Fim do primeiro tempo' });
  events.push({ minute: 90, type: 'info', side: 'none', text: 'Fim de jogo' });
  events.sort((a, b) => a.minute - b.minute);

  const hs = playerHome ? myGoals : oppGoals;
  const as = playerHome ? oppGoals : myGoals;

  return {
    result: { hs, as },
    detail: {
      home: match.home,
      away: match.away,
      homeName: homeClub.name,
      awayName: awayClub.name,
      hs,
      as,
      events,
      playerHome,
      playerName: p.name,
      playerPosition: p.position,
      minutes,
      goals: pGoals,
      assists: pAssists,
      rating,
      role,
      formationHome: formationFor(career, match.home),
      formationAway: formationFor(career, match.away),
      homeStrength: homeClub.strength,
      awayStrength: awayClub.strength,
      myGoals,
      oppGoals,
      win: myGoals > oppGoals,
      draw: myGoals === oppGoals,
    },
  };
}

function quickSim(career, match) {
  const h = career.clubs[match.home];
  const a = career.clubs[match.away];
  return {
    result: {
      hs: poisson(expectedGoals(h.strength + 3, a.strength)),
      as: poisson(expectedGoals(a.strength, h.strength + 3)),
    },
  };
}

function applyTraining(career, trainingId) {
  const p = career.player;
  const t = TRAININGS.find((x) => x.id === trainingId) || TRAININGS[0];
  const youth = p.age <= 20 ? 1.4 : p.age <= 24 ? 1.1 : p.age <= 28 ? 0.75 : 0.4;
  const room = p.potential - overall(p);
  const gainFactor = room > 0 ? youth : youth * 0.25;
  for (const [key, value] of Object.entries(t.gains || {})) {
    if (p.attrs[key] >= 99) continue;
    p.attrs[key] = clamp(p.attrs[key] + value * gainFactor * 0.18 * rnd(0.6, 1.5), 20, 99);
  }
  p.fitness = clamp(p.fitness + (t.fit || 0) + 4, 0, 100);
  p.form = clamp(p.form + (t.form || 0) * 0.6, 0, 100);
  if (p.injuryWeeks > 0 && t.id === 'recuperacao') p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);
}

function applyMatchOutcome(career, detail) {
  const p = career.player;
  const ps = career.season.pstats;

  if (p.injuryWeeks > 0) p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);

  if (detail.minutes > 0) {
    ps.apps++;
    ps.minutes += detail.minutes;
    ps.goals += detail.goals;
    ps.assists += detail.assists;
    ps.ratingSum += detail.rating;
    if (detail.rating >= 8.3) ps.motm++;
    if (detail.win) ps.wins++; else if (detail.draw) ps.draws++; else ps.losses++;
    p.fitness = clamp(p.fitness - detail.minutes * 0.19, 0, 100);
    p.reputation = clamp(p.reputation + (detail.rating - 6.6) * 0.7 + detail.goals * 0.5, 0, 100);
    p.morale = clamp(p.morale + (detail.win ? 4 : detail.draw ? 0 : -3) + (detail.rating - 6.4) * 2, 0, 100);
    p.form = clamp(p.form + (detail.rating - 6.4) * 3, 0, 100);
    detail.injured = false;
    if (Math.random() < 0.035) {
      p.injuryWeeks = ri(1, 4);
      detail.injured = true;
      detail.injuryWeeks = p.injuryWeeks;
    }
  } else {
    p.fitness = clamp(p.fitness + 6, 0, 100);
    p.morale = clamp(p.morale - 1.5, 0, 100);
    p.form = clamp(p.form - 1.2, 0, 100);
  }
  p.fitness = clamp(p.fitness + 5, 0, 100);

  career.season.history.unshift({
    round: career.season.roundIndex + 1,
    home: detail.homeName,
    away: detail.awayName,
    hs: detail.hs,
    as: detail.as,
    minutes: detail.minutes,
    goals: detail.goals,
    assists: detail.assists,
    rating: detail.rating,
  });
  career.season.history = career.season.history.slice(0, 12);
}

export function advanceRound(career, trainingId) {
  if (seasonOver(career)) return null;
  applyTraining(career, trainingId);

  const round = career.season.rounds[career.season.roundIndex];
  let detail = null;
  round.forEach((m, mi) => {
    const isMine = m.home === career.player.clubId || m.away === career.player.clubId;
    if (isMine) {
      const out = playDetailed(career, m);
      career.season.results[`${career.season.roundIndex}:${mi}`] = out.result;
      applyMatchOutcome(career, out.detail);
      detail = out.detail;
    } else {
      career.season.results[`${career.season.roundIndex}:${mi}`] = quickSim(career, m).result;
    }
  });
  career.season.roundIndex++;
  return detail;
}

/* ------------------------------------------------------------------ */
/* Fim de temporada, mercado                                           */
/* ------------------------------------------------------------------ */

function endSeasonGrowth(career) {
  const p = career.player;
  const ps = career.season.pstats;
  const youth = p.age <= 20 ? 1.55 : p.age <= 23 ? 1.25 : p.age <= 26 ? 0.85 : p.age <= 29 ? 0.45 : 0.1;
  const play = clamp(ps.apps / 24, 0.25, 1.25);
  const room = p.potential - overall(p);
  for (const a of ATTRS) {
    if (a.key === 'gol' && p.position !== 'GOL') continue;
    if (p.attrs[a.key] >= 99) continue;
    if (room <= 0 && Math.random() < 0.5) {
      p.attrs[a.key] = clamp(p.attrs[a.key] - rnd(0.2, 0.9) * youth, 20, 99);
      continue;
    }
    p.attrs[a.key] = clamp(p.attrs[a.key] + youth * play * 0.6 * rnd(0.5, 1.5) * (room > 0 ? 1 : 0.3), 20, 99);
  }
  if (p.age >= 30) {
    for (const a of ATTRS) {
      if (a.key === 'gol' && p.position !== 'GOL') continue;
      p.attrs[a.key] = clamp(p.attrs[a.key] - rnd(0.2, 1.0) * (p.age - 29) * 0.55, 20, 99);
    }
  }
  p.reputation = clamp(p.reputation + (p.age <= 26 ? 1.2 : 0.4) * 0.3, 0, 100);
}

function generateOffers(career) {
  const p = career.player;
  const ov = overall(p);
  const pool = career.clubs.filter((c) => {
    if (c.id === p.clubId) return false;
    if (c.strength > ov + 13) return false;
    if (c.strength < ov - 15) return false;
    return true;
  });
  const weighted = shuffle(pool).slice(0, Math.max(1, Math.min(pool.length, ri(3, 6))));
  const offers = weighted.map((club, i) => {
    const role = club.strength > ov + 3 ? 'rotacao' : club.strength > ov - 4 ? 'titular' : 'titular';
    return {
      id: `offer-${i}`,
      clubId: club.id,
      clubName: club.name,
      leagueName: career.leagues.find((l) => l.id === club.leagueId).name,
      countryName: club.countryName,
      flag: (COUNTRY_BY_CODE[club.countryCode] || {}).flag || '',
      strength: club.strength,
      stars: club.stars,
      wage: Math.round(wageFor(club, ov) * rnd(1.0, 1.35) / 500) * 500,
      years: ri(2, 4),
      role,
    };
  });
  offers.sort((a, b) => b.strength - a.strength);
  return offers;
}

export function finishSeason(career) {
  const p = career.player;
  const ps = career.season.pstats;
  const table = standings(career);
  const myPos = table.findIndex((r) => r.clubId === p.clubId) + 1;
  const champion = career.clubs[table[0].clubId];
  const scorers = topScorers(career);
  const isTopScorer = !!(scorers[0] && scorers[0].isPlayer);

  p.stats.seasons++;
  p.stats.apps += ps.apps;
  p.stats.goals += ps.goals;
  p.stats.assists += ps.assists;
  p.stats.minutes += ps.minutes;
  p.stats.ratingSum += ps.ratingSum;
  if (ps.motm) p.stats.motm += ps.motm;

  const honours = [];
  if (table[0].clubId === p.clubId) {
    honours.push(`🏆 ${career.season.leagueName} ${career.season.year}`);
  }
  if (isTopScorer) {
    honours.push(`👟 Artilheiro ${career.season.leagueName} ${career.season.year} (${ps.goals} gols)`);
  }
  p.honours.push(...honours);

  const summary = {
    year: career.season.year,
    seasonNo: career.seasonNo,
    leagueName: career.season.leagueName,
    countryName: career.season.countryName,
    flag: career.season.flag,
    championName: champion.name,
    championStrength: champion.strength,
    myPosition: myPos,
    myClubName: career.clubs[p.clubId].name,
    tableTop: table.slice(0, 6).map((r) => ({
      clubId: r.clubId,
      name: career.clubs[r.clubId].name,
      pts: r.pts,
      gd: r.gf - r.ga,
      me: r.clubId === p.clubId,
    })),
    stats: { ...ps, avgRating: ps.apps ? Math.round((ps.ratingSum / ps.apps) * 10) / 10 : 0 },
    topScorers: scorers.slice(0, 8),
    honours,
    isTopScorer,
    championNameShort: champion.name,
  };

  p.history.push({ year: career.season.year, club: summary.myClubName, position: myPos, apps: ps.apps, goals: ps.goals, assists: ps.assists, rating: summary.stats.avgRating, honour: honours[0] || '' });

  endSeasonGrowth(career);

  const contractEnding = p.contract.years <= 1;
  const stay = {
    id: 'stay',
    clubId: p.clubId,
    clubName: summary.myClubName,
    leagueName: career.season.leagueName,
    countryName: career.season.countryName,
    flag: career.season.flag,
    strength: career.clubs[p.clubId].strength,
    stars: career.clubs[p.clubId].stars,
    wage: Math.round(wageFor(career.clubs[p.clubId], overall(p)) * (contractEnding ? 1.12 : 1.05) / 500) * 500,
    years: ri(2, 4),
    role: squadRole(career),
    stay: true,
  };

  career.offers = [stay, ...generateOffers(career)];
  career.seasonSummary = summary;
  return summary;
}

export function startNewSeason(career, clubId) {
  const p = career.player;
  p.age += 1;
  p.fitness = 100;
  p.form = clamp(p.form + 4, 20, 100);
  p.morale = clamp(p.morale + 4, 20, 100);
  p.injuryWeeks = 0;
  const club = career.clubs[clubId];
  const offer = career.offers.find((o) => o.clubId === clubId);
  p.contract = { wage: offer ? offer.wage : wageFor(club, overall(p)), years: offer ? offer.years : 3 };
  career.seasonNo++;
  startSeason(career, clubId);
}

export function managerReputationLabel(rep) {
  if (rep >= 85) return 'Ídolo mundial';
  if (rep >= 65) return 'Estrela internacional';
  if (rep >= 45) return 'Jogador conhecido';
  if (rep >= 25) return 'Promessa';
  return 'Desconhecido';
}
