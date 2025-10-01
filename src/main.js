import { GameState } from "./core/game-state.js";
import { CommandSystem } from "./core/command-system.js";
import { UIRenderer } from "./ui/ui-renderer.js";
import { NetworkClient } from "./core/network-client.js";

// Initialize game with empty state (will be filled by server)
const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);
const uiRenderer = new UIRenderer(gameState, commandSystem);

// Intercept all commands and send to server instead of executing locally
const originalExecute = commandSystem.execute.bind(commandSystem);
commandSystem.execute = function (command) {
  if (networkClient.connected) {
    // Send to server, don't execute locally
    return networkClient.sendCommand(command);
  }
  // Fallback to local execution if not connected (shouldn't happen)
  return originalExecute(command);
};

// Connect to multiplayer server
const networkClient = new NetworkClient(
  (serverState) => {
    console.log("Updating local state from server");

    // Copy primitive properties
    gameState.currentPlayer = serverState.currentPlayer;
    gameState.turnNumber = serverState.turnNumber;
    gameState.phase = serverState.phase;
    gameState.deck = serverState.deck;
    gameState.discard = serverState.discard;
    gameState.deckExhaustedCount = serverState.deckExhaustedCount;
    gameState.pending = serverState.pending;
    gameState.turnEvents = serverState.turnEvents;
    gameState.activeAbilityContext = serverState.activeAbilityContext;

    // Copy player data, but hide opponent's hand
    ["left", "right"].forEach((playerId) => {
      const player = gameState.players[playerId];
      const serverPlayer = serverState.players[playerId];

      // If this is the opponent, hide their hand cards
      if (playerId !== networkClient.myPlayerId) {
        // Show the correct number of cards, but hide their content
        player.hand = serverPlayer.hand.map(() => ({ hidden: true }));
      } else {
        // Show your own hand normally
        player.hand = serverPlayer.hand;
      }

      player.water = serverPlayer.water;
      player.raiders = serverPlayer.raiders;
      player.waterSilo = serverPlayer.waterSilo;
      player.eventQueue = serverPlayer.eventQueue;

      // Update columns
      for (let col = 0; col < 3; col++) {
        const serverColumn = serverPlayer.columns[col];
        for (let pos = 0; pos < 3; pos++) {
          const card = serverColumn.slots ? serverColumn.slots[pos] : null;
          player.columns[col].setCard(pos, card);
        }
      }
    });

    uiRenderer.render();
  },
  (playerId) => {
    console.log("You are player:", playerId);
    // Show which player you are in the UI
    document.title = `Radlands - ${playerId.toUpperCase()} Player`;
  }
);

networkClient
  .connect()
  .then(() => {
    console.log("Ready for multiplayer");
  })
  .catch((error) => {
    console.error("Failed to connect:", error);
  });

// Make it globally accessible so UIRenderer can check whose turn it is
window.networkClient = networkClient;

// Listen for state changes
window.addEventListener("gameStateChanged", () => {
  uiRenderer.render();
});
