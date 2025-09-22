import { GameState } from "./core/game-state.js";
import { CommandSystem } from "./core/command-system.js";
import { UIRenderer } from "./ui/ui-renderer.js";

// Initialize game
const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);
const uiRenderer = new UIRenderer(gameState, commandSystem);

function ensureJunkEffect(card) {
  if (!card.junkEffect) {
    const defaultJunkEffects = [
      "water",
      "card",
      "raid",
      "injure",
      "restore",
      "punk",
    ];
    card.junkEffect =
      defaultJunkEffects[Math.floor(Math.random() * defaultJunkEffects.length)];
  }
  return card;
}

// Set up test scenario
function setupTestGame() {
  // Give players plenty of water for testing
  gameState.players.left.water = 20;
  gameState.players.right.water = 20;

  // LEFT PLAYER SETUP
  // Camps: Parachute Base, Juggernaut, and a simple camp
  gameState.players.left.columns[0].setCard(0, {
    id: "camp_left_1",
    name: "Omen Clock",
    type: "camp",
    campDraw: 1, // Omen Clock has 1 camp draw
    abilities: [{ effect: "advance", cost: 1 }],
    isReady: true,
    isDamaged: false,
  });

  gameState.players.left.columns[1].setCard(0, {
    id: "camp_left_2",
    name: "Transplant Lab",
    type: "camp",
    campDraw: 2, // Transplant Lab has 2 camp draw
    abilities: [{ effect: "restore", cost: 1 }],
    isReady: true,
    isDamaged: false,
  });

  gameState.players.left.columns[2].setCard(0, {
    id: "camp_left_3",
    name: "Oasis",
    type: "camp",
    campDraw: 1, // Oasis has 1 camp draw
    abilities: [], // No active abilities
    trait: "People cost 1 less in this column if no people present", // Just for reference
    isReady: true,
    isDamaged: false,
  });

  // LEFT PLAYER HAND
  gameState.players.left.hand = [
    {
      id: "vigilante_1",
      name: "Vigilante",
      type: "person",
      cost: 1,
      junkEffect: "raid",
      abilities: [{ effect: "injure", cost: 1 }],
    },
    {
      id: "highground_1",
      name: "High Ground",
      type: "event",
      cost: 0,
      queueNumber: 1,
      junkEffect: "water",
    },
    {
      id: "bombardment_1",
      name: "Bombardment",
      type: "event",
      cost: 4,
      queueNumber: 3,
      junkEffect: "restore",
    },
    {
      id: "famine_1",
      name: "Famine",
      type: "event",
      cost: 1,
      queueNumber: 1,
      junkEffect: "injure",
    },
    {
      id: `truce_1}`,
      name: "Truce",
      type: "event",
      cost: 2,
      queueNumber: 0, // Instant!
      junkEffect: "water",
    },
    {
      id: `uprising_1}`,
      name: "Uprising",
      type: "event",
      cost: 1,
      queueNumber: 2,
      junkEffect: "injure",
    },
    {
      id: "napalm_1",
      name: "Napalm",
      type: "event",
      cost: 2,
      queueNumber: 1,
      junkEffect: "restore",
    },
    {
      id: "strafe_1",
      name: "Strafe",
      type: "event",
      cost: 2,
      queueNumber: 0,
      junkEffect: "card",
    },
    {
      id: "radiation_1",
      name: "Radiation",
      type: "event",
      cost: 2,
      queueNumber: 1,
      junkEffect: "raid",
    },
    {
      id: "banish_1",
      name: "Banish",
      type: "event",
      cost: 1,
      queueNumber: 1,
      junkEffect: "raid",
    },
    {
      id: "interrogate_1",
      name: "Interrogate",
      type: "event",
      cost: 1,
      queueNumber: 0,
      junkEffect: "water",
    },
    {
      id: "doomsayer_1",
      name: "Doomsayer",
      type: "person",
      cost: 1,
      abilities: [{ effect: "conditionaldamage", cost: 1 }],
      junkEffect: "card",
    },
    {
      id: "zeto_kahn_1",
      name: "Zeto Kahn",
      type: "person",
      cost: 3,
      abilities: [{ effect: "drawdiscard", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "vera_vosh_1",
      name: "Vera Vosh",
      type: "person",
      cost: 3,
      abilities: [{ effect: "injure", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "argo_yesky_1",
      name: "Argo Yesky",
      type: "person",
      cost: 3,
      abilities: [{ effect: "damage", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "karli_blaze_1",
      name: "Karli Blaze",
      type: "person",
      cost: 3,
      abilities: [{ effect: "damage", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "holdout_1",
      name: "Holdout",
      type: "person",
      cost: 2,
      abilities: [{ effect: "damage", cost: 1 }],
      junkEffect: "raid",
    },
    {
      id: `scientist_1`,
      name: "Scientist",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "discardchoose",
          cost: 1,
        },
      ],
      junkEffect: "raid",
    },
    {
      id: "rescue_team_1",
      name: "Rescue Team",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "returnperson",
          cost: 0,
        },
      ],
      junkEffect: "injure",
    },
    {
      id: "cult_leader_1",
      name: "Cult Leader",
      type: "person",
      cost: 1,
      junkEffect: "card",
      abilities: [{ effect: "destroyowndamage", cost: 0 }],
    },
    {
      id: "rabble_rouser_1",
      name: "Rabble Rouser",
      type: "person",
      cost: 1,
      junkEffect: "raid",
      abilities: [
        { effect: "gainpunk", cost: 1 },
        { effect: "punkdamage", cost: 1 },
      ],
    },
    {
      id: "molgur_stang_1",
      name: "Molgur Stang",
      type: "person",
      cost: 4,
      junkEffect: "punk",
      abilities: [{ effect: "destroycamp", cost: 1 }],
    },
    {
      id: "pyromaniac_1",
      name: "Pyromaniac",
      type: "person",
      cost: 1,
      junkEffect: "injure",
      abilities: [{ effect: "damagecamp", cost: 1 }],
    },
    {
      id: "sniper_1",
      name: "Sniper",
      type: "person",
      cost: 1,
      junkEffect: "restore",
      abilities: [{ effect: "damage", cost: 2 }],
    },
    {
      id: "assassin_1",
      name: "Assassin",
      type: "person",
      cost: 1,
      junkEffect: "raid",
      abilities: [{ effect: "destroy", cost: 2 }],
    },
    {
      id: "exterminator_1",
      name: "Exterminator",
      type: "person",
      cost: 1,
      junkEffect: "card",
      abilities: [{ effect: "destroyalldamaged", cost: 1 }],
    },
    {
      id: "repair_bot_1",
      name: "Repair Bot",
      type: "person",
      cost: 1,
      junkEffect: "injure", // According to doc
      abilities: [{ effect: "restore", cost: 2 }],
    },
    {
      id: "magnus_1",
      name: "Magnus Karv",
      type: "person",
      cost: 3,
      junkEffect: "punk",
      abilities: [{ effect: "damage column", cost: 2 }],
    },
    {
      id: "gunner_1",
      name: "Gunner",
      type: "person",
      cost: 1,
      junkEffect: "restore", // This has restore junk
      abilities: [{ effect: "injure all", cost: 2 }],
    },
    {
      id: "looter_1",
      name: "Looter",
      type: "person",
      cost: 1,
      junkEffect: "water",
      abilities: [{ effect: "damage", cost: 2 }],
    },
    {
      id: "vanguard_1",
      name: "Vanguard",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "damageandcounter",
          cost: 1,
        },
      ],
      junkEffect: "raid",
    },
    {
      id: "scout_1",
      name: "Scout",
      type: "person",
      cost: 1,
      junkEffect: "water",
      abilities: [{ effect: "raid", cost: 1 }],
    },
    // Add to left player's hand
    {
      id: "wounded_soldier_1",
      name: "Wounded Soldier",
      type: "person",
      cost: 1,
      junkEffect: "injure",
      abilities: [{ effect: "damage", cost: 1 }],
    },
    {
      id: "mutant_1",
      name: "Mutant",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "damagerestore",
          cost: 0,
        },
      ],
      junkEffect: "injure",
    },
    {
      id: "mimic_1",
      name: "Mimic",
      type: "person",
      cost: 1,
      junkEffect: "injure",
      abilities: [{ effect: "copyability", cost: 0 }], // Cost will be dynamic
    },
  ];

  // RIGHT PLAYER SETUP (mirror configuration)
  // Camps: Juggernaut, Parachute Base, and a simple camp
  gameState.players.right.columns[0].setCard(0, {
    id: "camp_right_1",
    name: "Omen Clock",
    type: "camp",
    campDraw: 1, // Omen Clock has 1 camp draw
    abilities: [{ effect: "advance", cost: 1 }],
    isReady: true,
    isDamaged: false,
  });

  gameState.players.right.columns[1].setCard(0, {
    id: "camp_right_2",
    name: "Oasis",
    type: "camp",
    campDraw: 1, // Oasis has 1 camp draw
    abilities: [], // No active abilities
    trait: "People cost 1 less in this column if no people present", // Just for reference
    isReady: true,
    isDamaged: false,
  });

  gameState.players.right.columns[2].setCard(0, {
    id: "camp_right_3",
    name: "Transplant Lab",
    type: "camp",
    campDraw: 2, // Transplant Lab has 2 camp draw
    abilities: [{ effect: "restore", cost: 1 }],
    isReady: true,
    isDamaged: false,
  });

  // RIGHT PLAYER HAND (similar cards for testing)
  gameState.players.right.hand = [
    {
      id: "highground_2",
      name: "High Ground",
      type: "event",
      cost: 0,
      queueNumber: 1,
      junkEffect: "water",
    },
    {
      id: "bombardment_2",
      name: "Bombardment",
      type: "event",
      cost: 4,
      queueNumber: 3,
      junkEffect: "restore",
    },
    {
      id: "famine_2",
      name: "Famine",
      type: "event",
      cost: 1,
      queueNumber: 1,
      junkEffect: "injure",
    },
    {
      id: `truce_2}`,
      name: "Truce",
      type: "event",
      cost: 2,
      queueNumber: 0, // Instant!
      junkEffect: "water",
    },
    {
      id: `uprising_2}`,
      name: "Uprising",
      type: "event",
      cost: 1,
      queueNumber: 2,
      junkEffect: "injure",
    },
    {
      id: "napalm_2",
      name: "Napalm",
      type: "event",
      cost: 2,
      queueNumber: 1,
      junkEffect: "restore",
    },
    {
      id: "strafe_2",
      name: "Strafe",
      type: "event",
      cost: 2,
      queueNumber: 0,
      junkEffect: "card",
    },
    {
      id: "radiation_2",
      name: "Radiation",
      type: "event",
      cost: 2,
      queueNumber: 1,
      junkEffect: "raid",
    },
    {
      id: "banish_2",
      name: "Banish",
      type: "event",
      cost: 1,
      queueNumber: 1,
      junkEffect: "raid",
    },
    {
      id: "interrogate_2",
      name: "Interrogate",
      type: "event",
      cost: 1,
      queueNumber: 0,
      junkEffect: "water",
    },
    {
      id: "doomsayer_2",
      name: "Doomsayer",
      type: "person",
      cost: 1,
      abilities: [{ effect: "conditionaldamage", cost: 1 }],
      junkEffect: "card",
    },
    {
      id: "zeto_kahn_2",
      name: "Zeto Kahn",
      type: "person",
      cost: 3,
      abilities: [{ effect: "drawdiscard", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "vera_vosh_2",
      name: "Vera Vosh",
      type: "person",
      cost: 3,
      abilities: [{ effect: "injure", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "argo_yesky_2",
      name: "Argo Yesky",
      type: "person",
      cost: 3,
      abilities: [{ effect: "damage", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "karli_blaze_2",
      name: "Karli Blaze",
      type: "person",
      cost: 3,
      abilities: [{ effect: "damage", cost: 1 }],
      junkEffect: "punk",
    },
    {
      id: "holdout_2",
      name: "Holdout",
      type: "person",
      cost: 2,
      abilities: [{ effect: "damage", cost: 1 }],
      junkEffect: "raid",
    },
    {
      id: "rescue_team_2",
      name: "Rescue Team",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "returnperson",
          cost: 0,
        },
      ],
      junkEffect: "injure",
    },
    {
      id: `scientist_2`,
      name: "Scientist",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "discardchoose",
          cost: 1,
        },
      ],
      junkEffect: "raid",
    },
    {
      id: "cult_leader_2",
      name: "Cult Leader",
      type: "person",
      cost: 1,
      junkEffect: "card",
      abilities: [{ effect: "destroyowndamage", cost: 0 }],
    },
    {
      id: "rabble_rouser_2",
      name: "Rabble Rouser",
      type: "person",
      cost: 1,
      junkEffect: "raid",
      abilities: [
        { effect: "gainpunk", cost: 1 },
        { effect: "punkdamage", cost: 1 },
      ],
    },
    {
      id: "molgur_stang_2",
      name: "Molgur Stang",
      type: "person",
      cost: 4,
      junkEffect: "punk",
      abilities: [{ effect: "destroycamp", cost: 1 }],
    },
    {
      id: "pyromaniac_2",
      name: "Pyromaniac",
      type: "person",
      cost: 1,
      junkEffect: "injure",
      abilities: [{ effect: "damagecamp", cost: 1 }],
    },
    {
      id: "sniper_2",
      name: "Sniper",
      type: "person",
      cost: 1,
      junkEffect: "restore",
      abilities: [{ effect: "damage", cost: 2 }],
    },
    {
      id: "assassin_2",
      name: "Assassin",
      type: "person",
      cost: 1,
      junkEffect: "raid",
      abilities: [{ effect: "destroy", cost: 2 }],
    },
    {
      id: "exterminator_2",
      name: "Exterminator",
      type: "person",
      cost: 1,
      junkEffect: "card",
      abilities: [{ effect: "destroyalldamaged", cost: 1 }],
    },
    {
      id: "repair_bot_2",
      name: "Repair Bot",
      type: "person",
      cost: 1,
      junkEffect: "injure", // According to doc
      abilities: [{ effect: "restore", cost: 2 }],
    },
    {
      id: "magnus_2",
      name: "Magnus Karv",
      type: "person",
      cost: 3,
      junkEffect: "punk",
      abilities: [{ effect: "damage column", cost: 2 }],
    },
    {
      id: "gunner_2",
      name: "Gunner",
      type: "person",
      cost: 1,
      junkEffect: "restore", // This has restore junk
      abilities: [{ effect: "injure all", cost: 2 }],
    },
    {
      id: "looter_2",
      name: "Looter",
      type: "person",
      cost: 1,
      junkEffect: "water",
      abilities: [{ effect: "damage", cost: 2 }],
    },

    {
      id: "vigilante_2",
      name: "Vigilante",
      type: "person",
      cost: 1,
      junkEffect: "raid",
      abilities: [{ effect: "injure", cost: 1 }],
    },
    {
      id: "vanguard_2",
      name: "Vanguard",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "damageandcounter",
          cost: 1,
        },
      ],
      junkEffect: "raid",
    }, // No abilities, good for testing basic placement
    {
      id: "mutant_2",
      name: "Mutant",
      type: "person",
      cost: 1,
      abilities: [
        {
          effect: "damagerestore",
          cost: 0,
        },
      ],
      junkEffect: "injure",
    },
    {
      id: "mimic_2",
      name: "Mimic",
      type: "person",
      cost: 1,
      junkEffect: "injure",
      abilities: [{ effect: "copyability", cost: 0 }],
    },
  ];

  // Create a larger test deck
  gameState.deck = [
    { id: "deck_1", name: "Deck Scout", type: "person", cost: 1 },
    { id: "deck_2", name: "Deck Muse", type: "person", cost: 1 },
    { id: "deck_3", name: "Deck Fighter", type: "person", cost: 2 },
    { id: "deck_4", name: "Deck Guard", type: "person", cost: 2 },
    { id: "deck_5", name: "Deck Sniper", type: "person", cost: 3 },
    { id: "deck_6", name: "Deck Healer", type: "person", cost: 1 },
    { id: "deck_7", name: "Deck Tank", type: "person", cost: 3 },
    { id: "deck_8", name: "Deck Support", type: "person", cost: 2 },
    { id: "deck_9", name: "Deck Scout", type: "person", cost: 1 },
    { id: "deck_10", name: "Deck Muse", type: "person", cost: 1 },
    { id: "deck_11", name: "Deck Fighter", type: "person", cost: 2 },
    { id: "deck_12", name: "Deck Guard", type: "person", cost: 2 },
    { id: "deck_13", name: "Deck Sniper", type: "person", cost: 3 },
    { id: "deck_14", name: "Deck Healer", type: "person", cost: 1 },
    { id: "deck_15", name: "Deck Tank", type: "person", cost: 3 },
    { id: "deck_16", name: "Deck Support", type: "person", cost: 2 },
  ].map((card) => ensureJunkEffect(card));

  // Start in actions phase
  gameState.phase = "actions";

  console.log("Test game ready:");
  console.log("- Both players have Parachute Base and Juggernaut");
  console.log("- Multiple person cards in hand for testing");
  console.log("- 20 water each for extensive testing");
  console.log("- Deck has 8 cards");
}

// Set up the test and render
setupTestGame();
uiRenderer.render();

// Listen for state changes
window.addEventListener("gameStateChanged", () => {
  uiRenderer.render();
});
