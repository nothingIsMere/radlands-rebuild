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

    // Pending states for multi-step operations
    this.pending = null;

    // Track per-turn events
    this.turnEvents = {
      eventsPlayed: 0,
      peoplePlayedThisTurn: 0,
      eventResolvedThisTurn: false,
      abilityUsedThisTurn: false,
      veraFirstUseCards: [],
    };
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
