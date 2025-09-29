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
    const validation = this.validateAction(action);
    if (!validation.valid) {
      console.error("Invalid action:", validation.error, action);
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
