import { Column } from "./column.js";
import {
  shouldTriggerObelisk,
  calculateExhaustionResult,
} from "./game-logic.js";

export class GameState {
  constructor() {
    this.players = {
      left: this.createPlayerState(),
      right: this.createPlayerState(),
    };

    this.currentPlayer = "left";
    this.turnNumber = 1;
    this.phase = "setup";
    this.deck = [];
    this.discard = [];
    this.deckExhaustedCount = 0; // Track how many times deck has been exhausted

    // Pending states for multi-step operations
    this.pending = null;

    // Track per-turn events
    this.turnEvents = {
      eventsPlayed: 0,
      peoplePlayedThisTurn: 0,
      eventResolvedThisTurn: false,
      abilityUsedThisTurn: false,
      veraFirstUseCards: [],
      resonatorUsedThisTurn: false,
    };

    this.activeAbilityContext = null;
  }

  resetToFreshGame() {
    // Reset basic game state
    this.currentPlayer = "left";
    this.turnNumber = 1;
    this.phase = "setup";
    this.deckExhaustedCount = 0;
    this.pending = null;
    this.activeAbilityContext = null;

    // Reset turn events
    this.turnEvents = {
      eventsPlayed: 0,
      peoplePlayedThisTurn: 0,
      eventResolvedThisTurn: false,
      abilityUsedThisTurn: false,
      veraFirstUseCards: [],
      resonatorUsedThisTurn: false,
    };

    // Reset both players
    this.players.left = this.createPlayerState();
    this.players.right = this.createPlayerState();

    // Clear deck and discard
    this.deck = [];
    this.discard = [];

    console.log("[GAME] Reset to fresh state");

    // Trigger UI update
    window.dispatchEvent(new CustomEvent("gameStateChanged"));
  }

  checkDeckExhaustion() {
    // Only check if deck is empty
    if (this.deck.length > 0) {
      return { gameEnded: false };
    }

    console.log(
      `[EXHAUSTION] Deck empty. Count: ${this.deckExhaustedCount}, Discard: ${this.discard.length}`
    );

    // FIRST: Always check for Obelisk when deck becomes empty
    // This happens BEFORE we even think about reshuffling
    if (this.deckExhaustedCount === 0) {
      // This is the first time the deck is empty
      const obelisk = shouldTriggerObelisk(
        this.deck.length,
        this.deckExhaustedCount,
        this.players
      );

      if (obelisk.trigger) {
        console.log(
          `[EXHAUSTION] ${obelisk.winner} wins due to Obelisk on FIRST exhaustion!`
        );
        this.phase = "game_over";
        this.winner = obelisk.winner;
        this.winReason = obelisk.reason;
        return { gameEnded: true };
      }
    }

    // No Obelisk - now check exhaustion outcomes
    const exhaustion = calculateExhaustionResult(
      this.deck.length,
      this.discard.length,
      this.deckExhaustedCount
    );

    if (exhaustion.gameEnds) {
      console.log(`[EXHAUSTION] Game ends - ${exhaustion.reason}`);
      this.phase = "game_over";
      this.winner = exhaustion.result;
      this.winReason = exhaustion.reason;
      return { gameEnded: true };
    }

    if (exhaustion.shouldReshuffle) {
      // First exhaustion with no Obelisk - reshuffle
      this.deckExhaustedCount++;
      console.log(
        `[EXHAUSTION] First exhaustion, no Obelisk, reshuffling ${this.discard.length} cards`
      );

      this.deck = [...this.discard];
      this.discard = [];

      // Shuffle
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }

      return { gameEnded: false, reshuffled: true };
    }

    // First exhaustion but no cards to reshuffle
    if (this.deckExhaustedCount === 0 && this.discard.length === 0) {
      this.deckExhaustedCount++;
      console.log(
        "[EXHAUSTION] First exhaustion but no cards to reshuffle - continuing"
      );
      // Don't end the game yet - this counts as first exhaustion
      // Next time deck empties will be second exhaustion
      return { gameEnded: false };
    }

    return { gameEnded: false };
  }

  drawCardWithReshuffle(addToPlayerHand = true, playerId = null) {
    // Check if deck is already empty before trying to draw
    if (this.deck.length === 0) {
      const exhaustion = this.checkDeckExhaustion();
      if (exhaustion.gameEnded) {
        return { gameEnded: true, card: null };
      }
      // Deck was reshuffled if we get here
    }

    // Draw if possible
    if (this.deck.length > 0) {
      const card = this.deck.shift();

      if (addToPlayerHand && playerId) {
        this.players[playerId].hand.push(card);
      }

      console.log(
        `[DRAW] Drew card: ${card.name}. Deck now has ${this.deck.length} cards`
      );

      // CHECK EXHAUSTION IMMEDIATELY AFTER DECK BECOMES EMPTY
      if (this.deck.length === 0) {
        console.log(
          "[DRAW] Deck just became empty - checking exhaustion immediately"
        );
        const exhaustion = this.checkDeckExhaustion();
        if (exhaustion.gameEnded) {
          return { gameEnded: true, card: null };
        }
        // If not game ended, deck was just reshuffled
        console.log(
          `[DRAW] Deck reshuffled, now has ${this.deck.length} cards`
        );
      }

      return { gameEnded: false, card: card };
    }

    return { gameEnded: false, card: null };
  }

  checkForObelisk() {
    for (const playerId of ["left", "right"]) {
      const player = this.players[playerId];
      for (let col = 0; col < 3; col++) {
        const camp = player.columns[col].getCard(0);
        if (
          camp &&
          camp.name.toLowerCase() === "obelisk" &&
          !camp.isDestroyed
        ) {
          return playerId;
        }
      }
    }
    return null;
  }

  drawCardWithReshuffle(addToPlayerHand = true, playerId = null) {
    console.log(
      `[DRAW] Attempting draw. Deck: ${this.deck.length}, Discard: ${this.discard.length}, Exhaustion count: ${this.deckExhaustedCount}`
    );

    // If deck is empty BEFORE drawing, check exhaustion
    if (this.deck.length === 0) {
      console.log("[DRAW] Deck is empty before draw - checking exhaustion");
      const exhaustion = this.checkDeckExhaustion();
      if (exhaustion.gameEnded) {
        return { gameEnded: true, card: null };
      }
      // If not game ended, deck was reshuffled
    }

    // Draw a card if possible
    if (this.deck.length > 0) {
      const card = this.deck.shift();

      if (addToPlayerHand && playerId) {
        this.players[playerId].hand.push(card);
      }

      console.log(
        `[DRAW] Drew card: ${card.name}. Deck now has ${this.deck.length} cards`
      );

      // CRITICAL: Check if deck JUST became empty
      if (this.deck.length === 0) {
        console.log(
          "[DRAW] Deck just became empty (0 cards) - triggering exhaustion check immediately!"
        );
        const exhaustion = this.checkDeckExhaustion();
        if (exhaustion.gameEnded) {
          return { gameEnded: true, card: null };
        }
        // If we get here, deck was reshuffled
        console.log(
          `[DRAW] After reshuffle, deck now has ${this.deck.length} cards`
        );
      }

      return { gameEnded: false, card: card };
    }

    return { gameEnded: false, card: null };
  }

  createPlayerState() {
    return {
      columns: [new Column(0), new Column(1), new Column(2)],
      eventQueue: [null, null, null],
      hand: [],
      water: 0,
      raiders: "available",
      waterSilo: "available",
    };
  }

  getCard(playerId, columnIndex, position) {
    return this.players[playerId].columns[columnIndex].getCard(position);
  }

  placeCard(playerId, columnIndex, position, card) {
    const column = this.players[playerId].columns[columnIndex];
    if (column.canPlaceCard(position, card)) {
      column.setCard(position, card);
      return true;
    }
    return false;
  }

  findJuggernaut(playerId) {
    const player = this.players[playerId];
    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (card?.name === "Juggernaut") {
          return { column: col, position: pos, card };
        }
      }
    }
    return null;
  }

  getAllCards(playerId) {
    const cards = [];
    const player = this.players[playerId];

    for (let col = 0; col < 3; col++) {
      for (let pos = 0; pos < 3; pos++) {
        const card = player.columns[col].getCard(pos);
        if (card) {
          cards.push({
            card,
            column: col,
            position: pos,
          });
        }
      }
    }

    return cards;
  }

  getUnprotectedTargets(playerId) {
    const targets = [];
    const player = this.players[playerId];

    for (let col = 0; col < 3; col++) {
      const columnTargets = player.columns[col].getUnprotectedTargets();
      columnTargets.forEach((t) => {
        targets.push({
          ...t,
          column: col,
        });
      });
    }

    return targets;
  }

  clone() {
    // Deep clone for state management
    return JSON.parse(JSON.stringify(this));
  }
}
