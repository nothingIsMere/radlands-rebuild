import { CardRegistry } from "../cards/card-registry.js";
import { CONSTANTS } from "./constants.js";

export class CommandSystem {
  constructor(gameState) {
    this.state = gameState;
    this.history = [];
    this.pendingCommand = null;
    this.handlers = new Map();

    this.registerHandlers();
  }

  checkForActiveVera(playerId) {
    const player = this.state.players[playerId];

    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (
          card &&
          card.name === "Vera Vosh" &&
          !card.isDamaged &&
          !card.isDestroyed
        ) {
          return true;
        }
      }
    }

    return false;
  }

  completeAbility(pending) {
    if (pending?.sourceCard) {
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
  }

  checkForActiveKarli(playerId) {
    const player = this.state.players[playerId];

    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (
          card &&
          card.name === "Karli Blaze" &&
          !card.isDamaged &&
          !card.isDestroyed
        ) {
          return true;
        }
      }
    }

    return false;
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

  checkProtection(playerId, columnIndex, position) {
    // High Ground overrides ALL protection for the opponent
    if (this.state.turnEvents?.highGroundActive) {
      const opponentId = this.state.currentPlayer === "left" ? "right" : "left";
      if (playerId === opponentId) {
        console.log("High Ground active - target is unprotected");
        return false; // Not protected during High Ground
      }
    }

    // Normal protection check
    const column = this.state.players[playerId].columns[columnIndex];
    return column.isProtected(position);
  }

  checkForActiveArgo(playerId) {
    const player = this.state.players[playerId];

    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (
          card &&
          card.name === "Argo Yesky" &&
          !card.isDamaged &&
          !card.isDestroyed
        ) {
          return card;
        }
      }
    }

    return null;
  }

  handleUseCampAbility(payload) {
    if (!payload) return false;

    // Don't allow using abilities while there's a pending action
    if (this.state.pending) {
      console.log("Cannot use camp ability while another action is pending");
      return false;
    }

    const { playerId, columnIndex, position } = payload;

    // Verify it's the current player's turn
    if (playerId !== this.state.currentPlayer) {
      console.log("Can only use abilities on your own turn");
      return false;
    }

    // For Juggernaut, use the provided position. For other camps, use position 0
    const campPosition = position !== undefined ? position : 0;
    const camp = this.state.getCard(playerId, columnIndex, campPosition);

    if (!camp || camp.type !== "camp") {
      console.log("No camp found at this position");
      return false;
    }

    if (!camp.isReady) {
      console.log("Camp has already used its ability this turn");
      return false;
    }

    if (camp.isDestroyed) {
      console.log("Destroyed camps cannot use abilities");
      return false;
    }

    // Get the camp's first ability (camps typically have one ability)
    const ability = camp.abilities?.[0];
    if (!ability) {
      console.log("Camp has no abilities");
      return false;
    }

    // Check cost
    const player = this.state.players[playerId];
    if (player.water < ability.cost) {
      console.log(
        `Not enough water! Need ${ability.cost}, have ${player.water}`
      );
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

    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (
          card &&
          card.name === "Zeto Kahn" &&
          !card.isDamaged &&
          !card.isDestroyed
        ) {
          return true;
        }
      }
    }

    return false;
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

    // Clear pending only after successful damage
    this.state.pending = null;
    return result === "destroyed" || result === "damaged";
  }

  returnPersonToHand(playerId, columnIndex, position) {
    const player = this.state.players[playerId];
    const column = player.columns[columnIndex];
    const card = column.getCard(position);

    if (!card || card.type !== "person") return false;

    // Remove from column
    column.setCard(position, null);

    // If it's a punk, flip it over to reveal the actual card
    if (card.isPunk) {
      const revealedCard = {
        id: card.id,
        name: card.originalCard?.name || card.name,
        type: card.originalCard?.type || "person",
        cost: card.originalCard?.cost || card.cost,
        abilities: card.originalCard?.abilities || card.abilities,
        junkEffect: card.originalCard?.junkEffect || card.junkEffect,
      };
      player.hand.push(revealedCard);
      console.log(`Returned punk to hand - revealed as ${revealedCard.name}!`);
    } else {
      // Normal person returns as-is
      const returnCard = {
        id: card.id,
        name: card.name,
        type: card.type,
        cost: card.cost,
        abilities: card.abilities,
        junkEffect: card.junkEffect,
      };
      player.hand.push(returnCard);
      console.log(`Returned ${card.name} to hand`);
    }

    // Move cards behind forward
    if (position < CONSTANTS.MAX_POSITION) {
      const cardInFront = column.getCard(position + 1);
      if (cardInFront) {
        column.setCard(position, cardInFront);
        column.setCard(position + 1, null);
      }
    }

    return true;
  }

  destroyPerson(player, column, position, card) {
    if (card.isPunk) {
      // Restore the original card to return to deck
      const returnCard = {
        ...card,
        name: card.originalName, // Restore original name
        isPunk: undefined,
        isFaceDown: undefined,
        originalName: undefined,
      };
      delete returnCard.isPunk;
      delete returnCard.isFaceDown;
      delete returnCard.originalName;

      this.state.deck.unshift(returnCard);
      console.log(`Punk returned to top of deck (was ${returnCard.name})`);
    } else {
      // Normal person to discard
      this.state.discard.push(card);
    }

    // Remove from column
    column.setCard(position, null);

    // Move card in front back
    if (position < CONSTANTS.MAX_POSITION) {
      const cardInFront = column.getCard(position + 1);
      if (cardInFront) {
        column.setCard(position, cardInFront);
        column.setCard(position + 1, null);
      }
    }

    console.log(`${card.isPunk ? "Punk" : card.name} destroyed`);
  }

  placeCardWithPush(column, position, newCard) {
    const existingCard = column.getCard(position);

    if (!existingCard) {
      column.setCard(position, newCard);
      return true;
    }

    // Find where to push
    let pushToPosition = -1;

    // Check for Juggernaut
    let juggernautPos = -1;
    for (let i = 0; i < 3; i++) {
      const card = column.getCard(i);
      if (card?.name === "Juggernaut") {
        juggernautPos = i;
        break;
      }
    }

    if (juggernautPos === -1) {
      // No Juggernaut - normal push forward
      if (position < CONSTANTS.MAX_POSITION && !column.getCard(position + 1)) {
        pushToPosition = position + 1;
      }
    } else {
      // Juggernaut present
      const nonJuggernautPositions = [0, 1, 2].filter(
        (p) => p !== juggernautPos
      );
      const otherPosition = nonJuggernautPositions.find((p) => p !== position);

      if (otherPosition !== undefined && !column.getCard(otherPosition)) {
        pushToPosition = otherPosition;
      }
    }

    if (pushToPosition === -1) {
      console.log("Cannot place - no empty position for push");
      return false;
    }

    // Push and place
    column.setCard(pushToPosition, existingCard);
    column.setCard(position, newCard);
    console.log(`Pushed ${existingCard.name} to position ${pushToPosition}`);
    return true;
  }

  applyDamageToCard(target, targetPlayer, targetColumn, targetPosition) {
    const column = this.state.players[targetPlayer].columns[targetColumn];

    if (target.isDamaged || target.isPunk) {
      target.isDestroyed = true;
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

    const eventDef = window.cardRegistry?.eventAbilities?.[eventName];

    if (!eventDef) {
      console.log(`Unknown event: ${card.name}`);
      console.log(
        "Available events:",
        Object.keys(window.cardRegistry?.eventAbilities || {})
      );

      // Fallback - use the card's own properties if no definition found
      let queueNumber = card.queueNumber || 1;
      const cost = card.cost || 0;

      // Check cost
      if (player.water < cost) {
        console.log("Not enough water for event");
        return false;
      }

      // Check for Zeto Kahn's trait (first event of turn becomes instant)
      if (
        !this.state.turnEvents.firstEventPlayedThisTurn &&
        this.checkForActiveZetoKahn(playerId)
      ) {
        console.log(
          `Zeto Kahn's trait: ${card.name} becomes instant (queue 0)!`
        );
        queueNumber = 0;
      }

      if (queueNumber === 0) {
        // Instant due to Zeto
        player.water -= cost;
        player.hand.splice(cardIndex, 1);
        this.state.discard.push(card);
        this.state.turnEvents.firstEventPlayedThisTurn = true;
        console.log(`${card.name} resolved instantly due to Zeto Kahn`);
        return true;
      }

      // Try to place in queue
      const desiredSlot = queueNumber - 1;

      if (!player.eventQueue[desiredSlot]) {
        player.eventQueue[desiredSlot] = card;
      } else {
        let placed = false;
        for (let i = desiredSlot + 1; i < 3; i++) {
          if (!player.eventQueue[i]) {
            player.eventQueue[i] = card;
            placed = true;
            break;
          }
        }

        if (!placed) {
          console.log("Event queue is full!");
          return false;
        }
      }

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

    // Check cost
    if (player.water < eventDef.cost) {
      console.log("Not enough water for event");
      return false;
    }

    // Determine effective queue number
    let effectiveQueueNumber = eventDef.queueNumber;

    // Check for Zeto Kahn's trait (first event of turn becomes instant)
    if (
      !this.state.turnEvents.firstEventPlayedThisTurn &&
      this.checkForActiveZetoKahn(playerId)
    ) {
      console.log(`Zeto Kahn's trait: ${card.name} becomes instant (queue 0)!`);
      effectiveQueueNumber = 0;
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

      // Mark that an event was played this turn
      this.state.turnEvents.firstEventPlayedThisTurn = true;

      // Execute effect
      const context = {
        playerId: playerId,
        eventCard: card,
      };

      console.log("Calling event handler");
      const result = eventDef.effect.handler(this.state, context);
      console.log("Event handler returned:", result);
      console.log("Pending state after handler:", this.state.pending);

      // If no pending was created, discard the event
      if (!this.state.pending) {
        this.state.discard.push(card);
      }

      return result;
    }

    // Queue placement logic for non-instant events
    const desiredSlot = effectiveQueueNumber - 1; // Convert queue number to array index
    console.log(
      `Trying to place in slot ${desiredSlot} (queue ${effectiveQueueNumber})`
    );

    if (!player.eventQueue[desiredSlot]) {
      // Desired slot is empty
      player.eventQueue[desiredSlot] = card;
      console.log(`Placed ${card.name} in slot ${desiredSlot}`);
    } else {
      // Desired slot is occupied, find next available slot
      let placed = false;
      for (let i = desiredSlot + 1; i < 3; i++) {
        if (!player.eventQueue[i]) {
          player.eventQueue[i] = card;
          console.log(
            `Slot ${desiredSlot} occupied, placed ${card.name} in slot ${i}`
          );
          placed = true;
          break;
        }
      }

      if (!placed) {
        console.log("Event queue is full!");
        return false;
      }
    }

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

    console.log(`Deck size before taking card: ${this.state.deck.length}`);

    // Check if deck has cards
    if (this.state.deck.length === 0) {
      console.log("Cannot place punk - deck is empty");
      this.state.pending = null;
      return false;
    }

    // Take the top card from the deck
    const topCard = this.state.deck.shift();
    console.log(`Took ${topCard.name} from deck to make punk`);
    console.log(`Deck size after taking card: ${this.state.deck.length}`);

    // Create punk from the actual card (face-down)
    const punk = {
      ...topCard, // Keep ALL original properties including id
      isPunk: true,
      isFaceDown: true,
      isReady: false,
      isDamaged: false,
      originalName: topCard.name,
      originalCard: { ...topCard }, // Store complete original card
      name: "Punk", // Override name for display
    };

    // Try to place with push
    if (!this.placeCardWithPush(column, targetPosition, punk)) {
      // If can't place, return card to deck
      this.state.deck.unshift(topCard);
      console.log("Couldn't place punk, returned card to deck");
      return false;
    }

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

    // Check if Water Silo is available
    if (player.waterSilo !== "available") {
      console.log("Water Silo not available");
      return false;
    }

    // Check cost
    if (player.water < 1) {
      console.log("Need 1 water to take Water Silo");
      return false;
    }

    // Pay cost and take to hand
    player.water -= 1;
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

  handleDrawCard() {
    const player = this.state.players[this.state.currentPlayer];

    if (player.water < CONSTANTS.DRAW_COST) {
      console.log("Not enough water");
      return false;
    }

    player.water -= CONSTANTS.DRAW_COST;
    if (this.state.deck.length > 0) {
      player.hand.push(this.state.deck.shift());
    }
    return true;
  }

  triggerEntryTraits(person, playerId, columnIndex, position) {
    console.log(`${person.name} entered play`);

    // Check if this card has an entry trait
    const cardName = person.name.toLowerCase().replace(/\s+/g, "");
    const traitHandler = window.cardRegistry?.getTraitHandler(cardName);

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
    const card = player.hand[cardIndex];

    if (!card) {
      console.log("ERROR: Card not found");
      return false;
    }

    // Check if it's the player's turn and in actions phase
    if (
      playerId !== this.state.currentPlayer ||
      this.state.phase !== "actions"
    ) {
      console.log("Can only junk cards on your turn during actions phase");
      return false;
    }

    console.log(`Junking ${card.name} for ${card.junkEffect} effect`);

    // Remove from hand first (we'll put it back if cancelled)
    player.hand.splice(cardIndex, 1);

    // Handle special case for Water Silo
    if (card.name === "Water Silo" || card.isWaterSilo) {
      player.waterSilo = "available";
      player.water += 1;
      console.log("Water Silo returned to play area, gained 1 water");
      return true;
    }

    // Process the junk effect
    const junkEffect = card.junkEffect?.toLowerCase();
    console.log("Processing junk effect:", junkEffect);

    switch (junkEffect) {
      case "water":
      case "card":
      case "draw":
      case "raid":
        // These effects complete immediately - discard now
        this.state.discard.push(card);

        if (junkEffect === "water") {
          player.water += 1;
          console.log("Gained 1 water from junk effect");
        } else if (junkEffect === "card" || junkEffect === "draw") {
          if (this.state.deck.length > 0) {
            const drawnCard = this.state.deck.shift();
            player.hand.push(drawnCard);
            console.log(`Drew ${drawnCard.name} from junk effect`);
          }
        } else if (junkEffect === "raid") {
          this.executeRaid(playerId);
          console.log("Raid effect triggered");
        }
        break;

      case "injure":
        // Find valid injure targets (unprotected enemy people)
        const opponentId = playerId === "left" ? "right" : "left";
        const opponent = this.state.players[opponentId];
        const injureTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const targetCard = opponent.columns[col].getCard(pos);
            if (
              targetCard &&
              targetCard.type === "person" &&
              !targetCard.isDestroyed
            ) {
              // Check if protected
              if (!opponent.columns[col].isProtected(pos)) {
                injureTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card: targetCard,
                });
              }
            }
          }
        }

        if (injureTargets.length === 0) {
          console.log("No valid targets to injure");
          player.hand.push(card); // Return card to hand
          return false;
        }

        this.state.pending = {
          type: "junk_injure",
          source: card,
          sourcePlayerId: playerId,
          junkCard: card,
          validTargets: injureTargets,
        };
        console.log(
          `Select unprotected enemy person to injure (${injureTargets.length} targets)`
        );
        break;

      case "restore":
        // Find ALL damaged cards (both players)
        const restoreTargets = [];

        // Check own cards
        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const targetCard = player.columns[col].getCard(pos);
            if (targetCard && targetCard.isDamaged && !targetCard.isDestroyed) {
              restoreTargets.push({
                playerId: playerId,
                columnIndex: col,
                position: pos,
                card: targetCard,
              });
            }
          }
        }

        // Check opponent's cards
        const enemyId = playerId === "left" ? "right" : "left";
        const enemy = this.state.players[enemyId];
        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const targetCard = enemy.columns[col].getCard(pos);
            if (targetCard && targetCard.isDamaged && !targetCard.isDestroyed) {
              restoreTargets.push({
                playerId: enemyId,
                columnIndex: col,
                position: pos,
                card: targetCard,
              });
            }
          }
        }

        if (restoreTargets.length === 0) {
          console.log("No damaged cards to restore");
          player.hand.push(card); // Return card to hand
          return false;
        }

        this.state.pending = {
          type: "junk_restore",
          source: card,
          sourcePlayerId: playerId,
          junkCard: card,
          validTargets: restoreTargets,
        };
        console.log(
          `Select damaged card to restore (${restoreTargets.length} targets)`
        );
        break;

      case "punk":
        if (this.state.deck.length === 0) {
          console.log("Cannot gain punk - deck is empty");
          player.hand.push(card); // Return to hand
          return false;
        }

        this.state.pending = {
          type: "place_punk",
          source: card,
          sourcePlayerId: playerId,
          junkCard: card,
        };
        console.log("Select where to place the punk");
        break;

      default:
        console.log(`Unknown junk effect: ${junkEffect}`);
        // Return card to hand if effect is unknown
        player.hand.push(card);
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

    // Check cost
    const cost = this.getAdjustedCost(card, columnIndex, playerId);
    if (player.water < cost) {
      console.log("Not enough water!");
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

    // Check for Karli Blaze's persistent trait BEFORE placement
    const hasActiveKarli = this.checkForActiveKarli(playerId);
    if (hasActiveKarli) {
      person.isReady = true;
      console.log(`${card.name} enters play ready due to Karli Blaze's trait!`);
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
    let cost = card.cost || 0;

    // Check for cost modifiers (Holdout, Oasis, etc)
    // Use the playerId passed in, not this.state.currentPlayer
    const player = this.state.players[playerId];
    if (!player || !player.columns || !player.columns[columnIndex]) {
      return cost;
    }

    const column = player.columns[columnIndex];
    const camp = column.getCard(0);

    // Holdout discount
    if (card.name === "Holdout" && camp?.isDestroyed) {
      cost = 0;
    }

    // Oasis discount
    if (camp?.name === "Oasis" && !camp.isDestroyed) {
      const peopleCount = [1, 2].filter((pos) => column.getCard(pos)).length;
      if (peopleCount === 0) {
        cost = Math.max(0, cost - 1);
      }
    }

    return cost;
  }

  handleUseAbility(payload) {
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

    // Check if ready - different rules for camps vs people
    if (!card.isReady) {
      console.log("Card has already used its ability this turn");
      return false;
    }

    if (card.isDestroyed) {
      console.log("Destroyed cards cannot use abilities");
      return false;
    }

    // People also can't use abilities when damaged
    if (card.type === "person" && card.isDamaged) {
      console.log("Damaged people cannot use abilities");
      return false;
    }

    // Check cost
    const player = this.state.players[playerId];
    if (player.water < ability.cost) {
      console.log(
        `Not enough water! Need ${ability.cost}, have ${player.water}`
      );
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
      // Place raiders in queue at slot 2 (index 1)
      const slotIndex = 1;
      if (!player.eventQueue[slotIndex]) {
        player.eventQueue[slotIndex] = {
          id: `${playerId}_raiders`,
          name: "Raiders",
          isRaiders: true,
          queueNumber: 2,
        };
        player.raiders = "in_queue";
        console.log("Raid: Raiders placed in event queue at slot 2");
        return true;
      }
      console.log("Raid: Cannot place Raiders - slot 2 occupied");
      return false;
    } else if (player.raiders === "in_queue") {
      // Find where Raiders currently is
      let raidersIndex = -1;
      for (let i = 0; i < 3; i++) {
        if (player.eventQueue[i]?.isRaiders) {
          raidersIndex = i;
          break;
        }
      }

      if (raidersIndex === 0) {
        // Raiders in slot 1 - resolve it
        console.log("Raid: Advancing Raiders off slot 1 - resolving effect!");
        // ... existing resolution code ...
        return true;
      } else if (raidersIndex > 0) {
        // Try to advance
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
            `Raid: Cannot advance Raiders - slot ${
              newIndex + 1
            } is occupied by ${player.eventQueue[newIndex].name}`
          );
          return false; // Raid effect fails but card is still junked
        }
      } else {
        console.log("Raid: Raiders not found in queue");
        return false;
      }
    } else {
      console.log("Raid: Raiders already used this game");
      return false;
    }
  }

  executeAbility(ability, context) {
    let cardName = context.source.name.toLowerCase().replace(/\s+/g, "");
    const effectName = ability.effect.toLowerCase().replace(/\s+/g, "");

    // CRITICAL: If this is Mimic copying another card, use THAT card's handler
    if (context.fromMimic && context.copiedFrom) {
      cardName = context.copiedFrom.toLowerCase().replace(/\s+/g, "");
      console.log(`Mimic executing as ${cardName}`);
    }

    // Check camp abilities first
    if (context.source.type === "camp") {
      const campAbility =
        window.cardRegistry?.campAbilities?.[cardName]?.[effectName];
      if (campAbility?.handler) {
        return campAbility.handler(this.state, context);
      }
    }

    // Check person abilities - now using the correct cardName
    const personAbility =
      window.cardRegistry?.personAbilities?.[cardName]?.[effectName];
    if (personAbility?.handler) {
      console.log(`Found handler for ${cardName}.${effectName}`);
      return personAbility.handler(this.state, context);
    }

    // Fall back to generic ability handling
    console.log(
      `No specific handler found for ${cardName}.${effectName}, using generic`
    );
    this.handleGenericAbility(ability, context);
  }

  handleSelectTarget(payload) {
    console.log("handleSelectTarget called, pending:", this.state.pending);
    // Add safety check
    if (!this.state.pending) {
      console.error("No pending action to select target for");
      return false;
    }

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Route to appropriate handler based on pending type
    switch (this.state.pending.type) {
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
        const topCard = this.state.deck.shift();
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
      case "interrogate_keep": {
        const { cardToKeep } = payload;
        const pending = this.state.pending;

        if (!cardToKeep) {
          console.log("Must select a card to keep");
          return false;
        }

        // Verify the selected card is one of the drawn cards
        const keepCard = pending.drawnCards.find((c) => c.id === cardToKeep);
        if (!keepCard) {
          console.log("Invalid card selected - must be one of the drawn cards");
          return false;
        }

        const player = this.state.players[pending.sourcePlayerId];

        // Discard the other 3 cards (not the kept one)
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

        // Discard the event card itself
        if (pending.eventCard) {
          this.state.discard.push(pending.eventCard);
        }

        // Clear pending
        this.state.pending = null;

        console.log("Interrogate: Resolved");
        return true;
      }

      case "magnus_select_column": {
        // Magnus needs a column selection, but SELECT_TARGET gives us a specific card
        // We'll infer the column from the target position
        const targetCol = targetColumn;

        // Verify it's a valid column
        if (!this.state.pending.validColumns.includes(targetCol)) {
          console.log("Not a valid column for Magnus Karv");
          return false;
        }

        const opponent = this.state.players[this.state.pending.targetPlayerId];
        const column = opponent.columns[targetCol];
        let damageCount = 0;

        console.log(`Magnus Karv: Damaging all cards in column ${targetCol}`);

        // Damage all cards in the column (camp and people)
        for (let pos = 0; pos < 3; pos++) {
          const card = column.getCard(pos);
          if (card && !card.isDestroyed) {
            // Apply damage
            if (card.isDamaged) {
              card.isDestroyed = true;
              if (card.type === "person") {
                // Handle person destruction
                this.destroyPerson(opponent, column, pos, card);
              }
              console.log(`Magnus destroyed ${card.name}`);
            } else {
              card.isDamaged = true;
              if (card.type === "person") {
                card.isReady = false;
              }
              console.log(`Magnus damaged ${card.name}`);
            }
            damageCount++;
          }
        }

        console.log(
          `Magnus Karv damaged ${damageCount} cards in column ${targetCol}`
        );

        // Mark Magnus's ability as complete
        if (this.state.pending.sourceCard) {
          this.state.pending.sourceCard.isReady = false;
        }

        // Check for Parachute Base damage
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Clear pending
        this.state.pending = null;

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Magnus ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return true;
      }

      case "vanguard_damage": {
        console.log(
          "Vanguard damage target selected:",
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Vanguard");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Apply Vanguard's damage
        const result = this.applyDamageToCard(
          target,
          targetPlayer,
          targetColumn,
          targetPosition
        );
        console.log(`Vanguard damaged ${target.name}`);

        // Now set up opponent's counter-damage
        // Find valid targets for counter-damage (unprotected cards belonging to Vanguard's controller)
        const vanguardController = this.state.pending.sourcePlayerId;
        const vanguardPlayer = this.state.players[vanguardController];
        const counterTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = vanguardPlayer.columns[col].getCard(pos);
            if (card && !card.isDestroyed) {
              // Check if unprotected
              if (!vanguardPlayer.columns[col].isProtected(pos)) {
                counterTargets.push({
                  playerId: vanguardController,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        // Update Parachute Base damage position if present (in case Vanguard moved)
        let parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        if (parachuteBaseDamage) {
          // Find where Vanguard is NOW
          const vanguardCard = this.state.pending.sourceCard;

          for (let col = 0; col < 3; col++) {
            for (let pos = 0; pos < 3; pos++) {
              const card = vanguardPlayer.columns[col].getCard(pos);
              if (card && card.id === vanguardCard.id) {
                parachuteBaseDamage = {
                  targetPlayer: vanguardController,
                  targetColumn: col,
                  targetPosition: pos,
                };
                console.log(
                  `Updated Vanguard position for PB damage: col ${col}, pos ${pos}`
                );
                break;
              }
            }
          }
        }

        // Set up counter-damage selection (opponent chooses)
        this.state.pending = {
          type: "vanguard_counter",
          sourcePlayerId: targetPlayer, // The damaged player gets to counter
          targetPlayerId: vanguardController, // They damage Vanguard's controller
          validTargets: counterTargets,
          vanguardCard: this.state.pending.sourceCard,
          parachuteBaseDamage: parachuteBaseDamage,
        };

        console.log(
          `Vanguard: ${targetPlayer} player must now select counter-damage target`
        );

        return true;
      }

      case "zeto_discard_selection": {
        const { cardsToDiscard } = payload;
        const pending = this.state.pending;

        if (!cardsToDiscard || cardsToDiscard.length !== pending.mustDiscard) {
          console.log(
            `Must select exactly ${pending.mustDiscard} cards to discard`
          );
          return false;
        }

        const player = this.state.players[pending.sourcePlayerId];

        // Verify all selected cards exist and aren't Water Silo
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

        // Store Parachute Base damage info before clearing pending
        const parachuteBaseDamage = pending.parachuteBaseDamage;

        // Mark ability complete
        this.completeAbility(pending);

        // Clear pending
        this.state.pending = null;

        console.log("Zeto Kahn: Draw and discard complete");

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Zeto Kahn ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return true;
      }

      case "vanguard_counter": {
        console.log(
          "Vanguard counter target selected:",
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Verify it's a valid counter target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid counter-damage target");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Apply counter damage
        const result = this.applyDamageToCard(
          target,
          targetPlayer,
          targetColumn,
          targetPosition
        );
        console.log(`Counter-damage hit ${target.name}`);

        // Mark Vanguard's ability as complete
        if (this.state.pending.vanguardCard) {
          this.state.pending.vanguardCard.isReady = false;
          console.log("Vanguard marked as not ready");
        }

        // Store Parachute Base damage info before clearing pending
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Clear pending
        this.state.pending = null;

        // Apply Parachute Base damage if this was from Parachute Base
        if (parachuteBaseDamage) {
          console.log(
            "Vanguard ability completed, applying Parachute Base damage"
          );
          console.log(
            `Damaging at: ${parachuteBaseDamage.targetColumn}, ${parachuteBaseDamage.targetPosition}`
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        } else {
          console.log("No Parachute Base damage to apply");
        }

        console.log("Vanguard ability fully completed");
        return true;
      }
      case "mutant_choose_mode": {
        const mode = payload.mode; // 'damage', 'restore', or 'both'
        const pending = this.state.pending;

        console.log(`Mutant: Mode selected - ${mode}`);

        if (mode === "damage") {
          if (pending.damageTargets.length === 0) {
            console.log("No valid damage targets");
            return false;
          }

          // Set up damage targeting
          this.state.pending = {
            type: "mutant_damage",
            source: pending.source,
            sourceCard: pending.sourceCard,
            sourcePlayerId: pending.sourcePlayerId,
            sourceColumn: pending.sourceColumn,
            sourcePosition: pending.sourcePosition,
            validTargets: pending.damageTargets,
            context: pending.context,
          };
          console.log("Mutant: Select target to damage");
        } else if (mode === "restore") {
          if (pending.restoreTargets.length === 0) {
            console.log("No valid restore targets");
            return false;
          }

          // Set up restore targeting
          this.state.pending = {
            type: "mutant_restore",
            source: pending.source,
            sourceCard: pending.sourceCard,
            sourcePlayerId: pending.sourcePlayerId,
            sourceColumn: pending.sourceColumn,
            sourcePosition: pending.sourcePosition,
            validTargets: pending.restoreTargets,
            context: pending.context,
          };
          console.log("Mutant: Select card to restore");
        } else if (mode === "both") {
          // Player wants to do both - let them choose order
          this.state.pending = {
            type: "mutant_choose_order",
            source: pending.source,
            sourceCard: pending.sourceCard,
            sourcePlayerId: pending.sourcePlayerId,
            sourceColumn: pending.sourceColumn,
            sourcePosition: pending.sourcePosition,
            damageTargets: pending.damageTargets,
            restoreTargets: pending.restoreTargets,
            context: pending.context,
          };
          console.log("Mutant: Choose order - Damage first or Restore first?");
        }

        return true;
      }

      case "mutant_choose_order": {
        const order = payload.order; // 'damage_first' or 'restore_first'
        const pending = this.state.pending;

        if (order === "damage_first") {
          // Set up damage targeting, will do restore after
          this.state.pending = {
            type: "mutant_damage",
            source: pending.source,
            sourceCard: pending.sourceCard,
            sourcePlayerId: pending.sourcePlayerId,
            sourceColumn: pending.sourceColumn,
            sourcePosition: pending.sourcePosition,
            validTargets: pending.damageTargets,
            restoreTargets: pending.restoreTargets, // Save for after damage
            doRestoreAfter: true,
            context: pending.context,
          };
          console.log("Mutant: Select target to damage (will restore after)");
        } else {
          // Set up restore targeting, will do damage after
          this.state.pending = {
            type: "mutant_restore",
            source: pending.source,
            sourceCard: pending.sourceCard,
            sourcePlayerId: pending.sourcePlayerId,
            sourceColumn: pending.sourceColumn,
            sourcePosition: pending.sourcePosition,
            validTargets: pending.restoreTargets,
            damageTargets: pending.damageTargets, // Save for after restore
            doDamageAfter: true,
            context: pending.context,
          };
          console.log("Mutant: Select card to restore (will damage after)");
        }

        return true;
      }

      case "mutant_damage": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid damage target for Mutant");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Apply damage
        const result = this.applyDamageToCard(
          target,
          targetPlayer,
          targetColumn,
          targetPosition
        );
        console.log(`Mutant damaged ${target.name}`);

        // Check if we need to do restore after
        if (this.state.pending.doRestoreAfter) {
          // Set up restore targeting
          this.state.pending = {
            type: "mutant_restore",
            source: this.state.pending.source,
            sourceCard: this.state.pending.sourceCard,
            sourcePlayerId: this.state.pending.sourcePlayerId,
            sourceColumn: this.state.pending.sourceColumn,
            sourcePosition: this.state.pending.sourcePosition,
            validTargets: this.state.pending.restoreTargets,
            finishMutant: true, // Flag to damage Mutant after restore
            context: this.state.pending.context,
          };
          console.log("Mutant: Now select card to restore");
        } else {
          // Damage Mutant itself and finish
          this.finishMutantAbility();
        }

        return true;
      }

      case "mutant_restore": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid restore target for Mutant");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Restore the card
        target.isDamaged = false;
        if (target.type === "person") {
          target.isReady = false;
        }
        console.log(`Mutant restored ${target.name}`);

        // Check if we need to do damage after
        if (this.state.pending.doDamageAfter) {
          // Set up damage targeting
          this.state.pending = {
            type: "mutant_damage",
            source: this.state.pending.source,
            sourceCard: this.state.pending.sourceCard,
            sourcePlayerId: this.state.pending.sourcePlayerId,
            sourceColumn: this.state.pending.sourceColumn,
            sourcePosition: this.state.pending.sourcePosition,
            validTargets: this.state.pending.damageTargets,
            context: this.state.pending.context,
          };
          console.log("Mutant: Now select target to damage");
        } else {
          // Damage Mutant itself and finish
          // Store the pending info we need before clearing it
          const sourcePlayerId = this.state.pending.sourcePlayerId;
          const sourceColumn = this.state.pending.sourceColumn;
          const sourcePosition = this.state.pending.sourcePosition;
          const sourceCard = this.state.pending.sourceCard;

          // Clear pending first
          this.state.pending = null;

          // Now damage Mutant
          const mutantCard = this.state.getCard(
            sourcePlayerId,
            sourceColumn,
            sourcePosition
          );

          if (mutantCard && !mutantCard.isDestroyed) {
            // Apply damage to Mutant
            if (mutantCard.isDamaged) {
              mutantCard.isDestroyed = true;
              // Handle destruction
              const column =
                this.state.players[sourcePlayerId].columns[sourceColumn];
              this.destroyPerson(
                this.state.players[sourcePlayerId],
                column,
                sourcePosition,
                mutantCard
              );
              console.log("Mutant destroyed itself");
            } else {
              mutantCard.isDamaged = true;
              mutantCard.isReady = false;
              console.log("Mutant damaged itself");
            }
          }

          console.log("Mutant ability completed");
        }

        return true;
      }

      case "scientist_select_junk": {
        const selectedIndex = payload.junkIndex;

        // Store info needed after clearing pending
        // sourceCard might be Mimic, not Scientist, so we need to handle both cases
        const sourceCard =
          this.state.pending.sourceCard || this.state.pending.source;
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
        const sourcePlayerId = this.state.pending.sourcePlayerId;

        // Handle "no junk" option
        if (selectedIndex === -1) {
          console.log(
            "Scientist: Discarded all cards without using any junk effect"
          );

          // Mark ability complete - the source card (Scientist or Mimic) becomes not ready
          if (sourceCard) {
            sourceCard.isReady = false;
            console.log(
              `${sourceCard.name} marked not ready after Scientist ability completed`
            );
          }

          // Clear pending
          this.state.pending = null;

          // Apply Parachute Base damage if needed
          if (parachuteBaseDamage) {
            this.applyParachuteBaseDamage(
              parachuteBaseDamage.targetPlayer,
              parachuteBaseDamage.targetColumn,
              parachuteBaseDamage.targetPosition
            );
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

        // Process the junk effect
        const junkEffect = selectedCard.junkEffect?.toLowerCase();
        const player = this.state.players[sourcePlayerId];

        // Clear pending before processing immediate effects
        this.state.pending = null;

        // Process the effect
        switch (junkEffect) {
          case "water":
            player.water += 1;
            console.log("Gained 1 water from Scientist junk");
            // Mark source card not ready
            if (sourceCard) {
              sourceCard.isReady = false;
            }
            break;

          case "card":
          case "draw":
            if (this.state.deck.length > 0) {
              const drawnCard = this.state.deck.shift();
              player.hand.push(drawnCard);
              console.log(`Drew ${drawnCard.name} from Scientist junk`);
            }
            // Mark source card not ready
            if (sourceCard) {
              sourceCard.isReady = false;
            }
            break;

          case "raid":
            this.executeRaid(sourcePlayerId);
            // Mark source card not ready
            if (sourceCard) {
              sourceCard.isReady = false;
            }
            break;

          case "injure":
          case "restore":
          case "punk":
            // These need targeting - set up new pending
            this.state.pending = {
              type:
                junkEffect === "punk"
                  ? "place_punk"
                  : junkEffect === "injure"
                  ? "junk_injure"
                  : "junk_restore",
              sourcePlayerId: sourcePlayerId,
              fromScientist: true,
              scientistCard: sourceCard, // Store reference to mark not ready later
            };
            console.log(`Scientist junk: Setting up ${junkEffect} targeting`);

            // Preserve parachute damage if present
            if (parachuteBaseDamage) {
              this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
            }
            break;
        }

        // Apply Parachute Base damage if no new pending was created
        if (parachuteBaseDamage && !this.state.pending) {
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return true;
      }
      case "molgur_destroy_camp": {
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Molgur Stang");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.type !== "camp") {
          console.log("Molgur can only destroy camps");
          return false;
        }

        // Store Parachute Base damage info if present
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Destroy the camp outright
        target.isDestroyed = true;
        console.log(
          `Molgur Stang destroyed ${target.name} (ignoring protection and damage state)`
        );

        // Use the shouldStayReady decision that was made in handleUseAbility
        const shouldStayReady = this.state.pending?.shouldStayReady;

        if (this.state.pending.sourceCard) {
          if (shouldStayReady) {
            console.log(
              "Molgur Stang stays ready due to Vera Vosh's trait (decision from ability use)"
            );
          } else {
            this.state.pending.sourceCard.isReady = false;
            console.log("Molgur Stang marked as not ready");
          }
        }

        // Clear pending
        this.state.pending = null;

        // Check for game end
        this.checkGameEnd();

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Molgur ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return true;
      }

      case "parachute_select_ability": {
        const pending = this.state.pending;
        const abilityIndex = payload.abilityIndex;

        if (
          abilityIndex === undefined ||
          !pending.person.abilities[abilityIndex]
        ) {
          console.log("Invalid ability selection");
          return false;
        }

        const ability = pending.person.abilities[abilityIndex];
        const player = this.state.players[pending.sourcePlayerId];

        // Check if player can afford it
        if (player.water < ability.cost) {
          console.log(
            `Not enough water for ${ability.effect} (need ${ability.cost}, have ${player.water})`
          );
          this.state.pending = null;
          this.applyParachuteBaseDamage(
            pending.sourcePlayerId,
            pending.targetColumn,
            pending.targetSlot
          );
          return true;
        }

        // Pay for and execute the chosen ability
        player.water -= ability.cost;
        console.log(
          `Parachute Base: Paid ${ability.cost} for ${pending.person.name}'s ${ability.effect}`
        );

        // Store the person's ID so we can find it later (position might change)
        const personId = pending.person.id;
        const sourcePlayerId = pending.sourcePlayerId;

        // Clear pending before executing
        this.state.pending = null;

        // Execute the chosen ability
        this.executeAbility(ability, {
          source: pending.person,
          playerId: sourcePlayerId,
          columnIndex: pending.targetColumn,
          position: pending.targetSlot,
          fromParachuteBase: true,
        });

        console.log(`Parachute Base: Executed ${ability.effect} ability`);

        // Find where the person is NOW (might have moved)
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

        // Check if ability set up a new pending state
        if (this.state.pending) {
          // Ability needs resolution - store CURRENT position for damage
          this.state.pending.parachuteBaseDamage = {
            targetPlayer: sourcePlayerId,
            targetColumn: currentColumn,
            targetPosition: currentPosition,
          };
          console.log(
            `Parachute Base: Will damage ${pending.person.name} at current position (${currentColumn}, ${currentPosition}) after ability resolves`
          );
        } else {
          // Ability completed immediately, apply damage now at CURRENT position
          this.applyParachuteBaseDamage(
            sourcePlayerId,
            currentColumn,
            currentPosition
          );
        }

        return true;
      }
      case "assassin_destroy": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Assassin");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.type !== "person") {
          console.log("Assassin can only destroy people");
          return false;
        }

        // Store Parachute Base damage info if present
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Destroy the target
        target.isDestroyed = true;

        // Handle destruction
        if (target.isPunk) {
          this.state.deck.unshift({
            id: `returned_punk_${Date.now()}`,
            name: "Unknown Card",
            type: "person",
            cost: 0,
            isFaceDown: true,
          });
        } else {
          this.state.discard.push(target);
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

        console.log(`Assassin destroyed ${target.name}`);

        // Mark ability complete
        this.completeAbility(this.state.pending);

        // Clear pending
        this.state.pending = null;

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Assassin ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return true;
      }
      case "sniper_damage": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Sniper");
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

        // Store Parachute Base damage info if present
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        this.completeAbility(this.state.pending);

        // Set up for damage (with allowProtected flag preserved)
        this.state.pending = {
          type: "damage",
          sourcePlayerId: this.state.pending.sourcePlayerId,
          allowProtected: true, // Preserve the flag for resolveDamage
        };

        // Apply the damage (ignoring protection)
        const result = this.resolveDamage(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        if (result) {
          console.log(`Sniper damaged ${target.name} (ignoring protection)`);
        }

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Sniper ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return result;
      }
      case "pyromaniac_damage": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Pyromaniac");
          return false;
        }

        // Store Parachute Base damage info if present
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        this.completeAbility(this.state.pending);

        // Apply the damage
        const result = this.resolveDamage(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        if (result) {
          const target = this.state.getCard(
            targetPlayer,
            targetColumn,
            targetPosition
          );
          console.log(`Pyromaniac damaged ${target?.name || "camp"}`);
        }

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Pyromaniac ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return result;
      }
      case "junk_restore": {
        // Check if this is a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid restoration target");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || !target.isDamaged) {
          console.log("Must target a damaged card");
          return false;
        }

        // Restore the card
        target.isDamaged = false;
        if (target.type === "person") {
          target.isReady = false; // Person becomes not ready when restored
        }
        // Camps stay ready when restored
        console.log(`${target.name} restored by junk effect!`);

        const junkCard = this.state.pending?.junkCard;
        if (junkCard) {
          // Discard the card after successful restore
          this.state.discard.push(junkCard);
          console.log(`Discarded ${junkCard.name} after restore`);
        }

        this.state.pending = null;
        return true;
      }

      case "raiders_select_camp": {
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
        if (!camp || camp.type !== "camp") {
          console.log("Invalid camp selection");
          return false;
        }

        if (camp.isDestroyed) {
          console.log("Camp is already destroyed");
          return false;
        }

        // Apply damage to the selected camp
        if (camp.isDamaged) {
          camp.isDestroyed = true;
          console.log(`Raiders destroyed ${camp.name}!`);
        } else {
          camp.isDamaged = true;
          console.log(`Raiders damaged ${camp.name}!`);
        }

        // Mark ability complete
        this.completeAbility(this.state.pending);

        // Clear pending
        this.state.pending = null;

        // Check for game end
        this.checkGameEnd();

        // If we're in events phase, continue with the phase progression
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

      case "junk_injure": {
        // Set up a damage pending state for the injure
        this.state.pending = {
          type: "damage",
          sourcePlayerId: this.state.pending.sourcePlayerId,
          source: this.state.pending.source,
        };

        const junkCard = this.state.pending?.junkCard;
        if (junkCard) {
          // Discard the card after successful restore
          this.state.discard.push(junkCard);
          console.log(`Discarded ${junkCard.name} after restore`);
        }

        // Now resolve it as damage (which will handle destruction properly)
        return this.resolveDamage(targetPlayer, targetColumn, targetPosition);
      }

      case "damage":
        // Store Parachute Base info before resolving
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Mark ability complete BEFORE resolving damage
        this.completeAbility(this.state.pending);

        // Resolve the damage (this clears pending)
        const result = this.resolveDamage(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Apply Parachute Base damage if needed
        if (result && parachuteBaseDamage) {
          console.log(
            "Damage ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return result;

      case "cultleader_select_destroy": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Cult Leader destruction");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.type !== "person") {
          console.log("Must select a person to destroy");
          return false;
        }

        // Store if Cult Leader is destroying itself
        const isDestroyingSelf = target.id === this.state.pending.source.id;

        // Store Parachute Base damage info if present
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Destroy the target person
        target.isDestroyed = true;

        // Handle destruction
        if (target.isPunk) {
          // Return punk to deck
          const returnCard = {
            id: target.id,
            name: target.originalName || target.name,
            type: target.type,
            cost: target.cost,
            abilities: target.abilities,
            junkEffect: target.junkEffect,
          };
          this.state.deck.unshift(returnCard);
          console.log(`Cult Leader destroyed punk (returned to deck)`);
        } else {
          this.state.discard.push(target);
          console.log(`Cult Leader destroyed ${target.name}`);
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

        const cultLeaderCard =
          this.state.pending.sourceCard || this.state.pending.source;

        // Now set up damage targeting (even if Cult Leader destroyed itself)
        this.state.pending = {
          type: "cultleader_damage",
          sourcePlayerId: this.state.pending.sourcePlayerId,
          sourceCard: cultLeaderCard,
          destroyedSelf: isDestroyingSelf,
          parachuteBaseDamage: parachuteBaseDamage,
        };

        console.log("Cult Leader: Now select target to damage");
        return true;
      }

      case "cultleader_damage": {
        // This is the damage after destroying own person
        // Can't damage own cards
        if (targetPlayer === this.state.pending.sourcePlayerId) {
          console.log("Cannot damage own cards");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.isDestroyed) {
          console.log("Invalid target");
          return false;
        }

        // Check protection
        const column = this.state.players[targetPlayer].columns[targetColumn];
        if (column.isProtected(targetPosition)) {
          console.log("Cannot damage protected target");
          return false;
        }

        // Store info we need before clearing
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
        const destroyedSelf = this.state.pending?.destroyedSelf;

        // Mark ability complete BEFORE resolving damage (which clears pending)
        this.completeAbility(this.state.pending);

        // Now apply the damage (this will clear pending)
        const result = this.resolveDamage(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        if (result) {
          console.log(`Cult Leader damaged ${target.name}`);
        }

        // Apply Parachute Base damage if needed (and if Cult Leader didn't destroy itself)
        if (parachuteBaseDamage && !destroyedSelf) {
          console.log(
            "Cult Leader ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return result;
      }

      case "looter_damage": {
        const sourcePlayerId = this.state.pending.sourcePlayerId;
        const parachuteBaseDamage = this.state.pending.parachuteBaseDamage;

        // Get the target to check if it's a camp
        const targetCard = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        const isTargetCamp = targetCard?.type === "camp";

        this.completeAbility(this.state.pending);

        // This call clears this.state.pending!
        const damaged = this.resolveDamage(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        if (damaged && isTargetCamp) {
          // Hit a camp - draw a card
          const player = this.state.players[sourcePlayerId];
          if (this.state.deck.length > 0) {
            const drawnCard = this.state.deck.shift();
            player.hand.push(drawnCard);
            console.log(
              `Looter bonus: Drew ${drawnCard.name} for hitting camp`
            );
          }
        }

        // Now restore the parachuteBaseDamage to pending before calling the helper
        if (parachuteBaseDamage) {
          this.state.pending = { parachuteBaseDamage: parachuteBaseDamage };
          this.checkAndApplyParachuteBaseDamage();
        }

        return damaged;
      }

      case "injure": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid injure target");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.type !== "person") {
          console.log("Can only injure people");
          return false;
        }

        // CRITICAL: Store Parachute Base damage info BEFORE calling resolveInjure
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;
        console.log("Parachute Base damage info stored:", parachuteBaseDamage);

        this.completeAbility(this.state.pending);

        // Call resolveInjure (which will clear pending)
        const result = this.resolveInjure(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Now apply Parachute Base damage if it existed
        if (parachuteBaseDamage) {
          console.log("Applying Parachute Base damage to Vigilante");
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return result;
      }

      case "restore": {
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

        // Check if this restore was from Parachute Base
        if (this.state.pending?.parachuteBaseDamage) {
          const pbDamage = this.state.pending.parachuteBaseDamage;
          console.log(
            "Parachute Base: Restore ability completed, now applying damage"
          );

          // Mark ability complete
          this.completeAbility(this.state.pending);

          // Clear pending first
          this.state.pending = null;

          // Apply damage to the card that was played via Parachute Base
          this.applyParachuteBaseDamage(
            pbDamage.targetPlayer,
            pbDamage.targetColumn,
            pbDamage.targetPosition
          );
        } else {
          // Normal restore, just clear pending
          this.state.pending = null;
        }

        return true;
      }

      case "repair_bot_entry_restore": {
        const pending = this.state.pending;

        // Verify this is a valid target
        const isValidTarget = pending.validTargets.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid restoration target");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || !target.isDamaged) {
          console.log("Must target a damaged card");
          return false;
        }

        // Restore the card
        target.isDamaged = false;
        if (target.type === "person") {
          target.isReady = false;
        }

        console.log(`Repair Bot entry trait: Restored ${target.name}!`);

        // Check if this was from Parachute Base
        const pbContext = pending.parachuteBaseContext;
        if (pbContext) {
          console.log(
            "=== Continuing Parachute Base sequence after Repair Bot entry trait ==="
          );

          // Mark ability complete
          this.completeAbility(this.state.pending);

          // Clear pending first
          this.state.pending = null;

          const player = this.state.players[pbContext.sourcePlayerId];
          const person = this.state.getCard(
            pbContext.sourcePlayerId,
            pbContext.targetColumn,
            pbContext.targetSlot
          );

          if (!person) {
            console.log("ERROR: Can't find Repair Bot after entry trait");
            return true;
          }

          // Now use Repair Bot's actual ability
          if (person.abilities?.length > 0) {
            const ability = person.abilities[0];

            console.log(
              `Checking if player can afford ${person.name}'s ability (${ability.cost} water)`
            );

            if (player.water >= ability.cost) {
              // Pay for the ability
              player.water -= ability.cost;
              console.log(
                `Parachute Base: Paid ${ability.cost} water for ${person.name}'s restore ability`
              );

              // Execute the ability with fromParachuteBase flag
              const abilityResult = this.executeAbility(ability, {
                source: person,
                playerId: pbContext.sourcePlayerId,
                columnIndex: pbContext.targetColumn,
                position: pbContext.targetSlot,
                fromParachuteBase: true,
              });

              console.log(
                `Parachute Base: Executed ${person.name}'s restore ability`
              );

              // Check if ability set up new pending (it should for Repair Bot's restore)
              if (this.state.pending) {
                console.log(
                  "Repair Bot ability set up restore targeting - adding Parachute damage info"
                );
                // Add damage info for after ability resolves
                this.state.pending.parachuteBaseDamage = {
                  targetPlayer: pbContext.sourcePlayerId,
                  targetColumn: pbContext.targetColumn,
                  targetPosition: pbContext.targetSlot,
                };
              } else {
                // No pending means no valid targets or ability failed
                console.log(
                  "Repair Bot ability completed (no targets?) - applying Parachute damage"
                );
                this.applyParachuteBaseDamage(
                  pbContext.sourcePlayerId,
                  pbContext.targetColumn,
                  pbContext.targetSlot
                );
              }
            } else {
              console.log(
                `Not enough water for ability (need ${ability.cost}, have ${player.water})`
              );
              // Still apply damage even if can't afford ability
              this.applyParachuteBaseDamage(
                pbContext.sourcePlayerId,
                pbContext.targetColumn,
                pbContext.targetSlot
              );
            }
          } else {
            console.log(
              "Repair Bot has no abilities - applying Parachute damage"
            );
            this.applyParachuteBaseDamage(
              pbContext.sourcePlayerId,
              pbContext.targetColumn,
              pbContext.targetSlot
            );
          }
        } else {
          // Normal entry restore (not from Parachute Base)
          this.state.pending = null;
        }

        return true;
      }

      case "place_punk": {
        console.log("=== Processing place_punk target ===");

        // Store info BEFORE resolving
        const junkCard = this.state.pending?.junkCard;
        const fromVanguardEntry = this.state.pending?.fromVanguardEntry;
        const parachuteBaseContext = this.state.pending?.parachuteBaseContext;

        // Resolve the punk placement
        const result = this.resolvePlacePunk(targetColumn, targetPosition);

        // If successful and this was from a junk effect, discard the card
        if (result && junkCard) {
          this.state.discard.push(junkCard);
          console.log(`Discarded ${junkCard.name} after placing punk`);
        }

        // Check if this was Vanguard's entry trait during Parachute Base
        if (result && fromVanguardEntry && parachuteBaseContext) {
          console.log(
            "=== Continuing Parachute Base sequence after Vanguard punk ==="
          );

          // The Vanguard card object should be in parachuteBaseContext.person
          const vanguardCard = parachuteBaseContext.person;
          const player =
            this.state.players[parachuteBaseContext.sourcePlayerId];

          // Find where Vanguard is NOW after potential push
          let vanguardPos = null;
          let vanguardCol = null;

          for (let col = 0; col < 3; col++) {
            for (let pos = 0; pos < 3; pos++) {
              const card = player.columns[col].getCard(pos);
              if (card && card.id === vanguardCard.id) {
                vanguardCol = col;
                vanguardPos = pos;
                console.log(
                  `Found Vanguard at new position: col ${col}, pos ${pos}`
                );
                break;
              }
            }
            if (vanguardPos !== null) break;
          }

          if (vanguardPos === null) {
            console.log("ERROR: Can't find Vanguard after punk placement");
            console.log("Was looking for card with ID:", vanguardCard.id);
            // Clear pending and bail out
            this.state.pending = null;
            return true;
          }

          // Clear the pending state before continuing
          this.state.pending = null;

          // Now use Vanguard's ability
          if (vanguardCard.abilities?.length > 0) {
            const ability = vanguardCard.abilities[0];

            console.log(
              `Parachute Base: Using Vanguard's ability (${ability.cost} water)`
            );

            if (player.water >= ability.cost) {
              player.water -= ability.cost;
              console.log(
                `Parachute Base: Paid ${ability.cost} for Vanguard's ability`
              );

              // Execute Vanguard's ability
              const abilityResult = this.executeAbility(ability, {
                source: vanguardCard,
                playerId: parachuteBaseContext.sourcePlayerId,
                columnIndex: vanguardCol,
                position: vanguardPos,
                fromParachuteBase: true,
              });

              // Check if ability set up new pending (it should for damage targeting)
              if (this.state.pending) {
                console.log(
                  "Vanguard ability set up targeting, adding Parachute damage info"
                );
                // Add parachute damage info for after ability completes
                this.state.pending.parachuteBaseDamage = {
                  targetPlayer: parachuteBaseContext.sourcePlayerId,
                  targetColumn: vanguardCol,
                  targetPosition: vanguardPos,
                };
              } else {
                console.log(
                  "No pending from Vanguard ability, applying Parachute damage now"
                );
                this.applyParachuteBaseDamage(
                  parachuteBaseContext.sourcePlayerId,
                  vanguardCol,
                  vanguardPos
                );
              }
            } else {
              console.log(
                `Not enough water (need ${ability.cost}, have ${player.water})`
              );
              this.applyParachuteBaseDamage(
                parachuteBaseContext.sourcePlayerId,
                vanguardCol,
                vanguardPos
              );
            }
          }
        } else {
          // Normal punk placement
          console.log("Normal punk placement completion");
          this.state.pending = null;
        }

        return result;
      }

      case "rescue_team_select": {
        // Verify it's a valid target
        const isValidTarget = this.state.pending.validTargets?.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Rescue Team");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        const player = this.state.players[targetPlayer];
        const column = player.columns[targetColumn];

        // Return the person to hand
        if (target.isPunk) {
          // If it's a punk, reveal it when returning to hand
          const revealedCard = {
            id: target.id,
            name: target.originalName || "Unknown Card",
            type: "person",
            cost: target.cost || 0,
            abilities: target.abilities || [],
            junkEffect: target.junkEffect,
          };
          player.hand.push(revealedCard);
          console.log(
            `Rescue Team returned punk to hand - revealed as ${revealedCard.name}!`
          );
        } else {
          // Normal person returns as-is
          const returnCard = {
            id: target.id,
            name: target.name,
            type: target.type,
            cost: target.cost,
            abilities: target.abilities,
            junkEffect: target.junkEffect,
          };
          player.hand.push(returnCard);
          console.log(`Rescue Team returned ${target.name} to hand`);
        }

        // Remove from column
        column.setCard(targetPosition, null);

        // Move cards behind forward if needed
        if (targetPosition < 2) {
          const cardInFront = column.getCard(targetPosition + 1);
          if (cardInFront) {
            column.setCard(targetPosition, cardInFront);
            column.setCard(targetPosition + 1, null);
            console.log(`${cardInFront.name} moved back to fill gap`);
          }
        }

        // Mark Rescue Team's ability as complete
        if (this.state.pending.sourceCard) {
          this.state.pending.sourceCard.isReady = false;
        }

        // Check for Parachute Base damage if applicable
        const parachuteBaseDamage = this.state.pending?.parachuteBaseDamage;

        // Clear pending
        this.state.pending = null;

        // Apply Parachute Base damage if needed
        if (parachuteBaseDamage) {
          console.log(
            "Rescue Team ability completed, applying Parachute Base damage"
          );
          this.applyParachuteBaseDamage(
            parachuteBaseDamage.targetPlayer,
            parachuteBaseDamage.targetColumn,
            parachuteBaseDamage.targetPosition
          );
        }

        return true;
      }

      case "parachute_select_person": {
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
          sourceCard: pending.sourceCard || pending.source, // Ensure we keep the camp reference
          sourcePlayerId: pending.sourcePlayerId,
          selectedPerson: selectedCard,
          campIndex: pending.campIndex,
          shouldStayReady: pending.shouldStayReady,
        };

        console.log(`Parachute Base: Now place ${selectedCard.name}`);
        return true;
      }

      case "parachute_place_person": {
        // Check if this is a slot selection
        if (payload.targetType !== "slot") return false;

        const pb = this.state.pending;

        // Use the CLICKED position from payload
        const targetColumn = payload.columnIndex;
        const targetSlot = payload.position;

        const column =
          this.state.players[pb.sourcePlayerId].columns[targetColumn];
        const player = this.state.players[pb.sourcePlayerId];

        // Calculate the ADJUSTED cost for this specific column
        const adjustedCost = this.getAdjustedCost(
          pb.selectedPerson,
          targetColumn,
          pb.sourcePlayerId
        );

        // Calculate ability cost (first ability only for Parachute Base)
        const abilityCost = pb.selectedPerson.abilities?.[0]?.cost || 0;
        const totalCost = adjustedCost + abilityCost;

        // NOW check if player can afford it in this specific column
        if (player.water < totalCost) {
          console.log(
            `Need ${totalCost} water for Parachute Base (${adjustedCost} for ${pb.selectedPerson.name}, ${abilityCost} for ability)`
          );

          // If Holdout could be free in another column, hint at that
          if (pb.selectedPerson.name === "Holdout" && adjustedCost > 0) {
            for (let col = 0; col < 3; col++) {
              const camp =
                this.state.players[pb.sourcePlayerId].columns[col].getCard(0);
              if (camp?.isDestroyed) {
                console.log(
                  `Hint: Holdout would be FREE in column ${col} (destroyed camp)`
                );
                break;
              }
            }
          }

          return false; // Can't afford in this column
        }

        const existingCard = column.getCard(targetSlot);

        // Handle pushing if slot is occupied
        if (existingCard) {
          // Find where to push the existing card
          const otherSlot = targetSlot === 1 ? 2 : 1;
          if (column.getCard(otherSlot)) {
            console.log("Column is full, cannot place");
            return false;
          }
          // Push the existing card
          column.setCard(otherSlot, existingCard);
          column.setCard(targetSlot, null);
          console.log(`Pushed ${existingCard.name} to position ${otherSlot}`);
        }

        // Now place the person at the clicked position
        // Pay the ADJUSTED cost (not the base cost)
        player.water -= adjustedCost;
        console.log(
          `Parachute Base: Paid ${adjustedCost} for ${pb.selectedPerson.name}` +
            (adjustedCost === 0 && pb.selectedPerson.name === "Holdout"
              ? " (FREE - destroyed camp!)"
              : "")
        );

        // Remove from hand
        const cardIndex = player.hand.findIndex(
          (c) => c.id === pb.selectedPerson.id
        );
        player.hand.splice(cardIndex, 1);

        // Create the person object
        const person = {
          ...pb.selectedPerson,
          isReady: false, // Normal not-ready state
          isDamaged: false,
          position: targetSlot,
          columnIndex: targetColumn,
        };

        // Check for Karli Blaze's persistent trait
        const hasActiveKarli = this.checkForActiveKarli(pb.sourcePlayerId);
        if (hasActiveKarli) {
          person.isReady = true;
          console.log(
            `${person.name} enters play ready due to Karli Blaze's trait (via Parachute Base)!`
          );
        }

        // Place in column
        column.setCard(targetSlot, person);
        console.log(
          `Parachute Base: Placed ${person.name} at column ${targetColumn}, position ${targetSlot}`
        );

        // Clear the pending state first
        this.state.pending = null;

        // Trigger entry traits
        this.triggerEntryTraits(
          person,
          pb.sourcePlayerId,
          targetColumn,
          targetSlot
        );

        // Check if entry trait set up a pending state
        if (this.state.pending) {
          // Entry trait needs resolution (like Repair Bot's restore)
          // Store Parachute Base context to continue after
          this.state.pending.parachuteBaseContext = {
            person,
            sourcePlayerId: pb.sourcePlayerId,
            targetColumn,
            targetSlot,
            hasAbility: person.abilities?.length > 0,
            abilityCost: person.abilities?.[0]?.cost || 0,
            sourceCard: pb.sourceCard, // Preserve camp reference
            shouldStayReady: pb.shouldStayReady, // Preserve Vera decision
          };
          console.log(
            "Parachute Base: Entry trait triggered, will continue after it resolves"
          );
          return true;
        }

        // No entry trait pending, continue with ability use and damage
        if (person.abilities?.length > 0) {
          // Check if person has multiple abilities
          if (person.abilities.length > 1) {
            // Multiple abilities - let player choose
            this.state.pending = {
              type: "parachute_select_ability",
              person: person,
              sourcePlayerId: pb.sourcePlayerId,
              targetColumn: targetColumn,
              targetSlot: targetSlot,
              sourceCard: pb.sourceCard, // Preserve camp reference
              shouldStayReady: pb.shouldStayReady, // Preserve Vera decision
            };
            console.log(
              `Parachute Base: Choose which ${person.name} ability to use`
            );
            console.log(
              `Available abilities: ${person.abilities
                .map((a) => `${a.effect} (${a.cost} water)`)
                .join(", ")}`
            );
            return true;
          }

          // Single ability - use it automatically
          const ability = person.abilities[0];

          // Pay for the ability
          player.water -= ability.cost;
          console.log(
            `Parachute Base: Paid ${ability.cost} for ${person.name}'s ability`
          );

          // Execute the ability (bypass ready check)
          this.executeAbility(ability, {
            source: person,
            playerId: pb.sourcePlayerId,
            columnIndex: targetColumn,
            position: targetSlot,
            fromParachuteBase: true,
          });

          console.log(
            `Parachute Base: Used ${person.name}'s ${ability.effect} ability`
          );

          // Check if the ability set up a new pending state
          if (this.state.pending) {
            // Ability set up a pending state (like Looter's targeting)
            // Add parachute damage info to it
            this.state.pending.parachuteBaseDamage = {
              targetPlayer: pb.sourcePlayerId,
              targetColumn: targetColumn,
              targetPosition: targetSlot,
            };
            this.state.pending.parachuteSourceCard = pb.sourceCard; // Preserve camp reference
            this.state.pending.parachuteShouldStayReady = pb.shouldStayReady; // Preserve Vera decision
            console.log("Parachute Base: Will damage after ability resolves");
          } else {
            // Ability completed immediately (like Muse or Scout)
            // Apply damage now
            console.log(
              "Parachute Base: Ability completed, applying damage now"
            );

            // Set up temporary pending for damage
            this.state.pending = {
              type: "parachute_damage_self",
              sourcePlayerId: pb.sourcePlayerId,
            };

            const damaged = this.resolveDamage(
              pb.sourcePlayerId,
              targetColumn,
              targetSlot
            );

            if (damaged) {
              console.log(`Parachute Base: Damaged ${person.name}`);
            }

            // Clear pending
            this.state.pending = null;

            // Mark Parachute Base as not ready (unless Vera's trait applies)
            if (pb.sourceCard && !pb.shouldStayReady) {
              pb.sourceCard.isReady = false;
              console.log("Parachute Base marked as not ready");
            }
          }
        } else {
          // No abilities - just damage the person immediately
          this.state.pending = {
            type: "parachute_damage_self",
            sourcePlayerId: pb.sourcePlayerId,
          };

          const damaged = this.resolveDamage(
            pb.sourcePlayerId,
            targetColumn,
            targetSlot
          );

          if (damaged) {
            console.log(`Parachute Base: Damaged ${person.name} (no ability)`);
          }

          // Clear pending
          this.state.pending = null;

          // Mark Parachute Base as not ready (unless Vera's trait applies)
          if (pb.sourceCard && !pb.shouldStayReady) {
            pb.sourceCard.isReady = false;
            console.log("Parachute Base marked as not ready", pb.sourceCard);
          } else {
            console.log("Failed to mark Parachute Base not ready:", {
              hasSourceCard: !!pb.sourceCard,
              shouldStayReady: pb.shouldStayReady,
              sourceCard: pb.sourceCard,
            });
          }
        }

        return true;
      }

      case "mimic_select_target": {
        const pending = this.state.pending;

        // Find if this is a valid target
        const validTarget = pending.validTargets.find(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!validTarget) {
          console.log("Not a valid target for Mimic");
          return false;
        }

        const targetCard = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );

        // Check if target only has Argo's granted ability (e.g., a punk with Argo active)
        if (validTarget.hasArgoBonus) {
          // Mimic copies the Argo-granted damage ability
          const argoAbility = { effect: "damage", cost: 1 };

          // Check if player can afford it
          const player = this.state.players[pending.sourcePlayerId];
          if (player.water < 1) {
            console.log("Not enough water for Argo's damage ability");
            pending.source.isReady = true;
            this.state.pending = null;
            return false;
          }

          // Pay the cost
          player.water -= 1;
          console.log(
            `Mimic: Paid 1 water to copy ${
              targetCard.isPunk ? "Punk" : targetCard.name
            }'s [Argo] damage`
          );

          // Mark Mimic as not ready
          pending.source.isReady = false;

          // Store Parachute Base damage if needed
          const parachuteBaseDamage = pending.parachuteBaseDamage;

          // Mark ability complete
          this.completeAbility(this.state.pending);

          // Clear the mimic pending state
          this.state.pending = null;

          // Execute the damage ability with Mimic as the source
          const mimicContext = {
            source: pending.source,
            playerId: pending.sourcePlayerId,
            columnIndex: pending.sourceContext.columnIndex,
            position: pending.sourceContext.position,
            copiedFrom: targetCard.isPunk
              ? "Punk (Argo)"
              : `${targetCard.name} (Argo)`,
            fromMimic: true,
          };

          this.executeAbility(argoAbility, mimicContext);

          console.log(
            `Mimic used ${
              targetCard.isPunk ? "Punk" : targetCard.name
            }'s [Argo] damage ability`
          );

          // Restore Parachute Base damage if it was present
          if (parachuteBaseDamage) {
            if (!this.state.pending) {
              this.state.pending = { parachuteBaseDamage };
              this.checkAndApplyParachuteBaseDamage();
            } else {
              this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
            }
          }

          return true;
        }

        // Handle normal abilities (not Argo-granted)
        if (!targetCard || !targetCard.abilities?.length) {
          console.log("Target has no abilities");
          return false;
        }

        // Check if target has multiple abilities
        if (targetCard.abilities.length > 1) {
          // Multiple abilities - let player choose which to copy
          this.state.pending = {
            type: "mimic_select_ability",
            targetCard: targetCard,
            targetPlayerId: targetPlayer,
            targetColumnIndex: targetColumn,
            targetPosition: targetPosition,
            source: pending.source,
            sourcePlayerId: pending.sourcePlayerId,
            sourceContext: pending.sourceContext,
            parachuteBaseDamage: pending.parachuteBaseDamage,
          };
          console.log(`Mimic: Choose which ${targetCard.name} ability to copy`);
          console.log(
            `Available abilities: ${targetCard.abilities
              .map((a) => `${a.effect} (${a.cost} water)`)
              .join(", ")}`
          );
          return true;
        }

        // Single ability - use it automatically
        const targetAbility = targetCard.abilities[0];

        // Check if player can afford the ability
        const player = this.state.players[pending.sourcePlayerId];
        if (player.water < targetAbility.cost) {
          console.log(
            `Not enough water for ${targetCard.name}'s ability (need ${targetAbility.cost})`
          );
          // Mark Mimic as ready again since we couldn't complete
          pending.source.isReady = true;
          this.state.pending = null;
          return false;
        }

        // Pay the cost
        player.water -= targetAbility.cost;
        console.log(
          `Mimic: Paid ${targetAbility.cost} water to copy ${targetCard.name}'s ${targetAbility.effect}`
        );

        // Mark Mimic as not ready
        pending.source.isReady = false;

        // Store Parachute Base damage if needed
        const parachuteBaseDamage = pending.parachuteBaseDamage;

        // Mark ability complete
        this.completeAbility(this.state.pending);

        // Clear the mimic pending state
        this.state.pending = null;

        // Execute the copied ability with Mimic as the source
        const mimicContext = {
          source: pending.source,
          playerId: pending.sourcePlayerId,
          columnIndex: pending.sourceContext.columnIndex,
          position: pending.sourceContext.position,
          copiedFrom: targetCard.name,
          fromMimic: true,
        };

        // Execute the ability
        this.executeAbility(targetAbility, mimicContext);

        console.log(
          `Mimic used ${targetCard.name}'s ${targetAbility.effect} ability`
        );

        // Restore Parachute Base damage if it was present
        if (parachuteBaseDamage) {
          if (!this.state.pending) {
            // Ability completed immediately, apply damage now
            this.state.pending = { parachuteBaseDamage };
            this.checkAndApplyParachuteBaseDamage();
          } else {
            // Ability set up new pending, add parachute damage to it
            this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
          }
        }

        return true;
      }

      case "mimic_select_ability": {
        const pending = this.state.pending;
        const abilityIndex = payload.abilityIndex;

        if (
          abilityIndex === undefined ||
          !pending.targetCard.abilities[abilityIndex]
        ) {
          console.log("Invalid ability selection for Mimic");
          return false;
        }

        const targetAbility = pending.targetCard.abilities[abilityIndex];
        const player = this.state.players[pending.sourcePlayerId];

        // Check if player can afford the chosen ability
        if (player.water < targetAbility.cost) {
          console.log(
            `Not enough water for ${pending.targetCard.name}'s ${targetAbility.effect} (need ${targetAbility.cost})`
          );
          // Mark Mimic as ready again since we couldn't complete
          pending.source.isReady = true;
          this.state.pending = null;
          return false;
        }

        // Pay the cost
        player.water -= targetAbility.cost;
        console.log(
          `Mimic: Paid ${targetAbility.cost} water to copy ${pending.targetCard.name}'s ${targetAbility.effect}`
        );

        // Mark Mimic as not ready
        pending.source.isReady = false;

        // Store Parachute Base damage if needed
        const parachuteBaseDamage = pending.parachuteBaseDamage;

        // Mark ability complete
        this.completeAbility(this.state.pending);

        // Clear the pending state
        this.state.pending = null;

        // Execute the copied ability with Mimic as the source
        const mimicContext = {
          source: pending.source,
          playerId: pending.sourcePlayerId,
          columnIndex: pending.sourceContext.columnIndex,
          position: pending.sourceContext.position,
          copiedFrom: pending.targetCard.name,
          fromMimic: true,
        };

        // Execute the ability
        this.executeAbility(targetAbility, mimicContext);

        console.log(
          `Mimic copied and used ${pending.targetCard.name}'s ${targetAbility.effect} ability`
        );

        // Handle Parachute Base damage if present
        if (parachuteBaseDamage) {
          if (!this.state.pending) {
            // Ability completed immediately, apply damage now
            this.state.pending = { parachuteBaseDamage };
            this.checkAndApplyParachuteBaseDamage();
          } else {
            // Ability set up new pending, add parachute damage to it
            this.state.pending.parachuteBaseDamage = parachuteBaseDamage;
          }
        }

        return true;
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
    for (const playerId of ["left", "right"]) {
      const player = this.state.players[playerId];
      let destroyedCamps = 0;

      for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
        const camp = player.columns[col].getCard(0);
        if (camp?.isDestroyed) destroyedCamps++;
      }

      if (destroyedCamps === 3) {
        this.state.phase = "game_over";
        this.state.winner = playerId === "left" ? "right" : "left";
        return true;
      }
    }

    return false;
  }

  notifyUI(commandType, result) {
    // Emit event for UI update
    window.dispatchEvent(
      new CustomEvent("gameStateChanged", {
        detail: { commandType, result, state: this.state },
      })
    );
  }

  // Import your existing ability handlers here
  getAbilityHandler(cardName, effect) {
    // This will connect to your card-specific handlers
    const handlers = window.cardAbilityHandlers || {};
    return handlers[cardName]?.[effect];
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
    // Clear pending states
    this.state.pending = null;

    // Reset turn events
    this.state.turnEvents = {
      eventsPlayed: 0,
      peoplePlayedThisTurn: 0,
      eventResolvedThisTurn: false,
      abilityUsedThisTurn: false,
      veraFirstUseCards: [],
      highGroundActive: false,
      firstEventPlayedThisTurn: false,
    };

    // Switch player
    this.state.currentPlayer =
      this.state.currentPlayer === "left" ? "right" : "left";
    this.state.turnNumber++;

    // Start new turn with events phase
    this.state.phase = "events";
    this.notifyUI("PHASE_CHANGE", "events");

    // Process events phase after a short delay so it's visible
    setTimeout(() => {
      this.processEventsPhase();
    }, 1000);

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
        const eventDef = window.cardRegistry?.eventAbilities?.[eventName];

        if (eventDef?.effect?.handler) {
          console.log(`Resolving ${event.name} event effect`);

          // Remove from queue first
          player.eventQueue[0] = null;

          // Execute the event effect
          const context = {
            playerId: this.state.currentPlayer,
            eventCard: event,
          };

          const result = eventDef.effect.handler(this.state, context);

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
          player.eventQueue[0] = null;
          this.state.discard.push(event);
        }
      }
    }

    // Only advance events and continue if no pending selection
    if (!this.state.pending) {
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

    // Move to replenish phase after a delay
    setTimeout(() => {
      this.state.phase = "replenish";
      this.notifyUI("PHASE_CHANGE", "replenish");

      // Process replenish after another short delay
      setTimeout(() => {
        this.processReplenishPhase();
      }, 1000);
    }, 1000);
  }

  processReplenishPhase() {
    const player = this.state.players[this.state.currentPlayer];

    // Draw a card
    if (this.state.deck.length > 0) {
      const drawnCard = this.state.deck.shift();
      player.hand.push(drawnCard);
      console.log(`${this.state.currentPlayer} drew: ${drawnCard.name}`);
    }

    // Set water
    if (this.state.turnNumber === 1) {
      player.water = 100;
    } else {
      player.water = 100;
    }

    // Ready all undamaged cards (but camps are ALWAYS ready unless ability used)
    for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (card && !card.isDestroyed) {
          if (card.type === "camp") {
            // Camps are always ready (damaged or not)
            card.isReady = true;
          } else if (card.type === "person" && !card.isDamaged) {
            // People are only ready if not damaged
            card.isReady = true;
          }
        }
      }
    }

    // Move to actions phase
    this.state.phase = "actions";
    this.notifyUI("PHASE_CHANGE", this.state.phase);
  }
}
