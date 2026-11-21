// Utilidades puras compartilhadas pelo motor, pelas competições e pela interface.

import { ATTRS, WEIGHTS } from './data.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 12);
  return k - 1;
}

export function expectedGoals(att, def) {
  return clamp(1.3 * Math.pow(att / def, 2.4), 0.22, 4.6);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

export function marketValue(player) {
  const ov = overall(player);
  const age = player.age;
  const ageFactor = age <= 20 ? 0.95 : age <= 24 ? 1.15 : age <= 28 ? 1.0 : age <= 31 ? 0.6 : age <= 34 ? 0.28 : 0.1;
  const base = 1200000 * Math.exp((ov - 55) / 8) * ageFactor;
  const repFactor = 0.85 + player.reputation / 200;
  const value = base * repFactor;
  return clamp(Math.round(value / 50000) * 50000, 50000, 250000000);
}

export function formatMoney(v) {
  const n = Math.round(v);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${sign}€ ${(abs / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace('.', ',')} M`;
  if (abs >= 1000) return `${sign}€ ${Math.round(abs / 1000)} mil`;
  return `${sign}€ ${abs}`;
}

export function managerReputationLabel(rep) {
  if (rep >= 85) return 'Ídolo mundial';
  if (rep >= 65) return 'Estrela internacional';
  if (rep >= 45) return 'Jogador conhecido';
  if (rep >= 25) return 'Promessa';
  return 'Desconhecido';
}
