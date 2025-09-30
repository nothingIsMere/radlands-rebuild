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
        console.log("[NETWORK] WebSocket opened successfully");
        this.connected = true;

        // Log what we're sending
        const joinMessage = {
          type: "JOIN_ROOM",
          roomId: this.roomId,
        };
        console.log("[NETWORK] Sending JOIN_ROOM:", joinMessage);
        this.send(joinMessage);
      };

      this.socket.onmessage = (event) => {
        console.log("[NETWORK] Raw message received:", event.data);
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("[NETWORK] Failed to parse message:", error);
        }
      };

      this.socket.onclose = (event) => {
        console.log("[NETWORK] WebSocket closed:", event.code, event.reason);
        this.connected = false;
        this.playerId = null;
        this.dispatcher.setNetworkMode(false);
      };

      this.socket.onerror = (error) => {
        console.error("[NETWORK] WebSocket error:", error);
      };
    } catch (error) {
      console.error("[NETWORK] Failed to create WebSocket:", error);
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

        // Store in window for immediate UI access
        window.networkPlayerId = this.playerId;

        // NOW enable network mode since we have a player ID
        this.dispatcher.setNetworkMode(true, (action) => {
          this.sendAction(action);
        });

        // Force UI re-render to hide opponent's hand
        window.dispatchEvent(new CustomEvent("gameStateChanged"));
        break;

      case "START_GAME":
        console.log(
          `[NETWORK] Starting new game - starting player: ${message.startingPlayer}`
        );

        window.debugGame.state.resetToFreshGame();

        // Set the starting player from the server
        window.debugGame.state.currentPlayer = message.startingPlayer;

        if (this.playerId === "left") {
          console.log("[NETWORK] Left player initiating camp distribution");
          window.debugGame.dispatcher.dispatch({
            type: "START_CAMP_SELECTION",
          });
        } else {
          console.log("[NETWORK] Right player waiting for camp distribution");
          window.debugGame.state.phase = "camp_selection";
        }
        break;

      case "GAME_READY":
        console.log("[NETWORK] Both players connected - game ready!");
        break;

      case "GAME_ACTION":
        // Only process actions from the OTHER player
        // We already executed our own actions locally
        if (message.fromPlayer !== this.playerId) {
          console.log(
            `[NETWORK] Executing opponent's action: ${message.action.type}`
          );
          this.dispatcher.receiveNetworkAction(message.action);
        } else {
          // This is our own action echoed back - just log it, don't execute
          console.log(
            `[NETWORK] Server confirmed our action: ${message.action.type}`
          );
        }
        break;

      case "PLAYER_DISCONNECTED":
        console.log(`[NETWORK] Player ${message.playerId} disconnected`);
        break;

      case "GAME_STATE":
        console.log("[NETWORK] Received full game state");
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

    if (!this.playerId) {
      console.error("[NETWORK] No player ID assigned yet");
      return false;
    }

    const message = {
      type: "GAME_ACTION",
      action: action,
      playerId: this.playerId,
      roomId: this.roomId,
    };

    try {
      this.send(message);
      console.log("[NETWORK] Sent action:", action.type);
    } catch (error) {
      console.error("[NETWORK] Failed to send action:", error);
      this.connected = false;
      this.dispatcher.setNetworkMode(false);
    }

    return true;
  }

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      console.log("[NETWORK] Sending:", messageStr);
      this.socket.send(messageStr);
    } else {
      console.error(
        "[NETWORK] Cannot send - socket not ready. State:",
        this.socket?.readyState
      );
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
