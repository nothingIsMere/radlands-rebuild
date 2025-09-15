import { GameState } from "./core/game-state.js";
import { CommandSystem } from "./core/command-system.js";
import { UIRenderer } from "./ui/ui-renderer.js";

// Initialize game
const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);
const uiRenderer = new UIRenderer(gameState, commandSystem);

// Set up test scenario
function setupTestGame() {
  // Give players some water
  gameState.players.left.water = 10;
  gameState.players.right.water = 10;

  // Place test camps - using actual camps from the game
  gameState.players.left.columns[0].setCard(0, {
    id: "camp_left_0",
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

  gameState.players.right.columns[1].setCard(0, {
    id: "camp_right_1",
    name: "Oasis",
    type: "camp",
    campDraw: 1,
    abilities: [], // Oasis has a trait, not an ability
    isReady: true,
    isDamaged: false,
  });

  gameState.players.right.columns[2].setCard(0, {
    id: "camp_right_2",
    name: "Garage",
    type: "camp",
    campDraw: 0,
    abilities: [
      {
        effect: "raid",
        cost: 1,
      },
    ],
    isReady: true,
    isDamaged: false,
  });

  // Add Looter to left player's hand
  gameState.players.left.hand.push({
    id: "looter_1",
    name: "Looter",
    type: "person",
    cost: 1,
    junkEffect: "water",
    abilities: [
      {
        effect: "damage",
        cost: 2,
      },
    ],
  });

  // Create a small test deck
  gameState.deck = [
    { id: "test_1", name: "Scout", type: "person", cost: 1 },
    { id: "test_2", name: "Muse", type: "person", cost: 1 },
  ];

  // Start in actions phase
  gameState.phase = "actions";

  console.log("Test game setup complete");
}

// Set up the test and render
setupTestGame();
uiRenderer.render();

// Listen for state changes
window.addEventListener("gameStateChanged", () => {
  uiRenderer.render();
});
