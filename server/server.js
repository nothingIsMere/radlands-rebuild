import { WebSocketServer } from "ws";
import { GameState } from "../src/core/game-state.js";
import { CommandSystem } from "../src/core/command-system.js";
import { cardRegistry } from "../src/cards/card-registry.js";

// Make cardRegistry available globally in Node.js context
global.cardRegistry = cardRegistry;

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map(); // Map of ws -> playerId
const players = { left: null, right: null }; // Which websocket is which player

// Create a single game state on the server
const gameState = new GameState();

// Test deck builder - easy to configure for different tests
function createTestDeck(config) {
  const deck = [];

  // Helper to add cards by name
  const addPerson = (name, count = 1) => {
    for (let i = 0; i < count; i++) {
      const cardData = PERSON_CARDS[name];
      if (!cardData) {
        console.warn(`Unknown person: ${name}`);
        continue;
      }
      deck.push({
        id: `${name.toLowerCase().replace(/\s+/g, "_")}_${deck.length}`,
        name: name,
        type: "person",
        cost: cardData.cost,
        abilities: cardData.abilities,
        junkEffect: cardData.junkEffect,
      });
    }
  };

  const addEvent = (name, count = 1) => {
    for (let i = 0; i < count; i++) {
      const cardData = EVENT_CARDS[name];
      if (!cardData) {
        console.warn(`Unknown event: ${name}`);
        continue;
      }
      deck.push({
        id: `${name.toLowerCase().replace(/\s+/g, "_")}_${deck.length}`,
        name: name,
        type: "event",
        cost: cardData.cost,
        queueNumber: cardData.queueNumber,
        junkEffect: cardData.junkEffect,
      });
    }
  };

  // Add cards based on config
  if (config.people) {
    config.people.forEach((spec) => {
      if (typeof spec === "string") {
        addPerson(spec, 1);
      } else {
        addPerson(spec.name, spec.count || 1);
      }
    });
  }

  if (config.events) {
    config.events.forEach((spec) => {
      if (typeof spec === "string") {
        addEvent(spec, 1);
      } else {
        addEvent(spec.name, spec.count || 1);
      }
    });
  }

  // Add filler cards if needed
  if (config.fillTo) {
    while (deck.length < config.fillTo) {
      addPerson("Looter", 1);
    }
  }

  return deck;
}

// Card definitions from your CSV data
const PERSON_CARDS = {
  Looter: {
    cost: 1,
    abilities: [{ effect: "damage", cost: 2 }],
    junkEffect: "water",
  },
  Vigilante: {
    cost: 1,
    abilities: [{ effect: "injure", cost: 1 }],
    junkEffect: "raid",
  },
  "Cult Leader": {
    cost: 1,
    abilities: [{ effect: "destroyowndamage", cost: 0 }],
    junkEffect: "card",
  },
  Mutant: {
    cost: 1,
    abilities: [{ effect: "damagerestore", cost: 0 }],
    junkEffect: "injure",
  },
  "Rabble Rouser": {
    cost: 1,
    abilities: [
      { effect: "gainpunk", cost: 1 },
      { effect: "punkdamage", cost: 1 },
    ],
    junkEffect: "raid",
  },
  "Repair Bot": {
    cost: 1,
    abilities: [{ effect: "restore", cost: 2 }],
    junkEffect: "injure",
  },
  Vanguard: {
    cost: 1,
    abilities: [{ effect: "damageandcounter", cost: 1 }],
    junkEffect: "raid",
  },
  "Wounded Soldier": {
    cost: 1,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "injure",
  },
  "Karli Blaze": {
    cost: 3,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "punk",
  },
  "Vera Vosh": {
    cost: 3,
    abilities: [{ effect: "injure", cost: 1 }],
    junkEffect: "punk",
  },
  "Argo Yesky": {
    cost: 3,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "punk",
  },
  Mimic: {
    cost: 1,
    abilities: [{ effect: "copyability", cost: 0 }],
    junkEffect: "injure",
  },
  Assassin: {
    cost: 1,
    abilities: [{ effect: "destroyperson", cost: 2 }],
    junkEffect: "raid",
  },
  Sniper: {
    cost: 1,
    abilities: [{ effect: "damageany", cost: 2 }],
    junkEffect: "restore",
  },
  Muse: {
    cost: 1,
    abilities: [{ effect: "extra_water", cost: 0 }],
    junkEffect: "injure",
  },
  "Zeto Kahn": {
    cost: 3,
    abilities: [{ effect: "drawdiscard", cost: 1 }],
    junkEffect: "punk",
  },
  Scientist: {
    cost: 1,
    abilities: [{ effect: "discardchoose", cost: 1 }],
    junkEffect: "raid",
  },
  "Rescue Team": {
    cost: 1,
    abilities: [{ effect: "returnperson", cost: 0 }],
    junkEffect: "injure",
  },
  "Magnus Karv": {
    cost: 3,
    abilities: [{ effect: "damagecolumn", cost: 2 }],
    junkEffect: "punk",
  },
  Exterminator: {
    cost: 1,
    abilities: [{ effect: "destroyalldamaged", cost: 1 }],
    junkEffect: "card",
  },
  Gunner: {
    cost: 1,
    abilities: [{ effect: "injureall", cost: 2 }],
    junkEffect: "restore",
  },
  Pyromaniac: {
    cost: 1,
    abilities: [{ effect: "damagecamp", cost: 1 }],
    junkEffect: "injure",
  },
  "Molgur Stang": {
    cost: 4,
    abilities: [{ effect: "destroycamp", cost: 1 }],
    junkEffect: "punk",
  },
  Doomsayer: {
    cost: 1,
    abilities: [{ effect: "conditionaldamage", cost: 1 }],
    junkEffect: "card",
  },
  Scout: {
    cost: 1,
    abilities: [{ effect: "raid", cost: 1 }],
    junkEffect: "water",
  },
  Holdout: {
    cost: 2,
    abilities: [{ effect: "damage", cost: 1 }],
    junkEffect: "raid",
  },
};

const EVENT_CARDS = {
  Interrogate: { cost: 1, queueNumber: 0, junkEffect: "water" },
  Truce: { cost: 2, queueNumber: 0, junkEffect: "injure" },
  Strafe: { cost: 2, queueNumber: 0, junkEffect: "card" },
  "High Ground": { cost: 0, queueNumber: 1, junkEffect: "water" },
  Famine: { cost: 1, queueNumber: 1, junkEffect: "injure" },
  Napalm: { cost: 2, queueNumber: 1, junkEffect: "restore" },
  Radiation: { cost: 2, queueNumber: 1, junkEffect: "raid" },
  Banish: { cost: 1, queueNumber: 1, junkEffect: "raid" },
  Uprising: { cost: 1, queueNumber: 2, junkEffect: "injure" },
  Bombardment: { cost: 4, queueNumber: 3, junkEffect: "restore" },
};

const CAMP_CARDS = {
  "The Octagon": {
    campDraw: 0,
    abilities: [{ effect: "destroy", cost: 1 }],
  },
  "Labor Camp": {
    campDraw: 1,
    abilities: [{ effect: "destroyrestore", cost: 0 }],
  },
  "Blood Bank": {
    campDraw: 1,
    abilities: [{ effect: "destroywater", cost: 0 }],
  },
  "Adrenaline Lab": {
    campDraw: 1,
    abilities: [{ effect: "usedamagedability", cost: 0 }],
  },
  Juggernaut: {
    campDraw: 0,
    abilities: [{ effect: "move", cost: 1 }],
  },
  "Parachute Base": {
    campDraw: 1,
    abilities: [{ effect: "paradrop", cost: 0 }],
  },
  Bonfire: {
    campDraw: 1,
    abilities: [{ effect: "damagerestoremany", cost: 0 }],
  },
  "Atomic Garden": {
    campDraw: 1,
    abilities: [{ effect: "restoreready", cost: 2 }],
  },
  Mulcher: {
    campDraw: 0,
    abilities: [{ effect: "destroydraw", cost: 0 }],
  },
  "Construction Yard": {
    campDraw: 1,
    abilities: [
      { effect: "moveperson", cost: 1 },
      { effect: "raid", cost: 2 },
    ],
  },
  "Scavenger Camp": {
    campDraw: 1,
    abilities: [{ effect: "discardchoose", cost: 0 }],
  },
  "Supply Depot": {
    campDraw: 2,
    abilities: [{ effect: "drawdiscard", cost: 2 }],
  },
  "Omen Clock": {
    campDraw: 1,
    abilities: [{ effect: "advance", cost: 1 }],
  },
  Cache: {
    campDraw: 1,
    abilities: [{ effect: "raidpunk", cost: 2 }],
  },
  Resonator: {
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 1 }],
  },
};

// Example test configurations
const TEST_CONFIGS = {
  // Test camp abilities
  camps: {
    people: ["Looter", "Vigilante", "Mutant", "Repair Bot"],
    events: ["Interrogate", "Strafe"],
    fillTo: 20,
  },

  // Test event cards
  events: {
    people: [
      { name: "Looter", count: 3 },
      { name: "Vigilante", count: 3 },
      "Repair Bot",
      "Vanguard",
    ],
    events: [
      "High Ground",
      "Famine",
      "Uprising",
      "Napalm",
      "Radiation",
      "Bombardment",
      "Banish",
      "Truce",
      "Strafe",
    ],
    fillTo: 25,
  },

  // Test traits
  traits: {
    people: [
      "Karli Blaze",
      "Vera Vosh",
      "Argo Yesky",
      "Looter",
      "Vigilante",
      "Mutant",
    ],
    events: ["Interrogate"],
    fillTo: 15,
  },
};

// Use a test config
gameState.deck = createTestDeck(TEST_CONFIGS.events);

// Test camp configurations
const CAMP_CONFIGS = {
  standard: ["Adrenaline Lab", "Juggernaut", "Parachute Base"],
  bonfire: ["Bonfire", "Atomic Garden", "Mulcher"],
  octagon: ["The Octagon", "Labor Camp", "Blood Bank"],
  construction: ["Construction Yard", "Scavenger Camp", "Supply Depot"],
  advanced: ["Omen Clock", "Cache", "Resonator"],
};

// Choose which test to run
const leftCamps = CAMP_CONFIGS.octagon;
const rightCamps = CAMP_CONFIGS.standard;

// Helper function to create a camp card
function createCamp(name, columnIndex) {
  const campData = CAMP_CARDS[name];

  if (!campData) {
    console.error(`Camp not found: ${name}`);
    return null;
  }

  return {
    id: `${name.toLowerCase().replace(/\s+/g, "_")}_${columnIndex}`,
    name: name,
    type: "camp",
    isReady: true,
    isDamaged: name === "Cannon",
    isDestroyed: false,
    abilities: campData.abilities || [],
    campDraw: campData.campDraw || 0,
  };
}

// Set up left player's camps using the config
leftCamps.forEach((campName, index) => {
  gameState.players.left.columns[index].setCard(0, createCamp(campName, index));
});

// Set up right player's camps using the config
rightCamps.forEach((campName, index) => {
  gameState.players.right.columns[index].setCard(
    0,
    createCamp(campName, index)
  );
});

// Draw initial hands based on camp draw values
for (let i = 0; i < 3; i++) {
  const leftCamp = gameState.players.left.columns[i].getCard(0);
  const rightCamp = gameState.players.right.columns[i].getCard(0);

  // Draw cards for left player
  for (let j = 0; j < (leftCamp?.campDraw || 0); j++) {
    if (gameState.deck.length > 0) {
      gameState.players.left.hand.push(gameState.deck.shift());
    }
  }

  // Draw cards for right player
  for (let j = 0; j < (rightCamp?.campDraw || 0); j++) {
    if (gameState.deck.length > 0) {
      gameState.players.right.hand.push(gameState.deck.shift());
    }
  }
}

console.log(`Left player drew ${gameState.players.left.hand.length} cards`);
console.log(`Right player drew ${gameState.players.right.hand.length} cards`);

// Start both players with 3 water (standard starting amount)
gameState.players.left.water = 3;
gameState.players.right.water = 3;

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
