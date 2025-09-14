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
    if (targetPlayer === pending.sourcePlayerId) {
      console.log("Cannot damage own cards");
      return false;
    }

    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target) return false;

    const column = this.state.players[targetPlayer].columns[targetColumn];
    if (column.isProtected(targetPosition)) {
      console.log("Cannot damage protected target");
      return false;
    }

    if (target.isDamaged) {
      target.isDestroyed = true;
    } else {
      target.isDamaged = true;
      target.isReady = false;
    }

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
    const { playerId, cardIndex } = payload;
    const player = this.state.players[playerId];
    const card = player.hand[cardIndex];

    if (!card) return false;

    player.hand.splice(cardIndex, 1);
    this.state.discard.push(card);
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
      target.isReady = false;
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

  resolveDamage(targetPlayer, targetColumn, targetPosition) {
    const pending = this.state.pending;
    if (targetPlayer === pending.sourcePlayerId) {
      console.log("Cannot damage own cards");
      return false;
    }

    const target = this.state.getCard(
      targetPlayer,
      targetColumn,
      targetPosition
    );
    if (!target) return false;

    const column = this.state.players[targetPlayer].columns[targetColumn];
    if (column.isProtected(targetPosition)) {
      console.log("Cannot damage protected target");
      return false;
    }

    if (target.isDamaged) {
      target.isDestroyed = true;
    } else {
      target.isDamaged = true;
      target.isReady = false;
    }

    this.state.pending = null;
    return true;
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
    const { playerId, cardIndex } = payload;
    const player = this.state.players[playerId];
    const card = player.hand[cardIndex];

    if (!card) return false;

    player.hand.splice(cardIndex, 1);
    this.state.discard.push(card);
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

  execute(command) {
    // Validate command
    if (!this.validateCommand(command)) {
      console.error("Invalid command:", command);
      return false;
    }

    // Store in history
    this.history.push({
      command,
      state: this.state.clone(),
      timestamp: Date.now(),
    });

    // Execute
    const handler = this.handlers.get(command.type);
    if (handler) {
      const result = handler(command.payload);

      // Check for game end
      this.checkGameEnd();

      // Notify UI
      this.notifyUI(command.type, result);

      return result;
    }

    return false;
  }

  validateCommand(command) {
    // Basic validation
    if (!command.type || !command.playerId) return false;

    // Check if it's player's turn
    if (command.playerId !== this.state.currentPlayer && !command.isForced) {
      return false;
    }

    // Phase-specific validation
    switch (command.type) {
      case "PLAY_CARD":
      case "JUNK_CARD":
      case "USE_ABILITY":
        return this.state.phase === "actions";
      case "END_TURN":
        return this.state.phase === "actions" && !this.state.pending;
      default:
        return true;
    }
  }

  handlePlayCard(payload) {
    const { playerId, cardId, targetColumn, targetPosition } = payload;
    const player = this.state.players[playerId];

    // Find card in hand
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return false;

    const card = player.hand[cardIndex];

    // Check cost
    if (player.water < this.getAdjustedCost(card, targetColumn)) {
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

  playPerson(playerId, card, cardIndex, columnIndex, position) {
    const player = this.state.players[playerId];
    const column = player.columns[columnIndex];

    // Apply column placement rules
    let actualPosition = this.determinePosition(column, position);

    if (!column.canPlaceCard(actualPosition, card)) {
      return false;
    }

    // Pay cost
    const cost = this.getAdjustedCost(card, columnIndex);
    player.water -= cost;

    // Remove from hand
    player.hand.splice(cardIndex, 1);

    // Create person state
    const person = {
      ...card,
      isReady: false,
      isDamaged: false,
      position: actualPosition,
      columnIndex,
    };

    // Place the card
    column.setCard(actualPosition, person);

    // Trigger entry effects
    this.triggerEntryEffects(person, playerId);

    // Update counters
    this.state.turnEvents.peoplePlayedThisTurn++;

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

  getAdjustedCost(card, columnIndex) {
    let cost = card.cost;

    // Check for cost modifiers (Holdout, Oasis, etc)
    const column =
      this.state.players[this.state.currentPlayer].columns[columnIndex];
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
    const { playerId, columnIndex, position, abilityIndex } = payload;
    const card = this.state.getCard(playerId, columnIndex, position);

    if (!card || !card.abilities?.[abilityIndex]) return false;

    const ability = card.abilities[abilityIndex];

    // Check if ready
    if (!card.isReady || card.isDamaged) return false;

    // Check cost
    const player = this.state.players[playerId];
    if (player.water < ability.cost) return false;

    // Pay cost
    player.water -= ability.cost;

    // Execute ability
    this.executeAbility(ability, {
      source: card,
      playerId,
      columnIndex,
      position,
    });

    // Mark as used
    card.isReady = false;
    this.state.turnEvents.abilityUsedThisTurn = true;

    return true;
  }

  executeAbility(ability, context) {
    // Get ability handler
    const handler = this.getAbilityHandler(context.source.name, ability.effect);

    if (handler) {
      handler(this.state, context);
    } else {
      // Generic ability handling
      this.handleGenericAbility(ability, context);
    }
  }

  handleSelectTarget(payload) {
    if (!this.state.pending) return false;

    const { targetPlayer, targetColumn, targetPosition } = payload;

    // Route to appropriate handler based on pending type
    switch (this.state.pending.type) {
      case "damage":
        return this.resolveDamage(targetPlayer, targetColumn, targetPosition);
      case "injure":
        return this.resolveInjure(targetPlayer, targetColumn, targetPosition);
      case "restore":
        return this.resolveRestore(targetPlayer, targetColumn, targetPosition);
      case "place_punk":
        return this.resolvePlacePunk(targetColumn, targetPosition);
      default:
        return false;
    }
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
          context,
        };
        break;
      case "extra_water":
        this.state.players[context.playerId].water += 1;
        break;
      case "raid":
        this.executeRaid(context.playerId);
        break;
    }
  }

  executeRaid(playerId) {
    const player = this.state.players[playerId];

    if (player.raiders === "available") {
      // Place raiders in queue
      const slotIndex = this.findEventSlot(playerId, 2);
      if (slotIndex !== -1) {
        player.eventQueue[slotIndex] = {
          id: `${playerId}_raiders`,
          name: "Raiders",
          isRaiders: true,
          queuePosition: 2,
        };
        player.raiders = "in_queue";
      }
    } else if (player.raiders === "in_queue") {
      // Advance raiders
      this.advanceRaiders(playerId);
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

    // Process events phase
    this.processEventsPhase();

    return true;
  }

  processEventsPhase() {
    // Process event queue
    const player = this.state.players[this.state.currentPlayer];

    // Resolve slot 1 event
    // Advance other events
    // Then move to replenish phase

    setTimeout(() => {
      this.state.phase = "replenish";
      this.processReplenishPhase();
    }, 1000);
  }

  processReplenishPhase() {
    const player = this.state.players[this.state.currentPlayer];

    // Draw card
    if (this.state.deck.length > 0) {
      player.hand.push(this.state.deck.shift());
    }

    // Reset water
    player.water = 3;

    // Ready all undamaged cards
    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (card && !card.isDamaged) {
          card.isReady = true;
        }
      }
    }

    // Move to actions phase
    this.state.phase = "actions";
    this.notifyUI("PHASE_CHANGE", "actions");
  }
}
