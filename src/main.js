import { GameState } from "./core/game-state.js";
import { CommandSystem } from "./core/command-system.js";
import { UIRenderer } from "./ui/ui-renderer.js";

// Initialize game
const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);
const uiRenderer = new UIRenderer(gameState, commandSystem);

// Set up test scenario
function setupTestGame() {
  // Give players plenty of water for testing
  gameState.players.left.water = 20;
  gameState.players.right.water = 20;

  // LEFT PLAYER SETUP
  // Camps: Parachute Base, Juggernaut, and a simple camp
  gameState.players.left.columns[0].setCard(0, {
    id: "camp_left_0",
    name: "Parachute Base",
    type: "camp",
    campDraw: 1,
    abilities: [
      {
        effect: "paradrop",
        cost: 0,
      },
    ],
    isReady: true,
    isDamaged: false,
  });

  gameState.players.left.columns[1].setCard(0, {
    id: "camp_left_1",
    name: "Juggernaut",
    type: "camp",
    campDraw: 0,
    abilities: [
      {
        effect: "move",
        cost: 1,
      },
    ],
    isReady: true,
    isDamaged: false,
    moveCount: 0,
  });

  gameState.players.left.columns[2].setCard(0, {
    id: "camp_left_2",
    name: "Railgun",
    type: "camp",
    campDraw: 0,
    abilities: [
      {
        effect: "damage",
        cost: 2,
      },
    ],
    isReady: true,
    isDamaged: false,
  });

  // LEFT PLAYER HAND
  gameState.players.left.hand = [
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
      id: "muse_1",
      name: "Muse",
      type: "person",
      cost: 1,
      junkEffect: "injure",
      abilities: [{ effect: "extra_water", cost: 0 }],
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
      id: "test_person_2",
      name: "Test Healer",
      type: "person",
      cost: 2,
      junkEffect: "restore",
      abilities: [{ effect: "restore", cost: 1 }],
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
    id: "camp_right_0",
    name: "Juggernaut",
    type: "camp",
    campDraw: 0,
    abilities: [
      {
        effect: "move",
        cost: 1,
      },
    ],
    isReady: true,
    isDamaged: false,
    moveCount: 0,
  });

  gameState.players.right.columns[1].setCard(0, {
    id: "camp_right_1",
    name: "Parachute Base",
    type: "camp",
    campDraw: 1,
    abilities: [
      {
        effect: "paradrop",
        cost: 0,
      },
    ],
    isReady: true,
    isDamaged: false,
  });

  gameState.players.right.columns[2].setCard(0, {
    id: "camp_right_2",
    name: "Oasis",
    type: "camp",
    campDraw: 1,
    abilities: [], // Oasis has a trait, not an ability
    isReady: true,
    isDamaged: false,
  });

  // RIGHT PLAYER HAND (similar cards for testing)
  gameState.players.right.hand = [
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
      id: "gunner_2",
      name: "Gunner",
      type: "person",
      cost: 1,
      junkEffect: "restore",
      abilities: [{ effect: "injure all", cost: 2 }],
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
      id: "test_person_3",
      name: "Test Tank",
      type: "person",
      cost: 3,
      junkEffect: "water",
      abilities: [],
    }, // No abilities, good for testing basic placement
    {
      id: "test_person_4",
      name: "Test Support",
      type: "person",
      cost: 1,
      junkEffect: "draw",
      abilities: [{ effect: "draw", cost: 2 }],
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
  ];

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
