# Ki Fighter — Invisible Items & Dojo Quest (v1)

## Implemented gameplay
- The outdoor dojo stays at its existing world coordinates. No teleport, scene change, collision or quest marker relocation.
- Master Sora has a consistent four-frame pixel-art NPC asset and introduces **Trial of Discipline** once the Cedar Seal is restored.
- Speak to Sora to accept the quest; defeat three named dojo challengers in the outdoor courtyard; return to Sora to claim **Training Weights**, **Cedar Token**, and quest XP. This is an explicit accept → combat progress → turn-in → reward loop.
- Open **Items [I]** (on-screen button on mobile, I key on desktop) to see inventory, equip or unequip equipment, and inspect active movement/XP percentages.
- Items affect stats only. **They do not change the visible fighter sprite.**
- Inventory, equipped items and quest stage are persisted in the existing localStorage journey save, schema v3; old saves remain loadable.
- Combat XP and scripted XP rewards pass through the same XP modifier function; equipped training weights affect movement and experience earned. Equipment slots are exclusive: one training item, one charm.
- Fixed first-clear drops: ridge → Wind Charm; northern watch → Scholar Charm; third dojo disciple → Iron Weights. No random drop-rate ambiguity in this first iteration.

## Item balance (initial, subject to playtesting)
| Item | Slot | Movement | XP | Acquisition |
|---|---|---:|---:|---|
| Training Weights | Training | 80% | 130% | Master Sora quest turn-in |
| Iron Weights | Training | 67% | 155% | Third dojo challenger |
| Wind Charm | Charm | 112% | 100% | Ridge encounter |
| Scholar Charm | Charm | 100% | 112% | Northern watch |
| Cedar Token | Quest | 100% | 100% | Master Sora quest turn-in |

Multipliers combine across slots; movement is clamped between 55% and 150% and XP multiplier at 180%. XP is calculated on earning, not retroactively; equipping and unequipping are free. Items cannot be equipped without owning them.

## Influences
- Dragon Ball Z: Kakarot uses quest-acquired Soul Emblems for bonuses and Training Grounds for attack upgrades (Bandai Namco official: https://en.bandainamcoent.eu/dragon-ball/news/dragon-ball-z-kakarot-new-rpg-mechanics).
- Terraria accessories provide a well-understood model for movement modifiers and slot-limited equipment (official wiki: https://terraria.wiki.gg/wiki/Movement_accessories).
- Ki Fighter's speed-for-XP weights are **our own tradeoff design**, not claimed to be a feature of those games.

## Next iteration
- Character-bound equipment vs shared party inventory (currently shared inventory and active fighter's XP).
- Unlockable weight tiers from progressively harder quests rather than immediate upgrades.
- Item pickups in the world, rarity, optional drops, consumables, and item comparison UI.
- More distinct dojo challenger behaviors and stronger NPC animation.
- Browser-based visual QA for dojo, inventory on mobile, save reload and speed/XP effects.

## Regression requirements
- Equipping weights must reduce movement for all movement modes without affecting hitbox or sprite scale.
- XP modifiers must apply exactly once per award, and must not double-grant quest rewards on save/reload.
- Opening inventory must not affect beam/attack input or character rendering.
- Old v2 saves must still load; invalid item IDs must be ignored.
- Trial rewards are only claimable after all three challengers are defeated and the player returns to Sora.
