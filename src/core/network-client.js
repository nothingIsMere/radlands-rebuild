export class NetworkClient {
  constructor(onStateUpdate) {
    this.ws = null;
    this.connected = false;
    this.onStateUpdate = onStateUpdate;
    this.myPlayerId = null;
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

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket("ws://localhost:8080");

      this.ws.onopen = () => {
        this.connected = true;
        console.log("Connected to server");
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "STATE_SYNC") {
          console.log("Received state from server");
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
}
