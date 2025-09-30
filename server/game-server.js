// server/game-server.js
import { WebSocketServer } from "ws";

class GameServer {
  constructor(port = 3001) {
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
        gameState: null,
        actionLog: [],
      };
      this.rooms.set(roomId, room);
      console.log(`[SERVER] Created room: ${roomId}`);
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

    const room = this.rooms.get(client.roomId);
    if (!room) {
      console.error("[SERVER] Room not found");
      return;
    }

    // Log the action
    room.actionLog.push({
      timestamp: Date.now(),
      playerId: client.playerId,
      action: message.action,
    });

    // Broadcast action to both players
    this.broadcastToRoom(client.roomId, {
      type: "GAME_ACTION",
      action: message.action,
      fromPlayer: client.playerId,
    });

    console.log(
      `[SERVER] Broadcasted ${message.action.type} from ${client.playerId}`
    );
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
