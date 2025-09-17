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

    // Check protection (unless ability ignores it OR it's Parachute self-damage)
    if (
      !pending.allowProtected &&
      pending.type !== "parachute_damage_self" && // ADD THIS CONDITION
      column.isProtected(targetPosition)
    ) {
      console.log(`Cannot damage protected ${target.name}`);
      return false;
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

  destroyPerson(player, column, position, card) {
    if (card.isPunk) {
      // Punk returns to deck
      this.state.deck.unshift({
        id: `returned_punk_${Date.now()}`,
        name: "Unknown Card",
        type: "person",
        cost: 0,
        isFaceDown: true,
      });
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

    console.log(`${card.name} destroyed`);
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

    const punk = {
      id: `punk_${Date.now()}`,
      name: "Punk",
      type: "person",
      isPunk: true,
      isReady: false,
      isDamaged: false,
      cost: 0,
    };

    if (!this.placeCardWithPush(column, targetPosition, punk)) {
      return false;
    }

    console.log(
      `Placed punk at column ${targetColumn}, position ${targetPosition}`
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
    if (card.name === "Water Silo" || card.isWaterSilo) {
      player.waterSilo = "available";
      player.water += 1; // Make sure this line is here!
      console.log("Water Silo returned to play area, gained 1 water");
      console.log("Water after returning silo:", player.water);
      return true;
    }

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
        // Set up targeting for restore - ONLY OWN CARDS
        const validRestoreTargets = [];
        const currentPlayer = this.state.players[playerId];

        // Only check the player's own cards
        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = currentPlayer.columns[col].getCard(pos);
            if (card && card.isDamaged && !card.isDestroyed) {
              validRestoreTargets.push({
                playerId: playerId, // Always own player
                columnIndex: col,
                position: pos,
              });
            }
          }
        }

        if (validRestoreTargets.length === 0) {
          console.log("No damaged cards to restore");
          break;
        }

        this.state.pending = {
          type: "junk_restore",
          source: card,
          sourcePlayerId: playerId,
          validTargets: validRestoreTargets,
        };
        console.log(
          `Select one of your damaged cards to restore (${validRestoreTargets.length} available)`
        );
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
      isReady: false,
      isDamaged: false,
      position: position,
      columnIndex,
    };

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

    // Camps CAN use abilities when damaged (just not when destroyed)

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

      if (raidersIndex === 0) {
        // Raiders in slot 1 - resolve it!
        console.log("Raid: Advancing Raiders off slot 1 - resolving effect!");

        // Remove from queue
        player.eventQueue[0] = null;

        // Return to available
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
      } else if (raidersIndex > 0) {
        // Can advance toward slot 1
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

        // Now resolve it as damage (which will handle destruction properly)
        return this.resolveDamage(targetPlayer, targetColumn, targetPosition);
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

        console.log("Set pending state to:", this.state.pending); // ADD THIS
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
          };
          console.log(
            "Parachute Base: Entry trait triggered, will continue after it resolves"
          );
          return true;
        }

        // No entry trait pending, continue with ability use and damage
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

          // Check if the ability set up a new pending state
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

            // Clear pending to unhang the UI
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

        return true;
      }

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
        // Normal event resolution
        // TODO: Handle other event types
        this.state.discard.push(event);
        player.eventQueue[0] = null;
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
