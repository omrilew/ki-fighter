# Your own sound files

The game synthesises all music and effects by default. To use your own
recordings instead, put the files in this folder (e.g. `sfx/` and `music/`)
and list them in `audio.json`; paths are relative to this folder.

```json
{
  "sfx": {
    "kiBlast": "sfx/ki-blast.mp3",
    "charge": "sfx/charge.mp3",
    "beam": "sfx/beam.mp3",
    "transform": "sfx/transform.mp3",
    "punch": "sfx/punch.mp3",
    "kick": "sfx/kick.mp3",
    "hurt": "sfx/hurt.mp3"
  },
  "music": {
    "village": "music/village.mp3",
    "coast": "music/coast.mp3",
    "ravine": "music/ravine.mp3",
    "ridge": "music/ridge.mp3",
    "battle": "music/battle.mp3"
  }
}
```

Effect names: blip, select, confirm, quest, pickup, portal, door, punch, kick,
kiBlast, charge, beam, hurt, levelUp, transform, denied.
Music tracks loop. Anything not listed keeps the built-in sound.

This repository is published on GitHub Pages, so files committed here are
public. Keep recordings you don't have the rights to share out of the repo.
