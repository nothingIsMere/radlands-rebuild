import { CardRegistry } from "../cards/card-registry.js";
import { CONSTANTS } from "./constants.js";
import { TargetValidator } from "../core/target-validator.js";
import { getPendingHandler } from "./pending-handlers.js";
import {
  calculateCardCost,
  canPlayPerson,
  canUseAbility,
  canPlayEvent,
  calculateDamageResult,
  calculatePlacementOptions,
  calculateEventSlotPlacement,
  shouldEventResolveImmediately,
  shouldTriggerObelisk,
  calculateExhaustionResult,
  calculateRaidPlacement,
  shouldRaidersResolve,
  canJunkCard,
  calculateNextPlayer,
  calculatePhaseTransition,
  calculateReplenishWater,
  shouldCardBeReady,
  canUseCampAbility,
  calculateCampDrawCards,
  findAvailableWaterSilo,
  checkForSpecialTraits,
  countPlayerPeople,
  countDestroyedCamps,
  isGameEndingState,
  calculateCardDestruction,
  calculateColumnShift,
  canPlaceInSlot,
  findEmptySlots,
  createPunkFromCard,
  revealPunk,
  canPlacePunk,
  calculatePunkPlacementCost,
  calculateWaterChange,
  canAffordAction,
  calculateTotalWaterIncome,
  findWaterSources,
  findTargetsInColumn,
  findAllDamagedCards,
  countValidTargets,
  selectBestTarget,
  getEntryTraits,
  shouldTriggerEntryTrait,
  canResolveEntryTrait,
} from "./game-logic.js";

export class CommandSystem {
  constructor(gameState) {
    this.state = gameState;
    this.history = [];
    this.pendingCommand = null;
    this.handlers = new Map();

    this.registerHandlers();
  }

  createAbilityContext(
    source,
    playerId,
    columnIndex,
    position,
    ability,
    fromAdrenalineLab = false
  ) {
    return {
      source,
      playerId,
      columnIndex,
      position,
      ability,
      fromAdrenalineLab,
      startedAt: Date.now(),
      completed: false,
    };
  }

  executeAbilityViaAdrenalineLab(selectedPerson, abilityIndex, sourcePlayerId) {
    const ability = selectedPerson.abilities[abilityIndex];

    if (!ability) {
      console.log("Invalid ability index");
      return false;
    }

    const player = this.state.players[sourcePlayerId];

    // Check if player can afford it
    if (player.water < ability.cost) {
      console.log(`Not enough water for ${ability.effect}`);
      return false;
    }

    // Pay the cost
    player.water -= ability.cost;
    console.log(
      `Paid ${ability.cost} water for ${selectedPerson.card.name}'s ability`
    );

    // Create ability context with fromAdrenalineLab flag
    const result = this.executeAbility(ability, {
      source: selectedPerson.card,
      playerId: sourcePlayerId,
      columnIndex: selectedPerson.columnIndex,
      position: selectedPerson.position,
      fromAdrenalineLab: true,
    });

    return result;
  }

  findValidTargets(sourcePlayerId, options = {}) {
    // Use the pure function to count targets
    const opponentId = sourcePlayerId === "left" ? "right" : "left";

    const count = countValidTargets(
      this.state.players[sourcePlayerId],
      this.state.players[opponentId],
      {
        requireEnemy: !options.allowOwn,
        requireDamaged: options.requireDamaged || false,
        requirePerson: options.requirePerson || false,
        requireCamp: options.requireCamp || false,
        allowProtected: options.allowProtected || false,
      }
    );

    console.log(`Found ${count} valid targets`);

    // Still use TargetValidator for the actual list
    return TargetValidator.findValidTargets(
      this.state,
      sourcePlayerId,
      options
    );
  }

  resolveRestore(targetPlayer, targetColumn, targetPosition) {
    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || !target.isDamaged) return false;

    target.isDamaged = false;
    if (target.type === "person") {
      target.isReady = false;
    }

    console.log(`${target.name} restored!`);

    // Clear pending
    this.state.pending = null;
    return true;
  }

  checkForActiveVera(playerId) {
    const player = this.state.players[playerId];
    return checkForSpecialTraits(player, "vera_vosh") !== null;
  }

  completeAbility(pending) {
    console.log("completeAbility called with pending:", pending);

    if (pending?.sourceCard) {
      if (pending.isResonator) {
        this.state.turnEvents.resonatorUsedThisTurn = true;
        console.log(
          "Resonator used - no other abilities can be used this turn"
        );
      }

      // Check if we stored a Vera decision
      if (!pending.shouldStayReady) {
        pending.sourceCard.isReady = false;
      }

      this.state.turnEvents.abilityUsedThisTurn = true;

      console.log(
        `${pending.sourceCard.name} ${
          pending.shouldStayReady
            ? "stays ready (Vera trait)"
            : "marked as not ready"
        } after ability completed`
      );
    }

    // NEW: Also finalize any active ability context (for Adrenaline Lab)
    if (this.activeAbilityContext && !this.activeAbilityContext.completed) {
      this.finalizeAbilityExecution(this.activeAbilityContext);
    }
  }

  checkForActiveKarli(playerId) {
    const player = this.state.players[playerId];
    return checkForSpecialTraits(player, "karli_blaze") !== null;
  }

  finishMutantAbility() {
    const pending = this.state.pending;
    const mutantCard = this.state.getCard(
      pending.sourcePlayerId,
      pending.sourceColumn,
      pending.sourcePosition
    );

    if (mutantCard && !mutantCard.isDestroyed) {
      // Damage Mutant itself
      if (mutantCard.isDamaged) {
        mutantCard.isDestroyed = true;
        // Handle destruction
        const column =
          this.state.players[pending.sourcePlayerId].columns[
            pending.sourceColumn
          ];
        this.destroyPerson(
          this.state.players[pending.sourcePlayerId],
          column,
          pending.sourcePosition,
          mutantCard
        );
        console.log("Mutant destroyed itself");
      } else {
        mutantCard.isDamaged = true;
        mutantCard.isReady = false;
        console.log("Mutant damaged itself");
      }
    }

    // Mark ability complete
    this.completeAbility(pending);

    // Clear pending
    this.state.pending = null;
    if (this.activeAbilityContext && !this.state.pending) {
      this.finalizeAbilityExecution(this.activeAbilityContext);
    }

    console.log("Mutant ability completed");
  }

  applyParachuteBaseDamage(playerId, columnIndex, position) {
    console.log(
      `Parachute Base: Applying damage to person at ${columnIndex}, ${position}`
    );

    // Set up temporary pending for self-damage
    this.state.pending = {
      type: "parachute_damage_self",
      sourcePlayerId: playerId,
    };

    const damaged = this.resolveDamage(playerId, columnIndex, position);

    if (damaged) {
      const person = this.state.getCard(playerId, columnIndex, position);
      if (person) {
        console.log(`Parachute Base: Damaged ${person.name}`);
      }
    } else {
      console.log(
        "Parachute Base: Failed to damage (person might have been destroyed)"
      );
    }

    // Clear pending
    this.state.pending = null;
    return damaged;
  }

  checkDeckExhaustion() {
    const result = this.state.checkDeckExhaustion();
    if (result.gameEnded) {
      this.notifyUI("GAME_OVER", this.state.winner);
      return true;
    }
    return false;
  }

  checkProtection(playerId, columnIndex, position) {
    return !TargetValidator.canTarget(
      this.state,
      playerId,
      columnIndex,
      position,
      {
        allowProtected: false,
      }
    );
  }

  checkForActiveArgo(playerId) {
    const player = this.state.players[playerId];
    return checkForSpecialTraits(player, "argo_yesky");
  }

  handleUseCampAbility(payload) {
    console.log("Camp ability triggered:", payload);

    if (!payload) return false;

    // Don't allow using abilities while there's a pending action
    if (this.state.pending) {
      console.log("Cannot use camp ability while another action is pending");
      return false;
    }

    const { playerId, columnIndex, position, abilityIndex = 0 } = payload;

    console.log("=== CAMP ABILITY DEBUG ===");
    console.log("Payload:", payload);
    console.log("AbilityIndex received:", abilityIndex);
    console.log("Camp position:", position);

    // Verify it's the current player's turn
    if (playerId !== this.state.currentPlayer) {
      console.log("Can only use abilities on your own turn");
      return false;
    }

    // For Juggernaut, use the provided position. For other camps, use position 0
    const campPosition = position !== undefined ? position : 0;
    const camp = this.state.getCard(playerId, columnIndex, campPosition);

    if (!camp) {
      console.log("No camp found at this position");
      return false;
    }

    // Get the specific ability by index
    const ability = camp.abilities?.[abilityIndex];
    if (!ability) {
      console.log(`Camp has no ability at index ${abilityIndex}`);
      return false;
    }

    // Get player
    const player = this.state.players[playerId];

    // Use validation function
    const validation = canUseCampAbility(
      camp,
      player,
      ability.cost,
      this.state.turnEvents
    );

    if (!validation.valid) {
      console.log(validation.reason);
      return false;
    }

    // Check for Vera Vosh's trait BEFORE executing the ability
    let shouldStayReady = false;
    const hasActiveVera = this.checkForActiveVera(playerId);
    if (
      hasActiveVera &&
      !this.state.turnEvents.veraFirstUseCards.includes(camp.id)
    ) {
      // This is the first time this camp has used an ability this turn with Vera active
      shouldStayReady = true;
      this.state.turnEvents.veraFirstUseCards.push(camp.id);
      console.log(`${camp.name} will stay ready due to Vera Vosh's trait!`);
    }

    // Pay cost
    player.water -= ability.cost;
    console.log(
      `Paid ${ability.cost} water for ${camp.name}'s ${ability.effect} ability`
    );

    // Execute ability with the camp reference and Vera decision in context
    const result = this.executeAbility(ability, {
      source: camp,
      playerId: playerId,
      columnIndex: columnIndex,
      position: campPosition,
      campCard: camp,
      veraDecision: shouldStayReady,
    });

    if (camp.name === "Parachute Base" && result !== false) {
      // Parachute Base is special - mark it not ready immediately
      // (unless Vera's trait applies)
      if (!shouldStayReady) {
        camp.isReady = false;
        console.log("Parachute Base marked as not ready immediately");
      }
      // Don't need to track it in pending since we handled it here
      return true;
    }

    // Check if ability failed to execute
    if (result === false) {
      // Refund the water
      player.water += ability.cost;
      console.log(
        `Camp ability could not be used, refunded ${ability.cost} water`
      );
      // Also undo the Vera tracking
      if (shouldStayReady) {
        const index = this.state.turnEvents.veraFirstUseCards.indexOf(camp.id);
        if (index > -1) {
          this.state.turnEvents.veraFirstUseCards.splice(index, 1);
        }
      }
      return false;
    }

    // Check if ability created a pending state
    if (this.state.pending) {
      // Ability started a multi-step process - store card info in pending
      this.state.pending.sourceCard = camp;
      this.state.pending.abilityUsed = ability;
      this.state.pending.shouldStayReady = shouldStayReady;
      console.log(
        "Camp ability started multi-step process, will mark not ready when completed"
      );
      this.notifyUI("PENDING_STATE_CREATED", true);
    } else {
      // Ability completed immediately
      if (!shouldStayReady) {
        camp.isReady = false;
      }
      this.state.turnEvents.abilityUsedThisTurn = true;
    }

    return true;
  }

  checkForActiveZetoKahn(playerId) {
    const player = this.state.players[playerId];
    return checkForSpecialTraits(player, "zeto_kahn") !== null;
  }

  resolveDamage(targetPlayer, targetColumn, targetPosition) {
    const pending = this.state.pending;

    if (!pending) {
      console.error("No pending damage to resolve");
      return false;
    }

    // Special case: Parachute Base can damage own cards
    if (
      targetPlayer === pending.sourcePlayerId &&
      pending.type !== "parachute_damage_self"
    ) {
      console.log("Cannot damage own cards");
      return false;
    }

    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target) {
      console.log("No target at that position");
      return false;
    }

    const column = this.state.players[targetPlayer].columns[targetColumn];

    // Check protection (unless ability ignores it OR it's Parachute self-damage OR High Ground is active)
    if (!pending.allowProtected && pending.type !== "parachute_damage_self") {
      // Check if High Ground makes this unprotected
      if (this.state.turnEvents?.highGroundActive) {
        const opponentId =
          this.state.currentPlayer === "left" ? "right" : "left";
        if (targetPlayer === opponentId) {
          console.log("High Ground active - target is unprotected");
          // Don't block the damage - High Ground makes it unprotected
        } else if (column.isProtected(targetPosition)) {
          // High Ground doesn't affect your own cards
          console.log(`Cannot damage protected ${target.name}`);
          return false;
        }
      } else if (column.isProtected(targetPosition)) {
        // Normal protection check when High Ground isn't active
        console.log(`Cannot damage protected ${target.name}`);
        return false;
      }
    }

    // Apply damage using the helper
    const result = this.applyDamageToCard(
      target,
      targetPlayer,
      targetColumn,
      targetPosition
    );

    // Check for game end if a camp was destroyed
    if (result === "destroyed" && target.type === "camp") {
      console.log(`Camp ${target.name} was destroyed - checking for game end`);
      this.checkGameEnd();
    }

    // Clear pending only after successful damage
    this.state.pending = null;
    return result === "destroyed" || result === "damaged";
  }

  returnPersonToHand(playerId, columnIndex, position) {
    const player = this.state.players[playerId];
    const column = player.columns[columnIndex];
    const card = column.getCard(position);

    if (!card || card.type !== "person") return false;

    // Calculate what card goes back to hand
    const destruction = calculateCardDestruction(card);

    if (card.isPunk) {
      // Punk reveals as actual card when returned to hand
      player.hand.push(destruction.returnCard);
      console.log(
        `Returned punk to hand - revealed as ${destruction.returnCard.name}!`
      );
    } else {
      // Normal person returns as-is
      player.hand.push({
        id: card.id,
        name: card.name,
        type: card.type,
        cost: card.cost,
        abilities: card.abilities,
        junkEffect: card.junkEffect,
      });
      console.log(`Returned ${card.name} to hand`);
    }

    // Remove from column
    column.setCard(position, null);

    // Apply column shifts
    const shifts = calculateColumnShift(column, position);
    shifts.forEach((shift) => {
      column.setCard(shift.to, shift.card);
      column.setCard(shift.from, null);
    });

    return true;
  }

  destroyPerson(player, column, position, card) {
    // Calculate what happens to the destroyed card
    const destruction = calculateCardDestruction(card);

    console.log("=== DESTROY PERSON DEBUG ===");
    console.log("Card:", card.name);
    console.log("Destruction result:", destruction);
    console.log("Destination:", destruction.destination);
    console.log("===========================");

    if (destruction.destination === "deck") {
      this.state.deck.unshift(destruction.returnCard);
      console.log(
        `Punk returned to top of deck (was ${destruction.returnCard.name})`
      );
    } else if (destruction.destination === "discard") {
      this.state.discard.push(destruction.returnCard);
      console.log(`${card.name} sent to discard`);
      console.log(`DISCARD PILE NOW HAS ${this.state.discard.length} CARDS`);
    }

    // Remove from column
    column.setCard(position, null);

    // Calculate and apply column shifts
    const shifts = calculateColumnShift(column, position);
    shifts.forEach((shift) => {
      column.setCard(shift.to, shift.card);
      column.setCard(shift.from, null);
      console.log(
        `Moved ${shift.card.name} from position ${shift.from} to ${shift.to}`
      );
    });

    console.log(`${card.isPunk ? "Punk" : card.name} destroyed`);
  }

  placeCardWithPush(column, position, newCard) {
    const placement = calculatePlacementOptions(column, position, newCard);

    if (!placement.canPlace) {
      console.log(placement.reason);
      return false;
    }

    // Execute the placement based on what was calculated
    if (placement.action === "place") {
      column.setCard(placement.targetPosition, newCard);
      return true;
    }

    if (placement.action === "push") {
      const existingCard = column.getCard(placement.pushFrom);
      column.setCard(placement.pushTo, existingCard);
      column.setCard(placement.pushFrom, newCard);
      console.log(
        `Pushed ${existingCard.name} to position ${placement.pushTo}`
      );
      return true;
    }

    return false;
  }

  applyDamageToCard(target, targetPlayer, targetColumn, targetPosition) {
    const column = this.state.players[targetPlayer].columns[targetColumn];

    // Calculate what should happen
    const damageResult = calculateDamageResult(target, target.isDamaged);

    if (damageResult.result === "invalid") {
      console.log(damageResult.reason);
      return null;
    }

    if (damageResult.result === "destroy") {
      target.isDestroyed = true;
      console.log(`ATTEMPTING TO DESTROY ${target.name}, type: ${target.type}`);
      if (target.type === "person") {
        this.destroyPerson(
          this.state.players[targetPlayer],
          column,
          targetPosition,
          target
        );
      } else if (target.type === "camp") {
        console.log(`Camp ${target.name} destroyed but remains in place`);
      }
      return "destroyed";
    } else {
      target.isDamaged = true;
      if (target.type === "person") {
        target.isReady = false;
      }
      console.log(`${target.name} damaged`);
      return "damaged";
    }
  }

  resolveInjure(targetPlayer, targetColumn, targetPosition) {
    // Same as damage but only for people
    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || target.type !== "person") return false;

    // Store Parachute Base info before clearing pending
    const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

    // Use resolveDamage (which will clear pending)
    const result = this.resolveDamage(
      targetPlayer,
      targetColumn,
      targetPosition
    );

    // Apply Parachute Base damage if needed
    if (result && parachuteBaseDamage) {
      console.log("Applying Parachute Base damage after injure");
      this.applyParachuteBaseDamage(
        parachuteBaseDamage.targetPlayer,
        parachuteBaseDamage.targetColumn,
        parachuteBaseDamage.targetPosition
      );
    }

    return result;
  }

  completeParachuteBase() {
    // Find the Parachute Base camp that initiated this
    // It should be stored in various places depending on the path
    let parachuteCard = null;
    let shouldStayReady = false;

    // Check various places where we might have stored it
    if (this.state.pending?.parachuteSourceCard) {
      parachuteCard = this.state.pending.parachuteSourceCard;
      shouldStayReady = this.state.pending.parachuteShouldStayReady;
    } else if (this.state.pending?.sourceCard?.name === "Parachute Base") {
      parachuteCard = this.state.pending.sourceCard;
      shouldStayReady = this.state.pending.shouldStayReady;
    }

    if (parachuteCard && !shouldStayReady) {
      parachuteCard.isReady = false;
      console.log("Parachute Base marked as not ready after full completion");
    }
  }

  playEvent(playerId, card, cardIndex) {
    const player = this.state.players[playerId];

    // Get event details from registry
    const eventName = card.name.toLowerCase().replace(/\s+/g, "");
    console.log("Looking for event:", eventName);

    const eventDef =
      (typeof window !== "undefined"
        ? window.cardRegistry?.eventAbilities?.[eventName]
        : null) ||
      (typeof global !== "undefined"
        ? global.cardRegistry?.eventAbilities?.[eventName]
        : null);

    console.log(
      "Event lookup result:",
      eventName,
      "->",
      eventDef ? "FOUND" : "NOT FOUND"
    );
    if (eventDef) {
      console.log(
        "Event cost:",
        eventDef.cost,
        "Queue number:",
        eventDef.queueNumber
      );
    }
    if (!eventDef) {
      console.log(`Unknown event: ${card.name}`);
      console.log(
        "Available events:",
        typeof window !== "undefined"
          ? Object.keys(window.cardRegistry?.eventAbilities || {})
          : []
      );

      // Fallback - use the card's own properties if no definition found
      let queueNumber = card.queueNumber || 1;
      const cost = card.cost || 0;

      // Validate event can be played
      const validation = canPlayEvent(player, cost, player.eventQueue);
      if (!validation.valid) {
        console.log(validation.reason);
        return false;
      }

      // Determine if event should resolve immediately
      const shouldResolve = shouldEventResolveImmediately(
        queueNumber,
        !this.state.turnEvents.firstEventPlayedThisTurn,
        this.checkForActiveZetoKahn(playerId)
      );

      if (shouldResolve && queueNumber !== 0) {
        console.log(
          `Zeto Kahn's trait: ${card.name} becomes instant (queue 0)!`
        );
      }

      if (shouldResolve) {
        // Instant due to Zeto
        player.water -= cost;
        player.hand.splice(cardIndex, 1);
        this.state.discard.push(card);
        this.state.turnEvents.firstEventPlayedThisTurn = true;
        // Mark that an event resolved this turn (for Watchtower)
        this.state.turnEvents.eventResolvedThisTurn = true;
        console.log(`${card.name} resolved instantly due to Zeto Kahn`);
        return true;
      }

      // Try to place in queue
      const desiredSlot = queueNumber - 1;
      const placement = calculateEventSlotPlacement(
        player.eventQueue,
        desiredSlot
      );

      if (!placement.canPlace) {
        console.log(placement.reason);
        return false;
      }

      // Place the event
      player.eventQueue[placement.slot] = card;

      // Pay cost and remove from hand
      player.water -= cost;
      player.hand.splice(cardIndex, 1);
      this.state.turnEvents.firstEventPlayedThisTurn = true;

      console.log(`Placed ${card.name} in event queue (no handler found)`);
      return true;
    }

    console.log("Found event definition:", eventDef);

    console.log(
      "About to check cost. Player water:",
      player.water,
      "Event cost:",
      eventDef.cost
    );
    console.log("About to check queue number:", eventDef.queueNumber);

    // Validate event can be played
    const validation = canPlayEvent(player, eventDef.cost, player.eventQueue);
    if (!validation.valid) {
      console.log(validation.reason);
      return false;
    }

    // Determine if event should resolve immediately
    const shouldResolve = shouldEventResolveImmediately(
      eventDef.queueNumber,
      !this.state.turnEvents.firstEventPlayedThisTurn,
      this.checkForActiveZetoKahn(playerId)
    );

    const effectiveQueueNumber = shouldResolve ? 0 : eventDef.queueNumber;

    if (shouldResolve && eventDef.queueNumber !== 0) {
      console.log(`Zeto Kahn's trait: ${card.name} becomes instant (queue 0)!`);
    }

    console.log(
      `Event ${card.name} has effective queue number ${effectiveQueueNumber}`
    );

    if (effectiveQueueNumber === 0) {
      // Instant event - resolve immediately
      console.log(`Playing instant event: ${card.name}`);

      // Pay cost
      player.water -= eventDef.cost;

      // Remove from hand
      player.hand.splice(cardIndex, 1);

      // DISCARD THE EVENT CARD IMMEDIATELY (before executing handler)
      this.state.discard.push(card);
      console.log(`Discarded instant event ${card.name} to discard pile`);

      // Mark that an event was played this turn
      this.state.turnEvents.firstEventPlayedThisTurn = true;

      // Mark that an event resolved this turn (for Watchtower)
      this.state.turnEvents.eventResolvedThisTurn = true;

      // Execute effect
      const context = {
        playerId: playerId,
        eventCard: card,
      };

      console.log("Calling event handler");
      const result = eventDef.effect.handler(this.state, context);
      console.log("Event handler returned:", result);
      console.log("Pending state after handler:", this.state.pending);

      // Don't discard again - already done above

      return result;
    }

    // Queue placement logic for non-instant events
    const desiredSlot = effectiveQueueNumber - 1;
    const placement = calculateEventSlotPlacement(
      player.eventQueue,
      desiredSlot
    );

    if (!placement.canPlace) {
      console.log(placement.reason);
      return false;
    }

    // Place the event
    player.eventQueue[placement.slot] = card;
    console.log(`Placed ${card.name} in slot ${placement.slot}`);

    // Pay cost
    player.water -= eventDef.cost;
    console.log(`Paid ${eventDef.cost} water for ${card.name}`);

    // Remove from hand
    player.hand.splice(cardIndex, 1);
    console.log(`Removed ${card.name} from hand`);

    // Mark that an event was played this turn
    this.state.turnEvents.firstEventPlayedThisTurn = true;

    console.log(`Successfully placed ${card.name} in event queue`);
    console.log(
      "Current event queue:",
      player.eventQueue.map((e) => e?.name || "empty")
    );

    return true;
  }

  resolveRestore(targetPlayer, targetColumn, targetPosition) {
    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || !target.isDamaged) return false;

    target.isDamaged = false;
    target.isReady = false;
    this.state.pending = null;
    return true;
  }

  resolvePlacePunk(targetColumn, targetPosition) {
    const player = this.state.players[this.state.currentPlayer];
    const column = player.columns[targetColumn];

    // Validate placement
    const validation = canPlacePunk(column, targetPosition);
    if (!validation.valid) {
      console.log(validation.reason);
      return false;
    }

    console.log(`Deck size before taking card: ${this.state.deck.length}`);

    // Use the safe draw method
    const result = this.state.drawCardWithReshuffle(false);

    if (result.gameEnded) {
      console.log("Game ended while trying to place punk");
      this.notifyUI("GAME_OVER", this.state.winner);
      this.state.pending = null;
      return false;
    }

    if (!result.card) {
      console.log("Cannot place punk - no cards available");
      this.state.pending = null;
      return false;
    }

    const topCard = result.card;
    console.log(`Took ${topCard.name} from deck to make punk`);
    console.log(`Deck size after taking card: ${this.state.deck.length}`);

    // Create punk using pure function
    const hasKarli = this.checkForActiveKarli(this.state.currentPlayer);
    const punk = createPunkFromCard(topCard, hasKarli);

    if (hasKarli) {
      console.log("Punk enters play ready due to Karli Blaze's trait!");
    }

    // Try to place with push
    if (!this.placeCardWithPush(column, targetPosition, punk)) {
      // If can't place, return card to deck
      this.state.deck.unshift(topCard);
      console.log("Couldn't place punk, returned card to deck");

      // Check exhaustion again after putting card back
      const exhaustion = this.state.checkDeckExhaustion();
      if (exhaustion.gameEnded) {
        this.notifyUI("GAME_OVER", this.state.winner);
        return false;
      }

      return false;
    }

    // INCREMENT THE PEOPLE PLAYED COUNTER!
    this.state.turnEvents.peoplePlayedThisTurn++;
    console.log(
      `Placed punk - people played this turn: ${this.state.turnEvents.peoplePlayedThisTurn}`
    );

    console.log(
      `Placed punk (face-down ${topCard.name}) at column ${targetColumn}, position ${targetPosition}`
    );
    this.state.pending = null;

    return true;
  }

  handleTakeWaterSilo(payload) {
    const { playerId } = payload;
    const player = this.state.players[playerId];

    // Check it's player's turn and correct phase
    if (
      playerId !== this.state.currentPlayer ||
      this.state.phase !== "actions"
    ) {
      console.log("Can only take Water Silo on your turn during actions");
      return false;
    }

    // Check availability and cost
    const waterSilo = findAvailableWaterSilo(player);

    if (!waterSilo.available || waterSilo.location !== "tableau") {
      console.log("Water Silo not available in tableau");
      return false;
    }

    // Check cost
    if (player.water < waterSilo.cost) {
      console.log(`Need ${waterSilo.cost} water to take Water Silo`);
      return false;
    }

    // Pay cost and take to hand
    player.water -= waterSilo.cost;
    player.waterSilo = "in_hand";

    // Add to hand
    player.hand.push({
      id: `water_silo_${playerId}`,
      name: "Water Silo",
      type: "special",
      isWaterSilo: true,
      junkEffect: "water",
      cost: 0,
    });

    console.log("Water Silo taken to hand");
    return true;
  }

  handleCancelAction(payload) {
    console.log("Canceling pending action");

    // Return junk card to hand if cancelling a junk effect
    if (this.state.pending?.junkCard) {
      const player = this.state.players[this.state.pending.sourcePlayerId];
      player.hand.push(this.state.pending.junkCard);
      console.log(`Returned ${this.state.pending.junkCard.name} to hand`);
    }

    // Refund water if an ability was started but not completed
    if (this.state.pending?.sourceCard && this.state.pending?.abilityUsed) {
      const player = this.state.players[this.state.pending.sourcePlayerId];
      player.water += this.state.pending.abilityUsed.cost;

      // Mark card as ready again
      if (this.state.pending.sourceCard) {
        this.state.pending.sourceCard.isReady = true;
      }

      console.log(
        `Refunded ${this.state.pending.abilityUsed.cost} water and marked card as ready`
      );
    }

    this.state.pending = null;
    return true;
  }

  handleDrawCard() {
    const player = this.state.players[this.state.currentPlayer];

    const drawCost = Math.abs(calculateWaterChange("draw_card"));

    if (!canAffordAction(player, drawCost)) {
      console.log(`Not enough water (need ${drawCost}, have ${player.water})`);
      return false;
    }

    player.water += calculateWaterChange("draw_card");

    // Draw 1 card
    const result = this.state.drawCardWithReshuffle(
      true,
      this.state.currentPlayer
    );
    if (result.gameEnded) {
      this.notifyUI("GAME_OVER", this.state.winner);
      return true;
    }

    return true;
  }

  triggerEntryTraits(person, playerId, columnIndex, position) {
    console.log(`${person.name} entered play`);

    const cardName = person.name.toLowerCase().replace(/\s+/g, "");

    const cardRegistry =
      typeof window !== "undefined"
        ? window.cardRegistry
        : typeof global !== "undefined"
        ? global.cardRegistry
        : null;

    if (cardRegistry) {
      const traitHandler = cardRegistry.getTraitHandler(cardName);

      if (traitHandler?.onEntry) {
        console.log(`Triggering entry trait for ${person.name}`);
        traitHandler.onEntry(this.state, {
          card: person,
          playerId,
          columnIndex,
          position,
        });
      }
    }
  }

  resolveInjure(targetPlayer, targetColumn, targetPosition) {
    // Same as damage but only for people
    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || target.type !== "person") return false;
    return this.resolveDamage(targetPlayer, targetColumn, targetPosition);
  }

  resolveRestore(targetPlayer, targetColumn, targetPosition) {
    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target || !target.isDamaged) return false;

    target.isDamaged = false;
    target.isReady = false;
    this.state.pending = null;
    return true;
  }

  handleJunkCard(payload) {
    console.log("=== handleJunkCard called ===");
    const { playerId, cardIndex } = payload;
    const player = this.state.players[playerId];

    // Use validation function
    const validation = canJunkCard(player, cardIndex, this.state.phase);
    if (!validation.valid) {
      console.log(validation.reason);
      return false;
    }

    const card = player.hand[cardIndex];

    // Check if it's the player's turn
    if (playerId !== this.state.currentPlayer) {
      console.log("Can only junk cards on your turn");
      return false;
    }

    console.log(`Junking ${card.name} for ${card.junkEffect} effect`);

    // Remove from hand first
    player.hand.splice(cardIndex, 1);

    // Handle special case for Water Silo - it returns to play area, not discard
    if (card.name === "Water Silo" || card.isWaterSilo) {
      player.waterSilo = "available";
      player.water += 1;
      console.log("Water Silo returned to play area, gained 1 water");
      return true;
    }

    // DISCARD THE CARD FIRST (except for effects that need targeting)
    const junkEffect = card.junkEffect?.toLowerCase();

    // For immediate effects, discard first then execute
    if (
      junkEffect === "water" ||
      junkEffect === "card" ||
      junkEffect === "draw" ||
      junkEffect === "raid"
    ) {
      this.state.discard.push(card);
      console.log(`Discarded ${card.name} to discard pile`);
    }

    // Now process the junk effect
    console.log("Processing junk effect:", junkEffect);

    switch (junkEffect) {
      case "water":
        player.water += calculateWaterChange("junk_water");
        console.log("Gained 1 water from junk effect");
        break;

      case "card":
      case "draw":
        const result = this.state.drawCardWithReshuffle(true, playerId);
        if (result.gameEnded) {
          this.notifyUI("GAME_OVER", this.state.winner);
          return true;
        }
        if (result.card) {
          console.log(`Drew ${result.card.name} from junk effect`);
        }
        break;

      case "raid":
        this.executeRaid(playerId);
        break;

      case "injure":
        // For targeted effects, we need to hold the card until target is selected
        const injureTargets = TargetValidator.findValidTargets(
          this.state,
          playerId,
          {
            requirePerson: true,
            allowProtected: false,
          }
        );

        if (injureTargets.length === 0) {
          console.log("No valid targets to injure");
          // No targets - discard the card and end
          this.state.discard.push(card);
          return true;
        }

        this.state.pending = {
          type: "junk_injure",
          source: card,
          sourcePlayerId: playerId,
          junkCard: card, // Store the junk card to discard after target selection
          validTargets: injureTargets,
        };
        console.log(
          `Select unprotected enemy person to injure (${injureTargets.length} targets)`
        );
        break;

      case "restore": {
        // For targeted effects, we need to find valid targets first
        const restoreTargets = TargetValidator.findValidTargets(
          this.state,
          playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true,
          }
        );

        if (restoreTargets.length === 0) {
          console.log("No damaged cards to restore");
          // No targets - discard the card and end
          this.state.discard.push(card);
          return true;
        }

        // Don't discard yet - wait until after target selection
        this.state.pending = {
          type: "junk_restore",
          source: card,
          sourcePlayerId: playerId,
          junkCard: card, // Store the card to discard after target selection
          validTargets: restoreTargets,
        };

        console.log(
          `Select damaged card to restore (${restoreTargets.length} targets)`
        );
        break;
      }

      case "punk":
        // Discard the card FIRST so it's in the reshuffle pool
        this.state.discard.push(card);
        console.log(`Discarded ${card.name} to discard pile`);

        // Now check if we can place a punk
        if (this.state.deck.length === 0) {
          // Deck is empty - try to reshuffle (which now includes our junked card!)
          const result = this.state.drawCardWithReshuffle(false);

          if (result.gameEnded) {
            console.log("Game ended while trying to gain punk");
            this.notifyUI("GAME_OVER", this.state.winner);
            return true;
          }

          if (!result.card) {
            console.log(
              "Cannot gain punk - no cards available even after reshuffle"
            );
            return true;
          }

          // Put it back for the punk placement
          this.state.deck.unshift(result.card);
        }

        this.state.pending = {
          type: "place_punk",
          source: card,
          sourcePlayerId: playerId,
          // Don't store junkCard since it's already discarded
        };
        console.log("Select where to place the punk");
        break;

      default:
        console.log(`Unknown junk effect: ${junkEffect}`);
        // Unknown effect - discard the card anyway
        this.state.discard.push(card);
        return false;
    }

    return true;
  }

  handleDamage(payload) {
    const { targetPlayer, targetColumn, targetPosition } = payload;

    // This is for direct damage commands, not ability-based damage
    // For now, just apply damage directly
    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target) return false;

    if (target.isDamaged) {
      target.isDestroyed = true;
      console.log(`${target.name} destroyed!`);
    } else {
      target.isDamaged = true;
      if (target.type === "person") {
        target.isReady = false;
      }
      console.log(`${target.name} damaged!`);
    }

    return true;
  }

  triggerEntryEffects(person, playerId) {
    console.log(`${person.name} entered play`);
  }

  registerHandlers() {
    // Register all command handlers
    this.handlers.set("PLAY_CARD", this.handlePlayCard.bind(this));
    this.handlers.set("USE_ABILITY", this.handleUseAbility.bind(this));
    this.handlers.set("USE_CAMP_ABILITY", this.handleUseCampAbility.bind(this));
    this.handlers.set("DAMAGE", this.handleDamage.bind(this));
    this.handlers.set("JUNK_CARD", this.handleJunkCard.bind(this));
    this.handlers.set("END_TURN", this.handleEndTurn.bind(this));
    this.handlers.set("SELECT_TARGET", this.handleSelectTarget.bind(this));
    this.handlers.set("DRAW_CARD", this.handleDrawCard.bind(this));
    this.handlers.set("TAKE_WATER_SILO", this.handleTakeWaterSilo.bind(this));
    this.handlers.set("CANCEL_ACTION", this.handleCancelAction.bind(this));
  }

  validateCommand(command) {
    console.log("Validating command:", command.type);

    // Basic validation
    if (!command.type) return false;

    // SELECT_TARGET is a special case - it doesn't need playerId check
    if (command.type === "SELECT_TARGET") {
      return this.state.pending !== null;
    }

    // All other commands need playerId
    if (!command.playerId) {
      console.log("Command missing playerId");
      return false;
    }

    // Check if it's player's turn
    if (command.playerId !== this.state.currentPlayer && !command.isForced) {
      console.log("Not player's turn");
      return false;
    }

    // Phase-specific validation
    switch (command.type) {
      case "PLAY_CARD":
      case "JUNK_CARD": // ADD THIS
      case "USE_ABILITY":
        return this.state.phase === "actions";
      case "END_TURN":
        return this.state.phase === "actions" && !this.state.pending;
      default:
        return true;
    }
  }

  execute(command) {
    console.log("=== Command execute called ===");
    console.log("Command:", command);

    // Validate command
    if (!this.validateCommand(command)) {
      console.error("Invalid command:", command);
      return false;
    }

    // Store in history (but not for SELECT_TARGET since it doesn't have playerId)
    if (command.type !== "SELECT_TARGET") {
      this.history.push({
        command,
        state: this.state.clone(),
        timestamp: Date.now(),
      });
    }

    // Execute
    const handler = this.handlers.get(command.type);
    console.log("Handler found:", !!handler);

    if (handler) {
      const result = handler(
        command.type === "SELECT_TARGET" ? command : command.payload
      );
      console.log("Handler result:", result);

      // Check for game end
      this.checkGameEnd();

      // DEFER the UI notification to avoid re-render during event handling
      setTimeout(() => {
        this.notifyUI(command.type, result);
      }, 0);

      return result;
    }

    console.log("No handler found for command type:", command.type);
    return false;
  }

  handlePlayCard(payload) {
    if (!payload) payload = {};

    const { playerId, cardId, targetColumn, targetPosition } = payload;
    const player = this.state.players[playerId];

    // Find card in hand
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      console.log("Card not found in hand");
      return false;
    }

    const card = player.hand[cardIndex];
    console.log("Playing card:", card.name, "Type:", card.type);

    // Check cost first (for events, we'll check it in playEvent)
    if (
      card.type === "person" &&
      player.water < this.getAdjustedCost(card, targetColumn, playerId)
    ) {
      console.log("Not enough water!");
      return false;
    }

    // Handle different card types
    if (card.type === "person") {
      return this.playPerson(
        playerId,
        card,
        cardIndex,
        targetColumn,
        targetPosition
      );
    } else if (card.type === "event") {
      console.log("Calling playEvent for:", card.name);
      return this.playEvent(playerId, card, cardIndex);
    }

    console.log("Unknown card type:", card.type);
    return false;
  }

  checkAllSlotsFull(playerId) {
    const player = this.state.players[playerId];
    let emptySlots = 0;

    for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
      for (let pos = 0; pos < 3; pos++) {
        if (!player.columns[col].getCard(pos)) {
          emptySlots++;
        }
      }
    }

    return emptySlots === 0; // All 9 slots occupied
  }

  playPerson(playerId, card, cardIndex, columnIndex, position) {
    const player = this.state.players[playerId];
    const column = player.columns[columnIndex];

    // Calculate cost once at the beginning
    const cost = this.getAdjustedCost(card, columnIndex, playerId);

    // Use our validation function
    const validation = canPlayPerson(player, card, cost, position);
    if (!validation.valid) {
      console.log(validation.reason);
      return false;
    }

    // Create person object
    const person = {
      ...card,
      isReady: false, // Default to not ready
      isDamaged: false,
      position: position,
      columnIndex,
    };

    // Check if this IS Karli Blaze (she enters play ready per her trait)
    if (card.name === "Karli Blaze") {
      person.isReady = true;
      console.log("Karli Blaze enters play ready (her own trait)");
    }
    // OR check for an EXISTING Karli on the board
    else {
      const hasActiveKarli = this.checkForActiveKarli(playerId);
      if (hasActiveKarli) {
        person.isReady = true;
        console.log(
          `${card.name} enters play ready due to Karli Blaze's trait!`
        );
      }
    }

    // Try to place with push
    if (!this.placeCardWithPush(column, position, person)) {
      return false;
    }

    // Pay cost and remove from hand
    player.water -= cost;
    player.hand.splice(cardIndex, 1);

    // Track for turn events
    this.state.turnEvents.peoplePlayedThisTurn++;

    console.log(`Played ${card.name} to position ${position}`);

    // Check for entry traits AFTER successful placement
    this.triggerEntryTraits(person, playerId, columnIndex, position);

    return true;
  }

  determinePosition(column, requestedPosition) {
    // Handle placement logic for columns
    const emptySlots = [];
    for (let i = 1; i <= 2; i++) {
      if (!column.getCard(i)) emptySlots.push(i);
    }

    if (emptySlots.length === 0) return -1;
    if (emptySlots.length === 1) return emptySlots[0];

    // Player has choice
    if (emptySlots.includes(requestedPosition)) {
      return requestedPosition;
    }

    return emptySlots[0];
  }

  getAdjustedCost(card, columnIndex, playerId) {
    const player = this.state.players[playerId];
    return calculateCardCost(card, columnIndex, player);
  }

  handleUseAbility(payload) {
    if (this.state.turnEvents.resonatorUsedThisTurn) {
      console.log("Cannot use abilities - Resonator was used this turn");
      return false;
    }
    if (!payload) return false;

    // Don't allow using abilities while there's a pending action
    if (this.state.pending) {
      console.log("Cannot use ability while another action is pending");
      return false;
    }

    const { playerId, columnIndex, position, abilityIndex, isArgoGranted } =
      payload;

    // Verify this is actually the current player's card
    if (playerId !== this.state.currentPlayer) {
      console.log("Can only use abilities on your own turn");
      return false;
    }

    const card = this.state.getCard(playerId, columnIndex, position);

    // Handle Argo's granted damage ability
    if (isArgoGranted) {
      // Check if Argo is still active
      const argoCard = this.checkForActiveArgo(playerId);
      if (!argoCard) {
        console.log("Argo Yesky is no longer active");
        return false;
      }

      // Check if card can use abilities
      if (!card.isReady) {
        console.log("Card has already used its ability this turn");
        return false;
      }

      if (card.isDestroyed) {
        console.log("Destroyed cards cannot use abilities");
        return false;
      }

      if (card.type === "person" && card.isDamaged) {
        console.log("Damaged people cannot use abilities");
        return false;
      }

      // Check water cost (Argo's granted ability always costs 1)
      const player = this.state.players[playerId];
      if (player.water < 1) {
        console.log("Not enough water for Argo's granted damage ability");
        return false;
      }

      // Pay cost
      player.water -= 1;
      console.log(
        `Paid 1 water for Argo's granted damage ability on ${card.name}`
      );

      // Execute Argo's damage ability
      const argoAbility = { effect: "damage", cost: 1 };
      const result = this.executeAbility(argoAbility, {
        source: card,
        playerId: playerId,
        columnIndex: columnIndex,
        position: position,
        fromArgo: true,
      });

      // Check if ability failed to execute
      if (result === false) {
        // Refund the water
        player.water += 1;
        console.log("Argo ability could not be used, refunded 1 water");
        return false;
      }

      // Check for Vera Vosh's trait
      let shouldStayReady = false;
      const hasActiveVera = this.checkForActiveVera(playerId);
      if (
        hasActiveVera &&
        !this.state.turnEvents.veraFirstUseCards.includes(card.id)
      ) {
        // This is the first time this card has used an ability this turn with Vera active
        shouldStayReady = true;
        this.state.turnEvents.veraFirstUseCards.push(card.id);
        console.log(`${card.name} stays ready due to Vera Vosh's trait!`);
      }

      // Check if ability created a pending state
      if (this.state.pending) {
        // Ability started a multi-step process - store card info in pending
        this.state.pending.sourceCard = card;
        this.state.pending.abilityUsed = argoAbility;
        this.state.pending.shouldStayReady = shouldStayReady;
        console.log(
          "Argo ability started multi-step process, will mark not ready when completed"
        );
        this.notifyUI("PENDING_STATE_CREATED", true);
      } else {
        // Ability completed immediately
        if (!shouldStayReady) {
          card.isReady = false;
        }
        this.state.turnEvents.abilityUsedThisTurn = true;
      }

      return true;
    }

    // Normal ability handling (not Argo-granted)
    if (!card || !card.abilities?.[abilityIndex]) {
      console.log("Card or ability not found");
      return false;
    }

    const ability = card.abilities[abilityIndex];

    // Get the player
    const player = this.state.players[playerId];

    // Use validation function
    const validation = canUseAbility(card, player, ability.cost);
    if (!validation.valid) {
      console.log(validation.reason);
      return false;
    }

    // Pay cost
    player.water -= ability.cost;
    console.log(
      `Paid ${ability.cost} water for ${card.name}'s ${ability.effect} ability`
    );

    // Execute ability
    const result = this.executeAbility(ability, {
      source: card,
      playerId: playerId,
      columnIndex: columnIndex,
      position: position,
    });

    // Check if ability failed to execute
    if (result === false) {
      // Refund the water
      player.water += ability.cost;
      console.log(`Ability could not be used, refunded ${ability.cost} water`);
      // Card stays ready since ability didn't execute
      return false;
    }

    // Check for Vera Vosh's trait
    let shouldStayReady = false;
    const hasActiveVera = this.checkForActiveVera(playerId);
    if (
      hasActiveVera &&
      !this.state.turnEvents.veraFirstUseCards.includes(card.id)
    ) {
      // This is the first time this card has used an ability this turn with Vera active
      shouldStayReady = true;
      this.state.turnEvents.veraFirstUseCards.push(card.id);
      console.log(`${card.name} stays ready due to Vera Vosh's trait!`);
    }

    // Check if ability created a pending state that could be cancelled
    if (this.state.pending) {
      // Ability started a multi-step process - store card info in pending
      this.state.pending.sourceCard = card;
      this.state.pending.abilityUsed = ability;
      this.state.pending.shouldStayReady = shouldStayReady;
      console.log(
        "Ability started multi-step process, will mark not ready when completed"
      );
      // Add immediate UI update
      this.notifyUI("PENDING_STATE_CREATED", true);
    } else {
      // Ability completed immediately
      if (!shouldStayReady) {
        card.isReady = false;
      }
      this.state.turnEvents.abilityUsedThisTurn = true;
    }

    return true;
  }

  executeRaid(playerId) {
    const player = this.state.players[playerId];

    if (player.raiders === "available") {
      // Check for Zeto Kahn's trait BEFORE placing Raiders
      if (
        !this.state.turnEvents.firstEventPlayedThisTurn &&
        this.checkForActiveZetoKahn(playerId)
      ) {
        console.log("Zeto Kahn's trait: Raiders resolves immediately!");

        // Mark that an event was played this turn
        this.state.turnEvents.firstEventPlayedThisTurn = true;
        this.state.turnEvents.eventResolvedThisTurn = true;

        // Resolve Raiders immediately
        const opponentId = playerId === "left" ? "right" : "left";
        this.state.pending = {
          type: "raiders_select_camp",
          sourcePlayerId: playerId,
          targetPlayerId: opponentId,
        };

        console.log(
          `Raiders (instant due to Zeto): ${opponentId} player must choose a camp to damage`
        );
        return true;
      }

      // Normal raid placement
      const placement = calculateRaidPlacement(
        player.eventQueue,
        player.raiders
      );

      if (!placement.canPlace) {
        console.log(`Raid: ${placement.reason}`);
        return false;
      }

      // Place Raiders in the calculated slot
      player.eventQueue[placement.slot] = {
        id: `${playerId}_raiders`,
        name: "Raiders",
        isRaiders: true,
        queueNumber: 2,
      };
      player.raiders = "in_queue";
      this.state.turnEvents.firstEventPlayedThisTurn = true;
      console.log(
        `Raid: Raiders placed in event queue at slot ${placement.slot + 1}`
      );
      return true;
    } else if (player.raiders === "in_queue") {
      // Check if Raiders should resolve
      const raiders = shouldRaidersResolve(player.eventQueue, player.raiders);

      if (raiders.shouldResolve) {
        // Raiders in slot 1 - resolve it
        console.log("Raid: Advancing Raiders off slot 1 - resolving effect!");

        this.state.turnEvents.eventResolvedThisTurn = true;
        player.eventQueue[0] = null;
        player.raiders = "available";

        // Set up opponent camp selection
        const opponentId = playerId === "left" ? "right" : "left";
        this.state.pending = {
          type: "raiders_select_camp",
          sourcePlayerId: playerId,
          targetPlayerId: opponentId,
        };

        console.log(
          `Raiders: ${opponentId} player must choose a camp to damage`
        );
        return true;
      }

      // Try to advance Raiders
      let raidersIndex = -1;
      for (let i = 0; i < 3; i++) {
        if (player.eventQueue[i]?.isRaiders) {
          raidersIndex = i;
          break;
        }
      }

      if (raidersIndex > 0) {
        const newIndex = raidersIndex - 1;
        if (!player.eventQueue[newIndex]) {
          player.eventQueue[newIndex] = player.eventQueue[raidersIndex];
          player.eventQueue[raidersIndex] = null;
          console.log(
            `Raid: Advanced Raiders from slot ${raidersIndex + 1} to slot ${
              newIndex + 1
            }`
          );
          return true;
        } else {
          console.log(
            `Raid: Cannot advance Raiders - slot ${newIndex + 1} is occupied`
          );
          return false;
        }
      }

      console.log("Raid: Raiders not found in queue");
      return false;
    } else {
      console.log("Raid: Raiders already used this game");
      return false;
    }
  }

  executeAbility(ability, context) {
    // Create or enhance the execution context
    const abilityContext = this.createAbilityContext(
      context.source,
      context.playerId,
      context.columnIndex,
      context.position,
      ability,
      context.fromAdrenalineLab || false
    );

    // Store as active context
    this.activeAbilityContext = abilityContext;

    // Get the card name and effect name for handler lookup
    let cardName = context.source.name.toLowerCase().replace(/\s+/g, "");
    const effectName = ability.effect.toLowerCase().replace(/\s+/g, ""); // ← MOVE THIS UP

    console.log("Looking for ability:", cardName, effectName);

    // If this is Mimic copying another card, use THAT card's handler
    if (context.fromMimic && context.copiedFrom) {
      cardName = context.copiedFrom.toLowerCase().replace(/\s+/g, "");
    }

    // Check camp abilities first
    if (context.source.type === "camp") {
      const cardRegistry =
        typeof window !== "undefined"
          ? window.cardRegistry
          : typeof global !== "undefined"
          ? global.cardRegistry
          : null;

      const campAbility = cardRegistry?.campAbilities?.[cardName]?.[effectName];

      if (campAbility?.handler) {
        const result = campAbility.handler(this.state, context);

        // If ability completed immediately (no pending state created)
        if (!this.state.pending) {
          this.finalizeAbilityExecution(abilityContext);
        }

        return result;
      }
    }

    // Check person abilities
    let personAbility = null;

    const cardRegistry =
      typeof window !== "undefined"
        ? window.cardRegistry
        : typeof global !== "undefined"
        ? global.cardRegistry
        : null;

    if (cardRegistry) {
      personAbility = cardRegistry.personAbilities?.[cardName]?.[effectName];

      // If not found in registry and this is Mimic, also check the imported personAbilities
      if (!personAbility && context.fromMimic) {
        const personAbilitiesImport =
          (typeof window !== "undefined" ? window.personAbilities : null) ||
          (typeof global !== "undefined" ? global.personAbilities : null) ||
          {};
        personAbility = personAbilitiesImport[cardName]?.[effectName];
      }
    }

    console.log("Found person ability handler?", !!personAbility);

    if (personAbility?.handler) {
      const result = personAbility.handler(this.state, context);

      // If ability completed immediately (no pending state created)
      if (!this.state.pending) {
        this.finalizeAbilityExecution(abilityContext);
      }

      return result;
    }

    // Fall back to generic ability handling
    this.handleGenericAbility(ability, context);

    // If ability completed immediately (no pending state created)
    if (!this.state.pending) {
      this.finalizeAbilityExecution(abilityContext);
    }
  }

  finalizeAbilityExecution(abilityContext) {
    if (!abilityContext || abilityContext.completed) return;

    abilityContext.completed = true;

    // Check if there's pending Adrenaline Lab destruction info
    if (this.state.pending?.adrenalineLabDestroy) {
      const destroyInfo = this.state.pending.adrenalineLabDestroy;
      console.log("Adrenaline Lab: Ability completed, destroying the person");

      const card = this.state.getCard(
        destroyInfo.playerId,
        destroyInfo.columnIndex,
        destroyInfo.position
      );

      if (card && card.type === "person" && !card.isDestroyed) {
        card.isDestroyed = true;

        const player = this.state.players[destroyInfo.playerId];
        const column = player.columns[destroyInfo.columnIndex];

        // Handle punk vs normal person
        if (card.isPunk) {
          const returnCard = {
            id: card.id,
            name: card.originalName || card.name,
            type: card.originalCard?.type || card.type,
            cost: card.originalCard?.cost || card.cost,
            abilities: card.originalCard?.abilities || card.abilities,
            junkEffect: card.originalCard?.junkEffect || card.junkEffect,
          };
          this.state.deck.unshift(returnCard);
          console.log("Adrenaline Lab: Destroyed punk (returned to deck)");
        } else {
          this.state.discard.push(card);
          console.log(`Adrenaline Lab: Destroyed ${card.name}`);
        }

        // Remove from column
        column.setCard(destroyInfo.position, null);

        // Move cards behind forward
        if (destroyInfo.position < 2) {
          const cardInFront = column.getCard(destroyInfo.position + 1);
          if (cardInFront) {
            column.setCard(destroyInfo.position, cardInFront);
            column.setCard(destroyInfo.position + 1, null);
          }
        }
      }

      // Clear the destruction info
      this.state.pending = null;
    }

    // Original Adrenaline Lab destruction logic (for immediate execution)
    else if (abilityContext.fromAdrenalineLab) {
      console.log("Adrenaline Lab: Ability completed, destroying the person");

      const card = this.state.getCard(
        abilityContext.playerId,
        abilityContext.columnIndex,
        abilityContext.position
      );

      if (card && card.type === "person" && !card.isDestroyed) {
        card.isDestroyed = true;

        const player = this.state.players[abilityContext.playerId];
        const column = player.columns[abilityContext.columnIndex];

        // Handle punk vs normal person
        if (card.isPunk) {
          const returnCard = {
            id: card.id,
            name: card.originalName || card.name,
            type: card.originalCard?.type || card.type,
            cost: card.originalCard?.cost || card.cost,
            abilities: card.originalCard?.abilities || card.abilities,
            junkEffect: card.originalCard?.junkEffect || card.junkEffect,
          };
          this.state.deck.unshift(returnCard);
          console.log("Adrenaline Lab: Destroyed punk (returned to deck)");
        } else {
          this.state.discard.push(card);
          console.log(`Adrenaline Lab: Destroyed ${card.name}`);
        }

        // Remove from column
        column.setCard(abilityContext.position, null);

        // Move cards behind forward
        if (abilityContext.position < 2) {
          const cardInFront = column.getCard(abilityContext.position + 1);
          if (cardInFront) {
            column.setCard(abilityContext.position, cardInFront);
            column.setCard(abilityContext.position + 1, null);
          }
        }
      }
    }

    // Clear active context
    if (this.activeAbilityContext === abilityContext) {
      this.activeAbilityContext = null;
    }
  }

  handleSelectTarget(payload) {
    console.log("handleSelectTarget called, pending:", this.state.pending);

    // Add safety check
    if (!this.state.pending) {
      console.error("No pending action to select target for");
      return false;
    }

    //Try to use a handler if one exists
    const handler = getPendingHandler(
      this.state.pending.type,
      this.state,
      this
    );
    if (handler) {
      return handler.handle(payload);
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Route to appropriate handler based on pending type
    switch (this.state.pending.type) {
      case "place_punk": {
        console.log("=== Processing place_punk target ===");

        // Store info BEFORE resolving
        const junkCard = this.state.pending?.junkCard;
        const fromVanguardEntry = this.state.pending?.fromVanguardEntry;
        const fromArgoEntry = this.state.pending?.fromArgoEntry;
        const parachuteBaseContext = this.state.pending?.parachuteBaseContext;
        const sourceCard = this.state.pending?.sourceCard;
        const fromCache = this.state.pending?.fromCache;
        const doRaidAfter = this.state.pending?.doRaidAfter;
        const cacheContext = this.state.pending?.cacheContext;
        const sourcePlayerId = this.state.pending?.sourcePlayerId;
        const fromScientist = this.state.pending?.fromScientist;
        const scientistCard = this.state.pending?.scientistCard;
        const adrenalineLabDestroy = this.state.pending?.adrenalineLabDestroy;

        // Resolve the punk placement
        const result = this.resolvePlacePunk(targetColumn, targetPosition);

        // If successful and this was from a junk effect, discard the card
        if (result && junkCard) {
          this.state.discard.push(junkCard);
          console.log(`Discarded ${junkCard.name} after placing punk`);
        }

        // Handle Cache's raid-after flag
        if (result && fromCache) {
          if (doRaidAfter) {
            console.log("Cache: Punk placed, now executing Raid");

            const player = this.state.players[sourcePlayerId];

            // Check current Raiders state BEFORE executing raid
            let willResolve = false;
            if (player.raiders === "in_queue") {
              // Find where Raiders currently is
              let raidersIndex = -1;
              for (let i = 0; i < 3; i++) {
                if (player.eventQueue[i]?.isRaiders) {
                  raidersIndex = i;
                  break;
                }
              }

              if (raidersIndex === 0) {
                willResolve = true;
              }
            }

            if (willResolve) {
              // Raiders will resolve when we advance it
              console.log(
                "Cache: Raiders on slot 1 - will resolve immediately"
              );

              // Remove from queue
              player.eventQueue[0] = null;
              player.raiders = "available";

              // Set up opponent camp selection
              const opponentId = sourcePlayerId === "left" ? "right" : "left";
              this.state.pending = {
                type: "raiders_select_camp",
                sourcePlayerId: sourcePlayerId,
                targetPlayerId: opponentId,
                fromCacheComplete: true, // Cache is done after this
                cacheSourceCard: sourceCard,
                adrenalineLabDestroy: adrenalineLabDestroy, // PRESERVE
              };

              console.log(
                `Raiders: ${opponentId} player must choose a camp to damage (Cache complete)`
              );
              return true;
            } else {
              // Raiders won't resolve immediately, just place/advance normally
              this.executeRaid(sourcePlayerId);

              // Mark Cache complete after raid placement/advancement
              if (sourceCard && sourceCard.type === "camp") {
                sourceCard.isReady = false;
                console.log("Cache marked as not ready after both effects");
                this.state.turnEvents.abilityUsedThisTurn = true;
              }

              // Handle Adrenaline Lab destruction if needed
              if (adrenalineLabDestroy) {
                this.state.pending = { adrenalineLabDestroy };
                this.finalizeAbilityExecution(this.activeAbilityContext);
              } else {
                this.state.pending = null;
              }
            }
          } else {
            // No raid after, just mark Cache complete
            if (sourceCard && sourceCard.type === "camp") {
              sourceCard.isReady = false;
              console.log("Cache marked as not ready after both effects");
              this.state.turnEvents.abilityUsedThisTurn = true;
            }

            // Handle Adrenaline Lab destruction if needed
            if (adrenalineLabDestroy) {
              this.state.pending = { adrenalineLabDestroy };
              this.finalizeAbilityExecution(this.activeAbilityContext);
            } else {
              this.state.pending = null;
            }
          }

          return result;
        }

        // Handle Scientist's junk effect
        if (result && fromScientist && scientistCard) {
          scientistCard.isReady = false;
          console.log(
            `${scientistCard.name} marked not ready after Scientist junk completed`
          );

          // Handle Adrenaline Lab destruction if needed
          if (adrenalineLabDestroy) {
            this.state.pending = { adrenalineLabDestroy };
            this.finalizeAbilityExecution(this.activeAbilityContext);
          } else {
            this.state.pending = null;
          }

          return result;
        }

        // Mark camp ability complete if this was from a camp (non-Cache camps)
        if (result && sourceCard && sourceCard.type === "camp" && !fromCache) {
          // Mark the camp as not ready (unless Vera trait applies)
          if (!this.state.pending?.shouldStayReady) {
            sourceCard.isReady = false;
            console.log(
              `${sourceCard.name} marked as not ready after placing punk`
            );
          }
          this.state.turnEvents.abilityUsedThisTurn = true;
        }

        // Check if this was Vanguard's entry trait during Parachute Base
        if (result && fromVanguardEntry && parachuteBaseContext) {
          console.log(
            "Vanguard entry punk placed, continuing Parachute Base sequence"
          );

          const pb = parachuteBaseContext;
          const player = this.state.players[pb.sourcePlayerId];
          const person = this.state.getCard(
            pb.sourcePlayerId,
            pb.targetColumn,
            pb.targetSlot
          );

          if (!person) {
            console.log("ERROR: Can't find Vanguard after entry trait");
            this.state.pending = null;
            return true;
          }

          // Now use Vanguard's actual ability if it has one
          if (pb.hasAbility) {
            console.log(
              `Checking if player can afford Vanguard's ability (${pb.abilityCost} water)`
            );

            if (player.water >= pb.abilityCost) {
              // Pay for the ability
              player.water -= pb.abilityCost;
              console.log(
                `Parachute Base: Paid ${pb.abilityCost} water for Vanguard's damage ability`
              );

              // Execute the ability
              const ability = person.abilities[0];
              const abilityResult = this.executeAbility(ability, {
                source: person,
                playerId: pb.sourcePlayerId,
                columnIndex: pb.targetColumn,
                position: pb.targetSlot,
                fromParachuteBase: true,
              });

              console.log(`Parachute Base: Executed Vanguard's damage ability`);

              // Check if ability set up new pending
              if (this.state.pending) {
                console.log(
                  "Vanguard ability set up damage targeting - adding Parachute damage info"
                );
                this.state.pending.parachuteBaseDamage = {
                  targetPlayer: pb.sourcePlayerId,
                  targetColumn: pb.targetColumn,
                  targetPosition: pb.targetSlot,
                };
              } else {
                // No pending, apply damage now
                console.log(
                  "Vanguard ability completed - applying Parachute damage"
                );
                this.applyParachuteBaseDamage(
                  pb.sourcePlayerId,
                  pb.targetColumn,
                  pb.targetSlot
                );
              }
            } else {
              console.log(
                `Not enough water for ability (need ${pb.abilityCost}, have ${player.water})`
              );
              this.applyParachuteBaseDamage(
                pb.sourcePlayerId,
                pb.targetColumn,
                pb.targetSlot
              );
            }
          } else {
            console.log(
              "Vanguard has no abilities - applying Parachute damage"
            );
            this.applyParachuteBaseDamage(
              pb.sourcePlayerId,
              pb.targetColumn,
              pb.targetSlot
            );
          }
        } else if (result && (fromVanguardEntry || fromArgoEntry)) {
          // Normal entry trait punk placement (not from Parachute Base)
          console.log("Entry trait punk placed");

          // Handle Adrenaline Lab destruction if needed
          if (adrenalineLabDestroy) {
            this.state.pending = { adrenalineLabDestroy };
            this.finalizeAbilityExecution(this.activeAbilityContext);
          } else {
            this.state.pending = null;
          }
        } else {
          // Normal punk placement
          console.log("Normal punk placement completion");

          // Handle Adrenaline Lab destruction if needed
          if (adrenalineLabDestroy) {
            this.state.pending = { adrenalineLabDestroy };
            this.finalizeAbilityExecution(this.activeAbilityContext);
          } else {
            this.state.pending = null;
          }
        }

        return result;
      }

      case "famine_select_keep": {
        const pending = this.state.pending;

        // Verify the selected target is valid
        const isValidTarget = pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid person to keep");
          return false;
        }

        const selectedCard = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        console.log(
          `Famine: ${targetPlayer} chose to keep ${selectedCard.name}`
        );

        // Destroy all OTHER people belonging to this player
        const player = this.state.players[pending.currentSelectingPlayer];
        let destroyedCount = 0;

        // Process from front to back to avoid issues
        for (let col = 0; col < 3; col++) {
          for (let pos = 2; pos >= 1; pos--) {
            const card = player.columns[col].getCard(pos);

            // Skip the selected card to keep
            if (col === targetColumn && pos === targetPosition) {
              continue;
            }

            if (card && card.type === "person" && !card.isDestroyed) {
              // Destroy this person
              card.isDestroyed = true;

              if (card.isPunk) {
                // Return punk to deck
                const returnCard = {
                  id: card.id,
                  name: card.originalName || card.name,
                  type: card.originalCard?.type || card.type,
                  cost: card.originalCard?.cost || card.cost,
                  abilities: card.originalCard?.abilities || card.abilities,
                  junkEffect: card.originalCard?.junkEffect || card.junkEffect,
                };
                this.state.deck.unshift(returnCard);
                console.log(`Famine destroyed punk (returned to deck)`);
              } else {
                this.state.discard.push(card);
                console.log(`Famine destroyed ${card.name}`);
              }

              // Remove from column
              player.columns[col].setCard(pos, null);

              // Move card in front back if needed
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
          `Famine: ${pending.currentSelectingPlayer} destroyed ${destroyedCount} people`
        );

        // Check if we need the other player to select
        if (
          !pending.activePlayerDone &&
          pending.currentSelectingPlayer === pending.activePlayerId
        ) {
          // Active player just finished, now check if opponent needs to select
          const opponentId =
            pending.activePlayerId === "left" ? "right" : "left";
          const opponent = this.state.players[opponentId];
          let opponentPeople = [];

          for (let col = 0; col < 3; col++) {
            for (let pos = 1; pos <= 2; pos++) {
              const card = opponent.columns[col].getCard(pos);
              if (card && card.type === "person" && !card.isDestroyed) {
                opponentPeople.push({
                  card,
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                });
              }
            }
          }

          if (opponentPeople.length <= 1) {
            console.log(
              `Famine: ${opponentId} has ${opponentPeople.length} people, no selection needed`
            );
            // Done with Famine
            if (pending.eventCard) {
              this.state.discard.push(pending.eventCard);
            }
            this.state.pending = null;

            // Continue event phase if needed
            if (this.state.phase === "events") {
              const player = this.state.players[this.state.currentPlayer];
              for (let i = 0; i < 2; i++) {
                player.eventQueue[i] = player.eventQueue[i + 1];
              }
              player.eventQueue[2] = null;
              this.continueToReplenishPhase();
            }
          } else {
            // Opponent needs to select
            this.state.pending = {
              type: "famine_select_keep",
              currentSelectingPlayer: opponentId,
              activePlayerId: pending.activePlayerId,
              validTargets: opponentPeople,
              eventCard: pending.eventCard,
              activePlayerDone: true,
            };

            console.log(
              `Famine: Now ${opponentId} must select one person to keep`
            );
          }
        } else {
          // All done
          console.log("Famine: All selections complete");

          if (pending.eventCard) {
            this.state.discard.push(pending.eventCard);
          }
          this.state.pending = null;

          // Continue event phase if needed
          if (this.state.phase === "events") {
            const player = this.state.players[this.state.currentPlayer];
            for (let i = 0; i < 2; i++) {
              player.eventQueue[i] = player.eventQueue[i + 1];
            }
            player.eventQueue[2] = null;
            this.continueToReplenishPhase();
          }
        }

        return true;
      }

      case "highground_select_person": {
        const pending = this.state.pending;
        const { personId } = payload;

        // Find the selected person
        const selectedIndex = pending.collectedPeople.findIndex(
          (p) => p.id === personId
        );
        if (selectedIndex === -1) {
          console.log("Invalid person selection");
          return false;
        }

        const selectedPerson = pending.collectedPeople.splice(
          selectedIndex,
          1
        )[0];

        // Move to placement mode
        this.state.pending = {
          type: "highground_place_person",
          playerId: pending.playerId,
          selectedPerson: selectedPerson,
          collectedPeople: pending.collectedPeople,
          eventCard: pending.eventCard,
        };

        console.log(`High Ground: Now place ${selectedPerson.name}`);
        return true;
      }

      case "highground_place_person": {
        const pending = this.state.pending;

        if (targetPlayer !== pending.playerId) {
          console.log("Must place in your own columns");
          return false;
        }

        if (targetPosition === 0) {
          console.log("Cannot place in camp slots");
          return false;
        }

        const column =
          this.state.players[pending.playerId].columns[targetColumn];
        const existingCard = column.getCard(targetPosition);

        // Handle push mechanics
        if (existingCard) {
          const pushToPosition = targetPosition === 1 ? 2 : 1;
          const cardInPushPosition = column.getCard(pushToPosition);

          if (cardInPushPosition) {
            console.log("Cannot place - both slots occupied");
            return false;
          }

          column.setCard(pushToPosition, existingCard);
          console.log(
            `Pushed ${existingCard.name} to position ${pushToPosition}`
          );
        }

        // Place the person
        column.setCard(targetPosition, pending.selectedPerson);
        console.log(
          `Placed ${pending.selectedPerson.name} at column ${targetColumn}, position ${targetPosition}`
        );

        // Check if more people to place
        if (pending.collectedPeople.length > 0) {
          // Go back to selection
          this.state.pending = {
            type: "highground_select_person",
            playerId: pending.playerId,
            collectedPeople: pending.collectedPeople,
            eventCard: pending.eventCard,
          };
          console.log(
            `High Ground: Select next person (${pending.collectedPeople.length} remaining)`
          );
        } else {
          // All placed - activate effect
          console.log(
            "High Ground: All cards placed, opponent's cards are unprotected!"
          );
          this.state.turnEvents.highGroundActive = true;

          if (pending.eventCard) {
            this.state.discard.push(pending.eventCard);
          }

          this.state.pending = null;

          // Continue phase if needed
          if (this.state.phase === "events") {
            const player = this.state.players[this.state.currentPlayer];
            for (let i = 0; i < 2; i++) {
              player.eventQueue[i] = player.eventQueue[i + 1];
            }
            player.eventQueue[2] = null;
            this.continueToReplenishPhase();
          }
        }

        return true;
      }

      case "uprising_place_punks": {
        const pending = this.state.pending;
        const player = this.state.players[pending.sourcePlayerId];

        // Verify this is the player's own slot
        if (targetPlayer !== pending.sourcePlayerId) {
          console.log("Must place punks in your own columns");
          return false;
        }

        const column = player.columns[targetColumn];

        // Check if deck has cards
        if (this.state.deck.length === 0) {
          console.log("Cannot place punk - deck is empty");
          // Discard event and clear pending
          if (pending.eventCard) {
            this.state.discard.push(pending.eventCard);
          }
          this.state.pending = null;
          return false;
        }

        // Take the top card from the deck
        const result = this.state.drawCardWithReshuffle(false);
        if (result.gameEnded) {
          this.notifyUI("GAME_OVER", this.state.winner);
          return false;
        }
        if (!result.card) {
          console.log("Cannot place punk - deck is empty");
          if (pending.eventCard) {
            this.state.discard.push(pending.eventCard);
          }
          this.state.pending = null;
          return false;
        }
        const topCard = result.card;
        console.log(
          `Took ${topCard.name} from deck to make punk ${pending.punksRemaining}`
        );

        // Create punk from top card
        const punk = {
          ...topCard,
          isPunk: true,
          isFaceDown: true,
          isReady: false,
          isDamaged: false,
          originalName: topCard.name,
          originalCard: { ...topCard }, // Store complete original card
          name: "Punk",
        };

        // Check for Karli Blaze's trait
        const hasActiveKarli = this.checkForActiveKarli(pending.sourcePlayerId);
        if (hasActiveKarli) {
          punk.isReady = true;
          console.log("Punk enters play ready due to Karli Blaze's trait!");
        }

        // Try to place with push
        if (!this.placeCardWithPush(column, targetPosition, punk)) {
          // If can't place, return card to deck
          this.state.deck.unshift(topCard);
          console.log("Couldn't place punk, returned card to deck");
          return false;
        }

        // INCREMENT THE COUNTER FOR UPRISING PUNKS TOO!
        this.state.turnEvents.peoplePlayedThisTurn++;
        console.log(
          `Uprising punk placed - people played this turn: ${this.state.turnEvents.peoplePlayedThisTurn}`
        );

        console.log(
          `Uprising: Placed punk at column ${targetColumn}, position ${targetPosition}`
        );

        // Check if more punks to place
        if (pending.punksRemaining > 1) {
          // Set up for next punk
          this.state.pending = {
            type: "uprising_place_punks",
            sourcePlayerId: pending.sourcePlayerId,
            punksRemaining: pending.punksRemaining - 1,
            eventCard: pending.eventCard,
          };
          console.log(
            `Uprising: Place punk ${pending.punksRemaining - 1} remaining`
          );
        } else {
          // All punks placed, discard event
          console.log("Uprising: All punks placed");
          if (pending.eventCard) {
            this.state.discard.push(pending.eventCard);
          }

          // Clear pending
          this.state.pending = null;

          // If we're in events phase, continue with phase progression
          if (this.state.phase === "events") {
            // Advance remaining events
            const player = this.state.players[this.state.currentPlayer];
            for (let i = 0; i < 2; i++) {
              player.eventQueue[i] = player.eventQueue[i + 1];
            }
            player.eventQueue[2] = null;

            // Continue to replenish
            this.continueToReplenishPhase();
          }
        }

        return true;
      }
      case "napalm_select_column": {
        // Napalm needs a column selection, infer from the clicked position
        const targetCol = targetColumn;

        // Verify it's a valid column
        if (!this.state.pending.validColumns.includes(targetCol)) {
          console.log("Not a valid column for Napalm");
          return false;
        }

        const opponent = this.state.players[this.state.pending.targetPlayerId];
        const column = opponent.columns[targetCol];
        let destroyedCount = 0;

        console.log(`Napalm: Destroying all enemies in column ${targetCol}`);

        // Process from front to back to handle card movement
        for (let pos = 2; pos >= 0; pos--) {
          const card = column.getCard(pos);
          if (card && card.type === "person" && !card.isDestroyed) {
            // Destroy it
            card.isDestroyed = true;

            if (card.isPunk) {
              const returnCard = {
                id: card.id,
                name: card.originalName || "Unknown Card",
                type: "person",
                cost: card.cost || 0,
                abilities: card.abilities || [],
                junkEffect: card.junkEffect,
              };
              this.state.deck.unshift(returnCard);
              console.log(`Napalm destroyed punk`);
            } else {
              this.state.discard.push(card);
              console.log(`Napalm destroyed ${card.name}`);
            }

            // Remove from column
            column.setCard(pos, null);

            // Move card behind forward
            if (pos < 2) {
              const cardInFront = column.getCard(pos + 1);
              if (cardInFront) {
                column.setCard(pos, cardInFront);
                column.setCard(pos + 1, null);
              }
            }

            destroyedCount++;
          }
        }

        console.log(
          `Napalm destroyed ${destroyedCount} enemies in column ${targetCol}`
        );

        // Discard the event
        if (this.state.pending.eventCard) {
          this.state.discard.push(this.state.pending.eventCard);
        }

        // Clear pending
        this.state.pending = null;

        // If in events phase, continue
        if (this.state.phase === "events") {
          const player = this.state.players[this.state.currentPlayer];
          for (let i = 0; i < 2; i++) {
            player.eventQueue[i] = player.eventQueue[i + 1];
          }
          player.eventQueue[2] = null;

          this.continueToReplenishPhase();
        }

        return true;
      }

      case "banish_destroy": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Banish");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.type !== "person") {
          console.log("Banish can only destroy enemy people");
          return false;
        }

        // Destroy the target outright
        target.isDestroyed = true;

        if (target.type === "person") {
          // Handle person destruction
          if (target.isPunk) {
            const returnCard = {
              id: target.id,
              name: target.originalName || target.name,
              type: target.type,
              cost: target.cost,
              abilities: target.abilities,
              junkEffect: target.junkEffect,
            };
            this.state.deck.unshift(returnCard);
            console.log(`Banish destroyed punk (returned to deck)`);
          } else {
            this.state.discard.push(target);
            console.log(`Banish destroyed ${target.name}`);
          }

          // Remove from column
          const column = this.state.players[targetPlayer].columns[targetColumn];
          column.setCard(targetPosition, null);

          // Move card in front back if needed
          if (targetPosition < 2) {
            const cardInFront = column.getCard(targetPosition + 1);
            if (cardInFront) {
              column.setCard(targetPosition, cardInFront);
              column.setCard(targetPosition + 1, null);
            }
          }
        } else if (target.type === "camp") {
          console.log(
            `Banish destroyed ${target.name} camp (ignoring protection)`
          );
        }

        // Discard the event card
        if (this.state.pending.eventCard) {
          this.state.discard.push(this.state.pending.eventCard);
        }

        // Clear pending
        this.state.pending = null;

        // Check for game end
        this.checkGameEnd();

        console.log("Banish event resolved");

        // If we're in events phase, continue with phase progression
        if (this.state.phase === "events") {
          // Advance remaining events
          const player = this.state.players[this.state.currentPlayer];
          for (let i = 0; i < 2; i++) {
            player.eventQueue[i] = player.eventQueue[i + 1];
          }
          player.eventQueue[2] = null;

          // Continue to replenish
          this.continueToReplenishPhase();
        }

        return true;
      }

      case "damage":
        // Store Parachute Base info before resolving
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Mark ability complete BEFORE resolving damage
        this.completeAbility(this.state.pending);

        if (this.activeAbilityContext && !this.state.pending) {
          this.finalizeAbilityExecution(this.activeAbilityContext);
        }

        // Resolve the damage (this clears pending)
        const result = this.resolveDamage(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // ADD THIS: Finalize ability execution if there's an active context
        if (this.activeAbilityContext && !this.state.pending) {
          this.finalizeAbilityExecution(this.activeAbilityContext);
        }

        // Apply Parachute Base damage if needed
        if (result && parachuteBaseDamage) {
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return result;

      case "place_punk": {
        console.log("=== Processing place_punk target ===");

        // Store info BEFORE resolving
        const junkCard = this.state.pending?.junkCard;
        const fromVanguardEntry = this.state.pending?.fromVanguardEntry;
        const fromArgoEntry = this.state.pending?.fromArgoEntry;
        const parachuteBaseContext = this.state.pending?.parachuteBaseContext;
        const sourceCard = this.state.pending?.sourceCard;
        const fromCache = this.state.pending?.fromCache;
        const doRaidAfter = this.state.pending?.doRaidAfter;
        const cacheContext = this.state.pending?.cacheContext;
        const sourcePlayerId = this.state.pending?.sourcePlayerId;
        const fromScientist = this.state.pending?.fromScientist;
        const scientistCard = this.state.pending?.scientistCard;

        // Resolve the punk placement
        const result = this.resolvePlacePunk(targetColumn, targetPosition);

        // If successful and this was from a junk effect, discard the card
        if (result && junkCard) {
          this.state.discard.push(junkCard);
          console.log(`Discarded ${junkCard.name} after placing punk`);
        }

        // Handle Cache's raid-after flag
        if (result && fromCache) {
          if (doRaidAfter) {
            console.log("Cache: Punk placed, now executing Raid");

            const player = this.state.players[sourcePlayerId];

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
                // Raiders will resolve NOW
                console.log(
                  "Cache: Raiders advancing off slot 1 - resolving immediately"
                );

                // Remove from queue
                player.eventQueue[0] = null;
                player.raiders = "available";

                // Set up opponent camp selection
                const opponentId = sourcePlayerId === "left" ? "right" : "left";
                this.state.pending = {
                  type: "raiders_select_camp",
                  sourcePlayerId: sourcePlayerId,
                  targetPlayerId: opponentId,
                  fromCacheComplete: true, // Cache is done after this
                  cacheSourceCard: sourceCard,
                };

                console.log(
                  `Raiders: ${opponentId} player must choose a camp to damage (Cache complete)`
                );
                return true;
              }
            }

            // Raiders won't resolve immediately, just execute raid normally
            this.executeRaid(sourcePlayerId);
          }

          // Mark Cache ability complete (if not waiting for Raiders)
          if (!this.state.pending) {
            if (sourceCard && sourceCard.type === "camp") {
              sourceCard.isReady = false;
              console.log("Cache marked as not ready after both effects");
              this.state.turnEvents.abilityUsedThisTurn = true;
            }
            this.state.pending = null;
          }

          return result;
        }

        // Handle Scientist's junk effect
        if (result && fromScientist && scientistCard) {
          scientistCard.isReady = false;
          console.log(
            `${scientistCard.name} marked not ready after Scientist junk completed`
          );
          this.state.pending = null;
          return result;
        }

        // Mark camp ability complete if this was from a camp (non-Cache camps)
        if (result && sourceCard && sourceCard.type === "camp" && !fromCache) {
          // Mark the camp as not ready (unless Vera trait applies)
          if (!this.state.pending?.shouldStayReady) {
            sourceCard.isReady = false;
            console.log(
              `${sourceCard.name} marked as not ready after placing punk`
            );
          }
          this.state.turnEvents.abilityUsedThisTurn = true;
        }

        // Check if this was Vanguard's entry trait during Parachute Base
        if (result && fromVanguardEntry && parachuteBaseContext) {
          console.log(
            "Vanguard entry punk placed, continuing Parachute Base sequence"
          );

          const pb = parachuteBaseContext;
          const player = this.state.players[pb.sourcePlayerId];
          const person = this.state.getCard(
            pb.sourcePlayerId,
            pb.targetColumn,
            pb.targetSlot
          );

          if (!person) {
            console.log("ERROR: Can't find Vanguard after entry trait");
            this.state.pending = null;
            return true;
          }

          // Now use Vanguard's actual ability if it has one
          if (pb.hasAbility) {
            console.log(
              `Checking if player can afford Vanguard's ability (${pb.abilityCost} water)`
            );

            if (player.water >= pb.abilityCost) {
              // Pay for the ability
              player.water -= pb.abilityCost;
              console.log(
                `Parachute Base: Paid ${pb.abilityCost} water for Vanguard's damage ability`
              );

              // Execute the ability
              const ability = person.abilities[0];
              const abilityResult = this.executeAbility(ability, {
                source: person,
                playerId: pb.sourcePlayerId,
                columnIndex: pb.targetColumn,
                position: pb.targetSlot,
                fromParachuteBase: true,
              });

              console.log(`Parachute Base: Executed Vanguard's damage ability`);

              // Check if ability set up new pending
              if (this.state.pending) {
                console.log(
                  "Vanguard ability set up damage targeting - adding Parachute damage info"
                );
                this.state.pending.parachuteBaseDamage = {
                  targetPlayer: pb.sourcePlayerId,
                  targetColumn: pb.targetColumn,
                  targetPosition: pb.targetSlot,
                };
              } else {
                // No pending, apply damage now
                console.log(
                  "Vanguard ability completed - applying Parachute damage"
                );
                this.applyParachuteBaseDamage(
                  pb.sourcePlayerId,
                  pb.targetColumn,
                  pb.targetSlot
                );
              }
            } else {
              console.log(
                `Not enough water for ability (need ${pb.abilityCost}, have ${player.water})`
              );
              this.applyParachuteBaseDamage(
                pb.sourcePlayerId,
                pb.targetColumn,
                pb.targetSlot
              );
            }
          } else {
            console.log(
              "Vanguard has no abilities - applying Parachute damage"
            );
            this.applyParachuteBaseDamage(
              pb.sourcePlayerId,
              pb.targetColumn,
              pb.targetSlot
            );
          }
        } else if (result && (fromVanguardEntry || fromArgoEntry)) {
          // Normal entry trait punk placement (not from Parachute Base)
          console.log("Entry trait punk placed");
          this.state.pending = null;
        } else {
          // Normal punk placement
          console.log("Normal punk placement completion");
          this.state.pending = null;
        }

        return result;
      }

      default:
        console.log(`Unknown pending type: ${this.state.pending.type}`);
        return false;
    }
  }

  checkAndApplyParachuteBaseDamage() {
    if (this.state.pending?.parachuteBaseDamage) {
      const pbDamage = this.state.pending.parachuteBaseDamage;

      console.log("Applying Parachute Base damage", pbDamage);

      // Set up self-damage pending
      this.state.pending = {
        type: "parachute_damage_self",
        sourcePlayerId: pbDamage.targetPlayer,
      };

      // Apply the damage
      const selfDamaged = this.resolveDamage(
        pbDamage.targetPlayer,
        pbDamage.targetColumn,
        pbDamage.targetPosition
      );

      if (selfDamaged) {
        console.log(
          "Parachute Base: Damaged the person after ability resolved"
        );
      }

      // Clear pending
      this.state.pending = null;

      // Complete Parachute Base
      this.completeParachuteBase();

      return true;
    }
    return false;
  }

  checkGameEnd() {
    const gameEnd = isGameEndingState(
      this.state.players.left,
      this.state.players.right
    );

    if (gameEnd.gameEnds) {
      this.state.phase = "game_over";
      this.state.winner = gameEnd.winner;
      this.state.winReason = gameEnd.reason;
      console.log(`${gameEnd.winner} wins - ${gameEnd.reason}!`);
      this.notifyUI("GAME_OVER", gameEnd.winner);
      return true;
    }

    return false;
  }

  notifyUI(commandType, result) {
    // Only dispatch events in browser environment
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gameStateChanged", {
          detail: { commandType, result, state: this.state },
        })
      );
    }
  }

  // Import your existing ability handlers here
  getAbilityHandler(cardName, effect) {
    // This will connect to your card-specific handlers
    if (typeof window !== "undefined") {
      const handlers = window.cardAbilityHandlers || {};
      return handlers[cardName]?.[effect];
    }
    return null;
  }

  handleGenericAbility(ability, context) {
    switch (ability.effect) {
      case "damage":
        this.state.pending = {
          type: "damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
        };
        break;
      case "extra_water":
        this.state.players[context.playerId].water += 1;
        break;
      case "raid":
        this.executeRaid(context.playerId);
        break;
      default:
        console.log(`Unknown ability effect: ${ability.effect}`);
    }
  }

  findEventSlot(playerId, startPosition) {
    const queue = this.state.players[playerId].eventQueue;

    if (playerId === "left") {
      for (let i = 3 - startPosition; i >= 0; i--) {
        if (!queue[i]) return i;
      }
    } else {
      for (let i = startPosition - 1; i < 3; i++) {
        if (!queue[i]) return i;
      }
    }

    return -1;
  }

  handleEndTurn() {
    // Reset turn events
    this.state.turnEvents = {
      eventsPlayed: 0,
      peoplePlayedThisTurn: 0,
      eventResolvedThisTurn: false,
      abilityUsedThisTurn: false,
      veraFirstUseCards: [],
      highGroundActive: false,
      firstEventPlayedThisTurn: false,
      resonatorUsedThisTurn: false,
    };

    // Switch player using pure function
    this.state.currentPlayer = calculateNextPlayer(this.state.currentPlayer);
    this.state.turnNumber++;

    // Determine next phase
    const transition = calculatePhaseTransition("actions", false);
    this.state.phase = transition.nextPhase;

    this.notifyUI("PHASE_CHANGE", this.state.phase);

    // Server doesn't need UI delays
    this.processEventsPhase();

    return true;
  }

  processEventsPhase() {
    const player = this.state.players[this.state.currentPlayer];

    // Resolve event in slot 1 (index 0)
    if (player.eventQueue[0]) {
      const event = player.eventQueue[0];
      console.log(`Resolving event: ${event.name}`);

      // Handle Raiders specially
      if (event.isRaiders) {
        console.log("Raiders event resolving!");

        // Mark that an event resolved this turn
        this.state.turnEvents.eventResolvedThisTurn = true;

        // Remove from queue
        player.eventQueue[0] = null;

        // Return to available
        player.raiders = "available";

        // Set up opponent camp selection
        const opponentId =
          this.state.currentPlayer === "left" ? "right" : "left";
        this.state.pending = {
          type: "raiders_select_camp",
          sourcePlayerId: this.state.currentPlayer,
          targetPlayerId: opponentId,
        };

        console.log(
          `Raiders: ${opponentId} player must choose a camp to damage`
        );

        // Update UI immediately to show the selection state
        this.notifyUI("RAIDERS_RESOLVING", null);

        // Don't continue with normal phase progression - wait for selection
        return;
      } else {
        // Look up event definition for non-Raiders events
        const eventName = event.name.toLowerCase().replace(/\s+/g, "");
        const eventDef =
          (typeof window !== "undefined"
            ? window.cardRegistry?.eventAbilities?.[eventName]
            : null) ||
          (typeof global !== "undefined"
            ? global.cardRegistry?.eventAbilities?.[eventName]
            : null);

        if (eventDef?.effect?.handler) {
          console.log(`Resolving ${event.name} event effect`);

          // Mark that an event resolved this turn
          this.state.turnEvents.eventResolvedThisTurn = true;

          // Remove from queue first
          player.eventQueue[0] = null;

          // Execute the event effect
          const context = {
            playerId: this.state.currentPlayer,
            eventCard: event,
          };

          const result = eventDef.effect.handler(this.state, context);

          // Discard the event after it resolves (queue 1/2/3 events)
          if (!this.state.discard.includes(event)) {
            this.state.discard.push(event);
          }

          // Check for game end conditions after event resolves
          this.checkGameEnd(); // Check for 3 destroyed camps
          if (this.checkDeckExhaustion()) {
            // Game ended due to deck exhaustion
            return;
          }

          // Check if event created a pending state
          if (this.state.pending) {
            // Event needs target selection, wait for it
            console.log(`${event.name} event waiting for target selection`);
            this.notifyUI("EVENT_PENDING_TARGET", null);
            return; // Don't advance phase yet
          } else {
            // Event completed immediately, discard it
            // (Note: event might already be discarded by handler)
            if (!this.state.discard.includes(event)) {
              this.state.discard.push(event);
            }
          }
        } else {
          // No handler found, just discard
          console.log(`No handler for ${event.name}, discarding`);

          // Still mark that an event resolved (even if no handler)
          this.state.turnEvents.eventResolvedThisTurn = true;

          player.eventQueue[0] = null;
          this.state.discard.push(event);
        }
      }
    }

    // Only advance events and continue if no pending selection and game hasn't ended
    if (!this.state.pending && this.state.phase !== "game_over") {
      // Advance events forward
      for (let i = 0; i < 2; i++) {
        player.eventQueue[i] = player.eventQueue[i + 1];
      }
      player.eventQueue[2] = null;

      // Continue to replenish phase
      this.continueToReplenishPhase();
    }
  }

  continueToReplenishPhase() {
    // Update UI to show event changes
    this.notifyUI("EVENTS_PROCESSED", null);

    // Move to replenish phase immediately
    this.state.phase = "replenish";
    this.notifyUI("PHASE_CHANGE", "replenish");

    // Process replenish immediately
    this.processReplenishPhase();
  }

  processReplenishPhase() {
    const player = this.state.players[this.state.currentPlayer];

    // Draw a card
    const result = this.state.drawCardWithReshuffle(
      true,
      this.state.currentPlayer
    );
    if (result.gameEnded) {
      this.notifyUI("GAME_OVER", this.state.winner);
      return;
    }
    if (result.card) {
      console.log(`${this.state.currentPlayer} drew: ${result.card.name}`);
    }

    // Set water using pure function
    player.water = calculateReplenishWater(this.state.turnNumber);

    // Ready all cards that should be ready
    for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (card && shouldCardBeReady(card)) {
          card.isReady = true;
        }
      }
    }

    // Move to actions phase immediately
    const transition = calculatePhaseTransition("replenish", false);
    this.state.phase = transition.nextPhase;
    this.notifyUI("PHASE_CHANGE", this.state.phase);
  }
}
