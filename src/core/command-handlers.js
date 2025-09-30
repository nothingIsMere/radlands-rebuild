// src/core/command-handlers.js

export function registerAllHandlers(commandSystem) {
  const handlers = {
    // Game action handlers
    PLAY_CARD: handlePlayCard,
    USE_ABILITY: handleUseAbility,
    USE_CAMP_ABILITY: handleUseCampAbility,
    DAMAGE: handleDamage,
    JUNK_CARD: handleJunkCard,
    END_TURN: handleEndTurn,
    SELECT_TARGET: handleSelectTarget,
    DRAW_CARD: handleDrawCard,
    TAKE_WATER_SILO: handleTakeWaterSilo,
    CARD_JUNKED: handleCardJunked,
    ABILITY_USED: handleAbilityUsed,
    EVENT_PLAYED: handleEventPlayed,
    WATER_SILO_TAKEN: handleWaterSiloTaken,

    // Phase and turn handlers
    SYNC_PHASE_CHANGE: handleSyncPhaseChange,

    // Camp selection handlers
    START_CAMP_SELECTION: handleStartCampSelection,
    SELECT_CAMP: handleSelectCamp,
    DESELECT_CAMP: handleDeselectCamp,
    CONFIRM_CAMPS: handleConfirmCamps,
    SYNC_CAMP_SELECTION: handleSyncCampSelection,
    SYNC_CAMP_DISTRIBUTION: handleSyncCampDistribution,
    FINALIZE_CAMPS: handleFinalizeCamps,

    // Synchronization handlers
    PLAYER_DREW_CARD: handlePlayerDrewCard,
    CARD_PLAYED: handleCardPlayed,
    SYNC_REPLENISH_COMPLETE: handleSyncReplenishComplete,
    SYNC_PENDING_STATE: handleSyncPendingState,
    SYNC_EVENT_QUEUE: handleSyncEventQueue,
  };

  // Register all handlers
  Object.entries(handlers).forEach(([type, handler]) => {
    commandSystem.handlers.set(type, handler.bind(commandSystem));
  });
}

// Game action handlers
function handlePlayCard(payload) {
  return this.handlePlayCard(payload);
}

function handleUseAbility(payload) {
  return this.handleUseAbility(payload);
}

function handleUseCampAbility(payload) {
  return this.handleUseCampAbility(payload);
}

function handleDamage(payload) {
  return this.handleDamage(payload);
}

function handleJunkCard(payload) {
  return this.handleJunkCard(payload);
}

function handleEndTurn(payload) {
  return this.handleEndTurn(payload);
}

function handleSelectTarget(payload) {
  return this.handleSelectTarget(payload);
}

function handleDrawCard(payload) {
  return this.handleDrawCard();
}

function handleTakeWaterSilo(payload) {
  return this.handleTakeWaterSilo(payload);
}

// Phase handlers
function handleSyncPhaseChange(payload) {
  this.state.phase = payload.phase;
  this.state.currentPlayer = payload.currentPlayer;
  this.state.turnNumber = payload.turnNumber;

  window.dispatchEvent(new CustomEvent("gameStateChanged"));
  return true;
}

// Camp selection handlers
function handleStartCampSelection(payload) {
  if (!this.campHandler) {
    const { CampSelectionHandler } = window.campSelectionModule || {};
    this.campHandler = new CampSelectionHandler(this.state, this);
  }

  if (
    window.debugGame?.dispatcher?.networkMode &&
    window.networkPlayerId === "right"
  ) {
    this.state.phase = "camp_selection";
    this.state.campSelection.active = true;
    console.log(
      "[CAMP] Right player waiting for camp distribution from left player"
    );
    return true;
  }

  return this.campHandler.startCampSelection();
}

function handleSelectCamp(payload) {
  if (!this.campHandler) {
    const { CampSelectionHandler } = window.campSelectionModule || {};
    this.campHandler = new CampSelectionHandler(this.state, this);
  }
  return this.campHandler.selectCamp(payload.playerId, payload.campIndex);
}

function handleDeselectCamp(payload) {
  if (!this.campHandler) {
    const { CampSelectionHandler } = window.campSelectionModule || {};
    this.campHandler = new CampSelectionHandler(this.state, this);
  }
  return this.campHandler.deselectCamp(payload.playerId, payload.campIndex);
}

function handleConfirmCamps(payload) {
  if (!this.campHandler) {
    const { CampSelectionHandler } = window.campSelectionModule || {};
    this.campHandler = new CampSelectionHandler(this.state, this);
  }
  return this.campHandler.confirmSelection(payload.playerId);
}

function handleSyncCampSelection(payload) {
  if (!this.campHandler) {
    const { CampSelectionHandler } = window.campSelectionModule || {};
    this.campHandler = new CampSelectionHandler(this.state, this);
  }

  const selection = this.state.campSelection[payload.playerId + "Player"];
  if (!selection) {
    console.error("[CAMP] No selection found for", payload.playerId);
    return false;
  }

  const { ALL_CAMPS } = window.campsModule || {};
  selection.selectedCamps = payload.selectedCamps.map((campName) => {
    const campDef = Object.values(ALL_CAMPS).find((c) => c.name === campName);
    return {
      ...campDef,
      isReady: true,
      isDamaged: campDef?.isDamaged || false,
      isDestroyed: false,
    };
  });

  selection.confirmed = true;
  console.log(
    `[CAMP] Synced ${payload.playerId}'s camps:`,
    payload.selectedCamps
  );

  if (
    this.state.campSelection.leftPlayer.confirmed &&
    this.state.campSelection.rightPlayer.confirmed &&
    this.state.campSelection.active
  ) {
    if (
      !window.debugGame?.dispatcher?.networkMode ||
      window.networkPlayerId === "left"
    ) {
      this.campHandler.finalizeCampSelection();
    }
  }

  return true;
}

function handleSyncCampDistribution(payload) {
  if (!this.campHandler) {
    const { CampSelectionHandler } = window.campSelectionModule || {};
    this.campHandler = new CampSelectionHandler(this.state, this);
  }

  const { ALL_CAMPS } = window.campsModule || {};

  this.state.campSelection.leftPlayer.drawnCamps = payload.leftCamps.map(
    (campName) => Object.values(ALL_CAMPS).find((c) => c.name === campName)
  );
  this.state.campSelection.rightPlayer.drawnCamps = payload.rightCamps.map(
    (campName) => Object.values(ALL_CAMPS).find((c) => c.name === campName)
  );

  this.state.campSelection.active = true;
  this.state.phase = "camp_selection";

  console.log("[CAMP] Received camp distribution");
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

function handleFinalizeCamps(payload) {
  console.log("[CAMP] Right player received finalized camps");

  const { ALL_CAMPS } = window.campsModule || {};

  ["left", "right"].forEach((playerId) => {
    const campNames =
      playerId === "left" ? payload.leftCamps : payload.rightCamps;
    const player = this.state.players[playerId];

    campNames.forEach((campName, index) => {
      const campDef = Object.values(ALL_CAMPS).find((c) => c.name === campName);

      const campCard = {
        ...campDef,
        id: `${playerId}_camp_${index}`,
        type: "camp",
        isReady: true,
        isDamaged: campDef.isDamaged || false,
        isDestroyed: false,
      };

      player.columns[index].setCard(0, campCard);
      console.log(`[CAMP] Placed ${campName} in ${playerId} column ${index}`);
    });

    const handSize = campNames.reduce((sum, campName) => {
      const camp = Object.values(ALL_CAMPS).find((c) => c.name === campName);
      return sum + (camp.campDraw || 0);
    }, 0);

    player.initialHandSize = handSize;
  });

  this.state.campSelection.active = false;

  if (this.campHandler) {
    this.campHandler.initializeMainGame();
  }

  return true;
}

// Synchronization handlers
function handlePlayerDrewCard(payload) {
  console.log(`[SYNC] Player ${payload.playerId} drew card`);

  const player = this.state.players[payload.playerId];

  while (player.hand.length < payload.handCount) {
    player.hand.push({
      id: `unknown_${Date.now()}_${player.hand.length}`,
      name: "Unknown",
      type: "unknown",
      cost: 0,
    });
    console.log(`[SYNC] Added placeholder card to ${payload.playerId}'s hand`);
  }

  player.water = payload.water;

  while (this.state.deck.length > payload.deckCount) {
    this.state.deck.shift();
  }

  console.log(
    `[SYNC] ${payload.playerId} now has ${player.hand.length} cards, ${player.water} water`
  );
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

function handleCardPlayed(payload) {
  console.log(`[SYNC] ${payload.playerId} played ${payload.cardName}`);

  const player = this.state.players[payload.playerId];
  const column = player.columns[payload.columnIndex];

  column.setCard(payload.position, {
    id: `synced_${Date.now()}`,
    name: payload.cardName,
    type: "person",
    isReady: false,
    isDamaged: false,
    isDestroyed: false,
  });

  while (player.hand.length > payload.handCount) {
    player.hand.pop();
  }

  player.water = payload.water;

  console.log(
    `[SYNC] Placed ${payload.cardName} at col ${payload.columnIndex}, pos ${payload.position}`
  );
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

function handleSyncReplenishComplete(payload) {
  console.log("[SYNC] Replenish complete from other player");

  const activePlayer = this.state.players[payload.currentPlayer];
  const targetHandCount = payload.activePlayerHandCount;

  while (activePlayer.hand.length < targetHandCount) {
    activePlayer.hand.push({
      id: `unknown_${Date.now()}_${activePlayer.hand.length}`,
      name: "Unknown",
      type: "unknown",
      cost: 0,
    });
  }

  activePlayer.water = payload.activePlayerWater;

  while (this.state.deck.length > payload.deckCount) {
    this.state.deck.shift();
  }

  console.log(
    `[SYNC] Updated ${payload.currentPlayer}: ${activePlayer.hand.length} cards, ${activePlayer.water} water`
  );
  window.dispatchEvent(new CustomEvent("gameStateChanged"));
  this.notifyUI("PHASE_CHANGE", this.state.phase);

  return true;
}

function handleSyncPendingState(payload) {
  console.log("[SYNC] Received pending state:", payload);

  this.state.pending = payload.pending;

  if (payload.eventQueue) {
    ["left", "right"].forEach((playerId) => {
      const queue = payload.eventQueue[playerId];
      if (queue) {
        queue.forEach((eventName, index) => {
          if (eventName === null) {
            this.state.players[playerId].eventQueue[index] = null;
          }
        });
      }
    });
  }

  window.dispatchEvent(new CustomEvent("gameStateChanged"));
  return true;
}

function handleSyncEventQueue(payload) {
  console.log("[SYNC] Received event queue update:", payload);

  const player = this.state.players[payload.playerId];

  payload.eventQueue.forEach((eventName, index) => {
    if (eventName === null) {
      player.eventQueue[index] = null;
    }
  });

  window.dispatchEvent(new CustomEvent("gameStateChanged"));
  return true;
}

function handleCardJunked(payload) {
  console.log(
    `[SYNC] ${payload.playerId} junked ${payload.cardName} for ${payload.junkEffect}`
  );

  const player = this.state.players[payload.playerId];

  // Handle Water Silo specially
  if (payload.isWaterSilo) {
    player.waterSilo = "available";
  }

  // Handle raid effect
  if (payload.junkEffect === "raid") {
    // Check if Raiders already in queue (to prevent double placement)
    const hasRaiders = player.eventQueue.some((e) => e && e.isRaiders);

    if (!hasRaiders && player.raiders === "available") {
      // Find first available slot for Raiders
      for (let i = 1; i < 3; i++) {
        // Raiders wants slot 2 (index 1)
        if (!player.eventQueue[i]) {
          player.eventQueue[i] = {
            id: `${payload.playerId}_raiders`,
            name: "Raiders",
            isRaiders: true,
            queueNumber: 2,
          };
          player.raiders = "in_queue";
          console.log(`[SYNC] Placed Raiders in slot ${i + 1}`);
          break;
        }
      }
    } else {
      console.log(`[SYNC] Raiders already in queue or unavailable`);
    }
  }

  // Update hand count
  while (player.hand.length > payload.handCount) {
    player.hand.pop();
  }

  // Update water
  player.water = payload.water;

  console.log(
    `[SYNC] ${payload.playerId} now has ${player.hand.length} cards, ${player.water} water`
  );
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

function handleAbilityUsed(payload) {
  console.log(
    `[SYNC] ${payload.playerId} used ${payload.cardName}'s ${payload.abilityEffect} ability`
  );

  const player = this.state.players[payload.playerId];
  const card = this.state.getCard(
    payload.playerId,
    payload.columnIndex,
    payload.position
  );

  // Mark card as used
  if (card) {
    card.isReady = false;
  }

  // Update water
  player.water = payload.water;

  console.log(
    `[SYNC] ${payload.cardName} marked as not ready, water: ${player.water}`
  );
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

function handleEventPlayed(payload) {
  console.log(`[SYNC] ${payload.playerId} played event ${payload.eventName}`);

  const player = this.state.players[payload.playerId];

  // Update event queue
  if (payload.eventQueue) {
    player.eventQueue = payload.eventQueue.map((name) =>
      name ? { name: name, id: `event_${Date.now()}` } : null
    );
  }

  // Update hand count
  while (player.hand.length > payload.handCount) {
    player.hand.pop();
  }

  // Update water
  player.water = payload.water;

  console.log(
    `[SYNC] Event ${payload.eventName} placed in slot ${payload.queueSlot}`
  );
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

function handleWaterSiloTaken(payload) {
  console.log(`[SYNC] ${payload.playerId} took Water Silo`);

  const player = this.state.players[payload.playerId];

  // Update water silo status
  player.waterSilo = payload.waterSiloStatus;

  // Add placeholder card to hand
  while (player.hand.length < payload.handCount) {
    player.hand.push({
      id: `water_silo_${Date.now()}`,
      name: "Water Silo",
      type: "special",
      isWaterSilo: true,
    });
  }

  // Update water
  player.water = payload.water;

  console.log(`[SYNC] Water Silo taken, water: ${player.water}`);
  window.dispatchEvent(new CustomEvent("gameStateChanged"));

  return true;
}

// Store references to modules we need
window.campSelectionModule = { CampSelectionHandler: null };
window.campsModule = { ALL_CAMPS: null };
