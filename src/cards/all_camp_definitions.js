// All Radlands Camp Definitions
// Format: gameState.players.PLAYER.columns[COLUMN].setCard(0, { ... });

export const ALL_CAMPS = {
  railgun: {
    name: "railgun",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 2 }],
    isReady: true,
    isDamaged: false,
  },

  atomicGarden: {
    name: "atomicgarden",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "restoreready", cost: 2 }],
    isReady: true,
    isDamaged: false,
  },

  cannon: {
    name: "cannon",
    type: "camp",
    campDraw: 2,
    abilities: [{ effect: "damage", cost: 2 }],
    isReady: true,
    isDamaged: true, // Starts damaged
  },

  pillbox: {
    name: "pillbox",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 3 }], // Cost reduced by destroyed camps
    isReady: true,
    isDamaged: false,
  },

  scudLauncher: {
    name: "scudlauncher",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 1 }], // Opponent chooses target
    isReady: true,
    isDamaged: false,
  },

  victoryTotem: {
    name: "victorytotem",
    type: "camp",
    campDraw: 1,
    abilities: [
      { effect: "damage", cost: 2 },
      { effect: "raid", cost: 2 },
    ],
    isReady: true,
    isDamaged: false,
  },

  catapult: {
    name: "catapult",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 2 }], // Damage any, then destroy own person
    isReady: true,
    isDamaged: false,
  },

  nestOfSpies: {
    name: "nestofspies",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 1 }], // Requires 2+ people played
    isReady: true,
    isDamaged: false,
  },

  commandPost: {
    name: "commandpost",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 3 }], // Cost reduced by punks
    isReady: true,
    isDamaged: false,
  },

  obelisk: {
    name: "obelisk",
    type: "camp",
    campDraw: 1,
    abilities: [], // Win condition trait, no ability
    trait: "When the last card is drawn from the deck, you win.",
    isReady: true,
    isDamaged: false,
  },

  mercenarycamp: {
    name: "mercenarycamp",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "damagecamp", cost: 2 }], // Requires 4+ people
    isReady: true,
    isDamaged: false,
  },

  reactor: {
    name: "reactor",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "destroyall", cost: 2 }], // Destroy self and all people
    isReady: true,
    isDamaged: false,
  },

  theOctagon: {
    name: "theoctagon",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "destroy", cost: 1 }], // Destroy own, opponent destroys theirs
    isReady: true,
    isDamaged: false,
  },

  juggernaut: {
    name: "juggernaut",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "move", cost: 1 }],
    moveCount: 0,
    isReady: true,
    isDamaged: false,
  },

  scavengerCamp: {
    name: "scavengercamp",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "discardchoose", cost: 0 }], // Discard then water or punk
    isReady: true,
    isDamaged: false,
  },

  outpost: {
    name: "outpost",
    type: "camp",
    campDraw: 1,
    abilities: [
      { effect: "raid", cost: 2 },
      { effect: "restore", cost: 2 },
    ],
    isReady: true,
    isDamaged: false,
  },

  transplantLab: {
    name: "transplantlab",
    type: "camp",
    campDraw: 2,
    abilities: [{ effect: "restore", cost: 1 }], // Requires 2+ people played
    isReady: true,
    isDamaged: false,
  },

  resonator: {
    name: "resonator",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 1 }], // Must be only ability used
    isReady: true,
    isDamaged: false,
  },

  bonfire: {
    name: "bonfire",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "damagerestoremany", cost: 0 }],
    trait: "Cannot be restored",
    isReady: true,
    isDamaged: false,
  },

  cache: {
    name: "cache",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "raidpunk", cost: 2 }],
    isReady: true,
    isDamaged: false,
  },

  watchtower: {
    name: "watchtower",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 1 }], // Requires event resolved
    isReady: true,
    isDamaged: false,
  },

  constructionYard: {
    name: "constructionyard",
    type: "camp",
    campDraw: 1,
    abilities: [
      { effect: "moveperson", cost: 1 },
      { effect: "raid", cost: 2 },
    ],
    isReady: true,
    isDamaged: false,
  },

  adrenalineLab: {
    name: "adrenalinelab",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "usedamaged", cost: 0 }], // Use damaged person ability
    isReady: true,
    isDamaged: false,
  },

  mulcher: {
    name: "mulcher",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "destroydraw", cost: 0 }],
    isReady: true,
    isDamaged: false,
  },

  bloodBank: {
    name: "bloodbank",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "destroywater", cost: 0 }],
    isReady: true,
    isDamaged: false,
  },

  arcade: {
    name: "arcade",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "gainpunk", cost: 1 }], // Requires 0-1 people
    isReady: true,
    isDamaged: false,
  },

  trainingCamp: {
    name: "trainingcamp",
    type: "camp",
    campDraw: 2,
    abilities: [{ effect: "damage", cost: 2 }], // Requires 2 people in column
    isReady: true,
    isDamaged: false,
  },

  supplyDepot: {
    name: "supplydepot",
    type: "camp",
    campDraw: 2,
    abilities: [{ effect: "drawdiscard", cost: 2 }], // Draw 2, discard 1
    isReady: true,
    isDamaged: false,
  },

  omenClock: {
    name: "omenclock",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "advance", cost: 1 }], // Advance any event
    isReady: true,
    isDamaged: false,
  },

  warehouse: {
    name: "warehouse",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "restore", cost: 1 }], // Requires opponent unprotected camp
    isReady: true,
    isDamaged: false,
  },

  garage: {
    name: "garage",
    type: "camp",
    campDraw: 0,
    abilities: [{ effect: "raid", cost: 1 }],
    isReady: true,
    isDamaged: false,
  },

  oasis: {
    name: "oasis",
    type: "camp",
    campDraw: 1,
    abilities: [], // Trait only - people cost reduction
    trait: "If no people in this column, people cost 1 less to play here",
    isReady: true,
    isDamaged: false,
  },

  parachuteBase: {
    name: "parachutebase",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "paradrop", cost: 0 }], // Play person and use ability
    isReady: true,
    isDamaged: false,
  },

  laborCamp: {
    name: "laborcamp",
    type: "camp",
    campDraw: 1,
    abilities: [{ effect: "destroyrestore", cost: 0 }],
    isReady: true,
    isDamaged: false,
  },
};

// Example usage:
// gameState.players.left.columns[0].setCard(0, { ...ALL_CAMPS.watchtower, id: "camp_left_1" });
// gameState.players.right.columns[1].setCard(0, { ...ALL_CAMPS.juggernaut, id: "camp_right_2" });
