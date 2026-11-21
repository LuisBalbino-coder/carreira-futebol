// Motor de carreira: mundo, calendário, simulação de partidas, temporadas,
// seleção, finanças dos clubes e evolução do jogador.
// Sem dependências de DOM — roda também no Node para testes.

import {
  COUNTRY_BY_CODE, COUNTRIES, POSITIONS, ATTRS, BASE_ATTRS, TRAININGS,
  FORMATIONS, FORMATION_KEYS, BRANDS,
} from './data.js';
import {
  clamp, rnd, ri, pick, hash, seededRng, poisson, expectedGoals, shuffle,
  overall, marketValue, formatMoney, managerReputationLabel,
} from './core.js';
import * as C from './competitions.js';

export { overall, marketValue, formatMoney, managerReputationLabel };

/* ------------------------------------------------------------------ */
/* Jogador                                                             */
/* ------------------------------------------------------------------ */

function startingAttrs(position) {
  const base = BASE_ATTRS[position] || BASE_ATTRS.MEI;
  const out = {};
  for (const a of ATTRS) out[a.key] = clamp(Math.round(base[a.key] + rnd(-4, 4)), 20, 80);
  return out;
}

export function wageFor(club, ov) {
  const power = Math.pow(clamp((club.strength - 45) / 45, 0.05, 1.2), 2);
  const skill = Math.pow(clamp(ov / 100, 0.2, 1.2), 1.5);
  return Math.max(2000, Math.round((1500 + power * skill * 400000) / 500) * 500);
}

function starsFor(strength) {
  return strength >= 84 ? 5 : strength >= 77 ? 4 : strength >= 70 ? 3 : strength >= 63 ? 2 : 1;
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
        stars: starsFor(strength),
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

function makeSquadPlayer(career, club, rating) {
  const country = COUNTRY_BY_CODE[club.countryCode] || COUNTRIES[0];
  const names = country.names;
  const first = pick(names.first);
  const last = pick(names.last);
  const positions = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'];
  return {
    name: `${first} ${last}`,
    position: pick(positions),
    rating: clamp(Math.round(rating), 42, 96),
  };
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
/* Finanças dos clubes                                                 */
/* ------------------------------------------------------------------ */

const TIERS = ['local', 'regional', 'nacional', 'mundial'];

function sponsorTierFor(strength) {
  if (strength >= 79) return 'mundial';
  if (strength >= 68) return 'nacional';
  if (strength >= 60) return 'regional';
  return 'local';
}

function sponsorValue(brand, fanbase, fame) {
  const raw = brand.base * 0.55e6 * (0.55 + fanbase / 120) * (1 + fame / 170);
  return Math.round(raw / 1e5) * 1e5;
}

function ensureFinance(career, club) {
  if (club.finance) return club.finance;
  const rng = seededRng(hash(`${career.seed}:${club.id}:fin`));
  const fanbase = clamp(Math.round(18 + (club.strength - 55) * 1.7 + rng() * 10), 6, 100);
  const tier = sponsorTierFor(club.strength);
  const brand = BRANDS[tier][Math.floor(rng() * BRANDS[tier].length)];
  club.finance = {
    fanbase,
    cash: Math.round(((club.strength - 64) * 1.1e6 + rng() * 3e6) / 1e5) * 1e5,
    sponsor: { tier, brand: brand.name, value: sponsorValue(brand, fanbase, 0) },
    delayed: 0,
    seasonRevenue: 0,
    seasonCost: 0,
  };
  return club.finance;
}

export function attendanceFor(career, club) {
  const f = ensureFinance(career, club);
  const capacity = Math.round((5000 + f.fanbase * 430) / 100) * 100;
  let rate = 0.32 + f.fanbase / 130 + (club.strength - 62) / 260;
  if (f.cash < 0) rate -= 0.22;
  if (f.delayed > 0) rate -= 0.12;
  rate = clamp(rate, 0.07, 1);
  return { rate, capacity, attendance: Math.round(capacity * rate) };
}

function wageBill(strength) {
  return 1.2e6 * Math.exp((strength - 55) / 8);
}

function opsCost(strength) {
  return 3e6 + Math.max(0, strength - 50) * 0.6e6;
}

function prizeFor(pos, rep) {
  const base = [30, 16, 10, 7, 5, 4][pos - 1] ?? (pos <= 10 ? 2 : 0.6);
  return base * 1e6 * (0.6 + rep * 0.2);
}

function teamFinance(career, club) {
  const f = ensureFinance(career, club);
  const gate = attendanceFor(career, club).attendance * 42 * 19;
  const revenue = f.sponsor.value + gate + f.prize;
  const cost = wageBill(club.strength) + opsCost(club.strength);
  return { revenue, cost, gate, wage: wageBill(club.strength) };
}

function news(career, text, kind = 'info') {
  if (!career.news) career.news = [];
  career.news.unshift({ year: career.season ? career.season.year : 0, text, kind });
  career.news = career.news.slice(0, 30);
}

/* ------------------------------------------------------------------ */
/* Calendário / temporada                                              */
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

function blankStats() {
  return { apps: 0, goals: 0, assists: 0, minutes: 0, ratingSum: 0, motm: 0, wins: 0, draws: 0, losses: 0 };
}

function startSeason(career, clubId) {
  career.player.clubId = clubId;
  const club = career.clubs[clubId];
  const league = career.leagues.find((l) => l.id === club.leagueId);
  const rounds = buildFixtures(league.clubIds);
  career.season = {
    year: 2026 + (career.seasonNo - 1),
    leagueId: league.id,
    leagueName: league.name,
    countryName: league.countryName,
    flag: league.flag,
    rounds,
    roundIndex: 0,
    results: {},
    pstats: blankStats(),
    cupStats: blankStats(),
    natStats: blankStats(),
    honours: [],
    history: [],
    calendar: [],
    calIndex: 0,
    comps: {},
  };
  const plan = C.planSeason(career, rounds.length);
  career.season.calendar = plan.calendar;
  career.season.comps = plan.comps;
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
    national: { caps: 0, goals: 0, assists: 0, honours: [] },
    honours: [],
    awards: [],
    history: [],
  };

  const career = {
    version: 2,
    seed: seed || Math.floor(Math.random() * 1e9),
    player,
    clubs: world.clubs,
    leagues: world.leagues,
    squads: {},
    nations: null,
    champions: {},
    news: [],
    seasonNo: 1,
    season: null,
    seasonSummary: null,
    offers: [],
    finished: false,
  };

  C.ensureNations(career);

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

  const fin = ensureFinance(career, startClub);
  news(career, `Você assinou com o ${startClub.name} (${startClub.city}).`, 'good');
  if (fin.cash < 0) news(career, `${startClub.name} está com as contas no vermelho: salários podem atrasar.`, 'bad');
  career.seasonSummary = null;
  return career;
}

export function getClub(career, id) {
  return career.clubs[id];
}

export function currentLeague(career) {
  return career.leagues.find((l) => l.id === career.season.leagueId);
}

export function seasonOver(career) {
  if (!career || !career.season) return true;
  C.syncCalendar(career);
  return career.season.calIndex >= career.season.calendar.length;
}

function leagueEvent(career, ev) {
  const season = career.season;
  const round = season.rounds[ev.round];
  if (!round) return null;
  const p = career.player;
  const m = round.find((x) => x.home === p.clubId || x.away === p.clubId);
  if (!m) return null;
  const hc = career.clubs[m.home];
  const ac = career.clubs[m.away];
  return {
    type: 'league',
    entity: p.clubId,
    homeId: m.home,
    awayId: m.away,
    homeName: hc.name,
    awayName: ac.name,
    homeFlag: (COUNTRY_BY_CODE[hc.countryCode] || {}).flag || '',
    awayFlag: (COUNTRY_BY_CODE[ac.countryCode] || {}).flag || '',
    compName: season.leagueName,
    compIcon: season.flag,
    stage: `Rodada ${ev.round + 1}`,
  };
}

/** Próximo jogo do jogador (liga, copa ou amistoso), já pulando eventos sem ele. */
export function nextEvent(career) {
  if (!career || !career.season) return null;
  C.syncCalendar(career);
  const season = career.season;
  const ev = season.calendar[season.calIndex];
  if (!ev) return null;
  if (ev.type === 'league') return leagueEvent(career, ev);
  return C.playerEvent(career);
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

function formationFor(career, id) {
  return FORMATION_KEYS[hash(`${career.seed}:${id}:form`) % FORMATION_KEYS.length];
}

function rosterFor(career, id, national) {
  return national ? C.nationalRoster(career, id) : squadFor(career, id);
}

function strikerName(career, id, national) {
  const pool = rosterFor(career, id, national);
  if (!pool || !pool.length) return 'um jogador';
  const groups = { ATA: 4, MEI: 2, VOL: 1, LAT: 1, ZAG: 1, GOL: 0 };
  const names = [];
  for (const s of pool) {
    for (let i = 0; i < (groups[s.position] || 0); i++) names.push(s.name);
  }
  return names.length ? pick(names) : pool[0].name;
}

function roleFor(career, national) {
  if (national) return C.nationalRole(career) || 'reserva';
  return squadRole(career);
}

function simulateMatch(career, opts) {
  const p = career.player;
  const national = !!opts.national;
  const entity = national ? p.countryCode : p.clubId;
  const playerHome = opts.homeId === entity;
  const playerAway = opts.awayId === entity;
  const hasPlayer = playerHome || playerAway;
  const role = hasPlayer ? roleFor(career, national) : null;

  let minutes = 0;
  if (hasPlayer && p.injuryWeeks <= 0 && p.fitness > 32) {
    const base = role === 'titular' ? 88 : role === 'rotacao' ? 64 : (p.age <= 19 ? 30 : 20);
    minutes = clamp(Math.round(base + rnd(-8, 8)), 0, 90);
    if (minutes < 25 && Math.random() < 0.45) minutes = 0;
  }

  const ov = overall(p);
  const myBase = playerHome ? opts.homeStr : opts.awayStr;
  const impact = minutes > 0 ? (ov - myBase) * 0.24 * (minutes / 90) : 0;
  const hStr = opts.homeStr + (playerHome ? impact : 0);
  const aStr = opts.awayStr + (playerAway ? impact : 0);
  const adv = national ? 1.2 : 3;

  let hs = poisson(expectedGoals(hStr + adv, aStr));
  let as = poisson(expectedGoals(aStr, hStr + adv));

  const myGoals = playerHome ? hs : as;
  const oppGoals = playerHome ? as : hs;

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
    (ov - (playerHome ? opts.awayStr : opts.homeStr)) * 0.015 +
    (myGoals - oppGoals) * 0.12 + rnd(-0.55, 0.55),
    4.0, 10,
  ) * 10) / 10;

  const events = [{ minute: 0, type: 'info', side: 'none', text: 'Bola rolando' }];
  const goalMinutes = [];
  for (let i = 0; i < myGoals; i++) goalMinutes.push({ minute: ri(1, 90), side: 'mine' });
  for (let i = 0; i < oppGoals; i++) goalMinutes.push({ minute: ri(1, 90), side: 'opp' });
  goalMinutes.sort((a, b) => a.minute - b.minute);

  const slotCopy = [...slots];
  const myId = playerHome ? opts.homeId : opts.awayId;
  const oppId = playerHome ? opts.awayId : opts.homeId;
  for (const goal of goalMinutes) {
    const scorer = goal.side === 'mine'
      ? strikerName(career, myId, national)
      : strikerName(career, oppId, national);
    let text;
    if (goal.side === 'mine') {
      const key = slotCopy.pop();
      if (key === 'goal') text = `⚽ GOL! ${p.name} marcou para o ${playerHome ? opts.homeName : opts.awayName}!`;
      else if (key === 'assist') text = `⚽ GOL de ${scorer} — assistência de ${p.name}!`;
      else text = `⚽ GOL do ${playerHome ? opts.homeName : opts.awayName}, ${scorer} marcou.`;
    } else {
      text = `⚽ Gol do ${playerHome ? opts.awayName : opts.homeName}, ${scorer}.`;
    }
    events.push({
      minute: goal.minute,
      type: 'goal',
      side: goal.side === 'mine' ? (playerHome ? 'home' : 'away') : (playerHome ? 'away' : 'home'),
      text,
    });
  }

  const chanceCount = ri(2, 4);
  for (let i = 0; i < chanceCount; i++) {
    const mine = Math.random() < clamp(hStr / (hStr + aStr), 0.3, 0.7);
    const who = mine ? (playerHome ? opts.homeName : opts.awayName) : (playerHome ? opts.awayName : opts.homeName);
    const base = [
      `${who} assusta com um chute de fora da área.`,
      `${who} chega com perigo de cabeça.`,
      `${who} desperdiça uma grande chance.`,
      `Defesaça do goleiro evita o gol do ${who}.`,
    ];
    let text = pick(base);
    if (mine && minutes > 20 && Math.random() < 0.35) {
      text = pick([
        `${p.name} finaliza e a bola passa raspando a trave!`,
        `${p.name} arrisca de longe e o goleiro espalma.`,
        `${p.name} aparece bem na área, mas finaliza por cima.`,
      ]);
    }
    events.push({
      minute: ri(2, 89),
      type: 'chance',
      side: mine ? (playerHome ? 'home' : 'away') : (playerHome ? 'away' : 'home'),
      text,
    });
  }
  for (let i = 0; i < ri(0, 2); i++) {
    const mine = Math.random() < 0.5;
    const who = mine ? (playerHome ? opts.homeName : opts.awayName) : (playerHome ? opts.awayName : opts.homeName);
    events.push({
      minute: ri(10, 85),
      type: 'card',
      side: mine ? (playerHome ? 'home' : 'away') : (playerHome ? 'away' : 'home'),
      text: `Cartão amarelo para o ${who}.`,
    });
  }
  events.push({ minute: 45, type: 'info', side: 'none', text: 'Fim do primeiro tempo' });
  events.push({ minute: 90, type: 'info', side: 'none', text: 'Fim de jogo' });
  events.sort((a, b) => a.minute - b.minute);

  let pens = null;
  let winner = null;
  if (hs > as) winner = opts.homeId;
  else if (as > hs) winner = opts.awayId;
  if (!winner && opts.knockout) {
    const pHome = clamp(0.5 + (hStr - aStr) * 0.015, 0.2, 0.8);
    const homeWins = Math.random() < pHome;
    pens = homeWins ? [4, 3] : [3, 4];
    winner = homeWins ? opts.homeId : opts.awayId;
  }

  let crowd = null;
  if (!national && opts.homeId != null && career.clubs[opts.homeId]) {
    crowd = attendanceFor(career, career.clubs[opts.homeId]);
  } else if (national) {
    const attendance = ri(24000, 58000);
    crowd = { attendance, capacity: 62000, rate: attendance / 62000 };
  }

  return {
    home: opts.homeId,
    away: opts.awayId,
    homeName: opts.homeName,
    awayName: opts.awayName,
    homeFlag: opts.homeFlag || '',
    awayFlag: opts.awayFlag || '',
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
    formationHome: formationFor(career, opts.homeId),
    formationAway: formationFor(career, opts.awayId),
    homeStrength: opts.homeStr,
    awayStrength: opts.awayStr,
    myGoals,
    oppGoals,
    win: myGoals > oppGoals,
    draw: myGoals === oppGoals,
    compName: opts.compName || '',
    compIcon: opts.compIcon || '',
    stage: opts.stage || '',
    national,
    knockout: !!opts.knockout,
    pens,
    winner,
    crowd,
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

function statsFor(career, bucket) {
  const season = career.season;
  if (bucket === 'cup') return season.cupStats;
  if (bucket === 'nat') return season.natStats;
  return season.pstats;
}

function applyMatchOutcome(career, detail, bucket = 'league') {
  const p = career.player;
  const season = career.season;
  const ps = statsFor(career, bucket);

  if (p.injuryWeeks > 0) p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);

  if (detail.minutes > 0) {
    ps.apps++;
    ps.minutes += detail.minutes;
    ps.goals += detail.goals;
    ps.assists += detail.assists;
    ps.ratingSum += detail.rating;
    if (detail.rating >= 8.3) ps.motm++;
    if (detail.win) ps.wins++; else if (detail.draw) ps.draws++; else ps.losses++;
    p.fitness = clamp(p.fitness - detail.minutes * (bucket === 'nat' ? 0.1 : 0.19), 0, 100);
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

  if (bucket === 'nat' && detail.minutes > 0) {
    p.national.caps++;
    p.national.goals += detail.goals;
    p.national.assists += detail.assists;
  }

  season.history.unshift({
    round: bucket === 'league' ? season.roundIndex + 1 : null,
    comp: detail.compName,
    home: detail.homeName,
    away: detail.awayName,
    hs: detail.hs,
    as: detail.as,
    minutes: detail.minutes,
    goals: detail.goals,
    assists: detail.assists,
    rating: detail.rating,
  });
  season.history = season.history.slice(0, 14);
}

function awardComp(career, comp, champion) {
  if (champion == null) return;
  const p = career.player;
  const entity = comp.kind === 'club' ? p.clubId : p.countryCode;
  if (champion !== entity) return;
  const label = `🏆 ${comp.name} ${comp.year}`;
  const season = career.season;
  if (!season.honours.includes(label)) season.honours.push(label);
  if (!p.honours.includes(label)) p.honours.push(label);
  if (comp.kind === 'nation' && !p.national.honours.includes(label)) p.national.honours.push(label);
  p.reputation = clamp(p.reputation + (comp.kind === 'nation' ? 5 : 3), 0, 100);
  p.morale = clamp(p.morale + 10, 0, 100);
  news(career, `${label} conquistada!`, 'good');
}

function leagueRound(career, ev) {
  const season = career.season;
  const p = career.player;
  const round = season.rounds[ev.round];
  let detail = null;
  round.forEach((m, mi) => {
    const isMine = m.home === p.clubId || m.away === p.clubId;
    if (isMine) {
      const hc = career.clubs[m.home];
      const ac = career.clubs[m.away];
      detail = simulateMatch(career, {
        homeId: m.home,
        awayId: m.away,
        homeName: hc.name,
        awayName: ac.name,
        homeFlag: (COUNTRY_BY_CODE[hc.countryCode] || {}).flag || '',
        awayFlag: (COUNTRY_BY_CODE[ac.countryCode] || {}).flag || '',
        homeStr: hc.strength,
        awayStr: ac.strength,
        compName: season.leagueName,
        compIcon: season.flag,
        stage: `Rodada ${ev.round + 1}`,
      });
      season.results[`${ev.round}:${mi}`] = { hs: detail.hs, as: detail.as };
      applyMatchOutcome(career, detail, 'league');
    } else {
      season.results[`${ev.round}:${mi}`] = quickSim(career, m).result;
    }
  });
  season.roundIndex = ev.round + 1;
  return detail;
}

function playComp(career, compId) {
  const comp = career.season.comps[compId];
  if (!comp) return null;
  const p = career.player;
  const entity = comp.kind === 'club' ? p.clubId : p.countryCode;
  const info = C.matchInfo(career, comp);
  const national = comp.kind === 'nation';
  const ko = !!(comp.knockout && !(comp.groups && comp.groupRound < comp.groupRounds));

  if (!info) {
    const champ = C.playStage(career, comp, entity, null);
    awardComp(career, comp, champ);
    return null;
  }

  const detail = simulateMatch(career, {
    homeId: info.homeId,
    awayId: info.awayId,
    homeName: info.homeName,
    awayName: info.awayName,
    homeFlag: info.homeFlag,
    awayFlag: info.awayFlag,
    homeStr: C.strengthOf(career, comp, info.homeId),
    awayStr: C.strengthOf(career, comp, info.awayId),
    national,
    knockout: ko,
    compName: comp.name,
    compIcon: comp.icon,
    stage: info.stage,
  });

  applyMatchOutcome(career, detail, national ? 'nat' : 'cup');

  const champ = C.playStage(career, comp, entity, {
    hs: detail.hs,
    as: detail.as,
    pens: detail.pens,
    winner: detail.winner,
  });
  awardComp(career, comp, champ);
  return detail;
}

function playFriendly(career, ev) {
  const p = career.player;
  const mine = C.nationalTeamOf(career, p.countryCode);
  const opp = C.nationalTeamOf(career, ev.opponent);
  if (!mine || !opp) return null;
  const home = Math.random() < 0.5;
  const detail = simulateMatch(career, {
    homeId: home ? mine.code : opp.code,
    awayId: home ? opp.code : mine.code,
    homeName: home ? mine.name : opp.name,
    awayName: home ? opp.name : mine.name,
    homeFlag: home ? mine.flag : opp.flag,
    awayFlag: home ? opp.flag : mine.flag,
    homeStr: home ? mine.strength : opp.strength,
    awayStr: home ? opp.strength : mine.strength,
    national: true,
    compName: 'Amistoso internacional',
    compIcon: '🤝',
    stage: 'Amistoso',
  });
  applyMatchOutcome(career, detail, 'nat');
  return detail;
}

export function advanceRound(career, trainingId) {
  if (!career || !career.season) return null;
  C.syncCalendar(career);
  if (career.season.calIndex >= career.season.calendar.length) return null;

  const season = career.season;
  const ev = season.calendar[season.calIndex];
  applyTraining(career, trainingId);

  let detail = null;
  if (ev.type === 'league') detail = leagueRound(career, ev);
  else if (ev.type === 'comp') detail = playComp(career, ev.compId);
  else if (ev.type === 'friendly') detail = playFriendly(career, ev);

  season.calIndex++;
  return detail;
}

/* ------------------------------------------------------------------ */
/* Fim de temporada, finanças e mercado                                */
/* ------------------------------------------------------------------ */

function mergeStats(...list) {
  const out = blankStats();
  for (const s of list) {
    for (const k of Object.keys(out)) out[k] += s[k] || 0;
  }
  return out;
}

function endSeasonGrowth(career, apps) {
  const p = career.player;
  const youth = p.age <= 20 ? 1.55 : p.age <= 23 ? 1.25 : p.age <= 26 ? 0.85 : p.age <= 29 ? 0.45 : 0.1;
  const play = clamp(apps / 30, 0.25, 1.25);
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

function adjustSquad(career, club, delta) {
  const squad = career.squads[club.id];
  if (!squad) return null;
  for (const s of squad) s.rating = clamp(Math.round(s.rating + delta), 40, 96);
  if (delta >= 1.1) {
    const newbie = makeSquadPlayer(career, club, club.strength + ri(2, 5));
    squad.push(newbie);
    return { kind: 'in', text: `${club.name} contratou ${newbie.name} (${newbie.rating}) com o dinheiro do patrocínio.` };
  }
  if (delta <= -1.1) {
    squad.sort((a, b) => b.rating - a.rating);
    const sold = squad.shift();
    return { kind: 'out', text: `${club.name} vendeu ${sold.name} para aliviar as contas.` };
  }
  return null;
}

function evolveWorld(career) {
  const season = career.season;
  const table = standings(career);
  const positions = new Map(table.map((r, i) => [r.clubId, i + 1]));
  const p = career.player;
  const changes = [];

  for (const league of career.leagues) {
    const order = league.id === season.leagueId
      ? table.map((r) => r.clubId)
      : league.clubIds.slice().sort((a, b) => career.clubs[b].strength - career.clubs[a].strength);

    order.forEach((id, idx) => {
      const club = career.clubs[id];
      const f = ensureFinance(career, club);
      const pos = positions.get(id) || idx + 1;
      const before = club.strength;
      f.prize = prizeFor(pos, league.rep);
      const fin = teamFinance(career, club);
      f.cash += Math.round((fin.revenue - fin.cost) / 1e5) * 1e5;
      f.seasonRevenue = fin.revenue;
      f.seasonCost = fin.cost;
      f.delayed = f.cash < -2e6 ? Math.min(9, f.delayed + 1) : 0;

      const perf = pos <= 2 ? 1.5 : pos <= 5 ? 0.8 : pos <= 9 ? 0.1 : pos <= 13 ? -0.7 : -1.4;
      const cashScore = clamp(f.cash / 40e6, -1.5, 1.5);
      let delta = clamp(cashScore * 1.1 + perf + rnd(-0.5, 0.5), -3, 3);
      if (f.delayed >= 2) delta -= 1;
      delta = Math.round(delta * 10) / 10;

      f.fanbase = clamp(f.fanbase + (pos <= 2 ? 5 : pos <= 6 ? 2 : pos >= 13 ? -5 : 0) + rnd(-1, 1), 5, 100);
      club.strength = clamp(Math.round(before + delta), 50, 95);
      club.stars = starsFor(club.strength);
      changes.push({ club, delta });
    });
  }

  // Ajusta os elencos já gerados e registra contratações/vendas.
  for (const { club, delta } of changes) {
    const ev = adjustSquad(career, club, delta);
    if (ev && club.id === p.clubId) news(career, ev.text, ev.kind === 'in' ? 'good' : 'bad');
  }

  const myClub = career.clubs[p.clubId];
  const f = ensureFinance(career, myClub);

  if (f.delayed > 0) {
    p.morale = clamp(p.morale - 8 - f.delayed * 2, 0, 100);
    news(career, `Salários atrasados no ${myClub.name}: ${f.delayed} ${f.delayed > 1 ? 'meses' : 'mês'} sem receber.`, 'bad');
  } else if (f.cash > 20e6) {
    p.morale = clamp(p.morale + 3, 0, 100);
  }
  if (f.cash < -15e6) news(career, `${myClub.name} está à beira da falência e a torcida protesta.`, 'bad');

  return {
    clubName: myClub.name,
    sponsor: f.sponsor,
    cash: f.cash,
    delayed: f.delayed,
    fanbase: f.fanbase,
    strength: myClub.strength,
    attendance: attendanceFor(career, myClub),
    revenue: f.seasonRevenue,
    cost: f.seasonCost,
  };
}

function renewSponsors(career) {
  const p = career.player;
  for (const club of career.clubs) {
    const f = ensureFinance(career, club);
    const fame = club.id === p.clubId ? p.reputation : 0;
    let tier = sponsorTierFor(club.strength);
    if (fame >= 62 && tier !== 'mundial') tier = TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(tier) + 1)];
    if (fame >= 80) tier = 'mundial';
    if ((f.cash < -40e6 || f.delayed >= 3) && tier !== 'local') {
      tier = TIERS[Math.max(0, TIERS.indexOf(tier) - 1)];
    }
    if (f.delayed >= 6) tier = 'nenhum';

    if (tier === 'nenhum') {
      f.sponsor = { tier: 'nenhum', brand: 'Sem patrocinador', value: 0 };
      continue;
    }
    const options = BRANDS[tier];
    const rng = seededRng(hash(`${career.seed}:${club.id}:sponsor:${career.seasonNo}`));
    const brand = options[Math.floor(rng() * options.length)];
    f.sponsor = { tier, brand: brand.name, value: sponsorValue(brand, f.fanbase, fame) };

    if (club.id === p.clubId) {
      if (tier === 'mundial' && p.reputation >= 55) {
        news(career, `${club.name} fechou com a ${brand.name}: sua fama atraiu um patrocínio mundial.`, 'good');
      } else if (f.sponsor.value < 3e6) {
        news(career, `${club.name} renovou com a ${brand.name} por um valor baixo. O elenco está no limite.`, 'bad');
      }
    }
  }
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
  return weighted.map((club, i) => {
    const fin = ensureFinance(career, club);
    const afford = clamp(fin.cash / 8e6 + 1, 0.45, 1.4);
    const role = club.strength > ov + 3 ? 'rotacao' : 'titular';
    return {
      id: `offer-${i}`,
      clubId: club.id,
      clubName: club.name,
      leagueName: career.leagues.find((l) => l.id === club.leagueId).name,
      countryName: club.countryName,
      flag: (COUNTRY_BY_CODE[club.countryCode] || {}).flag || '',
      strength: club.strength,
      stars: club.stars,
      wage: Math.round(wageFor(club, ov) * rnd(1.0, 1.35) * afford / 500) * 500,
      years: ri(2, 4),
      role,
      sponsor: fin.sponsor,
      inDebt: fin.cash < 0,
    };
  }).sort((a, b) => b.strength - a.strength);
}

export function finishSeason(career) {
  C.syncCalendar(career);
  const p = career.player;
  const season = career.season;
  const table = standings(career);
  const myPos = table.findIndex((r) => r.clubId === p.clubId) + 1;
  const champion = career.clubs[table[0].clubId];
  const scorers = topScorers(career);
  const isTopScorer = !!(scorers[0] && scorers[0].isPlayer);

  career.champions[season.leagueId] = table[0].clubId;

  const ps = season.pstats;
  const all = mergeStats(ps, season.cupStats, season.natStats);

  p.stats.seasons++;
  p.stats.apps += all.apps;
  p.stats.goals += all.goals;
  p.stats.assists += all.assists;
  p.stats.minutes += all.minutes;
  p.stats.ratingSum += all.ratingSum;
  if (all.motm) p.stats.motm += all.motm;

  season.honours = season.honours || [];
  if (table[0].clubId === p.clubId) {
    const label = `🏆 ${season.leagueName} ${season.year}`;
    if (!season.honours.includes(label)) season.honours.push(label);
    if (!p.honours.includes(label)) p.honours.push(label);
  }
  if (isTopScorer) {
    const label = `👟 Artilheiro ${season.leagueName} ${season.year} (${ps.goals} gols)`;
    if (!season.honours.includes(label)) season.honours.push(label);
    if (!p.honours.includes(label)) p.honours.push(label);
  }

  endSeasonGrowth(career, all.apps);
  const finance = evolveWorld(career);
  renewSponsors(career);

  const summary = {
    year: season.year,
    seasonNo: career.seasonNo,
    leagueName: season.leagueName,
    countryName: season.countryName,
    flag: season.flag,
    championName: champion.name,
    myPosition: myPos,
    myClubName: career.clubs[p.clubId].name,
    tableTop: table.slice(0, 6).map((r) => ({
      clubId: r.clubId,
      name: career.clubs[r.clubId].name,
      pts: r.pts,
      gd: r.gf - r.ga,
      me: r.clubId === p.clubId,
    })),
    stats: { ...all, avgRating: all.apps ? Math.round((all.ratingSum / all.apps) * 10) / 10 : 0 },
    leagueStats: { ...ps },
    nationalStats: { ...season.natStats },
    topScorers: scorers.slice(0, 8),
    honours: [...season.honours],
    comps: C.competitionStatus(career),
    finance,
    isTopScorer,
  };

  p.history.push({
    year: season.year,
    club: summary.myClubName,
    position: myPos,
    apps: all.apps,
    goals: all.goals,
    assists: all.assists,
    rating: summary.stats.avgRating,
    honour: season.honours[0] || '',
  });

  const contractEnding = p.contract.years <= 1;
  const myFin = ensureFinance(career, career.clubs[p.clubId]);
  const stay = {
    id: 'stay',
    clubId: p.clubId,
    clubName: summary.myClubName,
    leagueName: season.leagueName,
    countryName: season.countryName,
    flag: season.flag,
    strength: career.clubs[p.clubId].strength,
    stars: career.clubs[p.clubId].stars,
    wage: Math.round(wageFor(career.clubs[p.clubId], overall(p)) * (contractEnding ? 1.12 : 1.05) / 500) * 500,
    years: ri(2, 4),
    role: squadRole(career),
    stay: true,
    sponsor: myFin.sponsor,
    inDebt: myFin.cash < 0,
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
  const moved = career.player.clubId !== clubId;
  startSeason(career, clubId);
  if (moved) news(career, `${p.name} foi apresentado no ${club.name}.`, 'good');
  else news(career, `Nova temporada no ${club.name}.`, 'info');
}

/* ------------------------------------------------------------------ */
/* Informações para a interface                                        */
/* ------------------------------------------------------------------ */

export function clubFinanceInfo(career) {
  const club = career.clubs[career.player.clubId];
  const f = ensureFinance(career, club);
  const att = attendanceFor(career, club);
  return {
    clubName: club.name,
    sponsor: f.sponsor,
    cash: f.cash,
    delayed: f.delayed,
    fanbase: f.fanbase,
    attendance: att,
    strength: club.strength,
    wage: career.player.contract.wage,
    crisis: f.cash < -15e6,
    broke: f.cash < -2e6,
  };
}

export function nationalInfo(career) {
  const p = career.player;
  const nat = C.nationalTeamOf(career, p.countryCode);
  if (!nat) return null;
  return {
    name: nat.name,
    flag: nat.flag,
    strength: nat.strength,
    status: C.callupStatus(career),
    role: C.nationalRole(career),
    caps: p.national.caps,
    goals: p.national.goals,
    assists: p.national.assists,
    honours: p.national.honours,
  };
}

export function competitionsInfo(career) {
  return C.competitionStatus(career);
}

export function newsList(career) {
  return (career.news || []).slice(0, 8);
}
