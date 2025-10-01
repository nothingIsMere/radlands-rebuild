export class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket("ws://localhost:8080");

      this.ws.onopen = () => {
        this.connected = true;
        console.log("Connected to server");
        resolve();
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
