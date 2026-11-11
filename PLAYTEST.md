# Playtest & Iteration Log — v2 rules

This file records how the v2 rules were reached. Three kinds of testing went into it:

1. **Headless simulation.** `tools/simulate.js` plays AI against AI, 160–2,400 games per run, across all 16 faction pairings.
2. **Reading sessions.** Full game logs from `node tools/simulate.js N --log i`, read turn by turn the way a playtester would.
3. **Client runs.** Complete games driven through the real browser UI (Playwright, with the AI in both seats), plus scripted checks of drag-to-front, drag-to-target, strike, the takeover dialog, the reroll prompt and the mulligan.

The AI is a greedy one-ply searcher (`ai.js`). It plays reasonably but not expertly, so treat card-level numbers as a smoke test rather than proof. Faction-level numbers across thousands of games are much more reliable.

## Prior art (research summary)

| Game | Mechanic | Used? |
|---|---|---|
| *Illuminati* (1982) | 2d6 ≤ Power − Resistance to take control; spend money for +1 | **Yes.** It is the takeover roll, with a bribe. |
| *INWO* CCG (1994) | Alignment ±4 on attacks; win by controlling N groups | **Yes.** Kindred +2 / opposed −2 and the 7-group domination win. |
| INWO's weak spots | Groups swapping sides until ownership is confusing; 3–4 hour games | **Avoided.** One takeover per turn, turned groups become Loyal, about 8 turns each. |
| MTG *Conspiracy* | Monarch; "Will of the council" votes | **Yes.** The Narrative and Referendums. |
| Android: Netrunner | Tags; face-down installs and bluffing | **Yes.** Exposed and face-down Countermeasures. |
| Lorcana | Inkwell: put a card face-down as a resource once per turn | **Yes.** Fronts. In v2 every card can be a Front. |
| Hearthstone | Persistent damage, attacker chooses target, Taunt, Secrets | **Yes.** The combat model, Firewall and Countermeasures. |
| Star Wars Destiny / Dice Throne | Spend cards or resources to reroll and control dice luck | **Yes.** Discard a card to reroll a failed takeover. |
| Marvel Snap, KeyForge | Doubling the stakes; choosing a house each turn | Not used. They would complicate a first ruleset. |

## Iterations

### Iteration 1 — first v2 draft (160 games)
Rules: Fronts, Hearthstone-style strikes, and takeovers on 2d6 ≤ 5 + P − R at +1 per Influence spent.

| Metric | Value |
|---|---|
| Takeovers per game | **9.9**, with **92%** succeeding |
| Faction win rates | Fringe 70%, Occult **28%** |
| First player wins | 44% |

**Session read (Fringe vs Deep State):** one alien handler spent six Influence to steal a 4-drop at 72%, rerolled, and won. Every turn ended with a steal.

**Diagnosis:** a takeover is a two-card swing that the AI could buy at one Influence per +1. Stealing was strictly better than recruiting.

### Iteration 2 — costlier odds
Spend rate raised to 2 Influence per +1.

Result: still **9.4** takeovers per game at **80%**. The odds were not the problem; frequency and price were.

### Iteration 3 — bribes, one per turn, turned groups are Loyal
- Taking over a group costs its printed cost in Influence ("everyone has a price").
- The roll uses full Resistance instead of remaining Resistance. Striking a group and then stealing it had been an exploit.

Result: **6.4** takeovers per game.

**Session read:** *The Fourteenth Amendment Clause* changed hands three times in two turns. This is exactly INWO's ownership-confusion complaint.

Fix:
- At most one takeover per turn.
- A group that changes sides becomes **Loyal** ("turned").

Result: **3.1 takeovers per game, ~80% of those attempted succeed.** Takeovers became a deliberate, telegraphed play rather than a default.

### Iteration 4 — The Narrative and going second (800 games per variant)

| Variant | First player wins | Lead changes per game | Options per decision |
|---|---|---|---|
| No Narrative | 53.8% | 3.11 | 5.4 |
| "Open" (first face hit claims it) | 54.5% | 3.90 | 7.2 |
| **Second player starts with it** | **48.1%** | **3.84** | **7.7** |
| Open + extra card for player 2 | 48.3% | 4.09 | 7.5 |

**Chosen: the second player starts with it.** It fixes first-player advantage and makes games swingier. It also gives the first player an immediate goal: hit back to steal the Narrative. It changes hands about 4.8 times per game.

### Iteration 5 — faction stat budgets (800 games)
Fringe was still at 66% and Capital/Occult around 40%. Changes:
- Group budget is now 2 × cost + 1. Spheres get −0.5 (Fringe) or +0.5 (the others), applied probabilistically.
- Haste and Pierce cost 1.5 points.
- Damage-on-arrival costs 1 more point.

Result: every faction at **47–55%**.

### Iteration 6 — Countermeasures (800 games)
**Session reads:** in every log, the defending player did nothing at all on the opponent's turn. MTG instants are a big part of why that game is interesting, but reaction prompts are clumsy in a browser.

Added 12 face-down traps (three per sphere), modelled on Hearthstone Secrets and Netrunner bluffing. They spring automatically on a takeover, a strike to your face, an enemy recruit, or an enemy operation.

Result: factions at 44.7–53.3%. The decks gained bluffing and a way to answer the Fringe's face damage.

### Iteration 7 — card outliers and the mulligan (2,400 games)
Card-level results showed these problems:
- Referendums were too cheap. All now cost +1, and their "more groups" effect is smaller.
- 6-drops were too big. Budget −1 at cost 5 or more.
- Single-die damage operations were too weak. They now cost 1–2.
- Symmetric discard assets were bad. *Backmasked Message* now hits only the enemy.

Hand-tuned afterwards in `cards.js`:

| Card | Change |
|---|---|
| Opioid Distribution Chain | cost 5 |
| Dulce Base | 3/8 |
| Antarctic UFO Base | 4/7 |
| Cicada 3301 Puzzle | 4/4 |
| The Unseen Hand | 2/3 |
| Travis Walton Case | cost 3 |
| Inner Circle Compact | cost 1 |
| Grand Architects Guild | cost 2 |

**Session read (Illuminati vs Deep State):** the Illuminati's opening hand held only 3+ cost cards. They spent three turns setting up Fronts and took 14 damage before playing anything.

Fix: a **free mulligan**, once, before your first action. Its effect on aggregate win rates is neutral (it barely moves the numbers), but it prevents "non-games".

## Final numbers (v2, 1,200–2,400 games, all 16 pairings)

| Metric | Result | Target |
|---|---|---|
| First player wins | 48.5–50.8% | 47–53% |
| Faction overall win rates (non-mirror) | State 47–53%, Capital 49–51%, Occult 48–50%, Fringe 50–51% | 45–55% |
| Worst single matchup | 43–57% | within 60/40 |
| Game length | 15.9 turns total (~8 each); 10th–90th percentile 11–22 | 12–20 |
| Wins by domination (7 groups) | ~8–10% | a real but rare alternate route |
| Takeovers per game | 3.5 (~81% of those attempted succeed); rerolls 1.15 | 2–4 dramatic dice moments |
| Lead changes per game | 3.8 | ≥3 |
| Comebacks (player behind after turn 8 wins) | 31% | 25–35% |
| Legal options per decision | 8.0 | meaningful choice every step |

## Known weaknesses / next ideas
- **Referendums look win-more.** The AI casts them only when it controls more groups, so their "win rate when played" is inflated. A comeback twist, like MTG's *council's dilemma*, could help.
- **Hidden Agendas** (secret objective cards from MTG Conspiracy and INWO Goals) would add replay variety. They are not yet implemented.
- **The AI never bluffs Countermeasures** and doesn't play around them. A stronger AI (two-ply, or Monte Carlo) would make card-level balance more trustworthy.
- **Decks are prebuilt by sphere.** A deckbuilder or a draft mode is the natural next step for a TCG.

## Reproducing
```sh
node tools/simulate.js 800                 # faction matrix and headline metrics
node tools/simulate.js 2400 --cards        # plus strongest/weakest cards
node tools/simulate.js 10 --log 3          # print the full log of game 3
node tools/simulate.js 800 --rules '{"narrative":false}'   # test a rule variant
```
