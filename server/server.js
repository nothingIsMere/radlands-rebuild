import { WebSocketServer } from "ws";
import { GameState } from "../src/core/game-state.js";
import { CommandSystem } from "../src/core/command-system.js";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

// Create a single game state on the server
const gameState = new GameState();

// Bigger test deck to avoid exhaustion
function createTestCard(id, name, type, cost = 1) {
  return {
    id: id,
    name: name,
    type: type,
    cost: cost,
    abilities: type === "person" ? [{ effect: "damage", cost: 1 }] : undefined,
    junkEffect: "water",
  };
}

// Create 30 test cards so we don't hit exhaustion
gameState.deck = [];
for (let i = 0; i < 30; i++) {
  gameState.deck.push(createTestCard(`test_${i}`, `TestCard${i}`, "person", 1));
}

// Set up camps
gameState.players.left.columns[0].setCard(0, {
  id: "camp_left_1",
  name: "Test Camp Left 1",
  type: "camp",
  campDraw: 1,
  abilities: [],
  isReady: true,
  isDamaged: false,
});

gameState.players.right.columns[0].setCard(0, {
  id: "camp_right_1",
  name: "Test Camp Right 1",
  type: "camp",
  campDraw: 1,
  abilities: [],
  isReady: true,
  isDamaged: false,
});

// Give both players plenty of water and some cards in hand
gameState.players.left.water = 10;
gameState.players.right.water = 10;
gameState.players.left.hand = [
  createTestCard("hand_l1", "HandCard1", "person"),
];
gameState.players.right.hand = [
  createTestCard("hand_r1", "HandCard1", "person"),
];

gameState.phase = "actions";
gameState.currentPlayer = "left";

// NOW create command system (after gameState exists)
const commandSystem = new CommandSystem(gameState);

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(data);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("Client connected. Total clients:", clients.size + 1);
  clients.add(ws);

  // Send current state to the new client immediately
  ws.send(
    JSON.stringify({
      type: "STATE_SYNC",
      state: gameState,
    })
  );

  // Handle incoming messages
  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "COMMAND") {
      console.log("Received command:", message.command.type);

      // Execute command on server's game state
      const success = commandSystem.execute(message.command);

      if (success) {
        console.log("Command executed successfully, broadcasting state");
        // Broadcast updated state to ALL clients
        broadcast({
          type: "STATE_SYNC",
          state: gameState,
        });
      } else {
        console.log("Command failed validation");
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected. Total clients:", clients.size - 1);
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

console.log("Server running on ws://localhost:8080");
console.log("Initial game state created");
