/**
 * Bomb loadout for the shop — selected upgrade applies when you throw a bomb in-game.
 */

export const BOMB_UPGRADES = [
  {
    id: "normal",
    name: "Standard",
    cost: 0,
    desc:
      "Explosion deals 50% of each zombie’s max HP in the blast zone (may need two hits).",
  },
  {
    id: "freezer",
    name: "Freezer",
    cost: 25,
    desc:
      "Ice locks zombies in the blast zone: they don’t move or hit the wall for 30 sec, then thaw.",
  },
  {
    id: "tnt",
    name: "TNT",
    cost: 50,
    desc: "Classic blast: destroys every zombie caught in the explosion area.",
  },
  {
    id: "time_portal",
    name: "Time Portal",
    cost: 75,
    desc:
      "Slows movement and wall attacks by 75% (25% speed / hit rate) for 10 seconds, then normal.",
  },
  {
    id: "annihilator",
    name: "Annihilator",
    cost: 100,
    desc:
      "Wipes every zombie on your half of the battlefield (left or right of center, matching where the bomb lands).",
  },
];

export function getBombUpgrade(id) {
  return BOMB_UPGRADES.find((b) => b.id === id) || BOMB_UPGRADES[0];
}
