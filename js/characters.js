/**
 * Character definitions: unlock cost, damage multiplier, weapon visual type.
 */
export const WEAPON = {
  GUN: "gun",
  PLASMA: "plasma",
  /** Small toxic orbs (Toxor). */
  TOXIC_PLASMA: "toxic_plasma",
  MECHA_GUN: "mecha_gun",
};

/**
 * shotLifeFraction = fraction of zombie max HP removed per projectile (0.1 = 10%).
 * Dual plasma/toxic: each projectile uses half the character’s total % so one trigger matches the total.
 */
export const CHARACTERS = [
  { id: "bob", name: "Bob", cost: 0, weapon: WEAPON.GUN, desc: "Balanced rookie", shotLifeFraction: 0.1 },
  { id: "marcus", name: "Marcus", cost: 0, weapon: WEAPON.GUN, desc: "Steady aim", shotLifeFraction: 0.1 },
  { id: "taylor", name: "Taylor", cost: 0, weapon: WEAPON.GUN, desc: "Quick trigger", shotLifeFraction: 0.1 },
  { id: "rox", name: "Rox", cost: 25, weapon: WEAPON.PLASMA, desc: "Big sword, plasma", shotLifeFraction: 0.1 },
  { id: "lil_tommy", name: "L'il Tommy", cost: 50, weapon: WEAPON.MECHA_GUN, desc: "Mecha suit", shotLifeFraction: 0.25 },
  { id: "toxor", name: "Toxor", cost: 75, weapon: WEAPON.TOXIC_PLASMA, desc: "Toxic suit", shotLifeFraction: 0.175 },
  { id: "nova", name: "Nova", cost: 125, weapon: WEAPON.PLASMA, desc: "Energy blades", shotLifeFraction: 0.12 },
  { id: "shadow", name: "Shadow", cost: 150, weapon: WEAPON.GUN, desc: "Dual RPGs", shotLifeFraction: 0.18 },
  { id: "titan", name: "Titan", cost: 200, weapon: WEAPON.MECHA_GUN, desc: "Max power", shotLifeFraction: 0.3 },
];

export function getCharacter(id) {
  let normalized = id === "blaze" ? "toxor" : id;
  if (normalized === "iron_v") normalized = "shadow";
  return CHARACTERS.find((c) => c.id === normalized) || CHARACTERS[0];
}
