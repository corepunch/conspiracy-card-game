// The Hidden Archive — rules engine (v2).
// Pure game logic: no THREE, no DOM, no timers. Runs in the browser
// (window.ArchiveCore) and in Node (require('./core.js')) for simulation.
// State is plain data; every action goes through apply(state, action, ctx).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArchiveCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let DB = [];
  function setCardData(data) { DB = data; }

  const DEFAULT_RULES = {
    startSecrecy: 20,
    startHand: 5,
    handLimit: 10,
    fieldLimit: 7,
    takeoverBase: 5,      // roll 2d6 <= base + attacker Power - target Resistance + modifiers
    takeoverMax: 10,      // 11 and 12 always fail
    sameSphere: 2,
    opposedSphere: -2,
    exposedBonus: 2,
    subvertBonus: 2,
    spendRate: 2,
    takeoverCost: 'cost', // Influence to attempt a takeover: a number, or 'cost' = the target's printed cost
    useRemaining: false,
    takeoversPerTurn: 1,
    turnedLoyal: true,    // a group that changed hands becomes Loyal (no ping-pong)  // damaged groups are easier to take over         // Influence paid per +1 on a takeover roll
    reroll: true,         // discard a card to reroll a failed takeover once
    narrative: 'second',  // The Narrative (MTG Monarch): 'second' = second player starts with it, 'open' = first face strike claims it, false = off
    domination: 7,        // start your turn controlling this many groups: win (0 = off)
    emptyDeckLeak: 2,
    secondPlayerExtraCard: false,
    trapLimit: 2,
    mulligan: true        // once, before your first action: shuffle your hand away and draw a new one
  };

  const SPHERES = {
    state: { name: 'The State', faction: 'The Deep State', opposed: 'fringe' },
    capital: { name: 'Capital', faction: 'The Consortium', opposed: 'occult' },
    occult: { name: 'The Occult', faction: 'The Illuminati', opposed: 'capital' },
    fringe: { name: 'The Fringe', faction: 'The Fringe', opposed: 'state' }
  };

  const KEYWORD_TEXT = {
    Haste: 'can act the turn it arrives',
    Firewall: 'enemy strikes must target a Firewall group',
    Covert: "can't be targeted by the enemy unless Exposed",
    Pierce: 'excess strike damage leaks to the enemy conspiracy',
    Expose: 'groups it damages become Exposed',
    Fortify: 'takes 1 less damage from each source',
    Network: '+1 Influence each turn',
    Loyal: "can't be taken over",
    Subvert: '+2 to its takeover rolls'
  };

  // ---------- RNG (mulberry32, state lives in the game state) ----------
  function rand(state) {
    let t = state.seed = (state.seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function d6(state, ctx) {
    if (ctx && ctx.rolls && ctx.rolls.length) return ctx.rolls.shift();
    return 1 + Math.floor(rand(state) * 6);
  }
  function shuffle(state, list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand(state) * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // ---------- Decks ----------
  // A deck is 40 distinct cards from one sphere, built to a mana curve.
  function buildDeck(sphere, seed, size = 40) {
    const tmp = { seed: seed | 0 };
    const pool = DB.map((c, id) => ({ c, id })).filter(e => e.c.sphere === sphere);
    shuffle(tmp, pool);
    const curve = { 1: 5, 2: 8, 3: 8, 4: 7, 5: 5, 6: 3, 7: 1 };
    const ids = [];
    const take = e => { ids.push(e.id); pool.splice(pool.indexOf(e), 1); };
    for (const [cost, n] of Object.entries(curve)) {
      pool.filter(e => e.c.cost === +cost).slice(0, n).forEach(take);
    }
    while (ids.length < size && pool.length) take(pool[0]);
    return ids;
  }

  // ---------- Setup ----------
  function createGame(opts = {}) {
    const rules = Object.assign({}, DEFAULT_RULES, opts.rules || {});
    const state = {
      seed: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
      rules, turn: 0, active: opts.first ?? 0, first: opts.first ?? 0,
      phase: 'main', winner: null, winReason: null, pending: null,
      narrative: null, nextUid: 1, cards: {}, log: [],
      players: [0, 1].map(i => ({
        name: (opts.names && opts.names[i]) || ['The Illuminati', 'The Cabal'][i],
        sphere: (opts.spheres && opts.spheres[i]) || null,
        secrecy: rules.startSecrecy, influence: 0, frontPlayed: false, acted: false,
        deck: [], hand: [], fronts: [], field: [], archive: [], traps: [],
        stats: { takeovers: 0, takeoverWins: 0, rerolls: 0, strikesFace: 0, played: [] }
      }))
    };
    for (let p = 0; p < 2; p++) {
      const ids = opts.decks[p];
      for (const id of ids) {
        const uid = state.nextUid++;
        state.cards[uid] = { uid, id, owner: p, ctrl: p, dmg: 0, exhausted: false, sick: false, exposed: false, detained: false, buffP: 0, buffT: 0, tempP: 0 };
        state.players[p].deck.push(uid);
      }
      shuffle(state, state.players[p].deck);
    }
    for (let p = 0; p < 2; p++) for (let i = 0; i < rules.startHand; i++) draw(state, p, true);
    const second = 1 - state.first;
    if (rules.secondPlayerExtraCard) draw(state, second, true);
    if (rules.narrative === 'second' || rules.narrative === true) { state.narrative = second; log(state, `${state.players[second].name} begins holding The Narrative.`); }
    startTurn(state, []);
    return state;
  }

  // ---------- Helpers ----------
  const def = (state, uid) => DB[state.cards[uid].id];
  const has = (state, uid, kw) => {
    const d = def(state, uid);
    if (d.keywords && d.keywords.includes(kw)) return true;
    const ctrl = state.cards[uid].ctrl;
    if (kw === 'Haste' && staticSum(state, ctrl, 'grantHaste', true)) return true;
    if (kw === 'Fortify' && staticSum(state, ctrl, 'fortifyAll', true)) return true;
    return !!(state.cards[uid].grant && state.cards[uid].grant.includes(kw));
  };
  const isGroup = (state, uid) => def(state, uid).type === 'group';
  function staticSum(state, p, kind, any) {
    let total = 0, found = false;
    for (const uid of state.players[p].field) {
      for (const f of def(state, uid).fx || []) if (f.on === 'static' && f.do === kind) { total += f.n || 0; found = true; }
    }
    return any ? found : total;
  }
  function power(state, uid) {
    const c = state.cards[uid];
    const d = def(state, uid);
    let p = d.power + c.buffP + c.tempP;
    if (d.type === 'group') {
      p += staticSum(state, c.ctrl, 'anthem');
      p -= staticSum(state, 1 - c.ctrl, 'enemyMinus');
    }
    return Math.max(0, p);
  }
  const toughness = (state, uid) => def(state, uid).toughness + state.cards[uid].buffT;
  const remaining = (state, uid) => toughness(state, uid) - state.cards[uid].dmg;
  const groupsOf = (state, p) => state.players[p].field.filter(uid => isGroup(state, uid));
  function log(state, text) { if (state.log) state.log.push(text); }
  const nameOf = (state, uid) => def(state, uid).name;

  function targetable(state, uid, byPlayer) {
    const c = state.cards[uid];
    if (!c || c.ctrl === byPlayer) return false;
    if (!state.players[c.ctrl].field.includes(uid) || !isGroup(state, uid)) return false;
    return !has(state, uid, 'Covert') || c.exposed;
  }
  function firewalls(state, p) {
    return groupsOf(state, 1 - p).filter(uid => has(state, uid, 'Firewall') && targetable(state, uid, p));
  }
  function canAct(state, uid) {
    const c = state.cards[uid];
    return isGroup(state, uid) && !c.exhausted && (!c.sick || has(state, uid, 'Haste'));
  }

  // ---------- Takeover math ----------
  function takeoverTarget(state, attacker, target, spend = 0, strength = null) {
    const r = state.rules;
    const a = attacker != null ? state.cards[attacker] : null;
    const by = a ? a.ctrl : 1 - state.cards[target].ctrl;
    let n = r.takeoverBase + (strength != null ? strength : power(state, attacker)) - Math.max(0, r.useRemaining || strength != null ? remaining(state, target) : toughness(state, target)) + Math.floor(spend / r.spendRate);
    const parts = [];
    const ownSphere = a ? def(state, attacker).sphere : state.players[by].sphere;
    const tSphere = def(state, target).sphere;
    if (ownSphere && ownSphere === tSphere) { n += r.sameSphere; parts.push(`+${r.sameSphere} kindred`); }
    else if (ownSphere && SPHERES[ownSphere].opposed === tSphere) { n += r.opposedSphere; parts.push(`−${-r.opposedSphere} opposed sphere`); }
    if (state.cards[target].exposed) { n += r.exposedBonus; parts.push(`+${r.exposedBonus} Exposed`); }
    if (a && has(state, attacker, 'Subvert')) { n += r.subvertBonus; parts.push(`+${r.subvertBonus} Subvert`); }
    const bonus = staticSum(state, by, 'takeoverBonus');
    if (bonus) { n += bonus; parts.push(`+${bonus} assets`); }
    return { need: Math.min(r.takeoverMax, n), raw: n, parts };
  }
  function bribe(state, target) {
    const c = state.rules.takeoverCost;
    return c === 'cost' ? def(state, target).cost : c;
  }
  const P2D6 = [0, 0, 1, 3, 6, 10, 15, 21, 26, 30, 33, 35, 36].map(x => x / 36);
  const chance = need => need < 2 ? 0 : P2D6[Math.min(12, need)];

  // ---------- Turn flow ----------
  function draw(state, p, silent) {
    const P = state.players[p];
    if (!P.deck.length) {
      P.secrecy -= state.rules.emptyDeckLeak;
      log(state, `${P.name} has no dossiers left and leaks ${state.rules.emptyDeckLeak} Secrecy.`);
      return null;
    }
    const uid = P.deck.pop();
    if (P.hand.length >= state.rules.handLimit) {
      P.archive.push(uid);
      if (!silent) log(state, `${P.name}'s hand is full; ${nameOf(state, uid)} is archived.`);
      return null;
    }
    P.hand.push(uid);
    return uid;
  }

  function startTurn(state, events) {
    state.turn += 1;
    const p = state.active;
    const P = state.players[p];
    P.frontPlayed = false;
    P.takeoversThisTurn = 0;
    for (const uid of P.field) {
      const c = state.cards[uid];
      if (c.detained) { c.detained = false; c.exhausted = true; }
      else c.exhausted = false;
      c.sick = false;
    }
    P.influence = P.fronts.length + groupsOf(state, p).filter(uid => has(state, uid, 'Network')).length;
    if (state.rules.domination && groupsOf(state, p).length >= state.rules.domination) {
      return win(state, p, 'domination');
    }
    if (!(state.turn === 1)) {
      const uid = draw(state, p);
      if (uid) events.push({ t: 'draw', p, uid });
    }
    for (const uid of [...P.field]) {
      for (const f of def(state, uid).fx || []) if (f.on === 'start') runEffect(state, p, f, null, null, uid, events);
    }
    settle(state, events);
  }

  function endTurn(state, events) {
    const p = state.active;
    for (const uid in state.cards) state.cards[uid].tempP = 0;
    if (state.narrative === p) {
      const uid = draw(state, p);
      if (uid) { events.push({ t: 'draw', p, uid }); log(state, `${state.players[p].name} controls The Narrative and draws a dossier.`); }
    }
    settle(state, events);
    if (state.winner != null) return;
    state.active = 1 - p;
    startTurn(state, events);
  }

  function win(state, p, reason) {
    if (state.winner != null) return;
    state.winner = p; state.winReason = reason; state.phase = 'over';
    const text = { secrecy: 'blows the cover of the rival conspiracy', domination: 'dominates the world through its groups' }[reason] || 'wins';
    log(state, `${state.players[p].name} ${text}.`);
  }

  // Archive dead groups (repeat until stable) and check for victory.
  function settle(state, events) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let p = 0; p < 2; p++) {
        for (const uid of [...state.players[p].field]) {
          if (isGroup(state, uid) && remaining(state, uid) <= 0) {
            removeFromField(state, uid);
            const c = state.cards[uid];
            state.players[c.owner].archive.push(uid);
            events.push({ t: 'archive', uid });
            log(state, `${nameOf(state, uid)} is archived.`);
            for (const f of def(state, uid).fx || []) if (f.on === 'death') runEffect(state, p, f, null, null, uid, events);
            for (let i = 0; i < staticSum(state, p, 'deathDraw'); i++) draw(state, p);
            changed = true;
          }
        }
      }
    }
    if (state.winner != null) return;
    const lost = [0, 1].filter(p => state.players[p].secrecy <= 0);
    if (lost.length === 2) win(state, state.active, 'secrecy');
    else if (lost.length === 1) win(state, 1 - lost[0], 'secrecy');
  }

  function removeFromField(state, uid) {
    const c = state.cards[uid];
    const F = state.players[c.ctrl].field;
    const i = F.indexOf(uid);
    if (i >= 0) F.splice(i, 1);
    c.dmg = 0; c.exposed = false; c.detained = false; c.buffP = 0; c.buffT = 0; c.tempP = 0; c.grant = null;
    c.exhausted = false; c.sick = false; c.ctrl = c.owner;
  }

  // ---------- Effects ----------
  // Target kinds an effect needs.
  const TARGETED = { damage: 'enemy', expose: 'enemy', destroyExposed: 'enemy', destroyCost: 'enemy', bounce: 'enemy', detain: 'enemy', chaos: 'enemy', coup: 'enemy', buff: 'own', haste: 'own' };
  function effectTargets(state, p, f) {
    const kind = TARGETED[f.do];
    if (!kind) return null;
    if (kind === 'own') return groupsOf(state, p);
    let list = groupsOf(state, 1 - p).filter(uid => targetable(state, uid, p));
    if (f.do === 'destroyExposed') list = list.filter(uid => state.cards[uid].exposed);
    if (f.do === 'destroyCost') list = list.filter(uid => def(state, uid).cost <= f.n);
    if (f.do === 'coup') list = list.filter(uid => !has(state, uid, 'Loyal') && groupsOf(state, p).length < state.rules.fieldLimit);
    return list;
  }
  function cardTargets(state, p, uid) {
    const fxs = (def(state, uid).fx || []).filter(f => ['arrive', 'cast'].includes(f.on));
    const t = fxs.find(f => TARGETED[f.do]);
    return t ? { fx: t, list: effectTargets(state, p, t) } : null;
  }
  function rollsFor(state, action) {
    if (action.type === 'takeover' || action.type === 'reroll') return 2;
    if (action.type === 'play') {
      let n = 0;
      for (const f of def(state, action.uid).fx || []) {
        if (!['arrive', 'cast'].includes(f.on)) continue;
        if (f.do === 'chaos') n += f.n;
        if (f.do === 'coup') n += 2;
      }
      return n;
    }
    return 0;
  }

  function dealDamage(state, uid, amount, events, source) {
    if (amount <= 0 || !state.cards[uid]) return 0;
    if (has(state, uid, 'Fortify')) amount -= 1;
    if (amount <= 0) return 0;
    state.cards[uid].dmg += amount;
    events.push({ t: 'damage', uid, n: amount, source });
    return amount;
  }

  function runEffect(state, p, f, target, ctx, source, events) {
    const P = state.players[p], O = state.players[1 - p];
    const src = source ? nameOf(state, source) : '';
    const n = f.n || 0;
    const tName = target ? nameOf(state, target) : '';
    if (TARGETED[f.do]) {
      const ok = target && state.cards[target] && (TARGETED[f.do] === 'own' ? P.field.includes(target) : effectTargets(state, p, f).includes(target));
      if (!ok) return;
    }
    switch (f.do) {
      case 'draw': for (let i = 0; i < n; i++) { const u = draw(state, p); if (u) events.push({ t: 'draw', p, uid: u }); } if (n) log(state, `${P.name} draws ${n}.`); break;
      case 'influence': P.influence += n; log(state, `${P.name} gains ${n} Influence.`); break;
      case 'leak': O.secrecy -= n; events.push({ t: 'leak', p: 1 - p, n }); log(state, `${src}: ${O.name} leaks ${n} Secrecy.`); break;
      case 'heal': P.secrecy = Math.min(state.rules.startSecrecy + 5, P.secrecy + n); log(state, `${P.name} regains ${n} Secrecy.`); break;
      case 'damage': dealDamage(state, target, n, events, source); log(state, `${src} deals ${n} to ${tName}.`); break;
      case 'ping': {
        const list = groupsOf(state, 1 - p);
        if (list.length) { const t = list[Math.floor(rand(state) * list.length)]; dealDamage(state, t, n, events, source); log(state, `${src} deals ${n} to ${nameOf(state, t)}.`); }
        break;
      }
      case 'sweep': for (const t of groupsOf(state, 1 - p)) dealDamage(state, t, n, events, source); log(state, `${src} deals ${n} to every enemy group.`); break;
      case 'expose':
        if (target) { state.cards[target].exposed = true; log(state, `${tName} is Exposed.`); events.push({ t: 'expose', uid: target }); }
        else {
          const list = groupsOf(state, 1 - p).filter(u => !state.cards[u].exposed);
          if (list.length) { const t = list[Math.floor(rand(state) * list.length)]; state.cards[t].exposed = true; log(state, `${nameOf(state, t)} is Exposed.`); events.push({ t: 'expose', uid: t }); }
        }
        break;
      case 'exposeAll': for (const t of groupsOf(state, 1 - p)) { state.cards[t].exposed = true; events.push({ t: 'expose', uid: t }); } log(state, `${src} exposes every enemy group.`); break;
      case 'discard': case 'discardBoth': {
        const victims = f.do === 'discardBoth' ? [1 - p, p] : [1 - p];
        for (const v of victims) {
          const H = state.players[v].hand;
          for (let i = 0; i < (n || 1) && H.length; i++) {
            const u = H.splice(Math.floor(rand(state) * H.length), 1)[0];
            state.players[v].archive.push(u); events.push({ t: 'discard', p: v, uid: u });
            log(state, `${state.players[v].name} discards ${nameOf(state, u)}.`);
          }
        }
        break;
      }
      case 'destroyExposed': case 'destroyCost':
        removeFromField(state, target); state.players[state.cards[target].owner].archive.push(target);
        events.push({ t: 'archive', uid: target }); log(state, `${src} archives ${tName}.`);
        break;
      case 'bounce':
        removeFromField(state, target);
        { const owner = state.players[state.cards[target].owner];
          if (owner.hand.length < state.rules.handLimit) owner.hand.push(target); else owner.archive.push(target); }
        events.push({ t: 'bounce', uid: target }); log(state, `${tName} is returned to hand.`);
        break;
      case 'detain': state.cards[target].detained = true; state.cards[target].exhausted = true; log(state, `${tName} is Detained.`); break;
      case 'buff': state.cards[target].buffP += n; state.cards[target].buffT += n; log(state, `${tName} gets +${n}/+${n}.`); break;
      case 'haste': state.cards[target].sick = false; state.cards[target].exhausted = false; break;
      case 'chaos': {
        const rolls = []; for (let i = 0; i < n; i++) rolls.push(d6(state, ctx));
        const total = rolls.reduce((a, b) => a + b, 0);
        events.push({ t: 'roll', values: rolls, total, kind: 'chaos' });
        dealDamage(state, target, total, events, source);
        log(state, `${src} rolls ${rolls.join('+')}: ${total} damage to ${tName}.`);
        break;
      }
      case 'coup': {
        const { need } = takeoverTarget(state, null, target, 0, n);
        const rolls = [d6(state, ctx), d6(state, ctx)];
        const total = rolls[0] + rolls[1];
        const ok = total <= need;
        events.push({ t: 'roll', values: rolls, total, need, success: ok, kind: 'coup' });
        log(state, `${src} attempts a takeover of ${tName}: needs ${need}, rolls ${total} — ${ok ? 'success' : 'failure'}.`);
        if (ok) changeControl(state, target, p, events);
        break;
      }
      case 'recall': {
        let got = 0;
        for (let i = P.archive.length - 1; i >= 0 && got < n; i--) {
          const u = P.archive[i];
          if (isGroup(state, u) && P.hand.length < state.rules.handLimit) { P.archive.splice(i, 1); P.hand.push(u); got++; events.push({ t: 'recall', p, uid: u }); }
        }
        if (got) log(state, `${P.name} recovers ${got} group${got > 1 ? 's' : ''} from the Archive.`);
        break;
      }
      case 'ramp':
        if (P.deck.length) { const u = P.deck.pop(); P.fronts.push(u); P.influence += 0; events.push({ t: 'front', p, uid: u }); log(state, `${P.name} sets up a new Front.`); }
        break;
      case 'scry': {
        if (P.deck.length >= 2) {
          const top = P.deck[P.deck.length - 1];
          if (def(state, top).cost > P.fronts.length + 1) { P.deck.pop(); P.deck.unshift(top); log(state, `${src}: ${P.name} buries a dossier.`); }
        }
        break;
      }
      default: break;
    }
  }

  // Countermeasures: face-down traps that spring on the enemy's action.
  // Returns true if the triggering action is cancelled.
  function springTrap(state, owner, when, info, ctx, events) {
    const T = state.players[owner];
    const idx = T.traps.findIndex(u => (def(state, u).fx || []).some(f => f.on === 'trap' && f.when === when));
    if (idx < 0) return false;
    const uid = T.traps.splice(idx, 1)[0];
    T.archive.push(uid);
    const d = def(state, uid);
    const f = d.fx.find(g => g.on === 'trap');
    const foe = 1 - owner;
    const it = info.uid;
    events.push({ t: 'trap', p: owner, uid, when });
    log(state, `COUNTERMEASURE! ${T.name} reveals ${d.name}.`);
    const onField = () => it && state.players[foe].field.includes(it);
    switch (f.do) {
      case 'fail': if (onField()) state.cards[it].exposed = true; log(state, `The takeover is foiled and ${nameOf(state, it)} is Exposed.`); return true;
      case 'reverse': if (onField() && groupsOf(state, owner).length < state.rules.fieldLimit) { log(state, `${nameOf(state, it)} was a double agent all along.`); changeControl(state, it, owner, events); } return true;
      case 'refund': log(state, `The takeover is foiled; ${T.name} pockets the bribe.`); T.secrecy += 2; return true;
      case 'detain': if (onField()) { state.cards[it].detained = true; } log(state, 'The strike is stopped and the group Detained.'); return true;
      case 'riposte': state.players[foe].secrecy -= f.n; log(state, `The strike is stopped; ${state.players[foe].name} leaks ${f.n}.`); return true;
      case 'bounce': if (onField()) { removeFromField(state, it); state.players[state.cards[it].owner].hand.push(it); events.push({ t: 'bounce', uid: it }); } log(state, 'The striking group vanishes back to hand.'); return true;
      case 'counter': log(state, `${nameOf(state, it)} is cancelled.`); return true;
      case 'damage': if (onField()) { dealDamage(state, it, f.n, events, uid); log(state, `${nameOf(state, it)} takes ${f.n} damage.`); } return false;
      case 'exposeDamage': if (onField()) { state.cards[it].exposed = true; dealDamage(state, it, f.n, events, uid); log(state, `${nameOf(state, it)} is Exposed and takes ${f.n} damage.`); } return false;
      case 'chaos': if (onField()) { const r = [d6(state, ctx)]; events.push({ t: 'roll', values: r, total: r[0], kind: 'chaos' }); dealDamage(state, it, r[0], events, uid); log(state, `${nameOf(state, it)} takes ${r[0]} damage.`); } return false;
      case 'destroyCheap': if (onField() && def(state, it).cost <= f.n) { removeFromField(state, it); state.players[state.cards[it].owner].archive.push(it); events.push({ t: 'archive', uid: it }); log(state, `${nameOf(state, it)} is archived.`); } return false;
      default: return false;
    }
  }

  function changeControl(state, uid, to, events) {
    const c = state.cards[uid];
    const F = state.players[c.ctrl].field;
    F.splice(F.indexOf(uid), 1);
    state.players[to].field.push(uid);
    c.ctrl = to; c.exposed = false; c.detained = false; c.exhausted = true; c.sick = true;
    if (state.rules.turnedLoyal) c.grant = [...(c.grant || []), 'Loyal'];
    events.push({ t: 'control', uid, to });
  }

  // ---------- Actions ----------
  function legalActions(state) {
    if (state.phase !== 'main') return [];
    const p = state.active, P = state.players[p];
    if (state.pending) {
      const acts = [{ type: 'accept' }];
      for (const uid of P.hand) acts.push({ type: 'reroll', uid });
      return acts;
    }
    const acts = [{ type: 'end' }];
    if (state.rules.mulligan && !P.acted) acts.push({ type: 'mulligan' });
    if (!P.frontPlayed) for (const uid of P.hand) acts.push({ type: 'front', uid });
    const fieldFull = P.field.length >= state.rules.fieldLimit;
    for (const uid of P.hand) {
      const d = def(state, uid);
      if (d.cost > P.influence) continue;
      if ((d.type === 'group' || d.type === 'asset') && fieldFull) continue;
      if (d.type === 'trap' && P.traps.length >= state.rules.trapLimit) continue;
      const t = cardTargets(state, p, uid);
      if (t && t.list.length) for (const target of t.list) acts.push({ type: 'play', uid, target });
      else if (!t || d.type === 'group' || d.type === 'asset') acts.push({ type: 'play', uid });
    }
    for (const uid of P.field) {
      if (!canAct(state, uid)) continue;
      const walls = firewalls(state, p);
      const enemies = groupsOf(state, 1 - p).filter(t => targetable(state, t, p));
      const strikeTargets = walls.length ? walls : enemies;
      for (const t of strikeTargets) acts.push({ type: 'strike', uid, target: t });
      if (!walls.length) acts.push({ type: 'strike', uid, target: 'player' });
      if (!fieldFull) for (const t of enemies) {
        if (P.takeoversThisTurn >= state.rules.takeoversPerTurn) break;
        if (has(state, t, 'Loyal') || P.influence < bribe(state, t)) continue;
        if (takeoverTarget(state, uid, t, P.influence - bribe(state, t)).need < 2) continue;
        acts.push({ type: 'takeover', uid, target: t, spend: 0 });
      }
    }
    return acts;
  }

  function isLegal(state, action) {
    const strip = a => JSON.stringify({ type: a.type, uid: a.uid, target: a.target });
    const key = strip(action);
    return legalActions(state).some(a => strip(a) === key);
  }

  function apply(state, action, ctx = {}) {
    const events = [];
    if (state.phase !== 'main') return events;
    const p = state.active, P = state.players[p], O = state.players[1 - p];
    if (!isLegal(state, action)) throw new Error('Illegal action ' + JSON.stringify(action));
    if (action.type !== 'mulligan') P.acted = true;
    switch (action.type) {
      case 'mulligan': {
        const n = P.hand.length;
        P.deck.push(...P.hand.splice(0));
        shuffle(state, P.deck);
        for (let i = 0; i < n; i++) draw(state, p, true);
        P.acted = true;
        events.push({ t: 'mulligan', p });
        log(state, `${P.name} shuffles away its hand and draws ${n} new dossiers.`);
        break;
      }
      case 'end': endTurn(state, events); break;
      case 'front': {
        P.hand.splice(P.hand.indexOf(action.uid), 1);
        P.fronts.push(action.uid); P.frontPlayed = true; P.influence += 1;
        events.push({ t: 'front', p, uid: action.uid });
        log(state, `${P.name} establishes a new Front.`);
        break;
      }
      case 'play': {
        const uid = action.uid, d = def(state, uid), c = state.cards[uid];
        P.hand.splice(P.hand.indexOf(uid), 1);
        P.influence -= d.cost;
        P.stats.played.push(c.id);
        events.push({ t: 'play', p, uid });
        if (d.type === 'group' || d.type === 'asset') {
          P.field.push(uid); c.sick = true; c.exhausted = false; c.ctrl = p;
          log(state, `${P.name} recruits ${d.name}.`);
          for (const f of d.fx || []) if (f.on === 'arrive') runEffect(state, p, f, action.target, ctx, uid, events);
          if (d.type === 'group') springTrap(state, 1 - p, 'recruit', { uid }, ctx, events);
        } else if (d.type === 'operation') {
          log(state, `${P.name} runs ${d.name}.`);
          P.archive.push(uid);
          if (springTrap(state, 1 - p, 'operation', { uid }, ctx, events)) break;
          for (const f of d.fx || []) if (f.on === 'cast') runEffect(state, p, f, action.target, ctx, uid, events);
        } else if (d.type === 'trap') {
          P.traps.push(uid);
          log(state, `${P.name} sets a countermeasure.`);
        } else if (d.type === 'referendum') {
          const f = d.fx[0];
          const mine = groupsOf(state, p).length, theirs = groupsOf(state, 1 - p).length;
          const passed = mine > theirs;
          log(state, `${P.name} calls the ${d.name} referendum: ${mine} votes to ${theirs} — ${passed ? 'passed' : 'failed'}.`);
          events.push({ t: 'vote', mine, theirs, passed });
          runEffect(state, p, passed ? f.more : f.less, null, ctx, uid, events);
          P.archive.push(uid);
        }
        break;
      }
      case 'strike': {
        const a = action.uid;
        state.cards[a].exhausted = true;
        if (action.target === 'player') {
          if (springTrap(state, 1 - p, 'strikeFace', { uid: a }, ctx, events)) break;
          const n = power(state, a);
          O.secrecy -= n; P.stats.strikesFace++;
          events.push({ t: 'strike', uid: a, target: 'player', n });
          log(state, `${nameOf(state, a)} strikes ${O.name} for ${n}.`);
          if (n > 0 && state.rules.narrative && state.narrative !== p) { state.narrative = p; log(state, `${P.name} seizes The Narrative.`); events.push({ t: 'narrative', p }); }
        } else {
          const t = action.target;
          const pa = power(state, a), pt = power(state, t);
          const before = remaining(state, t);
          events.push({ t: 'strike', uid: a, target: t });
          log(state, `${nameOf(state, a)} (${pa}) strikes ${nameOf(state, t)} (${pt}).`);
          const dealt = dealDamage(state, t, pa, events, a);
          dealDamage(state, a, pt, events, t);
          if (dealt > 0 && has(state, a, 'Expose')) state.cards[t].exposed = true;
          if (pt > 0 && has(state, t, 'Expose') && remaining(state, a) > 0) state.cards[a].exposed = true;
          if (has(state, a, 'Pierce') && dealt > before) { const x = dealt - Math.max(0, before); O.secrecy -= x; log(state, `${x} damage pierces through.`); events.push({ t: 'leak', p: 1 - p, n: x }); }
        }
        break;
      }
      case 'takeover': {
        const a = action.uid, t = action.target;
        P.influence -= bribe(state, t);
        const spend = Math.max(0, Math.min(P.influence, action.spend | 0));
        P.influence -= spend;
        state.cards[a].exhausted = true;
        const { need } = takeoverTarget(state, a, t, spend);
        const rolls = [d6(state, ctx), d6(state, ctx)];
        P.stats.takeovers++;
        P.takeoversThisTurn = (P.takeoversThisTurn || 0) + 1;
        if (springTrap(state, 1 - p, 'takeover', { uid: a, target: t }, ctx, events)) break;
        resolveTakeover(state, { a, t, need, rolls, spend, rerolled: false }, events);
        break;
      }
      case 'reroll': case 'accept': {
        const pend = state.pending;
        state.pending = null;
        if (action.type === 'accept') { failTakeover(state, pend, events); break; }
        P.hand.splice(P.hand.indexOf(action.uid), 1); P.archive.push(action.uid);
        P.stats.rerolls++;
        log(state, `${P.name} discards ${nameOf(state, action.uid)} for plausible deniability and rerolls.`);
        events.push({ t: 'discard', p, uid: action.uid });
        resolveTakeover(state, { ...pend, rolls: [d6(state, ctx), d6(state, ctx)], rerolled: true }, events);
        break;
      }
      default: throw new Error('Unknown action ' + action.type);
    }
    settle(state, events);
    return events;
  }

  function resolveTakeover(state, t, events) {
    const P = state.players[state.active];
    const total = t.rolls[0] + t.rolls[1];
    const ok = total <= t.need;
    events.push({ t: 'roll', values: t.rolls, total, need: t.need, success: ok, kind: 'takeover', rerolled: t.rerolled });
    log(state, `${nameOf(state, t.a)} attempts to take over ${nameOf(state, t.t)}${t.spend ? ` (+${t.spend} Influence)` : ''}: needs ${t.need} or less, rolls ${total} — ${ok ? 'SUCCESS' : 'failure'}.`);
    if (ok) {
      P.stats.takeoverWins++;
      changeControl(state, t.t, state.active, events);
    } else if (state.rules.reroll && !t.rerolled && P.hand.length) {
      state.pending = t;
    } else failTakeover(state, t, events);
  }
  function failTakeover(state, t, events) {
    if (state.cards[t.a] && state.players[state.active].field.includes(t.a)) {
      state.cards[t.a].exposed = true;
      events.push({ t: 'expose', uid: t.a });
      log(state, `${nameOf(state, t.a)} is Exposed by the failed takeover.`);
    }
  }

  // ---------- Text ----------
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  function fxText(f) {
    const n = f.n || 0;
    switch (f.do) {
      case 'draw': return `draw ${plural(n, 'card')}`;
      case 'influence': return `gain ${n} Influence`;
      case 'leak': return `the enemy leaks ${n} Secrecy`;
      case 'heal': return `regain ${n} Secrecy`;
      case 'damage': return `deal ${n} damage to target enemy group`;
      case 'ping': return `deal ${n} damage to a random enemy group`;
      case 'sweep': return `deal ${n} damage to every enemy group`;
      case 'expose': return f.on === 'start' ? 'Expose a random enemy group' : 'Expose target enemy group';
      case 'exposeAll': return 'Expose every enemy group';
      case 'discard': return `the enemy discards ${plural(n, 'card')} at random`;
      case 'discardBoth': return 'each player discards a card at random';
      case 'destroyExposed': return 'archive target Exposed enemy group';
      case 'destroyCost': return `archive target enemy group costing ${n} or less`;
      case 'bounce': return "return target enemy group to its owner's hand";
      case 'detain': return "Detain target enemy group (it won't ready next turn)";
      case 'buff': return `target group you control gets +${n}/+${n}`;
      case 'haste': return 'it can act this turn';
      case 'chaos': return `roll ${n === 1 ? 'a die' : n + ' dice'}; deal that much damage to target enemy group`;
      case 'coup': return `take over target enemy group on 2d6 ≤ ${5 + n} − its Resistance`;
      case 'recall': return `return ${n === 1 ? 'a group' : n + ' groups'} from your Archive to hand`;
      case 'ramp': return 'put your top dossier into play as a Front';
      case 'scry': return 'look at your top dossier; you may bury it';
      case 'anthem': return `your groups get +${n} Power`;
      case 'enemyMinus': return `enemy groups get −${n} Power`;
      case 'takeoverBonus': return `your takeovers get +${n}`;
      case 'grantHaste': return 'your groups have Haste';
      case 'fortifyAll': return 'your groups have Fortify';
      case 'deathDraw': return 'whenever one of your groups is archived, draw a card';
      default: return f.do;
    }
  }
  const TRAP_TEXT = {
    takeover: 'When the enemy attempts a takeover:',
    strikeFace: 'When an enemy group strikes your conspiracy:',
    recruit: 'When the enemy recruits a group:',
    operation: 'When the enemy runs an operation:'
  };
  function trapText(f) {
    return {
      fail: 'it fails and the attacker is Exposed.',
      reverse: 'it fails and you take over the attacker.',
      refund: 'it fails and you regain 2 Secrecy.',
      detain: 'prevent it and Detain the group.',
      riposte: `prevent it; the enemy leaks ${f.n} Secrecy.`,
      bounce: "prevent it and return the group to its owner's hand.",
      counter: 'cancel it.',
      damage: `deal ${f.n} damage to it.`,
      exposeDamage: `Expose it and deal ${f.n} damage to it.`,
      chaos: 'roll a die; deal that much damage to it.',
      destroyCheap: `archive it if it costs ${f.n} or less.`
    }[f.do];
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function describe(d) {
    const parts = [];
    for (const f of d.fx || []) {
      if (f.on === 'trap') { parts.push(`Countermeasure — set face-down. ${TRAP_TEXT[f.when]} ${trapText(f)}`); continue; }
      if (f.on === 'referendum') { parts.push(`Referendum — if you control more groups: ${fxText(f.more)}. Otherwise: ${fxText(f.less)}.`); continue; }
      if (f.on === 'death' && f.do === 'draw' && (d.fx || []).some(g => g.do === 'deathDraw')) continue;
      const prefix = { arrive: 'Arrival: ', death: 'When archived: ', start: 'Each turn: ', static: '', cast: '' }[f.on] || '';
      parts.push(prefix + (prefix ? fxText(f) : cap(fxText(f))) + '.');
    }
    if (d.type === 'operation') return parts.join(' ').replace(/\. (\w)/g, (m, c) => '. ' + c.toUpperCase());
    return parts.join(' ');
  }
  function keywordReminder(d) {
    return (d.keywords || []).map(k => `${k}: ${KEYWORD_TEXT[k]}.`).join(' ');
  }

  // ---------- Cloning ----------
  function clone(state) {
    const log = state.log;
    state.log = null;
    const copy = JSON.parse(JSON.stringify(state));
    state.log = log;
    return copy;
  }

  return {
    DEFAULT_RULES, SPHERES, KEYWORD_TEXT, setCardData, buildDeck, createGame, legalActions, apply, isLegal,
    rollsFor, takeoverTarget, bribe, chance, power, toughness, remaining, has, def, canAct, targetable, firewalls,
    cardTargets, effectTargets, describe, keywordReminder, fxText, clone, groupsOf, staticSum,
    get DB() { return DB; }
  };
});
