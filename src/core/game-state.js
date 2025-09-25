import { Column } from "./column.js";

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

  checkDeckExhaustion() {
    // Called after any card removal from deck
    if (this.deck.length === 0) {
      console.log(
        `[EXHAUSTION CHECK] Deck empty, exhaustion count: ${this.deckExhaustedCount}`
      );

      if (this.deckExhaustedCount >= 1) {
        // Second exhaustion
        const obeliskOwner = this.checkForObelisk();
        if (obeliskOwner) {
          console.log(`[EXHAUSTION] ${obeliskOwner} wins due to Obelisk!`);
          this.phase = "game_over";
          this.winner = obeliskOwner;
          this.winReason = "obelisk";
          return { gameEnded: true };
        }

        console.log("[EXHAUSTION] Deck exhausted twice - game ends in tie!");
        this.phase = "game_over";
        this.winner = "draw";
        this.winReason = "deck_exhausted_twice";
        return { gameEnded: true };
      }

      // First exhaustion
      this.deckExhaustedCount = 1;
      console.log("[EXHAUSTION] First exhaustion");

      const obeliskOwner = this.checkForObelisk();
      if (obeliskOwner) {
        console.log(`[EXHAUSTION] ${obeliskOwner} wins due to Obelisk!`);
        this.phase = "game_over";
        this.winner = obeliskOwner;
        this.winReason = "obelisk";
        return { gameEnded: true };
      }

      // Reshuffle immediately
      if (this.discard.length > 0) {
        console.log(`[EXHAUSTION] Reshuffling ${this.discard.length} cards`);
        this.deck = [...this.discard];
        this.discard = [];

        for (let i = this.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        return { gameEnded: false, reshuffled: true };
      } else {
        console.log("[EXHAUSTION] No cards to reshuffle - game ends!");
        this.phase = "game_over";
        this.winner = "draw";
        this.winReason = "deck_exhausted_twice";
        return { gameEnded: true };
      }
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
