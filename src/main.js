import { GameState } from "./core/game-state.js";
import { CommandSystem } from "./core/command-system.js";
import { UIRenderer } from "./ui/ui-renderer.js";

class RadlandsGame {
  constructor() {
    this.state = new GameState();
    this.commands = new CommandSystem(this.state);
    this.ui = new UIRenderer(this.state, this.commands);

    this.init();
  }

  init() {
    console.log("Initializing Radlands...");

    // Set up the basic game state for testing
    this.setupTestGame();

    // Initial render
    this.ui.render();

    // Listen for state changes
    window.addEventListener("gameStateChanged", (e) => {
      this.ui.render();
    });
  }

  setupTestGame() {
    // Create a simple test setup
    // For now, just set up the basic structure

    // Give each player some test camps (we'll replace with proper camp selection later)
    const leftCamps = [
      { id: "camp_l1", name: "Test Camp 1", type: "camp", isDestroyed: false },
      { id: "camp_l2", name: "Test Camp 2", type: "camp", isDestroyed: false },
      { id: "camp_l3", name: "Test Camp 3", type: "camp", isDestroyed: false },
    ];

    const rightCamps = [
      { id: "camp_r1", name: "Test Camp A", type: "camp", isDestroyed: false },
      { id: "camp_r2", name: "Test Camp B", type: "camp", isDestroyed: false },
      { id: "camp_r3", name: "Test Camp C", type: "camp", isDestroyed: false },
    ];

    // Place camps in position 0 of each column
    leftCamps.forEach((camp, i) => {
      this.state.players.left.columns[i].setCard(0, camp);
    });

    rightCamps.forEach((camp, i) => {
      this.state.players.right.columns[i].setCard(0, camp);
    });

    // Give each player a starting hand of simple test cards
    this.state.players.left.hand = [
      { id: "card1", name: "Test Person", type: "person", cost: 1 },
      {
        id: "card2",
        name: "Test Event",
        type: "event",
        cost: 2,
        queueNumber: 2,
      },
      { id: "card3", name: "Another Person", type: "person", cost: 2 },
    ];

    this.state.players.right.hand = [
      { id: "card4", name: "Test Person", type: "person", cost: 1 },
      {
        id: "card5",
        name: "Test Event",
        type: "event",
        cost: 2,
        queueNumber: 2,
      },
      { id: "card6", name: "Another Person", type: "person", cost: 2 },
    ];

    // Create test deck - MOVE THIS HERE
    this.state.deck = Array(20)
      .fill(null)
      .map((_, i) => ({
        id: `deck_card_${i}`,
        name: `Test Card ${i}`,
        type: "person",
        cost: Math.floor(Math.random() * 3) + 1,
        junkEffect: "draw",
      }));

    // Start in events phase (not actions)
    this.state.phase = "events";

    // Process the first turn's phases
    setTimeout(() => {
      this.commands.processEventsPhase();
    }, 500);

    console.log("Test game setup complete");
  }
}

// Start the game when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.game = new RadlandsGame();
  });
} else {
  window.game = new RadlandsGame();
}
