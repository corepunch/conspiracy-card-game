# The Hidden Archive

A no-build Three.js conspiracy card game. This prototype now contains a complete two-player match against a simple AI: Influence tokens, income, dice-based control attempts, turn sequencing, an archive pile, and victory detection.

## Play

Double-click `serve.command`, or run:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Opening `index.html` directly will not work because browsers block its local textures.

Read [RULES.md](./RULES.md) for setup, turn order, control attempts, the AI, and the differences between this adaptation and the published *Illuminati* rules.

## Technology

- Browser-native JavaScript and CSS
- Three.js loaded from a CDN
- No package manager, bundler, or compilation step

## Controls

- Drag a dossier onto the field to make a control attempt.
- Click or tap a card to inspect it; click or tap again to close it.
- Select **Finish Turn** to let the Cabal act.
- Press **R** to reset and reshuffle.

## Status

Implemented: a shuffled 64-card deck, hand and field layout, Influence economy, 2d6 attacks, turn flow, simple AI, archive tracking, and seven-group victory.

Future work: card-specific Power/Resistance/Income, alignments and effects, attacks on rival groups, branching power structures, negotiation, multiplayer networking, accounts, and matchmaking.

## License

No license has been selected. The source code and assets remain all rights reserved.
