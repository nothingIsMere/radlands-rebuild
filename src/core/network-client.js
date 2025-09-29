// core/network-client.js
export class NetworkClient {
  constructor(dispatcher) {
    this.dispatcher = dispatcher;
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.roomId = null;
  }

  connect(serverUrl = "ws://localhost:3001", roomId = "test-room") {
    console.log(`[NETWORK] Connecting to ${serverUrl}...`);

    try {
      this.socket = new WebSocket(serverUrl);
      this.roomId = roomId;

      this.socket.onopen = () => {
        console.log("[NETWORK] Connected!");
        this.connected = true;

        // Tell server we want to join a room
        this.send({
          type: "JOIN_ROOM",
          roomId: this.roomId,
        });

        // Enable network mode in dispatcher
        this.dispatcher.setNetworkMode(true, (action) => {
          this.sendAction(action);
        });
      };

      this.socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.socket.onclose = () => {
        console.log("[NETWORK] Disconnected");
        this.connected = false;
        this.dispatcher.setNetworkMode(false);
      };

      this.socket.onerror = (error) => {
        console.error("[NETWORK] Error:", error);
      };
    } catch (error) {
      console.error("[NETWORK] Failed to connect:", error);
      return false;
    }

    return true;
  }

  handleMessage(message) {
    console.log("[NETWORK] Received message:", message);

    switch (message.type) {
      case "PLAYER_ASSIGNED":
        this.playerId = message.playerId;
        console.log(`[NETWORK] You are player: ${this.playerId}`);
        break;

      case "GAME_ACTION":
        // Server confirmed our action or sent opponent's action
        this.dispatcher.receiveNetworkAction(message.action);
        break;

      case "GAME_STATE":
        // Full state sync (for reconnection)
        console.log("[NETWORK] Received full game state");
        // TODO: Update local state
        break;

      default:
        console.log("[NETWORK] Unknown message type:", message.type);
    }
  }

  sendAction(action) {
    if (!this.connected) {
      console.error("[NETWORK] Not connected");
      return false;
    }

    const message = {
      type: "GAME_ACTION",
      action: action,
      playerId: this.playerId,
      roomId: this.roomId,
    };

    this.send(message);
    return true;
  }

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
