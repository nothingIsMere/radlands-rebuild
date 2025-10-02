import { CONSTANTS } from "../core/constants.js";

export class UIRenderer {
  constructor(state, commands) {
    this.state = state;
    this.commands = commands;
    this.selectedCard = null;
    this.container = null;
  }

  isMyTurn() {
    // Check if we know our player ID and if it's our turn
    if (!window.networkClient || !window.networkClient.myPlayerId) {
      return true; // Default to allowing interaction if not connected
    }
    return this.state.currentPlayer === window.networkClient.myPlayerId;
  }

  renderGameOver() {
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay";
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    const modal = document.createElement("div");
    modal.className = "game-over-modal";
    modal.style.cssText = `
    background: white;
    padding: 40px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
    max-width: 500px;
  `;

    const title = document.createElement("h1");
    title.style.cssText = `
    margin: 0 0 20px 0;
    color: #333;
    font-size: 48px;
  `;

    const message = document.createElement("p");
    message.style.cssText = `
    font-size: 24px;
    margin: 20px 0;
    color: #666;
  `;

    const reason = document.createElement("p");
    reason.style.cssText = `
    font-size: 18px;
    color: #999;
    font-style: italic;
  `;

    if (this.state.winner === "draw") {
      title.textContent = "🤝 DRAW!";
      message.textContent = "The game ends in a draw!";
      reason.textContent = "The deck was exhausted twice";
    } else {
      const winnerName =
        this.state.winner === "left" ? "Left Player" : "Right Player";
      title.textContent = "🏆 GAME OVER!";
      message.textContent = `${winnerName} wins!`;

      switch (this.state.winReason) {
        case "obelisk":
          reason.textContent = "Victory by Obelisk - deck exhausted";
          break;
        case "camps_destroyed":
          reason.textContent = "Victory by destroying all enemy camps";
          break;
        default:
          reason.textContent = "";
      }
    }

    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(reason);
    overlay.appendChild(modal);

    return overlay;
  }

  render() {
    console.log("UI render called, pending state:", this.state.pending);

    // Get or create main container
    if (!this.container) {
      this.container = document.getElementById("app");
      if (!this.container) {
        console.error("App container not found");
        return;
      }
    }

    // Clear container
    this.container.innerHTML = "";

    // Check for game over FIRST
    if (this.state.phase === "game_over") {
      // Remove pending class since game is over
      document.body.classList.remove("has-pending");

      // Create dimmed background with game state
      const gameContainer = this.createElement("div", "container");
      gameContainer.style.opacity = "0.3";
      gameContainer.style.pointerEvents = "none";

      // Add title
      const title = this.createElement("h1");
      title.textContent = "Radlands";
      gameContainer.appendChild(title);

      // Add game info bar
      gameContainer.appendChild(this.renderGameInfo());

      // Add main game area (frozen state)
      gameContainer.appendChild(this.renderGameArea());

      // Append dimmed game state
      this.container.appendChild(gameContainer);

      // Add game over overlay
      const gameOverOverlay = this.renderGameOver();
      this.container.appendChild(gameOverOverlay);

      return; // Stop here - no interactive elements
    }

    // Normal game rendering (not game over)
    if (this.state.pending) {
      document.body.classList.add("has-pending");
    } else {
      document.body.classList.remove("has-pending");
    }

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

    // Add ability selection modal if needed
    const abilityModal = this.renderAbilitySelection();
    console.log("Modal returned from renderAbilitySelection:", abilityModal);
    if (abilityModal) {
      console.log("Appending modal to gameContainer");
      gameContainer.appendChild(abilityModal);
    } else {
      console.log("No modal to append");
    }

    // Add controls
    gameContainer.appendChild(this.renderControls());

    // Add action log
    gameContainer.appendChild(this.renderActionLog());

    this.container.appendChild(gameContainer);
  }

  handleEventPlacement(playerId, slotClicked) {
    console.log("Event placement clicked:", playerId, slotClicked);
    console.log("Selected card:", this.selectedCard);

    if (!this.selectedCard || this.selectedCard.cardType !== "event") {
      console.log("No event selected or wrong type");
      return;
    }

    const eventCard = this.selectedCard.card;
    console.log("Playing event:", eventCard.name);

    // Execute PLAY_CARD command for the event
    this.commands.execute({
      type: "PLAY_CARD",
      playerId: playerId,
      payload: {
        playerId: playerId,
        cardId: eventCard.id,
        targetColumn: null,
        targetPosition: null,
      },
    });

    // Clear selection
    this.selectedCard = null;
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

    if (this.state.turnEvents?.highGroundActive) {
      const highGroundIndicator = this.createElement(
        "div",
        "highground-active"
      );
      highGroundIndicator.textContent =
        "⚔️ HIGH GROUND ACTIVE - All opponent cards are UNPROTECTED!";
      infoBar.appendChild(highGroundIndicator);
    }

    return infoBar;
  }

  renderGameArea() {
    const gameArea = this.createElement("div", "game-area");

    if (this.state.pending) {
      const overlay = this.createElement("div", "pending-overlay");
      const message = this.createElement("div", "pending-message-banner");

      switch (this.state.pending.type) {
        case "bonfire_restore_multiple":
          const restored = this.state.pending.restoredCards.length;
          const remaining = this.state.pending.validTargets.length;
          if (restored === 0) {
            message.textContent = `🔥 Bonfire: Select cards to restore (${remaining} available)`;
          } else {
            message.textContent = `🔥 Bonfire: ${restored} restored. Select more or click Finish (${remaining} remaining)`;
          }
          overlay.classList.add("bonfire-restoration");
          break;

        case "octagon_opponent_destroy":
          // Show which player needs to act
          if (this.state.pending.targetPlayerId === this.state.currentPlayer) {
            message.textContent =
              "⚔️ THE OCTAGON: You MUST destroy one of YOUR people!";
            overlay.classList.add("octagon-forced");
          } else {
            message.textContent = `⏳ Waiting for ${this.state.pending.targetPlayerId.toUpperCase()} to destroy one of their people...`;
            overlay.classList.add("octagon-waiting");
          }
          break;

        case "scudlauncher_select_target":
          // Show which player needs to act
          if (this.state.pending.targetPlayerId === this.state.currentPlayer) {
            message.textContent =
              "🚀 SCUD LAUNCHER! Choose one of YOUR cards to damage";
            overlay.classList.add("scudlauncher-self");
          } else {
            message.textContent = `⏳ Waiting for ${this.state.pending.targetPlayerId.toUpperCase()} to choose a card to damage...`;
            overlay.classList.add("scudlauncher-waiting");
          }
          break;

        case "atomic_garden_restore":
          message.textContent =
            "🌱 Select a damaged person to restore AND ready";
          overlay.classList.add("restore-selection");
          break;

        case "highground_place_person":
          const personName = this.state.pending.selectedPerson.name;

          if (remaining > 0) {
            message.textContent = `⚔️ High Ground: Place ${personName} (${remaining} more after this)`;
          } else {
            message.textContent = `⚔️ High Ground: Place ${personName} (last one!)`;
          }
          overlay.classList.add("highground-placement");
          break;

        case "famine_select_keep":
          const selectingPlayer = this.state.pending.currentSelectingPlayer;
          if (selectingPlayer === this.state.currentPlayer) {
            message.textContent =
              "☠️ FAMINE: Choose ONE person to keep (all others will be destroyed!)";
          } else {
            message.textContent = `⏳ Waiting for ${selectingPlayer.toUpperCase()} to choose which person to keep...`;
          }
          overlay.classList.add("famine-selection");
          break;

        case "uprising_place_punks":
          const punksLeft = this.state.pending.punksRemaining;
          if (punksLeft === 1) {
            message.textContent = "🎯 Uprising: Place your LAST punk";
          } else {
            message.textContent = `🎯 Uprising: Place a punk (${punksLeft} left to place)`;
          }
          overlay.classList.add("uprising-placement");
          break;

        case "cultleader_select_destroy":
          message.textContent =
            "💀 Cult Leader: Select one of YOUR people to destroy";
          overlay.classList.add("cultleader-selection");
          break;

        case "cultleader_damage":
          message.textContent =
            "💥 Cult Leader: Now select enemy target to damage";
          overlay.classList.add("damage-selection");
          break;
        case "parachute_select_ability":
          message.textContent = `🪂 Select which ${this.state.pending.person.name} ability to use`;
          overlay.classList.add("ability-selection");
          break;

        case "mimic_select_ability":
          message.textContent = `🎭 Select which ${this.state.pending.targetCard.name} ability to copy`;
          overlay.classList.add("ability-selection");
          break;
        case "molgur_destroy_camp":
          message.textContent =
            "💀 Molgur Stang: Select ANY enemy camp to DESTROY (ignores protection)";
          overlay.classList.add("molgur-selection");
          break;

        case "pyromaniac_damage":
          message.textContent = "🔥 Select an unprotected enemy camp to damage";
          overlay.classList.add("pyromaniac-selection");
          break;
        case "sniper_damage":
          message.textContent =
            "🎯 Sniper: Select ANY enemy card to damage (ignores protection)";
          overlay.classList.add("sniper-selection");
          break;

        case "assassin_destroy":
          message.textContent =
            "💀 Select an unprotected enemy person to DESTROY";
          overlay.classList.add("assassin-selection");
          break;

        case "repair_bot_entry_restore":
          message.textContent =
            "🔧 Repair Bot: Select a damaged card to RESTORE";
          overlay.classList.add("restore-selection");
          break;

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

        case "parachute_place_person":
          // Calculate costs for each column to show in message
          const costs = [];
          for (let col = 0; col < 3; col++) {
            const cost =
              this.commands.state.commandSystem?.getAdjustedCost?.(
                this.state.pending.selectedPerson,
                col,
                this.state.pending.sourcePlayerId
              ) || this.state.pending.selectedPerson.cost;

            if (this.state.pending.selectedPerson.name === "Holdout") {
              const camp =
                this.state.players[this.state.pending.sourcePlayerId].columns[
                  col
                ].getCard(0);
              if (camp?.isDestroyed) {
                costs.push(`Col ${col}: FREE`);
              } else {
                costs.push(`Col ${col}: ${cost}💧`);
              }
            }
          }

          if (costs.some((c) => c.includes("FREE"))) {
            message.textContent = `🪂 Place ${
              this.state.pending.selectedPerson.name
            } (${costs.join(", ")})`;
          } else {
            message.textContent = `🪂 Place ${this.state.pending.selectedPerson.name} (costs ${this.state.pending.selectedPerson.cost}💧)`;
          }
          overlay.classList.add("parachute-placement");
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

    console.log(`Rendering ${playerId} event queue:`, player.eventQueue);

    // Check if player has an event card selected
    const hasEventSelected =
      this.selectedCard?.cardType === "event" &&
      this.selectedCard?.playerId === playerId &&
      this.state.currentPlayer === playerId &&
      this.state.phase === "actions" &&
      !this.state.pending;

    console.log("Has event selected?", hasEventSelected);
    console.log("Selected card details:", this.selectedCard);

    const slotOrder = playerId === "left" ? [2, 1, 0] : [0, 1, 2];

    slotOrder.forEach((i) => {
      const slot = this.createElement("div", "event-slot");

      // Make slot clickable if event selected
      if (hasEventSelected) {
        slot.classList.add("event-slot-clickable");
        slot.style.cursor = "pointer"; // Make it visually obvious
        slot.title = "Click to play event here";

        slot.addEventListener("click", (e) => {
          if (this.state.phase === "game_over") return;
          e.stopPropagation();
          console.log("Event slot clicked!", i);
          this.handleEventPlacement(playerId, i);
        });
      }

      // Rest of the slot rendering...
      const slotNumber = this.createElement("div", "event-slot-number");
      slotNumber.textContent = i + 1;
      slot.appendChild(slotNumber);

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

      // Make it clickable if it's this player's Water Silo AND it's their turn
      if (
        playerId === window.networkClient?.myPlayerId &&
        this.state.currentPlayer === playerId &&
        this.state.phase === "actions" &&
        !this.state.pending
      ) {
        waterSilo.classList.add("clickable");
        waterSilo.title = "Click to take (1💧)";

        waterSilo.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
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
    if (this.state.pending?.type === "parachute_place_person") {
    }
    const cardDiv = this.createElement("div", "card");

    if (this.state.pending?.type === "scudlauncher_select_target") {
      // Highlight cards that belong to the target player
      if (
        playerId === this.state.pending.targetPlayerId &&
        card &&
        !card.isDestroyed
      ) {
        cardDiv.classList.add("scudlauncher-target");
      }
    }

    if (this.state.pending?.type === "adrenalinelab_select_person") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.card.id === card?.id &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("adrenalinelab-target");

        // Make it clickable
        cardDiv.addEventListener("click", (e) => {
          if (this.state.phase === "game_over") return;
          e.stopPropagation();
          e.preventDefault();
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
        });
      }
    }

    // Add this with the other pending type checks in renderCard
    if (this.state.pending?.type === "constructionyard_select_person") {
      // Highlight player's own people
      if (
        playerId === this.state.pending.sourcePlayerId &&
        card &&
        card.type === "person" &&
        !card.isDestroyed
      ) {
        cardDiv.classList.add("constructionyard-moveable");

        // Make it clickable
        cardDiv.addEventListener("click", (e) => {
          if (this.state.phase === "game_over") return;
          e.stopPropagation();
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
        });
      }
    }

    if (this.state.pending?.type === "constructionyard_select_destination") {
      // Highlight valid destination slots (positions 1 and 2)
      if (
        playerId === this.state.pending.sourcePlayerId &&
        position > 0 // Not camp slot
      ) {
        cardDiv.classList.add("constructionyard-destination");

        // Make slots clickable
        cardDiv.addEventListener("click", (e) => {
          if (this.state.phase === "game_over") return;
          e.stopPropagation();
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
        });
      }
    }

    if (this.state.pending?.type === "bonfire_restore_multiple") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("bonfire-restore-target");
      }
    }

    if (this.state.pending?.type === "catapult_damage") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("catapult-target");
      }
    }

    if (this.state.pending?.type === "catapult_select_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("catapult-sacrifice-target");
      }
    }

    if (this.state.pending?.type === "mulcher_select_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("mulcher-target");
      }
    }

    if (this.state.pending?.type === "laborcamp_select_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("laborcamp-destroy-target");
      }
    }

    if (this.state.pending?.type === "laborcamp_select_restore") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("laborcamp-restore-target");
      }
    }

    if (this.state.pending?.type === "bloodbank_select_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex && // Changed from targetColumn
          t.position === position // Changed from targetPosition
      );
      if (isValidTarget) {
        cardDiv.classList.add("bloodbank-target");
      }
    }

    // In renderCard for highlighting placement targets:
    if (this.state.pending?.type === "highground_place_person") {
      if (playerId === this.state.pending.playerId && position > 0) {
        cardDiv.classList.add("highground-placement-target");

        if (!card) {
          cardDiv.classList.add("highground-placement-empty");
        } else {
          const otherSlot = position === 1 ? 2 : 1;
          const otherCard =
            this.state.players[playerId].columns[columnIndex].getCard(
              otherSlot
            );
          if (!otherCard) {
            cardDiv.classList.add("highground-placement-pushable");
          }
        }
      }
    }

    if (this.state.pending?.type === "mercenary_camp_damage") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("mercenary-target");
      }
    }

    if (
      this.state.pending?.type === "uprising_place_punks" &&
      playerId === this.state.pending.sourcePlayerId
    ) {
      // Highlight ALL slots in player's own columns for placement
      cardDiv.classList.add("uprising-placement-target");

      // Add extra visual cue for empty slots
      if (!card) {
        cardDiv.classList.add("uprising-placement-empty");
      }
    }

    if (this.state.pending?.type === "famine_select_keep") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("famine-keep-target");
      }
    }

    if (this.state.pending?.type === "banish_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("banish-target");
      }
    }

    if (this.state.pending?.type === "napalm_select_column") {
      if (
        this.state.pending.validColumns.includes(columnIndex) &&
        playerId === this.state.pending.targetPlayerId &&
        card &&
        card.type === "person" &&
        !card.isDestroyed
      ) {
        cardDiv.classList.add("napalm-column-target");
      }
    }

    if (
      this.state.pending?.type === "parachute_place_person" &&
      playerId === this.state.pending.sourcePlayerId
    ) {
      // Check if this slot is actually eligible for placement
      const isEligibleSlot = () => {
        // Can't place in camp slot (position 0)
        if (position === 0) return false;

        // Check what's currently in the slot
        if (card) {
          // Can't place on camps
          if (card.type === "camp") return false;

          // Can't place on Juggernaut (it's a camp that can be in any position)
          if (card.name === "Juggernaut") return false;

          // Can place on regular people if there's room to push
          if (card.type === "person") {
            const otherSlot = position === 1 ? 2 : 1;
            const otherCard =
              this.state.players[playerId].columns[columnIndex].getCard(
                otherSlot
              );

            // Can only push if the other slot is empty
            return !otherCard;
          }
        }

        // Empty slots in positions 1 or 2 are always eligible
        return true;
      };

      if (isEligibleSlot()) {
        cardDiv.classList.add("parachute-placement-target");

        // Add extra visual cue for empty slots
        if (!card) {
          cardDiv.classList.add("parachute-placement-empty");
        }
      }
    }

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

    // Check for specific damage types FIRST, before the generic check
    if (this.state.pending?.type === "pyromaniac_damage") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("pyromaniac-target");
      }
    } else if (this.state.pending?.type === "molgur_destroy_camp") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("molgur-target");
      }
    } else if (this.state.pending?.type === "sniper_damage") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("sniper-target");
      }
    } else if (this.state.pending?.type === "cultleader_select_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("cultleader-destroy-target");
      }
    } else if (this.state.pending?.type === "cultleader_damage") {
      // Normal damage targeting for the second part
      const isValidTarget = this.canTargetForDamage(
        playerId,
        columnIndex,
        position
      );
      if (isValidTarget) {
        cardDiv.classList.add("damage-target");
      }
    } else if (this.state.pending?.type === "assassin_destroy") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );
      if (isValidTarget) {
        cardDiv.classList.add("assassin-target");
      }
    } else if (this.state.pending?.type?.includes("damage")) {
      // Generic damage handler - only for basic damage abilities
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

    // Vera Vosh trait indicator
    if (
      card &&
      card.name === "Vera Vosh" &&
      !card.isDamaged &&
      !card.isDestroyed
    ) {
      const trait = this.createElement("div", "vera-trait-active");
      trait.textContent = "🔄 First ability use stays ready!";
      cardDiv.appendChild(trait);
    }

    // Show if this card has already used Vera's trait
    if (
      card &&
      card.type === "person" &&
      this.state.turnEvents.veraFirstUseCards?.includes(card.id)
    ) {
      const usedVera = this.createElement("div", "vera-used");
      usedVera.textContent = "✓ Vera bonus used";
      cardDiv.appendChild(usedVera);
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

    if (
      this.state.pending?.type === "restore" ||
      this.state.pending?.type === "repair_bot_entry_restore" ||
      this.state.pending?.type === "atomic_garden_restore"
    ) {
      // Check if this card is in the valid targets list
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("restore-target");
      }
    }

    if (this.state.pending?.type === "junk_injure") {
      // Highlight valid injure targets
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId && // Changed from targetPlayer
          t.columnIndex === columnIndex && // Changed from targetColumn
          t.position === position // Changed from targetPosition
      );

      if (isValidTarget) {
        cardDiv.classList.add("junk-injure-target");
      }
    }

    // Vanguard damage targeting
    if (this.state.pending?.type === "vanguard_damage") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("vanguard-target");
      }
    }

    // Vanguard counter-damage targeting
    if (this.state.pending?.type === "vanguard_counter") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("vanguard-counter-target");
      }
    }

    // Rescue Team targeting
    if (this.state.pending?.type === "rescue_team_select") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("rescue-team-target");
      }
    }

    // Magnus Karv column targeting - highlight all cards in valid columns
    if (this.state.pending?.type === "magnus_select_column") {
      if (
        this.state.pending.validColumns.includes(columnIndex) &&
        playerId === this.state.pending.targetPlayerId &&
        card &&
        !card.isDestroyed
      ) {
        cardDiv.classList.add("magnus-column-target");
      }
    }

    if (this.state.pending?.type === "mutant_restore") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("mutant-restore-target");
      }
    }

    if (this.state.pending?.type === "mutant_damage") {
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId &&
          t.columnIndex === columnIndex &&
          t.position === position
      );

      if (isValidTarget) {
        cardDiv.classList.add("mutant-damage-target");
      }
    }

    if (this.state.pending?.type === "junk_restore") {
      // Only highlight cards in the valid targets list
      const isValidTarget = this.state.pending.validTargets?.some(
        (t) =>
          t.playerId === playerId && // Changed from targetPlayer
          t.columnIndex === columnIndex && // Changed from targetColumn
          t.position === position // Changed from targetPosition
      );

      if (isValidTarget) {
        cardDiv.classList.add("junk-restore-target");
      }
    }

    if (this.state.pending?.type === "place_punk") {
      // Highlight valid placement slots (any slot except camps)
      if (playerId === this.state.pending.sourcePlayerId) {
        // Only add highlight if NOT a camp
        if (!card || card.type !== "camp") {
          cardDiv.classList.add("punk-placement-target");
        }
      }
    }

    if (!card) {
      cardDiv.classList.add("empty");
      const label = this.createElement("div");
      label.textContent = "Empty";
      cardDiv.appendChild(label);

      // Make empty slots clickable for placing cards
      cardDiv.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        console.log(
          "Empty slot clicked, pending type:",
          this.state.pending?.type
        );

        // Add Construction Yard destination handling HERE
        if (
          this.state.pending?.type === "constructionyard_select_destination" &&
          playerId === this.state.pending.movingToPlayerId &&
          position > 0 // Not camp slot
        ) {
          console.log("Construction Yard destination clicked");
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }

        if (
          this.state.pending?.type === "highground_place_person" &&
          playerId === this.state.pending.playerId &&
          position > 0
        ) {
          console.log("High Ground placement clicked");
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }

        if (
          this.state.pending?.type === "uprising_place_punks" &&
          playerId === this.state.pending.sourcePlayerId &&
          this.isMyTurn()
        ) {
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }
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
        // Handle Parachute Base placement
        if (
          this.state.pending?.type === "parachute_place_person" &&
          playerId === this.state.pending.sourcePlayerId
        ) {
          // Check if this empty slot is eligible (not camp slot)
          if (position === 0) {
            console.log("Cannot place person in camp slot");
            return;
          }

          console.log("Executing Parachute placement for empty slot");
          this.commands.execute({
            type: "SELECT_TARGET",
            targetType: "slot",
            playerId: playerId,
            columnIndex: columnIndex,
            position: position,
          });
          cardDiv.classList.add("parachute-placement-target");
          return;
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

      if (card.name === "Karli Blaze" && !card.isDamaged && !card.isDestroyed) {
        const trait = this.createElement("div", "karli-trait-active");
        trait.textContent = "⚡ All people enter ready!";
        cardDiv.appendChild(trait);
      }

      // Check if Argo Yesky is giving this card an extra damage ability
      let hasArgoBonus = false;
      // Check for both person cards AND punks
      if (
        (card.type === "person" || card.isPunk) &&
        playerId === this.state.currentPlayer
      ) {
        // Check for active Argo directly
        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const checkCard =
              this.state.players[playerId].columns[col].getCard(pos);
            if (
              checkCard &&
              checkCard.name === "Argo Yesky" &&
              !checkCard.isDamaged &&
              !checkCard.isDestroyed &&
              checkCard.id !== card.id
            ) {
              // Don't give Argo his own bonus
              hasArgoBonus = true;
              break;
            }
          }
          if (hasArgoBonus) break;
        }
      }

      // Create abilities div if there are normal abilities OR if there's an Argo bonus
      if ((card.abilities && card.abilities.length > 0) || hasArgoBonus) {
        const abilities = this.createElement("div", "ability-info");

        // Only render normal abilities if they exist
        if (card.abilities && card.abilities.length > 0) {
          card.abilities.forEach((ability, index) => {
            // Different ready conditions for camps vs people
            let canUseAbility = false;

            if (card.type === "camp") {
              canUseAbility = card.isReady && !card.isDestroyed;
            } else if (card.type === "person") {
              canUseAbility =
                card.isReady && !card.isDamaged && !card.isDestroyed;
            }

            // Check turn control
            const isYourTurn = this.isMyTurn();

            // BLOCK ALL ABILITIES IF THERE'S ANY PENDING ACTION OR NOT YOUR TURN
            if (
              canUseAbility &&
              playerId === this.state.currentPlayer &&
              isYourTurn &&
              !this.state.pending
            ) {
              const btn = this.createElement("button", "ability-btn");

              // Special text for Rabble Rouser's conditional ability
              if (
                card.name === "Rabble Rouser" &&
                ability.effect === "punkdamage"
              ) {
                btn.textContent = `Damage (if punk) (${ability.cost}💧)`;
              } else {
                btn.textContent = `${ability.effect} (${ability.cost}💧)`;
              }

              btn.addEventListener("click", (e) => {
                if (this.state.phase === "game_over") return;
                e.stopPropagation();

                console.log("=== UI BUTTON CLICK ===");
                console.log("Card name:", card.name);
                console.log("Ability index being sent:", index);
                console.log("Ability effect:", ability.effect);

                if (this.state.pending) {
                  console.log("Action in progress - please complete it first");
                  return;
                }

                // Juggernaut is special - it's a camp that can move to any position
                if (card.name === "Juggernaut") {
                  this.commands.execute({
                    type: "USE_CAMP_ABILITY",
                    playerId: playerId,
                    payload: {
                      playerId: playerId,
                      columnIndex: columnIndex,
                      position: position, // Include actual position for Juggernaut
                      abilityIndex: index,
                    },
                  });
                } else if (card.type === "camp") {
                  // Regular camps are always at position 0
                  console.log(
                    "Camp ability clicked:",
                    card.name,
                    "at column",
                    columnIndex
                  );
                  this.commands.execute({
                    type: "USE_CAMP_ABILITY",
                    playerId: playerId,
                    payload: {
                      playerId: playerId,
                      columnIndex: columnIndex,
                      position: 0,
                      abilityIndex: index,
                    },
                  });
                } else {
                  // Regular person ability
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
                }
              });
              abilities.appendChild(btn);
            } else {
              // Show disabled ability text
              const text = this.createElement("span", "ability-text-disabled");

              if (
                card.name === "Rabble Rouser" &&
                ability.effect === "punkdamage"
              ) {
                text.textContent = `Damage (if punk) (${ability.cost}💧)`;
              } else {
                text.textContent = `${ability.effect} (${ability.cost}💧)`;
              }

              // Add specific reason for blocking - check turn FIRST
              const isYourTurn = this.isMyTurn();

              if (!isYourTurn) {
                text.textContent += " [Not Your Turn]";
              } else if (this.state.pending) {
                text.textContent += " [Action in Progress]";
              } else if (card.type === "person") {
                if (!card.isReady) text.textContent += " [Not Ready]";
                if (card.isDamaged) text.textContent += " [Damaged]";
              } else if (card.type === "camp") {
                if (!card.isReady) text.textContent += " [Used]";
                if (card.isDestroyed) text.textContent += " [Destroyed]";
              }

              abilities.appendChild(text);
            }
          });
        }

        // Add Argo's bonus damage ability if applicable
        if (hasArgoBonus) {
          const canUseAbility =
            card.isReady && !card.isDamaged && !card.isDestroyed;

          const isYourTurn = this.isMyTurn();

          if (
            canUseAbility &&
            playerId === this.state.currentPlayer &&
            isYourTurn &&
            !this.state.pending
          ) {
            const btn = this.createElement(
              "button",
              "ability-btn argo-granted"
            );
            btn.textContent = `[Argo] Damage (1💧)`;

            btn.addEventListener("click", (e) => {
              if (this.state.phase === "game_over") return;
              e.stopPropagation();

              if (this.state.pending) {
                console.log("Action in progress - please complete it first");
                return;
              }

              // Create a virtual ability index for Argo's granted ability
              this.commands.execute({
                type: "USE_ABILITY",
                playerId: playerId,
                payload: {
                  playerId: playerId,
                  columnIndex: columnIndex,
                  position: position,
                  abilityIndex: card.abilities ? card.abilities.length : 0, // Handle case where no abilities
                  isArgoGranted: true,
                },
              });
            });
            abilities.appendChild(btn);
          } else {
            const text = this.createElement(
              "span",
              "ability-text-disabled argo-granted"
            );
            text.textContent = `[Argo] Damage (1💧)`;

            const isYourTurn = this.isMyTurn();

            if (!isYourTurn) {
              text.textContent += " [Not Your Turn]";
            } else if (this.state.pending) {
              text.textContent += " [Action in Progress]";
            } else if (!card.isReady) {
              text.textContent += " [Not Ready]";
            } else if (card.isDamaged) {
              text.textContent += " [Damaged]";
            }

            abilities.appendChild(text);
          }
        }

        cardDiv.appendChild(abilities);
      }

      // Make cards clickable for multiple purposes
      cardDiv.addEventListener("click", (e) => {
        if (this.state.phase === "game_over") return;
        e.stopPropagation();

        if (e.defaultPrevented) return;

        // SPECIAL CASE: Raiders camp selection - only target player can click
        if (this.state.pending?.type === "raiders_select_camp") {
          // Only the TARGET player (opponent) can select, not the active player
          if (
            window.networkClient?.myPlayerId !==
            this.state.pending.targetPlayerId
          ) {
            console.log(
              "Only the targeted player can select a camp for Raiders"
            );
            return;
          }
          // Allow the click to proceed for the target player
          this.handleCardTargetClick(playerId, columnIndex, position);
          return;
        }

        // SPECIAL CASE: Junk effects - only active player can select targets
        if (
          this.state.pending?.type === "junk_injure" ||
          this.state.pending?.type === "junk_restore" ||
          this.state.pending?.type === "place_punk"
        ) {
          // Only the active player can complete their junk effect
          if (!this.isMyTurn()) {
            console.log(
              "Only the active player can complete their junk action"
            );
            return;
          }
          // Allow the click to proceed for active player
          this.handleCardTargetClick(playerId, columnIndex, position);
          return;
        }

        // If there's a pending action, allow only targeting clicks
        // Otherwise, block clicks on opponent's cards entirely
        if (!this.state.pending) {
          // No pending action - check if this is opponent's card
          if (playerId !== window.networkClient?.myPlayerId) {
            console.log(
              "Cannot interact with opponent's board when not targeting"
            );
            return;
          }
        }

        if (
          this.state.pending?.type === "constructionyard_select_person" &&
          card.type === "person" &&
          !card.isDestroyed
        ) {
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }

        if (
          this.state.pending?.type === "constructionyard_select_destination" &&
          playerId === this.state.pending.movingToPlayerId &&
          position > 0 // Not camp slot
        ) {
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }

        console.log(
          "Occupied slot clicked, pending type:",
          this.state.pending?.type
        );

        if (
          this.state.pending?.type === "highground_place_person" &&
          playerId === this.state.pending.playerId &&
          position > 0
        ) {
          console.log(
            "High Ground placement clicked (occupied slot - will try push)"
          );
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }

        if (
          this.state.pending?.type === "uprising_place_punks" &&
          playerId === this.state.pending.sourcePlayerId &&
          this.isMyTurn()
        ) {
          console.log(
            "Clicking occupied slot for Uprising punk placement (will push)"
          );
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: playerId,
            targetColumn: columnIndex,
            targetPosition: position,
          });
          return;
        }

        // Handle pending targeting
        if (this.state.pending) {
          // Check if this is Parachute Base placement
          if (
            this.state.pending.type === "parachute_place_person" &&
            playerId === this.state.pending.sourcePlayerId
          ) {
            // Check if this occupied slot is eligible for placement
            if (
              position === 0 ||
              card.type === "camp" ||
              card.name === "Juggernaut"
            ) {
              console.log("Cannot place on this slot - camp or Juggernaut");
              return;
            }

            // Check if we can push the person
            if (card.type === "person") {
              const otherSlot = position === 1 ? 2 : 1;
              const otherCard =
                this.state.players[playerId].columns[columnIndex].getCard(
                  otherSlot
                );
              if (otherCard) {
                console.log("Cannot place - no room to push");
                return;
              }
            }

            console.log(
              "Clicking slot for Parachute placement:",
              columnIndex,
              position
            );
            this.commands.execute({
              type: "SELECT_TARGET",
              targetType: "slot",
              playerId: playerId,
              columnIndex: columnIndex,
              position: position,
            });
            cardDiv.classList.add("parachute-placement-target");
            return;
          }
        }

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

  renderAbilitySelection() {
    console.log("renderAbilitySelection called");
    console.log("Full pending state:", this.state.pending);
    console.log("Pending type specifically:", this.state.pending?.type);

    // Cache order choice
    if (this.state.pending?.type === "cache_choose_order") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Cache: Choose which effect to do first";
      content.appendChild(title);

      const subtitle = this.createElement("div", "modal-subtitle");
      subtitle.textContent = "You will do both, but order might matter";
      subtitle.style.fontSize = "14px";
      subtitle.style.color = "#666";
      content.appendChild(subtitle);

      const buttonContainer = this.createElement("div", "ability-buttons");

      const raidBtn = this.createElement("button", "ability-select-btn");
      raidBtn.textContent = "⚔️ Raid first, then Gain Punk";
      raidBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          effectFirst: "raid",
        });
      });
      buttonContainer.appendChild(raidBtn);

      const punkBtn = this.createElement("button", "ability-select-btn");
      punkBtn.textContent = "👤 Gain Punk first, then Raid";
      punkBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          effectFirst: "punk",
        });
      });
      buttonContainer.appendChild(punkBtn);

      content.appendChild(buttonContainer);

      // Add cancel button
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        // Refund the water
        const player = this.state.players[this.state.pending.sourcePlayerId];
        player.water += 2;

        // Mark camp as ready again
        if (this.state.pending.sourceCard) {
          this.state.pending.sourceCard.isReady = true;
        }

        this.state.pending = null;
        this.render();
      });
      buttonContainer.appendChild(cancelBtn);

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Handle Adrenaline Lab ability selection
    if (this.state.pending?.type === "adrenalinelab_select_ability") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = `Adrenaline Lab: Choose which ${this.state.pending.selectedPerson.card.name} ability to use`;
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      this.state.pending.selectedPerson.abilities.forEach((ability, index) => {
        const btn = this.createElement("button", "ability-select-btn");

        // Check if player can afford it
        const player = this.state.players[this.state.pending.sourcePlayerId];
        const canAfford = player.water >= ability.cost;

        // Special text for conditional abilities
        let abilityText = `${ability.effect} (${ability.cost}💧)`;
        if (ability.effect === "punkdamage") {
          abilityText = `Damage if Punk (${ability.cost}💧)`;
        } else if (ability.effect === "gainpunk") {
          abilityText = `Gain Punk (${ability.cost}💧)`;
        }

        btn.textContent = abilityText;
        btn.disabled = !canAfford;

        if (!canAfford) {
          btn.title = "Not enough water";
          btn.classList.add("disabled");
        }

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            abilityIndex: index,
          });
        });

        buttonContainer.appendChild(btn);
      });

      // Add cancel button
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Cancel";

      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        // Mark Adrenaline Lab as ready again since we're cancelling
        if (this.state.pending.sourceCard) {
          this.state.pending.sourceCard.isReady = true;
        }
        this.state.pending = null;
        this.render();
      });

      buttonContainer.appendChild(cancelBtn);
      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // The Octagon opponent must destroy
    if (this.state.pending?.type === "octagon_opponent_destroy") {
      // Don't show a modal - just highlight valid targets on the board
      // The opponent should click directly on their person to destroy
      // But we should show a message banner
      return null; // No modal needed, using board highlighting
    }

    // The Octagon choose to destroy
    if (this.state.pending?.type === "octagon_choose_destroy") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "The Octagon: Choose to destroy one of your people?";
      content.appendChild(title);

      const subtitle = this.createElement("div", "modal-subtitle");
      subtitle.textContent = "If you do, opponent must destroy one of theirs";
      subtitle.style.fontSize = "14px";
      subtitle.style.color = "#666";
      content.appendChild(subtitle);

      const buttonContainer = this.createElement("div", "ability-buttons");

      // Show available people
      this.state.pending.validTargets.forEach((target) => {
        const btn = this.createElement("button", "ability-select-btn");
        btn.textContent = `Destroy ${
          target.card.isPunk ? "Punk" : target.card.name
        }`;

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            targetPlayer: target.playerId, // Use target.playerId, not just playerId
            targetColumn: target.columnIndex, // Use target.columnIndex
            targetPosition: target.position, // Use target.position
          });
        });

        buttonContainer.appendChild(btn);
      });

      // Add "Don't Destroy" option
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Don't Destroy Anyone";
      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          cancel: true,
        });
      });
      buttonContainer.appendChild(cancelBtn);

      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Scavenger Camp discard selection
    if (this.state.pending?.type === "scavengercamp_select_discard") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Scavenger Camp: Select a card to discard";
      content.appendChild(title);

      const pending = this.state.pending;
      let selectedCard = null;

      const cardListDiv = this.createElement("div", "card-selection-list");

      pending.discardableCards.forEach((card) => {
        const cardDiv = this.createElement("div", "selectable-card");
        cardDiv.textContent = `${card.name} (${card.cost || 0}💧)`;

        if (card.junkEffect) {
          cardDiv.textContent += ` [Junk: ${card.junkEffect}]`;
        }

        cardDiv.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          const allCards = cardListDiv.querySelectorAll(".selectable-card");
          allCards.forEach((c) => c.classList.remove("selected"));

          cardDiv.classList.add("selected");
          selectedCard = card.id;

          const submitBtn = content.querySelector(".submit-discard-btn");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Discard ${card.name}`;
          }
        });

        cardListDiv.appendChild(cardDiv);
      });

      content.appendChild(cardListDiv);

      const submitBtn = this.createElement("button", "submit-discard-btn");
      submitBtn.textContent = "Select a card to discard";
      submitBtn.disabled = true;

      submitBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        if (selectedCard) {
          this.commands.execute({
            type: "SELECT_TARGET",
            cardToDiscard: selectedCard,
          });
        }
      });

      content.appendChild(submitBtn);

      // Add cancel button
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.state.pending = null;
        this.render();
      });

      content.appendChild(cancelBtn);

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    if (this.state.pending?.type === "octagon_opponent_destroy") {
      // Highlight cards that belong to the target player
      if (
        playerId === this.state.pending.targetPlayerId &&
        card &&
        card.type === "person" &&
        !card.isDestroyed
      ) {
        cardDiv.classList.add("octagon-target");
      }
    }

    // Scavenger Camp benefit choice
    if (this.state.pending?.type === "scavengercamp_choose_benefit") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Scavenger Camp: Choose your benefit";
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      const waterBtn = this.createElement("button", "ability-select-btn");
      waterBtn.textContent = "💧 Gain Extra Water";
      waterBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          benefit: "water",
        });
      });
      buttonContainer.appendChild(waterBtn);

      const punkBtn = this.createElement("button", "ability-select-btn");
      punkBtn.textContent = "👤 Gain a Punk";
      if (this.state.deck.length === 0) {
        punkBtn.textContent += " (Deck Empty!)";
        punkBtn.disabled = true;
      }
      punkBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          benefit: "punk",
        });
      });
      buttonContainer.appendChild(punkBtn);

      content.appendChild(buttonContainer);

      // No cancel at this point - must choose a benefit

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    if (this.state.pending?.type === "omenclock_select_event") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Omen Clock: Select an event to advance";
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "event-selection-grid");

      this.state.pending.validTargets.forEach((target) => {
        const btn = this.createElement("button", "event-select-btn");

        const owner =
          target.playerId === this.state.currentPlayer ? "Your" : "Opponent's";
        const slot = target.slotIndex + 1;

        if (target.willResolve) {
          btn.textContent = `${owner} ${target.event.name} (Slot ${slot} → RESOLVE!)`;
          btn.classList.add("will-resolve");
        } else {
          btn.textContent = `${owner} ${target.event.name} (Slot ${slot} → ${
            slot - 1
          })`;
        }

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            eventPlayerId: target.playerId,
            eventSlot: target.slotIndex,
          });
        });

        buttonContainer.appendChild(btn);
      });

      content.appendChild(buttonContainer);

      // Add cancel button
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        // Refund the water
        const player = this.state.players[this.state.pending.sourcePlayerId];
        player.water += 1;
        this.state.pending = null;
        this.render();
      });

      buttonContainer.appendChild(cancelBtn);

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    if (this.state.pending?.type === "supplydepot_select_discard") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Supply Depot: Choose 1 card to DISCARD";
      content.appendChild(title);

      const subtitle = this.createElement("div", "modal-subtitle");
      subtitle.textContent = "The other card will stay in your hand";
      subtitle.style.fontSize = "14px";
      subtitle.style.color = "#666";
      subtitle.style.marginBottom = "10px";
      content.appendChild(subtitle);

      const pending = this.state.pending;
      let selectedCard = null;

      const cardListDiv = this.createElement("div", "card-selection-list");

      // Show only the 2 cards that were drawn
      pending.drawnCards.forEach((card) => {
        const cardDiv = this.createElement("div", "selectable-card");
        cardDiv.textContent = `${card.name} (${card.cost || 0}💧)`;

        if (card.junkEffect) {
          cardDiv.textContent += ` [Junk: ${card.junkEffect}]`;
        }

        cardDiv.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          // Clear previous selection
          const allCards = cardListDiv.querySelectorAll(".selectable-card");
          allCards.forEach((c) => c.classList.remove("selected"));

          // Select this card
          cardDiv.classList.add("selected");
          selectedCard = card.id;

          // Enable submit button
          const submitBtn = content.querySelector(".submit-discard-btn");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Discard ${card.name}`;
          }
        });

        cardListDiv.appendChild(cardDiv);
      });

      content.appendChild(cardListDiv);

      const submitBtn = this.createElement("button", "submit-discard-btn");
      submitBtn.textContent = "Select a card to discard";
      submitBtn.disabled = true;

      submitBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        if (selectedCard) {
          this.commands.execute({
            type: "SELECT_TARGET",
            cardToDiscard: selectedCard,
          });
        }
      });

      content.appendChild(submitBtn);

      // No cancel button - must complete the effect

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    if (this.state.pending?.type === "highground_select_person") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "High Ground: Select person to place";
      content.appendChild(title);

      const subtitle = this.createElement("div", "modal-subtitle");
      subtitle.textContent = `${this.state.pending.collectedPeople.length} people to place`;
      content.appendChild(subtitle);

      const buttonContainer = this.createElement(
        "div",
        "person-selection-grid"
      );

      this.state.pending.collectedPeople.forEach((person) => {
        const btn = this.createElement("button", "person-select-btn");
        btn.textContent = person.name;

        // Add extra info if relevant
        if (person.isDamaged) {
          btn.textContent += " (Damaged)";
          btn.classList.add("damaged");
        }

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            personId: person.id,
          });
        });

        buttonContainer.appendChild(btn);
      });

      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    if (this.state.pending?.type === "interrogate_keep") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Interrogate: Choose 1 card to KEEP";
      content.appendChild(title);

      const subtitle = this.createElement("div", "modal-subtitle");
      subtitle.textContent = "The other 3 will be discarded";
      subtitle.style.fontSize = "14px";
      subtitle.style.color = "#666";
      subtitle.style.marginBottom = "10px";
      content.appendChild(subtitle);

      const pending = this.state.pending;
      let selectedCard = null;

      const cardListDiv = this.createElement("div", "card-selection-list");

      // Only show the 4 cards that were drawn
      pending.drawnCards.forEach((card) => {
        const cardDiv = this.createElement("div", "selectable-card");
        cardDiv.textContent = `${card.name} (${card.cost || 0}💧)`;

        if (card.junkEffect) {
          cardDiv.textContent += ` [Junk: ${card.junkEffect}]`;
        }

        cardDiv.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          // Clear previous selection
          const allCards = cardListDiv.querySelectorAll(".selectable-card");
          allCards.forEach((c) => c.classList.remove("selected"));

          // Select this card
          cardDiv.classList.add("selected");
          selectedCard = card.id;

          // Enable submit button
          const submitBtn = content.querySelector(".submit-keep-btn");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Keep ${card.name}`;
          }
        });

        cardListDiv.appendChild(cardDiv);
      });

      content.appendChild(cardListDiv);

      const submitBtn = this.createElement("button", "submit-keep-btn");
      submitBtn.textContent = "Select a card to keep";
      submitBtn.disabled = true;

      submitBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        if (selectedCard) {
          this.commands.execute({
            type: "SELECT_TARGET",
            cardToKeep: selectedCard,
          });
        }
      });

      content.appendChild(submitBtn);

      // No cancel button - must complete the effect

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Handle Mutant mode selection
    if (this.state.pending?.type === "mutant_choose_mode") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Mutant: Choose what to do";
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      // Damage only button
      if (this.state.pending.damageTargets.length > 0) {
        const damageBtn = this.createElement("button", "ability-select-btn");
        damageBtn.textContent = `Damage only (${this.state.pending.damageTargets.length} targets)`;
        damageBtn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            mode: "damage",
          });
        });
        buttonContainer.appendChild(damageBtn);
      }

      // Restore only button
      if (this.state.pending.restoreTargets.length > 0) {
        const restoreBtn = this.createElement("button", "ability-select-btn");
        restoreBtn.textContent = `Restore only (${this.state.pending.restoreTargets.length} targets)`;
        restoreBtn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            mode: "restore",
          });
        });
        buttonContainer.appendChild(restoreBtn);
      }

      // Both button
      if (
        this.state.pending.damageTargets.length > 0 &&
        this.state.pending.restoreTargets.length > 0
      ) {
        const bothBtn = this.createElement("button", "ability-select-btn");
        bothBtn.textContent = "Damage AND Restore";
        bothBtn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            mode: "both",
          });
        });
        buttonContainer.appendChild(bothBtn);
      }

      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Handle Mutant order selection
    if (this.state.pending?.type === "mutant_choose_order") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Mutant: Choose order";
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      const damageFirstBtn = this.createElement("button", "ability-select-btn");
      damageFirstBtn.textContent = "Damage first, then Restore";
      damageFirstBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          order: "damage_first",
        });
      });
      buttonContainer.appendChild(damageFirstBtn);

      const restoreFirstBtn = this.createElement(
        "button",
        "ability-select-btn"
      );
      restoreFirstBtn.textContent = "Restore first, then Damage";
      restoreFirstBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          order: "restore_first",
        });
      });
      buttonContainer.appendChild(restoreFirstBtn);

      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Handle Zeto Kahn discard selection
    if (this.state.pending?.type === "zeto_discard_selection") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent =
        "Zeto Kahn: Select 3 cards to discard (not Water Silo)";
      content.appendChild(title);

      const player = this.state.players[this.state.pending.sourcePlayerId];
      const selectedCards = new Set();

      const cardListDiv = this.createElement("div", "card-selection-list");

      player.hand.forEach((card, index) => {
        const cardDiv = this.createElement("div", "selectable-card");
        cardDiv.textContent = `${card.name} (${card.cost}💧)`;

        // Disable Water Silo
        if (card.isWaterSilo) {
          cardDiv.classList.add("disabled");
          cardDiv.textContent += " [Cannot discard]";
        } else {
          cardDiv.addEventListener("click", () => {
            if (this.state.phase === "game_over") return;
            if (selectedCards.has(card.id)) {
              selectedCards.delete(card.id);
              cardDiv.classList.remove("selected");
            } else if (selectedCards.size < 3) {
              selectedCards.add(card.id);
              cardDiv.classList.add("selected");
            }

            // Update submit button
            const submitBtn = content.querySelector(".submit-discard-btn");
            if (submitBtn) {
              submitBtn.disabled = selectedCards.size !== 3;
              submitBtn.textContent = `Discard ${selectedCards.size}/3 cards`;
            }
          });
        }

        cardListDiv.appendChild(cardDiv);
      });

      content.appendChild(cardListDiv);

      // Add submit button
      const submitBtn = this.createElement("button", "submit-discard-btn");
      submitBtn.textContent = "Discard 0/3 cards";
      submitBtn.disabled = true;

      submitBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        if (selectedCards.size === 3) {
          this.commands.execute({
            type: "SELECT_TARGET",
            cardsToDiscard: Array.from(selectedCards),
          });
        }
      });

      content.appendChild(submitBtn);

      // NO CANCEL BUTTON - player must complete the discard

      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Handle Scientist's junk selection
    // In the scientist_select_junk case:
    if (
      this.state.pending &&
      this.state.pending.type === "scientist_select_junk"
    ) {
      console.log("Creating Scientist modal");
      console.log("Discarded cards:", this.state.pending.discardedCards);

      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = "Scientist: Choose a junk effect to use:";
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      // Show each discarded card with its junk effect
      this.state.pending.discardedCards.forEach((card, index) => {
        const btn = this.createElement("button", "ability-select-btn");
        btn.textContent = `${card.name}: Use ${card.junkEffect} effect`;

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            junkIndex: index,
          });
        });

        buttonContainer.appendChild(btn);
      });

      // Add "no junk" option - NOT a cancel/skip!
      const noJunkBtn = this.createElement("button", "ability-select-btn");
      noJunkBtn.textContent = "Discard all without using any junk effect";
      noJunkBtn.style.marginTop = "10px";

      noJunkBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        // Signal no junk with index -1
        this.commands.execute({
          type: "SELECT_TARGET",
          junkIndex: -1,
        });
      });

      buttonContainer.appendChild(noJunkBtn);
      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      console.log("Scientist modal created successfully");
      return modal;
    }

    // Handle Parachute Base ability selection
    if (this.state.pending?.type === "parachute_select_ability") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = `Choose ${this.state.pending.person.name}'s ability to use:`;
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      this.state.pending.person.abilities.forEach((ability, index) => {
        const btn = this.createElement("button", "ability-select-btn");

        // Check if player can afford it
        const player = this.state.players[this.state.pending.sourcePlayerId];
        const canAfford = player.water >= ability.cost;

        // Special text for conditional abilities
        let abilityText = `${ability.effect} (${ability.cost}💧)`;
        if (ability.effect === "punkdamage") {
          abilityText = `Damage if Punk (${ability.cost}💧)`;
        }

        btn.textContent = abilityText;
        btn.disabled = !canAfford;

        if (!canAfford) {
          btn.title = "Not enough water";
          btn.classList.add("disabled");
        }

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            abilityIndex: index,
          });
        });

        buttonContainer.appendChild(btn);
      });

      // Add cancel button
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Cancel";

      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        console.log("Cancel clicked, pending:", this.state.pending);
        console.log("Has junkCard?", !!this.state.pending?.junkCard);

        if (this.state.pending?.junkCard) {
          const player = this.state.players[this.state.pending.sourcePlayerId];
          console.log(
            "Returning card to hand:",
            this.state.pending.junkCard.name
          );
          console.log("Hand before:", player.hand.length);
          player.hand.push(this.state.pending.junkCard);
          console.log("Hand after:", player.hand.length);
        }

        this.state.pending = null;
        this.render();
      });

      buttonContainer.appendChild(cancelBtn);
      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    // Handle Mimic ability selection
    if (this.state.pending?.type === "mimic_select_ability") {
      const modal = this.createElement("div", "ability-selection-modal");
      const backdrop = this.createElement("div", "modal-backdrop");

      const content = this.createElement("div", "modal-content");
      const title = this.createElement("h3", "modal-title");
      title.textContent = `Choose which ${this.state.pending.targetCard.name} ability to copy:`;
      content.appendChild(title);

      const buttonContainer = this.createElement("div", "ability-buttons");

      this.state.pending.targetCard.abilities.forEach((ability, index) => {
        const btn = this.createElement("button", "ability-select-btn");

        // Check if player can afford it
        const player = this.state.players[this.state.pending.sourcePlayerId];
        const canAfford = player.water >= ability.cost;

        // Special text for conditional abilities
        let abilityText = `${ability.effect} (${ability.cost}💧)`;
        if (ability.effect === "punkdamage") {
          abilityText = `Damage if Punk (${ability.cost}💧)`;
        }

        btn.textContent = abilityText;
        btn.disabled = !canAfford;

        if (!canAfford) {
          btn.title = "Not enough water";
          btn.classList.add("disabled");
        }

        btn.addEventListener("click", () => {
          if (this.state.phase === "game_over") return;
          this.commands.execute({
            type: "SELECT_TARGET",
            abilityIndex: index,
          });
        });

        buttonContainer.appendChild(btn);
      });

      // Add cancel button
      const cancelBtn = this.createElement("button", "cancel-btn");
      cancelBtn.textContent = "Cancel";

      cancelBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        console.log("Cancel clicked, pending:", this.state.pending);
        console.log("Has junkCard?", !!this.state.pending?.junkCard);

        if (this.state.pending?.junkCard) {
          const player = this.state.players[this.state.pending.sourcePlayerId];
          console.log(
            "Returning card to hand:",
            this.state.pending.junkCard.name
          );
          console.log("Hand before:", player.hand.length);
          player.hand.push(this.state.pending.junkCard);
          console.log("Hand after:", player.hand.length);
        }

        this.state.pending = null;
        this.render();
      });

      buttonContainer.appendChild(cancelBtn);
      content.appendChild(buttonContainer);
      modal.appendChild(backdrop);
      modal.appendChild(content);

      return modal;
    }

    console.log("No modal created for pending type:", this.state.pending?.type);
    return null;
  }

  canTargetForDamage(playerId, columnIndex, position) {
    if (!this.state.pending) return false;

    // Can't damage own cards (this includes the source card itself)
    if (playerId === this.state.pending.sourcePlayerId) return false;

    const card = this.state.getCard(playerId, columnIndex, position);
    if (!card || card.isDestroyed) return false;

    // Check protection (unless ability ignores it, like Sniper)
    const column = this.state.players[playerId].columns[columnIndex];

    // CHECK FOR HIGH GROUND EFFECT HERE
    if (this.state.turnEvents?.highGroundActive) {
      // During High Ground, opponent's cards are never protected
      const opponentId = this.state.currentPlayer === "left" ? "right" : "left";
      if (playerId === opponentId) {
        return true; // All opponent cards can be targeted during High Ground
      }
    }

    // Normal protection check
    if (!this.state.pending.allowProtected && column.isProtected(position)) {
      return false;
    }

    return true;
  }

  renderHand(player, playerId) {
    const hand = this.createElement("div", "hand");

    player.hand.forEach((card, index) => {
      const cardDiv = this.createElement("div", "hand-card");

      // Handle hidden opponent cards
      if (card.hidden) {
        cardDiv.classList.add("hidden-card");
        const cardText = document.createElement("div");
        cardText.className = "card-text";
        cardText.textContent = "Hidden Card";
        cardDiv.appendChild(cardText);
        hand.appendChild(cardDiv);
        return; // Skip rest of rendering for hidden cards
      }

      // Only set attributes ONCE, after the hidden check
      cardDiv.setAttribute("data-card-type", card.type);

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
          if (this.state.phase === "game_over") return;
          if (this.state.currentPlayer === playerId && this.isMyTurn()) {
            if (this.selectedCard?.card?.id === card.id) {
              console.log("Deselecting card:", card.name);
              this.selectedCard = null;
            } else {
              console.log("Selecting card:", card.name, "Type:", card.type);
              this.selectedCard = {
                playerId,
                card,
                cardId: card.id,
                cardType: card.type,
              };
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
        if (card.type === "event") {
          cardDiv.classList.add("event-selected");
        }
      }

      // Right-click to junk
      cardDiv.addEventListener("contextmenu", (e) => {
        if (this.state.phase === "game_over") return;
        e.preventDefault();
        if (
          this.state.currentPlayer === playerId &&
          this.state.phase === "actions" &&
          this.isMyTurn()
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
      if (this.state.phase === "game_over") return;
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

    // Draw Card button (only during actions phase)
    if (this.state.phase === "actions" && !this.state.pending) {
      const drawCardBtn = this.createElement("button");
      drawCardBtn.textContent = `Draw Card (2💧)`;

      const currentPlayer = this.state.players[this.state.currentPlayer];
      drawCardBtn.disabled =
        currentPlayer.water < CONSTANTS.DRAW_COST || !this.isMyTurn();

      drawCardBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "DRAW_CARD",
          playerId: this.state.currentPlayer,
        });
      });

      if (currentPlayer.water < CONSTANTS.DRAW_COST) {
        drawCardBtn.title = "Not enough water";
      }

      controls.appendChild(drawCardBtn);
    }

    // Finish button for Bonfire multiple restoration
    if (this.state.pending?.type === "bonfire_restore_multiple") {
      const finishBtn = this.createElement("button");
      const restoredCount = this.state.pending.restoredCards?.length || 0;

      if (restoredCount === 0) {
        finishBtn.textContent = "Skip Restoration";
      } else {
        finishBtn.textContent = `Finish Restoring (${restoredCount} restored)`;
      }

      finishBtn.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;
        this.commands.execute({
          type: "SELECT_TARGET",
          finish: true,
        });
      });

      controls.appendChild(finishBtn);
    }

    // End Turn button
    const endTurn = this.createElement("button");
    endTurn.textContent = "End Turn";
    endTurn.disabled =
      this.state.phase !== "actions" ||
      this.state.pending !== null ||
      !this.isMyTurn();

    endTurn.addEventListener("click", () => {
      if (this.state.phase === "game_over") return;
      this.commands.execute({
        type: "END_TURN",
        playerId: this.state.currentPlayer,
      });
    });

    controls.appendChild(endTurn);

    // Cancel button (for pending actions)
    if (
      this.state.pending &&
      this.state.pending.type !== "bonfire_restore_multiple"
    ) {
      const cancel = this.createElement("button");

      if (this.state.pending?.isEntryTrait) {
        cancel.textContent = "Skip";
      } else {
        cancel.textContent = "Cancel";
      }

      // Disable if not your turn
      cancel.disabled = !this.isMyTurn();

      cancel.addEventListener("click", () => {
        if (this.state.phase === "game_over") return;

        this.commands.execute({
          type: "CANCEL_ACTION",
          playerId: this.state.currentPlayer,
        });
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
