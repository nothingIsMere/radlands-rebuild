import { ALL_CAMPS } from "../cards/all_camp_definitions.js";
import { createDrawDeck } from "../cards/card-definitions.js";

export class CampSelectionHandler {
  constructor(gameState, dispatcher) {
    this.state = gameState;
    this.dispatcher = dispatcher;
  }

  startCampSelection() {
    this.state.phase = "camp_selection";
    this.state.campSelection.active = true;

    if (window.debugGame?.dispatcher?.networkMode) {
      if (window.networkPlayerId === "left") {
        // Left player creates ONE deck, shuffles it, deals 12 camps total
        console.log("[CAMP] Creating and distributing camps");

        const campDeck = Object.values(ALL_CAMPS).map((camp) => ({
          ...camp,
          isReady: true,
          isDamaged: camp.isDamaged || false,
          isDestroyed: false,
        }));

        this.shuffleDeck(campDeck);

        // Deal 6 to each player
        const leftCamps = campDeck.splice(0, 6);
        const rightCamps = campDeck.splice(0, 6);

        // Set them locally
        this.state.campSelection.leftPlayer.drawnCamps = leftCamps;
        this.state.campSelection.rightPlayer.drawnCamps = rightCamps;

        // Send to right player
        window.debugGame.dispatcher.dispatch({
          type: "SYNC_CAMP_DISTRIBUTION",
          payload: {
            leftCamps: leftCamps.map((c) => c.name),
            rightCamps: rightCamps.map((c) => c.name),
          },
        });
      }
      // Right player just waits to receive the distribution
    } else {
      // Single player - same logic
      const campDeck = Object.values(ALL_CAMPS).map((camp) => ({
        ...camp,
        isReady: true,
        isDamaged: camp.isDamaged || false,
        isDestroyed: false,
      }));

      this.shuffleDeck(campDeck);

      this.state.campSelection.leftPlayer.drawnCamps = campDeck.splice(0, 6);
      this.state.campSelection.rightPlayer.drawnCamps = campDeck.splice(0, 6);
    }
  }

  selectCamp(playerId, campIndex) {
    const selection = this.state.campSelection[playerId + "Player"];

    if (selection.selectedCamps.length >= 3) {
      console.log("[CAMP] Already selected 3 camps");
      return false;
    }

    const camp = selection.drawnCamps[campIndex];
    if (!camp || selection.selectedCamps.some((c) => c.name === camp.name)) {
      return false;
    }

    selection.selectedCamps.push(camp);
    console.log(
      `[CAMP] ${playerId} selected ${camp.name} (${selection.selectedCamps.length}/3)`
    );

    return true;
  }

  deselectCamp(playerId, campIndex) {
    const selection = this.state.campSelection[playerId + "Player"];
    selection.selectedCamps.splice(campIndex, 1);
    console.log(
      `[CAMP] ${playerId} deselected camp (${selection.selectedCamps.length}/3)`
    );
    return true;
  }

  confirmSelection(playerId) {
    const selection = this.state.campSelection[playerId + "Player"];

    if (selection.selectedCamps.length !== 3) {
      console.log("[CAMP] Must select exactly 3 camps");
      return false;
    }

    selection.confirmed = true;
    console.log(`[CAMP] ${playerId} confirmed their camp selection`);

    // Broadcast the camp selection to the other player
    if (window.debugGame?.dispatcher?.networkMode) {
      window.debugGame.dispatcher.dispatch({
        type: "SYNC_CAMP_SELECTION",
        playerId: playerId,
        payload: {
          playerId: playerId,
          selectedCamps: selection.selectedCamps.map((c) => c.name),
        },
      });
    }

    // Check if both players confirmed
    if (
      this.state.campSelection.leftPlayer.confirmed &&
      this.state.campSelection.rightPlayer.confirmed
    ) {
      this.finalizeCampSelection();
    }

    return true;
  }

  finalizeCampSelection() {
    console.log("[CAMP] Both players confirmed - finalizing camp selection");

    // In network mode, only ONE player should finalize and broadcast
    if (window.debugGame?.dispatcher?.networkMode) {
      // Only the left player does the finalization and broadcasts it
      if (window.networkPlayerId !== "left") {
        console.log(
          "[CAMP] Right player waiting for finalization from left player"
        );
        return; // Right player doesn't finalize, waits for sync
      }
    }

    // Log what's being placed
    console.log(
      "[CAMP] Left camps being placed:",
      this.state.campSelection.leftPlayer.selectedCamps.map((c) => c.name)
    );
    console.log(
      "[CAMP] Right camps being placed:",
      this.state.campSelection.rightPlayer.selectedCamps.map((c) => c.name)
    );

    // Place selected camps
    ["left", "right"].forEach((playerId) => {
      const selection = this.state.campSelection[playerId + "Player"];
      const player = this.state.players[playerId];

      selection.selectedCamps.forEach((camp, index) => {
        const campCard = {
          ...camp,
          id: `${playerId}_camp_${index}`,
          type: "camp",
          isReady: true,
          isDamaged: camp.isDamaged || false,
          isDestroyed: false,
        };

        player.columns[index].setCard(0, campCard);
        console.log(
          `[CAMP] Placed ${camp.name} in ${playerId} column ${index}`
        );
      });

      // Calculate initial hand size
      const handSize = selection.selectedCamps.reduce(
        (sum, camp) => sum + camp.campDraw,
        0
      );
      player.initialHandSize = handSize;
    });

    // In network mode, broadcast the finalized state
    if (window.debugGame?.dispatcher?.networkMode) {
      window.debugGame.dispatcher.dispatch({
        type: "FINALIZE_CAMPS",
        payload: {
          leftCamps: this.state.campSelection.leftPlayer.selectedCamps.map(
            (c) => c.name
          ),
          rightCamps: this.state.campSelection.rightPlayer.selectedCamps.map(
            (c) => c.name
          ),
        },
      });
    }

    // Clean up and initialize
    this.state.campSelection.active = false;
    this.initializeMainGame();
  }

  initializeMainGame() {
    console.log("[CAMP] Initializing main game");

    // Create and shuffle draw deck
    const drawDeck = createDrawDeck();
    this.shuffleDeck(drawDeck);
    this.state.deck = drawDeck;
    this.state.discard = [];

    console.log(`[CAMP] Draw deck created with ${drawDeck.length} cards`);

    // Draw initial hands
    ["left", "right"].forEach((playerId) => {
      const player = this.state.players[playerId];
      const handSize = player.initialHandSize || 3; // Default to 3 if not set

      player.hand = []; // Clear any existing cards

      for (let i = 0; i < handSize; i++) {
        const card = this.state.deck.shift();
        if (card) {
          player.hand.push(card);
        }
      }

      console.log(`[CAMP] ${playerId} drew ${handSize} cards`);

      // Set initial water
      player.water = 3;

      // Reset raiders and water silo
      player.raiders = "available";
      player.waterSilo = "available";
    });

    // Randomly select starting player
    this.state.currentPlayer = Math.random() < 0.5 ? "left" : "right";

    // Start in events phase
    this.state.phase = "events";
    this.state.turnNumber = 1;

    console.log(
      `[CAMP] Game initialized - ${this.state.currentPlayer} goes first`
    );
    console.log(`[CAMP] Deck remaining: ${this.state.deck.length} cards`);

    // Trigger UI update
    window.dispatchEvent(new CustomEvent("gameStateChanged"));

    // Start phase progression after a short delay
    setTimeout(() => {
      if (window.commandSystem && this.state.phase === "events") {
        console.log("[CAMP] Starting events phase");
        window.commandSystem.processEventsPhase();
      }
    }, 500);
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
}
