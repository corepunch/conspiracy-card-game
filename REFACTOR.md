Nice — this is way more useful than the repo listing would've been. This is a solid piece of work already: real physics-simulated dice (Verlet integration, contact impulses, wall collisions), a hand-rolled scene graph, and — notably — you've *already* built a real FSM (`State` enum + `allowedTransitions` map + a `transition()` guard that throws on illegal moves). That's more state-machine discipline than most card games in the wild have. So the question isn't "add a state machine," it's "the state machine is currently entangled with rendering — how do we pull them apart."

## The core problem

Your game truth and your rendering are the same objects, mutated in place, sequenced by `await`. Concretely:

- `hand`, `battlefield`, `archive`, `deck`, `playerTokens`, etc. hold **THREE.Mesh instances**, not card data. Game logic does `hand.indexOf(dragging)`, `battlefield.push(card)` — it's reasoning about meshes.
- `attackCard()` is one async function that does dice *physics* (a real-time simulation with `requestAnimationFrame`), *then* derives the game-truth roll value from `topFaceValueFromQuaternion()` — i.e. **the physics simulation is your RNG.** The die literally has to finish tumbling before the game knows whether the attack succeeded.
- Turn phase (`PLAYER_IDLE`/`PLAYER_DONE`/`AI_THINKING`) and animation phase (`ROLLING_PLAYER`/`REPORTING_PLAYER`/`RESOLVING_PLAYER`) live in the same enum. That's fine today, but it means "game state" and "what the camera is currently doing" can't be reasoned about independently.

None of this is *wrong* for a single-file hotseat prototype — it clearly works and looks good. But it's the reason "clear state management" feels elusive: there's no pure snapshot of "the game" you could serialize, log, replay, or hand to an AI to evaluate without also running a physics engine.

## The one thing I'd fix first: decouple RNG from physics

This is the highest-leverage change. Right now the die's *landed face* is the source of truth. Flip it:

```js
// core: pure, deterministic, testable
function rollAttack(rng) {
  return [rng.d6(), rng.d6()]; // truth decided here, instantly
}
```

Then the physics dice become **cosmetic** — you already know the target values before the throw, so bias the final settle (a common trick: run the sim normally, then in the last ~300ms lerp/snap the die's *up* face toward the predetermined value instead of reading whatever `topFaceValueFromQuaternion` gives you). Your `reportRoll`/reveal animation barely changes — you're just no longer trusting the physics for the number.

Why this matters beyond elegance: it's what makes replay, undo, an AI that can search ahead ("what if I attack with this card"), or eventually networked play possible. None of those can depend on a client-side Verlet solver being deterministic across machines — and it won't be.

## Suggested split (Functional Core / Imperative Shell — right up your alley)

**`core.js`** — no THREE, no DOM, no timers. Cards as plain IDs, state as plain data:

```js
// Pure state shape
{
  deck: [3, 17, 9, ...],           // card indices, not meshes
  hand: [4, 12],
  battlefield: [8, 1],
  archive: [22],
  opponent: { battlefield: [], groupCount: 1, power: 2, tokens: 10 },
  playerTokens: 10,
  phase: 'playerIdle',             // your existing FSM, minus animation states
}

// Pure moves — same shape in/out, no await, no side effects
function attackWithCard(state, cardId, roll) { /* returns next state */ }
function resolveAiTurn(state, cardId, roll) { /* returns next state */ }
function checkVictory(state) { /* returns state with phase: 'gameOver' if so */ }
```

**`shell.js`** (your current file, trimmed) — owns the `Mesh` objects, the `Map<cardId, Mesh>` lookup, animation, pointer handling, and the physics dice. It calls into core for *decisions*, then plays whatever visual sequence it wants to represent that decision — the visual sequence no longer *is* the decision.

```js
async function onDrop(cardId) {
  const roll = rollAttack(rng);                 // core decides, instantly
  await playDiceAnimation(roll);                 // shell just performs it
  gameState = attackWithCard(gameState, cardId, roll); // core commits
  syncMeshesToState(gameState);                  // shell re-layouts
}
```

Your existing `allowedTransitions` map moves into `core.js` almost unchanged — it's already exactly the right shape for this. `layoutHand`/`layoutBattlefield`/`moveCard`/`stageAttackCard`/the whole dice-physics simulation stay in the shell verbatim.

## Payoff for a project this size

- `runAiTurn` and `attackCard` currently duplicate the roll→threshold→success logic with slightly different variable names (`playerTokens` vs `opponentTokens`, `battlefield` vs `opponentBattlefield`). Once both go through one `resolveAttack(state, side, cardId, roll)` core function, that duplication disappears and player/AI symmetry bugs (the kind where you fix one path and forget the other) stop being possible.
- You get "what would happen if—" for free, which is what you'd want for a smarter AI later (currently it just grabs `deck.pop()` and rolls — a core-level `evaluate(state)` could let it actually pick the best card).
- Undo/replay/save-game become "keep an array of core states," not a redesign.

Want me to actually draft `core.js` against your real `CARD_DATA`/rules (I'd need to see how card values map to attack thresholds beyond what's in `attackCard`), or is this enough to run with yourself first?