#!/usr/bin/env node
// One-shot generator used to convert the original 256-card list (names, art
// order and flavour text are preserved) into the v2 rules format. The output
// cards.js is the source of truth afterwards; this script documents how the
// first pass of stats was derived and can regenerate it for experiments:
//
//   git show c3682d3:cards.js > /tmp/original-cards.js
//   node tools/gen-cards.js /tmp/original-cards.js > cards.js
//
// After generation a handful of cards were hand-tuned from simulation results
// (see PLAYTEST.md, iteration 7), so regenerating will undo those tweaks.
//
// Stats follow a budget of 2 × cost + 1 Power/Resistance points, minus the
// price of keywords and triggered abilities (see PRICE below).
'use strict';
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(process.argv[2] || 'cards.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const OLD = sandbox.window.CARD_DATA || sandbox.CARD_DATA;

const GOV = [3,6,11,15,16,17,19,20,22,38,40,41,55,64,66,69,71,76,77,83,85,86,90,95,111,113,114,115,118,121,124,125,130,131,133,134,136,141,144,147,148,154,157,161,166,170,174,178,180,183,187,191,207,208,209,212,228,232,233,253,254];
const CORP = [13,18,21,31,34,36,37,51,54,58,63,68,73,75,82,84,96,97,100,101,102,104,116,119,123,126,127,132,138,140,150,153,155,156,158,164,167,173,184,194,196,197,198,200,206,214,216,219,221,224,225,234,238,247];
const OCCULT = [0,9,14,23,25,26,27,28,33,35,42,47,48,49,53,56,61,72,79,81,87,88,91,92,98,103,107,108,109,129,139,149,151,168,169,175,177,179,186,188,202,203,205,213,222,223,226,227,230,236,239,241,243,246,252,255];
const sphereOf = i => GOV.includes(i) ? 'state' : CORP.includes(i) ? 'capital' : OCCULT.includes(i) ? 'occult' : 'fringe';

function rng(seed) {
  let s = seed * 2654435761 >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, s | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// Stat-point price of each ability.
const PRICE = {
  Haste: 1.5, Firewall: 0, Covert: 1.5, Pierce: 1.5, Expose: 1, Fortify: 1.5, Network: 2, Loyal: 0.5, Subvert: 1,
  draw: n => 2 * n, influence: n => n, damage: n => n + 1, leak: n => n, heal: n => n * .5, expose: () => 1,
  discard: n => 1.5 * n, destroyExposed: () => 3, bounce: () => 2.5, detain: () => 1, buff: n => 1.5 * n,
  chaos: () => 3.5, recall: () => 2, exposeAll: () => 2.5, sweep: n => 3 * n, ramp: () => 2.5
};

// Operation price in stat points; cost = round(price / 2).
const OP_PRICE = {
  damage: n => n + .5, leak: n => 1.2 * n, draw: n => 2 * n, heal: n => .5 * n, expose: () => 1, exposeAll: () => 2.5,
  discard: n => 1.2 * n, destroyExposed: () => 3, destroyCost: n => 1.5 * n + 1, bounce: () => 2.5, detain: () => 1,
  buff: n => 1.5 * n, haste: () => 1, chaos: n => 2.5 * n, sweep: n => 3 * n, coup: n => 1.3 * n - 2, recall: n => 2 * n,
  ramp: () => 2.5, influence: n => n
};

const KEYWORDS = {
  state: ['Firewall', 'Firewall', 'Expose', 'Fortify', 'Loyal'],
  capital: ['Network', 'Network', 'Subvert', 'Fortify', 'Firewall'],
  occult: ['Covert', 'Covert', 'Subvert', 'Loyal', 'Expose'],
  fringe: ['Haste', 'Haste', 'Pierce', 'Pierce', 'Expose']
};
// Triggered abilities on groups: [trigger, effect, n]
const GROUP_FX = {
  state: [['arrive','expose',0],['arrive','detain',0],['arrive','heal',2],['arrive','damage',1],['arrive','draw',1],['death','draw',1]],
  capital: [['arrive','draw',1],['arrive','draw',1],['arrive','discard',1],['arrive','heal',2],['start','influence',1],['death','draw',1]],
  occult: [['arrive','discard',1],['arrive','leak',2],['death','leak',2],['start','leak',1],['arrive','recall',1],['arrive','draw',1]],
  fringe: [['arrive','chaos',1],['arrive','damage',1],['arrive','leak',1],['death','leak',2],['arrive','damage',2],['arrive','expose',0]]
};

const HINTS = [
  [/Base|Bunker|Complex|Mountain|Vault|Fort |Wall|Hangar|Stones|Temple|Plane/, ['Firewall', 'Fortify']],
  [/Footage|Testimony|Files|Report|Tap$|Grid|Reader|Camera|Wiretap|Data|Surveillance|Dossier|Sweep|Profile/, ['Expose']],
  [/Bank|Fund|Account|Federal|Dollar|Currency|Backchannel|System|Desk|Cartel/, ['Network']],
  [/Monster|Beast|Howler|squatch|Goblin|Mothman|Owlman|Chupacabra|Nightcrawler|Goatman|Bigfoot|Yeti/, ['Haste', 'Pierce']],
  [/Society|Order|Circle|Brotherhood|Hand|Council|Compact|Club|Lodge|Commission|Bones|Group$|Guild|Cabal/, ['Covert', 'Subvert']],
  [/Templar|Bible|Rite|Ritual|Grail|Nephilim/, ['Loyal']]
];

// Operation templates by sphere: cost -> effect list.
function opFx(sphere, cost, r) {
  const T = {
    state: [
      c => [['cast','damage',c + 1]], c => [['cast','destroyExposed',0], ['cast','draw', c >= 4 ? 1 : 0]],
      c => [['cast','exposeAll',0], ['cast','draw', Math.max(1, c - 1)]], c => [['cast','detain',0], ['cast','draw',1]],
      c => [['cast','bounce',0], ['cast','draw', c >= 3 ? 1 : 0]], c => c >= 4 ? [['cast','sweep',c - 2]] : [['cast','heal',3 + c], ['cast','draw',1]]
    ],
    capital: [
      c => [['cast','draw',c >= 3 ? 3 : 2]], c => [['cast','ramp',0], ['cast','draw', c >= 3 ? 1 : 0]],
      c => [['cast','coup',c + 2]], c => [['cast','discard',Math.min(3, c)]],
      c => [['cast','buff',c]], c => [['cast','destroyCost',c - 1]]
    ],
    occult: [
      c => [['cast','coup',c + 2]], c => [['cast','leak',c + 1]], c => [['cast','discard',Math.min(3, c)]],
      c => [['cast','recall',Math.min(2, c)]], c => [['cast','destroyCost',c - 1]], c => [['cast','destroyExposed',0], ['cast','leak', c >= 3 ? 2 : 0]]
    ],
    fringe: [
      c => [['cast','chaos', c >= 4 ? 2 : 1]], c => [['cast','damage',c + 1]], c => [['cast','leak',c + 1]],
      c => c >= 4 ? [['cast','sweep',c - 2]] : [['cast','chaos',1]], c => [['cast','buff',c], ['cast','haste',0]], c => [['cast','damage',c]]
    ]
  };
  return pick(r, T[sphere])(cost).filter(([, d, n]) => !(['draw','leak'].includes(d) && n === 0) && !(d === 'destroyCost' && n < 1));
}

// Hand-designed signature cards (index -> overrides).
const SIGNATURE = {
  79: { type: 'group', cost: 5, power: 3, toughness: 5, keywords: ['Covert'], fx: [['static','takeoverBonus',2]] }, // The Illuminati
  98: { type: 'group', cost: 2, power: 2, toughness: 2, keywords: ['Subvert'], fx: [] }, // The Cabal
  134: { type: 'group', cost: 4, power: 3, toughness: 3, keywords: [], fx: [['arrive','destroyExposed',0]] }, // Men in Black
  178: { type: 'group', cost: 4, power: 3, toughness: 4, keywords: ['Covert'], fx: [['arrive','exposeAll',0]] }, // Majestic 12
  125: { type: 'group', cost: 3, power: 1, toughness: 5, keywords: ['Firewall'], fx: [['arrive','draw',1]] }, // Area 51
  192: { type: 'group', cost: 4, power: 4, toughness: 3, keywords: ['Haste', 'Pierce'], fx: [] }, // Mothman
  219: { type: 'group', cost: 6, power: 4, toughness: 7, keywords: ['Network', 'Fortify'], fx: [['arrive','draw',1]] }, // Federal Reserve
  60: { type: 'operation', cost: 2, fx: [['cast','chaos',1], ['cast','expose',0]] }, // Roswell Incident
  6: { type: 'group', cost: 3, power: 2, toughness: 4, keywords: ['Firewall', 'Loyal'], fx: [['arrive','detain',0]] }, // Deep State
  108: { type: 'group', cost: 4, power: 4, toughness: 4, keywords: ['Loyal'], fx: [['death','recall',1]] }, // Knights Templar
  88: { type: 'group', cost: 3, power: 2, toughness: 3, keywords: ['Covert'], fx: [['start','leak',1]] }, // Bilderberg
  204: { type: 'group', cost: 3, power: 3, toughness: 3, keywords: ['Covert'], fx: [] }, // Loch Ness
  114: { type: 'operation', cost: 3, fx: [['cast','exposeAll',0], ['cast','draw',2]] }, // PRISM
  156: { type: 'operation', cost: 5, fx: [['cast','coup',8]] }, // Mockingbird Media Network
  70: { type: 'operation', cost: 7, fx: [['cast','sweep',3], ['cast','leak',2]] }, // Reptilians
  230: { type: 'operation', cost: 2, fx: [['cast','recall',2], ['cast','draw',1]] }, // The Invisible College
  // Countermeasures (traps)
  77: { type: 'trap', cost: 2, fx: [['trap','fail',0,'takeover']] }, // Sealed Indictment Cache
  69: { type: 'trap', cost: 2, fx: [['trap','detain',0,'strikeFace']] }, // FEMA Camps
  83: { type: 'trap', cost: 2, fx: [['trap','exposeDamage',2,'recruit']] }, // Sealed Grand Jury Files
  54: { type: 'trap', cost: 1, fx: [['trap','refund',0,'takeover']] }, // Numbered Swiss Account
  138: { type: 'trap', cost: 3, fx: [['trap','counter',0,'operation']] }, // Interest Rate Cabal
  68: { type: 'trap', cost: 2, fx: [['trap','damage',3,'recruit']] }, // Patented Sunlight
  35: { type: 'trap', cost: 2, fx: [['trap','reverse',0,'takeover']] }, // Inner Circle Compact
  47: { type: 'trap', cost: 2, fx: [['trap','riposte',3,'strikeFace']] }, // Round Table Group
  139: { type: 'trap', cost: 2, fx: [['trap','destroyCheap',3,'recruit']] }, // Ordo Templi Society
  122: { type: 'trap', cost: 2, fx: [['trap','bounce',0,'strikeFace']] }, // Missing Time Report
  176: { type: 'trap', cost: 1, fx: [['trap','chaos',0,'recruit']] }, // Rendlesham Forest Lights
  163: { type: 'trap', cost: 2, fx: [['trap','counter',0,'operation']] }, // Flat Earth Society
  // Former dual-use wildcards: those that are places/objects become Assets.
  15: { type: 'asset', cost: 3, fx: [['start','ping',1]] }, // HAARP
  9: { type: 'asset', cost: 3, fx: [['static','anthem',1]] }, // Bohemian Grove
  26: { type: 'asset', cost: 2, fx: [['start','leak',1]] }, // Necronomicon Fragment
  4: { type: 'asset', cost: 4, fx: [['static','anthem',1], ['static','grantHaste',0]] }, // Antigravity Craft Rumor
  42: { type: 'asset', cost: 1, fx: [['death','draw',1], ['static','deathDraw',1]] }, // Mu
  64: { type: 'asset', cost: 1, fx: [['start','expose',0]] }, // Space Force Secrets
  66: { type: 'asset', cost: 1, fx: [['start','scry',0]] }, // Kryptos
  76: { type: 'asset', cost: 4, fx: [['static','takeoverBonus',2]] }, // MK-Ultra
  104: { type: 'asset', cost: 2, fx: [['start','influence',1]] }, // Bond Market Whisper
  109: { type: 'asset', cost: 5, fx: [['start','heal',2], ['static','anthem',1]] }, // Ark of the Covenant
  153: { type: 'asset', cost: 4, fx: [['start','influence',1], ['start','draw',1]] }, // Basel Accord Loophole
  182: { type: 'asset', cost: 3, fx: [['start','discard',1]] }, // Backmasked Message
  228: { type: 'asset', cost: 3, fx: [['static','enemyMinus',1]] }, // Fluoride
  232: { type: 'asset', cost: 2, fx: [['static','fortifyAll',0]] }, // Area 52
  241: { type: 'asset', cost: 3, fx: [['static','takeoverBonus',1], ['start','influence',1]] } // Grand Architects Guild
};

function build(i) {
  const [name, oldType, oldCost, , , , , flavor] = OLD[i];
  const r = rng(i + 17);
  const sphere = sphereOf(i);
  const sig = SIGNATURE[i];
  let type = oldType === 'wildcard' ? 'group' : oldType;
  let cost = oldCost;
  if (sig) { type = sig.type; cost = sig.cost ?? cost; }
  const card = { name, sphere, type, cost, power: 0, toughness: 0, keywords: [], fx: [], flavor };
  if (sig && sig.fx) card.fx = sig.fx.map(([on, d, n, when]) => when ? { on, when, do: d, n } : { on, do: d, n });
  if (type === 'asset' || type === 'trap') return card;
  if (type === 'operation') {
    if (!sig) {
      card.fx = opFx(sphere, cost, r).map(([on, d, n]) => ({ on, do: d, n }));
      const price = card.fx.reduce((s, f) => s + (OP_PRICE[f.do] ? OP_PRICE[f.do](f.n) : 1), 0);
      card.cost = Math.max(1, Math.min(7, Math.round(price / 2)));
    }
    return card;
  }
  if (type === 'referendum') {
    const options = [
      { more: { do: 'leak', n: cost }, less: { do: 'draw', n: 1 } },
      { more: { do: 'draw', n: cost + 1 }, less: { do: 'heal', n: 3 } },
      { more: { do: 'sweep', n: Math.max(1, cost - 2) }, less: { do: 'draw', n: 1 } },
      { more: { do: 'discard', n: 2 }, less: { do: 'influence', n: 2 } }
    ];
    card.fx = [{ on: 'referendum', ...pick(r, options) }];
    card.cost += 1;
    return card;
  }
  if (sig) { Object.assign(card, { power: sig.power, toughness: sig.toughness, keywords: sig.keywords }); return card; }
  // Group
  const mod = ({ state: .5, capital: .5, occult: .5, fringe: -.5 })[sphere];
  let budget = 2 * cost + 1 - (cost >= 5 ? 1 : 0) + (r() < Math.abs(mod) ? Math.sign(mod) : 0);
  const hint = HINTS.find(([re]) => re.test(name));
  const kwRoll = r();
  if (hint && kwRoll < .8) card.keywords.push(pick(r, hint[1]));
  else if (kwRoll < .55) card.keywords.push(pick(r, KEYWORDS[sphere]));
  if (cost >= 4 && r() < .35) {
    const extra = pick(r, KEYWORDS[sphere]);
    if (!card.keywords.includes(extra)) card.keywords.push(extra);
  }
  budget -= card.keywords.reduce((s, k) => s + PRICE[k], 0);
  if (r() < (card.keywords.length ? .35 : .65)) {
    let [on, d, n] = pick(r, GROUP_FX[sphere]);
    if (cost >= 5 && ['damage','leak','heal'].includes(d)) n += 1;
    const price = typeof PRICE[d] === 'function' ? PRICE[d](n) : 0;
    const p = on === 'death' ? price * .7 : on === 'start' ? price * 2 : price;
    if (budget - p >= 2) { card.fx.push({ on, do: d, n }); budget -= p; }
  }
  budget = Math.max(2, Math.round(budget));
  const bias = { state: .4, capital: .45, occult: .48, fringe: .52 }[sphere] + (r() - .5) * .25;
  const firewall = card.keywords.includes('Firewall');
  let power = Math.round(budget * (firewall ? bias * .6 : bias));
  power = Math.max(firewall ? 0 : 1, Math.min(budget - 1, power));
  card.power = power; card.toughness = budget - power;
  return card;
}

const cards = OLD.map((_, i) => build(i));
const lines = cards.map(c => '  ' + JSON.stringify(c));
process.stdout.write(`// The Hidden Archive — card list (v2 rules). Index order matches assets/cards.webp.
// sphere: state | capital | occult | fringe      type: group | operation | referendum | asset | trap
// fx: triggered/static abilities, interpreted by core.js (see RULES.md).
(function (root) {
  const CARD_DATA = [
${lines.join(',\n')}
  ];
  if (typeof module === 'object' && module.exports) module.exports = CARD_DATA;
  else root.CARD_DATA = CARD_DATA;
})(typeof self !== 'undefined' ? self : this);
`);
