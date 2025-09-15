import { CardRegistry } from "../cards/card-registry.js";

export class CommandSystem {
  constructor(gameState) {
    this.state = gameState;
    this.history = [];
    this.pendingCommand = null;
    this.handlers = new Map();

    this.registerHandlers();
  }

  handleUseCampAbility(payload) {
    const { playerId, columnIndex } = payload;
    const camp = this.state.getCard(playerId, columnIndex, 0);

    if (!camp || camp.isDestroyed) return false;

    console.log(`Camp ability used: ${camp.name}`);
    if (camp.abilities && camp.abilities.length > 0) {
      camp.isReady = false;
    }

    return true;
  }

  resolveDamage(targetPlayer, targetColumn, targetPosition) {
    const pending = this.state.pending;

    if (!pending) {
      console.error("No pending damage to resolve");
      return false;
    }

    // DEBUG: Log the exact values being compared
    console.log("resolveDamage check:", {
      targetPlayer,
      pendingSourcePlayerId: pending.sourcePlayerId,
      pendingType: pending.type,
      comparison: targetPlayer === pending.sourcePlayerId,
      typeCheck: pending.type !== "parachute_damage_self",
    });

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

    // Check protection (unless ability ignores it)
    if (!pending.allowProtected && column.isProtected(targetPosition)) {
      console.log(`Cannot damage protected ${target.name}`);
      return false;
    }

    // Apply damage
    if (target.isDamaged) {
      target.isDestroyed = true;
      console.log(`${target.name} destroyed!`);

      // Handle destroyed cards
      if (target.type === "person") {
        // Move to discard
        this.state.discard.push(target);
        // Remove from column
        column.setCard(targetPosition, null);

        // Move any card in front back (regardless of type)
        // Don't assume positions - just check if there's a card in the next position
        if (targetPosition < 2) {
          // If not in the frontmost position
          const nextPosition = targetPosition + 1;
          const cardInFront = column.getCard(nextPosition);
          if (cardInFront) {
            column.setCard(targetPosition, cardInFront);
            column.setCard(nextPosition, null);
            console.log(
              `${cardInFront.name} moved back to position ${targetPosition}`
            );
          }
        }
      } else if (target.type === "camp") {
        // Camps stay in place when destroyed, just marked as destroyed
        console.log(`Camp ${target.name} destroyed but remains in place`);
      }
    } else {
      target.isDamaged = true;

      // Only people become not-ready when damaged
      if (target.type === "person") {
        target.isReady = false;
        console.log(`${target.name} damaged and not ready!`);
      } else if (target.type === "camp") {
        // Camps stay ready even when damaged
        console.log(`Camp ${target.name} damaged but still ready!`);
      }
    }

    // Clear pending only after successful damage
    this.state.pending = null;
    return true;
  }

  resolveInjure(targetPlayer, targetColumn, targetPosition) {
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

  resolvePlacePunk(targetColumn, targetPosition) {
    const player = this.state.players[this.state.currentPlayer];
    const column = player.columns[targetColumn];

    // Create punk (facedown card)
    const punk = {
      id: `punk_${Date.now()}`,
      name: "Punk",
      type: "person",
      isPunk: true,
      isReady: false,
      isDamaged: false,
      cost: 0, // Punks have no cost
    };

    // Use the SAME placement logic as normal person cards
    const existingCard = column.getCard(targetPosition);

    if (existingCard) {
      console.log(
        `Position ${targetPosition} is occupied by ${existingCard.name}`
      );

      // Find where to push the existing card
      let pushToPosition = -1;

      // Check for Juggernaut in column
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
        if (targetPosition < 2 && !column.getCard(targetPosition + 1)) {
          pushToPosition = targetPosition + 1;
        }
      } else {
        // Juggernaut present - find the other non-Juggernaut position
        const nonJuggernautPositions = [0, 1, 2].filter(
          (p) => p !== juggernautPos
        );
        const otherPosition = nonJuggernautPositions.find(
          (p) => p !== targetPosition
        );

        if (otherPosition !== undefined && !column.getCard(otherPosition)) {
          pushToPosition = otherPosition;
        }
      }

      if (pushToPosition === -1) {
        console.log("Cannot place punk - no empty position for push");
        return false;
      }

      // Push the existing card
      column.setCard(pushToPosition, existingCard);
      column.setCard(targetPosition, null);
      console.log(`Pushed ${existingCard.name} to position ${pushToPosition}`);
    }

    // Place the punk
    column.setCard(targetPosition, punk);
    console.log(
      `Placed punk at column ${targetColumn}, position ${targetPosition}`
    );

    this.state.pending = null;
    return true;
  }

  handleDrawCard() {
    const player = this.state.players[this.state.currentPlayer];

    if (player.water < 2) {
      console.log("Not enough water");
      return false;
    }

    player.water -= 2;
    if (this.state.deck.length > 0) {
      player.hand.push(this.state.deck.shift());
    }
    return true;
  }

  triggerEntryEffects(person, playerId) {
    console.log(`${person.name} entered play`);
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

  resolvePlacePunk(targetColumn, targetPosition) {
    const player = this.state.players[this.state.currentPlayer];
    const column = player.columns[targetColumn];

    if (!column.canPlaceCard(targetPosition, { type: "person" })) return false;

    const punk = {
      id: `punk_${Date.now()}`,
      name: "Punk",
      type: "person",
      isPunk: true,
      isReady: false,
      isDamaged: false,
    };

    column.setCard(targetPosition, punk);
    this.state.pending = null;
    return true;
  }

  handleJunkCard(payload) {
    console.log("=== handleJunkCard called ===");
    console.log("Payload:", payload);

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
    console.log("Water before:", player.water);

    // Remove from hand first
    player.hand.splice(cardIndex, 1);

    // Handle special case for Water Silo
    if (card.name === "Water Silo") {
      player.waterSilo = "available";
      console.log("Water Silo returned to play area");
      return true;
    }

    // Add to discard pile
    this.state.discard.push(card);

    // Process the junk effect
    const junkEffect = card.junkEffect?.toLowerCase();
    console.log("Processing junk effect:", junkEffect);

    switch (junkEffect) {
      case "water":
        player.water += 1;
        console.log("Gained 1 water from junk effect");
        console.log("Water after:", player.water);
        break;

      case "injure":
        // Set up targeting for injure
        this.state.pending = {
          type: "junk_injure",
          source: card,
          sourcePlayerId: playerId,
        };
        console.log("Select an unprotected enemy person to injure");
        break;

      case "restore":
        // Set up targeting for restore
        this.state.pending = {
          type: "junk_restore",
          source: card,
          sourcePlayerId: playerId,
        };
        console.log("Select a damaged card to restore");
        break;

      case "raid":
        // Execute raid effect
        this.executeRaid(playerId);
        console.log("Raid effect triggered");
        break;

      case "card":
      case "draw":
        // Draw a card
        if (this.state.deck.length > 0) {
          const drawnCard = this.state.deck.shift();
          player.hand.push(drawnCard);
          console.log(`Drew ${drawnCard.name} from junk effect`);
        } else {
          console.log("Deck is empty, cannot draw");
        }
        break;

      case "punk":
        // Set up placement for punk
        this.state.pending = {
          type: "place_punk",
          source: card,
          sourcePlayerId: playerId,
        };
        console.log("Select where to place the punk");
        break;

      default:
        console.log(`Unknown or missing junk effect: ${junkEffect}`);
    }

    console.log("Final water count:", player.water);
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

  handleDrawCard() {
    const player = this.state.players[this.state.currentPlayer];

    if (player.water < 2) {
      console.log("Not enough water");
      return false;
    }

    player.water -= 2;
    if (this.state.deck.length > 0) {
      player.hand.push(this.state.deck.shift());
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
    if (!payload) payload = {}; // Safety check

    const { playerId, cardId, targetColumn, targetPosition } = payload;
    const player = this.state.players[playerId];

    // Find card in hand
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return false;

    const card = player.hand[cardIndex];

    // Check cost
    if (player.water < this.getAdjustedCost(card, targetColumn, playerId)) {
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
      return this.playEvent(playerId, card, cardIndex);
    }

    return false;
  }

  checkAllSlotsFull(playerId) {
    const player = this.state.players[playerId];
    let emptySlots = 0;

    for (let col = 0; col < 3; col++) {
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

    // Check if we can place at the requested position
    const existingCard = column.getCard(position);
    let pushToPosition = -1; // Declare it here so it's in scope for the whole function

    if (existingCard) {
      console.log(`Position ${position} is occupied by ${existingCard.name}`);

      // Find where Juggernaut is (if anywhere)
      let juggernautPos = -1;
      for (let i = 0; i < 3; i++) {
        const card = column.getCard(i);
        if (card?.name === "Juggernaut") {
          juggernautPos = i;
          console.log(`Found Juggernaut at position ${i}`);
          break;
        }
      }

      if (juggernautPos === -1) {
        // No Juggernaut - normal push forward
        if (position < 2 && !column.getCard(position + 1)) {
          pushToPosition = position + 1;
        }
      } else {
        // Juggernaut present - find the other non-Juggernaut position
        const nonJuggernautPositions = [0, 1, 2].filter(
          (p) => p !== juggernautPos
        );
        console.log(`Non-Juggernaut positions: ${nonJuggernautPositions}`);

        // The other position is the one that's not the requested position
        const otherPosition = nonJuggernautPositions.find(
          (p) => p !== position
        );
        console.log(`Other non-Juggernaut position: ${otherPosition}`);

        // Check if that position is empty
        const cardAtOther = column.getCard(otherPosition);
        console.log(
          `Card at position ${otherPosition}: ${
            cardAtOther ? cardAtOther.name : "empty"
          }`
        );

        if (otherPosition !== undefined && !cardAtOther) {
          pushToPosition = otherPosition;
          console.log(`Can push to position ${otherPosition}`);
        }
      }

      if (pushToPosition === -1) {
        console.log("Cannot push - no empty position available");
        return false;
      }

      // Push the existing card
      column.setCard(pushToPosition, existingCard);
      column.setCard(position, null);
      console.log(
        `Pushed ${existingCard.name} from position ${position} to ${pushToPosition}`
      );
    }

    // Rest of the method...
    const cost = this.getAdjustedCost(card, columnIndex, playerId);
    if (player.water < cost) {
      console.log("Not enough water!");
      if (existingCard && pushToPosition !== -1) {
        column.setCard(position, existingCard);
        column.setCard(pushToPosition, null);
      }
      return false;
    }

    player.water -= cost;
    player.hand.splice(cardIndex, 1);

    const person = {
      ...card,
      isReady: false,
      isDamaged: false,
      position: position,
      columnIndex,
    };

    column.setCard(position, person);
    this.triggerEntryEffects(person, playerId);
    this.state.turnEvents.peoplePlayedThisTurn++;

    console.log(`Played ${card.name} to position ${position}`);
    return true;
  }

  playEvent(playerId, card, cardIndex) {
    const player = this.state.players[playerId];

    // Check event queue for available slot
    const queueNumber = card.queueNumber || 0;

    if (queueNumber === 0) {
      // Instant event - resolve immediately
      console.log(`Playing instant event: ${card.name}`);
      // TODO: Resolve event effect
      player.hand.splice(cardIndex, 1);
      this.state.discard.push(card);
      return true;
    }

    // Find appropriate slot in event queue
    // Events want to go in slot matching their queue number (1, 2, or 3)
    // In array terms that's index 0, 1, or 2
    const desiredSlot = queueNumber - 1;

    if (!player.eventQueue[desiredSlot]) {
      // Desired slot is empty
      player.eventQueue[desiredSlot] = card;
    } else {
      // Desired slot is occupied, find next available slot
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

    // Pay cost
    player.water -= card.cost;

    // Remove from hand
    player.hand.splice(cardIndex, 1);

    console.log(`Placed ${card.name} in event queue`);
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

    const { playerId, columnIndex, position, abilityIndex } = payload;

    // Verify this is actually the current player's card
    if (playerId !== this.state.currentPlayer) {
      console.log("Can only use abilities on your own turn");
      return false;
    }

    const card = this.state.getCard(playerId, columnIndex, position);

    if (!card || !card.abilities?.[abilityIndex]) {
      console.log("Card or ability not found");
      return false;
    }

    const ability = card.abilities[abilityIndex];

    // Check if ready
    if (!card.isReady || card.isDamaged || card.isDestroyed) {
      console.log("Card is not ready to use abilities");
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
    this.executeAbility(ability, {
      source: card,
      playerId: playerId,
      columnIndex,
      position,
    });

    // Mark as used (not ready)
    card.isReady = false;

    this.state.turnEvents.abilityUsedThisTurn = true;

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

      console.log(`Raid: Found Raiders at slot ${raidersIndex + 1}`);

      if (raidersIndex > 0) {
        // Can advance (move to lower index = closer to slot 1)
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
      } else if (raidersIndex === 0) {
        console.log("Raid: Raiders already in slot 1, cannot advance further");
        return false;
      } else {
        console.log("Raid: Raiders not found in queue (this shouldn't happen)");
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
      case "junk_restore": {
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

        this.state.pending = null;
        return true;
      }

      case "junk_injure": {
        // Verify target is an enemy person
        if (targetPlayer === this.state.pending.sourcePlayerId) {
          console.log("Must target enemy for injure");
          return false;
        }

        const target = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!target || target.type !== "person") {
          console.log("Must target a person");
          return false;
        }

        // Check protection
        const column = this.state.players[targetPlayer].columns[targetColumn];
        if (column.isProtected(targetPosition)) {
          console.log("Cannot injure protected person");
          return false;
        }

        // Apply injure (same as damage for people)
        if (target.isDamaged) {
          target.isDestroyed = true;
          console.log(`${target.name} destroyed by junk injure!`);
          // Handle destruction...
        } else {
          target.isDamaged = true;
          target.isReady = false;
          console.log(`${target.name} injured by junk effect!`);
        }

        this.state.pending = null;
        return true;
      }

      case "junk_restore": {
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
        console.log(`${target.name} restored by junk effect!`);

        this.state.pending = null;
        return true;
      }

      case "damage":
        return this.resolveDamage(targetPlayer, targetColumn, targetPosition);

      case "looter_damage": {
        console.log("=== Processing looter_damage target ===");
        console.log("Source player:", this.state.pending.sourcePlayerId);
        console.log("Target:", targetPlayer, targetColumn, targetPosition);

        const sourcePlayerId = this.state.pending.sourcePlayerId;
        const parachuteBaseDamage = this.state.pending.parachuteBaseDamage;

        // Get the target to check if it's a camp
        const targetCard = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        const isTargetCamp = targetCard?.type === "camp";

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

      case "injure":
        return this.resolveInjure(targetPlayer, targetColumn, targetPosition);

      case "restore":
        return this.resolveRestore(targetPlayer, targetColumn, targetPosition);

      case "place_punk":
        return this.resolvePlacePunk(targetColumn, targetPosition);

      case "parachute_select_person": {
        // This case is triggered when a card is selected from hand
        if (payload.targetType !== "hand_card") return false;

        const pending = this.state.pending;
        const player = this.state.players[pending.sourcePlayerId];
        const selectedCard = player.hand.find((c) => c.id === payload.cardId);

        if (!selectedCard) {
          console.log("Card not found in hand");
          return false;
        }

        // Check total cost
        const totalCost =
          selectedCard.cost + (selectedCard.abilities?.[0]?.cost || 0);
        if (player.water < totalCost) {
          console.log(
            `Need ${totalCost} water for Parachute Base (${
              selectedCard.cost
            } for card, ${selectedCard.abilities?.[0]?.cost || 0} for ability)`
          );
          this.state.pending = null;
          return false;
        }

        // Move to placement phase
        this.state.pending = {
          type: "parachute_place_person",
          source: pending.source,
          sourcePlayerId: pending.sourcePlayerId,
          selectedPerson: selectedCard,
          campIndex: pending.campIndex,
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

        // Validate it's not the camp slot
        if (targetSlot === 0) {
          console.log("Cannot place person in camp slot");
          return false;
        }

        const column =
          this.state.players[pb.sourcePlayerId].columns[targetColumn];
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
        const player = this.state.players[pb.sourcePlayerId];
        player.water -= pb.selectedPerson.cost;
        console.log(
          `Parachute Base: Paid ${pb.selectedPerson.cost} for ${pb.selectedPerson.name}`
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

        // Place in column
        column.setCard(targetSlot, person);
        console.log(
          `Parachute Base: Placed ${person.name} at column ${targetColumn}, position ${targetSlot}`
        );

        // Use their first ability if they have one
        if (person.abilities?.length > 0) {
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

          // DON'T damage immediately - wait for ability to resolve
          // Store the damage target in the person or pending state
          if (this.state.pending) {
            // Ability set up a pending state (like Looter's targeting)
            // Add parachute damage info to it
            this.state.pending.parachuteBaseDamage = {
              targetPlayer: pb.sourcePlayerId,
              targetColumn: targetColumn,
              targetPosition: targetSlot,
            };
            console.log("Parachute Base: Will damage after ability resolves");
          } else {
            // Ability completed immediately (no targeting needed)
            // Can damage now
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
            this.state.pending = null;
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
          this.state.pending = null;
        }

        return true; // ADD THIS
      } // This closes the parachute_place_person case

      // In handleSelectTarget method, add this case:
      case "mimic_select_target": {
        const pending = this.state.pending;

        // Find if this is a valid target
        const isValidTarget = pending.validTargets.some(
          (t) =>
            t.playerId === targetPlayer &&
            t.columnIndex === targetColumn &&
            t.position === targetPosition
        );

        if (!isValidTarget) {
          console.log("Not a valid target for Mimic");
          return false;
        }

        const targetCard = this.state.getCard(
          targetPlayer,
          targetColumn,
          targetPosition
        );
        if (!targetCard || !targetCard.abilities?.length) {
          console.log("Target has no abilities");
          return false;
        }

        // For now, use the first ability
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

      console.log("Pending state before damage:", this.state.pending);

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
      } else {
        console.log("Failed to damage - check resolveDamage");
      }

      this.state.pending = null;
      return true;
    }
    return false;
  }

  checkGameEnd() {
    for (const playerId of ["left", "right"]) {
      const player = this.state.players[playerId];
      let destroyedCamps = 0;

      for (let col = 0; col < 3; col++) {
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
      console.log(`Resolving event: ${player.eventQueue[0].name}`);
      // TODO: Actually resolve the event effect
      this.state.discard.push(player.eventQueue[0]);
      player.eventQueue[0] = null;
    }

    // Advance events forward
    for (let i = 0; i < 2; i++) {
      player.eventQueue[i] = player.eventQueue[i + 1];
    }
    player.eventQueue[2] = null;

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
    for (let col = 0; col < 3; col++) {
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
