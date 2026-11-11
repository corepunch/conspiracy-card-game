# Inspirations & References

*The Hidden Archive* borrows ideas from earlier card and board games. This file lists each source, the mechanic we took and how it was adapted. It also lists what we deliberately avoided. Rules are in [RULES.md](./RULES.md); the numbers behind each change are in [PLAYTEST.md](./PLAYTEST.md).

> Note: most links below were gathered via web search during the v2 redesign (November 2026). The official Steve Jackson Games rule pages could not be fetched directly from the research environment, so a few details (e.g. INWO's automatic failure on 11–12) come from secondary summaries.

---

## Conspiracy-themed ancestors

### Illuminati (Steve Jackson Games, 1982)
- **Mechanic:** to take control of a group, roll 2d6 and succeed on a total at or below *attacker Power − target Resistance*. Money spent from treasuries adds to the attack, and the defender can spend money to resist.
- **What we took:** the **takeover roll**, 2d6 ≤ 5 + Power − Resistance, which is the game's signature dice moment. Spending Influence to raise the odds became **+1 per 2 Influence**. We also added a **bribe** equal to the target's cost.
- **References:**
  - Board game rules summary: https://lehi-innovation.github.io/boardgame-rules/rules/illuminati/
  - Overview: https://en.wikipedia.org/wiki/Illuminati_(game)
  - Official rules (v4.0, PDF): https://www.sjgames.com/illuminati/Illuminati-Rules.pdf

### Illuminati: New World Order — INWO (Steve Jackson Games CCG, 1994–95)
- **Mechanic:** attacks use the same Power − Resistance roll, with **+4 for each shared alignment and −4 for each opposed one**. You win by controlling a set number of groups or by meeting a secret Goal.
- **What we took:**
  - **Kindred +2 / opposed −2** between the four spheres (State ↔ Fringe, Capital ↔ Occult).
  - The **domination** win: start your turn with 7 groups.
- **What we avoided:** players' most common complaint was that groups change hands so often nobody remembers whose cards are whose, and games ran 3–4 hours. Our fixes:
  - **one takeover per turn**;
  - a group that has changed sides becomes **Loyal** ("turned") and can't change again;
  - games last about 8 turns each.
- **References:**
  - Attacks: https://www.sjgames.com/sjgames/inwo/rules/b/Attacks.html
  - Actions: https://www.sjgames.com/sjgames/inwo/rules/b/Actions.html
  - Rules update: https://www.sjgames.com/sjgames/inwo/rules/b/Rules_Update.html
  - Overview: https://en.wikipedia.org/wiki/Illuminati:_New_World_Order
  - Fan digital edition: https://github.com/Cha0smagick/Virtual-Illuminati-New-World-order-INWO-game

### Magic: The Gathering — *Conspiracy* (2014) and *Conspiracy: Take the Crown* (2016)
- **Mechanics:**
  - **The Monarch:** the holder draws a card at end of turn, and combat damage to the holder steals the title.
  - **"Will of the council"** voting.
  - **Hidden Agenda** cards.
- **What we took:**
  - **The Narrative** is the Monarch. In our two-player game it starts with the *second* player as their compensation for going second.
  - **Referendums** use the voting idea: each side votes with the number of groups it controls.
  - Hidden Agendas are noted as a future idea (see PLAYTEST.md).
- **References:**
  - Monarch: https://mtg.wiki/page/Monarch
  - Conspiracy cards: https://mtg.wiki/page/Conspiracies
  - Voting: https://draftsim.com/mtg-will-of-the-council/

## Mechanics from other card games

### Android: Netrunner (Fantasy Flight Games)
- **Mechanics:**
  - **Tags**: a tagged player becomes vulnerable to stronger punishment.
  - Cards **installed face-down**, so a trap and an agenda look the same.
  - Traces bid in the open.
- **What we took:**
  - **Exposed** works like a tag. It removes Covert, gives +2 to takeover rolls, and enables "archive target Exposed group" removal.
  - Bluffing through face-down **Countermeasures**.
- **References:**
  - https://www.fantasyflightgames.com/en/ffg_blog/23123/original_content
  - https://ultraboardgames.com/android-netrunner/traces-and-tags.php
  - https://lehi-innovation.github.io/boardgame-rules/rules/android-netrunner/

### Disney Lorcana (Ravensburger)
- **Mechanic:** the **inkwell**. Once per turn you put a card face-down as a permanent resource, so every turn you choose between keeping a card and investing it.
- **What we took:** **Fronts.** Once per turn, any card goes face-down into your Fronts for +1 Influence every turn.
  - In Lorcana only some cards can be inked; in our game every card can become a Front. This keeps the rules simpler and means a player can never be stuck without resources.
- **References:**
  - Quick-start rules (PDF): https://files.disneylorcana.com/S3_Quick_Start_Book_EN.pdf
  - Mechanics discussion: https://www.coolstuffinc.com/a/stefendelgado-seo-02022026-six-mechanics-that-would-make-lorcana-more-skill-testing

### Hearthstone (Blizzard)
- **Mechanics:**
  - The attacker chooses its target.
  - Damage stays on minions.
  - **Taunt** forces attacks onto certain minions.
  - **Secrets** are face-down traps that trigger automatically.
- **What we took:**
  - The **strike** combat model: the attacker picks the target and damage persists.
  - **Firewall**, which works like Taunt but does not stop takeovers.
  - **Countermeasures**, which work like Secrets. They give the defender something to do on the opponent's turn without reaction prompts, which is important for a browser UI.
- **Reference:** https://www.hearthstonetopdecks.com/the-hearthstone-players-guide-to-marvel-snap/ (comparison article)

## Dice in card games

### Star Wars: Destiny (Fantasy Flight Games, 2016–2020)
- **Mechanic:** custom dice, plus card effects that **reroll or set dice faces**, so players can control the randomness.
- **What we took:** **Plausible deniability.** After a failed takeover you may discard a card to reroll both dice once. This kept the dice dramatic without making them pure luck.
- **References:**
  - https://www.d20radio.com/main/star-wars-destiny-dice-control-part-2-dice-manipulation/
  - https://techraptor.net/tabletop/news/fantasy-flight-shuts-down-star-wars-destiny

### Dice Throne (Roxley)
- **Mechanic:** Yahtzee-style rerolls, with a resource (Combat Points) spent on cards that modify the dice.
- **What we took:** the idea that spending resources should shift the odds. It is expressed as the **Influence stepper** in the takeover dialog, with live success odds.
- **Reference:** https://opinionatedgamers.com/2022/09/21/dale-yu-review-of-marvel-dice-throne/

### Marvel Dice Masters (WizKids)
- **Lesson:** reviewers found it heavily luck-driven. That is why our dice are used only at specific moments (takeovers and a few "roll a die" effects), while ordinary combat is deterministic.
- **Reference:** https://www.miniaturemarket.com/reviewcorner/marvel-dice-masters-review/

## Looked at, not used (yet)

| Game | Idea | Status |
|---|---|---|
| Marvel Snap | "Snap" to double the stakes; locations that change the rules | Not used; possible ranked-mode idea |
| KeyForge | Choose one of your deck's three houses each turn | Not used; a possible variant for two-sphere decks |
| Deep State: New World Order | Drafting with hidden treaties | Lesson: reviewers called it low on interaction, so we avoided hiding everything |
| SJG *Conspiracy Theory* (2017), *It's Just A Theory* (2017) | Humorous theory-building party games | Tone reference only |
| Cabals (online CCG) | Territory control with cards | Not used |
| Cloaked Cryptids | Hidden-identity sabotage | Not used; could feed a future Hidden Agenda mode |

**References:**
- Marvel Snap: https://www.hearthstonetopdecks.com/the-hearthstone-players-guide-to-marvel-snap/
- KeyForge: https://archonarcana.com/Rules
- Deep State: New World Order: https://www.meeplemountain.com/reviews/deep-state-new-world-order/
- SJG *Conspiracy Theory*: https://www.sjgames.com/ill/archive/September_14_2017
- *It's Just A Theory*: https://www.backerkit.com/projects/laughinglizardgames/its-just-a-theory-the-conspiracy-themed-card-game
- Conspiracy (Urban Games): https://icv2.com/print/article/38602
- Cabals: https://pcgamer.com/cabals-the-fascinating-mess-of-a-card-game-that-nobody-played
- Cloaked Cryptids: https://www.pledgebox.com/projects/cloaked-cryptidstm-the-card-game-0
