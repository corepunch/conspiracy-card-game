# The Hidden Archive

A no-build Three.js trading card game about rival conspiracies. You lead one of four factions against a computer opponent:

- **The Deep State**
- **The Consortium**
- **The Illuminati**
- **The Fringe**

You recruit groups, set up Fronts, run operations and spring face-down countermeasures. The 2d6 takeover roll from Steve Jackson's *Illuminati* lets you steal enemy groups. The dice are physically thrown across the table.

## Play

Double-click `serve.command`, or run:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Opening `index.html` directly will not work, because browsers block its local textures.

- [RULES.md](./RULES.md): the complete rules, plus where each mechanic was borrowed from.
- [PLAYTEST.md](./PLAYTEST.md): research, simulation results and every rules iteration.
- [INSPIRATIONS.md](./INSPIRATIONS.md): the games we borrowed from, what we took from each, and links.

## Controls

| Action | How |
|---|---|
| Set up a Front (+1 Influence every turn, once per turn) | Drag a hand card onto **Your Fronts** (bottom left) |
| Play a card | Drag a hand card onto the field. If it needs a target, click a glowing card. |
| Strike or take over | Click a ready group (green glow), choose **Strike** or **Takeover**, then click a glowing target. Use **Hit Conspiracy**, or click the enemy panel, to strike the enemy directly. |
| Inspect a card | Click it; click again to close |
| End your turn | **End Turn** |
| Game log | **L** or the ≡ button |
| New game | **R** |

## Code layout

| File | Role |
|---|---|
| `core.js` | Rules engine. Pure, data-only state; the same code runs in the browser and in Node. |
| `ai.js` | Greedy one-ply AI that weighs dice outcomes by probability. |
| `cards.js` | 256 cards: sphere, type, cost, Power/Resistance, keywords, effects and flavour. Index order matches `assets/cards.webp`. |
| `game.js` | Three.js table: rendering, input, physical dice and AI pacing. |
| `tools/simulate.js` | Headless AI-vs-AI balance testing. |
| `tools/gen-cards.js` | Generator that produced the first pass of v2 card stats. |

## Technology

- Browser-native JavaScript and CSS.
- Three.js, loaded from a CDN.
- No package manager, bundler or compilation step. Node is needed only for `tools/`.

## License

No license has been selected. The source code and assets remain all rights reserved.
