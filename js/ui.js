// Interface do jogo: menu, criação, central da carreira, transmissão, temporada e mercado.

import * as E from './engine.js';
import { COUNTRIES, ATTRS, POSITIONS, TRAININGS, SPONSOR_TIER_LABEL } from './data.js';
import { createViewer } from './viewer.js';

const SAVE_KEY = 'carreira-futebol-v1';
const app = document.getElementById('app');

let career = null;
let screen = 'menu';
let selectedTraining = 'fisico';
let createPos = 'MEI';
let viewer = null;
let pendingDetail = null;
let pendingSummary = null;
let marketNotice = null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => Math.max(0, Math.min(100, Math.round(v)));

function save() {
  if (!career) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(career)); } catch (e) { /* sem storage */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 3 || !data.player || !data.season) return null;
    return data;
  } catch (e) { return null; }
}
function hasSave() {
  return !!loadSave();
}

/* ------------------------------------------------------------------ */
/* Fragmentos                                                          */
/* ------------------------------------------------------------------ */

function attrBar(label, value, cls = '') {
  return `<div class="attr"><span class="lbl">${label}</span><div class="bar ${cls}"><i style="width:${pct(value)}%"></i></div><span class="val">${Math.round(value)}</span></div>`;
}

function playerCard() {
  const p = career.player;
  const club = career.clubs[p.clubId];
  const ov = E.overall(p);
  const role = E.squadRole(career);
  const ps = career.season.pstats;

  const attrs = ATTRS.filter((a) => a.key !== 'gol' || p.position === 'GOL')
    .map((a) => attrBar(a.name, p.attrs[a.key]))
    .join('');

  return `<div class="card">
    <div class="player-head">
      <div class="avatar">${p.position}</div>
      <div class="who">
        <div class="name">${esc(p.name)}</div>
        <div class="sub">${esc(club.name)} · ${p.age} anos · ${p.countryName}</div>
      </div>
    </div>
    <div class="overall"><b>${ov}</b><span>geral · ${p.positionName}</span></div>
    <div class="kv"><span>Camisa</span><span class="row" style="gap:6px"><b>#${p.number || 10}</b><input class="input number-input" type="number" min="1" max="99" value="${p.number || 10}" data-number aria-label="Número da camisa"></span></div>
    ${attrs}
    <div class="divider"></div>
    ${attrBar('Forma', p.form, 'blue')}
    ${attrBar('Moral', p.morale, 'gold')}
    ${attrBar('Físico', p.fitness, '')}
    <div class="divider"></div>
    <div class="kv"><span>Valor de mercado</span><b>${E.formatMoney(E.marketValue(p))}</b></div>
    <div class="kv"><span>Salário</span><b>${E.formatMoney(p.contract.wage)}/mês</b></div>
    <div class="kv"><span>Contrato</span><b>${p.contract.years} ${p.contract.years > 1 ? 'temporadas' : 'temporada'}</b></div>
    <div class="kv"><span>Reputação</span><b>${E.managerReputationLabel(p.reputation)}</b></div>
    <div class="kv"><span>Patrimônio</span><b>${E.formatMoney(p.bank || 0)}</b></div>
    <div class="kv"><span>Papel no elenco</span><b>${E.ROLE_LABEL[role]}</b></div>
    <div class="kv"><span>Cartões</span><b>${p.yellowCount || 0} amarelos · ${p.reds || 0} vermelhos</b></div>
    ${(p.suspensions || 0) > 0 ? `<div class="kv"><span>Suspensão</span><b style="color:var(--red)">${p.suspensions} jogo(s)</b></div>` : ''}
    ${(p.stigma || 0) > 0 ? `<p class="warn">⚠ Reputação manchada pela falência do clube anterior (${p.stigma}/5). Clubes grandes evitam você e a seleção fecha as portas — recupere com boas temporadas.</p>` : ''}
    ${(p.awards || []).length ? `<div class="divider"></div><h3>Prêmios individuais</h3><div>${p.awards.slice(-8).map((a) => `<span class="badge gold" style="margin:3px 6px 3px 0">${a.icon || '🏅'} ${esc(a.name)} ${a.year}</span>`).join('')}</div>` : ''}
    ${p.injuryWeeks > 0 ? `<div class="kv"><span>Lesão</span><b style="color:var(--red)">fora por ${p.injuryWeeks} sem.</b></div>` : ''}
    <div class="divider"></div>
    <h3>Temporada atual</h3>
    <div class="stats-grid">
      <div class="stat"><b>${ps.apps}</b><small>Jogos</small></div>
      <div class="stat"><b>${ps.goals}</b><small>Gols</small></div>
      <div class="stat"><b>${ps.assists}</b><small>Assist.</small></div>
      <div class="stat"><b>${ps.apps ? (ps.ratingSum / ps.apps).toFixed(1).replace('.', ',') : '—'}</b><small>Nota</small></div>
    </div>
    <p class="muted tiny" style="margin-top:8px">Estatísticas da liga. Copas e seleção aparecem no resumo da temporada.</p>
  </div>`;
}

function nationalCard() {
  const n = E.nationalInfo(career);
  if (!n) return '';
  const status = n.status
    ? `<span class="badge">convocado · ${E.ROLE_LABEL[n.role]}</span>`
    : '<span class="badge gray">não convocado</span>';
  return `<div class="card">
    <h3>${n.flag} Seleção · ${esc(n.name)}</h3>
    <div class="row between wrap" style="margin-bottom:8px">
      <span class="muted tiny">Força da seleção ${n.strength}</span>
      ${status}
    </div>
    <div class="kv"><span>Jogos (caps)</span><b>${n.caps}</b></div>
    <div class="kv"><span>Gols pela seleção</span><b>${n.goals}</b></div>
    <div class="kv"><span>Assistências</span><b>${n.assists}</b></div>
    ${n.honours.length ? `<div class="divider"></div><div>${n.honours.map((h) => `<div class="badge gold" style="margin:3px 6px 3px 0">${esc(h)}</div>`).join('')}</div>` : ''}
    <p class="muted tiny" style="margin-top:8px">${n.status ? 'Você está na lista para as próximas datas FIFA.' : 'Cresça e ganhe reputação para ser chamado.'}</p>
  </div>`;
}

function financeCard() {
  const f = E.clubFinanceInfo(career);
  const tierLabel = SPONSOR_TIER_LABEL[f.sponsor.tier] || 'Patrocínio';
  const cashColor = f.cash < 0 ? 'color:var(--red)' : f.cash < 5e6 ? 'color:var(--gold)' : '';
  return `<div class="card">
    <h3>Clube · finanças</h3>
    <div class="kv"><span>Divisão</span><b>${esc(f.division)}</b></div>
    <div class="kv"><span>Força do clube</span><b>${f.strength} · ${'★'.repeat(career.clubs[career.player.clubId].stars)}</b></div>
    <div class="kv"><span>${tierLabel}</span><b>${esc(f.sponsor.brand)}</b></div>
    <div class="kv"><span>Valor do patrocínio</span><b>${E.formatMoney(f.sponsor.value)}/ano</b></div>
    <div class="kv"><span>Caixa do clube</span><b style="${cashColor}">${E.formatMoney(f.cash)}</b></div>
    <div class="kv"><span>Torcida</span><b>${f.fanbase}/100</b></div>
    <div class="kv"><span>Público no estádio</span><b>${f.attendance.attendance.toLocaleString('pt-BR')} de ${f.attendance.capacity.toLocaleString('pt-BR')}</b></div>
    <div class="kv"><span>Seu salário</span><b>${E.formatMoney(f.wage)}/mês</b></div>
    ${f.delayed > 0 ? `<p class="warn">⚠ Salários atrasados: ${f.delayed} ${f.delayed > 1 ? 'meses' : 'mês'} sem receber.</p>` : ''}
    <div class="kv"><span>Teto de caixa</span><b>${E.formatMoney(f.cap)}</b></div>
    ${f.bankrupt ? '<p class="warn">💥 Clube falido: perdeu força e torcida, e sua reputação ficou manchada por não tê-lo salvado.</p>' : f.crisis ? '<p class="warn">⚠ Clube à beira da falência. A torcida abandonou o estádio.</p>' : f.broke ? '<p class="warn">⚠ Contas no vermelho. Contratações ficam difíceis.</p>' : ''}
    <p class="muted tiny" style="margin-top:8px">Sua fama atrai patrocinadores: quanto maior sua reputação, maior a marca que o clube fecha.</p>
  </div>`;
}

function competitionsCard() {
  const list = E.competitionsInfo(career);
  if (!list.length) return '';
  const zone = E.leagueZoneInfo(career);
  const rows = list.map((c) => {
    const cls = c.status === 'Campeão' ? 'gold' : c.status === 'Em disputa' ? '' : 'gray';
    const stage = c.status === 'Em disputa' ? `<br><span class="muted tiny">${esc(c.stage)}</span>` : '';
    return `<li class="list-item">
      <span><span class="muted tiny">${c.kind === 'club' ? 'clube' : 'seleção'}</span> ${c.icon} ${esc(c.name)}</span>
      <span class="r"><span class="badge ${cls}">${esc(c.status)}</span>${stage}</span>
    </li>`;
  }).join('');
  const rules = [];
  if (zone.continental) {
    rules.push(`Terminar entre os ${zone.continental} primeiros da ${esc(zone.division)} garante vaga na ${esc(zone.continentalCup)} da temporada seguinte — as vagas saem da classificação da temporada anterior.`);
  }
  if (zone.promotion) rules.push(`Os ${zone.promotion} primeiros sobem para a divisão de cima.`);
  if (zone.relegation) rules.push(`Os ${zone.relegation} últimos caem de divisão.`);
  if (zone.cupName) rules.push(`A ${esc(zone.cupName)} é mata-mata com clubes de todas as divisões: quem perde está fora.`);
  return `<div class="card"><h3>Competições ${career.season.year}</h3><ul>${rows}</ul>
    ${rules.length ? `<div class="divider"></div><p class="muted tiny" style="line-height:1.65">${rules.join(' ')}</p>` : ''}
  </div>`;
}

function midWindowCard() {
  const win = career.midWindow;
  if (!win || win.closed) return '';
  const offers = win.offers.map((o) => offerRow(o, 'mid')).join('');
  return `<div class="card window-card">
    <div class="row between wrap" style="margin-bottom:8px">
      <h3 style="margin:0">🪟 Janela do meio da temporada</h3>
      <span class="badge gold">rodada ${win.round}</span>
    </div>
    <p class="muted tiny" style="margin-bottom:10px">Aceitar agora é um pré-contrato: você termina esta temporada no clube atual e se apresenta ao novo na próxima.</p>
    ${marketNotice ? `<p class="warn">${esc(marketNotice)}</p>` : ''}
    ${offers || '<p class="muted tiny">Nenhuma proposta restante. Você segue no clube atual.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn small ghost" data-action="mid-close">Fechar janela</button></div>
  </div>`;
}

function offerRow(o, where) {
  const sponsorLine = o.sponsorNote || (o.sponsor && o.sponsor.brand !== 'Sem patrocinador'
    ? `Patrocínio: ${o.sponsor.brand} (${E.formatMoney(o.sponsor.value)}/ano)`
    : 'Sem patrocinador');
  return `<div class="offer">
      <span class="crest">${o.stars}★</span>
      <span>
        <span class="nm">${esc(o.clubName)} ${o.stay ? '<span class="badge">renovar</span>' : ''} ${o.preContract ? '<span class="badge gold">pré-contrato</span>' : ''} ${o.inDebt ? '<span class="badge red">dívidas</span>' : ''}</span>
        <span class="dt">${o.flag || ''} ${esc(o.leagueName)} · ${esc(o.countryName)} · força ${o.strength} · ${E.ROLE_LABEL[o.role] || ''}</span>
        <span class="dt">${esc(sponsorLine)}</span>
        ${o.debtNote ? `<span class="dt">${esc(o.debtNote)}</span>` : ''}
        <span class="offer-actions">
          <button class="btn small primary" data-offer="${o.clubId}" data-where="${where}">${where === 'mid' ? 'Assinar pré-contrato' : 'Aceitar oferta'}</button>
          <button class="btn small" data-negotiate="${o.clubId}" data-where="${where}" ${o.improved ? 'disabled' : ''}>${o.improved ? 'Melhoria pedida' : 'Pedir melhoria'}</button>
          ${o.stay ? '' : `<button class="btn small danger" data-refuse="${o.clubId}" data-where="${where}">Recusar</button>`}
        </span>
      </span>
      <span class="dt" style="text-align:right">${E.formatMoney(o.wage)}/mês<br>${o.years} temporadas</span>
    </div>`;
}

function newsCard() {
  const list = E.newsList(career);
  if (!list.length) return '';
  const rows = list.map((n) => `<li class="list-item news ${n.kind === 'bad' ? 'bad' : n.kind === 'good' ? 'good' : ''}">
      <span>${esc(n.text)}</span><span class="r">${n.year}</span>
    </li>`).join('');
  return `<div class="card"><h3>Notícias</h3><ul>${rows}</ul></div>`;
}

function standingsCard() {
  const rows = E.standings(career);
  const myId = career.player.clubId;
  const zone = E.leagueZoneInfo(career);
  const total = rows.length;
  const body = rows.map((r, i) => {
    const club = career.clubs[r.clubId];
    const pos = i + 1;
    const cls = [];
    if (r.clubId === myId) cls.push('me');
    if (zone.continental && pos <= zone.continental) cls.push('z-cc');
    if (zone.promotion && pos <= zone.promotion) cls.push('z-up');
    if (zone.relegation && pos > total - zone.relegation) cls.push('z-down');
    return `<tr class="${cls.join(' ')}">
      <td class="pos">${pos}</td>
      <td title="${esc(club.name)}">${esc(club.name)}</td>
      <td>${r.p}</td>
      <td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
      <td><b>${r.pts}</b></td>
    </tr>`;
  }).join('');
  const legend = ['<span><i class="dot mine"></i>Seu clube</span>'];
  if (zone.continental) legend.push(`<span><i class="dot blue"></i>${esc(zone.continentalCup)} · ${zone.continental} vagas</span>`);
  if (zone.promotion) legend.push(`<span><i class="dot green"></i>Acesso · ${zone.promotion}</span>`);
  if (zone.relegation) legend.push(`<span><i class="dot red"></i>Rebaixamento · ${zone.relegation}</span>`);
  return `<div class="card">
    <h3>${career.season.flag} ${esc(career.season.leagueName)}</h3>
    <table class="table">
      <thead><tr><th></th><th>Clube</th><th>J</th><th>SG</th><th>P</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${legend.length ? `<div class="legend">${legend.join('')}</div>` : ''}
  </div>`;
}

function scorersCard() {
  const all = E.topScorers(career);
  const list = all.slice(0, 6);
  if (!list.length || list[0].goals === 0) {
    return '<div class="card"><h3>Artilharia</h3><p class="muted tiny">Sem gols marcados ainda nesta temporada.</p></div>';
  }
  const body = list.map((s, i) => `<li class="list-item">
      <span><span class="muted tiny">${i + 1}.</span> ${esc(s.name)}${s.isPlayer ? ' <span class="badge">você</span>' : ''}</span>
      <span class="r">${s.goals}</span>
    </li>`).join('');
  return `<div class="card"><h3>Artilharia</h3><ul>${body || '<li class="muted tiny">Sem gols ainda.</li>'}</ul></div>`;
}

function lastResults() {
  const items = career.season.history.slice(0, 5);
  if (!items.length) return '<p class="muted tiny">Nenhuma partida disputada nesta temporada.</p>';
  return items.map((h) => `<li class="list-item">
      <span>${h.comp ? `<span class="muted tiny">${esc(h.comp)}</span><br>` : ''}${esc(h.home)} <b>${h.hs}–${h.as}</b> ${esc(h.away)}</span>
      <span class="r">${h.minutes}min${h.goals ? ` · ${h.goals}⚽` : ''}${h.assists ? ` · ${h.assists}A` : ''} · ${h.rating.toFixed(1)}</span>
    </li>`).join('');
}

function trainingPicker() {
  return TRAININGS.map((t) => `<button class="training ${selectedTraining === t.id ? 'sel' : ''}" data-action="training" data-train="${t.id}">
      <b>${t.name}</b>
      <small>${t.desc}</small>
      <em class="fit-delta ${t.fit > 0 ? 'up' : ''}">${t.fit > 0 ? '+' : ''}${t.fit} físico</em>
    </button>`).join('');
}

function trainingImpactBlock(trainingId) {
  if (!career || !career.player) return '';
  const t = E.trainingImpact(career, trainingId);
  const riskLabel = (r) => (r < 0.035 ? 'baixo' : r < 0.07 ? 'médio' : 'alto');
  const color = (r) => (r < 0.035 ? 'var(--accent)' : r < 0.07 ? 'var(--gold)' : 'var(--red)');
  const pctTxt = (r) => `${(r * 100).toFixed(1).replace('.', ',')}%`;
  let note;
  if (t.suspended) note = `Suspenso: você não joga a próxima partida (${t.suspensions} jogo(s)).`;
  else if (t.injured) note = `Lesionado por ${t.injuryWeeks} semana(s): a Recuperação também diminui 1 semana de lesão.`;
  else if (t.recovery) note = 'Recuperação devolve 24 de físico e reduz 1 semana de lesão. Físico alto significa mais minutos e menos risco. O painel já inclui +4 de descanso semanal.';
  else note = 'Treinar forte gasta físico: com o físico baixo você joga menos minutos e a chance de lesão sobe. O painel já inclui +4 de descanso semanal.';
  return `<div class="impact-grid">
      <div><small>Físico</small><b>${t.fitness}% → ${t.after}%</b></div>
      <div><small>Minutos previstos</small><b>${t.minutes} min</b></div>
      <div><small>Risco de lesão</small><b style="color:${color(t.riskAfter)}">${pctTxt(t.riskAfter)} · ${riskLabel(t.riskAfter)}</b></div>
    </div>
    <p class="muted tiny" style="margin-top:8px">${note} Risco agora: ${pctTxt(t.riskNow)}.</p>`;
}

/* ------------------------------------------------------------------ */
/* Telas                                                               */
/* ------------------------------------------------------------------ */

function viewMenu() {
  const saved = hasSave();
  const divisionCount = COUNTRIES.reduce((n, c) => n + (c.divisions ? c.divisions.length : 1), 0);
  const clubCount = divisionCount * 16;
  return `<div class="center"><div class="menu">
    <div class="logo">⚽</div>
    <h1>Carreira <em>2026</em></h1>
    <p class="tag">Modo carreira de futebol 2D.<br>
      Crie seu jogador, escolha treinos e clube — nas partidas você só assiste.</p>
    <div class="btns">
      ${saved ? '<button class="btn primary" data-action="continue">Continuar carreira</button>' : ''}
      <button class="btn ${saved ? '' : 'primary'}" data-action="new">Nova carreira</button>
    </div>
    <p class="note">${COUNTRIES.length} países · ${divisionCount} divisões · ${clubCount} clubes<br>
      Acessos e quedas, Libertadores/Champions, copas de seleções, prêmios individuais e finanças.<br>
      Sem anúncios e sem custo. Progresso salvo neste navegador.</p>
  </div></div>`;
}

function viewCreate() {
  const options = COUNTRIES.map((c) => `<option value="${c.code}">${c.flag} ${c.name} — ${c.divisions[0]} + ${c.divisions.length - 1} divisões</option>`).join('');
  const posOptions = Object.entries(POSITIONS).map(([key, p]) => {
    const desc = { GOL: 'Defender o gol', ZAG: 'Marcação central', LAT: 'Apoiar pelos lados', VOL: 'Proteção e saída', MEI: 'Criar jogadas', ATA: 'Fazer gols' }[key];
    return `<button class="pos-opt ${createPos === key ? 'sel' : ''}" data-pos="${key}">
      <span>${p.name}</span><small>${desc}</small>
    </button>`;
  }).join('');

  return `<div class="center"><div class="card form">
    <h2 style="font-size:24px;margin-bottom:6px">Criar jogador</h2>
    <p class="muted tiny" style="margin-bottom:22px">Você começa aos 17 anos em um clube pequeno, nas divisões de baixo do país escolhido. Suba de divisão e chegue à elite.</p>

    <div class="field">
      <label for="p-name">Nome do jogador</label>
      <input class="input" id="p-name" maxlength="24" placeholder="Ex.: Luis Balbino" value="">
    </div>

    <div class="field">
      <label for="p-country">Nacionalidade</label>
      <select id="p-country">${options}</select>
    </div>

    <div class="field">
      <label>Posição</label>
      <div class="pos-grid">${posOptions}</div>
    </div>

    <div class="row" style="margin-top:22px">
      <button class="btn ghost" data-action="menu">Voltar</button>
      <button class="btn primary grow" data-action="start">Começar carreira</button>
    </div>
  </div></div>`;
}

function eventBlock(ev) {
  const mine = ev.entity;
  const homeMe = ev.homeId === mine;
  const awayMe = ev.awayId === mine;
  return `<div class="match-teams">
      <div class="t ${homeMe ? 'you' : ''}">${ev.homeFlag ? `<span class="flag">${ev.homeFlag}</span> ` : ''}${esc(ev.homeName)}<small>Casa</small></div>
      <div class="vs">VS</div>
      <div class="t right ${awayMe ? 'you' : ''}">${ev.awayFlag ? `<span class="flag">${ev.awayFlag}</span> ` : ''}${esc(ev.awayName)}<small>Fora</small></div>
    </div>`;
}

function viewHub() {
  const p = career.player;
  const club = career.clubs[p.clubId];
  const league = E.currentLeague(career);
  const ev = E.nextEvent(career);
  const role = E.squadRole(career);
  const totalRounds = career.season.rounds.length;
  const roundNo = Math.min(career.season.roundIndex + 1, totalRounds);

  let matchBlock;
  if (ev) {
    const isNational = ev.type === 'friendly' || (ev.comp && ev.comp.kind === 'nation');
    const myRole = isNational ? E.nationalInfo(career).status : role;
    matchBlock = `<div class="comp-line">${ev.compIcon ? `${ev.compIcon} ` : ''}${esc(ev.compName || '')} · ${esc(ev.stage || '')}</div>
      ${eventBlock(ev)}
                <div class="row between wrap" style="margin-bottom:6px">
        <span class="badge gray">Seu papel: ${myRole ? E.ROLE_LABEL[myRole] : '—'}</span>
        <span class="chip ${p.injuryWeeks > 0 || (p.suspensions || 0) > 0 ? 'on' : ''}">${p.injuryWeeks > 0 ? `Lesionado (${p.injuryWeeks} sem.)` : (p.suspensions || 0) > 0 ? `Suspenso (${p.suspensions} jogo[s])` : `Físico ${Math.round(p.fitness)}%`}</span>
      </div>`;
  } else {
    matchBlock = '<p class="muted">Temporada encerrada.</p>';
  }

  const playLabel = ev && (ev.type === 'friendly' || (ev.comp && ev.comp.kind === 'nation'))
    ? '▶ Assistir jogo da seleção'
    : '▶ Assistir próximo jogo';

  return `<div class="shell">
    <div class="topbar">
      <div class="brand">⚽ Carreira <span>${career.season.year}</span></div>
      <div class="meta">${league.flag} ${esc(league.name)} · ${career.season.year} · Rodada ${roundNo}/${totalRounds}</div>
      <div class="actions">
        <button class="btn small ghost" data-action="menu">Menu</button>
      </div>
    </div>
    <div class="layout">
      <div class="stack">
        ${playerCard()}
        ${nationalCard()}
        ${financeCard()}
      </div>
      <div class="stack col-main">
        <div class="card match-card">
          <div class="row between" style="margin-bottom:12px">
            <h3 style="margin:0">Próximo jogo</h3>
            <span class="chip">${esc(club.name)}</span>
          </div>
          ${matchBlock}
          <div class="divider"></div>
          <h3>Treino da semana</h3>
          <div class="trainings">${trainingPicker()}</div>
          <div class="impact" id="training-impact">${trainingImpactBlock(selectedTraining)}</div>
          <div class="row" style="margin-top:16px">
            <button class="btn primary grow" data-action="play" ${ev ? '' : 'disabled'}>${playLabel}</button>
          </div>
          <p class="muted tiny" style="margin-top:10px">Durante a partida você só assiste. As decisões são suas: treino, clube e carreira.</p>
        </div>
        ${midWindowCard()}
        <div class="card">
          <h3>Últimos jogos</h3>
          <ul>${lastResults()}</ul>
        </div>
        ${newsCard()}
      </div>
      <div class="stack">
        ${standingsCard()}
        ${competitionsCard()}
        ${scorersCard()}
      </div>
    </div>
  </div>`;
}

function viewMatch() {
  const d = pendingDetail;
  const crowd = d.crowd
    ? `<div class="crowd">Público: ${d.crowd.attendance.toLocaleString('pt-BR')} (${Math.round(d.crowd.rate * 100)}% do estádio)</div>`
    : '';
  return `<div class="match-screen">
    <div class="comp-line center-line">${d.compIcon ? `${d.compIcon} ` : ''}${esc(d.compName || '')} · ${esc(d.stage || '')}</div>
    <div class="scoreboard">
      <div class="side"><span class="dot" style="background:#3f8cff"></span><span>${d.homeFlag ? `${d.homeFlag} ` : ''}${esc(d.homeName)}</span></div>
      <div class="score" id="m-score">0 – 0</div>
      <div class="side right"><span>${d.awayFlag ? `${d.awayFlag} ` : ''}${esc(d.awayName)}</span><span class="dot" style="background:#ff5c68"></span></div>
      <div class="clock" id="m-clock">0'</div>
    </div>
    ${crowd}
    <div class="match-body">
      <div>
        <canvas id="pitch" width="1000" height="620"></canvas>
        <div class="match-bar">
          <button class="btn small" data-action="pause" id="m-pause">Pausar</button>
          <button class="btn small on" data-action="speed" data-speed="1">1x</button>
          <button class="btn small" data-action="speed" data-speed="2">2x</button>
          <button class="btn small" data-action="speed" data-speed="4">4x</button>
          <button class="btn small" data-action="skip">Pular para o fim</button>
          <button class="btn primary small" data-action="match-continue" id="match-continue" hidden style="margin-left:auto">Continuar ▶</button>
        </div>
      </div>
      <ul class="match-feed" id="match-feed">
        <li class="feed-item"><span class="min">0'</span><span>Transmissão iniciada. Você está em campo como ${esc(d.playerName)}.</span></li>
      </ul>
    </div>
    <p class="muted tiny" style="margin-top:12px;text-align:center">Você não interfere na partida — só assiste, decide os treinos e cobra os pênaltis.</p>
    <div class="penalty-overlay" id="penalty-overlay" hidden>
      <div class="penalty-box">
        <h3 style="color:var(--gold)">🎯 Pênalti para o seu time</h3>
        <p class="muted tiny" style="margin:8px 0 0">Escolha onde colocar a bola: quatro cantos ou o meio. O goleiro escolhe um dos cinco lugares e, se acertar o seu, defende.</p>
        <div class="penalty-goal" id="penalty-zones">
          ${[0, 1, 2, 3, 4].map((z) => `<button class="zone-btn" data-zone="${z}"><span>${['↖', '↗', '●', '↙', '↘'][z]}</span><small>${esc(E.PENALTY_ZONES[z].replace('Canto ', '').replace(' da baliza', ''))}</small></button>`).join('')}
        </div>
        <p id="penalty-result" class="muted tiny" style="min-height:20px"></p>
        <button class="btn primary small" data-action="penalty-next" id="penalty-next" hidden>Continuar ▶</button>
      </div>
    </div>
  </div>`;
}

function viewResult() {
  const d = pendingDetail;
  const goals = d.events.filter((e) => e.type === 'goal');
  const list = d.events
    .filter((e) => e.type !== 'chance' || e.text.includes(d.playerName))
    .map((e) => `<li class="feed-item ${e.type === 'goal' ? 'goal' : ''} ${e.text.includes(d.playerName) ? 'you' : ''}">
      <span class="min">${e.minute}'</span><span>${esc(e.text)}</span></li>`).join('');
  const outcome = d.playerHome
    ? (d.hs > d.as ? 'Vitória' : d.hs === d.as ? 'Empate' : 'Derrota')
    : (d.as > d.hs ? 'Vitória' : d.as === d.hs ? 'Empate' : 'Derrota');
  const pens = d.pens
    ? `<p class="muted tiny" style="margin-top:8px">Disputa de pênaltis: ${d.pens[0]}–${d.pens[1]} para ${esc(d.pens[0] > d.pens[1] ? d.homeName : d.awayName)}.</p>`
    : '';

  return `<div class="shell" style="max-width:820px">
    <div class="card">
      <h3>${esc(d.compName || 'Fim de jogo')} · ${esc(d.stage || '')}</h3>
      <div class="result-score">
        <div class="t">${d.homeFlag ? `${d.homeFlag} ` : ''}${esc(d.homeName)}</div>
        <div class="s">${d.hs} – ${d.as}</div>
        <div class="t r">${d.awayFlag ? `${d.awayFlag} ` : ''}${esc(d.awayName)}</div>
      </div>
      ${pens}
      <div class="row between wrap" style="margin-bottom:14px">
        <span class="badge ${outcome === 'Vitória' ? '' : outcome === 'Empate' ? 'gold' : 'red'}">${outcome}</span>
        <span class="muted tiny">${goals.length} gol(s) na partida${d.crowd ? ` · público ${d.crowd.attendance.toLocaleString('pt-BR')}` : ''}</span>
      </div>
      <div class="stats-grid">
        <div class="stat"><b>${d.minutes}</b><small>Minutos</small></div>
        <div class="stat"><b>${d.goals}</b><small>Gols</small></div>
        <div class="stat"><b>${d.assists}</b><small>Assist.</small></div>
        <div class="stat"><b>${d.rating.toFixed(1)}</b><small>Nota</small></div>
      </div>
      ${d.minutes === 0 ? `<p class="muted tiny" style="margin-top:12px">${d.suspended ? 'Você cumpriu suspensão e ficou de fora desta partida.' : 'Você não entrou em campo nesta partida.'}</p>` : ''}
      ${d.injured ? `<p style="margin-top:12px;color:var(--red);font-size:13px">Você sofreu uma lesão e ficará fora por ${d.injuryWeeks} semana(s).</p>` : ''}
      ${d.red ? '<p style="margin-top:12px;color:var(--red);font-size:13px">🟥 Você foi expulso e vai cumprir suspensão.</p>' : ''}
      <div class="divider"></div>
      <h3>O que aconteceu</h3>
      <ul style="max-height:260px;overflow:auto">${list}</ul>
      <div class="row" style="margin-top:18px">
        <button class="btn primary grow" data-action="result-continue">Continuar ▶</button>
      </div>
    </div>
  </div>`;
}

function viewSeason() {
  const s = pendingSummary;
  const offers = career.offers.map((o) => offerRow(o, 'end')).join('');

  const top = s.tableTop.map((r, i) => `<li class="list-item"><span><span class="muted tiny">${i + 1}.</span> ${esc(r.name)} ${r.me ? '<span class="badge">você</span>' : ''}</span><span class="r">${r.pts} pts</span></li>`).join('');
  const scorers = s.topScorers.map((sc, i) => `<li class="list-item"><span><span class="muted tiny">${i + 1}.</span> ${esc(sc.name)} ${sc.isPlayer ? '<span class="badge">você</span>' : ''}</span><span class="r">${sc.goals} gols</span></li>`).join('');
  const comps = (s.comps || []).map((c) => `<li class="list-item">
      <span>${c.icon} ${esc(c.name)}</span>
      <span class="r">${esc(c.status)}${c.championName && c.status !== 'Campeão' ? `<br><span class="muted tiny">${esc(c.championName)}</span>` : ''}</span>
    </li>`).join('');
  const f = s.finance;

  return `<div class="shell" style="max-width:880px">
    <div class="card" style="margin-bottom:16px">
      <h3>Fim da temporada ${s.year}</h3>
      <h2 style="font-size:24px;margin-bottom:6px">${s.flag} ${esc(s.leagueName)}</h2>
      <p class="muted" style="font-size:14px;line-height:1.6">
        Campeão: <b style="color:var(--gold)">${esc(s.championName)}</b><br>
        ${esc(s.myClubName)} terminou em <b>${s.myPosition}º</b> lugar.
      </p>
      ${s.honours.length ? `<div style="margin-top:12px">${s.honours.map((h) => `<div class="badge gold" style="margin:3px 6px 3px 0">${esc(h)}</div>`).join('')}</div>` : ''}
      ${s.finance.promoted ? `<p class="warn" style="color:var(--gold)">🎉 Acesso! ${esc(s.myClubName)} sobe para a ${esc(s.finance.division)}.</p>` : ''}
      ${s.finance.relegated ? `<p class="warn">⚠ ${esc(s.myClubName)} cai para a ${esc(s.finance.division)}.</p>` : ''}
      ${s.awards && s.awards.length ? `<div class="divider"></div><h3>Prêmios individuais</h3><div>${s.awards.map((a) => `<span class="badge gold" style="margin:3px 6px 3px 0">${a.icon} ${esc(a.name)} · ${E.formatMoney(a.bonus)}</span>`).join('')}</div>` : ''}
      <div class="divider"></div>
      <div class="stats-grid">
        <div class="stat"><b>${s.stats.apps}</b><small>Jogos</small></div>
        <div class="stat"><b>${s.stats.goals}</b><small>Gols</small></div>
        <div class="stat"><b>${s.stats.assists}</b><small>Assist.</small></div>
        <div class="stat"><b>${s.stats.avgRating.toFixed(1)}</b><small>Nota média</small></div>
        <div class="stat"><b>${s.stats.minutes}</b><small>Minutos</small></div>
      </div>
    </div>

    <div class="layout" style="grid-template-columns:1fr 1fr;gap:16px">
      <div class="card"><h3>Classificação (top 6)</h3><ul>${top}</ul></div>
      <div class="card"><h3>Artilharia da liga</h3><ul>${scorers}</ul></div>
    </div>

    <div class="layout" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="card"><h3>Campanhas nas copas</h3><ul>${comps || '<li class="muted tiny">Sem competições.</li>'}</ul></div>
      <div class="card">
        <h3>${esc(f.clubName)} · balanço</h3>
        <div class="kv"><span>Divisão na próxima temporada</span><b>${esc(f.division || '—')}</b></div>
        ${f.sponsor.brand === 'Sem patrocinador'
          ? '<p class="warn">O clube terminou sem patrocinador.</p>'
          : `<div class="kv"><span>Patrocínio</span><b>${esc(f.sponsor.brand)} · ${E.formatMoney(f.sponsor.value)}/ano</b></div>`}
        <div class="kv"><span>Receitas</span><b>${E.formatMoney(f.revenue)}</b></div>
        <div class="kv"><span>Despesas</span><b>${E.formatMoney(f.cost)}</b></div>
        <div class="kv"><span>Caixa</span><b style="${f.cash < 0 ? 'color:var(--red)' : ''}">${E.formatMoney(f.cash)}</b></div>
        <div class="kv"><span>Força do clube</span><b>${f.strength}</b></div>
        ${f.delayed > 0 ? `<p class="warn">Salários atrasados há ${f.delayed} ${f.delayed > 1 ? 'meses' : 'mês'}.</p>` : ''}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Mercado de transferências · escolha seu destino</h3>
      <p class="muted tiny" style="margin-bottom:14px">Você está com ${career.player.age} anos, geral ${E.overall(career.player)} e reputação de ${E.managerReputationLabel(career.player.reputation).toLowerCase()}.</p>
      ${marketNotice ? `<p class="warn">${esc(marketNotice)}</p>` : ''}
      ${offers}
      <div class="row" style="margin-top:16px">
        <button class="btn danger small" data-action="retire">Encerrar carreira</button>
      </div>
    </div>
  </div>`;
}

function viewGameOver() {
  const p = career.player;
  const totalRating = p.stats.apps ? (p.stats.ratingSum / p.stats.apps).toFixed(2).replace('.', ',') : '—';
  const history = p.history.map((h) => `<li class="list-item">
      <span>${h.year} · ${esc(h.club)}</span>
      <span class="r">${h.position}º · ${h.apps}J ${h.goals}⚽ ${h.assists}A · ${h.rating.toFixed(1)}</span>
    </li>`).join('');
  const honours = p.honours.length ? p.honours.map((h) => `<div class="badge gold" style="margin:3px 6px 3px 0">${esc(h)}</div>`).join('') : '<p class="muted tiny">Nenhum título conquistado.</p>';
  const awards = (p.awards || []).length
    ? (p.awards || []).map((a) => `<div class="badge gold" style="margin:3px 6px 3px 0">${a.icon || '🏅'} ${esc(a.name)} ${a.year}</div>`).join('')
    : '<p class="muted tiny">Nenhum prêmio individual.</p>';

  return `<div class="shell" style="max-width:820px">
    <div class="card">
      <h3>Fim de carreira</h3>
      <h2 style="font-size:26px;margin-bottom:4px">${esc(p.name)}</h2>
      <p class="muted" style="margin-bottom:16px">${p.age} anos · ${p.positionName} · ${p.countryName}</p>
      <div class="stats-grid">
        <div class="stat"><b>${p.stats.seasons}</b><small>Temporadas</small></div>
        <div class="stat"><b>${p.stats.apps}</b><small>Jogos</small></div>
        <div class="stat"><b>${p.stats.goals}</b><small>Gols</small></div>
        <div class="stat"><b>${p.stats.assists}</b><small>Assist.</small></div>
        <div class="stat"><b>${totalRating}</b><small>Nota média</small></div>
      </div>
      <div class="kv" style="margin-top:12px"><span>Pela seleção</span><b>${p.national.caps} jogos · ${p.national.goals} gols</b></div>
      <div class="kv"><span>Patrimônio</span><b>${E.formatMoney(p.bank || 0)}</b></div>
      <div class="divider"></div>
      <h3>Conquistas</h3>
      ${honours}
      <div class="divider"></div>
      <h3>Prêmios individuais</h3>
      ${awards}
      <div class="divider"></div>
      <h3>Trajetória</h3>
      <ul style="max-height:300px;overflow:auto">${history || '<li class="muted tiny">Sem temporadas registradas.</li>'}</ul>
      <div class="row" style="margin-top:18px">
        <button class="btn primary grow" data-action="new">Nova carreira</button>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Transmissão                                                         */
/* ------------------------------------------------------------------ */

function addFeed(ev) {
  const feed = document.getElementById('match-feed');
  if (!feed) return;
  const li = document.createElement('li');
  li.className = 'feed-item' + (ev.type === 'goal' ? ' goal' : '') + (ev.text.includes(pendingDetail.playerName) ? ' you' : '');
  li.innerHTML = `<span class="min">${ev.minute}'</span><span>${esc(ev.text)}</span>`;
  feed.appendChild(li);
  feed.scrollTop = feed.scrollHeight;
}

function flashGoal() {
  const div = document.createElement('div');
  div.className = 'goal-flash';
  div.innerHTML = '<b>GOL!</b>';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 900);
}

let liveBase = { home: 0, away: 0 };
let liveBonus = { home: 0, away: 0 };
let viewerDone = false;

function renderLiveScore() {
  const el = document.getElementById('m-score');
  if (!el) return;
  el.textContent = `${liveBase.home + liveBonus.home} – ${liveBase.away + liveBonus.away}`;
}

function showPenaltyOverlay() {
  const pen = pendingDetail && E.pendingPenalty(pendingDetail);
  if (!pen) return;
  const overlay = document.getElementById('penalty-overlay');
  if (!overlay) return;
  if (viewer && viewer.isRunning()) viewer.togglePause();
  const box = document.getElementById('penalty-zones');
  if (box) {
    box.classList.remove('done');
    box.querySelectorAll('button').forEach((b) => b.classList.remove('picked', 'keeper'));
  }
  const out = document.getElementById('penalty-result');
  if (out) out.textContent = `Minuto ${pen.minute}. Escolha onde colocar a bola.`;
  const next = document.getElementById('penalty-next');
  if (next) next.hidden = true;
  const cont = document.getElementById('match-continue');
  if (cont) cont.hidden = true;
  overlay.hidden = false;
}

function takePenalty(zone) {
  if (!career || !pendingDetail) return;
  const res = E.resolvePenalty(career, pendingDetail, zone);
  if (!res) return;
  const box = document.getElementById('penalty-zones');
  if (box) {
    box.classList.add('done');
    box.querySelectorAll('[data-zone]').forEach((b) => {
      const z = Number(b.dataset.zone);
      if (z === res.zone) b.classList.add('picked');
      if (z === res.keeperZone) b.classList.add('keeper');
    });
  }
  const out = document.getElementById('penalty-result');
  if (out) {
    out.innerHTML = res.saved
      ? `🧤 O goleiro foi no ${esc(res.keeperLabel.toLowerCase())} e defendeu! Sua nota: ${pendingDetail.rating.toFixed(1)}.`
      : `⚽ GOL! Você foi no ${esc(res.label.toLowerCase())}; o goleiro escolheu ${esc(res.keeperLabel.toLowerCase())}. Placar: ${pendingDetail.hs}–${pendingDetail.as}.`;
  }
  const side = pendingDetail.playerHome ? 'home' : 'away';
  if (!res.saved) liveBonus[side] += 1;
  renderLiveScore();
  addFeed({
    minute: res.minute,
    type: res.saved ? 'chance' : 'goal',
    text: res.saved
      ? `🧤 ${career.player.name} cobrou no ${res.label.toLowerCase()}, mas o goleiro defendeu!`
      : `⚽ GOL! ${career.player.name} cobrou no ${res.label.toLowerCase()} e o goleiro não chegou.`,
  });
  if (!res.saved) flashGoal();
  const next = document.getElementById('penalty-next');
  if (next) next.hidden = false;
  save();
}

function startViewer() {
  const d = pendingDetail;
  liveBase = { home: 0, away: 0 };
  liveBonus = { home: 0, away: 0 };
  viewerDone = false;
  viewer = createViewer(document.getElementById('pitch'), {
    formationHome: d.formationHome,
    formationAway: d.formationAway,
    playerHome: d.playerHome,
    playerPosition: d.playerPosition,
    events: d.events,
  }, {
    onClock: (m) => {
      const el = document.getElementById('m-clock');
      if (el) el.textContent = m >= 90 ? '90\' · fim' : `${m}'`;
      const pen = E.pendingPenalty(pendingDetail);
      if (pen && m >= pen.minute && !pen.prompted) {
        pen.prompted = true;
        showPenaltyOverlay();
      }
    },
    onScore: (home, away) => {
      liveBase = { home, away };
      renderLiveScore();
    },
    onEvent: (ev) => addFeed(ev),
    onGoal: () => flashGoal(),
    onFinish: () => {
      viewerDone = true;
      if (E.pendingPenalty(pendingDetail)) { showPenaltyOverlay(); return; }
      const btn = document.getElementById('match-continue');
      if (btn) btn.hidden = false;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Fluxo                                                               */
/* ------------------------------------------------------------------ */

function render() {
  if (viewer) { viewer.destroy(); viewer = null; }
  if (screen === 'menu') app.innerHTML = viewMenu();
  else if (screen === 'create') app.innerHTML = viewCreate();
  else if (screen === 'hub') app.innerHTML = viewHub();
  else if (screen === 'match') { app.innerHTML = viewMatch(); startViewer(); }
  else if (screen === 'result') app.innerHTML = viewResult();
  else if (screen === 'season') app.innerHTML = viewSeason();
  else if (screen === 'gameover') app.innerHTML = viewGameOver();
  window.scrollTo(0, 0);
}

function startNewCareer() {
  marketNotice = null;
  const nameEl = document.getElementById('p-name');
  const countryEl = document.getElementById('p-country');
  const name = nameEl ? nameEl.value : '';
  const countryCode = countryEl ? countryEl.value : 'BRA';
  career = E.createCareer({ name, countryCode, position: createPos });
  selectedTraining = 'fisico';
  pendingDetail = null;
  pendingSummary = null;
  save();
  screen = 'hub';
  render();
}

function playRound() {
  if (!career) return;
  if (E.seasonOver(career)) return;
  const detail = E.advanceRound(career, selectedTraining);
  save();
  if (!detail) {
    // jogo sem participação do jogador (ex.: bye) — segue para o próximo
    enterCareer();
    render();
    return;
  }
  pendingDetail = detail;
  screen = 'match';
  render();
}

function enterCareer() {
  if (E.seasonOver(career)) {
    if (!career.seasonSummary) {
      career.seasonSummary = E.finishSeason(career);
      save();
    }
    pendingSummary = career.seasonSummary;
    screen = 'season';
  } else {
    screen = 'hub';
  }
}

function takeOffer(clubId) {
  E.startNewSeason(career, clubId);
  pendingSummary = null;
  pendingDetail = null;
  save();
  screen = 'hub';
  render();
}

app.addEventListener('click', (e) => {
  const posBtn = e.target.closest('[data-pos]');
  if (posBtn) {
    createPos = posBtn.dataset.pos;
    document.querySelectorAll('.pos-opt').forEach((el) => el.classList.toggle('sel', el.dataset.pos === createPos));
    return;
  }

  const zoneBtn = e.target.closest('[data-zone]');
  if (zoneBtn) { takePenalty(Number(zoneBtn.dataset.zone)); return; }

  const offerBtn = e.target.closest('[data-offer]');
  if (offerBtn) {
    marketNotice = null;
    const clubId = Number(offerBtn.dataset.offer);
    if (offerBtn.dataset.where === 'mid') {
      E.signPreContract(career, clubId);
      save();
      render();
    } else {
      takeOffer(clubId);
    }
    return;
  }

  const negBtn = e.target.closest('[data-negotiate]');
  if (negBtn) {
    const res = E.negotiateOffer(career, Number(negBtn.dataset.negotiate), negBtn.dataset.where || 'end');
    marketNotice = res.ok
      ? `Proposta melhorada: agora ${E.formatMoney(res.wage)}/mês por ${res.offer.years} temporadas.`
      : res.reason === 'refused'
        ? 'O clube recusou o pedido de melhoria e manteve a proposta.'
        : res.reason === 'already'
          ? 'Você já pediu melhoria nessa proposta.'
          : 'Proposta indisponível.';
    save();
    render();
    return;
  }

  const refBtn = e.target.closest('[data-refuse]');
  if (refBtn) {
    marketNotice = null;
    E.refuseOffer(career, Number(refBtn.dataset.refuse), refBtn.dataset.where || 'end');
    save();
    render();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'new': {
      if (career || hasSave()) {
        if (!window.confirm('Começar uma nova carreira apaga o progresso salvo. Continuar?')) return;
      }
      screen = 'create';
      render();
      break;
    }
    case 'continue': {
      const data = loadSave();
      if (!data) { screen = 'create'; render(); return; }
      career = data;
      enterCareer();
      render();
      break;
    }
    case 'menu':
      if (pendingDetail) { E.finalizeMatch(career, pendingDetail); pendingDetail = null; save(); }
      screen = 'menu';
      render();
      break;
    case 'start':
      startNewCareer();
      break;
    case 'training': {
      selectedTraining = btn.dataset.train;
      document.querySelectorAll('.training').forEach((el) => el.classList.toggle('sel', el.dataset.train === selectedTraining));
      const box = document.getElementById('training-impact');
      if (box) box.innerHTML = trainingImpactBlock(selectedTraining);
      break;
    }
    case 'play':
      if (career && E.seasonOver(career)) { enterCareer(); render(); return; }
      playRound();
      break;
    case 'pause': {
      if (!viewer) return;
      const running = viewer.togglePause();
      btn.textContent = running ? 'Pausar' : 'Continuar';
      break;
    }
    case 'speed': {
      if (!viewer) return;
      viewer.setSpeed(Number(btn.dataset.speed));
      document.querySelectorAll('[data-action="speed"]').forEach((el) => el.classList.toggle('on', el === btn));
      break;
    }
    case 'skip':
      if (viewer) viewer.skip();
      break;
    case 'match-continue':
      if (pendingDetail) E.finalizeMatch(career, pendingDetail);
      save();
      screen = 'result';
      render();
      break;
    case 'penalty-next': {
      const overlay = document.getElementById('penalty-overlay');
      if (overlay) overlay.hidden = true;
      if (E.pendingPenalty(pendingDetail)) { showPenaltyOverlay(); break; }
      if (viewerDone) {
        const cont = document.getElementById('match-continue');
        if (cont) cont.hidden = false;
      } else if (viewer && !viewer.isRunning()) {
        viewer.togglePause();
      }
      break;
    }
    case 'mid-close':
      E.closeMidWindow(career);
      save();
      render();
      break;
    case 'result-continue':
      enterCareer();
      render();
      break;
    case 'retire':
      career.finished = true;
      save();
      screen = 'gameover';
      render();
      break;
    default:
      break;
  }
});

app.addEventListener('change', (e) => {
  const num = e.target.closest('[data-number]');
  if (!num || !career) return;
  const value = Math.max(1, Math.min(99, Number(num.value) || 10));
  career.player.number = value;
  save();
  render();
});

render();
