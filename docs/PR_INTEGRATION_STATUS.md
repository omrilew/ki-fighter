# PR #1 integration status

This branch incorporates the current Cedar Village main-branch experience through a two-parent merge commit. The old Forest Trial world, separate Forest save and older RPG overlay have been replaced by the Cedar Village implementation to avoid regressions.

## Integrated
- Existing Cedar Village, Forest Guardian, Shrine, current HUD, title/pause/character/quest/map/settings/techniques menus.
- Goku, Piccolo and Gohan selection via Q, touch switch button and character profile.
- Separate level/XP/stats per fighter, shared Cedar quest state and backward-compatible Cedar save loading.
- Syntax/structural smoke workflow.

## Still required before merge
- Run actual desktop/mobile browser QA and validate saves, switching, dialogue, boss and quest progression.
- Character-specific pixel art, portraits and signature attacks are **not yet implemented**. The fighters still use the shared artwork and existing attacks.
- Review UI overlap on small devices; run GitHub Actions and fix any failures.
- This is a conflict-resolution/integration commit, **not a declaration that the DBZ milestone is complete**.
