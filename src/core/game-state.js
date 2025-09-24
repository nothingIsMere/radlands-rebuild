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
    // If deck is empty, handle exhaustion
    if (this.deck.length === 0) {
      // First exhaustion - check for Obelisk win condition
      if (this.deckExhaustedCount === 0) {
        this.deckExhaustedCount = 1;
        console.log("Deck exhausted for the first time");

        // Check for Obelisk
        const obeliskOwner = this.checkForObelisk();
        if (obeliskOwner) {
          console.log(`${obeliskOwner} wins due to Obelisk!`);
          this.phase = "game_over";
          this.winner = obeliskOwner;
          this.winReason = "obelisk";
          return { gameEnded: true, card: null };
        }

        // No Obelisk - reshuffle discard into deck
        if (this.discard.length > 0) {
          console.log(`Reshuffling ${this.discard.length} cards from discard`);
          this.deck = [...this.discard];
          this.discard = [];

          // Shuffle the deck
          for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
          }
        } else {
          // No cards to reshuffle - second exhaustion
          this.deckExhaustedCount = 2;
          console.log("Deck exhausted twice - game ends in draw!");
          this.phase = "game_over";
          this.winner = "draw";
          this.winReason = "deck_exhausted_twice";
          return { gameEnded: true, card: null };
        }
      } else {
        // Second exhaustion - game ends in draw
        this.deckExhaustedCount = 2;
        console.log("Deck exhausted twice - game ends in draw!");
        this.phase = "game_over";
        this.winner = "draw";
        this.winReason = "deck_exhausted_twice";
        return { gameEnded: true, card: null };
      }
    }

    // Now try to draw a card
    if (this.deck.length > 0) {
      const card = this.deck.shift();

      if (addToPlayerHand && playerId) {
        this.players[playerId].hand.push(card);
      }

      return { gameEnded: false, card: card };
    }

    // No cards available (shouldn't reach here normally)
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
