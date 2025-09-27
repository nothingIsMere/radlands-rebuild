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
  isValidTarget(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;
    return this.state.pending.validTargets?.some(
      (t) =>
        t.playerId === targetPlayer &&
        t.columnIndex === targetColumn &&
        t.position === targetPosition
    );
  }

  getTarget(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;
    return this.state.getCard(targetPlayer, targetColumn, targetPosition);
  }

  handleParachuteBaseDamage() {
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
    if (parachuteBaseDamage) {
      console.log("Applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }
  }

  finalizeAbility() {
    this.completeAbility();
    if (this.commandSystem.activeAbilityContext && !this.state.pending) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }
  }
  isValidTarget(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;
    return this.state.pending.validTargets?.some(
      (t) =>
        t.playerId === targetPlayer &&
        t.columnIndex === targetColumn &&
        t.position === targetPosition
    );
  }

  getTarget(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;
    return this.state.getCard(targetPlayer, targetColumn, targetPosition);
  }

  handleParachuteBaseDamage() {
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
    if (parachuteBaseDamage) {
      console.log("Applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }
  }

  finalizeAbility() {
    this.completeAbility();
    if (this.commandSystem.activeAbilityContext && !this.state.pending) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }
  }

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

class DamageHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Store Parachute info
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    // Use the new helper
    this.finalizeAbility();

    // Resolve the damage
    const result = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    // Use the new helper for Parachute
    if (result && parachuteBaseDamage) {
      this.handleParachuteBaseDamage();
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
    // Use the new helpers
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid injure target");
      return false;
    }

    const target = this.getTarget(payload);
    if (!target || target.type !== "person") {
      console.log("Can only injure people");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    this.finalizeAbility();

    const result = this.commandSystem.resolveInjure(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (parachuteBaseDamage) {
      this.handleParachuteBaseDamage();
    }

    return result;
  }
}

// Base class for all damage-like effects
class DamageBasedHandler extends PendingHandler {
  requiresValidTarget = true;

  handle(payload) {
    if (this.requiresValidTarget && !this.isValidTarget(payload)) {
      console.log(`Not a valid target for ${this.state.pending.type}`);
      return false;
    }

    return this.executeDamage(payload);
  }

  executeDamage(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    this.finalizeAbility();

    const result = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (result && parachuteBaseDamage) {
      this.handleParachuteBaseDamage();
    }

    return result;
  }
}

// Now specific damage variants are TINY
class SniperDamageHandler extends DamageBasedHandler {
  handle(payload) {
    // Sniper ignores protection, so we set up different pending
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid target for Sniper");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    this.finalizeAbility();

    // Set up for damage with allowProtected flag
    this.state.pending = {
      type: "damage",
      sourcePlayerId: this.state.pending.sourcePlayerId,
      allowProtected: true,
    };

    const result = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (result && parachuteBaseDamage) {
      this.handleParachuteBaseDamage();
    }

    return result;
  }
}

class PyromanciacDamageHandler extends DamageBasedHandler {
  // Just inherits everything - it's just normal damage to camps
}

class LooterDamageHandler extends DamageBasedHandler {
  executeDamage(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // STORE THESE BEFORE finalizeAbility() clears pending!
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const parachuteBaseDamage = this.state.pending.parachuteBaseDamage;

    const targetCard = this.getTarget(payload);
    const isTargetCamp = targetCard?.type === "camp";

    this.finalizeAbility(); // This sets pending to null

    const damaged = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (damaged && isTargetCamp) {
      // Use the stored sourcePlayerId, not this.state.pending.sourcePlayerId
      const result = this.state.drawCardWithReshuffle(true, sourcePlayerId);
      if (result.gameEnded) {
        this.commandSystem.notifyUI("GAME_OVER", this.state.winner);
        return;
      }
      if (result.card) {
        console.log(`Looter bonus: Drew ${result.card.name} for hitting camp`);
      }
    }

    if (parachuteBaseDamage) {
      this.state.pending = { parachuteBaseDamage };
      this.commandSystem.checkAndApplyParachuteBaseDamage();
    }

    return damaged;
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

class AssassinDestroyHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid assassin target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person") {
      console.log("Assassin can only destroy people");
      return false;
    }

    // Store values before clearing pending
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const entryTrait = this.state.pending.entryTrait; // ADD THIS

    // Clear pending BEFORE destroying (important!)
    this.state.pending = null;

    // Now destroy the target
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
        abilities: target.abilities || [],
        junkEffect: target.junkEffect,
      };
      this.state.deck.unshift(returnCard);
      console.log("Assassin destroyed punk (returned to deck)");
    } else {
      this.state.discard.push(target);
      console.log(`Assassin destroyed ${target.name}`);
    }

    // Remove from column and handle shifting
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // Handle entry trait if present (like Parachute Base damage)
    if (entryTrait) {
      console.log("Executing entry trait after Assassin destroy");
      this.commandSystem.handleEntryTrait(entryTrait);
    }

    // Finalize ability context if it exists
    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Junk effect handlers
class JunkRestoreHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid restore target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || !target.isDamaged) {
      console.log("Must target a damaged card");
      return false;
    }

    // Store junk card before clearing pending
    const junkCard = this.state.pending.junkCard;

    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }
    console.log(`Junk restored ${target.name}!`);

    // Discard the junk card
    if (junkCard) {
      this.state.discard.push(junkCard);
      console.log(`Discarded ${junkCard.name} after junk restore`);
    }

    this.state.pending = null;
    return true;
  }
}

class JunkInjureHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid injure target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person") {
      console.log("Can only injure people");
      return false;
    }

    // Store junk card before clearing pending
    const junkCard = this.state.pending.junkCard;

    // Apply injury
    const column = this.state.players[targetPlayer].columns[targetColumn];

    if (target.isDamaged || target.isPunk) {
      // Destroy instead
      target.isDestroyed = true;

      if (target.isPunk) {
        const returnCard = {
          id: target.id,
          name: target.originalName || "Unknown Card",
          type: "person",
          cost: target.cost || 0,
        };
        this.state.deck.unshift(returnCard);
      } else {
        this.state.discard.push(target);
      }

      column.setCard(targetPosition, null);
      if (targetPosition === 1) {
        const cardInFront = column.getCard(2);
        if (cardInFront) {
          column.setCard(1, cardInFront);
          column.setCard(2, null);
        }
      }

      console.log(`Junk destroyed ${target.isPunk ? "punk" : target.name}`);
    } else {
      target.isDamaged = true;
      target.isReady = false;
      console.log(`Junk injured ${target.name}`);
    }

    // Discard the junk card
    if (junkCard) {
      this.state.discard.push(junkCard);
      console.log(`Discarded ${junkCard.name} after junk injure`);
    }

    this.state.pending = null;
    return true;
  }
}

// Vanguard handlers
class VanguardDamageHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid vanguard target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Store values before clearing pending
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const vanguardCard = this.state.pending.sourceCard;

    this.finalizeAbility();

    // Resolve the damage
    const damaged = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (damaged) {
      console.log("Vanguard damage successful - opponent may counter-damage");

      // Set up counter-damage opportunity
      const counterTargets = TargetValidator.findValidTargets(
        this.state,
        targetPlayer, // The damaged player gets to counter
        {
          allowProtected: false,
        }
      );

      if (
        counterTargets.length > 0 &&
        vanguardCard &&
        !vanguardCard.isDestroyed
      ) {
        this.state.pending = {
          type: "vanguard_counter",
          sourcePlayerId: targetPlayer, // Opponent becomes source
          originalSourcePlayerId: sourcePlayerId,
          vanguardCard: vanguardCard,
          validTargets: counterTargets,
        };
        console.log(
          `Opponent may counter-damage (${counterTargets.length} targets)`
        );
      }
    }

    return damaged;
  }
}

class VanguardCounterHandler extends PendingHandler {
  handle(payload) {
    const { cancel } = payload;

    if (cancel) {
      console.log("Opponent chose not to counter-damage");
      this.state.pending = null;
      return true;
    }

    if (!this.isValidTarget(payload)) {
      console.log("Not a valid counter target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    console.log(
      `Counter-damaging ${target?.name} at ${targetPlayer} ${targetColumn},${targetPosition}`
    );

    // Clear pending FIRST so UI updates
    this.state.pending = null;

    // Apply damage to the target
    if (target.isDamaged) {
      target.isDestroyed = true;

      if (target.type === "camp") {
        this.commandSystem.checkGameEnd();
        console.log(`Counter-damage destroyed ${target.name} camp!`);
      } else if (target.isPunk) {
        const returnCard = {
          id: target.id,
          name: target.originalName || "Unknown Card",
          type: "person",
          cost: target.cost || 0,
        };
        this.state.deck.unshift(returnCard);
        console.log("Counter-damage destroyed punk");

        // Remove from column
        const column = this.state.players[targetPlayer].columns[targetColumn];
        column.setCard(targetPosition, null);

        // Shift cards if needed
        if (targetPosition === 1) {
          const cardInFront = column.getCard(2);
          if (cardInFront) {
            column.setCard(1, cardInFront);
            column.setCard(2, null);
          }
        }
      } else {
        this.state.discard.push(target);
        console.log(`Counter-damage destroyed ${target.name}`);

        // Remove from column
        const column = this.state.players[targetPlayer].columns[targetColumn];
        column.setCard(targetPosition, null);

        // Shift cards if needed
        if (targetPosition === 1) {
          const cardInFront = column.getCard(2);
          if (cardInFront) {
            column.setCard(1, cardInFront);
            column.setCard(2, null);
          }
        }
      }
    } else {
      // Just damage it
      target.isDamaged = true;
      if (target.type === "person") {
        target.isReady = false;
      }
      console.log(`Counter-damage injured ${target.name}`);
    }

    return true;
  }
}

// Special camp damage handlers
class MolgurDestroyCampHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Molgur target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "camp") {
      console.log("Molgur Stang can only destroy camps");
      return false;
    }

    // Store values before clearing
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Clear pending FIRST so UI updates
    this.state.pending = null;

    // Destroy the camp immediately
    target.isDestroyed = true;
    console.log(`Molgur Stang destroyed ${target.name}!`);

    // Check for game end
    this.commandSystem.checkGameEnd();

    // Finalize ability context if it exists
    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Camp damage handlers that ignore protection
class CatapultDamageHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid catapult target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Store values before clearing
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Clear pending first
    this.state.pending = null;

    // Apply damage (Catapult ignores protection)
    const target = this.getTarget(payload);
    if (!target) return false;

    if (target.isDamaged) {
      target.isDestroyed = true;
      if (target.type === "camp") {
        this.commandSystem.checkGameEnd();
      } else if (target.isPunk) {
        const returnCard = {
          id: target.id,
          name: target.originalName || "Unknown Card",
          type: "person",
          cost: target.cost || 0,
        };
        this.state.deck.unshift(returnCard);
        const column = this.state.players[targetPlayer].columns[targetColumn];
        column.setCard(targetPosition, null);
        if (targetPosition === 1) {
          const cardInFront = column.getCard(2);
          if (cardInFront) {
            column.setCard(1, cardInFront);
            column.setCard(2, null);
          }
        }
      } else {
        this.state.discard.push(target);
        const column = this.state.players[targetPlayer].columns[targetColumn];
        column.setCard(targetPosition, null);
        if (targetPosition === 1) {
          const cardInFront = column.getCard(2);
          if (cardInFront) {
            column.setCard(1, cardInFront);
            column.setCard(2, null);
          }
        }
      }
      console.log(`Catapult destroyed ${target.name || "target"}`);
    } else {
      target.isDamaged = true;
      if (target.type === "person") {
        target.isReady = false;
      }
      console.log(`Catapult damaged ${target.name}`);
    }

    // Now handle the catapult's self-destruction selection
    const player = this.state.players[sourcePlayerId];
    const validPeople = [];

    for (let col = 0; col < 3; col++) {
      for (let pos = 1; pos <= 2; pos++) {
        const card = player.columns[col].getCard(pos);
        if (card && card.type === "person" && !card.isDestroyed) {
          validPeople.push({
            playerId: sourcePlayerId,
            columnIndex: col,
            position: pos,
            card,
          });
        }
      }
    }

    if (validPeople.length > 0) {
      this.state.pending = {
        type: "catapult_select_destroy",
        sourcePlayerId: sourcePlayerId,
        validTargets: validPeople,
      };
      console.log("Catapult: Now select one of your people to destroy");
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

class CatapultSelectDestroyHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid catapult sacrifice target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person") {
      console.log("Must select a person to destroy");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("Catapult: Destroyed punk (returned to deck)");
    } else {
      this.state.discard.push(target);
      console.log(`Catapult: Destroyed ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    return true;
  }
}

// Mercenary Camp handler (damages camps ignoring protection)
class MercenaryCampDamageHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid mercenary camp target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "camp") {
      console.log("Mercenary Camp can only damage camps");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Apply damage (ignores protection)
    if (target.isDamaged) {
      target.isDestroyed = true;
      console.log(`Mercenary Camp destroyed ${target.name}!`);
      this.commandSystem.checkGameEnd();
    } else {
      target.isDamaged = true;
      console.log(`Mercenary Camp damaged ${target.name}`);
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Scud Launcher handler (opponent chooses their card to damage)
class ScudLauncherSelectTargetHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Verify correct player is selecting
    if (targetPlayer !== this.state.pending.targetPlayerId) {
      console.log("You must select your own card");
      return false;
    }

    const target = this.getTarget(payload);
    if (!target || target.isDestroyed) {
      console.log("Invalid target");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Apply damage
    if (target.isDamaged) {
      target.isDestroyed = true;

      if (target.type === "camp") {
        console.log(`Scud Launcher destroyed ${target.name} camp!`);
        this.commandSystem.checkGameEnd();
      } else if (target.isPunk) {
        const returnCard = {
          id: target.id,
          name: target.originalName || "Unknown Card",
          type: "person",
          cost: target.cost || 0,
        };
        this.state.deck.unshift(returnCard);
        const column = this.state.players[targetPlayer].columns[targetColumn];
        column.setCard(targetPosition, null);
        if (targetPosition === 1) {
          const cardInFront = column.getCard(2);
          if (cardInFront) {
            column.setCard(1, cardInFront);
            column.setCard(2, null);
          }
        }
        console.log("Scud Launcher destroyed punk");
      } else {
        this.state.discard.push(target);
        const column = this.state.players[targetPlayer].columns[targetColumn];
        column.setCard(targetPosition, null);
        if (targetPosition === 1) {
          const cardInFront = column.getCard(2);
          if (cardInFront) {
            column.setCard(1, cardInFront);
            column.setCard(2, null);
          }
        }
        console.log(`Scud Launcher destroyed ${target.name}`);
      }
    } else {
      target.isDamaged = true;
      if (target.type === "person") {
        target.isReady = false;
      }
      console.log(`Scud Launcher damaged ${target.name}`);
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Repair Bot entry restore handler
class RepairBotEntryRestoreHandler extends PendingHandler {
  handle(payload) {
    const { skip } = payload;

    if (skip) {
      console.log("Skipping Repair Bot entry restore");
      this.state.pending = null;
      return true;
    }

    if (!this.isValidTarget(payload)) {
      console.log("Not a valid restore target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || !target.isDamaged) {
      console.log("Must target a damaged card");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Restore the card
    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }

    console.log(`Repair Bot entry trait: Restored ${target.name}`);

    return true;
  }
}

// Atomic Garden restore handler (restores AND readies)
class AtomicGardenRestoreHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid atomic garden target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person" || !target.isDamaged) {
      console.log("Atomic Garden can only restore damaged people");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Restore AND ready the person
    target.isDamaged = false;
    target.isReady = true; // This is the special part!

    console.log(`Atomic Garden: Restored and readied ${target.name}!`);

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Cult Leader handlers
class CultLeaderSelectDestroyHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid cult leader target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person") {
      console.log("Must select one of your people");
      return false;
    }

    // Store values before modifying state
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const adrenalineLabDestroy = this.state.pending.adrenalineLabDestroy;

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("Cult Leader: Destroyed own punk");
    } else {
      this.state.discard.push(target);
      console.log(`Cult Leader: Destroyed own ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // Now set up damage targeting
    const validTargets = TargetValidator.findValidTargets(
      this.state,
      sourcePlayerId,
      { allowProtected: false }
    );

    if (validTargets.length > 0) {
      this.state.pending = {
        type: "cultleader_damage",
        sourcePlayerId: sourcePlayerId,
        validTargets: validTargets,
        adrenalineLabDestroy: adrenalineLabDestroy,
      };
      console.log(
        `Cult Leader: Now select enemy target to damage (${validTargets.length} targets)`
      );
    } else {
      console.log("Cult Leader: No valid targets to damage");
      this.state.pending = null;

      // Handle Adrenaline Lab cleanup if needed
      if (adrenalineLabDestroy) {
        this.commandSystem.handleAdrenalineLabCleanup(adrenalineLabDestroy);
      }
    }

    return true;
  }
}

class CultLeaderDamageHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid cult leader damage target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const adrenalineLabDestroy = this.state.pending.adrenalineLabDestroy;

    // Clear pending first
    this.state.pending = null;

    // Apply damage
    const damaged = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (damaged) {
      console.log("Cult Leader damage successful");
    }

    // Handle Adrenaline Lab cleanup if needed
    if (adrenalineLabDestroy) {
      this.commandSystem.handleAdrenalineLabCleanup(adrenalineLabDestroy);
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return damaged;
  }
}

// Rescue Team select handler
class RescueTeamSelectHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid rescue team target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person") {
      console.log("Can only return people to hand");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Return the person to hand
    const player = this.state.players[targetPlayer];

    if (target.isPunk) {
      // Reveal punk when returning to hand
      const revealedCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.originalCard?.cost || target.cost || 0,
        abilities: target.originalCard?.abilities || target.abilities || [],
        junkEffect: target.originalCard?.junkEffect || target.junkEffect,
      };
      player.hand.push(revealedCard);
      console.log(
        `Rescue Team: Punk revealed as ${revealedCard.name} and returned to hand`
      );
    } else {
      const returnCard = {
        id: target.id,
        name: target.name,
        type: target.type,
        cost: target.cost,
        abilities: target.abilities,
        junkEffect: target.junkEffect,
      };
      player.hand.push(returnCard);
      console.log(`Rescue Team: ${target.name} returned to hand`);
    }

    // Remove from column
    const column = player.columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Magnus Karv column damage handler
class MagnusSelectColumnHandler extends PendingHandler {
  handle(payload) {
    const { targetColumn } = payload;

    // Verify it's a valid column
    if (!this.state.pending.validColumns.includes(targetColumn)) {
      console.log("Not a valid column selection");
      return false;
    }

    const targetPlayerId = this.state.pending.targetPlayerId;
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Clear pending
    this.state.pending = null;

    // Damage ALL cards in that column
    const column = this.state.players[targetPlayerId].columns[targetColumn];
    let damagedCount = 0;

    // Process from back to front for proper removal
    for (let pos = 2; pos >= 0; pos--) {
      const card = column.getCard(pos);
      if (card && !card.isDestroyed) {
        if (card.isDamaged) {
          card.isDestroyed = true;

          if (card.type === "camp") {
            console.log(`Magnus destroyed ${card.name} camp!`);
          } else if (card.isPunk) {
            const returnCard = {
              id: card.id,
              name: card.originalName || "Unknown Card",
              type: "person",
              cost: card.cost || 0,
            };
            this.state.deck.unshift(returnCard);
            column.setCard(pos, null);
            console.log("Magnus destroyed punk");
          } else {
            this.state.discard.push(card);
            column.setCard(pos, null);
            console.log(`Magnus destroyed ${card.name}`);
          }

          // Handle shifting for people slots
          if (pos === 1) {
            const cardInFront = column.getCard(2);
            if (cardInFront && !cardInFront.isDestroyed) {
              column.setCard(1, cardInFront);
              column.setCard(2, null);
            }
          }
        } else {
          card.isDamaged = true;
          if (card.type === "person") {
            card.isReady = false;
          }
          console.log(`Magnus damaged ${card.name}`);
        }
        damagedCount++;
      }
    }

    console.log(
      `Magnus Karv damaged ${damagedCount} cards in column ${targetColumn}`
    );

    // Check for game end
    this.commandSystem.checkGameEnd();

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Mutant handlers (simplified for now - the complex mode selection stays in switch)
class MutantDamageHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid mutant damage target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Store ALL values we need before modifying state
    const shouldRestore = this.state.pending.shouldRestore;
    const restoreTargets = this.state.pending.restoreTargets;
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceColumn = this.state.pending.sourceColumn;
    const sourcePosition = this.state.pending.sourcePosition;

    // Apply damage to target FIRST (don't clear pending yet)
    const damaged = this.commandSystem.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (damaged) {
      console.log("Mutant damage successful");

      if (shouldRestore && restoreTargets && restoreTargets.length > 0) {
        // Set up restore phase with ALL necessary data
        this.state.pending = {
          type: "mutant_restore",
          validTargets: restoreTargets,
          sourcePlayerId: sourcePlayerId,
          sourceColumn: sourceColumn,
          sourcePosition: sourcePosition,
          shouldDamage: false, // Already did damage
        };
        console.log(
          `Mutant: Now select card to restore (${restoreTargets.length} targets)`
        );
      } else {
        // No restore phase - clear pending, damage Mutant and finish
        this.state.pending = null;
        this.damageMutant(sourcePlayerId, sourceColumn, sourcePosition);

        if (this.commandSystem.activeAbilityContext) {
          this.commandSystem.finalizeAbilityExecution(
            this.commandSystem.activeAbilityContext
          );
        }
      }
    } else {
      console.log("Mutant damage failed");
      this.state.pending = null;
    }

    return damaged;
  }

  damageMutant(playerId, column, position) {
    const mutant = this.state.getCard(playerId, column, position);
    if (mutant && !mutant.isDestroyed) {
      if (mutant.isDamaged) {
        mutant.isDestroyed = true;
        this.state.discard.push(mutant);
        this.state.players[playerId].columns[column].setCard(position, null);

        // Handle shifting
        if (position === 1) {
          const cardInFront =
            this.state.players[playerId].columns[column].getCard(2);
          if (cardInFront) {
            this.state.players[playerId].columns[column].setCard(
              1,
              cardInFront
            );
            this.state.players[playerId].columns[column].setCard(2, null);
          }
        }
        console.log("Mutant destroyed itself!");
      } else {
        mutant.isDamaged = true;
        mutant.isReady = false;
        console.log("Mutant damaged itself");
      }
    }
  }
}

class MutantRestoreHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid mutant restore target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || !target.isDamaged) {
      console.log("Must target a damaged card");
      return false;
    }

    // Store ALL values we need before modifying state
    const shouldDamage = this.state.pending.shouldDamage;
    const damageTargets = this.state.pending.damageTargets;
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceColumn = this.state.pending.sourceColumn;
    const sourcePosition = this.state.pending.sourcePosition;

    // Restore the card
    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }
    console.log(`Mutant restored ${target.name}`);

    if (shouldDamage && damageTargets && damageTargets.length > 0) {
      // Set up damage phase with ALL necessary data
      this.state.pending = {
        type: "mutant_damage",
        validTargets: damageTargets,
        sourcePlayerId: sourcePlayerId,
        sourceColumn: sourceColumn,
        sourcePosition: sourcePosition,
        shouldRestore: false, // Already did restore
      };
      console.log(
        `Mutant: Now select target to damage (${damageTargets.length} targets)`
      );
    } else {
      // No damage phase - clear pending, damage Mutant and finish
      this.state.pending = null;
      this.damageMutant(sourcePlayerId, sourceColumn, sourcePosition);

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }
    }

    return true;
  }

  damageMutant(playerId, column, position) {
    const mutant = this.state.getCard(playerId, column, position);
    if (mutant && !mutant.isDestroyed) {
      if (mutant.isDamaged) {
        mutant.isDestroyed = true;
        this.state.discard.push(mutant);
        this.state.players[playerId].columns[column].setCard(position, null);

        // Handle shifting
        if (position === 1) {
          const cardInFront =
            this.state.players[playerId].columns[column].getCard(2);
          if (cardInFront) {
            this.state.players[playerId].columns[column].setCard(
              1,
              cardInFront
            );
            this.state.players[playerId].columns[column].setCard(2, null);
          }
        }
        console.log("Mutant destroyed itself!");
      } else {
        mutant.isDamaged = true;
        mutant.isReady = false;
        console.log("Mutant damaged itself");
      }
    }
  }
}

// The Octagon handlers
class OctagonChooseDestroyHandler extends PendingHandler {
  handle(payload) {
    const { cancel } = payload;

    if (cancel) {
      console.log("The Octagon: Chose not to destroy anyone");

      // Mark The Octagon as not ready (it was used even if cancelled)
      const sourceCard = this.state.pending.sourceCard;
      if (sourceCard && !this.state.pending.shouldStayReady) {
        sourceCard.isReady = false;
      }

      this.state.pending = null;

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }
      return true;
    }

    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Octagon target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    // Store source info
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceCard = this.state.pending.sourceCard;
    const shouldStayReady = this.state.pending.shouldStayReady;
    const opponentId = sourcePlayerId === "left" ? "right" : "left";

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("The Octagon: You destroyed your punk");
    } else {
      this.state.discard.push(target);
      console.log(`The Octagon: You destroyed your ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // Check for opponent people
    const opponentPeople = [];
    const opponent = this.state.players[opponentId];

    for (let col = 0; col < 3; col++) {
      for (let pos = 1; pos <= 2; pos++) {
        const card = opponent.columns[col].getCard(pos);
        if (card && card.type === "person" && !card.isDestroyed) {
          opponentPeople.push({
            playerId: opponentId,
            columnIndex: col,
            position: pos,
            card,
          });
        }
      }
    }

    if (opponentPeople.length > 0) {
      // Continue to opponent destroy
      this.state.pending = {
        type: "octagon_opponent_destroy",
        sourcePlayerId: sourcePlayerId,
        targetPlayerId: opponentId,
        validTargets: opponentPeople,
        sourceCard: sourceCard, // Pass the camp reference
        shouldStayReady: shouldStayReady, // Pass Vera status
      };
      console.log(
        `The Octagon: ${opponentId} must destroy one of their people`
      );
    } else {
      console.log("The Octagon: Opponent has no people to destroy");

      // Mark The Octagon as not ready
      if (sourceCard && !shouldStayReady) {
        sourceCard.isReady = false;
      }

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

class OctagonOpponentDestroyHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Verify it's the correct player selecting
    if (targetPlayer !== this.state.pending.targetPlayerId) {
      console.log("You must select your own person");
      return false;
    }

    if (!this.isValidTarget(payload)) {
      console.log("Not a valid target");
      return false;
    }

    const target = this.getTarget(payload);

    // Store camp info before clearing pending
    const sourceCard = this.state.pending.sourceCard;
    const shouldStayReady = this.state.pending.shouldStayReady;

    // Clear pending
    this.state.pending = null;

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("The Octagon: Opponent destroyed their punk");
    } else {
      this.state.discard.push(target);
      console.log(`The Octagon: Opponent destroyed their ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // Mark The Octagon as not ready NOW
    if (sourceCard && !shouldStayReady) {
      sourceCard.isReady = false;
      console.log("The Octagon marked as not ready");
    }

    console.log("The Octagon effect complete");

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Labor Camp handlers
class LaborcampSelectDestroyHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Labor Camp target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    // Store restore targets and source info
    const validRestoreTargets = this.state.pending.validRestoreTargets;
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("Labor Camp: Destroyed punk");
    } else {
      this.state.discard.push(target);
      console.log(`Labor Camp: Destroyed ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // IMPORTANT: Filter out the just-destroyed card from restore targets
    const filteredRestoreTargets = validRestoreTargets.filter((t) => {
      // Exclude the card we just destroyed
      return !(
        t.playerId === targetPlayer &&
        t.columnIndex === targetColumn &&
        t.position === targetPosition
      );
    });

    if (filteredRestoreTargets.length === 0) {
      console.log("Labor Camp: No damaged cards left to restore");
      this.state.pending = null;

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }
      return true;
    }

    // Set up restore selection with filtered list
    this.state.pending = {
      type: "laborcamp_select_restore",
      sourcePlayerId: sourcePlayerId,
      validTargets: filteredRestoreTargets,
    };

    console.log(
      `Labor Camp: Now select damaged card to restore (${filteredRestoreTargets.length} targets)`
    );
    return true;
  }
}

class LaborcampSelectRestoreHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid restore target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || !target.isDamaged) {
      console.log("Must target a damaged card");
      return false;
    }

    // Clear pending
    this.state.pending = null;

    // Restore the card
    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }

    console.log(`Labor Camp: Restored ${target.name}`);

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Blood Bank handler
class BloodbankSelectDestroyHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Blood Bank target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceCard = this.state.pending.sourceCard;
    const shouldStayReady = this.state.pending.shouldStayReady;

    // Clear pending
    this.state.pending = null;

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("Blood Bank: Destroyed punk");
    } else {
      this.state.discard.push(target);
      console.log(`Blood Bank: Destroyed ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // BLOOD BANK ALWAYS GIVES EXACTLY 1 WATER
    this.state.players[sourcePlayerId].water += 1;
    console.log("Blood Bank: Gained 1 water");

    // Mark Blood Bank as not ready
    if (sourceCard && !shouldStayReady) {
      sourceCard.isReady = false;
      console.log("Blood Bank marked as not ready");
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Mulcher handler
class MulcherSelectDestroyHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Mulcher target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceCard = this.state.pending.sourceCard;
    const shouldStayReady = this.state.pending.shouldStayReady;

    // Clear pending
    this.state.pending = null;

    // Destroy the selected person
    target.isDestroyed = true;

    if (target.isPunk) {
      const returnCard = {
        id: target.id,
        name: target.originalName || "Unknown Card",
        type: "person",
        cost: target.cost || 0,
      };
      this.state.deck.unshift(returnCard);
      console.log("Mulcher: Destroyed punk");
    } else {
      this.state.discard.push(target);
      console.log(`Mulcher: Destroyed ${target.name}`);
    }

    // Remove from column
    const column = this.state.players[targetPlayer].columns[targetColumn];
    column.setCard(targetPosition, null);

    if (targetPosition === 1) {
      const cardInFront = column.getCard(2);
      if (cardInFront) {
        column.setCard(1, cardInFront);
        column.setCard(2, null);
      }
    }

    // MULCHER ALWAYS DRAWS EXACTLY 1 CARD
    const result = this.state.drawCardWithReshuffle(true, sourcePlayerId);
    if (result.gameEnded) {
      return true;
    }
    if (result.card) {
      console.log(`Mulcher: Drew ${result.card.name}`);
    } else {
      console.log("Mulcher: Deck empty, no card drawn");
    }

    // Mark Mulcher as not ready
    if (sourceCard && !shouldStayReady) {
      sourceCard.isReady = false;
      console.log("Mulcher marked as not ready");
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Construction Yard person movement handlers
class ConstructionYardSelectPersonHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person" || target.isDestroyed) {
      console.log("Must select a valid person");
      return false;
    }

    // Store the source camp info
    const sourceCard = this.state.pending.sourceCard;
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Set up destination selection
    this.state.pending = {
      type: "constructionyard_select_destination",
      sourcePlayerId: sourcePlayerId,
      sourceCard: sourceCard,
      movingPerson: target,
      movingFromPlayerId: targetPlayer,
      movingFromColumn: targetColumn,
      movingFromPosition: targetPosition,
      movingToPlayerId: targetPlayer, // Same player's board
    };

    console.log(`Construction Yard: Now select where to move ${target.name}`);
    return true;
  }
}

class ConstructionYardSelectDestinationHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Must be same player's board
    if (targetPlayer !== this.state.pending.movingToPlayerId) {
      console.log("Can only move within same player's board");
      return false;
    }

    // Must be position 1 or 2
    if (targetPosition === 0) {
      console.log("Cannot move to camp slot");
      return false;
    }

    // Can't move to same spot
    if (
      targetColumn === this.state.pending.movingFromColumn &&
      targetPosition === this.state.pending.movingFromPosition
    ) {
      console.log("Must move to a different slot");
      return false;
    }

    // Store needed values
    const sourceCard = this.state.pending.sourceCard;
    const movingPerson = this.state.pending.movingPerson;
    const fromColumn = this.state.pending.movingFromColumn;
    const fromPosition = this.state.pending.movingFromPosition;

    // Clear pending FIRST
    this.state.pending = null;

    // Get the columns
    const player = this.state.players[targetPlayer];
    const fromCol = player.columns[fromColumn];
    const toCol = player.columns[targetColumn];

    // Get what's currently in destination
    const destCard = toCol.getCard(targetPosition);

    // Remove from original position FIRST
    fromCol.setCard(fromPosition, null);
    console.log(
      `Removed ${movingPerson.name} from column ${fromColumn}, position ${fromPosition}`
    );

    // Handle shifting in source column if position 1 is now empty
    if (fromPosition === 1) {
      const cardInFront = fromCol.getCard(2);
      if (cardInFront) {
        fromCol.setCard(1, cardInFront);
        fromCol.setCard(2, null);
        console.log(
          `Shifted ${cardInFront.name} from position 2 to position 1`
        );
      }
    }

    // Now handle placement in destination
    if (!destCard) {
      // Empty slot - just place
      toCol.setCard(targetPosition, movingPerson);
      console.log(
        `Placed ${movingPerson.name} in empty slot at column ${targetColumn}, position ${targetPosition}`
      );
    } else {
      // Occupied - need to push
      if (targetPosition === 1) {
        // Check if position 2 is empty
        const pos2Card = toCol.getCard(2);
        if (!pos2Card) {
          // Position 2 is empty, push existing card there
          toCol.setCard(2, destCard);
          toCol.setCard(1, movingPerson);
          console.log(
            `Pushed ${destCard.name} to position 2, placed ${movingPerson.name} at position 1`
          );
        } else {
          console.log("Cannot move - no room to push");
          // Revert the removal
          fromCol.setCard(fromPosition, movingPerson);
          return false;
        }
      } else {
        // Moving to position 2
        // Check if position 1 is empty
        const pos1Card = toCol.getCard(1);
        if (!pos1Card) {
          // Position 1 is empty, push existing card there
          toCol.setCard(1, destCard);
          toCol.setCard(2, movingPerson);
          console.log(
            `Pushed ${destCard.name} to position 1, placed ${movingPerson.name} at position 2`
          );
        } else {
          console.log("Cannot move - no room to push");
          // Revert the removal
          fromCol.setCard(fromPosition, movingPerson);
          return false;
        }
      }
    }

    // Mark Construction Yard as not ready
    if (sourceCard) {
      sourceCard.isReady = false;
      console.log("Construction Yard marked as not ready");
    }

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    return true;
  }
}

// Bonfire multiple restore handler
class BonfireRestoreMultipleHandler extends PendingHandler {
  handle(payload) {
    const { finish } = payload;

    if (finish) {
      console.log(
        `Bonfire: Finished restoring ${
          this.state.pending.restoredCards?.length || 0
        } cards`
      );
      this.state.pending = null;

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }
      return true;
    }

    if (!this.isValidTarget(payload)) {
      console.log("Not a valid restore target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || !target.isDamaged) {
      console.log("Must target a damaged card");
      return false;
    }

    // PREVENT BONFIRE FROM RESTORING ITSELF
    if (target.type === "camp" && target.name === "Bonfire") {
      console.log("Bonfire cannot restore itself");
      return false;
    }

    // Restore the card
    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }

    console.log(`Bonfire restored ${target.name}`);

    // Track restored card
    if (!this.state.pending.restoredCards) {
      this.state.pending.restoredCards = [];
    }
    this.state.pending.restoredCards.push({
      playerId: targetPlayer,
      columnIndex: targetColumn,
      position: targetPosition,
    });

    // Remove from valid targets
    this.state.pending.validTargets = this.state.pending.validTargets.filter(
      (t) =>
        !(
          t.playerId === targetPlayer &&
          t.columnIndex === targetColumn &&
          t.position === targetPosition
        )
    );

    if (this.state.pending.validTargets.length === 0) {
      console.log("Bonfire: No more cards to restore");
      this.state.pending = null;

      if (this.commandSystem.activeAbilityContext) {
        this.commandSystem.finalizeAbilityExecution(
          this.commandSystem.activeAbilityContext
        );
      }
    } else {
      console.log(
        `Bonfire: ${this.state.pending.validTargets.length} cards can still be restored`
      );
    }

    return true;
  }
}

// Adrenaline Lab handlers
class AdrenalineLabSelectPersonHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Adrenaline Lab target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const targetInfo = this.state.pending.validTargets.find(
      (t) =>
        t.playerId === targetPlayer &&
        t.columnIndex === targetColumn &&
        t.position === targetPosition
    );

    if (!targetInfo) {
      console.log("Invalid selection");
      return false;
    }

    // Set up ability selection
    this.state.pending = {
      type: "adrenalinelab_select_ability",
      sourcePlayerId: this.state.pending.sourcePlayerId,
      sourceCard: this.state.pending.sourceCard,
      selectedPerson: targetInfo,
    };

    console.log(
      `Adrenaline Lab: Choose which ${targetInfo.card.name} ability to use`
    );
    return true;
  }
}

class AdrenalineLabSelectAbilityHandler extends PendingHandler {
  handle(payload) {
    const { abilityIndex } = payload;
    const selectedPerson = this.state.pending.selectedPerson;
    const ability = selectedPerson.abilities[abilityIndex];

    if (!ability) {
      console.log("Invalid ability index");
      return false;
    }

    // Store source info
    const sourceCard = this.state.pending.sourceCard;
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Clear pending
    this.state.pending = null;

    // Mark Adrenaline Lab as not ready
    if (sourceCard) {
      sourceCard.isReady = false;
    }

    // Execute the selected ability (this part stays in command-system for now)
    // The actual ability execution is complex and varies by ability type
    console.log(
      `Executing ${selectedPerson.card.name}'s ${ability.effect} ability via Adrenaline Lab`
    );

    // This is a simplified version - the real implementation would need
    // to call the appropriate ability handler
    this.commandSystem.executeAbilityViaAdrenalineLab(
      selectedPerson,
      abilityIndex,
      sourcePlayerId
    );

    return true;
  }
}

class InterrogateKeepHandler extends PendingHandler {
  handle(payload) {
    const { cardToKeep } = payload;
    const pending = this.state.pending;

    if (!cardToKeep) {
      console.log("Must select a card to keep");
      return false;
    }

    const keepCard = pending.drawnCards.find((c) => c.id === cardToKeep);
    if (!keepCard) {
      console.log("Invalid card selected - must be one of the drawn cards");
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    // Discard the other 3 cards
    for (const card of pending.drawnCards) {
      if (card.id !== cardToKeep) {
        const index = player.hand.findIndex((c) => c.id === card.id);
        if (index !== -1) {
          const discarded = player.hand.splice(index, 1)[0];
          this.state.discard.push(discarded);
          console.log(`Discarded ${discarded.name}`);
        }
      }
    }

    console.log(`Kept ${keepCard.name}`);
    this.state.pending = null;
    console.log("Interrogate: Resolved");

    return true;
  }
}

class ZetoDiscardSelectionHandler extends PendingHandler {
  handle(payload) {
    const { cardsToDiscard } = payload;
    const pending = this.state.pending;

    if (!cardsToDiscard || cardsToDiscard.length !== pending.mustDiscard) {
      console.log(
        `Must select exactly ${pending.mustDiscard} cards to discard`
      );
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    // Verify and discard cards
    for (const cardId of cardsToDiscard) {
      const card = player.hand.find((c) => c.id === cardId);
      if (!card) {
        console.log("Invalid card selected");
        return false;
      }
      if (card.isWaterSilo) {
        console.log("Cannot discard Water Silo");
        return false;
      }
    }

    // Discard the selected cards
    for (const cardId of cardsToDiscard) {
      const index = player.hand.findIndex((c) => c.id === cardId);
      const card = player.hand.splice(index, 1)[0];
      this.state.discard.push(card);
      console.log(`Discarded ${card.name}`);
    }

    // Store Parachute Base damage info
    const parachuteBaseDamage = pending.parachuteBaseDamage;

    this.completeAbility();
    this.state.pending = null;
    this.finalizeAbility();

    console.log("Zeto Kahn: Draw and discard complete");

    // Apply Parachute Base damage if needed
    if (parachuteBaseDamage) {
      this.handleParachuteBaseDamage();
    }

    return true;
  }
}

class ScientistSelectJunkHandler extends PendingHandler {
  handle(payload) {
    const selectedIndex = payload.junkIndex;

    // Store info before clearing pending
    const sourceCard =
      this.state.pending.sourceCard || this.state.pending.source;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
    const sourcePlayerId = this.state.pending.sourcePlayerId;

    // Handle "no junk" option
    if (selectedIndex === -1) {
      console.log(
        "Scientist: Discarded all cards without using any junk effect"
      );

      if (sourceCard) {
        sourceCard.isReady = false;
      }

      this.state.pending = null;
      this.finalizeAbility();

      if (parachuteBaseDamage) {
        this.handleParachuteBaseDamage();
      }

      return true;
    }

    const selectedCard = this.state.pending.discardedCards[selectedIndex];
    if (!selectedCard) {
      console.log("Invalid junk selection");
      return false;
    }

    console.log(
      `Scientist: Using ${selectedCard.name}'s junk effect: ${selectedCard.junkEffect}`
    );

    const junkEffect = selectedCard.junkEffect?.toLowerCase();
    const player = this.state.players[sourcePlayerId];

    // Clear pending before processing immediate effects
    this.state.pending = null;

    // Process the junk effect
    switch (junkEffect) {
      case "water":
        player.water += 1;
        console.log("Gained 1 water from Scientist junk");
        if (sourceCard) sourceCard.isReady = false;
        this.finalizeAbility();
        break;

      case "card":
      case "draw":
        const result = this.state.drawCardWithReshuffle(true, sourcePlayerId);
        if (result.gameEnded) return true;
        if (result.card) {
          console.log(`Drew ${result.card.name} from Scientist junk`);
        }
        if (sourceCard) sourceCard.isReady = false;
        this.finalizeAbility();
        break;

      case "raid":
        this.commandSystem.executeRaid(sourcePlayerId);
        if (sourceCard) sourceCard.isReady = false;
        this.finalizeAbility();
        break;

      case "punk":
        // Check deck before setting up placement
        if (this.state.deck.length === 0) {
          const result = this.state.drawCardWithReshuffle(false);
          if (result.gameEnded) {
            console.log("Game ended - deck exhausted twice");
            this.state.pending = null;
            if (sourceCard) sourceCard.isReady = false;
            this.finalizeAbility();
            return true;
          }

          if (!result.card) {
            console.log(
              "Cannot gain punk from Scientist junk - no cards available"
            );
            if (sourceCard) sourceCard.isReady = false;
            this.state.pending = null;
            this.finalizeAbility();
            return true;
          }

          this.state.deck.unshift(result.card);
        }

        // Set up punk placement
        this.state.pending = {
          type: "place_punk",
          sourcePlayerId: sourcePlayerId,
          fromScientist: true,
          scientistCard: sourceCard,
        };

        if (parachuteBaseDamage) {
          this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
        }

        console.log("Scientist junk: Setting up punk placement");
        break;

      default:
        console.log(`Unknown junk effect: ${junkEffect}`);
        if (sourceCard) sourceCard.isReady = false;
        this.finalizeAbility();
    }

    // Apply Parachute Base damage if no new pending was created
    if (parachuteBaseDamage && !this.state.pending) {
      this.handleParachuteBaseDamage();
    }

    return true;
  }
}

export const pendingHandlers = {
  damage: DamageHandler,
  place_punk: PlacePunkHandler,
  restore: RestoreHandler,
  injure: InjureHandler,
  raiders_select_camp: RaidersSelectCampHandler,
  sniper_damage: SniperDamageHandler,
  pyromaniac_damage: PyromanciacDamageHandler,
  looter_damage: LooterDamageHandler,
  assassin_destroy: AssassinDestroyHandler,
  junk_restore: JunkRestoreHandler,
  junk_injure: JunkInjureHandler,
  vanguard_damage: VanguardDamageHandler,
  vanguard_counter: VanguardCounterHandler,
  molgur_destroy_camp: MolgurDestroyCampHandler,
  catapult_damage: CatapultDamageHandler,
  catapult_select_destroy: CatapultSelectDestroyHandler,
  mercenary_camp_damage: MercenaryCampDamageHandler,
  scudlauncher_select_target: ScudLauncherSelectTargetHandler,
  repair_bot_entry_restore: RepairBotEntryRestoreHandler,
  atomic_garden_restore: AtomicGardenRestoreHandler,
  cultleader_select_destroy: CultLeaderSelectDestroyHandler,
  cultleader_damage: CultLeaderDamageHandler,
  rescue_team_select: RescueTeamSelectHandler,
  magnus_select_column: MagnusSelectColumnHandler,
  mutant_damage: MutantDamageHandler,
  mutant_restore: MutantRestoreHandler,
  octagon_choose_destroy: OctagonChooseDestroyHandler,
  octagon_opponent_destroy: OctagonOpponentDestroyHandler,
  laborcamp_select_destroy: LaborcampSelectDestroyHandler,
  laborcamp_select_restore: LaborcampSelectRestoreHandler,
  bloodbank_select_destroy: BloodbankSelectDestroyHandler,
  mulcher_select_destroy: MulcherSelectDestroyHandler,
  constructionyard_select_person: ConstructionYardSelectPersonHandler,
  constructionyard_select_destination: ConstructionYardSelectDestinationHandler,
  bonfire_restore_multiple: BonfireRestoreMultipleHandler,
  adrenalinelab_select_person: AdrenalineLabSelectPersonHandler,
  adrenalinelab_select_ability: AdrenalineLabSelectAbilityHandler,
  interrogate_keep: InterrogateKeepHandler,
  zeto_discard_selection: ZetoDiscardSelectionHandler,
  scientist_select_junk: ScientistSelectJunkHandler,
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
