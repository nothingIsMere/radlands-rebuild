// server/server-game-engine.js
export class ServerGameEngine {
  constructor(roomId) {
    this.roomId = roomId;
    this.commandHistory = [];
    this.stateVersion = 0;

    // Simple state for now - we'll expand this
    this.gameState = {
      currentPlayer: "left",
      phase: "setup",
      turnNumber: 1,
      deckCount: 0,
      discardCount: 0,
      players: {
        left: {
          handCount: 0,
          water: 0,
          raiders: "available",
          waterSilo: "available",
          hand: [], // Server tracks actual cards
        },
        right: {
          handCount: 0,
          water: 0,
          raiders: "available",
          waterSilo: "available",
          hand: [],
        },
      },
    };
  }

  executeCommand(command, fromPlayer) {
    console.log(`[ENGINE] Executing ${command.type} from ${fromPlayer}`);

    // Update server state based on command type
    switch (command.type) {
      case "SYNC_PHASE_CHANGE":
        if (command.payload) {
          this.gameState.phase = command.payload.phase;
          this.gameState.currentPlayer = command.payload.currentPlayer;
          this.gameState.turnNumber = command.payload.turnNumber;
          console.log(`[ENGINE] Updated phase to ${this.gameState.phase}`);
        }
        break;

      case "SYNC_REPLENISH_COMPLETE":
        if (command.payload) {
          const player = this.gameState.players[command.payload.currentPlayer];
          player.handCount = command.payload.activePlayerHandCount;
          player.water = command.payload.activePlayerWater;
          this.gameState.deckCount = command.payload.deckCount;
          console.log(
            `[ENGINE] ${command.payload.currentPlayer} drew card - hand: ${player.handCount}`
          );
        }
        break;

      // Add more command handlers as needed
    }

    // Track the command
    this.commandHistory.push({
      version: ++this.stateVersion,
      command,
      fromPlayer,
      timestamp: Date.now(),
    });

    // Return the updated state
    return {
      success: true,
      stateVersion: this.stateVersion,
      gameState: this.getSanitizedState(),
      command: command,
    };
  }

  getSanitizedState() {
    // Return state without hidden info
    return {
      currentPlayer: this.gameState.currentPlayer,
      phase: this.gameState.phase,
      turnNumber: this.gameState.turnNumber,
      stateVersion: this.stateVersion,
      deckCount: this.gameState.deckCount,
      discardCount: this.gameState.discardCount,
      players: {
        left: {
          handCount: this.gameState.players.left.hand.length,
          water: this.gameState.players.left.water,
          raiders: this.gameState.players.left.raiders,
          waterSilo: this.gameState.players.left.waterSilo,
        },
        right: {
          handCount: this.gameState.players.right.hand.length,
          water: this.gameState.players.right.water,
          raiders: this.gameState.players.right.raiders,
          waterSilo: this.gameState.players.right.waterSilo,
        },
      },
    };
  }
}
