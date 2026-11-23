# Campaign cast

The cast manifest holds stable IDs for 44 named characters across the Earth opening, Saiyan, Namek, Android and Cell, and Majin arcs. Bulma and Piccolo have four-direction idle, walk, and talk clips. Raditz has those clips and a first pass of telegraph, attack, recovery, hurt, and knockdown poses. Goku keeps the production hero art. The remaining named characters are marked `planned` in the manifest. Opponent behavior and combat balance belong to the encounter.

Four original civilian appearances support incidental NPCs. `makeExtra(areaSeed, index)` returns a stable ID, name, role, appearance, and facing. Area files own coordinates, dialogue, and encounter setup.

The atlas contains transparent 64 × 96 cells. Load `campaign-cast.js`, use `KFCampaignCast.getSprite(id)`, and call `resolveFrame(sprite, direction, action, elapsedMs)` to get the crop rectangle and foot, center, hand, and effect attachment points. The source rectangles already encode facing. The preview sheet shows the available idle designs.

## Art workflow

1. Look up the character in `campaign-cast.js` and use the official profile to identify recognizable colors and silhouette cues. The atlas is independently drawn with hard-edge pixels.
2. Update the authored layers in `scripts/build-campaign-cast.py` and the sprite layout in `campaign-cast.js`. Align the anchors with the artwork and check every facing on the contact sheet and at game size.
3. Run `python scripts/build-campaign-cast.py` and `node --test tests/campaign-cast.test.cjs`. The generator requires Pillow and Node.js. It checks transparent padding and adjacent animation frames before saving the atlas and preview.

Opening character references [Bulma](https://en.dragon-ball-official.com/news/01_3933.html), [Piccolo](https://en.dragon-ball-official.com/news/01_1178.html), and [Raditz and the Saiyan arrival](https://en.dragon-ball-official.com/news/01_4584.html).
