# The Hidden Archive — Rules (v2)

A two-player trading card game about rival conspiracies. It plays like Magic: The Gathering or Hearthstone: you recruit groups, run operations and attack. It keeps the 2d6 **takeover** roll from Steve Jackson's *Illuminati*, so you can steal the enemy's groups, not only destroy them.

A game takes about 8 turns each, roughly 15–20 minutes.

---

## 1. Winning

You win the moment either of these happens:

- **Blow their cover.** The enemy conspiracy's **Secrecy** drops from 20 to 0.
- **World domination.** You begin your turn controlling **7 groups**.

If both players hit 0 Secrecy at the same moment, the player whose turn it is wins.

## 2. The four conspiracies

Every card belongs to one of four **spheres**. Each prebuilt deck is 40 different cards from a single sphere.

| Faction | Sphere | Plays like | Opposed sphere |
|---|---|---|---|
| **The Deep State** | The State | Firewalls, Expose-then-arrest removal, Detain, healing | The Fringe |
| **The Consortium** | Capital | Network ramp, card draw, buy-outs, big Firewall bodies | The Occult |
| **The Illuminati** | The Occult | Covert groups, Secrecy leaks every turn, Subvert takeovers, recursion | Capital |
| **The Fringe** | The Fringe | Haste, Pierce, burn, dice-driven chaos damage | The State |

## 3. Setup

1. Each player shuffles their 40-card deck and draws **5 cards**. Both start at **20 Secrecy**.
2. Pick a first player at random. The first player skips their draw on their first turn.
3. **The Narrative** begins with the *second* player (see §8). This makes up for moving second.
4. **Mulligan.** Once, before your first action, you may shuffle your hand into your deck and draw the same number of cards.

## 4. Card types

- **Group.** A creature with **Power / Resistance**. It stays in play and can Strike or attempt Takeovers. Damage on a group **stays** until the group leaves play, as in Hearthstone. A group is archived when its damage reaches its Resistance.
- **Operation.** A one-shot effect, after which it goes to your Archive.
- **Referendum.** Each side votes with the number of groups it controls. If you have *more* groups, the strong effect happens. Otherwise you get the consolation effect.
- **Asset.** A permanent with an ongoing ("Each turn") or static effect. It takes a field slot but can't be attacked.
- **Countermeasure.** A trap, set face-down (limit 2). It springs automatically on a specific enemy action, then goes to the Archive (§9).

## 5. Zones

**Deck · Hand** (limit 10; a card drawn past the limit is archived) **· Fronts** (face-down resources) **· Field** (groups and assets, limit 7) **· Countermeasures** (face-down, limit 2) **· Archive** (discard pile).

## 6. Turn sequence

1. **Ready.** Your groups ready. A group that is *Detained* stays exhausted this turn instead.
2. **Influence.** Gain 1 Influence per Front, plus 1 per **Network** group you control. Unspent Influence is lost at the end of the turn.
3. **Draw** one card. If your deck is empty, you leak 2 Secrecy instead.
4. **"Each turn" effects** of your groups and assets resolve.
5. **Main phase.** Do any of the following, in any order:
   - **Set up a Front** (once per turn). Put any card from your hand face-down into your Fronts. It gives +1 Influence immediately and every turn after. *Every card is a potential resource, so you can't be stuck without one; the cost is the card you give up.*
   - **Play cards** by paying their cost in Influence.
   - **Act with groups.** Each ready group may act **once**: a Strike or a Takeover. A newly recruited group can't act until your next turn unless it has **Haste**.
6. **End.** "This turn" bonuses expire. If you hold **The Narrative**, draw a card.

## 7. Strikes and takeovers

### Strike
- **Strike a group.** Both groups deal damage equal to their Power to each other at the same time.
- **Strike the conspiracy.** The enemy leaks Secrecy equal to your group's Power.
- **Firewall.** While the enemy controls a targetable Firewall group, your strikes must target a Firewall group. Takeovers ignore Firewall.

### Takeover (the 2d6 roll)
Exhaust your group and choose an enemy group to take over.

1. **Bribe.** Pay Influence equal to the target's printed cost.
2. **Target number** = **5 + your group's Power − the target's Resistance**, then apply these modifiers:
   - +2 if both cards share a sphere (*kindred*); −2 if the spheres are opposed.
   - +2 if the target is **Exposed**.
   - +2 if your group has **Subvert**.
   - Any bonus from assets.
   - +1 for every **2 extra Influence** you choose to spend.
3. Roll **2d6**. If the total is **equal to or below** the target number, the group joins your side. It arrives exhausted, and it becomes **Loyal** ("turned"), so it can't change sides again. The number is capped at 10, so **11–12 always fails**.
4. **Plausible deniability.** If the roll fails, you may discard one card from your hand to reroll both dice once.
5. If it still fails, your group becomes **Exposed**.

You can attempt only **one takeover per turn**. Loyal groups can't be taken over. Your field must have a free slot.

| Target number | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| Chance | 3% | 8% | 17% | 28% | 42% | 58% | 72% | 83% | 92% |

## 8. The Narrative

The Narrative works like the Monarch in MTG's *Conspiracy* sets.

- At the end of each of your turns while you hold it, **draw a card**.
- If any of your groups deals damage to the holder's conspiracy, **you seize it**.
- The second player starts with it, so the first player has to hit back to take it.

## 9. Countermeasures

Play a countermeasure by paying its cost. It is set face-down and the enemy sees only that you have one. It springs on the first enemy action of its kind, then goes to the Archive:

| Trigger | Example effects |
|---|---|
| The enemy attempts a takeover | the takeover fails and the attacker is Exposed · the attacker defects to you · you regain 2 Secrecy |
| An enemy group strikes your conspiracy | stop the strike and Detain the group · stop it and the enemy leaks 3 · return the group to its owner's hand |
| The enemy recruits a group | deal 2–3 damage to it · roll a die for damage · archive it if it costs 3 or less |
| The enemy runs an operation | cancel the operation |

## 10. Keywords and statuses

| Keyword | Meaning |
|---|---|
| **Haste** | Can act the turn it arrives. |
| **Firewall** | Enemy strikes must target a Firewall group. |
| **Covert** | Can't be targeted by the enemy (strikes, takeovers, effects) unless Exposed. |
| **Pierce** | When it strikes a group, damage beyond the group's remaining Resistance leaks to the enemy conspiracy. |
| **Expose** | Groups it damages in a strike become Exposed. |
| **Fortify** | Takes 1 less damage from each source. |
| **Network** | +1 Influence every turn. |
| **Loyal** | Can't be taken over. |
| **Subvert** | +2 to its takeover rolls. |

**Exposed** is a lasting status, like a Netrunner tag. An Exposed group:
- loses the protection of Covert;
- gives +2 to takeover rolls against it;
- can be hit by "archive target Exposed group" effects.

**Detained** groups don't ready on their controller's next turn.

## 11. Dice in the client

In the browser, takeovers and "roll a die" effects throw physical dice across the table. The number shown face-up is the result. In `tools/simulate.js` the same rules engine uses a seeded RNG.

---

## Design notes: where the ideas come from

| Idea | Taken from | Why it's here |
|---|---|---|
| Takeover: 2d6 ≤ Power − Resistance, with bribes | *Illuminati* (1982) and *INWO* (1994) | The signature conspiracy moment: you steal a group instead of killing it. |
| Kindred +2 / opposed −2 | INWO alignments (±4 there) | Gives matchups their own texture. |
| Fronts: any card as a face-down resource, once per turn | Lorcana's inkwell | No mana screw, and a real "spend it or keep it" choice every turn. |
| The Narrative | MTG *Conspiracy*'s Monarch | Rewards aggression, catches up the second player, and changed hands about 4.8 times per simulated game. |
| Exposed | Netrunner tags | Sets up later payoffs instead of being just a debuff. |
| Countermeasures | Hearthstone Secrets, Netrunner face-down installs | Interaction on the opponent's turn without reaction prompts, plus bluffing. |
| Discard to reroll | Star Wars Destiny / Dice Throne dice control | You can pay to manage dice luck. |
| Referendum (vote by groups) | MTG "Will of the council" | Built for two players: your groups are your votes. |
| One takeover per turn; turned groups become Loyal | Fix for INWO's main complaint | Stops groups passing back and forth until nobody remembers who owns what. |
