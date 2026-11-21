// Motor de carreira: mundo, calendário, simulação de partidas, temporadas,
// seleção, finanças dos clubes e evolução do jogador.
// Sem dependências de DOM — roda também no Node para testes.

import {
  COUNTRY_BY_CODE, COUNTRIES, POSITIONS, ATTRS, BASE_ATTRS, TRAININGS,
  FORMATIONS, FORMATION_KEYS, BRANDS, CONTINENTAL_CUPS, DOMESTIC_CUPS, SPONSOR_TIER_LABEL,
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
    const divisions = c.divisions || [c.league];
    const n = c.cities.length;
    divisions.forEach((divisionName, tier) => {
      const clubIds = [];
      for (let i = 0; i < 16; i++) {
        const strength = clamp(Math.round(
          86 - tier * 11 - i * (14 / 15) + (c.rep - 4) * 2.2 + ((i * 7) % 3),
        ), 36, 92);
        const city = c.cities[(i + tier * 5) % n];
        const id = clubs.length;
        clubs.push({
          id,
          city,
          name: `${city} ${c.suffixes[(i + tier * 3) % c.suffixes.length]}`,
          countryCode: c.code,
          countryName: c.name,
          leagueId: `${c.code}-${tier}`,
          tier,
          strength,
          stars: starsFor(strength),
          bankrupt: false,
          crises: 0,
        });
        clubIds.push(id);
      }
      leagues.push({
        id: `${c.code}-${tier}`,
        countryCode: c.code,
        countryName: c.name,
        flag: c.flag,
        name: divisionName,
        tier,
        rep: Math.max(1, c.rep - tier * 1.2),
        clubIds,
      });
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
  const raw = brand.base * 0.26e6 * (0.5 + fanbase / 150) * (1 + fame / 220);
  return Math.round(raw / 1e5) * 1e5;
}

/** Teto de caixa: acima disso o clube reinveste em elenco, estrutura e bônus. */
function cashCap(strength) {
  return Math.round((1.6e6 + Math.max(0, strength - 50) * 0.85e6) / 1e5) * 1e5;
}

function ensureFinance(career, club) {
  if (club.finance) return club.finance;
  const rng = seededRng(hash(`${career.seed}:${club.id}:fin`));
  const fanbase = clamp(Math.round(13 + (club.strength - 50) * 1.6 + rng() * 10 - (club.tier || 0) * 6), 4, 100);
  const tier = sponsorTierFor(club.strength);
  const brand = BRANDS[tier][Math.floor(rng() * BRANDS[tier].length)];
  const cash = clamp((club.strength - 58) * 0.75e6, -4e6, 12e6) + rng() * 1.2e6;
  club.finance = {
    fanbase,
    cash: Math.min(Math.round(cash / 1e5) * 1e5, cashCap(club.strength)),
    sponsor: { tier, brand: brand.name, value: sponsorValue(brand, fanbase, 0) },
    delayed: 0,
    seasonRevenue: 0,
    seasonCost: 0,
    prize: 0,
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
  return 0.9e6 * Math.exp((strength - 55) / 9);
}

function opsCost(strength, tier = 0, fanbase = 30) {
  const base = 0.7e6 + fanbase * 0.045e6 + Math.max(0, strength - 46) * 0.3e6;
  return base * (1 - Math.min(0.25, tier * 0.07));
}

function prizeFor(pos, rep) {
  const base = [18, 11, 8, 6, 5, 4][pos - 1] ?? (pos <= 10 ? 1.6 : 0.8);
  return base * 1e6 * (0.5 + rep * 0.12);
}

function teamFinance(career, club) {
  const f = ensureFinance(career, club);
  const gate = attendanceFor(career, club).attendance * 42 * 19;
  const revenue = f.sponsor.value + gate + f.prize;
  const cost = wageBill(club.strength) + opsCost(club.strength, club.tier || 0, f.fanbase);
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
    tier: league.tier || 0,
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
  const player = {
    name: (name || '').trim() || 'Novo Craque',
    countryCode: country.code,
    countryName: country.name,
    position,
    positionName: (POSITIONS[position] || POSITIONS.MEI).name,
    number: ({ GOL: 1, ZAG: 4, LAT: 2, VOL: 5, MEI: 10, ATA: 9 }[position] || 10),
    age: 17,
    attrs: startingAttrs(position),
    potential: ri(78, 93),
    reputation: 6,
    stigma: 0,
    yellowCount: 0,
    suspensions: 0,
    reds: 0,
    bank: 0,
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
    version: 3,
    seed: seed || Math.floor(Math.random() * 1e9),
    player,
    clubs: world.clubs,
    leagues: world.leagues,
    squads: {},
    nations: null,
    champions: {},
    lastTables: {},
    news: [],
    seasonNo: 1,
    season: null,
    seasonSummary: null,
    offers: [],
    finished: false,
  };

  C.ensureNations(career);

  // Clube inicial: totalmente aleatório na última divisão do país escolhido.
  const ov = overall(player);
  const countryLeagues = world.leagues.filter((l) => l.countryCode === country.code);
  const lastTier = countryLeagues.reduce((max, l) => Math.max(max, l.tier || 0), 0);
  const startLeague = countryLeagues.find((l) => (l.tier || 0) === lastTier) || countryLeagues[0];
  const startClub = world.clubs[pick(startLeague.clubIds)];

  player.clubId = startClub.id;
  player.contract = { wage: wageFor(startClub, ov), years: 2 };
  startSeason(career, startClub.id);

  const fin = ensureFinance(career, startClub);
  news(career, `Você assinou com o ${startClub.name} (${startClub.city}), da ${startLeague ? startLeague.name : 'liga local'}.`, 'good');
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

/** Risco de lesão sobe com o cansaço e com os minutos em campo. */
export function injuryChance(player, minutes = 70) {
  const fitness = player.fitness != null ? player.fitness : 100;
  const fatigue = clamp((100 - fitness) / 100, 0, 1);
  const load = clamp(minutes / 90, 0, 1);
  return clamp(0.012 + fatigue * 0.075 + load * 0.02, 0.005, 0.14);
}

/** Minutos esperados na próxima partida, dado o físico e o papel no elenco. */
export function minutesForecast(career) {
  const p = career.player;
  if ((p.suspensions || 0) > 0 || p.injuryWeeks > 0 || p.fitness <= 32) return 0;
  const role = squadRole(career);
  const base = role === 'titular' ? 88 : role === 'rotacao' ? 64 : (p.age <= 19 ? 30 : 20);
  return clamp(base, 0, 90);
}

/** Impacto do treino escolhido: físico, minutos previstos e risco de lesão. */
export function trainingImpact(career, trainingId) {
  const p = career.player;
  const t = TRAININGS.find((x) => x.id === trainingId) || TRAININGS[0];
  const after = clamp(p.fitness + (t.fit || 0) + 4, 0, 100);
  const minutes = minutesForecast(career);
  return {
    fitness: Math.round(p.fitness),
    after: Math.round(after),
    fitnessDelta: t.fit || 0,
    minutes,
    riskNow: injuryChance(p, minutes),
    riskAfter: injuryChance({ fitness: after }, minutes),
    injured: p.injuryWeeks > 0,
    injuryWeeks: p.injuryWeeks,
    suspended: (p.suspensions || 0) > 0,
    suspensions: p.suspensions || 0,
    recovery: t.id === 'recuperacao',
  };
}

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

/** Zonas da tabela: vaga continental, acesso e rebaixamento. */
export function leagueZoneInfo(career, leagueId) {
  const league = career.leagues.find((l) => l.id === (leagueId || (career.season && career.season.leagueId)));
  if (!league) return { division: '', tier: 0, continental: 0, continentalCup: null, continentalIcon: null, promotion: 0, relegation: 0, cupName: null };
  const tier = league.tier || 0;
  const countryLeagues = career.leagues.filter((l) => l.countryCode === league.countryCode);
  const hasBelow = countryLeagues.some((l) => (l.tier || 0) > tier);
  const confed = (COUNTRY_BY_CODE[league.countryCode] || {}).confed;
  const cup = CONTINENTAL_CUPS[confed] || null;
  return {
    division: league.name,
    tier,
    continental: tier === 0 && cup ? C.continentalSpots(career, confed) : 0,
    continentalCup: tier === 0 && cup ? cup.name : null,
    continentalIcon: tier === 0 && cup ? cup.icon : null,
    promotion: tier > 0 ? 2 : 0,
    relegation: hasBelow ? 2 : 0,
    cupName: DOMESTIC_CUPS[league.countryCode] || 'Copa Nacional',
  };
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

  const suspended = hasPlayer && !national && (p.suspensions || 0) > 0;
  let minutes = 0;
  if (hasPlayer && !suspended && p.injuryWeeks <= 0 && p.fitness > 32) {
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

  // Pênaltis marcados no jogo: um para cada lado, se a sorte ajudar.
  const penalties = [];
  if (hasPlayer && minutes > 0) {
    if (Math.random() < 0.17) {
      const interactive = !!opts.interactivePenalties && p.position !== 'GOL';
      const pen = { minute: ri(6, 88), side: playerHome ? 'home' : 'away', interactive, scored: null, zone: null, keeperZone: null };
      if (!interactive) {
        pen.scored = Math.random() < 0.78;
        if (pen.scored) { if (playerHome) hs++; else as++; }
      }
      penalties.push(pen);
    }
    if (Math.random() < 0.12) {
      const pen = { minute: ri(6, 88), side: playerHome ? 'away' : 'home', interactive: false, scored: Math.random() < 0.79, zone: null, keeperZone: null };
      if (pen.scored) { if (playerHome) as++; else hs++; }
      penalties.push(pen);
    }
  }

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

  let rating = Math.round(clamp(
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
  // Faltas e cartões do jogador: dois amarelos ou um vermelho direto.
  let yellows = 0;
  let sentOff = null;
  let totalFouls = 0;
  if (hasPlayer && minutes > 0) {
    const foulRate = { ZAG: 0.55, VOL: 0.6, LAT: 0.45, MEI: 0.3, ATA: 0.22, GOL: 0.05 }[p.position] || 0.3;
    totalFouls = Math.random() < foulRate ? ri(1, 2) : 0;
    for (let i = 0; i < totalFouls; i++) {
      events.push({ minute: ri(5, 88), type: 'foul', side: playerHome ? 'home' : 'away', text: `Falta de ${p.name}; o árbitro marca.` });
    }
    if (Math.random() < 0.16) yellows = 1;
    if (Math.random() < 0.012) {
      sentOff = { minute: ri(25, 84), straight: yellows === 0 };
      yellows = sentOff.straight ? 0 : 2;
      minutes = Math.min(minutes, sentOff.minute);
      rating = Math.max(4, Math.round((rating - 0.6) * 10) / 10);
    }
    if (yellows === 1) catalogYellow();
    else if (yellows === 2) catalogYellow();
  }
  function catalogYellow() {
    if (yellows === 2) {
      events.push({ minute: sentOff ? sentOff.minute : ri(25, 80), type: 'card', side: playerHome ? 'home' : 'away', text: `🟨🟥 Segundo amarelo: ${p.name} está expulso!` });
    } else {
      events.push({ minute: ri(20, 80), type: 'card', side: playerHome ? 'home' : 'away', text: `🟨 Cartão amarelo para ${p.name}.` });
    }
  }
  if (sentOff && sentOff.straight) {
    events.push({ minute: sentOff.minute, type: 'card', side: playerHome ? 'home' : 'away', text: `🟥 Vermelho direto para ${p.name}!` });
  }
  for (const pen of penalties) {
    const mySide = pen.side === (playerHome ? 'home' : 'away');
    const teamName = pen.side === 'home' ? opts.homeName : opts.awayName;
    let text;
    if (mySide && pen.interactive) text = `🎯 Pênalti para o ${teamName}! ${p.name} vai cobrar.`;
    else if (pen.scored) text = `🎯 Pênalti para o ${teamName}, convertido.`;
    else text = `🎯 Pênalti para o ${teamName}, mas o goleiro defendeu.`;
    events.push({ minute: pen.minute, type: 'penalty', side: pen.side, text });
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
    penalties,
    yellows,
    sentOff,
    red: !!sentOff,
    suspended,
    fouls: totalFouls,
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

  if (detail.suspended && (p.suspensions || 0) > 0) {
    p.suspensions = Math.max(0, p.suspensions - 1);
    news(career, `${p.name} cumpriu suspensão automática e está à disposição.`, 'info');
  }

  if (detail.minutes > 0) {
    ps.apps++;
    ps.minutes += detail.minutes;
    ps.goals += detail.goals;
    ps.assists += detail.assists;
    ps.ratingSum += detail.rating;
    if (detail.rating >= 8.3) ps.motm++;
    if (detail.win) ps.wins++; else if (detail.draw) ps.draws++; else ps.losses++;
    p.fitness = clamp(p.fitness - detail.minutes * (bucket === 'nat' ? 0.1 : 0.19), 0, 100);
    p.reputation = clamp(p.reputation + ((detail.rating - 6.6) * 0.7 + detail.goals * 0.5) *
      (1 - Math.min(0.6, (p.stigma || 0) * 0.2)), 0, 100);
    p.morale = clamp(p.morale + (detail.win ? 4 : detail.draw ? 0 : -3) + (detail.rating - 6.4) * 2, 0, 100);
    p.form = clamp(p.form + (detail.rating - 6.4) * 3, 0, 100);
    detail.injured = false;
    if (Math.random() < injuryChance(p, detail.minutes)) {
      p.injuryWeeks = ri(1, 4);
      detail.injured = true;
      detail.injuryWeeks = p.injuryWeeks;
    }
    if (detail.yellows) {
      p.yellowCount = (p.yellowCount || 0) + detail.yellows;
      if (p.yellowCount >= 3) {
        p.yellowCount -= 3;
        p.suspensions = (p.suspensions || 0) + 1;
        news(career, `${p.name} levou o terceiro amarelo e está suspenso por 1 jogo.`, 'bad');
      }
    }
    if (detail.red) {
      p.reds = (p.reds || 0) + 1;
      const games = detail.sentOff && detail.sentOff.straight ? 2 : 1;
      p.suspensions = (p.suspensions || 0) + games;
      news(career, `🟥 ${p.name} foi expulso e pegou ${games} jogo(s) de suspensão.`, 'bad');
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
  if (comp.kind === 'club') {
    const cashPrize = String(comp.id).startsWith('cc-') ? 9e6
      : String(comp.id).startsWith('scwc-') ? 20e6
      : String(comp.id).startsWith('cwc-') ? 12e6
      : String(comp.id).startsWith('dc-') ? 3.5e6 : 0;
    if (cashPrize > 0) {
      ensureFinance(career, career.clubs[p.clubId]).cash += cashPrize;
      news(career, `Premiação de ${formatMoney(cashPrize)} pela conquista do ${comp.name}.`, 'good');
    }
  }
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
        interactivePenalties: true,
      });
      detail.resultKey = `${ev.round}:${mi}`;
      if ((detail.penalties || []).some((pen) => pen.interactive && pen.scored == null)) {
        // O resultado só é fechado depois que você cobra o pênalti.
        detail.pendingOutcome = 'league';
      } else {
        season.results[detail.resultKey] = { hs: detail.hs, as: detail.as };
        applyMatchOutcome(career, detail, 'league');
      }
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

export const PENALTY_ZONES = [
  'Canto alto esquerdo',
  'Canto alto direito',
  'Meio da baliza',
  'Canto baixo esquerdo',
  'Canto baixo direito',
];

/** Próximo pênalti que depende da sua escolha, se houver. */
export function pendingPenalty(detail) {
  if (!detail || !detail.penalties) return null;
  return detail.penalties.find((pen) => pen.interactive && pen.scored == null) || null;
}

/**
 * Cobrança de pênalti: o goleiro escolhe um dos cinco lugares; se coincidir
 * com o seu canto, ele defende. Atualiza placar, nota e estatísticas.
 */
export function resolvePenalty(career, detail, zone) {
  const pen = pendingPenalty(detail);
  if (!pen) return null;
  const p = career.player;
  const keeperZone = ri(0, 4);
  const saved = keeperZone === zone;
  pen.zone = zone;
  pen.keeperZone = keeperZone;
  pen.scored = !saved;
  const label = PENALTY_ZONES[zone] || PENALTY_ZONES[2];
  if (saved) {
    detail.rating = Math.max(4, Math.round((detail.rating - 0.4) * 10) / 10);
    detail.events.push({
      minute: pen.minute, type: 'chance', side: pen.side,
      text: `🧤 ${p.name} cobrou no ${label.toLowerCase()}, mas o goleiro defendeu!`,
    });
  } else {
    if (detail.playerHome) detail.hs++;
    else detail.as++;
    detail.goals = (detail.goals || 0) + 1;
    detail.myGoals = (detail.myGoals || 0) + 1;
    detail.rating = Math.min(10, Math.round((detail.rating + 0.6) * 10) / 10);
    detail.events.push({
      minute: pen.minute, type: 'goal', side: pen.side,
      text: `⚽ GOL! ${p.name} cobrou no ${label.toLowerCase()} e o goleiro não chegou.`,
    });
  }
  detail.events.sort((a, b) => a.minute - b.minute);
  return { saved, zone, keeperZone, label, keeperLabel: PENALTY_ZONES[keeperZone], minute: pen.minute };
}

/** Fecha o resultado da partida (necessário quando havia pênalti pendente). */
export function finalizeMatch(career, detail) {
  if (!detail || detail.finalized) return detail;
  detail.finalized = true;
  if (detail.resultKey && career.season) {
    career.season.results[detail.resultKey] = { hs: detail.hs, as: detail.as };
  }
  if (detail.pendingOutcome) {
    const bucket = detail.pendingOutcome;
    detail.pendingOutcome = null;
    applyMatchOutcome(career, detail, bucket);
  }
  return detail;
}

export function midWindowOffers(career) {
  return career.midWindow && !career.midWindow.closed ? career.midWindow.offers : [];
}

/** Aceita uma proposta do meio da temporada: pré-contrato para a próxima. */
export function signPreContract(career, clubId) {
  const win = career.midWindow;
  if (!win || win.closed) return null;
  const offer = win.offers.find((o) => o.clubId === clubId);
  if (!offer) return null;
  career.preContract = { ...offer, preContract: true, signedYear: win.year };
  win.closed = true;
  news(career, `${career.player.name} assinou pré-contrato com o ${offer.clubName}: chega na próxima temporada.`, 'good');
  return career.preContract;
}

export function closeMidWindow(career) {
  if (career.midWindow) career.midWindow.closed = true;
}

export function refuseOffer(career, clubId, where = 'end') {
  if (where === 'mid') {
    if (career.midWindow) career.midWindow.offers = career.midWindow.offers.filter((o) => o.clubId !== clubId);
    return;
  }
  career.offers = (career.offers || []).filter((o) => o.clubId !== clubId || o.stay);
}

/** Pedir melhoria na proposta: pode dar certo, depende da sua fama e do caixa. */
export function negotiateOffer(career, clubId, where = 'end') {
  const list = where === 'mid'
    ? ((career.midWindow && career.midWindow.offers) || [])
    : (career.offers || []);
  const offer = list.find((o) => o.clubId === clubId);
  if (!offer) return { ok: false, reason: 'notFound' };
  if (offer.improved) return { ok: false, reason: 'already' };
  const p = career.player;
  const club = career.clubs[clubId];
  const fin = ensureFinance(career, club);
  const leverage = clamp(
    0.28 + (overall(p) - club.strength) * 0.022 + p.reputation * 0.002 +
    (p.awards || []).length * 0.03 - (p.stigma || 0) * 0.06 - (fin.cash < 0 ? 0.18 : 0),
    0.05, 0.92,
  );
  offer.improved = true;
  if (Math.random() < leverage) {
    offer.wage = Math.round((offer.wage * rnd(1.08, 1.22)) / 500) * 500;
    offer.years = Math.max(offer.years || 2, 3);
    news(career, `${club.name} aceitou melhorar a proposta: ${formatMoney(offer.wage)}/mês por ${offer.years} temporadas.`, 'good');
    return { ok: true, wage: offer.wage, offer };
  }
  news(career, `${club.name} recusou o pedido de melhoria e manteve ${formatMoney(offer.wage)}/mês.`, 'bad');
  return { ok: false, reason: 'refused', wage: offer.wage, offer };
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

  // Janela do meio da temporada: propostas para assinar pré-contrato.
  if (ev.type === 'league' && !career.midWindow && season.rounds.length > 3 &&
    season.roundIndex >= Math.ceil(season.rounds.length / 2)) {
    const offers = generateOffers(career);
    career.midWindow = { year: season.year, round: season.roundIndex, offers, closed: offers.length === 0 };
    if (offers.length) {
      news(career, '🪟 A janela de transferências abriu no meio da temporada: você recebeu propostas.', 'info');
    }
  }
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

/** Falência: o clube perde força, torcida e patrocínio — e o jogador carrega a fama. */
function bankruptcy(career, club) {
  const f = ensureFinance(career, club);
  const p = career.player;
  club.bankrupt = true;
  club.crises = (club.crises || 0) + 1;
  club.strength = clamp(club.strength - 9, 34, 95);
  club.stars = starsFor(club.strength);
  f.fanbase = clamp(Math.round(f.fanbase * 0.6), 4, 100);
  f.cash = 0;
  f.delayed = 0;
  f.sponsor = { tier: 'nenhum', brand: 'Sem patrocinador', value: 0 };
  for (const s of career.squads[club.id] || []) s.rating = clamp(Math.round(s.rating - 6), 38, 96);
  news(career, `💥 ${club.name} decretou falência: perdeu força, torcida e patrocinadores.`, 'bad');

  if (club.id === p.clubId) {
    p.reputation = clamp(p.reputation - (12 + club.crises * 3), 0, 100);
    p.stigma = clamp((p.stigma || 0) + 2, 0, 5);
    p.stigmaSeason = career.season.year;
    p.morale = clamp(p.morale - 22, 0, 100);
    news(career, `A falência do ${club.name} manchou sua reputação: você não conseguiu salvar o clube.`, 'bad');
  }
}

function evolveWorld(career) {
  const season = career.season;
  const table = standings(career);
  const p = career.player;

  // Ordem final de cada divisão (a do jogador vem da tabela real;
  // as demais seguem a força do elenco).
  const orders = new Map();
  for (const league of career.leagues) {
    const order = league.id === season.leagueId
      ? table.map((r) => r.clubId)
      : league.clubIds.slice().sort((a, b) => career.clubs[b].strength - career.clubs[a].strength);
    orders.set(league.id, order);
  }

  const changes = [];
  for (const league of career.leagues) {
    const order = orders.get(league.id);
    order.forEach((id, idx) => {
      const club = career.clubs[id];
      const f = ensureFinance(career, club);
      const pos = idx + 1;
      const before = club.strength;

      f.prize = prizeFor(pos, league.rep);
      const fin = teamFinance(career, club);
      f.cash += fin.revenue - fin.cost;
      f.seasonRevenue = fin.revenue;
      f.seasonCost = fin.cost;

      // Dívida cresce com juros e a crise se instala de verdade.
      if (f.cash < 0) f.cash *= 1.08;
      f.delayed = f.cash < -1.5e6 ? Math.min(9, f.delayed + 1) : 0;

      const tier = club.tier || 0;
      const perf = pos <= 2 ? 1.0 : pos <= 5 ? 0.55 : pos <= 10 ? 0.05 : pos <= 13 ? -0.5 : -1.0;
      const cap = cashCap(club.strength);
      const cashScore = clamp((f.cash - cap * 0.35) / (cap * 0.9), -1.2, 0.9);
      // Cada divisão tem seu próprio nível: evita inflação geral de força.
      const anchor = 80 - tier * 13;
      let delta = perf + cashScore * 0.5 + rnd(-0.35, 0.35) - (club.strength - anchor) * 0.08;
      if (f.delayed >= 2) delta -= 0.5;

      // Excedente acima do teto vira reforço de elenco/estrutura: os grandes
      // não acumulam centenas de milhões, o dinheiro volta para o futebol.
      if (f.cash > cap) {
        const excess = f.cash - cap;
        f.cash = cap;
        delta += clamp(excess / 90e6, 0, 0.3);
      }
      delta = Math.round(delta * 10) / 10;

      f.fanbase = clamp(f.fanbase + (pos <= 2 ? 4 : pos <= 6 ? 2 : pos >= 14 ? -4 : 0) + rnd(-1, 1), 4, 100);
      if (f.delayed >= 2) f.fanbase = clamp(f.fanbase - 2, 4, 100);
      club.strength = clamp(Math.round(before + delta), 34, 95);
      club.stars = starsFor(club.strength);
      f.cash = Math.min(f.cash, cashCap(club.strength));
      changes.push({ club, delta });

      if (!club.bankrupt && f.cash < -18e6 && f.delayed >= 4) bankruptcy(career, club);
      // Clube já falido que volta a mergulhar em dívida renegocia com credores.
      if (club.bankrupt && f.cash < -8e6) {
        f.cash = -1e6;
        if (club.id === p.clubId) news(career, `${club.name} renegociou a dívida com os credores.`, 'info');
      }
    });
  }

  // Ajusta os elencos já gerados e registra contratações/vendas.
  for (const { club, delta } of changes) {
    const ev = adjustSquad(career, club, delta);
    if (ev && club.id === p.clubId) news(career, ev.text, ev.kind === 'in' ? 'good' : 'bad');
  }

  // Classificação final guardada para as vagas continentais do ano seguinte.
  career.lastTables = career.lastTables || {};
  for (const league of career.leagues) career.lastTables[league.id] = orders.get(league.id).slice();

  // Acesso e rebaixamento: 2 sobem, 2 caem em cada limite de divisão.
  const countries = [...new Set(career.leagues.map((l) => l.countryCode))];
  for (const code of countries) {
    const tiers = career.leagues.filter((l) => l.countryCode === code).sort((a, b) => a.tier - b.tier);
    for (let t = 0; t < tiers.length - 1; t++) {
      const up = orders.get(tiers[t + 1].id).slice(0, 2);
      const down = orders.get(tiers[t].id).slice(-2);
      for (const id of down) {
        career.clubs[id].leagueId = tiers[t + 1].id;
        career.clubs[id].tier = tiers[t + 1].tier;
      }
      for (const id of up) {
        career.clubs[id].leagueId = tiers[t].id;
        career.clubs[id].tier = tiers[t].tier;
      }
    }
  }
  for (const league of career.leagues) {
    league.clubIds = career.clubs.filter((c) => c.leagueId === league.id).map((c) => c.id);
  }

  const myClub = career.clubs[p.clubId];
  const f = ensureFinance(career, myClub);
  const myLeague = career.leagues.find((l) => l.id === myClub.leagueId);
  const oldTier = season.tier != null ? season.tier : (myLeague ? myLeague.tier : 0);
  const promoted = !!myLeague && myLeague.tier < oldTier;
  const relegated = !!myLeague && myLeague.tier > oldTier;
  if (promoted) news(career, `🎉 ${myClub.name} subiu para a ${myLeague.name}!`, 'good');
  if (relegated) news(career, `⚠ ${myClub.name} caiu para a ${myLeague.name}.`, 'bad');

  if (f.delayed > 0) {
    p.morale = clamp(p.morale - 8 - f.delayed * 2, 0, 100);
    news(career, `Salários atrasados no ${myClub.name}: ${f.delayed} ${f.delayed > 1 ? 'meses' : 'mês'} sem receber.`, 'bad');
  } else if (f.cash > 20e6) {
    p.morale = clamp(p.morale + 3, 0, 100);
  }
  if (f.cash < -8e6) news(career, `${myClub.name} está à beira da falência e a torcida protesta.`, 'bad');

  return {
    clubName: myClub.name,
    division: myLeague ? myLeague.name : '',
    promoted,
    relegated,
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
    let idx = TIERS.indexOf(sponsorTierFor(club.strength));
    if (fame >= 62) idx += 1;
    if (fame >= 80) idx = TIERS.length - 1;
    // Divisão inferior não fecha contrato mundial, nem com craque no elenco.
    idx = Math.min(idx, Math.max(0, TIERS.length - 1 - (club.tier || 0)));
    if ((f.cash < -8e6 || f.delayed >= 3) && idx > 0) idx -= 1;
    let tier = TIERS[idx];
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
  const stigma = p.stigma || 0;
  const prestige = (p.awards || []).length;
  // Reputação manchada afasta os clubes grandes; prêmios individuais atraem.
  const ceiling = ov + 13 + Math.min(6, prestige * 1.5) - stigma * 5;
  const pool = career.clubs.filter((c) => {
    if (c.id === p.clubId) return false;
    if (c.bankrupt) return false;
    if (c.strength > ceiling) return false;
    if (c.strength < ov - 15) return false;
    return true;
  });
  const count = ri(2, 4) + Math.min(3, Math.floor(prestige / 2)) - (stigma ? 1 : 0);
  const weighted = shuffle(pool).slice(0, Math.max(1, Math.min(pool.length, count)));
  return weighted.map((club, i) => {
    const fin = ensureFinance(career, club);
    const afford = clamp(fin.cash / 8e6 + 1, 0.45, 1.4);
    const role = club.strength > ov + 3 ? 'rotacao' : 'titular';
    const league = career.leagues.find((l) => l.id === club.leagueId);
    const mates = career.clubs.filter((c) => c.leagueId === club.leagueId);
    const avgSponsor = mates.reduce((sum, c) => sum + ensureFinance(career, c).sponsor.value, 0) / Math.max(1, mates.length);
    const sponsorRatio = avgSponsor > 0 ? fin.sponsor.value / avgSponsor : 1;
    return {
      id: `offer-${i}`,
      clubId: club.id,
      clubName: club.name,
      leagueName: league ? league.name : '',
      countryName: club.countryName,
      flag: (COUNTRY_BY_CODE[club.countryCode] || {}).flag || '',
      strength: club.strength,
      stars: club.stars,
      wage: Math.round(wageFor(club, ov) * rnd(1.0, 1.35) * afford *
        (1 - stigma * 0.12) * (1 + Math.min(0.3, prestige * 0.02)) / 500) * 500,
      years: ri(2, 4),
      role,
      sponsor: fin.sponsor,
      sponsorNote: fin.sponsor.brand === 'Sem patrocinador'
        ? 'Sem patrocinador: nenhuma receita extra para bancar contratações.'
        : `${SPONSOR_TIER_LABEL[fin.sponsor.tier] || 'Patrocínio'} (${fin.sponsor.brand}): ${formatMoney(fin.sponsor.value)}/ano, ${sponsorRatio >= 1.15 ? 'acima' : sponsorRatio <= 0.85 ? 'abaixo' : 'na média'} da divisão.`,
      debtNote: fin.cash < 0
        ? `Caixa de ${formatMoney(fin.cash)}: a dívida derruba a proposta e pode atrasar salários.`
        : `Caixa de ${formatMoney(fin.cash)}: o clube paga em dia.`,
      inDebt: fin.cash < 0,
    };
  }).sort((a, b) => b.strength - a.strength);
}

/* ------------------------------------------------------------------ */
/* Prêmios individuais                                                 */
/* ------------------------------------------------------------------ */

const AWARDS = {
  ballon: { name: 'Bola de Ouro', icon: '🥇', bonus: 6e6 },
  yashin: { name: 'Troféu Yashin (melhor goleiro)', icon: '🧤', bonus: 3e6 },
  golden: { name: 'Golden Boy', icon: '🌟', bonus: 2e6 },
  puskas: { name: 'Prêmio Puskás', icon: '🚀', bonus: 1.5e6 },
  team: { name: 'Seleção da temporada', icon: '📋', bonus: 2e6 },
};

function seasonTitles(career) {
  const p = career.player;
  return Object.values(career.season.comps || {}).filter((c) => c.champion != null &&
    c.champion === (c.kind === 'club' ? p.clubId : p.countryCode));
}

function seasonScore(career, all) {
  const p = career.player;
  const rating = all.apps ? all.ratingSum / all.apps : 0;
  const titles = seasonTitles(career);
  const has = (prefix) => titles.some((t) => String(t.id).startsWith(prefix));
  const league = career.leagues.find((l) => l.id === career.season.leagueId);
  const level = league ? clamp(league.rep / 5, 0.4, 1) : 1;
  const tier = league ? league.tier || 0 : 0;
  let score = (all.apps * 0.42 + Math.min(all.goals, 45) * 1.9 + all.assists * 1.25 +
    (rating - 6.2) * 62) * (0.6 + 0.4 * level);
  if (career.champions && career.champions[career.season.leagueId] === p.clubId) score += 15;
  if (has('cc-')) score += 20;
  if (has('dc-')) score += 6;
  if (has('cwc-')) score += 12;
  if (has('scwc-')) score += 16;
  if (has('cont-')) score += 10;
  if (has('conf-')) score += 12;
  if (has('wc-')) score += 40;
  score += clamp((p.reputation - 50) * 0.25, -6, 12);
  score -= (p.stigma || 0) * 7;
  return { score: Math.max(0, score), rating, titles, has, tier, level };
}

function rollAwards(career, all) {
  const p = career.player;
  p.awards = p.awards || [];
  const { score, titles, tier } = seasonScore(career, all);
  const gk = p.position === 'GOL';
  const elite = tier === 0;
  const out = [];

  const give = (key, chance, rep) => {
    if (!(chance > 0) || Math.random() >= chance) return false;
    const info = AWARDS[key];
    out.push({ key, name: info.name, icon: info.icon, bonus: info.bonus, year: career.season.year });
    p.awards.push({ year: career.season.year, key, name: info.name, icon: info.icon });
    p.bank = (p.bank || 0) + info.bonus;
    p.reputation = clamp(p.reputation + rep, 0, 100);
    news(career, `${info.icon} ${p.name} levou o ${info.name} de ${career.season.year} e embolsou ${formatMoney(info.bonus)}.`, 'good');
    return true;
  };

  // Bola de Ouro: quem venceu a Copa do Mundo no ano tem prioridade; sem a
  // Copa só uma temporada quase impecável leva o prêmio.
  const wonWorldCup = titles.some((t) => String(t.id).startsWith('wc-'));
  let ballon = wonWorldCup
    ? clamp((score - 42) / 110, 0, 0.9)
    : clamp((score - 96) / 120, 0, 0.55);
  if (titles.some((t) => String(t.id).startsWith('cc-'))) ballon += 0.06;
  if (career.champions && career.champions[career.season.leagueId] === p.clubId) ballon += 0.04;
  if (!elite) ballon = 0; // o prêmio de melhor do mundo é decidido na elite
  ballon = clamp(ballon, 0, 0.95);
  if (gk) ballon /= 10; // goleiro tem 10x menos chance de Bola de Ouro
  if (give('ballon', ballon, 12)) p.reputation = clamp(p.reputation + 4, 0, 100);

  if (gk) give('yashin', elite ? clamp((score - 55) / 95, 0, 0.7) : 0, 8);
  if (p.age <= 21 && all.apps >= 12) give('golden', clamp((score - 62) / 80, 0, 0.9), 8);
  if (!gk && all.goals >= 8) {
    give('puskas', clamp(0.01 + all.goals * 0.008 + (p.position === 'ATA' ? 0.03 : 0), 0, 0.25), 5);
  }
  give('team', elite ? clamp((score - 60) / 95, 0, 0.85) : 0, 4);
  return out;
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

  // Salários recebidos e prêmios individuais da temporada.
  const finBefore = ensureFinance(career, career.clubs[p.clubId]);
  p.bank = (p.bank || 0) + p.contract.wage * Math.max(0, 12 - (finBefore.delayed || 0));
  const awards = rollAwards(career, all);

  endSeasonGrowth(career, all.apps);
  const finance = evolveWorld(career);
  renewSponsors(career);

  // Aos poucos a má fama da falência some com boas temporadas.
  if ((p.stigma || 0) > 0 && finance.delayed === 0 && all.apps >= 15 &&
    p.stigmaSeason !== career.season.year && Math.random() < 0.5) {
    p.stigma = Math.max(0, p.stigma - 1);
    news(career, p.stigma === 0
      ? 'Sua reputação voltou ao normal: os clubes voltaram a confiar em você.'
      : 'Sua reputação está se recuperando depois da falência do clube anterior.', 'good');
  }

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
    awards,
    bank: p.bank || 0,
    stigma: p.stigma || 0,
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
    division: finance.division,
    honour: season.honours[0] || '',
  });

  const contractEnding = p.contract.years <= 1;
  const myFin = ensureFinance(career, career.clubs[p.clubId]);
  const stay = {
    id: 'stay',
    clubId: p.clubId,
    clubName: summary.myClubName,
    leagueName: (career.leagues.find((l) => l.id === career.clubs[p.clubId].leagueId) || {}).name || season.leagueName,
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
  if (career.preContract && career.preContract.clubId !== p.clubId) {
    const pre = { ...career.preContract, preContract: true };
    career.offers = [pre, ...career.offers.filter((o) => o.clubId !== pre.clubId)];
  }
  career.seasonSummary = summary;
  return summary;
}

export function startNewSeason(career, clubId) {
  const p = career.player;
  p.age += 1;
  p.yellowCount = 0;
  career.midWindow = null;
  career.preContract = null;
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
  const league = career.leagues.find((l) => l.id === club.leagueId);
  return {
    clubName: club.name,
    division: league ? league.name : '',
    tier: club.tier || 0,
    sponsor: f.sponsor,
    cash: f.cash,
    cap: cashCap(club.strength),
    delayed: f.delayed,
    fanbase: f.fanbase,
    attendance: att,
    strength: club.strength,
    wage: career.player.contract.wage,
    bankrupt: !!club.bankrupt,
    crisis: f.cash < -8e6,
    broke: f.cash < -1.5e6,
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
