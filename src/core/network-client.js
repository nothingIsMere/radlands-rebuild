export class NetworkClient {
  constructor(onStateUpdate, onPlayerAssigned) {
    this.ws = null;
    this.connected = false;
    this.onStateUpdate = onStateUpdate;
    this.onPlayerAssigned = onPlayerAssigned;
    this.myPlayerId = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        console.log("Connected to server");
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "PLAYER_ASSIGNED") {
          this.myPlayerId = message.playerId;
          console.log("Assigned as player:", this.myPlayerId);
          this.onPlayerAssigned(message.playerId);
        }

        if (message.type === "STATE_SYNC") {
          console.log("Received state from server");
          console.log(
            "campOffers in received message:",
            message.state.campOffers
          );
          this.onStateUpdate(message.state);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Connection error:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log("Disconnected from server");
      };
    });
  }

  sendCommand(command) {
    if (!this.connected) {
      console.error("Cannot send command - not connected");
      return false;
    }

    console.log("Sending command to server:", command.type);
    this.ws.send(
      JSON.stringify({
        type: "COMMAND",
        command: command,
      })
    );
    return true;
  }
}
