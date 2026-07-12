# The Hidden Archive — How to Play

The Hidden Archive is a two-player, browser-friendly adaptation of the core power-structure idea in Steve Jackson Games' *Illuminati*. You play **The Illuminati** against a simple computer opponent, **The Cabal**.

This is not a complete implementation of the published board game. The local 64-card deck has only a name and a single value; it has no separate Power, Resistance, Income, alignment arrows, special text, or Special cards. The rules below deliberately map that one value into a smaller playable game.

## Objective

Be the first conspiracy to control **7 groups**, counting your starting organization.

## Setup

- Each conspiracy starts with its own organization, 10 Influence tokens, and Power 2.
- You are dealt 5 dossiers. The remaining cards form the Dossier deck.
- The human player takes the first turn.

## Your turn

At the beginning of each turn after the first:

1. Collect **2 Influence**, plus 1 more for each complete set of 3 groups you control beyond your starting organization.
2. Draw one dossier, up to the 10-card hand limit.
3. Make up to one control attempt.
4. Select **Finish Turn**. The Cabal then takes its turn automatically.

You may finish a turn without attacking.

## Control attempts

Drag a dossier from your hand onto the highlighted battlefield.

- A control attempt costs **1 Influence**.
- Use the highest printed value among your controlled groups as your Power; your starting organization has Power 2.
- Calculate the target number as `7 + your Power − target value`, limited to the range 2–10.
- The game rolls two six-sided dice. If the total is at or below the target number, you control the group and add it to your field.
- On failure, the dossier goes to the Archive discard pile.
- You may make only one attempt per turn.

This means powerful high-value dossiers are useful once controlled, but are harder to acquire.

## The Cabal AI

The Cabal follows the same income, cost, dice, and victory rules. On its turn it draws the next dossier and attempts to control it if it can pay 1 Influence. It does not negotiate or save a card for later; this is intentionally a simple baseline opponent.

## Controls

- **Drag** a dossier onto the battlefield to attempt control.
- **Hover and scroll** to inspect a card.
- Select **Finish Turn** to hand play to the Cabal.
- Press **R** to shuffle and start a new game.

## Relationship to the published game

The official *Illuminati* game is a deeper multiplayer negotiation game. In the published rules, players collect group income, make up to two actions, build branching power structures, transfer money, and may attack groups to control, neutralize, or destroy them. Attacks can be aided or opposed by other players, alignments modify attacks, and each Illuminati has a special power and alternate goal. The box includes money tokens and two dice.

Those systems require metadata and table interactions that this deck does not contain. They are not silently invented here. Good future additions would be separate Power/Resistance/Income fields, alignments, treasury spending to aid attacks, attacks against enemy structures, and unique group abilities.

Official reference: [Steve Jackson Games, Illuminati Rules v4.0 (PDF)](https://www.sjgames.com/illuminati/Illuminati-Rules.pdf).
