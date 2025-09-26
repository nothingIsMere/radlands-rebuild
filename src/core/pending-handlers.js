// pending-handlers.js
import { TargetValidator } from "./target-validator.js";

// Base handler that all specific handlers will extend
class PendingHandler {
  constructor(state, commandSystem) {
    this.state = state;
    this.commandSystem = commandSystem;
  }

  // Every handler must implement this method
  handle(payload) {
    throw new Error("Handler must implement handle method");
  }

  // Helper methods that many handlers will use
  resolveDamage(targetPlayer, targetColumn, targetPosition) {
    return this.commandSystem.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );
  }

  completeAbility() {
    return this.commandSystem.completeAbility(this.state.pending);
  }

  applyDamageToCard(target, targetPlayer, targetColumn, targetPosition) {
    return this.commandSystem.applyDamageToCard(
      target,
      targetPlayer,
      targetColumn,
      targetPosition
    );
  }
}

// Now create specific handlers for each pending type
class DamageHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Store Parachute Base info before resolving
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    // Mark ability complete BEFORE resolving damage
    this.completeAbility();

    if (this.commandSystem.activeAbilityContext && !this.state.pending) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    // Resolve the damage (this clears pending)
    const result = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    // Apply Parachute Base damage if needed
    if (result && parachuteBaseDamage) {
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return result;
  }
}

class PlacePunkHandler extends PendingHandler {
  handle(payload) {
    const { targetColumn, targetPosition } = payload;

    // Store info BEFORE resolving
    const junkCard = this.state.pending?.junkCard;
    const fromCache = this.state.pending?.fromCache;
    const doRaidAfter = this.state.pending?.doRaidAfter;
    const sourcePlayerId = this.state.pending?.sourcePlayerId;
    const sourceCard = this.state.pending?.sourceCard;

    // Resolve the punk placement
    const result = this.commandSystem.resolvePlacePunk(
      targetColumn,
      targetPosition
    );

    // If successful and this was from a junk effect, discard the card
    if (result && junkCard) {
      this.state.discard.push(junkCard);
      console.log(`Discarded ${junkCard.name} after placing punk`);
    }

    // Handle Cache's raid-after flag
    if (result && fromCache && doRaidAfter) {
      console.log("Cache: Punk placed, now executing Raid");
      this.commandSystem.executeRaid(sourcePlayerId);
    }

    // Mark camp ability complete if this was from a camp
    if (result && sourceCard && sourceCard.type === "camp" && !fromCache) {
      if (!this.state.pending?.shouldStayReady) {
        sourceCard.isReady = false;
        console.log(
          `${sourceCard.name} marked as not ready after placing punk`
        );
      }
      this.state.turnEvents.abilityUsedThisTurn = true;
    }

    return result;
  }
}

// Export a registry of all handlers
export const pendingHandlers = {
  damage: DamageHandler,
  place_punk: PlacePunkHandler,
  // We'll add more handlers here
};

// Export a function to get the right handler
export function getPendingHandler(type, state, commandSystem) {
  const HandlerClass = pendingHandlers[type];
  if (!HandlerClass) {
    console.warn(`No handler found for pending type: ${type}`);
    return null;
  }
  return new HandlerClass(state, commandSystem);
}
