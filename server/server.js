import { WebSocketServer } from "ws";
import { GameState } from "../src/core/game-state.js";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

// Create a single game state on the server
const gameState = new GameState();

// Simple test setup - just enough to see it works
gameState.players.left.water = 5;
gameState.players.right.water = 3;
gameState.phase = "actions";
gameState.currentPlayer = "left";

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
