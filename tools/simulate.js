#!/usr/bin/env node
// Headless AI-vs-AI playtesting.
//   node tools/simulate.js [games=400] [--log N] [--rules '{"narrative":false}']
// Prints matchup win rates, first-player advantage, game length, takeover
// statistics and card outliers. --log N prints the full play log of game N.
'use strict';
const path = require('path');
const Core = require(path.join(__dirname, '..', 'core.js'));
const AI = require(path.join(__dirname, '..', 'ai.js'));
const CARDS = require(path.join(__dirname, '..', 'cards.js'));
Core.setCardData(CARDS);

const args = process.argv.slice(2);
const games = +(args.find(a => /^\d+$/.test(a)) || 400);
const logIdx = args.includes('--log') ? +args[args.indexOf('--log') + 1] : -1;
const rules = args.includes('--rules') ? JSON.parse(args[args.indexOf('--rules') + 1]) : {};
const seed0 = args.includes('--seed') ? +args[args.indexOf('--seed') + 1] : 1000;
const SPHERES = ['state', 'capital', 'occult', 'fringe'];

function playGame(i) {
  const sa = SPHERES[i % 4], sb = SPHERES[Math.floor(i / 4) % 4];
  const seed = seed0 + i * 7919;
  const state = Core.createGame({
    seed, first: i % 2 === 0 ? 0 : 1, rules,
    spheres: [sa, sb],
    names: [Core.SPHERES[sa].faction + ' A', Core.SPHERES[sb].faction + ' B'],
    decks: [Core.buildDeck(sa, seed + 1), Core.buildDeck(sb, seed + 2)]
  });
  const trace = { leadChanges: 0, lastLead: 0, actions: 0, choices: 0, decisions: 0 };
  let guard = 0;
  while (state.phase === 'main' && guard++ < 3000) {
    const legal = Core.legalActions(state);
    trace.choices += legal.length; trace.decisions++;
    const action = AI.chooseAction(state);
    Core.apply(state, action);
    trace.actions++;
    if (action.type === 'end' && state.turn === 8) trace.behindAt8 = Math.sign(AI.evaluate(state, 0));
    if (action.type === 'end') {
      const lead = Math.sign(AI.evaluate(state, 0));
      if (lead && trace.lastLead && lead !== trace.lastLead) trace.leadChanges++;
      if (lead) trace.lastLead = lead;
    }
    if (state.turn > 80) break;
  }
  return { state, sa, sb, trace };
}

const results = [];
for (let i = 0; i < games; i++) {
  const r = playGame(i);
  results.push(r);
  if (i === logIdx) console.log(r.state.log.join('\n') + '\n');
}

const pct = x => (100 * x).toFixed(1) + '%';
const mean = xs => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const done = results.filter(r => r.state.winner != null);
console.log(`Games: ${games}, finished: ${done.length}`);
console.log(`First player wins: ${pct(mean(done.map(r => r.state.winner === r.state.first ? 1 : 0)))}`);
console.log(`Avg turns (both players): ${mean(done.map(r => r.state.turn)).toFixed(1)}  ` +
  `[p10 ${percentile(done.map(r => r.state.turn), .1)}, p90 ${percentile(done.map(r => r.state.turn), .9)}]`);
const reasons = {};
done.forEach(r => { reasons[r.state.winReason] = (reasons[r.state.winReason] || 0) + 1; });
console.log('Win reasons:', reasons);
console.log(`Lead changes per game: ${mean(results.map(r => r.trace.leadChanges)).toFixed(2)}  ` +
  `avg legal options per decision: ${mean(results.map(r => r.trace.choices / r.trace.decisions)).toFixed(1)}`);
const tk = results.flatMap(r => r.state.players.map(p => p.stats));
console.log(`Takeovers per game: ${(tk.reduce((s, x) => s + x.takeovers, 0) / games).toFixed(2)}, success ${pct(tk.reduce((s, x) => s + x.takeoverWins, 0) / Math.max(1, tk.reduce((s, x) => s + x.takeovers, 0)))}, rerolls/game ${(tk.reduce((s, x) => s + x.rerolls, 0) / games).toFixed(2)}`);
console.log(`Face strikes per game: ${(tk.reduce((s, x) => s + x.strikesFace, 0) / games).toFixed(1)}`);
console.log(`Narrative changes hands per game: ${mean(results.map(r => r.state.log.filter(l => l.includes('seizes The Narrative')).length)).toFixed(2)}`);
const judged = done.filter(r => r.trace.behindAt8);
console.log(`Comebacks (player behind on evaluation after turn 8 wins): ${pct(mean(judged.map(r => (r.trace.behindAt8 > 0 ? 1 : 0) !== (r.state.winner === 0 ? 1 : 0) ? 1 : 0)))}`);
console.log(`Narrative holder at end wins: ${pct(mean(done.filter(r => r.state.narrative != null).map(r => r.state.narrative === r.state.winner ? 1 : 0)))}`);

// Sphere matrix
console.log('\nSphere win rate (row vs column):');
console.log('         ' + SPHERES.map(s => s.padStart(9)).join(''));
for (const a of SPHERES) {
  let line = a.padEnd(9);
  for (const b of SPHERES) {
    let w = 0, n = 0;
    for (const r of done) {
      if (r.sa === a && r.sb === b) { n++; if (r.state.winner === 0) w++; }
      if (r.sb === a && r.sa === b) { n++; if (r.state.winner === 1) w++; }
    }
    line += (n ? pct(w / n) : '-').padStart(9);
  }
  console.log(line);
}
const overall = {};
for (const s of SPHERES) {
  let w = 0, n = 0;
  for (const r of done) {
    if (r.sa === s && r.sb !== s) { n++; if (r.state.winner === 0) w++; }
    if (r.sb === s && r.sa !== s) { n++; if (r.state.winner === 1) w++; }
  }
  overall[s] = pct(w / n);
}
console.log('Overall (non-mirror):', overall);

// Card outliers: win rate of the player who played the card.
const cardStats = {};
for (const r of done) {
  r.state.players.forEach((p, i) => {
    for (const id of new Set(p.stats.played)) {
      cardStats[id] = cardStats[id] || { w: 0, n: 0 };
      cardStats[id].n++; if (r.state.winner === i) cardStats[id].w++;
    }
  });
}
const rows = Object.entries(cardStats).filter(([, s]) => s.n >= 15).map(([id, s]) => ({ id: +id, wr: s.w / s.n, n: s.n }));
rows.sort((a, b) => b.wr - a.wr);
const show = r => `${(100 * r.wr).toFixed(0)}% n=${r.n} #${r.id} ${CARDS[r.id].name} [${CARDS[r.id].sphere} ${CARDS[r.id].type} ${CARDS[r.id].cost} ${CARDS[r.id].power}/${CARDS[r.id].toughness} ${(CARDS[r.id].keywords || []).join(',')}] ${Core.describe(CARDS[r.id])}`;
if (args.includes('--cards')) {
  console.log('\nStrongest cards when played:'); rows.slice(0, 12).forEach(r => console.log('  ' + show(r)));
  console.log('Weakest cards when played:'); rows.slice(-12).forEach(r => console.log('  ' + show(r)));
}

function percentile(xs, q) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; }
