# The Hidden Archive

**An online conspiracy card game where every player is building a secret network.**

The Hidden Archive is a browser-based multiplayer game for investigators, manipulators, and professional bluffers. Create an account, enter the Archive, find other players, and compete to assemble the most powerful conspiracy before your rivals expose it.

The long-term goal is a persistent online world with public tables, private games, friends, rankings, player profiles, and recurring events. The current version is an early Three.js tabletop prototype focused on the deck, hand, battlefield, drawing, and card movement.

## Play

The prototype is designed for static hosting and has no build step. Once GitHub Pages is enabled, the game will be available at:

`https://<username>.github.io/<repository>/`

For local development, double-click `serve.command` and open [http://localhost:8080](http://localhost:8080), or run:

```sh
python3 -m http.server 8080
```

## Multiplayer vision

Players will be able to:

- Create an investigator account and persistent profile.
- Find open public tables or create a private game.
- Invite friends with a room code or direct invitation.
- Play casual or ranked matches with two to six players.
- Reconnect to a game after temporarily losing connection.
- Earn titles, card backs, profile cosmetics, and seasonal ranking.
- Review completed games and rematch the same table.

The client deliberately uses plain browser technology and Three.js from a CDN—no Node.js, npm, bundler, or build pipeline. A future Appwrite or Supabase backend will handle accounts, matchmaking, rooms, authoritative game state, and realtime events.

## Proposed rules: The Gathering

The Gathering is a poker-inspired mode for **2–6 players**. It combines a shared table, hidden hands, betting pressure, bluffing, folding, and a final reveal.

These rules are an initial design and will evolve through playtesting.

### Objective

Win rounds to collect **Influence**. The first player to reach **20 Influence** wins the match. If more than one player reaches 20 during the same round, the player with the strongest revealed network wins.

### Setup

- Use one shuffled 64-card Dossier deck.
- Each player begins with **10 Influence**.
- Deal **five hidden cards** to every player.
- Choose the first Dealer randomly. The Dealer marker moves clockwise after every round.
- The two players after the Dealer post a mandatory **1 Influence Lead** and **2 Influence Exposure**. With two players, the Dealer posts the Lead.

The mandatory stakes ensure that every round has something worth contesting, like blinds in poker.

### A round

Each round has five phases:

1. **Opening** — reveal one shared Dossier in the center of the table.
2. **First inquiry** — beginning after the Exposure player, players take one betting action in clockwise order.
3. **Evidence** — reveal a second shared Dossier. Every active player may secretly replace one card from their hand.
4. **Final inquiry** — conduct another clockwise betting round.
5. **The reveal** — remaining players reveal three cards from their hand and form a network with one of the two shared Dossiers.

All committed Influence goes into the center as the **Pot**. The round winner collects it.

### Player actions

During an inquiry, a player may:

- **Check** — commit nothing when no wager is waiting.
- **Commit** — make the first wager for the inquiry.
- **Match** — commit enough Influence to equal the current wager.
- **Escalate** — match the wager and increase it.
- **Fold** — abandon the round and keep all uncommitted Influence.

A player whose entire Influence supply is committed is **All In**. They remain eligible for the part of the pot they matched. Additional wagers create side pots, following ordinary poker rules.

### Building a network

A revealed network contains **four cards**: three cards from the player's hand plus one shared Dossier. Networks are ranked from strongest to weakest:

1. **New World Order** — four cards from one faction or theme, including its defining card.
2. **Perfect Conspiracy** — four cards from the same faction or theme.
3. **Inner Circle** — three cards from one faction or theme.
4. **Chain of Evidence** — four consecutive card values.
5. **Two Connections** — two different matching-value pairs.
6. **A Connection** — two cards with the same value.
7. **Loose Theory** — no combination; compare total card value.

When networks share a rank, compare the total printed value of all four cards. If still tied, compare the highest individual card, then split the pot if necessary.

Card factions and themes still need to be finalized and visibly marked on the cards before this ruleset becomes playable.

### Elimination and victory

A player with no Influence cannot post the next round's mandatory stake and is eliminated. The match ends when either:

- One player remains, or
- A player reaches 20 Influence at the end of a round.

For a friendlier casual mode, eliminated players may re-enter once with 10 Influence before the Dealer completes a full rotation.

## Current controls

- Drag a card from your hand onto the battlefield.
- Drop it outside the battlefield to return it to your hand.
- Click the Dossier pile or press `D` to draw.
- Press `R` to reset and reshuffle.

## Project status

Implemented:

- Three.js tabletop and perspective camera.
- A shuffled 64-card deck and fanned hand.
- Drawing and drag-and-drop battlefield placement.
- Responsive interface using the existing card and table artwork.
- Static deployment through GitHub Pages.

Planned:

- Complete card metadata, factions, themes, and effects.
- Turn sequencing and rules validation.
- Accounts and investigator profiles.
- Realtime rooms, public matchmaking, and private invitations.
- Two-to-six-player table layout and spectator support.
- Reconnection, match history, rankings, and moderation tools.

## GitHub Pages deployment

No build workflow is required:

1. Open **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the branch containing the game and the `/ (root)` folder.
4. Save and wait for GitHub to publish the site.

All scripts, fonts, and image paths are relative, so deployment works from both a root domain and a repository subpath. The `.nojekyll` marker tells GitHub Pages to serve the project as ordinary static files.

## Technology

- HTML, CSS, and browser-native JavaScript
- Three.js loaded from a CDN
- Appwrite or Supabase planned for authentication and realtime multiplayer
- No Node.js, npm, bundler, or compilation step

## Contributing

The game is at the prototype stage. Feedback on multiplayer rules, network rankings, table pacing, accessibility, and card balance is especially useful. Open an issue with a concrete scenario or proposed rule change.

## License

No license has been selected yet. Until one is added, the source code and game assets remain all rights reserved.
