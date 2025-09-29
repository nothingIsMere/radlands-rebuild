// core/action-dispatcher.js
import { ActionTypes } from "./action-types.js";

export class ActionDispatcher {
  constructor(commandSystem) {
    this.commandSystem = commandSystem;
    this.listeners = [];
    this.actionLog = [];
  }

  // Main dispatch method - all actions go through here
  dispatch(action) {
    // Validate action structure
    if (!action.type) {
      console.error("Action missing type:", action);
      return false;
    }

    // Log the action (useful for debugging and replay)
    this.logAction(action);

    // Notify any listeners (for future multiplayer/replay)
    this.notifyListeners(action);

    // For now, just pass through to command system
    // Later this will check if action is local or needs to go to server
    return this.executeLocal(action);
  }

  executeLocal(action) {
    // Execute the action locally
    return this.commandSystem.execute(action);
  }

  logAction(action) {
    const logEntry = {
      timestamp: Date.now(),
      action: action,
      player: action.playerId || "system",
    };

    this.actionLog.push(logEntry);
    console.log("[ACTION]", action.type, action);
  }

  // For future multiplayer - listeners can be network connections
  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(action) {
    this.listeners.forEach((listener) => {
      listener(action);
    });
  }

  // Utility method to get recent actions (useful for debugging)
  getRecentActions(count = 10) {
    return this.actionLog.slice(-count);
  }
}
