import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

wss.on("connection", (ws) => {
  console.log("Client connected. Total clients:", clients.size + 1);
  clients.add(ws);

  ws.on("close", () => {
    console.log("Client disconnected. Total clients:", clients.size - 1);
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

console.log("Server running on ws://localhost:8080");
