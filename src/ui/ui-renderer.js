export class UIRenderer {
  constructor(state, commands) {
    this.state = state;
    this.commands = commands;
    this.selectedCard = null;
    this.container = null;
  }

  render() {
    // Get or create main container
    if (!this.container) {
      this.container = document.getElementById("app");
      if (!this.container) {
        console.error("App container not found");
        return;
      }
    }

    // Clear and rebuild
    this.container.innerHTML = "";

    // Create main game container
    const gameContainer = this.createElement("div", "container");

    // Add title
    const title = this.createElement("h1");
    title.textContent = "Radlands";
    gameContainer.appendChild(title);

    // Add game info bar
    gameContainer.appendChild(this.renderGameInfo());

    // Add main game area
    gameContainer.appendChild(this.renderGameArea());

    // Add controls
    gameContainer.appendChild(this.renderControls());

    // Add action log
    gameContainer.appendChild(this.renderActionLog());

    this.container.appendChild(gameContainer);
  }

  renderGameInfo() {
    const infoBar = this.createElement("div", "game-info");

    // Current player indicator
    const currentPlayer = this.createElement("div", "info-item current-turn");
    currentPlayer.textContent = `Current: ${this.state.currentPlayer.toUpperCase()}`;
    infoBar.appendChild(currentPlayer);

    // Phase indicator
    const phase = this.createElement(
      "div",
      `info-item phase-indicator phase-${this.state.phase}`
    );
    phase.textContent = `Phase: ${this.state.phase}`;
    infoBar.appendChild(phase);

    // Turn number
    const turn = this.createElement("div", "info-item");
    turn.textContent = `Turn: ${this.state.turnNumber}`;
    infoBar.appendChild(turn);

    return infoBar;
  }

  renderGameArea() {
    const gameArea = this.createElement("div", "game-area");

    // Render left player's board
    gameArea.appendChild(this.renderPlayerBoard("left"));

    // Render central deck area
    gameArea.appendChild(this.renderCentralArea());

    // Render right player's board
    gameArea.appendChild(this.renderPlayerBoard("right"));

    return gameArea;
  }

  renderPlayerBoard(playerId) {
    const player = this.state.players[playerId];
    const board = this.createElement("div", "player-board");

    if (this.state.currentPlayer === playerId) {
      board.classList.add("active");
    }

    // Player header
    const header = this.createElement("div", "player-header");

    const name = this.createElement("div", "player-name");
    name.textContent = playerId.toUpperCase();
    header.appendChild(name);

    const water = this.createElement("div", "water");
    water.textContent = `Water: ${player.water}`;
    header.appendChild(water);

    board.appendChild(header);

    // Event queue
    board.appendChild(this.renderEventQueue(player, playerId));

    // Special cards (Raiders & Water Silo)
    board.appendChild(this.renderSpecialCards(player, playerId));

    // Camps and columns
    board.appendChild(this.renderColumns(player, playerId));

    // Hand
    board.appendChild(this.renderHand(player, playerId));

    return board;
  }

  renderEventQueue(player, playerId) {
    const queue = this.createElement("div", "event-queue");

    for (let i = 0; i < 3; i++) {
      const slot = this.createElement("div", "event-slot");

      // Add slot number
      const slotNumber = this.createElement("div", "event-slot-number");
      slotNumber.textContent = i + 1;
      slot.appendChild(slotNumber);

      // Add event if present
      const event = player.eventQueue[i];
      if (event) {
        const eventCard = this.createElement("div", "event-card");
        eventCard.textContent = event.name;
        slot.appendChild(eventCard);
      }

      queue.appendChild(slot);
    }

    return queue;
  }

  renderSpecialCards(player, playerId) {
    const specialCards = this.createElement("div", "special-cards");

    // Raiders
    const raiders = this.createElement("div", "special-card");
    raiders.textContent = "Raiders";
    if (player.raiders === "available") {
      raiders.classList.add("available");
    } else if (player.raiders === "in_queue") {
      raiders.classList.add("in-queue");
    } else {
      raiders.classList.add("used");
    }
    specialCards.appendChild(raiders);

    // Water Silo
    const waterSilo = this.createElement("div", "special-card");
    waterSilo.textContent = "Water Silo";
    if (player.waterSilo === "available") {
      waterSilo.classList.add("available");
      waterSilo.addEventListener("click", () => {
        if (
          this.state.currentPlayer === playerId &&
          this.state.phase === "actions"
        ) {
          this.commands.execute({
            type: "TAKE_WATER_SILO",
            playerId: playerId,
          });
        }
      });
    } else if (player.waterSilo === "in_hand") {
      waterSilo.classList.add("in-hand");
    } else {
      waterSilo.classList.add("used");
    }
    specialCards.appendChild(waterSilo);

    return specialCards;
  }

  renderColumns(player, playerId) {
    const camps = this.createElement("div", "camps");

    for (let col = 0; col < 3; col++) {
      const column = player.columns[col];
      const columnDiv = this.createElement("div", "camp-column");

      // Still iterate 0 to 2, but CSS will flip the visual display
      for (let pos = 0; pos < 3; pos++) {
        const card = column.getCard(pos);
        const cardDiv = this.renderCard(card, playerId, col, pos);
        columnDiv.appendChild(cardDiv);
      }

      camps.appendChild(columnDiv);
    }

    return camps;
  }

  renderCard(card, playerId, columnIndex, position) {
    const cardDiv = this.createElement("div", "card");

    // Add a slot index badge
    const slotBadge = this.createElement("div", "slot-badge");
    const globalSlotIndex = columnIndex * 3 + position;
    slotBadge.textContent = globalSlotIndex;
    cardDiv.appendChild(slotBadge);

    if (!card) {
      cardDiv.classList.add("empty");
      const label = this.createElement("div");
      label.textContent = position === 0 ? "Camp Slot" : "Empty";
      cardDiv.appendChild(label);

      // Make empty slots clickable for placing cards
      cardDiv.addEventListener("click", () => {
        this.handleCardSlotClick(playerId, columnIndex, position);
      });
    } else {
      // Add card type class
      cardDiv.classList.add(card.type);

      // Add state classes
      if (card.isDamaged) cardDiv.classList.add("damaged");
      if (card.isDestroyed) cardDiv.classList.add("destroyed");
      if (card.isReady === false) cardDiv.classList.add("not-ready");

      // Card name
      const name = this.createElement("div", "card-name");
      name.textContent = card.name;
      cardDiv.appendChild(name);

      // Add abilities if any
      if (card.abilities && card.abilities.length > 0) {
        const abilities = this.createElement("div", "ability-info");

        card.abilities.forEach((ability, index) => {
          // Only show ability button if card is ready and belongs to current player
          if (
            card.isReady &&
            !card.isDamaged &&
            !card.isDestroyed &&
            playerId === this.state.currentPlayer
          ) {
            const btn = this.createElement("button", "ability-btn");
            btn.textContent = `${ability.effect} (${ability.cost}💧)`;
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              this.commands.execute({
                type: "USE_ABILITY",
                playerId: playerId,
                payload: {
                  playerId: playerId,
                  columnIndex: columnIndex,
                  position: position,
                  abilityIndex: index,
                },
              });
            });
            abilities.appendChild(btn);
          } else {
            // Show disabled ability text if not usable
            const text = this.createElement("span", "ability-text-disabled");
            text.textContent = `${ability.effect} (${ability.cost}💧)`;
            if (!card.isReady) text.textContent += " [Not Ready]";
            if (card.isDamaged) text.textContent += " [Damaged]";
            if (playerId !== this.state.currentPlayer)
              text.textContent += " [Not Your Turn]";
            abilities.appendChild(text);
          }
        });

        cardDiv.appendChild(abilities);
      }

      // Make cards clickable for multiple purposes
      cardDiv.addEventListener("click", () => {
        // First priority: handle pending targeting
        if (this.state.pending) {
          this.handleCardTargetClick(playerId, columnIndex, position);
        }
        // Second priority: handle card placement if we have a person selected
        else if (
          this.selectedCard?.card?.type === "person" &&
          playerId === this.state.currentPlayer
        ) {
          // Allow clicking on ANY position (empty or occupied) in your own tableau
          this.handleCardSlotClick(playerId, columnIndex, position);
        }
      });
    }

    return cardDiv;
  }
  renderHand(player, playerId) {
    const hand = this.createElement("div", "hand");

    player.hand.forEach((card, index) => {
      const cardDiv = this.createElement("div", "hand-card");

      if (
        this.selectedCard?.playerId === playerId &&
        this.selectedCard?.index === index
      ) {
        cardDiv.classList.add("selected");
      }

      // Card name and cost
      cardDiv.textContent = `${card.name} (${card.cost}💧)`;

      // Add junk effect indicator
      if (card.junkEffect) {
        const junk = this.createElement("span", "junk-label");
        junk.textContent = ` [Junk: ${card.junkEffect}]`;
        cardDiv.appendChild(junk);
      }

      // Click to select for playing
      cardDiv.addEventListener("click", () => {
        if (this.state.currentPlayer === playerId) {
          this.selectedCard = { playerId, index, card };
          this.render(); // Re-render to show selection
        }
      });

      // Right-click to junk
      cardDiv.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (
          this.state.currentPlayer === playerId &&
          this.state.phase === "actions"
        ) {
          this.commands.execute({
            type: "JUNK_CARD",
            playerId: playerId,
            cardIndex: index,
          });
        }
      });

      hand.appendChild(cardDiv);
    });

    return hand;
  }

  renderCentralArea() {
    const central = this.createElement("div", "central-column");

    // Draw deck
    const deckArea = this.createElement("div", "deck-area");
    const deckLabel = this.createElement("div", "deck-label");
    deckLabel.textContent = "DRAW DECK";
    deckArea.appendChild(deckLabel);

    const drawDeck = this.createElement("div", "deck-pile draw-deck");
    drawDeck.textContent = this.state.deck?.length || "0";
    drawDeck.addEventListener("click", () => {
      if (this.state.phase === "actions") {
        this.commands.execute({
          type: "DRAW_CARD",
          playerId: this.state.currentPlayer,
        });
      }
    });
    deckArea.appendChild(drawDeck);

    const deckCount = this.createElement("div", "deck-count");
    deckCount.textContent = `${this.state.deck?.length || 0} cards`;
    deckArea.appendChild(deckCount);

    central.appendChild(deckArea);

    // Discard pile
    const discardArea = this.createElement("div", "deck-area");
    const discardLabel = this.createElement("div", "deck-label");
    discardLabel.textContent = "DISCARD";
    discardArea.appendChild(discardLabel);

    const discardPile = this.createElement("div", "deck-pile discard-pile");
    discardPile.textContent = this.state.discard?.length || "0";
    discardArea.appendChild(discardPile);

    const discardCount = this.createElement("div", "deck-count");
    discardCount.textContent = `${this.state.discard?.length || 0} cards`;
    discardArea.appendChild(discardCount);

    central.appendChild(discardArea);

    return central;
  }

  renderControls() {
    const controls = this.createElement("div", "controls");

    // End Turn button
    const endTurn = this.createElement("button");
    endTurn.textContent = "End Turn";
    endTurn.disabled =
      this.state.phase !== "actions" || this.state.pending !== null;
    endTurn.addEventListener("click", () => {
      this.commands.execute({
        type: "END_TURN",
        playerId: this.state.currentPlayer,
      });
    });
    controls.appendChild(endTurn);

    // Cancel button (for pending actions)
    if (this.state.pending) {
      const cancel = this.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        this.state.pending = null;
        this.render();
      });
      controls.appendChild(cancel);
    }

    return controls;
  }

  renderActionLog() {
    const log = this.createElement("div", "action-log");
    // We'll implement proper logging later
    log.textContent = "Action log will appear here...";
    return log;
  }

  // Helper methods
  createElement(tag, className) {
    const element = document.createElement(tag);
    if (className) {
      className.split(" ").forEach((cls) => element.classList.add(cls));
    }
    return element;
  }

  handleCardSlotClick(playerId, columnIndex, position) {
    // Handle placing a selected card
    if (
      this.selectedCard &&
      this.selectedCard.playerId === this.state.currentPlayer &&
      playerId === this.state.currentPlayer // Can only play to your own tableau
    ) {
      const card = this.selectedCard.card;

      if (card.type === "person") {
        this.commands.execute({
          type: "PLAY_CARD",
          playerId: this.state.currentPlayer,
          payload: {
            playerId: this.state.currentPlayer,
            cardId: card.id,
            targetColumn: columnIndex,
            targetPosition: position, // Use the CLICKED position, not an empty one
          },
        });
        this.selectedCard = null;
      }
    }
  }

  handleCardTargetClick(playerId, columnIndex, position) {
    // Handle targeting for pending abilities
    if (this.state.pending) {
      this.commands.execute({
        type: "SELECT_TARGET",
        targetPlayer: playerId,
        targetColumn: columnIndex,
        targetPosition: position,
      });
    }
  }

  handleAbilityClick(playerId, columnIndex, position, abilityIndex) {
    if (
      playerId === this.state.currentPlayer &&
      this.state.phase === "actions"
    ) {
      this.commands.execute({
        type: "USE_ABILITY",
        playerId: playerId,
        columnIndex: columnIndex,
        position: position,
        abilityIndex: abilityIndex,
      });
    }
  }
}
