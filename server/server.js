import { WebSocketServer } from "ws";
import { GameState } from "../src/core/game-state.js";
import { CommandSystem } from "../src/core/command-system.js";
import { cardRegistry } from "../src/cards/card-registry.js";

global.cardRegistry = cardRegistry;

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map();
const players = { left: null, right: null };

const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);

// ============================================================================
// CARD DATA DEFINITIONS
// ============================================================================

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
    abilities: [{ effect: "destroy", cost: 2 }],
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
  Railgun: {
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 2 }],
  },
  "Atomic Garden": {
    campDraw: 1,
    abilities: [{ effect: "restoreready", cost: 2 }],
  },
  Cannon: {
    campDraw: 2,
    abilities: [{ effect: "damage", cost: 2 }], // Uses conditional logic in handler
  },
  Pillbox: {
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 3 }], // Discount handled in handler
  },
  "Scud Launcher": {
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 1 }],
  },
  "Victory Totem": {
    campDraw: 1,
    abilities: [
      { effect: "damage", cost: 2 },
      { effect: "raid", cost: 2 },
    ],
  },
  Catapult: {
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 2 }],
  },
  "Nest of Spies": {
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 1 }],
  },
  "Command Post": {
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 3 }], // Discount handled in handler
  },
  Obelisk: {
    campDraw: 1,
    abilities: [],
  },
  "Mercenary Camp": {
    campDraw: 0,
    abilities: [{ effect: "damagecamp", cost: 2 }],
  },
  Reactor: {
    campDraw: 1,
    abilities: [{ effect: "destroyall", cost: 2 }],
  },
  "The Octagon": {
    campDraw: 0,
    abilities: [{ effect: "destroy", cost: 1 }],
  },
  Juggernaut: {
    campDraw: 0,
    abilities: [{ effect: "move", cost: 1 }],
  },
  "Scavenger Camp": {
    campDraw: 1,
    abilities: [{ effect: "discardchoose", cost: 0 }],
  },
  Outpost: {
    campDraw: 1,
    abilities: [
      { effect: "raid", cost: 2 },
      { effect: "restore", cost: 2 },
    ],
  },
  "Transplant Lab": {
    campDraw: 2,
    abilities: [{ effect: "restore", cost: 1 }],
  },
  Resonator: {
    campDraw: 1,
    abilities: [{ effect: "damage", cost: 1 }],
  },
  Bonfire: {
    campDraw: 1,
    abilities: [{ effect: "damagerestoremany", cost: 0 }],
  },
  Cache: {
    campDraw: 1,
    abilities: [{ effect: "raidpunk", cost: 2 }],
  },
  Watchtower: {
    campDraw: 0,
    abilities: [{ effect: "damage", cost: 1 }],
  },
  "Construction Yard": {
    campDraw: 1,
    abilities: [
      { effect: "moveperson", cost: 1 },
      { effect: "raid", cost: 2 },
    ],
  },
  "Adrenaline Lab": {
    campDraw: 1,
    abilities: [{ effect: "usedamagedability", cost: 0 }],
  },
  Mulcher: {
    campDraw: 0,
    abilities: [{ effect: "destroydraw", cost: 0 }],
  },
  "Blood Bank": {
    campDraw: 1,
    abilities: [{ effect: "destroywater", cost: 0 }],
  },
  Arcade: {
    campDraw: 1,
    abilities: [{ effect: "gainpunk", cost: 1 }],
  },
  "Training Camp": {
    campDraw: 2,
    abilities: [{ effect: "damage", cost: 2 }],
  },
  "Supply Depot": {
    campDraw: 2,
    abilities: [{ effect: "drawdiscard", cost: 2 }],
  },
  "Omen Clock": {
    campDraw: 1,
    abilities: [{ effect: "advance", cost: 1 }],
  },
  Warehouse: {
    campDraw: 1,
    abilities: [{ effect: "restore", cost: 1 }],
  },
  Garage: {
    campDraw: 0,
    abilities: [{ effect: "raid", cost: 1 }],
  },
  Oasis: {
    campDraw: 1,
    abilities: [], // Passive trait only
  },
  "Parachute Base": {
    campDraw: 1,
    abilities: [{ effect: "paradrop", cost: 0 }],
  },
  "Labor Camp": {
    campDraw: 1,
    abilities: [{ effect: "destroyrestore", cost: 0 }],
  },
};

global.CAMP_CARDS = CAMP_CARDS;

// ============================================================================
// DECK CREATION FUNCTIONS
// ============================================================================

function createFullDeck() {
  const deck = [];

  // 6 unique people (1 copy each)
  [
    "Karli Blaze",
    "Vera Vosh",
    "Argo Yesky",
    "Zeto Kahn",
    "Magnus Karv",
    "Molgur Stang",
  ].forEach((name) => {
    const data = PERSON_CARDS[name];
    deck.push({
      id: `${name.replace(/\s+/g, "_")}_unique`,
      name,
      type: "person",
      cost: data.cost,
      abilities: data.abilities,
      junkEffect: data.junkEffect,
    });
  });

  // 20 people (2 copies each)
  [
    "Looter",
    "Wounded Soldier",
    "Cult Leader",
    "Repair Bot",
    "Gunner",
    "Assassin",
    "Scientist",
    "Mutant",
    "Vigilante",
    "Rescue Team",
    "Muse",
    "Mimic",
    "Exterminator",
    "Scout",
    "Pyromaniac",
    "Holdout",
    "Doomsayer",
    "Rabble Rouser",
    "Vanguard",
    "Sniper",
  ].forEach((name) => {
    const data = PERSON_CARDS[name];
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: `${name.replace(/\s+/g, "_")}_${i}`,
        name,
        type: "person",
        cost: data.cost,
        abilities: data.abilities,
        junkEffect: data.junkEffect,
      });
    }
  });

  // 10 events (2 copies each)
  [
    "Interrogate",
    "Truce",
    "Uprising",
    "Radiation",
    "Famine",
    "Napalm",
    "Strafe",
    "Bombardment",
    "High Ground",
    "Banish",
  ].forEach((name) => {
    const data = EVENT_CARDS[name];
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: `${name.replace(/\s+/g, "_")}_${i}`,
        name,
        type: "event",
        cost: data.cost,
        queueNumber: data.queueNumber,
        junkEffect: data.junkEffect,
      });
    }
  });

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  console.log(`Created deck: 46 people + 20 events = ${deck.length} cards`);
  return deck;
}

// Add this function near your other game functions
function regenerateCamps() {
  console.log("Regenerating camp offers...");

  // Create a fresh camp deck
  gameState.campDeck = createCampDeck();

  // Generate new camp offers from the fresh deck
  gameState.campOffers = {
    left: gameState.campDeck.splice(0, 6),
    right: gameState.campDeck.splice(0, 6),
  };

  // Clear any existing selections
  gameState.campSelections = { left: null, right: null };

  console.log("New left camps:", gameState.campOffers.left);
  console.log("New right camps:", gameState.campOffers.right);

  // Broadcast updated state to both players
  broadcast({
    type: "STATE_SYNC",
    state: gameState,
  });
}

function createCampDeck() {
  const camps = [
    "Railgun",
    "Atomic Garden",
    "Cannon",
    "Pillbox",
    "Scud Launcher",
    "Victory Totem",
    "Catapult",
    "Nest of Spies",
    "Command Post",
    "Obelisk",
    "Mercenary Camp",
    "Reactor",
    "The Octagon",
    "Juggernaut",
    "Scavenger Camp",
    "Outpost",
    "Transplant Lab",
    "Resonator",
    "Bonfire",
    "Cache",
    "Watchtower",
    "Construction Yard",
    "Adrenaline Lab",
    "Mulcher",
    "Blood Bank",
    "Arcade",
    "Training Camp",
    "Supply Depot",
    "Omen Clock",
    "Warehouse",
    "Garage",
    "Oasis",
    "Parachute Base",
    "Labor Camp",
  ];

  for (let i = camps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [camps[i], camps[j]] = [camps[j], camps[i]];
  }

  return camps;
}

function createCamp(name, columnIndex) {
  const data = CAMP_CARDS[name];
  if (!data) {
    console.error(`Camp not found: ${name}`);
    return null;
  }

  return {
    id: `${name.replace(/\s+/g, "_")}_${columnIndex}`,
    name,
    type: "camp",
    isReady: true,
    isDamaged: name === "Cannon",
    isDestroyed: false,
    abilities: data.abilities || [],
    campDraw: data.campDraw || 0,
  };
}

// ============================================================================
// GAME SETUP - Wait for both players, then start camp selection
// ============================================================================

gameState.phase = "waiting";

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((playerId, ws) => {
    if (ws.readyState === 1) ws.send(data);
  });
}

wss.on("connection", (ws) => {
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
  console.log(`${playerId} connected. Total clients: ${clients.size}`);

  ws.send(
    JSON.stringify({
      type: "PLAYER_ASSIGNED",
      playerId: playerId,
    })
  );

  // Start camp selection when both players are connected
  if (players.left && players.right && gameState.phase === "waiting") {
    console.log("Both players connected - starting camp selection");

    gameState.deck = createFullDeck();
    gameState.campDeck = createCampDeck();

    gameState.campOffers = {
      left: gameState.campDeck.splice(0, 6),
      right: gameState.campDeck.splice(0, 6),
    };

    gameState.campSelections = { left: null, right: null };
    gameState.phase = "camp_selection";

    console.log("Left camps:", gameState.campOffers.left);
    console.log("Right camps:", gameState.campOffers.right);

    // Create a plain serializable state object
    const stateToSend = {
      players: gameState.players,
      currentPlayer: gameState.currentPlayer,
      turnNumber: gameState.turnNumber,
      phase: gameState.phase,
      deck: gameState.deck,
      discard: gameState.discard,
      pending: gameState.pending,
      turnEvents: gameState.turnEvents,
      campOffers: gameState.campOffers,
      campSelections: gameState.campSelections,
      campDeck: gameState.campDeck,
    };

    const stateMessage = JSON.stringify({
      type: "STATE_SYNC",
      state: stateToSend,
    });

    if (players.left && players.left.readyState === 1) {
      players.left.send(stateMessage);
    }
    if (players.right && players.right.readyState === 1) {
      players.right.send(stateMessage);
    }
  } else {
    // Send state to just this player
    ws.send(
      JSON.stringify({
        type: "STATE_SYNC",
        state: gameState,
      })
    );
  }

  // Handle incoming messages
  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "COMMAND") {
      console.log(`Received command from ${playerId}:`, message.command.type);

      const success = commandSystem.execute(message.command);

      if (success) {
        console.log("Command executed successfully, broadcasting state");
        broadcast({
          type: "STATE_SYNC",
          state: gameState,
        });
      } else {
        console.log("Command failed validation");
      }
    } else if (message.type === "REGENERATE_CAMPS") {
      // Add this new handler
      console.log("Regenerating camps requested");
      regenerateCamps();
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
