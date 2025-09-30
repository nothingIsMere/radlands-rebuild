// card-definitions.js - Create this new file

// Person cards (46 total)
const PERSON_CARDS = [
  // Unique people (1 copy each = 6 cards)
  {
    name: "Zeto Kahn",
    cost: 3,
    abilities: [{ effect: "drawdiscard", cost: 1 }],
    junkEffect: "punk",
    copies: 1,
  },
  {
    name: "Vera Vosh",
    cost: 3,
    abilities: [{ effect: "injure", cost: 1 }],
    junkEffect: "punk",
    copies: 1,
  },
  {
    name: "Argo Yesky",
    cost: 3,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "punk",
    copies: 1,
  },
  {
    name: "Karli Blaze",
    cost: 3,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "punk",
    copies: 1,
  },
  {
    name: "Magnus Karv",
    cost: 3,
    abilities: [{ effect: "damage column", cost: 2 }],
    junkEffect: "punk",
    copies: 1,
  },
  {
    name: "Molgur Stang",
    cost: 4,
    abilities: [{ effect: "destroycamp", cost: 1 }],
    junkEffect: "punk",
    copies: 1,
  },

  // Common people (2 copies each = 40 cards)
  {
    name: "Scout",
    cost: 1,
    abilities: [{ effect: "raid", cost: 1 }],
    junkEffect: "water",
    copies: 2,
  },
  {
    name: "Muse",
    cost: 1,
    abilities: [{ effect: "extra_water", cost: 0 }],
    junkEffect: "injure",
    copies: 2,
  },
  {
    name: "Vigilante",
    cost: 1,
    abilities: [{ effect: "injure", cost: 1 }],
    junkEffect: "raid",
    copies: 2,
  },
  {
    name: "Holdout",
    cost: 2,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "raid",
    copies: 2,
  },
  {
    name: "Scientist",
    cost: 1,
    abilities: [{ effect: "discardchoose", cost: 1 }],
    junkEffect: "raid",
    copies: 2,
  },
  {
    name: "Rescue Team",
    cost: 1,
    abilities: [{ effect: "returnperson", cost: 0 }],
    junkEffect: "injure",
    copies: 2,
  },
  {
    name: "Cult Leader",
    cost: 1,
    abilities: [{ effect: "destroyowndamage", cost: 0 }],
    junkEffect: "card",
    copies: 2,
  },
  {
    name: "Rabble Rouser",
    cost: 1,
    abilities: [
      { effect: "gainpunk", cost: 1 },
      { effect: "punkdamage", cost: 1 },
    ],
    junkEffect: "raid",
    copies: 2,
  },
  {
    name: "Pyromaniac",
    cost: 1,
    abilities: [{ effect: "damagecamp", cost: 1 }],
    junkEffect: "injure",
    copies: 2,
  },
  {
    name: "Sniper",
    cost: 1,
    abilities: [{ effect: "damage", cost: 2 }],
    junkEffect: "restore",
    copies: 2,
  },
  {
    name: "Assassin",
    cost: 1,
    abilities: [{ effect: "destroy", cost: 2 }],
    junkEffect: "raid",
    copies: 2,
  },
  {
    name: "Exterminator",
    cost: 1,
    abilities: [{ effect: "destroyalldamaged", cost: 1 }],
    junkEffect: "card",
    copies: 2,
  },
  {
    name: "Repair Bot",
    cost: 1,
    abilities: [{ effect: "restore", cost: 2 }],
    junkEffect: "injure",
    copies: 2,
  },
  {
    name: "Gunner",
    cost: 1,
    abilities: [{ effect: "injure all", cost: 2 }],
    junkEffect: "restore",
    copies: 2,
  },
  {
    name: "Looter",
    cost: 1,
    abilities: [{ effect: "damage", cost: 2 }],
    junkEffect: "water",
    copies: 2,
  },
  {
    name: "Vanguard",
    cost: 1,
    abilities: [{ effect: "damageandcounter", cost: 1 }],
    junkEffect: "raid",
    copies: 2,
  },
  {
    name: "Wounded Soldier",
    cost: 1,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "injure",
    copies: 2,
  },
  {
    name: "Mutant",
    cost: 1,
    abilities: [{ effect: "damagerestore", cost: 0 }],
    junkEffect: "injure",
    copies: 2,
  },
  {
    name: "Doomsayer",
    cost: 1,
    abilities: [{ effect: "conditionaldamage", cost: 1 }],
    junkEffect: "card",
    copies: 2,
  },
  {
    name: "Mimic",
    cost: 1,
    abilities: [{ effect: "copyability", cost: 0 }],
    junkEffect: "injure",
    copies: 2,
  },
];

// Event cards (20 total - 2 copies of each)
const EVENT_CARDS = [
  {
    name: "High Ground",
    cost: 0,
    queueNumber: 1,
    junkEffect: "water",
    copies: 2,
  },
  {
    name: "Bombardment",
    cost: 4,
    queueNumber: 3,
    junkEffect: "restore",
    copies: 2,
  },
  { name: "Famine", cost: 1, queueNumber: 1, junkEffect: "injure", copies: 2 },
  { name: "Truce", cost: 2, queueNumber: 0, junkEffect: "water", copies: 2 },
  {
    name: "Uprising",
    cost: 1,
    queueNumber: 2,
    junkEffect: "injure",
    copies: 2,
  },
  { name: "Napalm", cost: 2, queueNumber: 1, junkEffect: "restore", copies: 2 },
  { name: "Strafe", cost: 2, queueNumber: 0, junkEffect: "card", copies: 2 },
  { name: "Radiation", cost: 2, queueNumber: 1, junkEffect: "raid", copies: 2 },
  { name: "Banish", cost: 1, queueNumber: 1, junkEffect: "raid", copies: 2 },
  {
    name: "Interrogate",
    cost: 1,
    queueNumber: 0,
    junkEffect: "water",
    copies: 2,
  },
];

// Function to create the draw deck
function createDrawDeck() {
  const deck = [];
  let cardId = 1;

  // Add person cards
  PERSON_CARDS.forEach((cardDef) => {
    for (let i = 0; i < cardDef.copies; i++) {
      deck.push({
        id: `person_${cardId++}`,
        name: cardDef.name,
        type: "person",
        cost: cardDef.cost,
        abilities: cardDef.abilities,
        junkEffect: cardDef.junkEffect,
      });
    }
  });

  // Add event cards
  EVENT_CARDS.forEach((cardDef) => {
    for (let i = 0; i < cardDef.copies; i++) {
      deck.push({
        id: `event_${cardId++}`,
        name: cardDef.name,
        type: "event",
        cost: cardDef.cost,
        queueNumber: cardDef.queueNumber,
        junkEffect: cardDef.junkEffect,
      });
    }
  });

  return deck;
}

// Export for use in other files
export { createDrawDeck };
