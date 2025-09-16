import { CONSTANTS } from "../core/constants.js";

export class UIRenderer {
  constructor(state, commands) {
    this.state = state;
    this.commands = commands;
    this.selectedCard = null;
    this.container = null;
  }

  render() {
    if (this.state.pending) {
      document.body.classList.add("has-pending");
    } else {
      document.body.classList.remove("has-pending");
    }
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

    if (this.state.pending) {
      const overlay = this.createElement("div", "pending-overlay");
      const message = this.createElement("div", "pending-message-banner");

      switch (this.state.pending.type) {
        case "raiders_select_camp":
          // Show which player needs to act
          if (this.state.pending.targetPlayerId === this.state.currentPlayer) {
            message.textContent =
              "⚔️ RAIDERS ATTACK! Choose one of YOUR camps to damage";
            overlay.classList.add("raiders-attack-self");
          } else {
            message.textContent = `⏳ Waiting for ${this.state.pending.targetPlayerId.toUpperCase()} to choose a camp...`;
            overlay.classList.add("raiders-waiting");
          }
          break;
        case "place_punk":
          message.textContent = "📍 Click any slot to place a PUNK";
          overlay.classList.add("punk-placement");
          break;
        case "junk_restore":
          message.textContent = "🔧 Select a damaged card to RESTORE";
          overlay.classList.add("restore-selection");
          break;
        case "junk_injure":
          message.textContent =
            "⚔️ Select an unprotected enemy person to INJURE";
          overlay.classList.add("injure-selection");
          break;
        case "damage":
        case "looter_damage":
          message.textContent = "💥 Select target for DAMAGE";
          overlay.classList.add("damage-selection");
          break;
      }

      if (message.textContent) {
        overlay.appendChild(message);
        gameArea.appendChild(overlay);
      }
    }

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

    // For left player, render slots in reverse order (3, 2, 1)
    // For right player, render in normal order (1, 2, 3)
    const slotOrder = playerId === "left" ? [2, 1, 0] : [0, 1, 2];

    slotOrder.forEach((i) => {
      const slot = this.createElement("div", "event-slot");

      // Add slot number (visual number, not array index)
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
    });

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

      // Make it clickable if it's the player's turn
      if (
        this.state.currentPlayer === playerId &&
        this.state.phase === "actions" &&
        !this.state.pending
      ) {
        waterSilo.classList.add("clickable");
        waterSilo.title = "Click to take (1💧)";

        waterSilo.addEventListener("click", () => {
          if (this.state.pending) {
            console.log("Complete current action first");
            return;
          }

          this.commands.execute({
            type: "TAKE_WATER_SILO",
            playerId: playerId,
            payload: { playerId: playerId },
          });
        });
      }
    } else if (player.waterSilo === "in_hand") {
      waterSilo.classList.add("in-hand");
      waterSilo.textContent = "Water Silo (in hand)";
    } else {
      waterSilo.classList.add("used");
    }

    specialCards.appendChild(waterSilo);

    return specialCards; // MAKE SURE THIS LINE EXISTS!
  }

  renderColumns(player, playerId) {
    const camps = this.createElement("div", "camps");

    for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
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

    cardDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      // Block junking during pending actions
      if (this.state.pending) {
        console.log("Complete current action before junking cards");
        return;
      }

      if (
        this.state.currentPlayer === playerId &&
        this.state.phase === "actions"
      ) {
        this.commands.execute({
          type: "JUNK_CARD",
          playerId: playerId,
          payload: {
            playerId: playerId,
            cardIndex: index,
          },
        });
      }
    });

    // Add a slot index badge
    const slotBadge = this.createElement("div", "slot-badge");
    const globalSlotIndex = columnIndex * 3 + position;
    slotBadge.textContent = globalSlotIndex;
    cardDiv.appendChild(slotBadge);

    // Add targeting highlight for damage abilities
    if (this.state.pending?.type?.includes("damage")) {
      const isValidTarget = this.canTargetForDamage(
        playerId,
        columnIndex,
        position
      );
      if (isValidTarget) {
        cardDiv.classList.add("damage-target");
      }
    }

    if (this.state.pending?.type === "mimic_select_target") {
      const isValidMimicTarget = this.state.pending.validTargets.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidMimicTarget) {
        cardDiv.classList.add("mimic-target");
      }
    }

    if (this.state.pending?.type === "raiders_select_camp") {
      // Highlight camps that belong to the target player
      if (
        playerId === this.state.pending.targetPlayerId &&
        position === 0 &&
        card?.type === "camp" &&
        !card.isDestroyed
      ) {
        cardDiv.classList.add("raiders-target-camp");
      }
    }

    // Highlighting for junk effects:
    if (this.state.pending?.type === "junk_injure") {
      // Highlight valid injure targets
      if (
        playerId !== this.state.pending.sourcePlayerId &&
        card?.type === "person" &&
        !this.state.players[playerId].columns[columnIndex].isProtected(position)
      ) {
        cardDiv.classList.add("junk-injure-target");
      }
    }

    if (this.state.pending?.type === "junk_restore") {
      // Highlight damaged cards
      if (card?.isDamaged) {
        cardDiv.classList.add("junk-restore-target");
      }
    }

    if (this.state.pending?.type === "place_punk") {
      // Highlight valid placement slots (any slot, empty or occupied)
      if (playerId === this.state.pending.sourcePlayerId) {
        cardDiv.classList.add("punk-placement-target");
      }
    }

    if (!card) {
      cardDiv.classList.add("empty");
      const label = this.createElement("div");
      label.textContent = "Empty";
      cardDiv.appendChild(label);

      // Make empty slots clickable for placing cards
      cardDiv.addEventListener("click", () => {
        // Handle punk placement from junk effect
        if (
          this.state.pending?.type === "place_punk" &&
          playerId === this.state.pending.sourcePlayerId
        ) {
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }
        // Handle Parachute Base placement
        if (
          this.state.pending?.type === "parachute_place_person" &&
          playerId === this.state.pending.sourcePlayerId
        ) {
          this.commands.execute({
            type: "SELECT_TARGET",
            targetType: "slot",
            playerId: playerId,
            columnIndex: columnIndex,
            position: position,
          });
        } else {
          // Normal slot click handling
          this.handleCardSlotClick(playerId, columnIndex, position);
        }
      });
    } else {
      // THIS is where card type checking should be - when card EXISTS
      if (card.type === "camp") {
        cardDiv.classList.add("camp");
      } else if (card.type === "person") {
        cardDiv.classList.add("person");
      }

      // Add state classes - handle them separately by type
      if (card.isDamaged) cardDiv.classList.add("damaged");
      if (card.isDestroyed) cardDiv.classList.add("destroyed");

      // Only person cards can be not-ready from damage
      // Camps can be not-ready from using abilities, but that's different
      if (card.type === "person" && !card.isReady) {
        cardDiv.classList.add("not-ready");
      }
      // Camps should NEVER get the visual not-ready class even if isReady is false

      // Card name
      const name = this.createElement("div", "card-name");
      name.textContent = card.name;
      cardDiv.appendChild(name);

      // Add abilities if any
      if (card.abilities && card.abilities.length > 0) {
        const abilities = this.createElement("div", "ability-info");

        card.abilities.forEach((ability, index) => {
          // Different ready conditions for camps vs people
          let canUseAbility = false;

          if (card.type === "camp") {
            canUseAbility = card.isReady && !card.isDestroyed;
          } else if (card.type === "person") {
            canUseAbility =
              card.isReady && !card.isDamaged && !card.isDestroyed;
          }

          // BLOCK ALL ABILITIES IF THERE'S ANY PENDING ACTION
          if (
            canUseAbility &&
            playerId === this.state.currentPlayer &&
            !this.state.pending // This already exists but make sure it's checked
          ) {
            const btn = this.createElement("button", "ability-btn");
            btn.textContent = `${ability.effect} (${ability.cost}💧)`;
            btn.addEventListener("click", (e) => {
              e.stopPropagation();

              // Double-check pending state at click time
              if (this.state.pending) {
                console.log("Action in progress - please complete it first");
                return;
              }

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
            // Show disabled ability text
            const text = this.createElement("span", "ability-text-disabled");
            text.textContent = `${ability.effect} (${ability.cost}💧)`;

            // Add specific reason for blocking
            if (this.state.pending) {
              text.textContent += " [Action in Progress]";
            } else if (card.type === "person") {
              if (!card.isReady) text.textContent += " [Not Ready]";
              if (card.isDamaged) text.textContent += " [Damaged]";
            } else if (card.type === "camp") {
              if (!card.isReady) text.textContent += " [Used]";
              if (card.isDestroyed) text.textContent += " [Destroyed]";
            }

            if (playerId !== this.state.currentPlayer && !this.state.pending) {
              text.textContent += " [Not Your Turn]";
            }

            abilities.appendChild(text);
          }
        });

        cardDiv.appendChild(abilities);
      }

      // Make cards clickable for multiple purposes
      cardDiv.addEventListener("click", (e) => {
        e.stopPropagation();

        // First priority: handle pending targeting
        if (this.state.pending) {
          this.handleCardTargetClick(playerId, columnIndex, position);
          return;
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

  canTargetForDamage(playerId, columnIndex, position) {
    if (!this.state.pending) return false;

    // Can't damage own cards (this includes the source card itself)
    if (playerId === this.state.pending.sourcePlayerId) return false;

    const card = this.state.getCard(playerId, columnIndex, position);
    if (!card || card.isDestroyed) return false;

    // Check protection (unless ability ignores it, like Sniper)
    const column = this.state.players[playerId].columns[columnIndex];
    if (!this.state.pending.allowProtected && column.isProtected(position)) {
      return false;
    }

    return true;
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

      // Handle Parachute Base selection - use cardDiv, not cardEl
      if (
        this.state.pending?.type === "parachute_select_person" &&
        this.state.pending.validPeople.includes(card.id) &&
        playerId === this.state.pending.sourcePlayerId
      ) {
        cardDiv.classList.add("parachute-target");
        cardDiv.onclick = () => {
          this.commands.execute({
            type: "SELECT_TARGET",
            targetType: "hand_card",
            cardId: card.id,
            playerId: playerId,
          });
        };
      } else {
        // Normal card click handling (only if not in Parachute Base mode)
        cardDiv.addEventListener("click", () => {
          if (this.state.currentPlayer === playerId) {
            // If this card is already selected, deselect it
            if (this.selectedCard?.card?.id === card.id) {
              this.selectedCard = null;
            } else {
              // Select by card ID, not index
              this.selectedCard = { playerId, card, cardId: card.id };
            }
            this.render();
          }
        });
      }

      // Card name, cost, and junk effect
      const cardText = document.createElement("div");
      cardText.className = "card-text";
      cardText.textContent = `${card.name} (${card.cost}💧)`;
      cardDiv.appendChild(cardText);

      // Junk effect indicator
      if (card.junkEffect) {
        const junk = this.createElement("span", "junk-label");
        // Capitalize first letter of effect name
        const effectName =
          card.junkEffect.charAt(0).toUpperCase() + card.junkEffect.slice(1);
        junk.textContent = ` [Junk: ${effectName}]`;
        cardDiv.appendChild(junk);
      }

      // Check if selected
      if (this.selectedCard?.card?.id === card.id) {
        cardDiv.classList.add("selected");
      }

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
            payload: {
              // ADD THIS PAYLOAD WRAPPER
              playerId: playerId,
              cardIndex: index,
            },
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
    // Check if pending still exists
    if (!this.state.pending) {
      console.log("Pending state already cleared, ignoring click");
      return;
    }

    this.commands.execute({
      type: "SELECT_TARGET",
      targetPlayer: playerId,
      targetColumn: columnIndex,
      targetPosition: position,
    });
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
