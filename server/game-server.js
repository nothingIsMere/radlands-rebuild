// server/game-server.js
import { WebSocketServer } from "ws";
import { ServerGameEngine } from "./server-game-engine.js";

class GameServer {
  constructor(port = 3001) {
    this.gameStates = new Map(); // roomId -> authoritative game state
    this.gameEngines = new Map();
    this.port = port;
    this.rooms = new Map(); // roomId -> room data
    this.clients = new Map(); // ws -> client data

    this.wss = new WebSocketServer({ port });
    console.log(`[SERVER] Starting on port ${port}...`);

    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });

    console.log(`[SERVER] Ready! Listening on ws://localhost:${port}`);
  }

  handleConnection(ws) {
    console.log("[SERVER] New connection");

    // Store client info
    this.clients.set(ws, {
      ws: ws,
      playerId: null,
      roomId: null,
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error("[SERVER] Invalid message:", error);
      }
    });

    ws.on("close", () => {
      this.handleDisconnect(ws);
    });
  }

  handlePlayerDrewCard(ws, message) {
    const client = this.clients.get(ws);
    const room = this.rooms.get(client.roomId);
    if (!room) return;

    // Update server's game state
    const playerState = room.gameState.players[message.playerId];
    playerState.handCount = message.handCount;
    playerState.water = message.water;
    room.gameState.deckCount = message.deckCount;

    console.log(
      `[SERVER] ${message.playerId} drew card - hand: ${playerState.handCount}, water: ${playerState.water}`
    );

    // Broadcast to BOTH players
    this.broadcastToRoom(client.roomId, {
      type: "PLAYER_DREW_CARD_SYNC",
      playerId: message.playerId,
      handCount: playerState.handCount,
      water: playerState.water,
      deckCount: room.gameState.deckCount,
    });
  }

  handleMessage(ws, message) {
    const client = this.clients.get(ws);
    console.log(
      "[SERVER] Message from",
      client.playerId || "unknown",
      ":",
      message.type
    );

    switch (message.type) {
      case "JOIN_ROOM":
        this.handleJoinRoom(ws, message.roomId);
        break;

      case "GAME_ACTION":
        this.handleGameAction(ws, message);
        break;

      case "UPDATE_SERVER_STATE":
        this.handleStateUpdate(ws, message);
        break;

      case "PLAYER_DREW_CARD":
        this.handlePlayerDrewCard(ws, message);
        break;

      default:
        console.log("[SERVER] Unknown message type:", message.type);
    }
  }

  handleJoinRoom(ws, roomId) {
    const client = this.clients.get(ws);

    // Get or create room
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        players: {
          left: null,
          right: null,
        },
        gameState: {
          currentPlayer: "left",
          turnNumber: 1,
          phase: "setup",
          deckCount: 0,
          discardCount: 0,
          players: {
            left: {
              handCount: 0,
              water: 0,
              raiders: "available",
              waterSilo: "available",
              camps: [],
            },
            right: {
              handCount: 0,
              water: 0,
              raiders: "available",
              waterSilo: "available",
              camps: [],
            },
          },
        },
        actionLog: [],
      };
      this.rooms.set(roomId, room);
      console.log(`[SERVER] Created room: ${roomId} with initial state`);
    }

    // Create game engine for this room
    if (!this.gameEngines.has(roomId)) {
      this.gameEngines.set(roomId, new ServerGameEngine(roomId));
      console.log(`[SERVER] Created game engine for room ${roomId}`);
    }

    // Assign player to first available slot
    let assignedPlayerId = null;
    if (!room.players.left) {
      room.players.left = ws;
      assignedPlayerId = "left";
    } else if (!room.players.right) {
      room.players.right = ws;
      assignedPlayerId = "right";
    } else {
      // Room full
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "Room is full",
        })
      );
      return;
    }

    // Update client info
    client.playerId = assignedPlayerId;
    client.roomId = roomId;

    // Tell player their assignment
    ws.send(
      JSON.stringify({
        type: "PLAYER_ASSIGNED",
        playerId: assignedPlayerId,
        roomId: roomId,
      })
    );

    console.log(
      `[SERVER] Player joined as ${assignedPlayerId} in room ${roomId}`
    );

    // If both players connected, start the game
    if (room.players.left && room.players.right) {
      console.log(`[SERVER] Both players connected - starting game`);

      // Pick random starting player
      const startingPlayer = Math.random() < 0.5 ? "left" : "right";

      // Tell both players to start a fresh game
      this.broadcastToRoom(roomId, {
        type: "START_GAME",
        startingPlayer: startingPlayer,
      });
      console.log("[SERVER] DEFINITELY SENT START_GAME, NOT GAME_READY!");
    }
  }

  handleGameAction(ws, message) {
    const client = this.clients.get(ws);
    if (!client.roomId || !client.playerId) {
      console.error("[SERVER] Client not in room");
      return;
    }

    const engine = this.gameEngines.get(client.roomId);
    if (!engine) {
      console.error("[SERVER] No game engine for room");
      return;
    }

    // Execute command on server
    const result = engine.executeCommand(message.action, client.playerId);

    if (result.success) {
      // Broadcast to ALL players (including sender)
      this.broadcastToRoom(client.roomId, {
        type: "COMMAND_EXECUTED",
        command: result.command,
        stateVersion: result.stateVersion,
        gameState: result.gameState,
        fromPlayer: client.playerId,
      });

      console.log(
        `[SERVER] Broadcasted ${message.action.type} v${result.stateVersion}`
      );
    } else {
      // Tell player command failed
      ws.send(
        JSON.stringify({
          type: "COMMAND_FAILED",
          error: result.error,
        })
      );
    }
  }

  handleStateUpdate(ws, message) {
    const client = this.clients.get(ws);
    if (!client.roomId) return;

    const gameState = this.gameStates.get(client.roomId);
    if (!gameState) return;

    console.log(`[SERVER] State update from ${client.playerId}`);
    console.log(
      `[SERVER] Phase: ${message.payload.phase}, Turn: ${message.payload.turnNumber}`
    );

    // Update server state
    Object.assign(gameState, message.payload);

    // Broadcast to BOTH players
    this.broadcastToRoom(client.roomId, {
      type: "STATE_SYNC",
      gameState: gameState,
      fromPlayer: client.playerId,
    });
  }

  handleDisconnect(ws) {
    const client = this.clients.get(ws);
    if (!client) return;

    console.log(`[SERVER] Player ${client.playerId || "unknown"} disconnected`);

    // Remove from room
    if (client.roomId) {
      const room = this.rooms.get(client.roomId);
      if (room) {
        if (room.players.left === ws) {
          room.players.left = null;
        }
        if (room.players.right === ws) {
          room.players.right = null;
        }

        // Notify other player
        this.broadcastToRoom(
          client.roomId,
          {
            type: "PLAYER_DISCONNECTED",
            playerId: client.playerId,
          },
          ws
        );

        // Clean up empty rooms
        if (!room.players.left && !room.players.right) {
          this.rooms.delete(client.roomId);
          console.log(`[SERVER] Deleted empty room: ${client.roomId}`);
        }
      }
    }

    this.clients.delete(ws);
  }

  broadcastToRoom(roomId, message, excludeWs = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`[SERVER] Broadcasting to room ${roomId}:`, message);

    const messageStr = JSON.stringify(message);

    if (room.players.left && room.players.left !== excludeWs) {
      room.players.left.send(messageStr);
    }
    if (room.players.right && room.players.right !== excludeWs) {
      room.players.right.send(messageStr);
    }
  }
}

// Start the server
const server = new GameServer(3001);
