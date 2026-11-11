// The Hidden Archive — computer opponent.
// Greedy one-ply search: try every legal action on a cloned state, score the
// result with a board evaluation (dice outcomes weighted by probability), and
// take the best action until ending the turn scores higher.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.ArchiveAI = factory(root.ArchiveCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  const KW_VALUE = { Haste: .3, Firewall: .6, Covert: 1, Pierce: .5, Expose: .5, Fortify: 1, Network: 1.6, Loyal: .3, Subvert: .5 };

  function cardQuality(state, uid) {
    const d = Core.def(state, uid);
    if (d.type === 'group') {
      const kw = (d.keywords || []).reduce((s, k) => s + (KW_VALUE[k] || 0), 0);
      return (d.power + d.toughness + kw + (d.fx || []).length * 1.5) / (2 * d.cost + 1);
    }
    return 1.1;
  }

  function groupValue(state, uid) {
    const c = state.cards[uid];
    const d = Core.def(state, uid);
    if (d.type === 'asset') return 2 + d.cost * .6;
    let v = .6 + Core.power(state, uid) * 1.0 + Math.max(0, Core.remaining(state, uid)) * .75;
    for (const k of d.keywords || []) v += KW_VALUE[k] || 0;
    for (const f of d.fx || []) if (f.on === 'start' || f.on === 'static') v += 1.2;
    if (c.exposed) v -= .5 + (Core.has(state, uid, 'Covert') ? .8 : 0);
    if (c.detained) v -= .8;
    return v;
  }

  const secValue = s => s <= 0 ? -60 : 9 * Math.log(1 + s);

  function evaluate(state, me) {
    if (state.winner != null) return state.winner === me ? 1e5 : -1e5;
    const opp = 1 - me;
    const A = state.players[me], B = state.players[opp];
    let v = secValue(A.secrecy) - secValue(B.secrecy);
    for (const uid of A.field) v += groupValue(state, uid);
    for (const uid of B.field) v -= groupValue(state, uid);
    v += 1.1 * (A.hand.length - B.hand.length);
    const fv = n => Math.min(n, 7) * .9 + Math.max(0, n - 7) * .2;
    v += fv(A.fronts.length) - fv(B.fronts.length);
    v += 2.2 * (A.traps.length - B.traps.length);
    if (state.narrative === me) v += 2.5; else if (state.narrative === opp) v -= 2.5;
    // Pressure: damage my untapped board threatens next turn vs their secrecy.
    const threat = (p, q) => {
      const walls = Core.groupsOf(state, q).filter(u => Core.has(state, u, 'Firewall')).length;
      if (walls) return 0;
      return Core.groupsOf(state, p).reduce((s, u) => s + Core.power(state, u), 0);
    };
    const myThreat = threat(me, opp), theirThreat = threat(opp, me);
    if (myThreat >= B.secrecy) v += 6;
    if (theirThreat >= A.secrecy) v -= 12;
    // Unspent influence still has value while it's my turn.
    if (state.active === me) {
      const maxCost = Math.max(0, ...A.hand.map(u => Core.def(state, u).cost));
      v += .45 * Math.min(A.influence, maxCost);
    }
    return v;
  }

  function simulate(state, action, rolls) {
    const s = Core.clone(state);
    Core.apply(s, action, { rolls: rolls ? [...rolls] : [] });
    if (s.pending) Core.apply(s, { type: 'accept' });
    return s;
  }

  // Expected value of an action; returns { value, action }.
  function score(state, action, me) {
    if (action.type === 'takeover') {
      const P = state.players[me];
      const vs = evaluate(simulate(state, action, [1, 1]), me);
      const vf = evaluate(simulate(state, action, [6, 6]), me);
      let best = null;
      const maxCost = Math.max(0, ...P.hand.map(u => Core.def(state, u).cost));
      const infVal = inf => .45 * Math.min(inf, maxCost);
      let lastNeed = -1;
      const cost = Core.bribe(state, action.target);
      for (let s = 0; s <= P.influence - cost; s++) {
        const { need } = Core.takeoverTarget(state, action.uid, action.target, s);
        if (need === lastNeed) continue;
        lastNeed = need;
        let p = Core.chance(need);
        // A failed roll can be rerolled once by discarding a card.
        if (state.rules.reroll && P.hand.length >= 2) p = p + (1 - p) * p * .9;
        const loss = infVal(P.influence) - infVal(P.influence - s - cost);
        const v = p * vs + (1 - p) * vf - loss - (1 - p) * .6;
        if (!best || v > best.value) best = { value: v, action: { ...action, spend: s } };
      }
      return best;
    }
    const n = Core.rollsFor(state, action);
    if (n === 0) return { value: evaluate(simulate(state, action), me), action };
    // Dice cards: sample representative rolls.
    const samples = [[1, 1], [2, 3], [3, 4], [4, 4], [5, 5], [6, 6]];
    let total = 0;
    for (const r of samples) total += evaluate(simulate(state, action, [...r, ...r]), me);
    return { value: total / samples.length, action };
  }

  function keepValue(state, uid) {
    const P = state.players[state.active];
    const d = Core.def(state, uid);
    let v = cardQuality(state, uid) * 2;
    if (d.cost > P.fronts.length + 3) v -= 1.2;
    if (d.cost <= P.fronts.length + 1) v += .4;
    return v;
  }

  function chooseAction(state) {
    const me = state.active;
    const P = state.players[me];
    if (state.phase !== 'main') return null;
    if (state.pending) {
      const pend = state.pending;
      const p = Core.chance(pend.need);
      if (P.hand.length >= 2 && p >= .25) {
        const worst = [...P.hand].sort((a, b) => keepValue(state, a) - keepValue(state, b))[0];
        return { type: 'reroll', uid: worst };
      }
      return { type: 'accept' };
    }
    if (!P.acted && state.rules.mulligan) {
      const cheap = P.hand.filter(u => Core.def(state, u).cost <= 2).length;
      const playable = P.hand.filter(u => Core.def(state, u).cost <= 3).length;
      if (cheap === 0 || playable < 2) return { type: 'mulligan' };
    }
    if (!P.frontPlayed && P.hand.length) {
      const fronts = P.fronts.length;
      if (fronts < 4 || (fronts < 7 && P.hand.length >= 3) || (fronts < 9 && P.hand.length >= 5)) {
        const worst = [...P.hand].sort((a, b) => keepValue(state, a) - keepValue(state, b))[0];
        return { type: 'front', uid: worst };
      }
    }
    const base = evaluate(state, me);
    let best = { value: base + .05, action: { type: 'end' } };
    for (const action of Core.legalActions(state)) {
      if (action.type === 'end' || action.type === 'front' || action.type === 'mulligan') continue;
      const r = score(state, action, me);
      if (r && r.value > best.value) best = r;
    }
    return best.action;
  }

  return { chooseAction, evaluate, cardQuality };
});
