import { GameState } from "./core/game-state.js";
import { CommandSystem } from "./core/command-system.js";
import { UIRenderer } from "./ui/ui-renderer.js";
import { ActionDispatcher } from "./core/action-dispatcher.js";
import { NetworkClient } from "./core/network-client.js";
import { ActionTypes } from "./core/action-types.js";

// Initialize game
const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);
const actionDispatcher = new ActionDispatcher(commandSystem);
const networkClient = new NetworkClient(actionDispatcher);
const uiRenderer = new UIRenderer(gameState, actionDispatcher);

// Make commandSystem globally accessible for phase processing
window.commandSystem = commandSystem;

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

function startNewGame() {
  actionDispatcher.dispatch({
    type: ActionTypes.START_CAMP_SELECTION,
  });
}

// Export for global access
window.startNewGame = startNewGame;

// Set up the test and render

// startNewGame();
uiRenderer.render();

// Listen for state changes
window.addEventListener("gameStateChanged", () => {
  uiRenderer.render();
});

// For single-player (non-networked) games, start phase progression immediately
if (!actionDispatcher.networkMode) {
  setTimeout(() => {
    console.log("Single-player: Starting phase progression");
    if (gameState.phase === "events") {
      commandSystem.processEventsPhase();
    }
  }, 1000);
}

// Add debug tools for testing network features
window.debugGame = {
  dispatcher: actionDispatcher,
  state: gameState,
  network: networkClient,

  // Get last N actions from log
  getActions: (count = 10) => {
    return actionDispatcher.getRecentActions(count);
  },

  // Show action statistics
  stats: () => {
    const log = actionDispatcher.actionLog;
    const stats = {};
    log.forEach((entry) => {
      stats[entry.action.type] = (stats[entry.action.type] || 0) + 1;
    });
    console.table(stats);
    return stats;
  },

  // Connect to server
  connect: (server = "ws://localhost:3001", room = "test-room") => {
    return networkClient.connect(server, room);
  },

  // Disconnect from server
  disconnect: () => {
    networkClient.disconnect();
  },

  // Check network status
  status: () => {
    console.log("Network connected:", networkClient.connected);
    console.log("Network mode:", actionDispatcher.networkMode);
    console.log("Player ID:", networkClient.playerId);
    console.log("Room ID:", networkClient.roomId);
  },
};

console.log("Debug tools available: window.debugGame");
console.log("Commands:");
console.log("  debugGame.stats() - show action counts");
console.log("  debugGame.getActions(5) - show last 5 actions");
console.log("  debugGame.connect() - connect to server");
console.log("  debugGame.status() - check network status");
