# Character art

Draw full-body poses where the silhouette matters, especially kicks and strong perspective changes. Reuse parts where they stay aligned at game scale.

- **Motion and attacks** use named frames in `fighterFrames`. Each melee move pairs a frame with reach, arc, and impact timing. Hook and cross can share a pose while retaining different hit timing and coverage.
- **Hand gestures** use `standardHands`, with separate blast, gather, and release points for side, north, and south poses. A fighter can supply a `handRig` when their reach or stance differs. The hands and the effect source use the same anchor positions.
- **Forms** reuse the pose art. `makeFormArt` creates the selected hair treatment once when the atlas loads, and the aura is drawn separately. A future character can have a different hair treatment or a separate head layer without changing attack timing.
- **Texture size** follows the prop's size in the world. The large trees retain their full detail while small props use smaller rectangles in the shared atlas.

## Animation tracks

`animation.js` samples normalized keyframes for strikes, kicks, enemy lunges and throws, recoil, and falls. Each track names its channels, such as reach or opacity. Renderers apply those channels around the feet and reuse the same pose art and hand anchors.

Use an existing clip for a new fighter, or add a clip with the same channels and a new timing curve. An enemy can set `animationRig` to choose an attack clip and its reach multiplier. `actionPhase` maps the move's existing windup and recovery timings onto the visual clip, keeping contact and animation in sync.

Use `framesAt` with a sequence of `[normalizedTime, frame]` pairs when new artwork provides intermediate poses. The game uses this for the current walk, dash, and strike art. The pose track and sprite sequence share the same progress, so frame selection stays synchronized with impact timing and hand anchors.
