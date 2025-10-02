import { WebSocketServer } from "ws";
import { GameState } from "../src/core/game-state.js";
import { CommandSystem } from "../src/core/command-system.js";
import { cardRegistry } from "../src/cards/card-registry.js"; // ADD THIS

// Make cardRegistry available globally in Node.js context
global.cardRegistry = cardRegistry; // ADD THIS

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map(); // Map of ws -> playerId
const players = { left: null, right: null }; // Which websocket is which player

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

// Create test deck with real Radlands cards
gameState.deck = [
  // Person cards (for playing and as targets)
  {
    id: "looter_1",
    name: "Looter",
    type: "person",
    cost: 1,
    abilities: [{ effect: "damage", cost: 2 }],
    junkEffect: "water",
  },
  {
    id: "looter_2",
    name: "Looter",
    type: "person",
    cost: 1,
    abilities: [{ effect: "damage", cost: 2 }],
    junkEffect: "water",
  },
  {
    id: "vigilante_1",
    name: "Vigilante",
    type: "person",
    cost: 1,
    abilities: [{ effect: "injure", cost: 1 }],
    junkEffect: "raid",
  },
  {
    id: "vigilante_2",
    name: "Vigilante",
    type: "person",
    cost: 1,
    abilities: [{ effect: "injure", cost: 1 }],
    junkEffect: "raid",
  },
  {
    id: "muse_1",
    name: "Muse",
    type: "person",
    cost: 1,
    abilities: [{ effect: "extra_water", cost: 0 }],
    junkEffect: "injure",
  },
  {
    id: "muse_2",
    name: "Muse",
    type: "person",
    cost: 1,
    abilities: [{ effect: "extra_water", cost: 0 }],
    junkEffect: "injure",
  },

  // Event cards
  {
    id: "strafe_1",
    name: "Strafe",
    type: "event",
    cost: 2,
    queueNumber: 0,
    junkEffect: "card",
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
    id: "interrogate_1",
    name: "Interrogate",
    type: "event",
    cost: 1,
    queueNumber: 0,
    junkEffect: "water",
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
    id: "radiation_1",
    name: "Radiation",
    type: "event",
    cost: 2,
    queueNumber: 1,
    junkEffect: "raid",
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
    id: "uprising_1",
    name: "Uprising",
    type: "event",
    cost: 1,
    queueNumber: 2,
    junkEffect: "injure",
  },
  {
    id: "uprising_2",
    name: "Uprising",
    type: "event",
    cost: 1,
    queueNumber: 2,
    junkEffect: "injure",
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
    id: "bombardment_2",
    name: "Bombardment",
    type: "event",
    cost: 4,
    queueNumber: 3,
    junkEffect: "restore",
  },
];

// // Duplicate to reach 30 cards
// const baseDeck = [...gameState.deck];
// while (gameState.deck.length < 30) {
//   baseDeck.forEach((card) => {
//     if (gameState.deck.length < 30) {
//       gameState.deck.push({
//         ...card,
//         id: `${card.name.toLowerCase().replace(/\s+/g, "_")}_${
//           gameState.deck.length
//         }`,
//       });
//     }
//   });
// }

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

const commandSystem = new CommandSystem(gameState);

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((playerId, ws) => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(data);
    }
  });
}

wss.on("connection", (ws) => {
  // Assign player ID
  let playerId = null;

  if (!players.left) {
    playerId = "left";
    players.left = ws;
  } else if (!players.right) {
    playerId = "right";
    players.right = ws;
  } else {
    console.log("Game full - rejecting connection");
    ws.close();
    return;
  }

  clients.set(ws, playerId);
  console.log(
    `Client connected as ${playerId} player. Total clients: ${clients.size}`
  );

  // Tell client which player they are
  ws.send(
    JSON.stringify({
      type: "PLAYER_ASSIGNED",
      playerId: playerId,
    })
  );

  // Send current state to the new client
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
      console.log(`Received command from ${playerId}:`, message.command.type);

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
    console.log(`${playerId} player disconnected`);
    clients.delete(ws);
    if (players.left === ws) players.left = null;
    if (players.right === ws) players.right = null;
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

console.log("Server running on ws://localhost:8080");
console.log("Initial game state created");
