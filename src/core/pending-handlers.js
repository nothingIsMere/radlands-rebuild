// pending-handlers.js
import { TargetValidator } from "./target-validator.js";

// Base handler that all specific handlers will extend
// Fix the base class (remove duplicates):
class PendingHandler {
  constructor(state, commandSystem) {
    this.state = state;
    this.commandSystem = commandSystem;
  }

  handle(payload) {
    throw new Error("Handler must implement handle method");
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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    this.finalizeAbility();

    const damaged = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    // Apply Parachute Base damage if present
    if (damaged && parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return damaged;
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
    const parachuteBaseContext = this.state.pending?.parachuteBaseContext;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
    const parachuteSourceCard = this.state.pending?.parachuteSourceCard;
    const parachuteShouldStayReady =
      this.state.pending?.parachuteShouldStayReady;

    // Check if position 0 is actually occupied before rejecting
    if (targetPosition === 0) {
      const existingCard =
        this.state.players[sourcePlayerId].columns[targetColumn].getCard(0);

      if (existingCard && !existingCard.isDestroyed) {
        console.log("Cannot place punk in occupied camp slot");
        return false;
      }
      // Position 0 is empty (Juggernaut moved away) - allow placement
      console.log("Position 0 is empty, allowing punk placement");
    }

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

    // Handle direct Parachute Base damage (from abilities like Rabble Rouser's gain punk)
    if (result && parachuteBaseDamage && !parachuteBaseContext) {
      console.log("Punk placement complete, applying Parachute Base damage");

      this.state.pending = {
        type: "parachute_damage_self",
        sourcePlayerId: parachuteBaseDamage.targetPlayer,
      };

      const damaged = this.commandSystem.resolveDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );

      if (damaged) {
        console.log("Parachute Base: Damaged the person after punk placement");
      }

      this.state.pending = null;

      // Mark Parachute Base as not ready
      if (parachuteSourceCard && !parachuteShouldStayReady) {
        parachuteSourceCard.isReady = false;
      }

      return true;
    }

    // Handle Parachute Base continuation
    if (result && parachuteBaseContext) {
      console.log(
        "Entry trait (punk placement) complete, continuing Parachute Base"
      );

      const person = parachuteBaseContext.person;
      const hasAbility = parachuteBaseContext.hasAbility;

      // Check if the person has abilities to use
      if (hasAbility && person.abilities?.length > 0) {
        if (person.abilities.length > 1) {
          // Multiple abilities - let player choose
          this.state.pending = {
            type: "parachute_select_ability",
            person: person,
            sourcePlayerId: parachuteBaseContext.sourcePlayerId,
            targetColumn: parachuteBaseContext.targetColumn,
            targetSlot: parachuteBaseContext.targetSlot,
            sourceCard: parachuteBaseContext.sourceCard,
            shouldStayReady: parachuteBaseContext.shouldStayReady,
          };
          console.log(
            `Parachute Base: Choose which ${person.name} ability to use`
          );
          return true;
        }

        // Single ability - use it automatically
        const ability = person.abilities[0];
        const player = this.state.players[parachuteBaseContext.sourcePlayerId];

        // Check if player can afford it
        if (player.water >= ability.cost) {
          player.water -= ability.cost;
          console.log(
            `Parachute Base: Paid ${ability.cost} for ${person.name}'s ability`
          );

          this.commandSystem.executeAbility(ability, {
            source: person,
            playerId: parachuteBaseContext.sourcePlayerId,
            columnIndex: parachuteBaseContext.targetColumn,
            position: parachuteBaseContext.targetSlot,
            fromParachuteBase: true,
          });

          if (this.state.pending) {
            this.state.pending.parachuteBaseDamage = {
              targetPlayer: parachuteBaseContext.sourcePlayerId,
              targetColumn: parachuteBaseContext.targetColumn,
              targetPosition: parachuteBaseContext.targetSlot,
            };
          } else {
            // Apply damage immediately
            this.applyParachuteBaseDamage(parachuteBaseContext);
          }
        } else {
          console.log("Not enough water for ability, just applying damage");
          this.applyParachuteBaseDamage(parachuteBaseContext);
        }
      } else {
        // No abilities - just apply damage
        this.applyParachuteBaseDamage(parachuteBaseContext);
      }
    }

    // Mark ability complete if this was from a camp OR person
    if (result && sourceCard && !fromCache && !parachuteBaseContext) {
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

  applyParachuteBaseDamage(context) {
    this.state.pending = {
      type: "parachute_damage_self",
      sourcePlayerId: context.sourcePlayerId,
    };

    const damaged = this.commandSystem.resolveDamage(
      context.sourcePlayerId,
      context.targetColumn,
      context.targetSlot
    );

    if (damaged) {
      console.log("Parachute Base: Damaged the person");
    }

    this.state.pending = null;

    // Mark Parachute Base as not ready
    if (context.sourceCard && !context.shouldStayReady) {
      context.sourceCard.isReady = false;
    }
  }
}

class FamineSelectKeepHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Verify correct player is selecting
    if (targetPlayer !== this.state.pending.currentSelectingPlayer) {
      console.log("Not your turn to select for Famine");
      return false;
    }

    if (!this.isValidTarget(payload)) {
      console.log("Not a valid Famine target");
      return false;
    }

    const selectedPerson = this.getTarget(payload);
    if (!selectedPerson || selectedPerson.type !== "person") {
      console.log("Must select a person");
      return false;
    }

    console.log(`Famine: ${targetPlayer} keeping ${selectedPerson.name}`);

    // Destroy all OTHER people for this player
    const player = this.state.players[targetPlayer];
    let destroyedCount = 0;

    for (let col = 0; col < 3; col++) {
      for (let pos = 2; pos >= 1; pos--) {
        // Process back to front
        const card = player.columns[col].getCard(pos);

        console.log(`Famine scanning ${targetPlayer} col ${col} pos ${pos}:`, {
          hasCard: !!card,
          type: card?.type,
          isPunk: card?.isPunk,
          name: card?.name,
          isDestroyed: card?.isDestroyed,
        });

        if (card && card.type === "person" && !card.isDestroyed) {
          // Skip the selected person
          if (col === targetColumn && pos === targetPosition) {
            continue;
          }

          console.log(
            `Famine checking: ${
              card.isPunk ? "PUNK" : card.name
            } at ${col},${pos}`
          );

          // Destroy this person
          card.isDestroyed = true;

          if (card.isPunk) {
            const returnCard = {
              id: card.id,
              name: card.originalName || "Unknown Card",
              type: "person",
              cost: card.cost || 0,
            };
            this.state.deck.unshift(returnCard);
            console.log(`Famine destroyed punk`);
          } else {
            this.state.discard.push(card);
            console.log(`Famine destroyed ${card.name}`);
          }

          // Remove from column
          player.columns[col].setCard(pos, null);

          // Shift if needed
          if (pos === 1) {
            const cardInFront = player.columns[col].getCard(2);
            if (cardInFront) {
              player.columns[col].setCard(1, cardInFront);
              player.columns[col].setCard(2, null);
            }
          }

          destroyedCount++;
        }
      }
    }

    console.log(
      `Famine: Destroyed ${destroyedCount} people for ${targetPlayer}`
    );

    // Check if we need opponent to select now
    if (!this.state.pending.activePlayerDone) {
      // Active player just finished, now opponent's turn
      const opponentId = targetPlayer === "left" ? "right" : "left";
      const opponent = this.state.players[opponentId];
      let opponentPeople = [];

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

      if (opponentPeople.length <= 1) {
        console.log(
          `Famine complete: ${opponentId} has ≤1 people, no selection needed`
        );
        this.state.pending = null;
        return true;
      }

      // Set up opponent selection
      this.state.pending = {
        type: "famine_select_keep",
        currentSelectingPlayer: opponentId,
        activePlayerId: this.state.pending.activePlayerId,
        validTargets: opponentPeople,
        eventCard: this.state.pending.eventCard,
        activePlayerDone: true,
      };

      console.log(`Famine: ${opponentId} must now select one person to keep`);
      return true;
    }

    // Both players done
    console.log("Famine complete");
    this.state.pending = null;
    return true;
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

    // Store parachuteBaseDamage before clearing pending
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }
    console.log(`Restored ${target.name}!`);

    this.completeAbility();
    this.state.pending = null;

    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Restore ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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

    // NOW handle Parachute Base damage after Sniper's damage is done
    if (parachuteBaseDamage) {
      console.log("Sniper ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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

    // Get the card at the selected position
    const camp = this.state.getCard(targetPlayer, targetColumn, targetPosition);

    // Verify it's a camp (could be at any position due to Juggernaut)
    if (!camp || camp.type !== "camp" || camp.isDestroyed) {
      console.log("Invalid camp selection - must select an undestroyed camp");
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
    const entryTrait = this.state.pending.entryTrait;
    const parachuteBaseDamage = this.state.pending.parachuteBaseDamage;

    // ← ADD THIS: Mark ability complete BEFORE clearing pending
    this.completeAbility();

    // Clear pending
    this.state.pending = null;

    // Now destroy the target
    target.isDestroyed = true;

    // ... rest of destruction logic ...

    // Finalize ability context if it exists
    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      // ... existing code ...
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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

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
          targetPlayerId: targetPlayer, // Tells UI only this player can interact
          originalSourcePlayerId: sourcePlayerId,
          vanguardCard: vanguardCard,
          validTargets: counterTargets,
          parachuteBaseDamage: parachuteBaseDamage,
        };
        console.log(
          `Opponent may counter-damage (${counterTargets.length} targets)`
        );
        return damaged; // Return here - counter-damage will handle Parachute damage
      }
    }

    // Only apply Parachute Base damage if no counter-damage was set up
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return damaged;
  }
}

class VanguardCounterHandler extends PendingHandler {
  handle(payload) {
    const { cancel } = payload;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    if (cancel) {
      console.log("Opponent chose not to counter-damage");
      this.state.pending = null;

      // Apply Parachute damage even if cancelled
      if (parachuteBaseDamage) {
        console.log("Counter cancelled, applying Parachute Base damage");
        this.commandSystem.applyParachuteBaseDamage(
          parachuteBaseDamage.targetPlayer,
          parachuteBaseDamage.targetColumn,
          parachuteBaseDamage.targetPosition
        );
      }

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

    // Apply Parachute damage after counter-damage completes
    if (parachuteBaseDamage) {
      console.log("Counter-damage complete, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return true;
  }
}

class JuggernautSelectCampHandler extends PendingHandler {
  handle(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Verify correct player selecting
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

    // Destroy the camp
    camp.isDestroyed = true;
    console.log(`Juggernaut destroyed ${camp.name}!`);

    // Mark Juggernaut as not ready
    const sourceCard = this.state.pending.sourceCard;
    if (sourceCard && !this.state.pending.shouldStayReady) {
      sourceCard.isReady = false;
    }

    this.state.pending = null;
    this.commandSystem.checkGameEnd();

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

    // Store values before clearing - INCLUDING shouldStayReady
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
    const shouldStayReady = this.state.pending?.shouldStayReady;

    // Finalize ability BEFORE clearing pending (so it can mark card not-ready)
    if (this.commandSystem.activeAbilityContext) {
      this.commandSystem.finalizeAbilityExecution(
        this.commandSystem.activeAbilityContext
      );
    }

    // Clear pending AFTER finalizing
    this.state.pending = null;

    // Destroy the camp immediately
    target.isDestroyed = true;
    console.log(`Molgur Stang destroyed ${target.name}!`);

    // Check for game end
    this.commandSystem.checkGameEnd();

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
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

    // Store values before clearing - INCLUDING sourceCard
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceCard = this.state.pending.sourceCard;

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
        sourceCard: sourceCard,
        validTargets: validPeople,
      };
      console.log("Catapult: Now select one of your people to destroy");
    } else {
      // No people to destroy, mark camp as not ready now
      if (sourceCard) {
        sourceCard.isReady = false;
        console.log("Catapult marked as not ready (no people to destroy)");
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

    // Store the source card BEFORE clearing pending
    const sourceCard = this.state.pending.sourceCard;

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

    // NOW mark Catapult as not ready
    if (sourceCard) {
      sourceCard.isReady = false;
      console.log("Catapult marked as not ready after sacrifice");
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

    // Store parachuteBaseContext BEFORE clearing pending
    const parachuteBaseContext = this.state.pending?.parachuteBaseContext;

    if (skip) {
      console.log("Skipping Repair Bot entry restore");
      this.state.pending = null;

      // Continue with Parachute Base flow if applicable
      if (parachuteBaseContext) {
        this.continueParachuteBase(parachuteBaseContext);
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

    // Clear pending
    this.state.pending = null;

    // Restore the card
    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }

    console.log(`Repair Bot entry trait: Restored ${target.name}`);

    // Continue with Parachute Base flow to use Repair Bot's ability
    if (parachuteBaseContext) {
      console.log(
        "Entry trait complete, continuing Parachute Base to use Repair Bot's ability"
      );
      this.continueParachuteBase(parachuteBaseContext);
    }

    return true;
  }

  continueParachuteBase(context) {
    const person = context.person;

    // Repair Bot has a restore ability that costs 1
    if (person.abilities?.length > 0) {
      const ability = person.abilities[0];
      const player = this.state.players[context.sourcePlayerId];

      if (player.water >= ability.cost) {
        player.water -= ability.cost;
        console.log(
          `Parachute Base: Paid ${ability.cost} for Repair Bot's restore ability`
        );

        // Execute Repair Bot's restore ability
        this.commandSystem.executeAbility(ability, {
          source: person,
          playerId: context.sourcePlayerId,
          columnIndex: context.targetColumn,
          position: context.targetSlot,
          fromParachuteBase: true,
        });

        // Check if ability created a new pending state
        if (this.state.pending) {
          // Store Parachute damage info in the new pending state
          this.state.pending.parachuteBaseDamage = {
            targetPlayer: context.sourcePlayerId,
            targetColumn: context.targetColumn,
            targetPosition: context.targetSlot,
          };
          this.state.pending.parachuteSourceCard = context.sourceCard;
          this.state.pending.parachuteShouldStayReady = context.shouldStayReady;
        } else {
          // Apply Parachute damage immediately
          this.applyParachuteBaseDamage(context);
        }
      } else {
        console.log(
          "Not enough water for Repair Bot's ability, just applying Parachute damage"
        );
        this.applyParachuteBaseDamage(context);
      }
    } else {
      // No ability to use, just apply damage
      this.applyParachuteBaseDamage(context);
    }
  }

  applyParachuteBaseDamage(context) {
    this.state.pending = {
      type: "parachute_damage_self",
      sourcePlayerId: context.sourcePlayerId,
    };

    const damaged = this.commandSystem.resolveDamage(
      context.sourcePlayerId,
      context.targetColumn,
      context.targetSlot
    );

    if (damaged) {
      console.log("Parachute Base: Damaged Repair Bot");
    }

    this.state.pending = null;

    // Mark Parachute Base as not ready
    if (context.sourceCard && !context.shouldStayReady) {
      context.sourceCard.isReady = false;
    }
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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

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
        sourceCard: this.state.pending.sourceCard,
        validTargets: validTargets,
        adrenalineLabDestroy: adrenalineLabDestroy,
        parachuteBaseDamage: this.state.pending.parachuteBaseDamage,
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

    // Store EVERYTHING you need BEFORE changing pending
    const adrenalineLabDestroy = this.state.pending.adrenalineLabDestroy;
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceCard = this.state.pending.sourceCard; // ← Store this NOW
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    // Set up proper damage pending state
    this.state.pending = {
      type: "damage",
      sourcePlayerId: sourcePlayerId,
      allowProtected: false,
    };

    // Now resolve damage (this will set pending to null)
    const damaged = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (damaged) {
      console.log("Cult Leader damage successful");
    }

    // Mark source card as not ready (using the stored reference)
    if (sourceCard && !sourceCard.shouldStayReady) {
      // Note: check sourceCard's property, not pending
      sourceCard.isReady = false;
      console.log("Cult Leader marked as not ready");
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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

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
    console.log(
      "MutantDamageHandler - parachuteBaseDamage:",
      this.state.pending?.parachuteBaseDamage
    );
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid mutant damage target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Store ALL values before modifying state
    const shouldRestore = this.state.pending.shouldRestore;
    const restoreTargets = this.state.pending.restoreTargets;
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceColumn = this.state.pending.sourceColumn;
    const sourcePosition = this.state.pending.sourcePosition;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    // Apply damage to target
    const damaged = this.commandSystem.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    if (damaged) {
      console.log("Mutant damage successful");

      if (shouldRestore && restoreTargets && restoreTargets.length > 0) {
        // Set up restore phase
        this.state.pending = {
          type: "mutant_restore",
          validTargets: restoreTargets,
          sourcePlayerId: sourcePlayerId,
          sourceColumn: sourceColumn,
          sourcePosition: sourcePosition,
          shouldDamage: false,
          parachuteBaseDamage: parachuteBaseDamage, // PRESERVE IT
        };
        console.log(
          `Mutant: Now select card to restore (${restoreTargets.length} targets)`
        );
      } else {
        // No restore phase - clear pending, damage Mutant
        this.state.pending = null;

        // First apply Mutant's self-damage
        this.damageMutant(sourcePlayerId, sourceColumn, sourcePosition);

        // THEN apply Parachute Base damage if present
        // This means Mutant takes damage TWICE when used via Parachute Base
        if (parachuteBaseDamage) {
          console.log(
            "Mutant ability completed, applying Parachute Base damage (second damage to Mutant)"
          );

          // Set up pending for the damage
          this.state.pending = {
            type: "parachute_damage_self",
            sourcePlayerId: parachuteBaseDamage.targetPlayer,
          };

          // Apply the damage - this should destroy Mutant if it was already damaged
          this.commandSystem.resolveDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );

          this.state.pending = null;
        }

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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

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
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log(
        `Mutant: Now select target to damage (${damageTargets.length} targets)`
      );
    } else {
      // No damage phase - clear pending, damage Mutant
      this.state.pending = null;

      // First apply Mutant's self-damage
      this.damageMutant(sourcePlayerId, sourceColumn, sourcePosition);

      // THEN apply Parachute Base damage if present
      if (parachuteBaseDamage) {
        console.log(
          "Mutant ability completed, applying Parachute Base damage (second damage to Mutant)"
        );

        this.state.pending = {
          type: "parachute_damage_self",
          sourcePlayerId: parachuteBaseDamage.targetPlayer,
        };

        this.commandSystem.resolveDamage(
          parachuteBaseDamage.targetPlayer,
          parachuteBaseDamage.targetColumn,
          parachuteBaseDamage.targetPosition
        );

        this.state.pending = null;
      }

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
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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

    // Apply Parachute Base damage if present
    if (parachuteBaseDamage) {
      console.log("Damage ability completed, applying Parachute Base damage");
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return true;
  }
}

class ScavengercampSelectDiscardHandler extends PendingHandler {
  handle(payload) {
    const { cardToDiscard } = payload;
    const pending = this.state.pending;

    if (!cardToDiscard) {
      console.log("Must select a card to discard");
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    // Find and verify the card
    const cardIndex = player.hand.findIndex((c) => c.id === cardToDiscard);
    if (cardIndex === -1) {
      console.log("Card not found in hand");
      return false;
    }

    const card = player.hand[cardIndex];

    // Verify it's not Water Silo
    if (card.isWaterSilo || card.name === "Water Silo") {
      console.log("Cannot discard Water Silo");
      return false;
    }

    // Remove from hand and discard
    player.hand.splice(cardIndex, 1);
    this.state.discard.push(card);
    console.log(`Scavenger Camp: Discarded ${card.name}`);

    // Set up benefit choice
    this.state.pending = {
      type: "scavengercamp_choose_benefit",
      sourceCard: pending.sourceCard,
      sourcePlayerId: pending.sourcePlayerId,
      context: pending.context,
    };

    console.log("Scavenger Camp: Choose your benefit - Water or Punk");
    return true;
  }
}

class ScavengercampChooseBenefitHandler extends PendingHandler {
  handle(payload) {
    const { benefit } = payload;
    const pending = this.state.pending;

    if (!benefit || (benefit !== "water" && benefit !== "punk")) {
      console.log("Must choose water or punk");
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    if (benefit === "water") {
      player.water += 1;
      console.log("Scavenger Camp: Gained 1 extra water");

      this.completeAbility();
      this.state.pending = null;
      this.finalizeAbility();
    } else if (benefit === "punk") {
      // Check if deck has cards
      if (this.state.deck.length === 0) {
        console.log("Cannot gain punk - deck is empty. Defaulting to water.");
        player.water += 1;
        console.log("Scavenger Camp: Gained 1 water (deck empty)");

        this.completeAbility();
        this.state.pending = null;
        this.finalizeAbility();
      } else {
        // Set up punk placement
        this.state.pending = {
          type: "place_punk",
          source: pending.sourceCard,
          sourceCard: pending.sourceCard,
          sourcePlayerId: pending.sourcePlayerId,
        };

        console.log("Scavenger Camp: Place your punk");
      }
    }

    return true;
  }
}

class SupplydepotSelectDiscardHandler extends PendingHandler {
  handle(payload) {
    const { cardToDiscard } = payload;
    const pending = this.state.pending;

    if (!cardToDiscard) {
      console.log("Must select a card to discard");
      return false;
    }

    // Verify the selected card is one of the drawn cards
    const discardCard = pending.drawnCards.find((c) => c.id === cardToDiscard);
    if (!discardCard) {
      console.log("Invalid card selected - must be one of the drawn cards");
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    // Find and discard the selected card from hand
    const index = player.hand.findIndex((c) => c.id === cardToDiscard);
    if (index !== -1) {
      const discarded = player.hand.splice(index, 1)[0];
      this.state.discard.push(discarded);
      console.log(`Supply Depot: Discarded ${discarded.name}`);

      // Identify which card was kept
      const keptCard = pending.drawnCards.find((c) => c.id !== cardToDiscard);
      if (keptCard) {
        console.log(`Supply Depot: Kept ${keptCard.name}`);
      }
    }

    this.completeAbility();
    this.state.pending = null;
    this.finalizeAbility();

    console.log("Supply Depot: Resolved");
    return true;
  }
}

class OmenclockSelectEventHandler extends PendingHandler {
  handle(payload) {
    const pending = this.state.pending;
    const { eventPlayerId, eventSlot } = payload;

    // Find the matching valid target
    const validTarget = pending.validTargets.find(
      (t) => t.playerId === eventPlayerId && t.slotIndex === eventSlot
    );

    if (!validTarget) {
      console.log("Not a valid event to advance");
      return false;
    }

    const player = this.state.players[eventPlayerId];
    const event = player.eventQueue[eventSlot];

    if (!event) {
      console.log("No event at that slot");
      return false;
    }

    // Check if this will resolve the event (advancing from slot 1)
    if (eventSlot === 0) {
      console.log(`Omen Clock: Resolving ${event.name} immediately!`);

      // Mark that an event resolved this turn
      this.state.turnEvents.eventResolvedThisTurn = true;

      // Remove from queue
      player.eventQueue[0] = null;

      // Handle Raiders specially
      if (event.isRaiders) {
        player.raiders = "available";

        this.completeAbility();
        this.finalizeAbility();

        const opponentId = eventPlayerId === "left" ? "right" : "left";
        this.state.pending = {
          type: "raiders_select_camp",
          sourcePlayerId: eventPlayerId,
          targetPlayerId: opponentId,
        };

        console.log(
          `Raiders (via Omen Clock): ${opponentId} player must choose a camp to damage`
        );
        return true;
      }

      // Look up event definition for non-Raiders events
      const eventName = event.name.toLowerCase().replace(/\s+/g, "");
      const eventDef = window.cardRegistry?.eventAbilities?.[eventName];

      if (eventDef?.effect?.handler) {
        console.log(`Omen Clock: Executing ${event.name} event effect`);

        this.completeAbility();
        this.state.pending = null;
        this.finalizeAbility();

        // Execute the event effect
        const eventContext = {
          playerId: eventPlayerId,
          eventCard: event,
        };

        const result = eventDef.effect.handler(this.state, eventContext);

        // If event didn't create a new pending state, discard it
        if (!this.state.pending) {
          this.state.discard.push(event);
        }
      } else {
        // No handler found, just discard
        console.log(`Omen Clock: No handler for ${event.name}, discarding`);
        this.state.discard.push(event);
        this.completeAbility();
        this.state.pending = null;
        this.finalizeAbility();
      }
    } else {
      // Normal advancement
      const newSlot = eventSlot - 1;
      player.eventQueue[newSlot] = event;
      player.eventQueue[eventSlot] = null;

      console.log(
        `Omen Clock: Advanced ${event.name} from slot ${
          eventSlot + 1
        } to slot ${newSlot + 1}`
      );

      this.completeAbility();
      this.state.pending = null;
      this.finalizeAbility();
    }

    return true;
  }
}

class CacheChooseOrderHandler extends PendingHandler {
  handle(payload) {
    const { effectFirst } = payload;
    const pending = this.state.pending;

    if (!effectFirst || (effectFirst !== "raid" && effectFirst !== "punk")) {
      console.log("Must choose raid or punk first");
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    if (effectFirst === "raid") {
      console.log("Cache: Processing Raid first");

      // Check if Raiders will resolve immediately
      if (player.raiders === "in_queue") {
        let raidersIndex = -1;
        for (let i = 0; i < 3; i++) {
          if (player.eventQueue[i]?.isRaiders) {
            raidersIndex = i;
            break;
          }
        }

        if (raidersIndex === 0) {
          console.log(
            "Cache: Raiders advancing off slot 1 - will resolve before punk"
          );

          player.eventQueue[0] = null;
          player.raiders = "available";

          const opponentId =
            pending.sourcePlayerId === "left" ? "right" : "left";
          this.state.pending = {
            type: "raiders_select_camp",
            sourcePlayerId: pending.sourcePlayerId,
            targetPlayerId: opponentId,
            fromCache: true,
            cacheSourceCard: pending.sourceCard,
            cacheContext: pending.context,
          };

          console.log(
            `Raiders: ${opponentId} player must choose a camp to damage (Cache will continue after)`
          );
          return true;
        }
      }

      // Raiders won't resolve immediately, just advance/place it
      this.commandSystem.executeRaid(pending.sourcePlayerId);

      // Now set up punk placement
      this.state.pending = {
        type: "place_punk",
        source: pending.sourceCard,
        sourceCard: pending.sourceCard,
        sourcePlayerId: pending.sourcePlayerId,
        fromCache: true,
      };

      console.log("Cache: Raid processed, now place your punk");
    } else {
      // Do punk first, then raid
      console.log("Cache: Processing Gain Punk first");

      this.state.pending = {
        type: "place_punk",
        source: pending.sourceCard,
        sourceCard: pending.sourceCard,
        sourcePlayerId: pending.sourcePlayerId,
        fromCache: true,
        doRaidAfter: true,
        cacheContext: pending.context,
      };

      console.log("Cache: Place your punk (will Raid after)");
    }

    return true;
  }
}

// Add these to pending-handlers.js

class MutantChooseModeHandler extends PendingHandler {
  handle(payload) {
    const { mode } = payload;

    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    if (mode === "damage") {
      this.state.pending = {
        type: "mutant_damage",
        validTargets: this.state.pending.damageTargets,
        shouldRestore: false,
        sourcePlayerId: this.state.pending.sourcePlayerId,
        sourceColumn: this.state.pending.sourceColumn,
        sourcePosition: this.state.pending.sourcePosition,
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log("Mutant: Select target to damage");
    } else if (mode === "restore") {
      this.state.pending = {
        type: "mutant_restore",
        validTargets: this.state.pending.restoreTargets,
        shouldDamage: false,
        sourcePlayerId: this.state.pending.sourcePlayerId,
        sourceColumn: this.state.pending.sourceColumn,
        sourcePosition: this.state.pending.sourcePosition,
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log("Mutant: Select card to restore");
    } else if (mode === "both") {
      this.state.pending = {
        type: "mutant_choose_order",
        damageTargets: this.state.pending.damageTargets,
        restoreTargets: this.state.pending.restoreTargets,
        sourcePlayerId: this.state.pending.sourcePlayerId,
        sourceColumn: this.state.pending.sourceColumn,
        sourcePosition: this.state.pending.sourcePosition,
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log("Mutant: Choose which to do first");
    } else {
      console.log("Invalid mode selection");
      return false;
    }

    return true;
  }
}

class MutantChooseOrderHandler extends PendingHandler {
  handle(payload) {
    const { order } = payload;

    const damageTargets = this.state.pending.damageTargets;
    const restoreTargets = this.state.pending.restoreTargets;
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceColumn = this.state.pending.sourceColumn;
    const sourcePosition = this.state.pending.sourcePosition;
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    if (order === "damage_first") {
      this.state.pending = {
        type: "mutant_damage",
        validTargets: damageTargets,
        shouldRestore: true,
        restoreTargets: restoreTargets,
        sourcePlayerId: sourcePlayerId,
        sourceColumn: sourceColumn,
        sourcePosition: sourcePosition,
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log("Mutant: Damage first - select target to damage");
    } else if (order === "restore_first") {
      this.state.pending = {
        type: "mutant_restore",
        validTargets: restoreTargets,
        shouldDamage: true,
        damageTargets: damageTargets,
        sourcePlayerId: sourcePlayerId,
        sourceColumn: sourceColumn,
        sourcePosition: sourcePosition,
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log("Mutant: Restore first - select card to restore");
    } else {
      console.log("Invalid order selection");
      return false;
    }

    return true;
  }
}

class ParachuteSelectPersonHandler extends PendingHandler {
  handle(payload) {
    if (payload.targetType !== "hand_card") return false;

    const pending = this.state.pending;
    const player = this.state.players[pending.sourcePlayerId];
    const selectedCard = player.hand.find((c) => c.id === payload.cardId);

    if (!selectedCard) {
      console.log("Card not found in hand");
      return false;
    }

    // Move to placement phase
    this.state.pending = {
      type: "parachute_place_person",
      source: pending.source,
      sourceCard: pending.sourceCard || pending.source,
      sourcePlayerId: pending.sourcePlayerId,
      selectedPerson: selectedCard,
      campIndex: pending.campIndex,
      shouldStayReady: pending.shouldStayReady,
    };

    console.log(`Parachute Base: Now place ${selectedCard.name}`);
    return true;
  }
}

class ParachutePlacePersonHandler extends PendingHandler {
  handle(payload) {
    if (payload.targetType !== "slot") return false;

    const pb = this.state.pending;
    const targetColumn = payload.columnIndex;
    const targetSlot = payload.position;

    // CRITICAL FIX: Prevent placing in camp slot
    if (targetSlot === 0) {
      console.log("Cannot place person in camp slot");
      return false;
    }

    const column = this.state.players[pb.sourcePlayerId].columns[targetColumn];
    const player = this.state.players[pb.sourcePlayerId];

    // Calculate adjusted cost
    const adjustedCost = this.commandSystem.getAdjustedCost(
      pb.selectedPerson,
      targetColumn,
      pb.sourcePlayerId
    );

    const abilityCost = pb.selectedPerson.abilities?.[0]?.cost || 0;
    const totalCost = adjustedCost + abilityCost;

    if (player.water < totalCost) {
      console.log(`Need ${totalCost} water for Parachute Base`);
      return false;
    }

    const existingCard = column.getCard(targetSlot);

    // Handle pushing if needed - BUT ONLY PEOPLE, NEVER CAMPS
    if (existingCard) {
      if (existingCard.type === "camp") {
        console.log("ERROR: Cannot push a camp card!");
        return false;
      }

      const otherSlot = targetSlot === 1 ? 2 : 1;

      // Check if we can push to the other slot
      const otherCard = column.getCard(otherSlot);
      if (otherCard) {
        console.log("Column is full, cannot place");
        return false;
      }

      // Only push if it's a person
      column.setCard(otherSlot, existingCard);
      column.setCard(targetSlot, null);
      console.log(`Pushed ${existingCard.name} to position ${otherSlot}`);
    }

    // Pay cost and remove from hand
    player.water -= adjustedCost;
    const cardIndex = player.hand.findIndex(
      (c) => c.id === pb.selectedPerson.id
    );
    player.hand.splice(cardIndex, 1);

    // Create person object
    const person = {
      ...pb.selectedPerson,
      isReady: false,
      isDamaged: false,
      position: targetSlot,
      columnIndex: targetColumn,
    };

    // Check for Karli Blaze trait
    const hasActiveKarli = this.commandSystem.checkForActiveKarli(
      pb.sourcePlayerId
    );
    if (hasActiveKarli) {
      person.isReady = true;
      console.log(
        `${person.name} enters play ready due to Karli Blaze's trait!`
      );
    }

    // Place in column
    column.setCard(targetSlot, person);
    console.log(
      `Parachute Base: Placed ${person.name} at column ${targetColumn}, position ${targetSlot}`
    );

    // Clear pending first
    this.state.pending = null;

    // Trigger entry traits
    this.commandSystem.triggerEntryTraits(
      person,
      pb.sourcePlayerId,
      targetColumn,
      targetSlot
    );

    // Check if entry trait set up a pending state
    if (this.state.pending) {
      this.state.pending.parachuteBaseContext = {
        person,
        sourcePlayerId: pb.sourcePlayerId,
        targetColumn,
        targetSlot,
        hasAbility: person.abilities?.length > 0,
        abilityCost: person.abilities?.[0]?.cost || 0,
        sourceCard: pb.sourceCard,
        shouldStayReady: pb.shouldStayReady,
      };
      console.log(
        "Parachute Base: Entry trait triggered, will continue after it resolves"
      );
      return true;
    }

    // Handle abilities
    if (person.abilities?.length > 0) {
      if (person.abilities.length > 1) {
        // Multiple abilities - let player choose
        this.state.pending = {
          type: "parachute_select_ability",
          person: person,
          sourcePlayerId: pb.sourcePlayerId,
          targetColumn: targetColumn,
          targetSlot: targetSlot,
          sourceCard: pb.sourceCard,
          shouldStayReady: pb.shouldStayReady,
        };
        console.log(
          `Parachute Base: Choose which ${person.name} ability to use`
        );
        return true;
      }

      // Single ability - use it automatically
      // Single ability - use it automatically
      const ability = person.abilities[0];
      player.water -= ability.cost;
      console.log(
        `Parachute Base: Paid ${ability.cost} for ${person.name}'s ability`
      );

      // Clear pending before executing ability
      this.state.pending = null;

      this.commandSystem.executeAbility(ability, {
        source: person,
        playerId: pb.sourcePlayerId,
        columnIndex: targetColumn,
        position: targetSlot,
        fromParachuteBase: true,
      });

      // Check if a new pending was created by the ability
      if (this.state.pending) {
        console.log("Setting parachuteBaseDamage in pending state");
        this.state.pending.parachuteBaseDamage = {
          targetPlayer: pb.sourcePlayerId,
          targetColumn: targetColumn,
          targetPosition: targetSlot,
        };
        this.state.pending.parachuteSourceCard = pb.sourceCard;
        this.state.pending.parachuteShouldStayReady = pb.shouldStayReady;
      } else {
        // Apply damage immediately
        this.applyParachuteBaseSelfDamage(
          pb.sourcePlayerId,
          targetColumn,
          targetSlot
        );
        if (pb.sourceCard && !pb.shouldStayReady) {
          pb.sourceCard.isReady = false;
        }
      }
    } else {
      // No abilities - just damage
      this.applyParachuteBaseSelfDamage(
        pb.sourcePlayerId,
        targetColumn,
        targetSlot
      );
      if (pb.sourceCard && !pb.shouldStayReady) {
        pb.sourceCard.isReady = false;
      }
    }

    return true;
  }

  applyParachuteBaseSelfDamage(playerId, column, position) {
    this.state.pending = {
      type: "parachute_damage_self",
      sourcePlayerId: playerId,
    };

    const damaged = this.commandSystem.resolveDamage(
      playerId,
      column,
      position
    );
    if (damaged) {
      console.log("Parachute Base: Damaged the person");
    }

    this.state.pending = null;
  }
}

class ParachuteSelectAbilityHandler extends PendingHandler {
  handle(payload) {
    const pending = this.state.pending;
    const abilityIndex = payload.abilityIndex;

    if (abilityIndex === undefined || !pending.person.abilities[abilityIndex]) {
      console.log("Invalid ability selection");
      return false;
    }

    const ability = pending.person.abilities[abilityIndex];
    const player = this.state.players[pending.sourcePlayerId];

    if (player.water < ability.cost) {
      console.log(`Not enough water for ${ability.effect}`);
      this.state.pending = null;
      this.commandSystem.applyParachuteBaseDamage(
        pending.sourcePlayerId,
        pending.targetColumn,
        pending.targetSlot
      );
      return true;
    }

    // Pay and execute
    player.water -= ability.cost;
    const personId = pending.person.id;
    const sourcePlayerId = pending.sourcePlayerId;

    this.state.pending = null;

    this.commandSystem.executeAbility(ability, {
      source: pending.person,
      playerId: sourcePlayerId,
      columnIndex: pending.targetColumn,
      position: pending.targetSlot,
      fromParachuteBase: true,
    });

    // Find where person is NOW
    let currentPosition = null;
    let currentColumn = null;
    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card =
          this.state.players[sourcePlayerId].columns[col].getCard(pos);
        if (card && card.id === personId) {
          currentColumn = col;
          currentPosition = pos;
          break;
        }
      }
      if (currentPosition !== null) break;
    }

    if (currentPosition === null) {
      console.log("ERROR: Can't find the person that was paradropped");
      return true;
    }

    // Apply damage at current position
    if (this.state.pending) {
      this.state.pending.parachuteBaseDamage = {
        targetPlayer: sourcePlayerId,
        targetColumn: currentColumn,
        targetPosition: currentPosition,
      };
    } else {
      this.commandSystem.applyParachuteBaseDamage(
        sourcePlayerId,
        currentColumn,
        currentPosition
      );
    }

    return true;
  }
}

class MimicSelectTargetHandler extends PendingHandler {
  handle(payload) {
    if (!this.isValidTarget(payload)) {
      console.log("Not a valid mimic target");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;
    const target = this.getTarget(payload);

    if (!target || target.type !== "person") {
      console.log("Mimic can only copy people");
      return false;
    }

    // Store all needed values before changing pending
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
    const sourcePlayerId = this.state.pending.sourcePlayerId;
    const sourceCard = this.state.pending.sourceCard;
    const sourceColumn = this.state.pending.sourceColumn;
    const sourcePosition = this.state.pending.sourcePosition;

    // Check if target has abilities
    if (!target.abilities || target.abilities.length === 0) {
      console.log(`${target.name} has no abilities to copy`);

      // Mark Mimic as not ready
      if (sourceCard) {
        sourceCard.isReady = false;
      }

      this.state.pending = null;

      // Apply Parachute Base damage if present
      if (parachuteBaseDamage) {
        console.log(
          "Mimic found no abilities to copy, applying Parachute Base damage"
        );
        this.commandSystem.applyParachuteBaseDamage(
          parachuteBaseDamage.targetPlayer,
          parachuteBaseDamage.targetColumn,
          parachuteBaseDamage.targetPosition
        );
      }

      return true;
    }

    if (target.abilities.length === 1) {
      // Single ability - execute immediately
      const ability = target.abilities[0];
      const player = this.state.players[sourcePlayerId];

      if (player.water < ability.cost) {
        console.log(`Not enough water to copy ${ability.effect}`);

        // Mark Mimic as not ready even if couldn't afford the copy
        if (sourceCard) {
          sourceCard.isReady = false;
        }

        this.state.pending = null;

        // Apply Parachute Base damage if present
        if (parachuteBaseDamage) {
          this.commandSystem.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }
        return true;
      }

      // Pay cost and execute
      player.water -= ability.cost;
      console.log(
        `Mimic: Paid ${ability.cost} to copy ${target.name}'s ${ability.effect}`
      );

      // Mark Mimic as not ready BEFORE clearing pending
      if (sourceCard) {
        sourceCard.isReady = false;
      }

      this.state.pending = null;

      this.commandSystem.executeAbility(ability, {
        source: sourceCard,
        playerId: sourcePlayerId,
        columnIndex: sourceColumn,
        position: sourcePosition,
        fromMimic: true,
        copiedFrom: target.name,
      });

      // If ability created new pending, add parachuteBaseDamage
      if (this.state.pending && parachuteBaseDamage) {
        this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
      } else if (parachuteBaseDamage) {
        // Apply Parachute damage immediately
        this.commandSystem.applyParachuteBaseDamage(
          parachuteBaseDamage.targetPlayer,
          parachuteBaseDamage.targetColumn,
          parachuteBaseDamage.targetPosition
        );
      }
    } else {
      // Multiple abilities - let player choose
      this.state.pending = {
        type: "mimic_select_ability",
        sourcePlayerId: sourcePlayerId,
        sourceCard: sourceCard,
        sourceColumn: sourceColumn,
        sourcePosition: sourcePosition,
        targetCard: target,
        parachuteBaseDamage: parachuteBaseDamage,
      };
      console.log(`Mimic: Choose which ${target.name} ability to copy`);
    }

    return true;
  }
}

class MimicSelectAbilityHandler extends PendingHandler {
  handle(payload) {
    const { abilityIndex } = payload;
    const pending = this.state.pending;
    const ability = pending.targetCard.abilities[abilityIndex];

    if (!ability) {
      console.log("Invalid ability index");
      return false;
    }

    const player = this.state.players[pending.sourcePlayerId];

    if (player.water < ability.cost) {
      console.log(`Not enough water to copy ${ability.effect}`);

      // Mark Mimic as not ready
      if (pending.sourceCard) {
        pending.sourceCard.isReady = false;
      }

      // Cancel and apply Parachute damage if present
      const parachuteBaseDamage = pending.parachuteBaseDamage;
      this.state.pending = null;

      if (parachuteBaseDamage) {
        this.commandSystem.applyParachuteBaseDamage(
          parachuteBaseDamage.targetPlayer,
          parachuteBaseDamage.targetColumn,
          parachuteBaseDamage.targetPosition
        );
      }
      return true;
    }

    // Store all values before clearing pending
    const parachuteBaseDamage = pending.parachuteBaseDamage;
    const sourceCard = pending.sourceCard;
    const sourcePlayerId = pending.sourcePlayerId;
    const sourceColumn = pending.sourceColumn;
    const sourcePosition = pending.sourcePosition;

    // Pay and execute
    player.water -= ability.cost;
    console.log(
      `Mimic: Paid ${ability.cost} to copy ${pending.targetCard.name}'s ${ability.effect}`
    );

    // Mark Mimic as not ready BEFORE clearing pending
    if (sourceCard) {
      sourceCard.isReady = false;
    }

    this.state.pending = null;

    this.commandSystem.executeAbility(ability, {
      source: sourceCard,
      playerId: sourcePlayerId,
      columnIndex: sourceColumn,
      position: sourcePosition,
      fromMimic: true,
      copiedFrom: pending.targetCard.name,
    });

    // If ability created new pending, add parachuteBaseDamage
    if (this.state.pending && parachuteBaseDamage) {
      this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
    } else if (parachuteBaseDamage) {
      // Apply Parachute damage immediately
      this.commandSystem.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
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
  scavengercamp_select_discard: ScavengercampSelectDiscardHandler,
  scavengercamp_choose_benefit: ScavengercampChooseBenefitHandler,
  supplydepot_select_discard: SupplydepotSelectDiscardHandler,
  omenclock_select_event: OmenclockSelectEventHandler,
  cache_choose_order: CacheChooseOrderHandler,
  mutant_choose_mode: MutantChooseModeHandler,
  mutant_choose_order: MutantChooseOrderHandler,
  parachute_select_person: ParachuteSelectPersonHandler,
  parachute_place_person: ParachutePlacePersonHandler,
  parachute_select_ability: ParachuteSelectAbilityHandler,
  mimic_select_target: MimicSelectTargetHandler,
  mimic_select_ability: MimicSelectAbilityHandler,
  juggernaut_select_camp: JuggernautSelectCampHandler,
  famine_select_keep: FamineSelectKeepHandler,
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
