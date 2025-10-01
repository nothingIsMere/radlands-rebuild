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

  dispatch(action) {
    // Validate action
    const validation = this.validateAction(action);
    if (!validation.valid) {
      console.error("Invalid action:", validation.error, action);
      return false;
    }

    // Log the action
    this.logAction(action);

    // In network mode: ONLY send to server, NEVER execute locally
    if (this.networkMode && this.networkHandler) {
      console.log(
        "[DISPATCHER] Sending to server (will execute when confirmed):",
        action.type
      );
      this.networkHandler(action);
      return true; // Don't execute - wait for server echo
    }

    // Local mode only - execute immediately
    this.notifyListeners(action);
    return this.executeLocal(action);
  }

  setNetworkMode(enabled, handler = null) {
    this.networkMode = enabled;
    this.networkHandler = handler;
    // console.log(`[DISPATCHER] Network mode: ${enabled ? "ON" : "OFF"}`);
  }

  // ONLY called when server sends back a confirmed action
  receiveNetworkAction(action) {
    // console.log("[DISPATCHER] Executing SERVER-CONFIRMED action:", action.type);

    // Execute the action that server validated
    const result = this.executeLocal(action);

    // Force UI update
    window.dispatchEvent(new CustomEvent("gameStateChanged"));

    return result;
  }

  validateAction(action) {
    if (!action || typeof action !== "object") {
      return { valid: false, error: "Action must be an object" };
    }

    if (!action.type) {
      return { valid: false, error: "Action missing type" };
    }

    const validTypes = Object.values(ActionTypes);
    if (!validTypes.includes(action.type)) {
      return { valid: false, error: `Unknown action type: ${action.type}` };
    }

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

      case ActionTypes.DRAW_CARD:
        if (!action.playerId) {
          return { valid: false, error: "Draw card requires playerId" };
        }
        break;
    }

    return { valid: true };
  }

  executeLocal(action) {
    return this.commandSystem.execute(action);
  }

  logAction(action) {
    const logEntry = {
      timestamp: Date.now(),
      action: action,
      player: action.playerId || "system",
    };

    this.actionLog.push(logEntry);
    // console.log("[ACTION]", action.type, action);
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(action) {
    this.listeners.forEach((listener) => {
      try {
        listener(action);
      } catch (error) {
        // console.error("Listener error:", error);
      }
    });
  }

  getRecentActions(count = 10) {
    return this.actionLog.slice(-count);
  }

  clearActionLog() {
    this.actionLog = [];
  }
}
