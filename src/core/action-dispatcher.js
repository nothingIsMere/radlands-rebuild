// core/action-dispatcher.js
import { ActionTypes } from "./action-types.js";
import { CampSelectionHandler } from "./camp-selection.js";

export class ActionDispatcher {
  constructor(commandSystem) {
    this.commandSystem = commandSystem;
    this.listeners = [];
    this.actionLog = [];
    this.networkMode = false;
    this.networkHandler = null;
    this.campHandler = new CampSelectionHandler(this.state, this);
  }

  // Main dispatch method - all actions go through here

  dispatch(action) {
    // Validate action
    const validation = this.validateAction(action);
    if (!validation.valid) {
      console.error("Invalid action:", validation.error, action);
      return false;
    }

    // Log the action
    this.logAction(action);

    // Special handling for sync actions in network mode
    if (this.networkMode && this.networkHandler) {
      // These actions should go to server
      const serverActions = [
        "SYNC_PHASE_CHANGE",
        "SYNC_REPLENISH_COMPLETE",
        "PLAYER_DREW_CARD",
        "UPDATE_SERVER_STATE",
      ];

      if (serverActions.includes(action.type)) {
        console.log("[DISPATCHER] Sending sync to server:", action.type);
        this.networkHandler(action);
        // Don't execute locally - wait for server
        return true;
      }

      // Regular game actions
      console.log("[DISPATCHER] Sending to server:", action.type);
      this.networkHandler(action);
      // Wait for server to echo back
      return true;
    }

    // Local mode - execute immediately
    this.notifyListeners(action);
    return this.executeLocal(action);
  }

  // Add these methods:
  setNetworkMode(enabled, handler = null) {
    this.networkMode = enabled;
    this.networkHandler = handler;
    console.log(`[DISPATCHER] Network mode: ${enabled ? "ON" : "OFF"}`);
  }

  // For when server sends an action to execute
  receiveNetworkAction(action) {
    console.log("[NETWORK] Received:", action.type);

    // Execute ALL actions from server, including our own
    this.logAction(action);
    this.notifyListeners(action);
    const result = this.executeLocal(action);

    // Force UI update
    window.dispatchEvent(new CustomEvent("gameStateChanged"));

    return result;
  }

  validateAction(action) {
    // Basic structure validation
    if (!action || typeof action !== "object") {
      return { valid: false, error: "Action must be an object" };
    }

    if (!action.type) {
      return { valid: false, error: "Action missing type" };
    }

    // Check if action type is valid
    const validTypes = Object.values(ActionTypes);
    if (!validTypes.includes(action.type)) {
      return { valid: false, error: `Unknown action type: ${action.type}` };
    }

    // Type-specific validation
    switch (action.type) {
      case ActionTypes.PLAY_CARD:
      case ActionTypes.USE_ABILITY:
      case ActionTypes.USE_CAMP_ABILITY:
      case ActionTypes.JUNK_CARD:
      case ActionTypes.END_TURN:
      case ActionTypes.TAKE_WATER_SILO:
        if (!action.playerId) {
          return { valid: false, error: "Action requires playerId" };
        }
        if (action.playerId !== "left" && action.playerId !== "right") {
          return { valid: false, error: "Invalid playerId" };
        }
        break;

      case ActionTypes.SELECT_TARGET:
        // SELECT_TARGET is special - doesn't always need playerId
        break;

      case ActionTypes.DRAW_CARD:
        if (!action.playerId) {
          return { valid: false, error: "Draw card requires playerId" };
        }
        break;
    }

    return { valid: true };
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
      try {
        listener(action);
      } catch (error) {
        console.error("Listener error:", error);
      }
    });
  }

  // Utility method to get recent actions (useful for debugging)
  getRecentActions(count = 10) {
    return this.actionLog.slice(-count);
  }

  // Clear the action log (useful for new games)
  clearActionLog() {
    this.actionLog = [];
  }
}
