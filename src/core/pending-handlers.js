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

class RestoreHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || !target.isDamaged) {
      console.log("Must target a damaged card");
      return false;
    }

    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }

    console.log(`Restored ${target.name}!`);

    // Mark ability complete
    this.completeAbility();

    if (this.commandSystem.activeAbilityContext && !this.state.pending) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    // Check for Parachute Base damage
    if (this.state.pending?.parachuteBaseDamage) {
      const pbDamage = this.state.pending.parachuteBaseDamage;
      this.state.pending = null;

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }

      this.commandSystem.applyParachuteBaseDamage(
        pbDamage.targetPlayer,
        pbDamage.targetColumn,
        pbDamage.targetPosition
      );
    } else {
      this.state.pending = null;

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }
    }

    return true;
  }
}

class InjureHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || target.type !== "person") {
      console.log("Can only injure people");
      return false;
    }

    // Store Parachute Base damage info BEFORE resolving
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    this.completeAbility();

    if (this.commandSystem.activeAbilityContext && !this.state.pending) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    // Call resolveInjure (which will clear pending)
    const result = this.commandSystem.resolveInjure(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    // Apply Parachute Base damage if it existed
    if (parachuteBaseDamage) {
      console.log("Applying Parachute Base damage to injured target");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return result;
  }
}

class RaidersSelectCampHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Verify it's the target player selecting their own camp
    if (targetPlayer !== this.state.pending.targetPlayerId) {
      console.log("You must select your own camp");
      return false;
    }

    // Verify it's a camp (position 0)
    if (targetPosition !== 0) {
      console.log("Must select a camp");
      return false;
    }

    const camp = this.state.getCard(targetPlayer, targetColumn, 0);
    if (!camp || camp.type !== "camp" || camp.isDestroyed) {
      console.log("Invalid camp selection");
      return false;
    }

    // Apply damage to the selected camp
    if (camp.isDamaged) {
      camp.isDestroyed = true;
      this.commandSystem.checkGameEnd();
      console.log(`Raiders destroyed ${camp.name}!`);
    } else {
      camp.isDamaged = true;
      console.log(`Raiders damaged ${camp.name}!`);
    }

    // Check if this was from Cache
    const fromCache = this.state.pending.fromCache;
    const cacheSourceCard = this.state.pending.cacheSourceCard;
    const fromCacheComplete = this.state.pending.fromCacheComplete;

    this.completeAbility();

    if (this.commandSystem.activeAbilityContext && !this.state.pending) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    if (fromCache && !fromCacheComplete) {
      // Continue with Cache's punk placement
      console.log("Cache: Raiders resolved, now place your punk");
      this.state.pending = {
        type: "place_punk",
        source: cacheSourceCard,
        sourceCard: cacheSourceCard,
        sourcePlayerId: this.state.pending.sourcePlayerId,
        fromCache: true,
      };
    } else if (fromCacheComplete && cacheSourceCard) {
      // Cache is fully complete after this Raiders
      cacheSourceCard.isReady = false;
      console.log("Cache marked as not ready after Raiders resolution");
      this.state.pending = null;
    } else {
      // Normal Raiders resolution
      this.state.pending = null;
    }

    // Check for game end
    this.commandSystem.checkGameEnd();

    // If we're in events phase, continue with the phase progression
    if (this.state.phase === "events" && !this.state.pending) {
      const player = this.state.players[this.state.currentPlayer];
      for (let i = 0; i < 2; i++) {
        player.eventQueue[i] = player.eventQueue[i + 1];
      }
      player.eventQueue[2] = null;
      this.commandSystem.continueToReplenishPhase();
    }

    return true;
  }
}

// Export a registry of all handlers
export const pendingHandlers = {
  damage: DamageHandler,
  place_punk: PlacePunkHandler,
  restore: RestoreHandler,
  injure: InjureHandler,
  raiders_select_camp: RaidersSelectCampHandler,
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
